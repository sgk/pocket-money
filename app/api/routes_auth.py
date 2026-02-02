from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import create_session_token_from_google
from app.core.errors import AppError
from app.api.deps import get_ready_user
from app.services import transactions_service


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

@router.delete("/auth/me", status_code=204)
def delete_account(user=Depends(get_ready_user)):
    transactions_service.delete_user_account(user.uid)
