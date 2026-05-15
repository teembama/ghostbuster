"""Analysis router for GhostBuster.

Exposes:
  * GET /analysis/results/{upload_id}  — aggregate analysis + per-employee details.
  * GET /analysis/graph/{upload_id}    — fraud-network graph (nodes + shared-account/biometric edges).
"""

import json
import logging
from datetime import datetime
from itertools import combinations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.models.schemas import (
    AnalysisResult,
    Employee,
    FraudBreakdown,
    NetworkEdge,
    NetworkGraphData,
    NetworkNode,
)
from app.services.database_service import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])

MAX_GRAPH_NODES = 150


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
    """Build a fraud-relationship network from flagged employees.

    Nodes: every employee with classification != VERIFIED.
    Edges:
      * shared_account   — pairs sharing the same bank_account.
      * shared_biometric — pairs sharing the same biometric_id.

    Capped at 150 nodes (highest fraud_score first). Edges between dropped
    nodes are also dropped so the graph stays internally consistent.
    """
    employee_rows = await db.get_employees(upload_id, flagged_only=True)

    if not employee_rows:
        return NetworkGraphData(nodes=[], edges=[])

    # Sort by fraud_score desc and cap to the highest-risk MAX_GRAPH_NODES.
    employee_rows.sort(
        key=lambda r: float(r.get("fraud_score") or 0),
        reverse=True,
    )
    capped_rows = employee_rows[:MAX_GRAPH_NODES]
    kept_ids = {str(r["id"]) for r in capped_rows}

    nodes: List[NetworkNode] = [
        NetworkNode(
            id=str(row["id"]),
            name=row.get("name", "") or "",
            type="employee",
            fraud_score=float(row.get("fraud_score") or 0),
            ministry=row.get("ministry", "") or "",
        )
        for row in capped_rows
    ]

    # Group kept employees by bank_account and biometric_id to find shared keys.
    bank_groups: Dict[str, List[str]] = {}
    biometric_groups: Dict[str, List[str]] = {}

    for row in capped_rows:
        emp_id = str(row["id"])

        bank = row.get("bank_account")
        if bank is not None and str(bank).strip() != "":
            bank_groups.setdefault(str(bank).strip(), []).append(emp_id)

        bio = row.get("biometric_id")
        if bio is not None and str(bio).strip() != "":
            biometric_groups.setdefault(str(bio).strip(), []).append(emp_id)

    edges: List[NetworkEdge] = []
    seen_edges: set = set()  # dedupe undirected pairs per edge type

    def _add_edge(a: str, b: str, edge_type: str) -> None:
        if a == b:
            return
        if a not in kept_ids or b not in kept_ids:
            return
        # Canonicalize ordering so (A,B) and (B,A) collapse.
        lo, hi = (a, b) if a < b else (b, a)
        key = (lo, hi, edge_type)
        if key in seen_edges:
            return
        seen_edges.add(key)
        edges.append(
            NetworkEdge(source=lo, target=hi, type=edge_type, weight=1.0)  # type: ignore[arg-type]
        )

    for ids in bank_groups.values():
        if len(ids) < 2:
            continue
        for a, b in combinations(ids, 2):
            _add_edge(a, b, "shared_account")

    for ids in biometric_groups.values():
        if len(ids) < 2:
            continue
        for a, b in combinations(ids, 2):
            _add_edge(a, b, "shared_biometric")

    return NetworkGraphData(nodes=nodes, edges=edges)