from typing import Optional

from fastapi import Header
from google.auth.transport import requests
from google.oauth2 import id_token

from app.core.config import get_settings
from app.core.errors import AppError


class AuthResult:
    def __init__(self, uid: str, email: Optional[str], display_name: Optional[str]):
        self.uid = uid
        self.email = email
        self.display_name = display_name


def _verify_google_id_token(token: str) -> AuthResult:
    settings = get_settings()
    if not settings.google_client_id:
        raise AppError(500, "GOOGLE_CLIENT_ID is not set")
    try:
        payload = id_token.verify_oauth2_token(
            token, requests.Request(), audience=settings.google_client_id
        )
    except Exception as exc:
        raise AppError(401, "Invalid ID token") from exc

    uid = payload.get("sub")
    if not uid:
        raise AppError(401, "Token missing sub")
    return AuthResult(uid=uid, email=payload.get("email"), display_name=payload.get("name"))


def authenticate(authorization: Optional[str] = Header(None)) -> AuthResult:
    settings = get_settings()
    if settings.dev_user_id:
        return AuthResult(uid=settings.dev_user_id, email=None, display_name=None)
    if not authorization:
        raise AppError(401, "Authorization header required")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppError(401, "Authorization must be Bearer token")

    token = parts[1]
    return _verify_google_id_token(token)
