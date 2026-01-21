from datetime import datetime, timezone
from typing import Dict

from google.cloud.firestore_v1.base_query import FieldFilter

from app.core import firestore
from app.services.transactions_service import tx_effect


def get_month_summary(uid: str, year: int, month: int) -> dict:
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    query = (
        firestore.transactions_collection(uid)
        .where(filter=FieldFilter("occurredAt", ">=", start))
        .where(filter=FieldFilter("occurredAt", "<", end))
    )

    expense_total = 0
    income_total = 0
    transfer_total = 0
    by_category: Dict[str, Dict[str, int]] = {}
    by_asset: Dict[str, int] = {}

    for doc in query.stream():
        tx = doc.to_dict()
        tx_type = tx.get("type")
        amount = int(tx.get("amount", 0))

        if tx_type == "expense":
            expense_total += amount
            category_name = tx.get("categoryName")
            if category_name:
                bucket = by_category.setdefault(category_name, {"expense": 0, "income": 0})
                bucket["expense"] += amount
        elif tx_type == "income":
            income_total += amount
            category_name = tx.get("categoryName")
            if category_name:
                bucket = by_category.setdefault(category_name, {"expense": 0, "income": 0})
                bucket["income"] += amount
        elif tx_type == "transfer":
            transfer_total += amount

        effect = tx_effect(tx)
        for asset_id, delta in effect.items():
            by_asset[asset_id] = by_asset.get(asset_id, 0) + delta

    net = income_total - expense_total
    return {
        "expenseTotal": expense_total,
        "incomeTotal": income_total,
        "net": net,
        "transferTotal": transfer_total,
        "byCategory": by_category,
        "byAsset": by_asset,
    }
