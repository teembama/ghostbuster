"""Upload router for GhostBuster.

Handles CSV upload, validation, persistence, and kicks off background
fraud analysis. Exposes upload status lookup.
"""

import logging
import uuid
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.models.schemas import UploadResponse
from app.services.analysis_service import analyze_payroll
from app.services.database_service import db
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

    On any failure the upload is marked 'failed' so the client polling the
    status endpoint sees a terminal state rather than hanging in 'processing'.
    """
    try:
        # Pull all employees for this upload (sync call — we're in a worker thread).
        response = (
            db.client.table("employees")
            .select("*")
            .eq("upload_id", upload_id)
            .execute()
        )
        employee_rows = response.data or []

        if not employee_rows:
            logger.warning("No employees found for upload %s", upload_id)
            db.client.table("uploads").update({"status": "failed"}).eq(
                "id", upload_id
            ).execute()
            return

        df = pd.DataFrame(employee_rows)

        # Guarantee the analysis service can find upload_id on the frame.
        if "upload_id" not in df.columns:
            df["upload_id"] = upload_id

        analyze_payroll(df)

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