"""Squad router for GhostBuster.

Exposes:
  * POST /squad/verify-account     — single account verification via Squad.
  * POST /squad/disburse/{upload_id} — bulk disburse to VERIFIED employees (with dry-run).
  * GET  /squad/banks              — supported Nigerian banks + codes.
"""

import asyncio
import logging
from typing import Any, Dict, List

from fastapi import APIRouter

from pydantic import BaseModel
from app.models.schemas import (
    AccountLookupRequest,
    AccountLookupResponse,
)
from app.services import squad_service
from app.services.database_service import db


class DisburseRequest(BaseModel):
    dry_run: bool = True

class DisburseResponse(BaseModel):
    total: int
    successful: int
    failed: int
    total_amount_naira: float
    transactions: list
    dry_run: bool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/squad", tags=["squad"])

# Cap concurrent outbound Squad calls so we don't hammer the sandbox.
MAX_CONCURRENT_TRANSFERS = 5

# Hardcoded bank list — Squad supports many more, but these are the requested ten.
SUPPORTED_BANKS = [
    {"name": "GTBank", "code": "058"},
    {"name": "Zenith", "code": "057"},
    {"name": "UBA", "code": "033"},
    {"name": "Access", "code": "044"},
    {"name": "First Bank", "code": "011"},
    {"name": "Fidelity", "code": "070"},
    {"name": "Sterling", "code": "232"},
    {"name": "Wema", "code": "035"},
    {"name": "Polaris", "code": "076"},
    {"name": "Keystone", "code": "082"},
]


@router.post("/verify-account", response_model=AccountLookupResponse)
async def verify_account_endpoint(payload: AccountLookupRequest) -> AccountLookupResponse:
    """Verify a single bank account against Squad."""
    result = await squad_service.verify_account(
        account_number=payload.account_number,
        bank_code=payload.bank_code,
    )
    return AccountLookupResponse(**result)


@router.post("/disburse/{upload_id}", response_model=DisburseResponse)
async def disburse_salaries(
    upload_id: str, payload: DisburseRequest
) -> DisburseResponse:
    """Disburse salaries to all VERIFIED employees for an upload.

    On dry_run (default), no Squad calls are made — the response simulates
    successful transfers so the operator can preview totals and references
    before committing.
    """
    # Fetch all employees for this upload, then filter to VERIFIED only.
    all_employees = await db.get_employees(upload_id, flagged_only=False)
    verified = [e for e in all_employees if e.get("classification") == "VERIFIED"]

    if not verified:
        # Empty result is a valid 200 — caller may legitimately have nothing
        # to disburse. Return zeros rather than 404'ing.
        return DisburseResponse(
            total=0,
            successful=0,
            failed=0,
            total_amount_naira=0.0,
            transactions=[],
            dry_run=payload.dry_run,
        )

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_TRANSFERS)

    async def _process(emp: Dict[str, Any]) -> Dict[str, Any]:
        emp_id = str(emp["id"])
        emp_name = emp.get("name", "") or ""
        try:
            salary = float(emp.get("salary") or 0)
        except (TypeError, ValueError):
            salary = 0.0
        amount_kobo = int(round(salary * 100))

        transaction_reference = f"SBRZKCZRQ2_{upload_id[:8]}_{emp_id[:8]}"
        bank_code = str(emp.get("bank_code") or emp.get("bank_name") or "").strip()
        account_number = str(emp.get("bank_account") or "").strip()

        if payload.dry_run:
            return {
                "employee_id": emp_id,
                "employee_name": emp_name,
                "transaction_reference": transaction_reference,
                "amount_naira": salary,
                "success": True,
                "status": "dry_run",
            }

        # Guard against bad data in the row — don't even try if essentials missing.
        if amount_kobo <= 0 or not account_number or not bank_code:
            logger.warning(
                "Skipping transfer for emp=%s (missing/invalid data: amount=%s account=%r bank=%r)",
                emp_id,
                amount_kobo,
                account_number,
                bank_code,
            )
            return {
                "employee_id": emp_id,
                "employee_name": emp_name,
                "transaction_reference": transaction_reference,
                "amount_naira": salary,
                "success": False,
                "status": "invalid_data",
            }

        async with semaphore:
            result = await squad_service.transfer_funds(
                transaction_reference=transaction_reference,
                amount_kobo=amount_kobo,
                bank_code=bank_code,
                account_number=account_number,
                account_name=emp_name,
                remark="GhostBuster Verified Salary",
            )

        return {
            "employee_id": emp_id,
            "employee_name": emp_name,
            "transaction_reference": result.get(
                "transaction_reference", transaction_reference
            ),
            "amount_naira": salary,
            "success": bool(result.get("success")),
            "status": result.get("status", "unknown"),
        }

    # gather() with return_exceptions=True so a single bug doesn't sink the batch.
    raw_results = await asyncio.gather(
        *[_process(e) for e in verified], return_exceptions=True
    )

    transactions: List[Dict[str, Any]] = []
    for emp, res in zip(verified, raw_results):
        if isinstance(res, Exception):
            logger.exception("Unhandled error processing emp=%s: %s", emp.get("id"), res)
            emp_id = str(emp.get("id", ""))
            transactions.append(
                {
                    "employee_id": emp_id,
                    "employee_name": emp.get("name", "") or "",
                    "transaction_reference": f"SBRZKCZRQ2_{upload_id[:8]}_{emp_id[:8]}",
                    "amount_naira": float(emp.get("salary") or 0),
                    "success": False,
                    "status": "error",
                }
            )
        else:
            transactions.append(res)

    successful = sum(1 for t in transactions if t["success"])
    failed = len(transactions) - successful
    total_amount = sum(t["amount_naira"] for t in transactions if t["success"])

    return DisburseResponse(
        total=len(transactions),
        successful=successful,
        failed=failed,
        total_amount_naira=total_amount,
        transactions=transactions,
        dry_run=payload.dry_run,
    )


@router.get("/banks")
async def list_banks() -> Dict[str, Any]:
    """Return supported Nigerian banks with their Squad bank codes."""
    return {"banks": SUPPORTED_BANKS}