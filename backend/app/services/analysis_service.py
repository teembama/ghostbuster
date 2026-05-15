"""Fraud detection orchestration for GhostBuster.

Person 2 owns the upload/DB plumbing here; the actual fraud scoring is
delegated to Person 3's `FraudDetector`. This module:

  1. Receives a payroll DataFrame keyed by `upload_id`.
  2. Hands the rows to `FraudDetector.analyze` for scoring + breakdown.
  3. Persists per-employee scores/flags back to Supabase.
  4. Inserts an aggregate row into `analysis_results`.
"""

import json
import logging
import time
from typing import Any, Dict

import pandas as pd

from app.services.database_service import db
from app.services.fraud_detector import FraudDetector

logger = logging.getLogger(__name__)


class AnalysisService:
    """Glues Person 3's fraud detector to Person 2's DB writes."""

    def __init__(self) -> None:
        self.detector = FraudDetector()

    def analyze_payroll(self, df: pd.DataFrame) -> Dict[str, Any]:
        start_time = time.time()

        if df.empty:
            raise ValueError("Cannot analyze an empty DataFrame")
        if "upload_id" not in df.columns:
            raise ValueError("DataFrame is missing required 'upload_id' column")

        upload_id = df["upload_id"].iloc[0]

        employees = df.to_dict(orient="records")
        results = self.detector.analyze([dict(e) for e in employees])

        scored_employees = results.get("employees", [])
        for emp in scored_employees:
            emp_id = emp.get("id")
            if emp_id is None or (isinstance(emp_id, float) and pd.isna(emp_id)):
                continue

            red_flags = emp.get("red_flags")
            if red_flags is None or (isinstance(red_flags, float) and pd.isna(red_flags)):
                red_flags = []

            try:
                db.client.table("employees").update(
                    {
                        "fraud_score": float(emp.get("fraud_score") or 0),
                        "classification": emp.get("classification") or "VERIFIED",
                        "red_flags": red_flags,
                    }
                ).eq("id", str(emp_id)).execute()
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Failed to update employee %s for upload %s: %s",
                    emp_id,
                    upload_id,
                    exc,
                )

        duration = time.time() - start_time
        fraud_breakdown = results.get("fraud_breakdown", {})
        flagged_count = int(results.get("flagged_count", 0))
        estimated_loss = float(results.get("estimated_loss", 0) or 0)

        try:
            db.client.table("analysis_results").insert(
                {
                    "upload_id": upload_id,
                    "total_employees": len(scored_employees),
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

        summary = {
            "total": len(scored_employees),
            "flagged_count": flagged_count,
            "estimated_loss": estimated_loss,
            "analysis_duration_seconds": duration,
        }

        return {
            "employees": scored_employees,
            "summary": summary,
            "fraud_breakdown": fraud_breakdown,
        }


_service = AnalysisService()


def analyze_payroll(df: pd.DataFrame) -> Dict[str, Any]:
    """Module-level entry point preserved for existing callers (upload.py)."""
    return _service.analyze_payroll(df)
