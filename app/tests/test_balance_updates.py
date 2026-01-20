from datetime import datetime, timezone

from app.services.transactions_service import compute_balance_deltas


NOW = datetime.now(timezone.utc)


def apply_deltas(balances, deltas):
    result = dict(balances)
    for asset_id, delta in deltas.items():
        result[asset_id] = result.get(asset_id, 0) + delta
    return result


def test_expense_create_update_delete():
    balances = {"a1": 1000}
    expense = {
        "type": "expense",
        "occurredAt": NOW,
        "amount": 200,
        "assetId": "a1",
        "categoryId": "c1",
    }
    deltas = compute_balance_deltas(None, expense)
    balances = apply_deltas(balances, deltas)
    assert balances["a1"] == 800

    updated = dict(expense)
    updated["amount"] = 150
    deltas = compute_balance_deltas(expense, updated)
    balances = apply_deltas(balances, deltas)
    assert balances["a1"] == 850

    deltas = compute_balance_deltas(updated, None)
    balances = apply_deltas(balances, deltas)
    assert balances["a1"] == 1000


def test_expense_asset_change():
    balances = {"a1": 1000, "a2": 500}
    old_tx = {
        "type": "expense",
        "occurredAt": NOW,
        "amount": 200,
        "assetId": "a1",
        "categoryId": "c1",
    }
    new_tx = {
        "type": "expense",
        "occurredAt": NOW,
        "amount": 300,
        "assetId": "a2",
        "categoryId": "c1",
    }
    deltas = compute_balance_deltas(old_tx, new_tx)
    balances = apply_deltas(balances, deltas)
    assert balances["a1"] == 1200
    assert balances["a2"] == 200


def test_income_create_update_delete():
    balances = {"a1": 1000}
    income = {
        "type": "income",
        "occurredAt": NOW,
        "amount": 400,
        "assetId": "a1",
        "categoryId": "c1",
    }
    deltas = compute_balance_deltas(None, income)
    balances = apply_deltas(balances, deltas)
    assert balances["a1"] == 1400

    updated = dict(income)
    updated["amount"] = 600
    deltas = compute_balance_deltas(income, updated)
    balances = apply_deltas(balances, deltas)
    assert balances["a1"] == 1600

    deltas = compute_balance_deltas(updated, None)
    balances = apply_deltas(balances, deltas)
    assert balances["a1"] == 1000


def test_transfer_create_update_delete_with_fee():
    balances = {"from": 1000, "to": 200}
    transfer = {
        "type": "transfer",
        "occurredAt": NOW,
        "amount": 300,
        "fee": 10,
        "fromAssetId": "from",
        "toAssetId": "to",
    }
    deltas = compute_balance_deltas(None, transfer)
    balances = apply_deltas(balances, deltas)
    assert balances["from"] == 690
    assert balances["to"] == 500

    updated = dict(transfer)
    updated["amount"] = 100
    updated["fee"] = 0
    deltas = compute_balance_deltas(transfer, updated)
    balances = apply_deltas(balances, deltas)
    assert balances["from"] == 900
    assert balances["to"] == 300

    deltas = compute_balance_deltas(updated, None)
    balances = apply_deltas(balances, deltas)
    assert balances["from"] == 1000
    assert balances["to"] == 200


def test_transfer_change_assets():
    balances = {"a1": 1000, "a2": 500, "a3": 0}
    old_tx = {
        "type": "transfer",
        "occurredAt": NOW,
        "amount": 200,
        "fee": 5,
        "fromAssetId": "a1",
        "toAssetId": "a2",
    }
    new_tx = {
        "type": "transfer",
        "occurredAt": NOW,
        "amount": 300,
        "fee": 0,
        "fromAssetId": "a2",
        "toAssetId": "a3",
    }
    deltas = compute_balance_deltas(old_tx, new_tx)
    balances = apply_deltas(balances, deltas)
    assert balances["a1"] == 1205
    assert balances["a2"] == 0
    assert balances["a3"] == 300
