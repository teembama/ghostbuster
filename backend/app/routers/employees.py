# Employees router
# TODO: Implement CRUD/listing endpoints for employees.
#   - GET /employees: list employees with optional filters (flagged, dept, etc.)
#   - GET /employees/{id}: detail view including risk score and flags

from fastapi import APIRouter

router = APIRouter(prefix="/employees", tags=["employees"])
