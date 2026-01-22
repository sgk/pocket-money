from fastapi import APIRouter

from app.core.config import get_settings


router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
def get_config():
    settings = get_settings()
    return {"googleClientId": settings.google_client_id}
