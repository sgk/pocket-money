from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from google.cloud import firestore as fs

from app.api.deps import get_ready_user
from app.core.auth import AuthResult
from app.core.errors import AppError
from app.core.terms import Terms, TermsSnapshot
from app.services.onboarding_service import (
    detach_parent_from_children,
    is_parent_access_revoked,
)


def _build_snapshot(now: datetime, grace_end_new: datetime) -> TermsSnapshot:
    agreed = Terms(
        term_id="t1",
        title="規約1",
        body="body1",
        display_start=now - timedelta(days=30),
        grace_end=now - timedelta(days=10),
    )
    newer = Terms(
        term_id="t2",
        title="規約2",
        body="body2",
        display_start=now - timedelta(days=5),
        grace_end=grace_end_new,
    )
    return TermsSnapshot(terms=[agreed, newer], terms_by_id={"t1": agreed, "t2": newer})


def _doc(doc_id: str, profile: dict):
    ref = MagicMock()
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = profile
    doc.reference = ref
    return doc, ref


def test_is_parent_access_revoked_when_deadline_passed():
    now = datetime.now(timezone.utc)
    snapshot = _build_snapshot(now, grace_end_new=now - timedelta(minutes=1))
    profile = {
        "ageGroup": "adult",
        "termsAgreement": {"termId": "t1", "agreedAt": now - timedelta(days=20)},
    }

    assert is_parent_access_revoked(profile, snapshot, now) is True


def test_is_parent_access_revoked_when_deadline_not_passed():
    now = datetime.now(timezone.utc)
    snapshot = _build_snapshot(now, grace_end_new=now + timedelta(days=1))
    profile = {
        "ageGroup": "adult",
        "termsAgreement": {"termId": "t1", "agreedAt": now - timedelta(days=20)},
    }

    assert is_parent_access_revoked(profile, snapshot, now) is False


def test_detach_parent_from_children_updates_profiles():
    now = datetime.now(timezone.utc)
    child1, ref1 = _doc(
        "child1",
        {
            "ageGroup": "child",
            "parents": [{"uid": "p1"}, {"uid": "p2"}],
            "parentUids": ["p1", "p2"],
            "parentUid": "p1",
            "parent": {"uid": "p1"},
        },
    )
    child2, ref2 = _doc(
        "child2",
        {
            "ageGroup": "child",
            "parents": [{"uid": "p1"}],
            "parentUids": ["p1"],
            "parentUid": "p1",
            "parent": {"uid": "p1"},
        },
    )
    adult, ref3 = _doc("adult1", {"ageGroup": "adult", "parentUids": ["p1"]})

    q1 = MagicMock()
    q1.stream.return_value = [child1, child2]
    q2 = MagicMock()
    q2.stream.return_value = [child1, adult]
    coll = MagicMock()
    coll.where.side_effect = [q1, q2]

    with patch("app.services.onboarding_service.firestore.users_collection", return_value=coll):
        updated = detach_parent_from_children("p1", now)

    assert updated == 2
    ref1.set.assert_called_once()
    updates1 = ref1.set.call_args[0][0]
    assert updates1["parentUids"] == ["p2"]
    assert updates1["parents"] == [{"uid": "p2"}]
    assert updates1["parentUid"] == fs.DELETE_FIELD
    assert updates1["parent"] == fs.DELETE_FIELD

    ref2.set.assert_called_once()
    updates2 = ref2.set.call_args[0][0]
    assert updates2["parentUids"] == []
    assert updates2["parents"] == []
    assert updates2["ageGroup"] == fs.DELETE_FIELD
    assert updates2["termsAgreement"] == fs.DELETE_FIELD
    ref3.set.assert_not_called()


def test_get_ready_user_revoked_parent_in_child_context_is_blocked():
    now = datetime.now(timezone.utc)
    snapshot = _build_snapshot(now, grace_end_new=now - timedelta(minutes=1))
    parent_profile = {
        "ageGroup": "adult",
        "termsAgreement": {"termId": "t1", "agreedAt": now - timedelta(days=20)},
    }
    child_profile = {
        "ageGroup": "child",
        "parents": [{"uid": "p1"}],
        "parentUids": ["p1"],
    }

    parent_snap = MagicMock()
    parent_snap.exists = True
    parent_snap.to_dict.return_value = parent_profile
    child_snap = MagicMock()
    child_snap.exists = True
    child_snap.to_dict.return_value = child_profile

    def _user_doc(uid: str):
        ref = MagicMock()
        ref.get.return_value = parent_snap if uid == "p1" else child_snap
        return ref

    request = SimpleNamespace(headers={"X-Child-Id": "c1"}, state=SimpleNamespace())
    user = AuthResult(uid="p1", email="p1@example.com", display_name=None, photo_url=None)

    with patch("app.api.deps.load_terms_snapshot", return_value=snapshot), \
         patch("app.api.deps.firestore.user_doc", side_effect=_user_doc), \
         patch("app.api.deps.detach_parent_from_children") as detach:
        with pytest.raises(AppError) as exc:
            get_ready_user(request, user)

    assert exc.value.status_code == 403
    assert exc.value.details.get("state") == "needsAge"
    detach.assert_called_once()
