"""Upload router for GhostBuster.

Handles CSV upload, validation, persistence, and kicks off background
fraud analysis. Exposes upload status lookup.
"""

import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.models.schemas import UploadResponse
from app.services.database_service import db
from app.services.fraud_detector import FraudDetector
from app.utils.csv_parser import parser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("", response_model=UploadResponse)
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> UploadResponse:
    """Accept a payroll CSV, persist employees, and schedule fraud analysis.

    Validates the file structure, registers the upload, writes employee rows
    to the database with generated UUIDs, then dispatches the analysis to a
    background task so the client gets an immediate response.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    file_content = await file.read()
    if not file_content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Structural validation (columns, row count, parseability).
    is_valid, message = parser.validate_file(file_content)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # Parse to dicts first so we know the true row count we're committing.
    employees = parser.parse_to_dict(file_content)
    total_rows = len(employees)

    # Register the upload, then attach upload_id + per-row UUIDs.
    upload_id = await db.create_upload(filename=file.filename, total_rows=total_rows)

    for emp in employees:
        emp["id"] = str(uuid.uuid4())

    await db.save_employees(upload_id, employees)

    # Run analysis in the background; the client polls /status for completion.
    background_tasks.add_task(run_analysis, upload_id)

    return UploadResponse(
        upload_id=upload_id,
        filename=file.filename,
        total_rows=total_rows,
        uploaded_at=datetime.utcnow(),
        status="processing",
    )


@router.get("/{upload_id}/status")
async def get_upload_status(upload_id: str) -> dict:
    """Return processing status for an upload."""
    response = (
        db.client.table("uploads")
        .select("id, filename, total_rows, status")
        .eq("id", upload_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Upload not found")

    record = response.data[0]
    return {
        "upload_id": record["id"],
        "status": record["status"],
        "filename": record["filename"],
        "total_rows": record["total_rows"],
    }


def run_analysis(upload_id: str) -> None:
    """Background task: fetch employees, run fraud analysis, persist results.

    Uses FraudDetector to score employees, writes per-employee results back
    to Supabase, and inserts the aggregate row into `analysis_results`. On any
    failure the upload is marked 'failed' so the client polling the status
    endpoint sees a terminal state rather than hanging in 'processing'.
    """
    try:
        # Pull all employees for this upload (sync call — we're in a worker thread).
        # Equivalent to `await db.get_employees(upload_id)` but doesn't need an
        # event loop since FastAPI runs sync background tasks in a threadpool.
        response = (
            db.client.table("employees")
            .select("*")
            .eq("upload_id", upload_id)
            .execute()
        )
        employees_list = response.data or []

        if not employees_list:
            logger.warning("No employees found for upload %s", upload_id)
            db.client.table("uploads").update({"status": "failed"}).eq(
                "id", upload_id
            ).execute()
            return

        # Run fraud detection. FraudDetector.analyze takes the raw list of
        # employee dicts and returns {employees, summary, fraud_breakdown}.
        detector = FraudDetector()
        results = detector.analyze(employees_list)

        scored_employees = results.get("employees") or []
        summary = results.get("summary") or {}
        fraud_breakdown = results.get("fraud_breakdown") or {}

        # --- Update each employee row with new fraud_score/classification/red_flags ---
        # Done individually so one bad row doesn't abort the whole batch.
        for emp in scored_employees:
            emp_id = emp.get("id")
            if not emp_id:
                logger.warning("Skipping scored employee with no id: %s", emp)
                continue
            try:
                db.client.table("employees").update(
                    {
                        "fraud_score": emp.get("fraud_score", 0),
                        "classification": emp.get("classification", "VERIFIED"),
                        "red_flags": emp.get("red_flags") or [],
                    }
                ).eq("id", emp_id).execute()
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Failed to update employee %s for upload %s", emp_id, upload_id
                )

        # --- Insert aggregate analysis_results row ---
        try:
            db.client.table("analysis_results").insert(
                {
                    "upload_id": upload_id,
                    "total_employees": int(summary.get("total", len(scored_employees))),
                    "flagged_count": int(summary.get("flagged_count", 0)),
                    "estimated_loss": float(summary.get("estimated_loss", 0) or 0),
                    "fraud_breakdown": json.dumps(fraud_breakdown),
                    "analysis_duration_seconds": float(
                        summary.get("analysis_duration_seconds", 0) or 0
                    ),
                }
            ).execute()
        except Exception:  # noqa: BLE001
            logger.exception(
                "Failed to insert analysis_results for upload %s", upload_id
            )

        db.client.table("uploads").update({"status": "completed"}).eq(
            "id", upload_id
        ).execute()
        logger.info("Analysis completed for upload %s", upload_id)

    except Exception as exc:  # noqa: BLE001 — we want any failure to mark the upload
        logger.exception("Analysis failed for upload %s: %s", upload_id, exc)
        try:
            db.client.table("uploads").update({"status": "failed"}).eq(
                "id", upload_id
            ).execute()
        except Exception:  # noqa: BLE001
            logger.exception("Failed to mark upload %s as failed", upload_id)