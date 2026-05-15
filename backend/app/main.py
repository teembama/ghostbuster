"""GhostBuster API entrypoint.

Wires up routers, global exception handlers, request logging middleware,
CORS, and a database-aware health check.
"""

import logging
import time
import traceback
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.routers import analysis, employees, squad, upload
from app.services.database_service import db

# --- Logging setup --------------------------------------------------------
# Configure root logger once at import time so every module that does
# `logging.getLogger(__name__)` writes to the same handler with a consistent
# format. INFO by default; structured enough for ops without being noisy.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ghostbuster")

settings = get_settings()

app = FastAPI(
    title="GhostBuster API",
    description="AI-Powered Ghost Worker Detection System",
    version="1.0.0",
)

# --- CORS -----------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request logging middleware -------------------------------------------
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request as `METHOD /path → status (Xms)`."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
        except Exception:
            # Let the exception propagate so the global handler can format
            # the response, but log timing here so we don't lose it.
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "%s %s → 500 (%.1fms) [unhandled exception]", method, path, duration_ms
            )
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s → %s (%.1fms)", method, path, response.status_code, duration_ms
        )
        return response


app.add_middleware(RequestLoggingMiddleware)


# --- Exception handlers ---------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Normalize HTTPException responses to a stable shape."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions.

    Assigns a UUID error_id so support can correlate a user-visible failure
    with the corresponding traceback in the server logs.
    """
    error_id = str(uuid.uuid4())
    logger.error(
        "Unhandled exception [error_id=%s] on %s %s\n%s",
        error_id,
        request.method,
        request.url.path,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error_id": error_id},
    )


# --- Routers --------------------------------------------------------------
# All feature routers are mounted under /api. Individual routers already
# carry their own prefix (e.g. /upload, /analysis, /squad); employees.py
# carries no prefix because it serves both /employees and /employee.
app.include_router(upload.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(squad.router, prefix="/api")


# --- Root & health --------------------------------------------------------
@app.get("/")
async def root():
    return {
        "message": "GhostBuster API is running",
        "version": "1.0.0",
        "status": "healthy",
    }


@app.get("/api/health")
async def health_check():
    """Liveness + dependency check.

    Pings Supabase with a trivial SELECT. If that fails we return a 'degraded'
    payload (still HTTP 200 — useful for load balancers that want detail).
    """
    try:
        db.client.table("uploads").select("id").limit(1).execute()
        database_status = "connected"
    except Exception as exc:  # noqa: BLE001
        logger.exception("Health check: Supabase ping failed: %s", exc)
        return {"status": "degraded", "database": "error"}

    return {
        "status": "healthy",
        "database": database_status,
        "squad_mode": "mock" if settings.mock_squad else "live",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)