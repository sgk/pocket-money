import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core import firestore


class AppError(Exception):
    def __init__(self, status_code: int, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.details = details or {}


def _extract_request_context(request: Request) -> Dict[str, Any]:
    user = getattr(request.state, "user", None)
    body = getattr(request.state, "request_body", None)
    truncated = getattr(request.state, "request_body_truncated", False)
    return {
        "uid": getattr(user, "uid", None),
        "email": getattr(user, "email", None),
        "displayName": getattr(user, "display_name", None),
        "method": request.method,
        "path": request.url.path,
        "query": request.url.query,
        "userAgent": request.headers.get("user-agent"),
        "ip": request.client.host if request.client else None,
        "contentType": request.headers.get("content-type"),
        "body": body,
        "bodyTruncated": truncated,
    }


def _record_error(request: Request, payload: Dict[str, Any]) -> None:
    try:
        record = {
            "createdAt": datetime.now(timezone.utc),
            **_extract_request_context(request),
            **payload,
        }
        firestore.error_logs_collection().document().set(record)
    except Exception:
        logger.exception("Failed to record error log")


def json_error_handler(request: Request, exc: AppError) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error("AppError: %s", exc.message, extra={"details": exc.details})
    _record_error(
        request,
        {
            "kind": "app_error",
            "statusCode": exc.status_code,
            "message": exc.message,
            "details": exc.details,
        },
    )
    payload = {"error": {"message": exc.message}}
    if exc.details:
        payload["error"]["details"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=payload)


def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    _record_error(
        request,
        {
            "kind": "validation_error",
            "statusCode": 422,
            "message": "Validation error",
            "details": exc.errors(),
        },
    )
    return JSONResponse(
        status_code=422,
        content={"error": {"message": "Validation error", "details": exc.errors()}},
    )


def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error")
    _record_error(
        request,
        {
            "kind": "unhandled_error",
            "statusCode": 500,
            "message": "Internal server error",
            "details": {"exception": repr(exc)},
        },
    )
    return JSONResponse(
        status_code=500,
        content={"error": {"message": "Internal server error"}},
    )
logger = logging.getLogger(__name__)
