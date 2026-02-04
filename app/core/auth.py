import base64
import hashlib
import hmac
import json
import time
from typing import Optional

from fastapi import Header
from google.auth.transport import requests
from google.oauth2 import id_token

from app.core.config import get_settings
from app.core.errors import AppError


class AuthResult:
    def __init__(
        self,
        uid: str,
        email: Optional[str],
        display_name: Optional[str],
        photo_url: Optional[str],
    ):
        self.uid = uid
        self.email = email
        self.display_name = display_name
        self.photo_url = photo_url


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
    return AuthResult(
        uid=uid,
        email=payload.get("email"),
        display_name=payload.get("name"),
        photo_url=payload.get("picture"),
    )


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_session_token(result: AuthResult) -> str:
    settings = get_settings()
    if not settings.session_secret:
        raise AppError(500, "SESSION_SECRET is not set")
    now = int(time.time())
    payload = {
        "uid": result.uid,
        "email": result.email,
        "display_name": result.display_name,
        "photo_url": result.photo_url,
        "iat": now,
        "exp": now + settings.session_expire_days * 24 * 60 * 60,
    }
    payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )
    payload_b64 = _b64encode(payload_json)
    signature = hmac.new(
        settings.session_secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    signature_b64 = _b64encode(signature)
    return f"{payload_b64}.{signature_b64}"


def create_session_token_from_google(token: str) -> str:
    return create_session_token(_verify_google_id_token(token))


def _verify_session_token(token: str) -> AuthResult:
    settings = get_settings()
    if not settings.session_secret:
        raise AppError(500, "SESSION_SECRET is not set")
    parts = token.split(".")
    if len(parts) != 2:
        raise AppError(401, "Invalid session token")
    payload_b64, signature_b64 = parts
    try:
        signature = _b64decode(signature_b64)
    except Exception as exc:
        raise AppError(401, "Invalid session token") from exc
    expected_signature = hmac.new(
        settings.session_secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(signature, expected_signature):
        raise AppError(401, "Invalid session token")
    try:
        payload = json.loads(_b64decode(payload_b64))
    except Exception as exc:
        raise AppError(401, "Invalid session token") from exc
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)):
        raise AppError(401, "Invalid session token")
    if int(time.time()) >= int(exp):
        raise AppError(401, "Session expired")
    uid = payload.get("uid")
    if not uid:
        raise AppError(401, "Invalid session token")
    return AuthResult(
        uid=uid,
        email=payload.get("email"),
        display_name=payload.get("display_name"),
        photo_url=payload.get("photo_url"),
    )


def authenticate(authorization: Optional[str] = Header(None)) -> AuthResult:
    settings = get_settings()
    if settings.dev_user_id:
        return AuthResult(
            uid=settings.dev_user_id,
            email="dev@example.com",
            display_name="Dev User",
            photo_url=None,
        )
    if not authorization:
        raise AppError(401, "Authorization header required")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppError(401, "Authorization must be Bearer token")

    token = parts[1]
    return _verify_session_token(token)
