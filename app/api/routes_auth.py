from fastapi import APIRouter
from pydantic import BaseModel

from app.core.auth import create_session_token_from_google
from app.core.errors import AppError


router = APIRouter(prefix="/api", tags=["auth"])


class LoginRequest(BaseModel):
    credential: str


@router.post("/login")
def login(body: LoginRequest):
    credential = body.credential.strip()
    if not credential:
        raise AppError(400, "credential is required")
    token = create_session_token_from_google(credential)
    return {"token": token}
