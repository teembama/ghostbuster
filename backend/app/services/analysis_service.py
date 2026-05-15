"""Fraud detection engine for GhostBuster.

`analyze_payroll` scores every employee against a battery of fraud heuristics
(ghost workers, duplicate identities, salary anomalies, network fraud),
classifies them by accumulated score, writes the per-employee results back to
Supabase, and inserts an aggregate row into `analysis_results`.
"""

import json
import logging
import time
import uuid  # noqa: F401 — imported per spec; available for downstream use
from typing import Any, Dict, List

import pandas as pd

from app.services.database_service import db

logger = logging.getLogger(__name__)

# Score weights — kept as module constants so the rules read like a rulebook.
SCORE_PERFECT_ATTENDANCE = 25
SCORE_ZERO_ATTENDANCE = 30
SCORE_MISSING_BIOMETRIC = 35
SCORE_SHARED_BIOMETRIC = 40
SCORE_SHARED_BANK_ACCOUNT = 45
SCORE_SALARY_ABOVE_THRESHOLD = 20
SCORE_INVALID_SALARY = 50

SALARY_HIGH_THRESHOLD = 850_000

THRESHOLD_HIGH_RISK = 60
THRESHOLD_REVIEW = 30


def _classify(score: float) -> str:
    """Map a numeric fraud score to a classification label."""
    if score >= THRESHOLD_HIGH_RISK:
        return "HIGH_RISK"
    if score >= THRESHOLD_REVIEW:
        return "REVIEW_REQUIRED"
    return "VERIFIED"


def _is_missing(value: Any) -> bool:
    """True for None, NaN, empty string, or whitespace-only values."""
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except (TypeError, ValueError):
        pass
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def _flag(flag_type: str, severity: str, description: str, evidence: str) -> Dict[str, str]:
    """Build a red flag dict matching the RedFlag schema."""
    return {
        "type": flag_type,
        "severity": severity,
        "description": description,
        "evidence": evidence,
    }


