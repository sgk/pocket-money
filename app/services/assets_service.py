from datetime import datetime, timezone
from typing import List

from app.core import firestore
from app.core.errors import AppError
from app.models.assets import AssetCreate, AssetUpdate


def _now() -> datetime:
    return datetime.now(timezone.utc)


def list_assets(uid: str) -> List[dict]:
    docs = firestore.assets_collection(uid).stream()
    items = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        items.append(data)
    return items


def create_asset(uid: str, payload: AssetCreate) -> dict:
    now = _now()
    doc_ref = firestore.assets_collection(uid).document()
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
    doc_ref.set(data)
    data["id"] = doc_ref.id
    return data


def update_asset(uid: str, asset_id: str, payload: AssetUpdate) -> dict:
    doc_ref = firestore.asset_doc(uid, asset_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(404, "Asset not found")
    now = _now()
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    data = snap.to_dict()
    if "initialBalance" in updates:
        old_initial = int(data.get("initialBalance", 0))
        old_current = int(data.get("currentBalance", 0))
        new_initial = int(updates["initialBalance"])
        updates["currentBalance"] = old_current + (new_initial - old_initial)
    updates["updatedAt"] = now
    doc_ref.update(updates)
    data.update(updates)
    data["id"] = asset_id
    return data


def deactivate_asset(uid: str, asset_id: str) -> dict:
    doc_ref = firestore.asset_doc(uid, asset_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(404, "Asset not found")
    now = _now()
    doc_ref.update({"isActive": False, "updatedAt": now})
    data = snap.to_dict()
    data.update({"isActive": False, "updatedAt": now})
    data["id"] = asset_id
    return data
