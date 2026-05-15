"""Analysis router for GhostBuster.

Exposes:
  * GET /analysis/results/{upload_id}  — aggregate analysis + per-employee details.
  * GET /analysis/graph/{upload_id}    — fraud-network graph (nodes + shared-account/biometric edges).
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.schemas import (
    AnalysisResult,
    Employee,
    FraudBreakdown,
    NetworkGraphData,
)
from app.services.database_service import db
from app.services.network_builder import build_network_graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _coerce_fraud_breakdown(raw: Any) -> FraudBreakdown:
    """Accept the fraud_breakdown column as either dict or JSON string."""
    if raw is None:
        data: Dict[str, int] = {}
    elif isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Could not decode fraud_breakdown JSON: %r", raw)
            data = {}
    elif isinstance(raw, dict):
        data = raw
    else:
        data = {}

    return FraudBreakdown(
        ghost_workers=int(data.get("ghost_workers", 0) or 0),
        duplicate_identities=int(data.get("duplicate_identities", 0) or 0),
        salary_fraud=int(data.get("salary_fraud", 0) or 0),
        network_fraud=int(data.get("network_fraud", 0) or 0),
    )


def _row_to_employee(record: Dict[str, Any]) -> Employee:
    """Map a Supabase employee row to the Employee schema with safe defaults."""
    return Employee(
        id=str(record["id"]),
        name=record.get("name", "") or "",
        ministry=record.get("ministry", "") or "",
        salary=float(record.get("salary") or 0),
        bank_account=str(record.get("bank_account", "") or ""),
        bank_name=record.get("bank_name", "") or "",
        biometric_id=record.get("biometric_id"),
        attendance_rate=float(record.get("attendance_rate") or 0),
        employment_date=str(record.get("employment_date", "") or ""),
        fraud_score=float(record.get("fraud_score") or 0),
        classification=record.get("classification") or "VERIFIED",
        red_flags=record.get("red_flags") or [],
    )


@router.get("/results/{upload_id}")
async def get_analysis_results(upload_id: str):
    """Return the full analysis payload for an upload.

    If the analysis hasn't finished yet (no row in `analysis_results`), returns
    HTTP 202 with `{"status": "processing"}` so the client knows to keep polling.
    """
    analysis_row = await db.get_analysis_result(upload_id)
    if not analysis_row:
        return JSONResponse(status_code=202, content={"status": "processing"})

    # Pull every employee for this upload to populate the response.
    employee_rows = await db.get_employees(upload_id, flagged_only=False)
    employees = [_row_to_employee(row) for row in employee_rows]

    # processed_at: prefer DB-supplied timestamp, fall back to "now".
    processed_at_raw = (
        analysis_row.get("processed_at")
        or analysis_row.get("created_at")
        or analysis_row.get("inserted_at")
    )
    if isinstance(processed_at_raw, datetime):
        processed_at = processed_at_raw
    elif isinstance(processed_at_raw, str) and processed_at_raw:
        try:
            # Supabase returns ISO-8601; tolerate trailing Z.
            processed_at = datetime.fromisoformat(processed_at_raw.replace("Z", "+00:00"))
        except ValueError:
            processed_at = datetime.utcnow()
    else:
        processed_at = datetime.utcnow()

    result = AnalysisResult(
        upload_id=upload_id,
        total_employees=int(analysis_row.get("total_employees", len(employees))),
        flagged_count=int(analysis_row.get("flagged_count", 0)),
        estimated_loss=float(analysis_row.get("estimated_loss", 0) or 0),
        fraud_breakdown=_coerce_fraud_breakdown(analysis_row.get("fraud_breakdown")),
        employees=employees,
        processed_at=processed_at,
        analysis_duration_seconds=float(
            analysis_row.get("analysis_duration_seconds", 0) or 0
        ),
    )

    return result


@router.get("/graph/{upload_id}", response_model=NetworkGraphData)
async def get_network_graph(upload_id: str) -> NetworkGraphData:
    """Build a fraud-relationship network from flagged employees via Person 3's builder."""
    employees = await db.get_employees(upload_id, flagged_only=True)

    if not employees:
        return NetworkGraphData(nodes=[], edges=[])

    return build_network_graph([dict(e) for e in employees])