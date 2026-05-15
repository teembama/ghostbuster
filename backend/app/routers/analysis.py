# Analysis router
# TODO: Implement endpoints that run ghost-employee analysis.
#   - POST /analysis/run: trigger analysis_service on uploaded data
#   - GET /analysis/results: fetch the latest analysis output

from fastapi import APIRouter

router = APIRouter(prefix="/analysis", tags=["analysis"])
