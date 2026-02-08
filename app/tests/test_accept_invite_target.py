from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.api.routes_onboarding import _resolve_accept_invite_target
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


def test_resolve_accept_invite_target_uses_self_when_child_id_not_present():
    request = SimpleNamespace(headers={})
    user = _auth_user(uid="parent-a", email="ParentA@example.com")

    uid, email, acting_as_child = _resolve_accept_invite_target(request, user)

    assert uid == "parent-a"
    assert email == "parenta@example.com"
    assert acting_as_child is False


def test_resolve_accept_invite_target_uses_child_context():
    request = SimpleNamespace(headers={"X-Child-Id": "child-b"})
    user = _auth_user(uid="parent-a", email="ParentA@example.com")
    child_profile = {
        "ageGroup": "child",
        "email": "ChildB@example.com",
        "parentUids": ["parent-a"],
    }

    with patch("app.api.routes_onboarding.firestore.user_doc", return_value=_child_ref(child_profile)):
        uid, email, acting_as_child = _resolve_accept_invite_target(request, user)

    assert uid == "child-b"
    assert email == "childb@example.com"
    assert acting_as_child is True


def test_resolve_accept_invite_target_rejects_unauthorized_parent():
    request = SimpleNamespace(headers={"X-Child-Id": "child-b"})
    user = _auth_user(uid="parent-a", email="ParentA@example.com")
    child_profile = {
        "ageGroup": "child",
        "email": "ChildB@example.com",
        "parentUids": ["parent-c"],
    }

    with patch("app.api.routes_onboarding.firestore.user_doc", return_value=_child_ref(child_profile)):
        with pytest.raises(AppError) as exc:
            _resolve_accept_invite_target(request, user)

    assert exc.value.status_code == 403
