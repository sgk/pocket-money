from datetime import datetime, timezone
from typing import Dict, Optional, List

from google.cloud import firestore as fs
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core import firestore
from app.core.errors import AppError
from app.models.transactions import ExpenseCreate, IncomeCreate, TransferCreate, TransactionUpdate


FIELDS_BY_TYPE = {
    "expense": {"assetId", "categoryName", "merchant"},
    "income": {"assetId", "categoryName", "source"},
    "transfer": {"fromAssetId", "toAssetId", "fee", "feeCategoryId", "counterparty"},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _month_start(dt: datetime) -> datetime:
    dt = _to_utc(dt)
    return datetime(dt.year, dt.month, 1, tzinfo=timezone.utc)


def _month_key(dt: datetime) -> str:
    dt = _to_utc(dt)
    return dt.strftime("%Y-%m-01")


def _next_month(dt: datetime) -> datetime:
    dt = _to_utc(dt)
    if dt.month == 12:
        return datetime(dt.year + 1, 1, 1, tzinfo=timezone.utc)
    return datetime(dt.year, dt.month + 1, 1, tzinfo=timezone.utc)


def _prev_month(dt: datetime) -> datetime:
    dt = _to_utc(dt)
    if dt.month == 1:
        return datetime(dt.year - 1, 12, 1, tzinfo=timezone.utc)
    return datetime(dt.year, dt.month - 1, 1, tzinfo=timezone.utc)


def _default_day_order(now: datetime) -> int:
    return int(now.timestamp() * 1000)


def _merge_dirty_from(existing: Optional[datetime], candidate: datetime) -> datetime:
    candidate = _month_start(candidate)
    if not existing:
        return candidate
    existing = _to_utc(existing)
    return candidate if candidate < existing else existing


def _queue_balance_dirty(
    transaction: fs.Transaction,
    user_ref,
    existing_dirty: Optional[datetime],
    candidate: Optional[datetime],
):
    if candidate is None:
        return
    next_dirty = _merge_dirty_from(existing_dirty, candidate)
    if not existing_dirty or next_dirty != existing_dirty:
        transaction.set(user_ref, {"balanceDirtyFrom": next_dirty}, merge=True)


def _seed_balances(uid: str, as_of: datetime) -> Dict[str, int]:
    balances: Dict[str, int] = {}
    for doc in firestore.assets_collection(uid).stream():
        data = doc.to_dict()
        created_at = data.get("createdAt")
        include = True
        if created_at:
            include = _to_utc(created_at) <= as_of
        balances[doc.id] = int(data.get("initialBalance", 0)) if include else 0
    return balances


def _apply_tx_effect(balances: Dict[str, int], tx: dict):
    effect = tx_effect(tx)
    for asset_id, delta in effect.items():
        balances[asset_id] = balances.get(asset_id, 0) + int(delta)


def _compute_balances_until(uid: str, end_dt: datetime) -> Dict[str, int]:
    end_dt = _to_utc(end_dt)
    balances = _seed_balances(uid, end_dt)
    query = (
        firestore.transactions_collection(uid)
        .where(filter=FieldFilter("occurredAt", "<", end_dt))
        .order_by("occurredAt")
    )
    for doc in query.stream():
        _apply_tx_effect(balances, doc.to_dict())
    return balances


def _apply_transactions_between(
    uid: str, start_dt: datetime, end_dt: datetime, balances: Dict[str, int]
) -> Dict[str, int]:
    start_dt = _to_utc(start_dt)
    end_dt = _to_utc(end_dt)
    query = (
        firestore.transactions_collection(uid)
        .where(filter=FieldFilter("occurredAt", ">=", start_dt))
        .where(filter=FieldFilter("occurredAt", "<", end_dt))
        .order_by("occurredAt")
    )
    for doc in query.stream():
        _apply_tx_effect(balances, doc.to_dict())
    return balances


def _get_snapshot(uid: str, month_start: datetime) -> Optional[dict]:
    ref = firestore.balance_snapshot_doc(uid, _month_key(month_start))
    snap = ref.get()
    if not snap.exists:
        return None
    data = snap.to_dict()
    data["id"] = snap.id
    return data


def _save_snapshot(uid: str, month_start: datetime, balances: Dict[str, int]):
    ref = firestore.balance_snapshot_doc(uid, _month_key(month_start))
    total = sum(balances.values())
    ref.set(
        {
            "monthStart": month_start,
            "byAsset": balances,
            "total": total,
            "updatedAt": _now(),
        }
    )


def _ensure_snapshots(uid: str, target_month: datetime):
    target_month = _month_start(target_month)
    user_ref = firestore.user_doc(uid)
    user_snap = user_ref.get()
    dirty_from = None
    if user_snap.exists:
        dirty_from = user_snap.to_dict().get("balanceDirtyFrom")
    if dirty_from:
        dirty_from = _month_start(_to_utc(dirty_from))

    snapshot = _get_snapshot(uid, target_month)
    start_month = None
    if dirty_from and dirty_from <= target_month:
        start_month = dirty_from
    elif not snapshot:
        start_month = target_month

    if not start_month:
        return

    prev_snapshot = _get_snapshot(uid, _prev_month(start_month))
    if prev_snapshot:
        balances = {k: int(v) for k, v in prev_snapshot.get("byAsset", {}).items()}
    else:
        balances = _compute_balances_until(uid, start_month)

    month = start_month
    while month <= target_month:
        month_end = _next_month(month)
        balances = _apply_transactions_between(uid, month, month_end, balances)
        _save_snapshot(uid, month, balances)
        month = month_end

    if dirty_from and dirty_from <= target_month:
        user_ref.update({"balanceDirtyFrom": fs.DELETE_FIELD})


def _require(value, message: str):
    if value is None:
        raise AppError(400, message)


def _validate_common(tx: dict):
    if tx.get("occurredAt") is None:
        raise AppError(400, "occurredAt is required")
    amount = tx.get("amount")
    if amount is None:
        raise AppError(400, "amount is required")
    fee = int(tx.get("fee", 0) or 0)
    if fee < 0:
        raise AppError(400, "fee must be >= 0")


def _validate_tx_payload(tx: dict):
    _validate_common(tx)
    tx_type = tx.get("type")
    if tx_type == "expense":
        _require(tx.get("assetId"), "assetId is required")
        if not tx.get("categoryName"):
            raise AppError(400, "categoryName is required")
    elif tx_type == "income":
        _require(tx.get("assetId"), "assetId is required")
        if not tx.get("categoryName"):
            raise AppError(400, "categoryName is required")
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
    asset_ids = [asset_id for asset_id, delta in deltas.items() if delta != 0]
    if not asset_ids:
        return
    asset_refs = {asset_id: firestore.asset_doc(uid, asset_id) for asset_id in asset_ids}
    snaps = list(transaction.get_all(asset_refs.values()))
    data_by_id = {}
    for snap in snaps:
        if not snap.exists:
            raise AppError(400, "Asset not found")
        data = snap.to_dict()
        if not data.get("isActive", True):
            raise AppError(400, "Asset is inactive")
        data_by_id[snap.id] = data

    for asset_id, delta in deltas.items():
        if delta == 0:
            continue
        data = data_by_id.get(asset_id)
        if not data:
            raise AppError(400, "Asset not found")
        current = int(data.get("currentBalance", 0))
        new_balance = current + delta
        transaction.update(
            asset_refs[asset_id],
            {"currentBalance": new_balance, "updatedAt": now},
        )


def _validate_refs_for_tx(transaction: fs.Transaction, uid: str, tx: dict):
    tx_type = tx.get("type")
    if tx_type in {"expense", "income"}:
        _get_asset(transaction, uid, tx["assetId"])
    elif tx_type == "transfer":
        _get_asset(transaction, uid, tx["fromAssetId"])
        _get_asset(transaction, uid, tx["toAssetId"])
        fee_category = tx.get("feeCategoryId")
        if fee_category:
            _get_category(transaction, uid, fee_category)


def create_expense(uid: str, payload: ExpenseCreate) -> dict:
    def _work(transaction: fs.Transaction):
        now = _now()
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None
        data = payload.dict()
        if data.get("dayOrder") is None:
            data["dayOrder"] = _default_day_order(now)
        data["type"] = "expense"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        _validate_refs_for_tx(transaction, uid, data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, uid, deltas, now)
        _queue_balance_dirty(
            transaction, user_ref, existing_dirty, _month_start(data["occurredAt"])
        )
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def create_income(uid: str, payload: IncomeCreate) -> dict:
    def _work(transaction: fs.Transaction):
        now = _now()
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None
        data = payload.dict()
        if data.get("dayOrder") is None:
            data["dayOrder"] = _default_day_order(now)
        data["type"] = "income"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        _validate_refs_for_tx(transaction, uid, data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, uid, deltas, now)
        _queue_balance_dirty(
            transaction, user_ref, existing_dirty, _month_start(data["occurredAt"])
        )
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def create_transfer(uid: str, payload: TransferCreate) -> dict:
    def _work(transaction: fs.Transaction):
        now = _now()
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None
        data = payload.dict()
        if data.get("dayOrder") is None:
            data["dayOrder"] = _default_day_order(now)
        data["type"] = "transfer"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        _validate_refs_for_tx(transaction, uid, data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, uid, deltas, now)
        _queue_balance_dirty(
            transaction, user_ref, existing_dirty, _month_start(data["occurredAt"])
        )
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def update_transaction(uid: str, tx_id: str, payload: TransactionUpdate) -> dict:
    patch = payload.dict(exclude_unset=True)
    balance_fields = {
        "occurredAt",
        "amount",
        "type",
        "assetId",
        "fromAssetId",
        "toAssetId",
        "fee",
    }

    def _work(transaction: fs.Transaction):
        now = _now()
        tx_ref = firestore.transaction_doc(uid, tx_id)
        snap = tx_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(404, "Transaction not found")
        old_tx = snap.to_dict()
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None

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

        if any(field in patch for field in balance_fields):
            old_month = _month_start(_to_utc(old_tx["occurredAt"]))
            new_month = _month_start(_to_utc(new_tx["occurredAt"]))
            dirty_from = old_month if old_month <= new_month else new_month
            _queue_balance_dirty(transaction, user_ref, existing_dirty, dirty_from)

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
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None
        deltas = compute_balance_deltas(old_tx, None)
        _apply_balance_deltas(transaction, uid, deltas, now)
        _queue_balance_dirty(
            transaction, user_ref, existing_dirty, _month_start(old_tx["occurredAt"])
        )
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
    category_name: Optional[str],
    limit: int,
    cursor: Optional[str],
    include_opening_balances: bool,
) -> dict:
    query = firestore.transactions_collection(uid).order_by(
        "occurredAt", direction=fs.Query.DESCENDING
    )
    if from_dt:
        query = query.where(filter=FieldFilter("occurredAt", ">=", from_dt))
    if to_dt:
        query = query.where(filter=FieldFilter("occurredAt", "<=", to_dt))
    if tx_type:
        query = query.where(filter=FieldFilter("type", "==", tx_type))
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
        if "categoryName" not in data and data.get("categoryId"):
            cat_id = data.get("categoryId")
            cat_snap = firestore.category_doc(uid, cat_id).get()
            if cat_snap.exists:
                cat_data = cat_snap.to_dict()
                cat_name = cat_data.get("name")
                if cat_name:
                    data["categoryName"] = cat_name
                    doc.reference.update(
                        {
                            "categoryName": cat_name,
                            "categoryId": fs.DELETE_FIELD,
                            "updatedAt": _now(),
                        }
                    )
                    data.pop("categoryId", None)
        items.append(data)

    if asset_id or category_name:
        filtered = []
        for item in items:
            if asset_id:
                if item.get("type") == "transfer":
                    if asset_id not in {item.get("fromAssetId"), item.get("toAssetId")}:
                        continue
                else:
                    if item.get("assetId") != asset_id:
                        continue
            if category_name and item.get("categoryName") != category_name:
                continue
            filtered.append(item)
        items = filtered

    next_cursor = items[-1]["id"] if items else None
    result = {"items": items, "nextCursor": next_cursor}

    if include_opening_balances and from_dt:
        from_dt = _to_utc(from_dt)
        month_start = _month_start(from_dt)
        _ensure_snapshots(uid, month_start)
        snapshot = _get_snapshot(uid, month_start)
        balances = (
            {k: int(v) for k, v in snapshot.get("byAsset", {}).items()}
            if snapshot
            else _compute_balances_until(uid, month_start)
        )
        if from_dt > month_start:
            balances = _apply_transactions_between(uid, month_start, from_dt, balances)
        result["openingBalances"] = balances

    return result
