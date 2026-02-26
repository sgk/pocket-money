from datetime import datetime, timezone
from email.utils import format_datetime, parsedate_to_datetime
from typing import Optional, List, Callable

from fastapi import APIRouter, Depends, Header, Query, Response

from app.api.deps import get_current_user, get_export_user, get_ready_user
from app.core.errors import AppError
from app.models.transactions import (
    ExpenseCreate,
    IncomeCreate,
    TransferCreate,
    TransactionOut,
    TransactionUpdate,
)
from app.services import transactions_service, idempotency_service


router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise AppError(400, "Invalid datetime format") from exc
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _http_date(dt: datetime) -> str:
    normalized = _to_utc(dt).replace(microsecond=0)
    return format_datetime(normalized, usegmt=True)


def _parse_if_modified_since(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError) as exc:
        raise AppError(400, "Invalid If-Modified-Since") from exc
    return _to_utc(parsed).replace(microsecond=0)


def _is_not_modified(last_modified: datetime, if_modified_since: Optional[datetime]) -> bool:
    if not if_modified_since:
        return False
    # If-Modified-Since は秒精度のため、同一秒は更新ありとして 200 を返す
    return _to_utc(last_modified).replace(microsecond=0) < if_modified_since


def _run_idempotent_write(
    uid: str,
    method: str,
    path: str,
    idempotency_key: Optional[str],
    payload: dict,
    handler: Callable[[], dict],
) -> dict:
    decision = idempotency_service.begin_request(
        uid, method, path, idempotency_key, payload
    )
    if decision.mode == "replay":
        return decision.response_body or {}

    try:
        result = handler()
    except ValueError as exc:
        # Firestore のトランザクション競合がリトライ上限で失敗した場合は 409 を返す。
        if "Failed to commit transaction in" in str(exc):
            try:
                idempotency_service.abort_request(uid, method, path, idempotency_key)
            except Exception:
                pass
            raise AppError(409, "同時更新が競合しました。少し待ってから再試行してください。") from exc
        try:
            idempotency_service.abort_request(uid, method, path, idempotency_key)
        except Exception:
            pass
        raise
    except Exception:
        try:
            idempotency_service.abort_request(uid, method, path, idempotency_key)
        except Exception:
            pass
        raise

    idempotency_service.complete_request(
        uid, method, path, idempotency_key, result, status_code=200
    )
    return result


@router.get("", response_model=dict)
def list_transactions(
    response: Response,
    user=Depends(get_ready_user),
    from_dt: Optional[str] = Query(None, alias="from"),
    to_dt: Optional[str] = Query(None, alias="to"),
    tx_type: Optional[str] = Query(None, alias="type"),
    asset_id: Optional[str] = Query(None, alias="assetId"),
    category_id: Optional[str] = Query(None, alias="categoryId"),
    limit: int = Query(50, ge=1, le=1000),
    cursor: Optional[str] = None,
    include_opening_balances: bool = Query(False, alias="includeOpeningBalances"),
    if_modified_since: Optional[str] = Header(None, alias="If-Modified-Since"),
):
    last_modified = transactions_service.get_transactions_last_modified(user.uid)
    last_modified_http = _http_date(last_modified)
    response.headers["Last-Modified"] = last_modified_http
    response.headers["Vary"] = "X-Child-Id"

    ims_dt = _parse_if_modified_since(if_modified_since)
    if _is_not_modified(last_modified, ims_dt):
        return Response(
            status_code=304,
            headers={"Last-Modified": last_modified_http, "Vary": "X-Child-Id"},
        )

    return transactions_service.list_transactions(
        user.uid,
        _parse_dt(from_dt),
        _parse_dt(to_dt),
        tx_type,
        asset_id,
        category_id,
        limit,
        cursor,
        include_opening_balances,
    )


@router.post("/expense", response_model=TransactionOut)
def create_expense(
    payload: ExpenseCreate,
    user=Depends(get_ready_user),
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    path = "/api/transactions/expense"
    body = payload.dict()
    return _run_idempotent_write(
        user.uid,
        "POST",
        path,
        idempotency_key,
        body,
        lambda: transactions_service.create_expense(user.uid, payload),
    )


@router.post("/income", response_model=TransactionOut)
def create_income(
    payload: IncomeCreate,
    user=Depends(get_ready_user),
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    path = "/api/transactions/income"
    body = payload.dict()
    return _run_idempotent_write(
        user.uid,
        "POST",
        path,
        idempotency_key,
        body,
        lambda: transactions_service.create_income(user.uid, payload),
    )


@router.post("/transfer", response_model=TransactionOut)
def create_transfer(
    payload: TransferCreate,
    user=Depends(get_ready_user),
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    path = "/api/transactions/transfer"
    body = payload.dict()
    return _run_idempotent_write(
        user.uid,
        "POST",
        path,
        idempotency_key,
        body,
        lambda: transactions_service.create_transfer(user.uid, payload),
    )


@router.get("/export", response_model=List[dict])
def export_transactions_route(response: Response, user=Depends(get_export_user)):
    response.headers["Vary"] = "X-Child-Id"
    return transactions_service.export_transactions(user.uid)


@router.post("/import", status_code=204)
def import_transactions_route(body: List[dict], user=Depends(get_ready_user)):
    transactions_service.import_transactions(user.uid, body)


@router.delete("/all", status_code=204)
def delete_all_transactions_route(user=Depends(get_ready_user)):
    transactions_service.delete_all_transactions(user.uid)


@router.patch("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: str,
    payload: TransactionUpdate,
    user=Depends(get_ready_user),
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    path = f"/api/transactions/{tx_id}"
    body = payload.dict(exclude_unset=True)
    return _run_idempotent_write(
        user.uid,
        "PATCH",
        path,
        idempotency_key,
        body,
        lambda: transactions_service.update_transaction(user.uid, tx_id, payload),
    )


@router.delete("/{tx_id}", response_model=TransactionOut)
def delete_transaction(
    tx_id: str,
    user=Depends(get_ready_user),
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    path = f"/api/transactions/{tx_id}"
    return _run_idempotent_write(
        user.uid,
        "DELETE",
        path,
        idempotency_key,
        {},
        lambda: transactions_service.delete_transaction(user.uid, tx_id),
    )
