"""In-memory analysis state store.

Tracks per-upload status so the results endpoint can return 202 instantly
without hitting Supabase. State is per-process — survives nothing across
restarts, which is fine: after a restart the DB row presence in
`analysis_results` is the source of truth, and callers fall back to that.

Replace with Redis if we need multi-worker or cross-restart durability.
"""

from threading import Lock
from typing import Dict, Optional, Literal, TypedDict


Status = Literal["processing", "complete", "failed"]


class AnalysisState(TypedDict, total=False):
    status: Status
    error: str


# upload_id → state. Module-global; the lock guards concurrent writes from
# BackgroundTask workers running in FastAPI's threadpool.
_store: Dict[str, AnalysisState] = {}
_lock = Lock()


def set_processing(upload_id: str) -> None:
    with _lock:
        _store[upload_id] = {"status": "processing"}


def set_complete(upload_id: str) -> None:
    with _lock:
        _store[upload_id] = {"status": "complete"}


def set_failed(upload_id: str, error: str) -> None:
    with _lock:
        _store[upload_id] = {"status": "failed", "error": error}


def get(upload_id: str) -> Optional[AnalysisState]:
    with _lock:
        state = _store.get(upload_id)
        return dict(state) if state is not None else None
