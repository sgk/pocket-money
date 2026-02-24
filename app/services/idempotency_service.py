from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import json
from typing import Any, Literal

from fastapi.encoders import jsonable_encoder
from google.api_core.exceptions import AlreadyExists

from app.core import firestore
from app.core.errors import AppError


IDEMPOTENCY_KEY_MAX_LENGTH = 128
IDEMPOTENCY_TTL_DAYS = 14


@dataclass(frozen=True)
class IdempotencyDecision:
    mode: Literal["execute", "replay"]
    response_body: dict | None = None
    status_code: int = 200


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_idempotency_key(idempotency_key: str | None) -> str:
    key = (idempotency_key or "").strip()
    if not key:
        raise AppError(400, "X-Idempotency-Key header is required")
    if len(key) > IDEMPOTENCY_KEY_MAX_LENGTH:
        raise AppError(
            400, f"X-Idempotency-Key is too long (max {IDEMPOTENCY_KEY_MAX_LENGTH})"
        )
    return key


def _canonical_payload(payload: dict[str, Any]) -> str:
    encoded = jsonable_encoder(payload)
    return json.dumps(encoded, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _request_hash(payload: dict[str, Any]) -> str:
    canonical = _canonical_payload(payload)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _key_hash(method: str, path: str, idempotency_key: str) -> str:
    raw = f"{method.upper()}:{path}:{idempotency_key}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _is_expired(record: dict[str, Any], now: datetime) -> bool:
    expires_at = record.get("expiresAt")
    return isinstance(expires_at, datetime) and expires_at <= now


def _validate_record(
    record: dict[str, Any],
    method: str,
    path: str,
    idempotency_key: str,
    request_hash: str,
):
    if record.get("method") != method.upper():
        raise AppError(409, "Idempotency key conflict")
    if record.get("path") != path:
        raise AppError(409, "Idempotency key conflict")
    if record.get("key") != idempotency_key:
        raise AppError(409, "Idempotency key conflict")
    if record.get("requestHash") != request_hash:
        raise AppError(409, "Idempotency key payload mismatch")


def _handle_existing_record(
    record: dict[str, Any],
    method: str,
    path: str,
    idempotency_key: str,
    request_hash: str,
) -> IdempotencyDecision:
    _validate_record(record, method, path, idempotency_key, request_hash)

    status = record.get("status")
    if status == "succeeded":
        body = record.get("responseBody")
        if isinstance(body, dict):
            response_body = body
        else:
            response_body = {}
        raw_status_code = record.get("statusCode", 200)
        status_code = int(raw_status_code) if isinstance(raw_status_code, int) else 200
        return IdempotencyDecision(
            mode="replay", response_body=response_body, status_code=status_code
        )
    raise AppError(409, "同じ操作を処理中です。少し待ってから再試行してください。")


def begin_request(
    uid: str,
    method: str,
    path: str,
    idempotency_key: str | None,
    payload: dict[str, Any],
) -> IdempotencyDecision:
    key = _normalize_idempotency_key(idempotency_key)
    normalized_method = method.upper()
    hash_value = _request_hash(payload)
    doc_ref = firestore.idempotency_key_doc(uid, _key_hash(normalized_method, path, key))
    now = _now()

    snap = doc_ref.get()
    if snap.exists:
        data = snap.to_dict() or {}
        if _is_expired(data, now):
            doc_ref.delete()
        else:
            return _handle_existing_record(data, normalized_method, path, key, hash_value)

    record = {
        "key": key,
        "method": normalized_method,
        "path": path,
        "requestHash": hash_value,
        "status": "in_progress",
        "statusCode": None,
        "responseBody": None,
        "createdAt": now,
        "updatedAt": now,
        "expiresAt": now + timedelta(days=IDEMPOTENCY_TTL_DAYS),
    }
    try:
        doc_ref.create(record)
    except AlreadyExists:
        latest = doc_ref.get()
        if not latest.exists:
            raise AppError(409, "同じ操作を処理中です。少し待ってから再試行してください。")
        data = latest.to_dict() or {}
        if _is_expired(data, _now()):
            doc_ref.delete()
            return begin_request(uid, normalized_method, path, key, payload)
        return _handle_existing_record(data, normalized_method, path, key, hash_value)
    return IdempotencyDecision(mode="execute")


def complete_request(
    uid: str,
    method: str,
    path: str,
    idempotency_key: str | None,
    response_body: dict[str, Any],
    status_code: int = 200,
) -> None:
    key = _normalize_idempotency_key(idempotency_key)
    normalized_method = method.upper()
    doc_ref = firestore.idempotency_key_doc(uid, _key_hash(normalized_method, path, key))
    now = _now()
    doc_ref.set(
        {
            "status": "succeeded",
            "statusCode": status_code,
            "responseBody": jsonable_encoder(response_body),
            "updatedAt": now,
            "expiresAt": now + timedelta(days=IDEMPOTENCY_TTL_DAYS),
        },
        merge=True,
    )


def abort_request(
    uid: str,
    method: str,
    path: str,
    idempotency_key: str | None,
) -> None:
    key = _normalize_idempotency_key(idempotency_key)
    normalized_method = method.upper()
    doc_ref = firestore.idempotency_key_doc(uid, _key_hash(normalized_method, path, key))
    doc_ref.delete()