def analyze_payroll(df: pd.DataFrame) -> Dict[str, Any]:
    """Score every employee in `df` and persist results.

    The input DataFrame is expected to carry an `upload_id` column (same value
    for every row) along with the employee fields defined in the schema. This
    function:

      1. Builds duplicate-detection indexes for biometric_id and bank_account.
      2. Walks every row, accumulating fraud score and red flags per rule.
      3. Updates each employee row in Supabase with the new scores/flags.
      4. Inserts an aggregate summary row into `analysis_results`.
      5. Returns a serializable dict for callers that want the result inline.
    """
    start_time = time.time()

    if df.empty:
        raise ValueError("Cannot analyze an empty DataFrame")

    if "upload_id" not in df.columns:
        raise ValueError("DataFrame is missing required 'upload_id' column")

    upload_id = df["upload_id"].iloc[0]

    # --- Build duplicate indexes ----------------------------------------------
    # Count occurrences so we can both detect duplicates and report "shared
    # with N other employees" cleanly.
    biometric_counts: Dict[str, int] = {}
    bank_account_counts: Dict[str, int] = {}

    for _, row in df.iterrows():
        bio = row.get("biometric_id")
        if not _is_missing(bio):
            key = str(bio).strip()
            biometric_counts[key] = biometric_counts.get(key, 0) + 1

        bank = row.get("bank_account")
        if not _is_missing(bank):
            key = str(bank).strip()
            bank_account_counts[key] = bank_account_counts.get(key, 0) + 1

    # --- Per-employee scoring -------------------------------------------------
    employees_result: List[Dict[str, Any]] = []

    # Aggregate counters for the fraud_breakdown summary.
    ghost_workers = 0          # missing biometric
    duplicate_identities = 0   # shared biometric
    salary_fraud = 0           # salary anomalies (high or invalid)
    network_fraud = 0          # shared bank accounts

    flagged_count = 0
    estimated_loss = 0.0

    for _, row in df.iterrows():
        emp_id = row.get("id")
        if _is_missing(emp_id):
            # Skip rows with no id — they can't be updated in the DB anyway.
            logger.warning("Skipping row with missing id: %s", row.to_dict())
            continue
        emp_id = str(emp_id)

        score = 0.0
        red_flags: List[Dict[str, str]] = []

        # --- Attendance rules ---
        attendance_raw = row.get("attendance_rate")
        attendance_missing = _is_missing(attendance_raw)
        try:
            attendance = 0.0 if attendance_missing else float(attendance_raw)
        except (TypeError, ValueError):
            attendance = 0.0
            attendance_missing = True

        if attendance_missing or attendance == 0:
            score += SCORE_ZERO_ATTENDANCE
            red_flags.append(
                _flag(
                    "ATTENDANCE",
                    "HIGH",
                    "Zero attendance recorded",
                    "Rate: 0%",
                )
            )
        elif attendance >= 99:
            score += SCORE_PERFECT_ATTENDANCE
            red_flags.append(
                _flag(
                    "ATTENDANCE",
                    "HIGH",
                    "Perfect attendance suspicious",
                    f"Rate: {attendance}%",
                )
            )

        # --- Biometric rules ---
        biometric = row.get("biometric_id")
        if _is_missing(biometric):
            score += SCORE_MISSING_BIOMETRIC
            red_flags.append(
                _flag(
                    "BIOMETRIC",
                    "HIGH",
                    "No biometric record",
                    "Biometric ID missing",
                )
            )
            ghost_workers += 1
        else:
            bio_key = str(biometric).strip()
            shared_count = biometric_counts.get(bio_key, 0)
            if shared_count > 1:
                others = shared_count - 1
                score += SCORE_SHARED_BIOMETRIC
                red_flags.append(
                    _flag(
                        "BIOMETRIC",
                        "HIGH",
                        "Shared biometric identity",
                        f"Shared with {others} other employees",
                    )
                )
                duplicate_identities += 1

        # --- Bank account rule ---
        bank = row.get("bank_account")
        if not _is_missing(bank):
            bank_key = str(bank).strip()
            shared_count = bank_account_counts.get(bank_key, 0)
            if shared_count > 1:
                score += SCORE_SHARED_BANK_ACCOUNT
                red_flags.append(
                    _flag(
                        "NETWORK",
                        "HIGH",
                        "Shared bank account",
                        f"Account shared with {shared_count} employees",
                    )
                )
                network_fraud += 1

        # --- Salary rules ---
        salary_raw = row.get("salary")
        try:
            salary = 0.0 if _is_missing(salary_raw) else float(salary_raw)
        except (TypeError, ValueError):
            salary = 0.0

        salary_flagged = False
        if salary <= 0:
            score += SCORE_INVALID_SALARY
            red_flags.append(
                _flag(
                    "SALARY",
                    "HIGH",
                    "Invalid salary",
                    f"Salary: ₦{salary}",
                )
            )
            salary_flagged = True
        elif salary > SALARY_HIGH_THRESHOLD:
            score += SCORE_SALARY_ABOVE_THRESHOLD
            red_flags.append(
                _flag(
                    "SALARY",
                    "MEDIUM",
                    "Salary above threshold",
                    f"Salary: ₦{salary}",
                )
            )
            salary_flagged = True

        if salary_flagged:
            salary_fraud += 1

        # Cap at 100 to keep within the schema's bounds.
        score = min(score, 100.0)
        classification = _classify(score)

        if classification != "VERIFIED":
            flagged_count += 1
            estimated_loss += salary

        employees_result.append(
            {
                "id": emp_id,
                "fraud_score": score,
                "classification": classification,
                "red_flags": red_flags,
            }
        )

    # --- Persist per-employee updates ----------------------------------------
    for emp in employees_result:
        try:
            db.client.table("employees").update(
                {
                    "fraud_score": emp["fraud_score"],
                    "classification": emp["classification"],
                    "red_flags": emp["red_flags"],
                }
            ).eq("id", emp["id"]).execute()
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "Failed to update employee %s for upload %s: %s",
                emp["id"],
                upload_id,
                exc,
            )

    duration = time.time() - start_time

    fraud_breakdown = {
        "ghost_workers": ghost_workers,
        "duplicate_identities": duplicate_identities,
        "salary_fraud": salary_fraud,
        "network_fraud": network_fraud,
    }

    summary = {
        "total": len(employees_result),
        "flagged_count": flagged_count,
        "estimated_loss": estimated_loss,
        "analysis_duration_seconds": duration,
    }

    # --- Insert aggregate analysis_results row -------------------------------
    try:
        db.client.table("analysis_results").insert(
            {
                "upload_id": upload_id,
                "total_employees": len(employees_result),
                "flagged_count": flagged_count,
                "estimated_loss": estimated_loss,
                "fraud_breakdown": json.dumps(fraud_breakdown),
                "analysis_duration_seconds": duration,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "Failed to insert analysis_results for upload %s: %s", upload_id, exc
        )

    return {
        "employees": employees_result,
        "summary": summary,
        "fraud_breakdown": fraud_breakdown,
    }