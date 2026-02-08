from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.api.deps import get_export_user
from app.core.auth import AuthResult
from app.core.errors import AppError


def _auth_user(uid: str, email: str | None) -> AuthResult:
    return AuthResult(uid=uid, email=email, display_name=None, photo_url=None)


def _child_ref(profile: dict) -> MagicMock:
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = profile
    ref = MagicMock()
    ref.get.return_value = snap
    return ref


def test_get_export_user_returns_self_without_child_header():
    request = SimpleNamespace(headers={}, state=SimpleNamespace())
    user = _auth_user(uid="u1", email="u1@example.com")

    export_user = get_export_user(request, user)

    assert export_user.uid == "u1"


def test_get_export_user_switches_to_child_when_authorized():
    request = SimpleNamespace(headers={"X-Child-Id": "child-b"}, state=SimpleNamespace())
    user = _auth_user(uid="parent-a", email="parent-a@example.com")
    child_profile = {
        "email": "child-b@example.com",
        "displayName": "Child B",
        "parentUids": ["parent-a"],
    }

    with patch("app.api.deps.firestore.user_doc", return_value=_child_ref(child_profile)):
        export_user = get_export_user(request, user)

    assert export_user.uid == "child-b"
    assert export_user.email == "child-b@example.com"


def test_get_export_user_rejects_unauthorized_child_access():
    request = SimpleNamespace(headers={"X-Child-Id": "child-b"}, state=SimpleNamespace())
    user = _auth_user(uid="parent-a", email="parent-a@example.com")
    child_profile = {
        "email": "child-b@example.com",
        "parentUids": ["parent-c"],
    }

    with patch("app.api.deps.firestore.user_doc", return_value=_child_ref(child_profile)):
        with pytest.raises(AppError) as exc:
            get_export_user(request, user)

    assert exc.value.status_code == 403
