# Upload router
# TODO: Implement endpoints for uploading payroll CSV files.
#   - POST /upload: accept multipart CSV, parse via utils.csv_parser,
#     persist employees via services.database_service.

from fastapi import APIRouter

router = APIRouter(prefix="/upload", tags=["upload"])
