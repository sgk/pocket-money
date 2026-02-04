from datetime import datetime, timezone
from typing import Dict, Optional, List

from google.cloud import firestore as fs
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core import firestore
from app.core.errors import AppError
from app.models.transactions import ExpenseCreate, IncomeCreate, TransferCreate, TransactionUpdate


FIELDS_BY_TYPE = {
    "expense": {"assetId", "assetName", "categoryId", "categoryName", "merchant"},
    "income": {"assetId", "assetName", "categoryId", "categoryName", "source"},
    "transfer": {
        "fromAssetId",
        "fromAssetName",
        "toAssetId",
        "toAssetName",
        "fee",
        "feeCategoryId",
        "feeCategoryName",
        "counterparty",
    },
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


def _touch_transactions_updated_at(
    transaction: fs.Transaction, user_ref, now: datetime
):
    transaction.set(user_ref, {"transactionsUpdatedAt": now}, merge=True)


def _build_asset_name_index(uid: str) -> Dict[str, fs.DocumentReference]:
    refs: Dict[str, fs.DocumentReference] = {}
    for doc in firestore.assets_collection(uid).stream():
        data = doc.to_dict()
        name = data.get("name")
        if not name:
            continue
        if name not in refs:
            refs[name] = doc.reference
    return refs


def _build_asset_name_by_id(uid: str) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for doc in firestore.assets_collection(uid).stream():
        data = doc.to_dict()
        name = data.get("name")
        if not name:
            continue
        mapping[doc.id] = name
    return mapping


def _build_category_name_by_id(uid: str) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for doc in firestore.categories_collection(uid).stream():
        data = doc.to_dict()
        name = data.get("name")
        if not name:
            continue
        mapping[doc.id] = name
    return mapping


def _build_category_name_kind_index(
    uid: str,
) -> Dict[tuple[str, str], fs.DocumentReference]:
    refs: Dict[tuple[str, str], fs.DocumentReference] = {}
    for doc in firestore.categories_collection(uid).stream():
        data = doc.to_dict()
        name = data.get("name")
        kind = data.get("kind")
        if not name or not kind:
            continue
        refs[(name, kind)] = doc.reference
    return refs


def _next_asset_sort_order(uid: str) -> int:
    query = (
        firestore.assets_collection(uid)
        .order_by("sortOrder", direction=fs.Query.DESCENDING)
        .limit(1)
    )
    for doc in query.stream():
        data = doc.to_dict()
        return int(data.get("sortOrder", 0)) + 1
    return 1


def _next_category_sort_order(uid: str, kind: str) -> int:
    query = (
        firestore.categories_collection(uid)
        .where(filter=FieldFilter("kind", "==", kind))
        .order_by("sortOrder", direction=fs.Query.DESCENDING)
        .limit(1)
    )
    for doc in query.stream():
        data = doc.to_dict()
        return int(data.get("sortOrder", 0)) + 1
    return 1


def _resolve_asset(
    uid: str,
    asset_id: Optional[str],
    asset_name: Optional[str],
    now: datetime,
    asset_name_index: Dict[str, fs.DocumentReference],
    next_sort_order: int,
) -> tuple[str, str, int]:
    if asset_id:
        doc_ref = firestore.asset_doc(uid, asset_id)
        snap = doc_ref.get()
        if snap.exists:
            data = snap.to_dict()
            name = data.get("name") or asset_name or asset_id
            return asset_id, name, next_sort_order
        name = asset_name or asset_id
        doc_ref.set(
            {
                "name": name,
                "type": None,
                "currency": "JPY",
                "isActive": True,
                "initialBalance": 0,
                "currentBalance": 0,
                "note": None,
                "sortOrder": next_sort_order,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        asset_name_index[name] = doc_ref
        return asset_id, name, next_sort_order + 1
    if asset_name:
        ref = asset_name_index.get(asset_name)
        if ref:
            return ref.id, asset_name, next_sort_order
        doc_ref = firestore.assets_collection(uid).document()
        doc_ref.set(
            {
                "name": asset_name,
                "type": None,
                "currency": "JPY",
                "isActive": True,
                "initialBalance": 0,
                "currentBalance": 0,
                "note": None,
                "sortOrder": next_sort_order,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        asset_name_index[asset_name] = doc_ref
        return doc_ref.id, asset_name, next_sort_order + 1
    raise AppError(400, "assetName is required")


def _resolve_category(
    uid: str,
    category_id: Optional[str],
    category_name: Optional[str],
    kind: str,
    now: datetime,
    category_index: Dict[tuple[str, str], fs.DocumentReference],
    next_sort_order: int,
) -> tuple[str, str, int]:
    if category_id:
        doc_ref = firestore.category_doc(uid, category_id)
        snap = doc_ref.get()
        if snap.exists:
            data = snap.to_dict()
            name = data.get("name") or category_name or category_id
            return category_id, name, next_sort_order
        name = category_name or category_id
        doc_ref.set(
            {
                "name": name,
                "isActive": True,
                "sortOrder": next_sort_order,
                "kind": kind,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        category_index[(name, kind)] = doc_ref
        return category_id, name, next_sort_order + 1
    if category_name:
        ref = category_index.get((category_name, kind))
        if ref:
            return ref.id, category_name, next_sort_order
        doc_ref = firestore.categories_collection(uid).document()
        doc_ref.set(
            {
                "name": category_name,
                "isActive": True,
                "sortOrder": next_sort_order,
                "kind": kind,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        category_index[(category_name, kind)] = doc_ref
        return doc_ref.id, category_name, next_sort_order + 1
    raise AppError(400, "categoryName is required")


def _normalize_tx_names(
    tx: dict,
    asset_name_by_id: Dict[str, str],
    category_name_by_id: Dict[str, str],
) -> dict:
    asset_id = tx.get("assetId")
    if asset_id:
        asset_value = asset_name_by_id.get(asset_id)
        if asset_value:
            if tx.get("assetName") != asset_value:
                tx["assetName"] = asset_value
        elif not tx.get("assetName"):
            tx["assetName"] = asset_id
    from_asset_id = tx.get("fromAssetId")
    if from_asset_id:
        from_value = asset_name_by_id.get(from_asset_id)
        if from_value:
            if tx.get("fromAssetName") != from_value:
                tx["fromAssetName"] = from_value
        elif not tx.get("fromAssetName"):
            tx["fromAssetName"] = from_asset_id
    to_asset_id = tx.get("toAssetId")
    if to_asset_id:
        to_value = asset_name_by_id.get(to_asset_id)
        if to_value:
            if tx.get("toAssetName") != to_value:
                tx["toAssetName"] = to_value
        elif not tx.get("toAssetName"):
            tx["toAssetName"] = to_asset_id
    category_id = tx.get("categoryId")
    if category_id:
        category_value = category_name_by_id.get(category_id)
        if category_value:
            if tx.get("categoryName") != category_value:
                tx["categoryName"] = category_value
        elif not tx.get("categoryName"):
            tx["categoryName"] = category_id
    fee_category_id = tx.get("feeCategoryId")
    if fee_category_id:
        fee_value = category_name_by_id.get(fee_category_id)
        if fee_value:
            if tx.get("feeCategoryName") != fee_value:
                tx["feeCategoryName"] = fee_value
        elif not tx.get("feeCategoryName"):
            tx["feeCategoryName"] = fee_category_id
    return tx


def _normalize_balance_keys(
    balances: Dict[str, int], asset_name_by_id: Dict[str, str]
) -> Dict[str, int]:
    normalized: Dict[str, int] = {}
    for key, value in balances.items():
        name = asset_name_by_id.get(key, key)
        normalized[name] = normalized.get(name, 0) + int(value)
    return normalized

def get_transactions_last_modified(uid: str) -> datetime:
    user_ref = firestore.user_doc(uid)
    snap = user_ref.get()
    now = _now()
    if snap.exists:
        data = snap.to_dict()
        last_modified = data.get("transactionsUpdatedAt")
        if isinstance(last_modified, datetime):
            return _to_utc(last_modified)
    # 最終更新時刻が未初期化の既存ユーザー向けに、ここで初期化する
    user_ref.set({"transactionsUpdatedAt": now}, merge=True)
    return now


def _seed_balances(uid: str, as_of: datetime) -> Dict[str, int]:
    balances: Dict[str, int] = {}
    for doc in firestore.assets_collection(uid).stream():
        data = doc.to_dict()
        name = data.get("name")
        if not name:
            continue
        created_at = data.get("createdAt")
        include = True
        if created_at:
            # 常に「その時刻より前」を対象にする。境界（as_ofちょうど）は次の月のループで処理される
            include = _to_utc(created_at) < as_of
        balances[name] = int(data.get("initialBalance", 0)) if include else 0
    return balances


def _apply_tx_effect(
    balances: Dict[str, int],
    tx: dict,
    asset_name_by_id: Dict[str, str],
    category_name_by_id: Dict[str, str],
):
    normalized = _normalize_tx_names(dict(tx), asset_name_by_id, category_name_by_id)
    effect = tx_effect(normalized)
    for asset_name, delta in effect.items():
        balances[asset_name] = balances.get(asset_name, 0) + int(delta)


def _compute_balances_until(uid: str, end_dt: datetime) -> Dict[str, int]:
    end_dt = _to_utc(end_dt)
    balances = _seed_balances(uid, end_dt)
    asset_name_by_id = _build_asset_name_by_id(uid)
    category_name_by_id = _build_category_name_by_id(uid)
    query = (
        firestore.transactions_collection(uid)
        .where(filter=FieldFilter("occurredAt", "<", end_dt))
        .order_by("occurredAt")
    )
    for doc in query.stream():
        _apply_tx_effect(balances, doc.to_dict(), asset_name_by_id, category_name_by_id)
    return balances


def _apply_transactions_between(
    uid: str, start_dt: datetime, end_dt: datetime, balances: Dict[str, int]
) -> Dict[str, int]:
    start_dt = _to_utc(start_dt)
    end_dt = _to_utc(end_dt)
    asset_name_by_id = _build_asset_name_by_id(uid)
    category_name_by_id = _build_category_name_by_id(uid)
    query = (
        firestore.transactions_collection(uid)
        .where(filter=FieldFilter("occurredAt", ">=", start_dt))
        .where(filter=FieldFilter("occurredAt", "<", end_dt))
        .order_by("occurredAt")
    )
    for doc in query.stream():
        _apply_tx_effect(balances, doc.to_dict(), asset_name_by_id, category_name_by_id)
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
    now_month = _month_start(_now())
    # Ensure update at least until target_month or current month
    end_month = target_month if target_month > now_month else now_month

    user_ref = firestore.user_doc(uid)
    user_snap = user_ref.get()
    dirty_from = None
    if user_snap.exists:
        dirty_from = user_snap.to_dict().get("balanceDirtyFrom")
    if dirty_from:
        dirty_from = _month_start(_to_utc(dirty_from))

    snapshot = _get_snapshot(uid, target_month)
    start_month = None
    if dirty_from and dirty_from <= end_month:
        start_month = dirty_from
    elif not snapshot:
        start_month = target_month

    if not start_month:
        return

    asset_name_by_id = _build_asset_name_by_id(uid)

    # 全資産を取得して、ループ内で作成月を判定して初期残高を加算する
    all_assets = []
    for doc in firestore.assets_collection(uid).stream():
        data = doc.to_dict()
        if data.get("name"):
            all_assets.append(data)

    prev_snapshot = _get_snapshot(uid, _prev_month(start_month))
    if prev_snapshot:
        balances = _normalize_balance_keys(
            prev_snapshot.get("byAsset", {}), asset_name_by_id
        )
    else:
        balances = _compute_balances_until(uid, start_month)

    month = start_month
    while month <= end_month:
        month_end = _next_month(month)

        # この月に作成された資産の初期残高を加算する
        for asset in all_assets:
            created_at = asset.get("createdAt")
            if created_at:
                created_at_utc = _to_utc(created_at)
                if month <= created_at_utc < month_end:
                    name = asset["name"]
                    balances[name] = balances.get(name, 0) + int(asset.get("initialBalance", 0))

        balances = _apply_transactions_between(uid, month, month_end, balances)
        _save_snapshot(uid, month, balances)
        month = month_end

    if dirty_from:
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
        _require(tx.get("assetName"), "assetName is required")
        if not tx.get("categoryName"):
            raise AppError(400, "categoryName is required")
        _require(tx.get("categoryId"), "categoryId is required")
    elif tx_type == "income":
        _require(tx.get("assetId"), "assetId is required")
        _require(tx.get("assetName"), "assetName is required")
        if not tx.get("categoryName"):
            raise AppError(400, "categoryName is required")
        _require(tx.get("categoryId"), "categoryId is required")
    elif tx_type == "transfer":
        _require(tx.get("fromAssetId"), "fromAssetId is required")
        _require(tx.get("fromAssetName"), "fromAssetName is required")
        _require(tx.get("toAssetId"), "toAssetId is required")
        _require(tx.get("toAssetName"), "toAssetName is required")
        if tx.get("fromAssetId") == tx.get("toAssetId"):
            raise AppError(400, "fromAssetName and toAssetName must be different")
    else:
        raise AppError(400, "Invalid transaction type")


def tx_effect(tx: dict) -> Dict[str, int]:
    tx_type = tx.get("type")
    amount = int(tx.get("amount", 0))
    fee = int(tx.get("fee", 0) or 0)
    if tx_type == "expense":
        asset_name = tx.get("assetName")
        if not asset_name:
            return {}
        return {asset_name: -amount}
    if tx_type == "income":
        asset_name = tx.get("assetName")
        if not asset_name:
            return {}
        return {asset_name: amount}
    if tx_type == "transfer":
        from_asset = tx.get("fromAssetName")
        to_asset = tx.get("toAssetName")
        if not from_asset or not to_asset:
            return {}
        return {from_asset: -(amount + fee), to_asset: amount}
    raise AppError(400, "Invalid transaction type")


def compute_balance_deltas(old_tx: Optional[dict], new_tx: Optional[dict]) -> Dict[str, int]:
    old_effect = tx_effect(old_tx) if old_tx else {}
    new_effect = tx_effect(new_tx) if new_tx else {}
    deltas: Dict[str, int] = {}
    for asset_id in set(old_effect.keys()) | set(new_effect.keys()):
        deltas[asset_id] = new_effect.get(asset_id, 0) - old_effect.get(asset_id, 0)
    return deltas


def _apply_balance_deltas(
    transaction: fs.Transaction,
    asset_refs: Dict[str, fs.DocumentReference],
    deltas: Dict[str, int],
    now: datetime,
):
    for asset_name, delta in deltas.items():
        if delta == 0:
            continue
        ref = asset_refs.get(asset_name)
        if not ref:
            continue
        transaction.update(
            ref,
            {"currentBalance": fs.Increment(delta), "updatedAt": now},
        )


def create_expense(uid: str, payload: ExpenseCreate) -> dict:
    asset_name_index = _build_asset_name_index(uid)
    category_index = _build_category_name_kind_index(uid)

    def _work(transaction: fs.Transaction):
        now = _now()
        next_asset_sort = _next_asset_sort_order(uid)
        next_category_sort = _next_category_sort_order(uid, "expense")
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None
        data = payload.dict()
        asset_id, asset_name, next_asset_sort = _resolve_asset(
            uid,
            data.get("assetId"),
            data.get("assetName"),
            now,
            asset_name_index,
            next_asset_sort,
        )
        category_id, category_name, next_category_sort = _resolve_category(
            uid,
            data.get("categoryId"),
            data.get("categoryName"),
            "expense",
            now,
            category_index,
            next_category_sort,
        )
        data["assetId"] = asset_id
        data["assetName"] = asset_name
        data["categoryId"] = category_id
        data["categoryName"] = category_name
        if data.get("dayOrder") is None:
            data["dayOrder"] = _default_day_order(now)
        data["type"] = "expense"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, asset_name_index, deltas, now)
        _queue_balance_dirty(
            transaction, user_ref, existing_dirty, _month_start(data["occurredAt"])
        )
        _touch_transactions_updated_at(transaction, user_ref, now)
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def create_income(uid: str, payload: IncomeCreate) -> dict:
    asset_name_index = _build_asset_name_index(uid)
    category_index = _build_category_name_kind_index(uid)

    def _work(transaction: fs.Transaction):
        now = _now()
        next_asset_sort = _next_asset_sort_order(uid)
        next_category_sort = _next_category_sort_order(uid, "income")
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None
        data = payload.dict()
        asset_id, asset_name, next_asset_sort = _resolve_asset(
            uid,
            data.get("assetId"),
            data.get("assetName"),
            now,
            asset_name_index,
            next_asset_sort,
        )
        category_id, category_name, next_category_sort = _resolve_category(
            uid,
            data.get("categoryId"),
            data.get("categoryName"),
            "income",
            now,
            category_index,
            next_category_sort,
        )
        data["assetId"] = asset_id
        data["assetName"] = asset_name
        data["categoryId"] = category_id
        data["categoryName"] = category_name
        if data.get("dayOrder") is None:
            data["dayOrder"] = _default_day_order(now)
        data["type"] = "income"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, asset_name_index, deltas, now)
        _queue_balance_dirty(
            transaction, user_ref, existing_dirty, _month_start(data["occurredAt"])
        )
        _touch_transactions_updated_at(transaction, user_ref, now)
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def create_transfer(uid: str, payload: TransferCreate) -> dict:
    asset_name_index = _build_asset_name_index(uid)

    def _work(transaction: fs.Transaction):
        now = _now()
        next_asset_sort = _next_asset_sort_order(uid)
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None
        data = payload.dict()
        from_asset_id, from_asset_name, next_asset_sort = _resolve_asset(
            uid,
            data.get("fromAssetId"),
            data.get("fromAssetName"),
            now,
            asset_name_index,
            next_asset_sort,
        )
        to_asset_id, to_asset_name, next_asset_sort = _resolve_asset(
            uid,
            data.get("toAssetId"),
            data.get("toAssetName"),
            now,
            asset_name_index,
            next_asset_sort,
        )
        data["fromAssetId"] = from_asset_id
        data["fromAssetName"] = from_asset_name
        data["toAssetId"] = to_asset_id
        data["toAssetName"] = to_asset_name
        if data.get("dayOrder") is None:
            data["dayOrder"] = _default_day_order(now)
        data["type"] = "transfer"
        data["createdAt"] = now
        data["updatedAt"] = now
        data["createdBy"] = uid
        _validate_tx_payload(data)
        deltas = compute_balance_deltas(None, data)
        _apply_balance_deltas(transaction, asset_name_index, deltas, now)
        _queue_balance_dirty(
            transaction, user_ref, existing_dirty, _month_start(data["occurredAt"])
        )
        _touch_transactions_updated_at(transaction, user_ref, now)
        doc_ref = firestore.transactions_collection(uid).document()
        transaction.set(doc_ref, data)
        data["id"] = doc_ref.id
        return data

    return firestore.run_in_transaction(_work)


def update_transaction(uid: str, tx_id: str, payload: TransactionUpdate) -> dict:
    asset_refs = _build_asset_name_index(uid)
    category_index = _build_category_name_kind_index(uid)
    asset_name_by_id = _build_asset_name_by_id(uid)
    category_name_by_id = _build_category_name_by_id(uid)
    patch = payload.dict(exclude_unset=True)
    balance_fields = {
        "occurredAt",
        "amount",
        "type",
        "assetName",
        "fromAssetName",
        "toAssetName",
        "fee",
    }

    def _work(transaction: fs.Transaction):
        now = _now()
        next_asset_sort = _next_asset_sort_order(uid)
        next_category_sort_expense = _next_category_sort_order(uid, "expense")
        next_category_sort_income = _next_category_sort_order(uid, "income")
        tx_ref = firestore.transaction_doc(uid, tx_id)
        snap = tx_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(404, "Transaction not found")
        old_tx = snap.to_dict()
        old_tx = _normalize_tx_names(old_tx, asset_name_by_id, category_name_by_id)
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

        tx_type = new_tx.get("type")
        if tx_type in ("expense", "income"):
            asset_id, asset_name, next_asset_sort = _resolve_asset(
                uid,
                new_tx.get("assetId"),
                new_tx.get("assetName"),
                now,
                asset_refs,
                next_asset_sort,
            )
            category_kind = "expense" if tx_type == "expense" else "income"
            next_category_sort = (
                next_category_sort_expense
                if category_kind == "expense"
                else next_category_sort_income
            )
            category_id, category_name, next_category_sort = _resolve_category(
                uid,
                new_tx.get("categoryId"),
                new_tx.get("categoryName"),
                category_kind,
                now,
                category_index,
                next_category_sort,
            )
            if category_kind == "expense":
                next_category_sort_expense = next_category_sort
            else:
                next_category_sort_income = next_category_sort
            new_tx["assetId"] = asset_id
            new_tx["assetName"] = asset_name
            new_tx["categoryId"] = category_id
            new_tx["categoryName"] = category_name
        if tx_type == "transfer":
            from_id, from_name, next_asset_sort = _resolve_asset(
                uid,
                new_tx.get("fromAssetId"),
                new_tx.get("fromAssetName"),
                now,
                asset_refs,
                next_asset_sort,
            )
            to_id, to_name, next_asset_sort = _resolve_asset(
                uid,
                new_tx.get("toAssetId"),
                new_tx.get("toAssetName"),
                now,
                asset_refs,
                next_asset_sort,
            )
            new_tx["fromAssetId"] = from_id
            new_tx["fromAssetName"] = from_name
            new_tx["toAssetId"] = to_id
            new_tx["toAssetName"] = to_name

        new_tx["updatedAt"] = now
        _validate_tx_payload(new_tx)

        deltas = compute_balance_deltas(old_tx, new_tx)
        _apply_balance_deltas(transaction, asset_refs, deltas, now)

        if any(field in patch for field in balance_fields):
            old_month = _month_start(_to_utc(old_tx["occurredAt"]))
            new_month = _month_start(_to_utc(new_tx["occurredAt"]))
            dirty_from = old_month if old_month <= new_month else new_month
            _queue_balance_dirty(transaction, user_ref, existing_dirty, dirty_from)
        _touch_transactions_updated_at(transaction, user_ref, now)

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

        for field in FIELDS_BY_TYPE.get(new_type, set()):
            if new_tx.get(field) != old_tx.get(field):
                updates[field] = new_tx.get(field)

        transaction.update(tx_ref, updates)
        new_tx["id"] = tx_id
        return new_tx

    return firestore.run_in_transaction(_work)


def delete_transaction(uid: str, tx_id: str) -> dict:
    asset_refs = _build_asset_name_index(uid)
    asset_name_by_id = _build_asset_name_by_id(uid)
    category_name_by_id = _build_category_name_by_id(uid)

    def _work(transaction: fs.Transaction):
        now = _now()
        tx_ref = firestore.transaction_doc(uid, tx_id)
        snap = tx_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(404, "Transaction not found")
        old_tx = snap.to_dict()
        old_tx = _normalize_tx_names(old_tx, asset_name_by_id, category_name_by_id)
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)
        existing_dirty = user_snap.to_dict().get("balanceDirtyFrom") if user_snap.exists else None
        deltas = compute_balance_deltas(old_tx, None)
        _apply_balance_deltas(transaction, asset_refs, deltas, now)
        _queue_balance_dirty(
            transaction, user_ref, existing_dirty, _month_start(old_tx["occurredAt"])
        )
        _touch_transactions_updated_at(transaction, user_ref, now)
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

    if not asset_id and not category_id:
        query = query.limit(limit)

    asset_name_by_id = _build_asset_name_by_id(uid)
    category_name_by_id = _build_category_name_by_id(uid)
    asset_name_index = _build_asset_name_index(uid)
    category_index = _build_category_name_kind_index(uid)
    now = _now()
    items = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        original = dict(data)
        updates: Dict[str, object] = {}
        normalized = _normalize_tx_names(
            dict(data), asset_name_by_id, category_name_by_id
        )
        data.update(normalized)
        if data.get("assetId") and original.get("assetName") != data.get("assetName"):
            updates["assetName"] = data.get("assetName")
        if data.get("fromAssetId") and original.get("fromAssetName") != data.get(
            "fromAssetName"
        ):
            updates["fromAssetName"] = data.get("fromAssetName")
        if data.get("toAssetId") and original.get("toAssetName") != data.get("toAssetName"):
            updates["toAssetName"] = data.get("toAssetName")
        if data.get("categoryId") and original.get("categoryName") != data.get("categoryName"):
            updates["categoryName"] = data.get("categoryName")
        if data.get("feeCategoryId") and original.get("feeCategoryName") != data.get(
            "feeCategoryName"
        ):
            updates["feeCategoryName"] = data.get("feeCategoryName")

        if not data.get("assetId") and data.get("assetName"):
            ref = asset_name_index.get(data.get("assetName"))
            if ref:
                data["assetId"] = ref.id
                updates["assetId"] = ref.id
        if not data.get("fromAssetId") and data.get("fromAssetName"):
            ref = asset_name_index.get(data.get("fromAssetName"))
            if ref:
                data["fromAssetId"] = ref.id
                updates["fromAssetId"] = ref.id
        if not data.get("toAssetId") and data.get("toAssetName"):
            ref = asset_name_index.get(data.get("toAssetName"))
            if ref:
                data["toAssetId"] = ref.id
                updates["toAssetId"] = ref.id

        tx_kind = data.get("type")
        if not data.get("categoryId") and data.get("categoryName") and tx_kind in (
            "expense",
            "income",
        ):
            ref = category_index.get((data.get("categoryName"), tx_kind))
            if ref:
                data["categoryId"] = ref.id
                updates["categoryId"] = ref.id
        if not data.get("feeCategoryId") and data.get("feeCategoryName"):
            ref = category_index.get((data.get("feeCategoryName"), "expense"))
            if ref:
                data["feeCategoryId"] = ref.id
                updates["feeCategoryId"] = ref.id
        if updates:
            updates["updatedAt"] = now
            doc.reference.update(updates)
        items.append(data)

    if asset_id or category_id:
        target_asset_name = asset_name_by_id.get(asset_id) if asset_id else None
        filtered = []
        for item in items:
            if asset_id:
                if item.get("type") == "transfer":
                    if (
                        asset_id
                        not in {
                            item.get("fromAssetId"),
                            item.get("toAssetId"),
                        }
                        and (
                            not target_asset_name
                            or target_asset_name
                            not in {
                                item.get("fromAssetName"),
                                item.get("toAssetName"),
                            }
                        )
                    ):
                        continue
                else:
                    if item.get("assetId") != asset_id and (
                        not target_asset_name or item.get("assetName") != target_asset_name
                    ):
                        continue
            if category_id and item.get("categoryId") != category_id:
                continue
            filtered.append(item)
        items = filtered
        if limit and len(items) > limit:
            items = items[:limit]

    next_cursor = items[-1]["id"] if items else None
    result = {"items": items, "nextCursor": next_cursor}

    if include_opening_balances and from_dt:
        from_dt = _to_utc(from_dt)
        month_start = _month_start(from_dt)
        prev_month = _prev_month(month_start)
        _ensure_snapshots(uid, prev_month)
        snapshot = _get_snapshot(uid, prev_month)
        balances = (
            _normalize_balance_keys(
                snapshot.get("byAsset", {}), asset_name_by_id
            )
            if snapshot
            else _compute_balances_until(uid, month_start)
        )
        if from_dt > month_start:
            balances = _apply_transactions_between(uid, month_start, from_dt, balances)
        result["openingBalances"] = balances

    return result


def _bulk_update_transactions_field(
    uid: str, field: str, old_value: str, new_value: str, now: datetime
) -> int:
    query = firestore.transactions_collection(uid).where(
        filter=FieldFilter(field, "==", old_value)
    )
    client = firestore.get_client()
    batch = client.batch()
    count = 0
    updated = 0
    for doc in query.stream():
        batch.update(doc.reference, {field: new_value, "updatedAt": now})
        count += 1
        updated += 1
        if count >= 400:
            batch.commit()
            batch = client.batch()
            count = 0
    if count > 0:
        batch.commit()
    return updated


def _bulk_update_transactions_name_by_id(
    uid: str, id_field: str, name_field: str, target_id: str, new_name: str, now: datetime
) -> int:
    query = firestore.transactions_collection(uid).where(
        filter=FieldFilter(id_field, "==", target_id)
    )
    client = firestore.get_client()
    batch = client.batch()
    count = 0
    updated = 0
    for doc in query.stream():
        batch.update(doc.reference, {name_field: new_name, "updatedAt": now})
        count += 1
        updated += 1
        if count >= 400:
            batch.commit()
            batch = client.batch()
            count = 0
    if count > 0:
        batch.commit()
    return updated


def rename_asset_in_transactions(uid: str, asset_id: str, old_name: str, new_name: str) -> int:
    if not new_name or (old_name and old_name == new_name):
        return 0
    now = _now()
    updated = 0
    if asset_id:
        updated += _bulk_update_transactions_name_by_id(
            uid, "assetId", "assetName", asset_id, new_name, now
        )
        updated += _bulk_update_transactions_name_by_id(
            uid, "fromAssetId", "fromAssetName", asset_id, new_name, now
        )
        updated += _bulk_update_transactions_name_by_id(
            uid, "toAssetId", "toAssetName", asset_id, new_name, now
        )
    if old_name:
        updated += _bulk_update_transactions_field(uid, "assetName", old_name, new_name, now)
        updated += _bulk_update_transactions_field(uid, "fromAssetName", old_name, new_name, now)
        updated += _bulk_update_transactions_field(uid, "toAssetName", old_name, new_name, now)
    if updated:
        # Renaming asset affects all snapshots
        dirty_from = datetime(2000, 1, 1, tzinfo=timezone.utc)
        firestore.user_doc(uid).set(
            {"transactionsUpdatedAt": now, "balanceDirtyFrom": dirty_from}, merge=True
        )
    return updated


def rename_category_in_transactions(uid: str, category_id: str, old_name: str, new_name: str) -> int:
    if not new_name or (old_name and old_name == new_name):
        return 0
    now = _now()
    updated = 0
    if category_id:
        updated += _bulk_update_transactions_name_by_id(
            uid, "categoryId", "categoryName", category_id, new_name, now
        )
        updated += _bulk_update_transactions_name_by_id(
            uid, "feeCategoryId", "feeCategoryName", category_id, new_name, now
        )
    if old_name:
        updated += _bulk_update_transactions_field(uid, "categoryName", old_name, new_name, now)
        updated += _bulk_update_transactions_field(uid, "feeCategoryName", old_name, new_name, now)
    if updated:
        firestore.user_doc(uid).set({"transactionsUpdatedAt": now}, merge=True)
    return updated


def export_transactions(uid: str) -> List[dict]:
    asset_name_by_id = _build_asset_name_by_id(uid)
    category_name_by_id = _build_category_name_by_id(uid)
    query = firestore.transactions_collection(uid)
    docs = query.stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data = _normalize_tx_names(data, asset_name_by_id, category_name_by_id)
        data["id"] = doc.id
        for key in (
            "assetId",
            "fromAssetId",
            "toAssetId",
            "categoryId",
            "feeCategoryId",
        ):
            data.pop(key, None)
        # Convert datetimes to isoformat for JSON serialization
        if isinstance(data.get("occurredAt"), datetime):
            data["occurredAt"] = data["occurredAt"].isoformat()
        if isinstance(data.get("createdAt"), datetime):
            data["createdAt"] = data["createdAt"].isoformat()
        if isinstance(data.get("updatedAt"), datetime):
            data["updatedAt"] = data["updatedAt"].isoformat()
        results.append(data)
    return results


def import_transactions(uid: str, transactions: List[dict]):
    if not transactions:
        return

    # 1. Fetch existing IDs to skip
    existing_ids = set()
    docs = firestore.transactions_collection(uid).select([]).stream()
    for doc in docs:
        existing_ids.add(doc.id)

    new_txs = []
    for tx in transactions:
        tx_id = tx.get("id")
        if tx_id and tx_id not in existing_ids:
            new_txs.append(tx)

    if not new_txs:
        return

    asset_name_by_id = _build_asset_name_by_id(uid)
    category_name_by_id = _build_category_name_by_id(uid)
    asset_refs = _build_asset_name_index(uid)
    category_refs = _build_category_name_kind_index(uid)

    needed_assets: set[str] = set()
    needed_categories: set[tuple] = set()

    # 2. Calculate balance deltas
    total_deltas: Dict[str, int] = {}
    min_occurred_at = None

    for tx in new_txs:
        # Normalize date
        if isinstance(tx.get("occurredAt"), str):
            try:
                dt = datetime.fromisoformat(tx["occurredAt"].replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                tx["occurredAt"] = dt
            except ValueError:
                continue

        if "amount" in tx:
            tx["amount"] = int(tx["amount"])

        normalized = _normalize_tx_names(tx, asset_name_by_id, category_name_by_id)

        asset_name = normalized.get("assetName") or normalized.get("assetId")
        if asset_name:
            needed_assets.add(asset_name)
        from_asset = normalized.get("fromAssetName") or normalized.get("fromAssetId")
        if from_asset:
            needed_assets.add(from_asset)
        to_asset = normalized.get("toAssetName") or normalized.get("toAssetId")
        if to_asset:
            needed_assets.add(to_asset)

        if normalized.get("type") == "expense":
            category_name = normalized.get("categoryName") or normalized.get("categoryId")
            if category_name:
                needed_categories.add((category_name, "expense"))
        if normalized.get("type") == "income":
            category_name = normalized.get("categoryName") or normalized.get("categoryId")
            if category_name:
                needed_categories.add((category_name, "income"))
        fee_category = normalized.get("feeCategoryName") or normalized.get("feeCategoryId")
        if fee_category:
            needed_categories.add((fee_category, "expense"))

        effect = tx_effect(normalized)
        for asset_id, delta in effect.items():
            total_deltas[asset_id] = total_deltas.get(asset_id, 0) + delta

        if min_occurred_at is None or tx["occurredAt"] < min_occurred_at:
            min_occurred_at = tx["occurredAt"]

    # 3. Batched Write
    client = firestore.get_client()
    batch = client.batch()
    count = 0
    now = _now()

    next_asset_sort = _next_asset_sort_order(uid)
    # Create missing assets
    for name in needed_assets:
        if name in asset_refs:
            continue
        doc_ref = firestore.assets_collection(uid).document()
        data = {
            "name": name,
            "type": None,
            "currency": "JPY",
            "isActive": True,
            "initialBalance": 0,
            "currentBalance": 0,
            "note": None,
            "sortOrder": next_asset_sort,
            "createdAt": now,
            "updatedAt": now,
        }
        next_asset_sort += 1
        batch.set(doc_ref, data)
        asset_refs[name] = doc_ref
        count += 1
        if count >= 400:
            batch.commit()
            batch = client.batch()
            count = 0

    next_category_sort: Dict[str, int] = {
        "expense": _next_category_sort_order(uid, "expense"),
        "income": _next_category_sort_order(uid, "income"),
    }
    # Create missing categories
    for name, kind in needed_categories:
        if (name, kind) in category_refs:
            continue
        doc_ref = firestore.categories_collection(uid).document()
        data = {
            "name": name,
            "isActive": True,
            "sortOrder": next_category_sort[kind],
            "kind": kind,
            "createdAt": now,
            "updatedAt": now,
        }
        next_category_sort[kind] += 1
        batch.set(doc_ref, data)
        category_refs[(name, kind)] = doc_ref
        count += 1
        if count >= 400:
            batch.commit()
            batch = client.batch()
            count = 0

    if count > 0:
        batch.commit()
        batch = client.batch()
        count = 0

    # Write Transactions
    for tx in new_txs:
        tx_id = tx.get("id")
        data = _normalize_tx_names(tx.copy(), asset_name_by_id, category_name_by_id)
        if "id" in data:
            del data["id"]

        asset_name = data.get("assetName")
        if asset_name and asset_name in asset_refs:
            data["assetId"] = asset_refs[asset_name].id
        from_asset = data.get("fromAssetName")
        if from_asset and from_asset in asset_refs:
            data["fromAssetId"] = asset_refs[from_asset].id
        to_asset = data.get("toAssetName")
        if to_asset and to_asset in asset_refs:
            data["toAssetId"] = asset_refs[to_asset].id
        tx_type = data.get("type")
        category_name = data.get("categoryName")
        if category_name and tx_type in ("expense", "income"):
            ref = category_refs.get((category_name, tx_type))
            if ref:
                data["categoryId"] = ref.id
        fee_category_name = data.get("feeCategoryName")
        if fee_category_name:
            ref = category_refs.get((fee_category_name, "expense"))
            if ref:
                data["feeCategoryId"] = ref.id

        if isinstance(data.get("createdAt"), str):
            try:
                data["createdAt"] = datetime.fromisoformat(
                    data["createdAt"].replace("Z", "+00:00")
                )
            except ValueError:
                data["createdAt"] = now
        else:
            data["createdAt"] = now

        data["updatedAt"] = now
        data["createdBy"] = uid

        if data.get("dayOrder") is None:
            data["dayOrder"] = _default_day_order(now)

        doc_ref = firestore.transactions_collection(uid).document(tx_id)
        batch.set(doc_ref, data)
        count += 1

        if count >= 400:
            batch.commit()
            batch = client.batch()
            count = 0

    # Write Asset Updates (currentBalance)
    for asset_name, delta in total_deltas.items():
        if delta == 0:
            continue
        asset_ref = asset_refs.get(asset_name)
        if not asset_ref:
            continue
        batch.update(asset_ref, {"currentBalance": fs.Increment(delta), "updatedAt": now})
        count += 1
        if count >= 400:
            batch.commit()
            batch = client.batch()
            count = 0

    if count > 0:
        batch.commit()

    # handle dirty separately
    if min_occurred_at:
        def update_dirty(tx: fs.Transaction):
            user_ref = firestore.user_doc(uid)
            snap = user_ref.get(transaction=tx)
            existing = snap.to_dict().get("balanceDirtyFrom") if snap.exists else None
            _queue_balance_dirty(tx, user_ref, existing, _month_start(min_occurred_at))
            _touch_transactions_updated_at(tx, user_ref, now)

        firestore.run_in_transaction(update_dirty)
    else:
        firestore.user_doc(uid).set({"transactionsUpdatedAt": now}, merge=True)


def _delete_collection(coll_ref, batch_size):
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1

    if deleted >= batch_size:
        _delete_collection(coll_ref, batch_size)


def delete_all_transactions(uid: str):
    coll = firestore.transactions_collection(uid)
    _delete_collection(coll, 100)

    # Reset Assets
    assets = firestore.assets_collection(uid).stream()
    batch = firestore.get_client().batch()
    count = 0
    now = _now()

    for asset in assets:
        data = asset.to_dict()
        initial = int(data.get("initialBalance", 0))
        batch.update(asset.reference, {"currentBalance": initial, "updatedAt": now})
        count += 1
        if count >= 400:
            batch.commit()
            batch = firestore.get_client().batch()
            count = 0

    if count > 0:
        batch.commit()

    firestore.user_doc(uid).update(
        {"balanceDirtyFrom": fs.DELETE_FIELD, "transactionsUpdatedAt": now}
    )


def delete_user_account(uid: str):
    delete_all_transactions(uid)

    # Delete categories
    _delete_collection(firestore.categories_collection(uid), 100)

    # Delete assets (Wait, delete_all_transactions resets them, but here we want to DELETE them)
    # delete_all_transactions() calls _delete_collection(transactions).
    # It attempts to reset assets. If we are deleting account, reset is wasteful but fine.
    # But then we delete the asset docs themselves.
    _delete_collection(firestore.assets_collection(uid), 100)

    # Delete user doc
    firestore.user_doc(uid).delete()
