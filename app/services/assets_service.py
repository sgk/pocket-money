from datetime import datetime, timezone
from typing import List

from google.cloud import firestore as fs

from app.core import firestore
from app.core.errors import AppError
from app.models.assets import AssetCreate, AssetUpdate


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _month_start(dt: datetime) -> datetime:
    dt = _to_utc(dt)
    return datetime(dt.year, dt.month, 1, tzinfo=timezone.utc)


def _merge_dirty_from(existing: datetime | None, candidate: datetime) -> datetime:
    candidate = _month_start(candidate)
    if not existing:
        return candidate
    existing = _to_utc(existing)
    return candidate if candidate < existing else existing


def _queue_balance_dirty(
    transaction: fs.Transaction,
    user_ref,
    existing_dirty: datetime | None,
    candidate: datetime | None,
):
    if candidate is None:
        return
    next_dirty = _merge_dirty_from(existing_dirty, candidate)
    if not existing_dirty or next_dirty != existing_dirty:
        transaction.set(user_ref, {"balanceDirtyFrom": next_dirty}, merge=True)


def _touch_transactions_updated_at(transaction: fs.Transaction, user_ref, now: datetime):
    transaction.set(user_ref, {"transactionsUpdatedAt": now}, merge=True)


def list_assets(uid: str) -> List[dict]:
    docs = firestore.assets_collection(uid).stream()
    items = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        items.append(data)
    return items


def create_asset(uid: str, payload: AssetCreate) -> dict:
    def _work(transaction: fs.Transaction):
        now = _now()
        doc_ref = firestore.assets_collection(uid).document()
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None

        data = {
            "name": payload.name,
            "type": payload.type,
            "currency": "JPY",
            "isActive": True,
            "initialBalance": payload.initialBalance,
            "currentBalance": payload.initialBalance,
            "note": payload.note,
            "sortOrder": payload.sortOrder,
            "createdAt": now,
            "updatedAt": now,
        }
        transaction.set(doc_ref, data)
        _queue_balance_dirty(transaction, user_ref, existing_dirty, _month_start(now))
        _touch_transactions_updated_at(transaction, user_ref, now)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def update_asset(uid: str, asset_id: str, payload: AssetUpdate) -> dict:
    def _work(transaction: fs.Transaction):
        doc_ref = firestore.asset_doc(uid, asset_id)
        snap = doc_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(404, "Asset not found")
        now = _now()
        updates = {k: v for k, v in payload.dict().items() if v is not None}
        data = snap.to_dict()

        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None

        if "initialBalance" in updates:
            old_initial = int(data.get("initialBalance", 0))
            old_current = int(data.get("currentBalance", 0))
            new_initial = int(updates["initialBalance"])
            updates["currentBalance"] = old_current + (new_initial - old_initial)
            created_at = data.get("createdAt")
            if isinstance(created_at, datetime):
                _queue_balance_dirty(
                    transaction, user_ref, existing_dirty, _month_start(created_at)
                )

        updates["updatedAt"] = now
        transaction.update(doc_ref, updates)
        _touch_transactions_updated_at(transaction, user_ref, now)

        data.update(updates)
        data["id"] = asset_id
        return data

    return firestore.run_in_transaction(_work)


def deactivate_asset(uid: str, asset_id: str) -> dict:
    def _work(transaction: fs.Transaction):
        doc_ref = firestore.asset_doc(uid, asset_id)
        snap = doc_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(404, "Asset not found")
        now = _now()
        user_ref = firestore.user_doc(uid)
        transaction.update(doc_ref, {"isActive": False, "updatedAt": now})
        _touch_transactions_updated_at(transaction, user_ref, now)
        data = snap.to_dict()
        data.update({"isActive": False, "updatedAt": now})
        data["id"] = asset_id
        return data

    return firestore.run_in_transaction(_work)
