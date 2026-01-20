from datetime import datetime, timezone
from typing import Dict, Optional

from google.cloud import firestore as fs

from app.core import firestore
from app.core.errors import AppError
from app.models.transactions import ExpenseCreate, IncomeCreate, TransferCreate, TransactionUpdate


FIELDS_BY_TYPE = {
    "expense": {"assetId", "categoryId", "merchant"},
    "income": {"assetId", "categoryId", "source"},
    "transfer": {"fromAssetId", "toAssetId", "fee", "feeCategoryId"},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _require(value, message: str):
    if value is None:
        raise AppError(400, message)


def _validate_common(tx: dict):
    if tx.get("occurredAt") is None:
        raise AppError(400, "occurredAt is required")
    amount = tx.get("amount")
    if amount is None or int(amount) < 1:
        raise AppError(400, "amount must be >= 1")
    fee = int(tx.get("fee", 0) or 0)
    if fee < 0:
        raise AppError(400, "fee must be >= 0")


def _validate_tx_payload(tx: dict):
    _validate_common(tx)
    tx_type = tx.get("type")
    if tx_type == "expense":
        _require(tx.get("assetId"), "assetId is required")
        _require(tx.get("categoryId"), "categoryId is required")
    elif tx_type == "income":
        _require(tx.get("assetId"), "assetId is required")
        _require(tx.get("categoryId"), "categoryId is required")
    elif tx_type == "transfer":
        _require(tx.get("fromAssetId"), "fromAssetId is required")
        _require(tx.get("toAssetId"), "toAssetId is required")
        if tx.get("fromAssetId") == tx.get("toAssetId"):
            raise AppError(400, "fromAssetId and toAssetId must be different")
    else:
        raise AppError(400, "Invalid transaction type")


def _get_asset(transaction: fs.Transaction, uid: str, asset_id: str) -> dict:
    ref = firestore.asset_doc(uid, asset_id)
    snap = ref.get(transaction=transaction)
    if not snap.exists:
        raise AppError(400, "Asset not found")
    data = snap.to_dict()
    if not data.get("isActive", True):
        raise AppError(400, "Asset is inactive")
    data["id"] = asset_id
    return data


def _get_category(transaction: fs.Transaction, uid: str, category_id: str) -> dict:
    ref = firestore.category_doc(uid, category_id)
    snap = ref.get(transaction=transaction)
    if not snap.exists:
        raise AppError(400, "Category not found")
    data = snap.to_dict()
    if not data.get("isActive", True):
        raise AppError(400, "Category is inactive")
    data["id"] = category_id
    return data


def tx_effect(tx: dict) -> Dict[str, int]:
    tx_type = tx.get("type")
    amount = int(tx.get("amount", 0))
    fee = int(tx.get("fee", 0) or 0)
    if tx_type == "expense":
        return {tx["assetId"]: -amount}
    if tx_type == "income":
        return {tx["assetId"]: amount}
    if tx_type == "transfer":
        return {tx["fromAssetId"]: -(amount + fee), tx["toAssetId"]: amount}
    raise AppError(400, "Invalid transaction type")


def compute_balance_deltas(old_tx: Optional[dict], new_tx: Optional[dict]) -> Dict[str, int]:
    old_effect = tx_effect(old_tx) if old_tx else {}
    new_effect = tx_effect(new_tx) if new_tx else {}
    deltas: Dict[str, int] = {}
    for asset_id in set(old_effect.keys()) | set(new_effect.keys()):
        deltas[asset_id] = new_effect.get(asset_id, 0) - old_effect.get(asset_id, 0)
    return deltas


def _apply_balance_deltas(
    transaction: fs.Transaction, uid: str, deltas: Dict[str, int], now: datetime
):
    for asset_id, delta in deltas.items():
        if delta == 0:
            continue
        asset_ref = firestore.asset_doc(uid, asset_id)
        snap = asset_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(400, "Asset not found")
        data = snap.to_dict()
        if not data.get("isActive", True):
            raise AppError(400, "Asset is inactive")
        current = int(data.get("currentBalance", 0))
        new_balance = current + delta
        transaction.update(
            asset_ref,
            {"currentBalance": new_balance, "updatedAt": now},
        )


def _validate_refs_for_tx(transaction: fs.Transaction, uid: str, tx: dict):
    tx_type = tx.get("type")
    if tx_type in {"expense", "income"}:
        _get_asset(transaction, uid, tx["assetId"])
        _get_category(transaction, uid, tx["categoryId"])
    elif tx_type == "transfer":
        _get_asset(transaction, uid, tx["fromAssetId"])
        _get_asset(transaction, uid, tx["toAssetId"])
        fee_category = tx.get("feeCategoryId")
        if fee_category:
            _get_category(transaction, uid, fee_category)


def create_expense(uid: str, payload: ExpenseCreate) -> dict:
    def _work(transaction: fs.Transaction):
        now = _now()
        data = payload.dict()
        data["type"] = "expense"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        _validate_refs_for_tx(transaction, uid, data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, uid, deltas, now)
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def create_income(uid: str, payload: IncomeCreate) -> dict:
    def _work(transaction: fs.Transaction):
        now = _now()
        data = payload.dict()
        data["type"] = "income"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        _validate_refs_for_tx(transaction, uid, data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, uid, deltas, now)
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def create_transfer(uid: str, payload: TransferCreate) -> dict:
    def _work(transaction: fs.Transaction):
        now = _now()
        data = payload.dict()
        data["type"] = "transfer"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        _validate_refs_for_tx(transaction, uid, data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, uid, deltas, now)
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def update_transaction(uid: str, tx_id: str, payload: TransactionUpdate) -> dict:
    patch = payload.dict(exclude_unset=True)

    def _work(transaction: fs.Transaction):
        now = _now()
        tx_ref = firestore.transaction_doc(uid, tx_id)
        snap = tx_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(404, "Transaction not found")
        old_tx = snap.to_dict()

        new_tx = dict(old_tx)
        for key, value in patch.items():
            if value is None:
                new_tx.pop(key, None)
            else:
                new_tx[key] = value

        if "type" not in new_tx:
            raise AppError(400, "type is required")

        new_tx["updatedAt"] = now
        _validate_tx_payload(new_tx)
        _validate_refs_for_tx(transaction, uid, new_tx)

        deltas = compute_balance_deltas(old_tx, new_tx)
        _apply_balance_deltas(transaction, uid, deltas, now)

        updates = {}
        for key, value in patch.items():
            if value is None:
                updates[key] = fs.DELETE_FIELD
            else:
                updates[key] = value
        updates["updatedAt"] = now

        old_type = old_tx.get("type")
        new_type = new_tx.get("type")
        if old_type and new_type and old_type != new_type:
            for field in FIELDS_BY_TYPE.get(old_type, set()):
                if field not in FIELDS_BY_TYPE.get(new_type, set()):
                    updates[field] = fs.DELETE_FIELD
                    new_tx.pop(field, None)

        transaction.update(tx_ref, updates)
        new_tx["id"] = tx_id
        return new_tx

    return firestore.run_in_transaction(_work)


def delete_transaction(uid: str, tx_id: str) -> dict:
    def _work(transaction: fs.Transaction):
        now = _now()
        tx_ref = firestore.transaction_doc(uid, tx_id)
        snap = tx_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(404, "Transaction not found")
        old_tx = snap.to_dict()
        deltas = compute_balance_deltas(old_tx, None)
        _apply_balance_deltas(transaction, uid, deltas, now)
        transaction.delete(tx_ref)
        old_tx["id"] = tx_id
        return old_tx

    return firestore.run_in_transaction(_work)


def list_transactions(
    uid: str,
    from_dt: Optional[datetime],
    to_dt: Optional[datetime],
    tx_type: Optional[str],
    asset_id: Optional[str],
    category_id: Optional[str],
    limit: int,
    cursor: Optional[str],
) -> dict:
    query = firestore.transactions_collection(uid).order_by(
        "occurredAt", direction=fs.Query.DESCENDING
    )
    if from_dt:
        query = query.where("occurredAt", ">=", from_dt)
    if to_dt:
        query = query.where("occurredAt", "<=", to_dt)
    if tx_type:
        query = query.where("type", "==", tx_type)
    if cursor:
        cursor_snap = firestore.transaction_doc(uid, cursor).get()
        if not cursor_snap.exists:
            raise AppError(400, "Invalid cursor")
        query = query.start_after(cursor_snap)

    query = query.limit(limit)

    items = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        items.append(data)

    if asset_id or category_id:
        filtered = []
        for item in items:
            if asset_id:
                if item.get("type") == "transfer":
                    if asset_id not in {item.get("fromAssetId"), item.get("toAssetId")}:
                        continue
                else:
                    if item.get("assetId") != asset_id:
                        continue
            if category_id and item.get("categoryId") != category_id:
                continue
            filtered.append(item)
        items = filtered

    next_cursor = items[-1]["id"] if items else None
    return {"items": items, "nextCursor": next_cursor}
