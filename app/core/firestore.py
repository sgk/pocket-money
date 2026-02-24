from typing import Callable, TypeVar

from google.cloud import firestore

from app.core.config import get_settings


T = TypeVar("T")


_client = None


def get_client() -> firestore.Client:
    global _client
    if _client is None:
        settings = get_settings()
        _client = firestore.Client(
            project=settings.google_cloud_project or None,
            database=settings.firestore_database or "(default)",
        )
    return _client


def run_in_transaction(func: Callable[[firestore.Transaction], T]) -> T:
    client = get_client()
    transaction = client.transaction()

    @firestore.transactional
    def _wrapped(tx: firestore.Transaction) -> T:
        return func(tx)

    return _wrapped(transaction)


def users_collection():
    return get_client().collection("users")


def user_doc(uid: str):
    return users_collection().document(uid)


def assets_collection(uid: str):
    return user_doc(uid).collection("assets")


def asset_doc(uid: str, asset_id: str):
    return assets_collection(uid).document(asset_id)


def categories_collection(uid: str):
    return user_doc(uid).collection("categories")


def category_doc(uid: str, category_id: str):
    return categories_collection(uid).document(category_id)


def transactions_collection(uid: str):
    return user_doc(uid).collection("transactions")


def transaction_doc(uid: str, tx_id: str):
    return transactions_collection(uid).document(tx_id)


def balance_snapshots_collection(uid: str):
    return user_doc(uid).collection("balanceSnapshots")


def balance_snapshot_doc(uid: str, month_key: str):
    return balance_snapshots_collection(uid).document(month_key)


def idempotency_keys_collection(uid: str):
    return user_doc(uid).collection("idempotencyKeys")


def idempotency_key_doc(uid: str, key_hash: str):
    return idempotency_keys_collection(uid).document(key_hash)


def error_logs_collection():
    return get_client().collection("errorLogs")


def invites_collection():
    return get_client().collection("invites")


def invite_doc(invite_id: str):
    return invites_collection().document(invite_id)


def terms_collection():
    return get_client().collection("terms")


def terms_doc(term_id: str):
    return terms_collection().document(term_id)
