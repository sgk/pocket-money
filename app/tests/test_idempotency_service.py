from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.core.errors import AppError
from app.services import idempotency_service


class _FakeSnapshot:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else {}


class _FakeDoc:
    def __init__(self):
        self.data = None

    def get(self):
        return _FakeSnapshot(self.data)

    def create(self, payload):
        if self.data is not None:
            from google.api_core.exceptions import AlreadyExists

            raise AlreadyExists("already exists")
        self.data = dict(payload)

    def set(self, payload, merge=False):
        if merge and self.data is not None:
            self.data.update(payload)
            return
        self.data = dict(payload)

    def delete(self):
        self.data = None


def test_missing_idempotency_key_is_rejected():
    with pytest.raises(AppError) as exc:
        idempotency_service.begin_request(
            uid="u1",
            method="POST",
            path="/api/transactions/expense",
            idempotency_key="",
            payload={"amount": 100},
        )
    assert exc.value.status_code == 400


def test_replay_returns_saved_response():
    doc = _FakeDoc()
    with patch(
        "app.services.idempotency_service.firestore.idempotency_key_doc",
        return_value=doc,
    ):
        decision = idempotency_service.begin_request(
            uid="u1",
            method="POST",
            path="/api/transactions/expense",
            idempotency_key="key-1",
            payload={"amount": 100, "assetName": "財布"},
        )
        assert decision.mode == "execute"

        response = {"id": "tx-1", "type": "expense", "amount": 100}
        idempotency_service.complete_request(
            uid="u1",
            method="POST",
            path="/api/transactions/expense",
            idempotency_key="key-1",
            response_body=response,
        )

        replay = idempotency_service.begin_request(
            uid="u1",
            method="POST",
            path="/api/transactions/expense",
            idempotency_key="key-1",
            payload={"amount": 100, "assetName": "財布"},
        )
        assert replay.mode == "replay"
        assert replay.response_body == response
        assert replay.status_code == 200


def test_payload_mismatch_raises_conflict():
    doc = _FakeDoc()
    with patch(
        "app.services.idempotency_service.firestore.idempotency_key_doc",
        return_value=doc,
    ):
        decision = idempotency_service.begin_request(
            uid="u1",
            method="PATCH",
            path="/api/transactions/tx-1",
            idempotency_key="key-2",
            payload={"amount": 100},
        )
        assert decision.mode == "execute"

        with pytest.raises(AppError) as exc:
            idempotency_service.begin_request(
                uid="u1",
                method="PATCH",
                path="/api/transactions/tx-1",
                idempotency_key="key-2",
                payload={"amount": 200},
            )
        assert exc.value.status_code == 409


def test_expired_record_allows_reuse():
    doc = _FakeDoc()
    expired = datetime.now(timezone.utc) - timedelta(days=1)
    doc.data = {
        "key": "key-3",
        "method": "DELETE",
        "path": "/api/transactions/tx-1",
        "requestHash": "old",
        "status": "succeeded",
        "statusCode": 200,
        "responseBody": {"id": "tx-1"},
        "expiresAt": expired,
    }
    with patch(
        "app.services.idempotency_service.firestore.idempotency_key_doc",
        return_value=doc,
    ):
        decision = idempotency_service.begin_request(
            uid="u1",
            method="DELETE",
            path="/api/transactions/tx-1",
            idempotency_key="key-3",
            payload={},
        )
    assert decision.mode == "execute"
    assert doc.data is not None
    assert doc.data.get("status") == "in_progress"
