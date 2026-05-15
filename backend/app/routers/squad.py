# Squad payments router
# TODO: Implement endpoints that proxy to the Squad sandbox API
# (account verification, payouts, etc.) via services.squad_service.

from fastapi import APIRouter

router = APIRouter(prefix="/squad", tags=["squad"])
