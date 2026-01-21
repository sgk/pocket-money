from datetime import datetime, timezone
from typing import List

from app.core import firestore
from app.core.errors import AppError
from app.models.categories import CategoryCreate, CategoryUpdate


def _now() -> datetime:
    return datetime.now(timezone.utc)


def list_categories(uid: str) -> List[dict]:
    docs = firestore.categories_collection(uid).stream()
    items = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        items.append(data)
    return items


def create_category(uid: str, payload: CategoryCreate) -> dict:
    now = _now()
    doc_ref = firestore.categories_collection(uid).document()
    data = {
        "name": payload.name,
        "isActive": True,
        "sortOrder": payload.sortOrder,
        "kind": payload.kind,
        "createdAt": now,
        "updatedAt": now,
    }
    doc_ref.set(data)
    data["id"] = doc_ref.id
    return data


def update_category(uid: str, category_id: str, payload: CategoryUpdate) -> dict:
    doc_ref = firestore.category_doc(uid, category_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(404, "Category not found")
    now = _now()
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    updates["updatedAt"] = now
    doc_ref.update(updates)
    data = snap.to_dict()
    data.update(updates)
    data["id"] = category_id
    return data


def deactivate_category(uid: str, category_id: str) -> dict:
    doc_ref = firestore.category_doc(uid, category_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(404, "Category not found")
    now = _now()
    doc_ref.update({"isActive": False, "updatedAt": now})
    data = snap.to_dict()
    data.update({"isActive": False, "updatedAt": now})
    data["id"] = category_id
    return data


def delete_category(uid: str, category_id: str) -> dict:
    doc_ref = firestore.category_doc(uid, category_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(404, "Category not found")
    data = snap.to_dict()
    doc_ref.delete()
    data["id"] = category_id
    return data
