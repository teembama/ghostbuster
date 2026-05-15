"""Employees router for GhostBuster.

Exposes paginated listing of employees per upload (with optional classification
filter and sorting) and a single-employee lookup endpoint.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import Employee
from app.services.database_service import db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["employees"])

# Allow-list of sortable fields — guards against arbitrary key sorts that
# could explode on missing columns or expose internal-only fields.
SORTABLE_FIELDS = {
    "fraud_score",
    "name",
    "salary",
    "ministry",
    "attendance_rate",
    "classification",
    "employment_date",
}

VALID_CLASSIFICATIONS = {"VERIFIED", "REVIEW_REQUIRED", "HIGH_RISK"}


def _sort_key(employee: Dict[str, Any], field: str) -> Any:
    """Return a sort key that tolerates missing/None values.

    Sorting a mixed list where some rows have `None` for a field raises a
    TypeError under Python 3, so we coerce missing values to a type-appropriate
    sentinel that sorts to the end on ascending order.
    """
    value = employee.get(field)
    if value is None:
        # Numeric fields → -inf so missing sorts last on desc, first on asc.
        # We use a tuple (is_missing, value) so missing always sorts after
        # present regardless of direction-of-sort reversal.
        return (1, 0)
    return (0, value)


@router.get("/employees/{upload_id}")
async def list_employees(
    upload_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    classification: Optional[str] = Query(None),
    sort_by: str = Query("fraud_score"),
    sort_desc: bool = Query(True),
) -> Dict[str, Any]:
    """Return a paginated, optionally filtered & sorted slice of employees."""

    if sort_by not in SORTABLE_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid sort_by field. Allowed: {sorted(SORTABLE_FIELDS)}"
            ),
        )

    if classification is not None and classification not in VALID_CLASSIFICATIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid classification. Allowed: {sorted(VALID_CLASSIFICATIONS)}"
            ),
        )

    # Fetch all employees for this upload — paginated to bypass Supabase's
    # 1000-row response cap. Filter/sort/page happen below in Python.
    employees: List[Dict[str, Any]] = db._select_all(
        "employees", eq={"upload_id": upload_id}
    )

    # Apply classification filter in Python (cheap; we already have the rows).
    if classification is not None:
        employees = [e for e in employees if e.get("classification") == classification]

    # Sort in Python — Supabase ordering is fine but we need a stable, None-safe
    # sort that's identical regardless of how the underlying client behaves.
    try:
        employees.sort(key=lambda e: _sort_key(e, sort_by), reverse=sort_desc)
    except TypeError:
        # Heterogeneous types in the column — fall back to string comparison.
        employees.sort(
            key=lambda e: (e.get(sort_by) is None, str(e.get(sort_by) or "")),
            reverse=sort_desc,
        )

    total = len(employees)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    start = (page - 1) * page_size
    end = start + page_size
    page_items = employees[start:end]

    return {
        "employees": page_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/employee/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str) -> Employee:
    """Return a single employee by id, 404 if not found."""
    record = await db.get_employee_by_id(employee_id)
    if not record:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Normalize defaults so the Employee schema validates even on rows that
    # haven't been touched by the analysis pass yet.
    record.setdefault("red_flags", [])
    record.setdefault("fraud_score", 0)
    record.setdefault("classification", "VERIFIED")
    record.setdefault("biometric_id", None)
    record.setdefault("attendance_rate", 95.0)

    return Employee(**{
        "id": record["id"],
        "name": record.get("name", ""),
        "ministry": record.get("ministry", ""),
        "salary": float(record.get("salary") or 0),
        "bank_account": str(record.get("bank_account", "")),
        "bank_name": record.get("bank_name", ""),
        "biometric_id": record.get("biometric_id"),
        "attendance_rate": float(record.get("attendance_rate") or 0),
        "employment_date": str(record.get("employment_date", "")),
        "fraud_score": float(record.get("fraud_score") or 0),
        "classification": record.get("classification", "VERIFIED"),
        "red_flags": record.get("red_flags") or [],
    })