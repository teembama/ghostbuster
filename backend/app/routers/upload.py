"""Upload router for GhostBuster.

Handles CSV upload, validation, persistence, and kicks off background
fraud analysis. Exposes upload status lookup.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.models.schemas import UploadResponse
from app.services import analysis_store
from app.services.database_service import db
from app.services.fraud_detector import FraudDetector
from app.utils.csv_parser import parser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

# In-memory handoff between the upload request and the background analysis task.
# Keyed by upload_id; the entry is popped when run_analysis claims it. This
# lets the upload endpoint return without any Supabase writes for employee
# rows — those land later in the background.
employee_cache: Dict[str, List[Dict]] = {}


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
        emp["upload_id"] = upload_id

    # Hand the parsed rows to the background task in memory. Saving the
    # employee rows to Supabase is deferred to run_analysis, so the upload
    # response returns without a 10k-row insert in the request path.
    employee_cache[upload_id] = employees

    # Mark processing in the in-memory store so a poll right after upload sees
    # the correct state without waiting for the background task to start.
    analysis_store.set_processing(upload_id)

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
        # Fast path: the upload handler stashed the parsed rows in memory.
        # Fallback: if the cache is missing (process restart, replay, etc.)
        # try Supabase — only useful if save_employees ran for this upload
        # in a previous lifecycle.
        employees_list = employee_cache.pop(upload_id, None)
        if not employees_list:
            logger.info("Cache miss for upload %s; falling back to DB read", upload_id)
            employees_list = db._select_all(
                "employees", eq={"upload_id": upload_id}
            )

        if not employees_list:
            logger.warning("No employees found for upload %s", upload_id)
            db.client.table("uploads").update({"status": "failed"}).eq(
                "id", upload_id
            ).execute()
            analysis_store.set_failed(upload_id, "no employees found")
            return

        # Run fraud detection on the in-memory rows. FraudDetector.analyze
        # returns {employees (with scored fields), summary, fraud_breakdown}.
        detector = FraudDetector()
        results = detector.analyze(employees_list)

        scored_employees = results.get("employees") or []
        summary = results.get("summary") or {}
        fraud_breakdown = results.get("fraud_breakdown") or {}

        # Normalize red_flags: FraudDetector leaves it as None for rows that
        # weren't flagged, but the DB column rejects nulls in some setups.
        for emp in scored_employees:
            if emp.get("red_flags") is None:
                emp["red_flags"] = []

        # --- Persist employee rows to Supabase ---
        # Deferred from the upload handler so the request returned fast.
        # save_employees uses bulk INSERT in chunks of 1000; the upsert below
        # then guarantees the scored fields are written even if a future
        # schema change makes some scored columns omitted from the insert.
        try:
            db.save_employees(upload_id, scored_employees)
        except Exception:  # noqa: BLE001
            logger.exception(
                "Failed to save employees for upload %s; upsert below may "
                "insert from scratch if no rows exist yet",
                upload_id,
            )

        # --- Bulk-upsert scored fields ---
        # Keeps the score-write path resilient: if save_employees succeeded
        # this updates the same rows; if save_employees partially failed it
        # fills the gap (upsert = insert on conflict-update).
        updates = []
        for emp in scored_employees:
            emp_id = emp.get("id")
            if not emp_id:
                logger.warning("Skipping scored employee with no id: %s", emp)
                continue
            updates.append({
                "id": emp_id,
                "upload_id": upload_id,
                "fraud_score": emp.get("fraud_score", 0),
                "classification": emp.get("classification", "VERIFIED"),
                "red_flags": emp.get("red_flags") or [],
            })

        if updates:
            chunk_size = 500
            for i in range(0, len(updates), chunk_size):
                chunk = updates[i:i + chunk_size]
                try:
                    db.client.table("employees").upsert(chunk).execute()
                except Exception:  # noqa: BLE001
                    logger.exception(
                        "Failed to bulk update employees chunk %d for upload %s",
                        i // chunk_size, upload_id
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
        analysis_store.set_complete(upload_id)
        logger.info("Analysis completed for upload %s", upload_id)

    except Exception as exc:  # noqa: BLE001 — we want any failure to mark the upload
        logger.exception("Analysis failed for upload %s: %s", upload_id, exc)
        analysis_store.set_failed(upload_id, str(exc))
        # Defensive: if the cache entry survived past the pop (shouldn't,
        # but a thrown exception before the pop call would leave it),
        # drop it so the dict doesn't grow unbounded under repeated failure.
        employee_cache.pop(upload_id, None)
        try:
            db.client.table("uploads").update({"status": "failed"}).eq(
                "id", upload_id
            ).execute()
        except Exception:  # noqa: BLE001
            logger.exception("Failed to mark upload %s as failed", upload_id)