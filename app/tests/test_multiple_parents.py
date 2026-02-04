from datetime import datetime, timezone, timedelta
import pytest
from app.services.onboarding_service import check_child_access, build_profile, seed_defaults
from app.services.account_state import resolve_account_state, ACCOUNT_STATE_READY
from app.core.terms import TermsSnapshot, Terms
from unittest.mock import MagicMock, patch

NOW = datetime.now(timezone.utc)

@pytest.fixture
def mock_snapshot():
    terms = Terms(
        term_id="t1",
        title="Terms 1",
        body="Body 1",
        display_start=NOW - timedelta(days=1),
        grace_end=NOW + timedelta(days=1)
    )
    return TermsSnapshot(terms=[terms], terms_by_id={"t1": terms})

def test_check_child_access_multiple_parents(mock_snapshot):
    # Case: One valid parent, one invalid parent
    profile = {
        "ageGroup": "child",
        "parentUids": ["parent1", "parent2"]
    }

    with patch("app.core.firestore.user_doc") as mock_user_doc:
        # Mocking the two separate calls for parent1 and parent2
        mock_snap1 = MagicMock()
        mock_snap1.exists = True
        mock_snap1.to_dict.return_value = {"ageGroup": "adult", "termsAgreement": None}

        mock_snap2 = MagicMock()
        mock_snap2.exists = True
        mock_snap2.to_dict.return_value = {"ageGroup": "adult", "termsAgreement": {"termId": "t1", "agreedAt": NOW, "agreedByUid": "parent2"}}

        mock_user_doc.side_effect = lambda uid: MagicMock(get=lambda: mock_snap1 if uid == "parent1" else mock_snap2)

        assert check_child_access(profile, mock_snapshot, NOW) is True

def test_check_child_access_no_valid_parents(mock_snapshot):
    profile = {
        "ageGroup": "child",
        "parentUids": ["parent1"]
    }
    with patch("app.core.firestore.user_doc") as mock_user_doc:
        mock_snap = MagicMock()
        mock_snap.exists = True
        mock_snap.to_dict.return_value = {"ageGroup": "adult", "termsAgreement": None}
        mock_user_doc.return_value.get.return_value = mock_snap

        assert check_child_access(profile, mock_snapshot, NOW) is False

def test_resolve_account_state_multiple_parents(mock_snapshot):
    profile = {
        "ageGroup": "child",
        "parents": [{"uid": "p1"}]
    }
    assert resolve_account_state(profile, mock_snapshot, NOW) == ACCOUNT_STATE_READY

def test_build_profile_initializes_lists():
    class MockUser:
        uid = "child1"
        display_name = "Child"
        email = "child@example.com"
        photo_url = None

    parent_info = {"uid": "p1", "email": "p1@example.com", "displayName": "Parent"}
    profile = build_profile(MockUser(), NOW, "child", None, parent_info)

    assert profile["parentUid"] == "p1"
    assert profile["parentUids"] == ["p1"]
    assert profile["parent"] == parent_info
    assert profile["parents"] == [parent_info]
    assert profile["grade"] == "grade1"

def test_build_profile_adult():
    class MockUser:
        uid = "adult1"
        display_name = "Adult"
        email = "adult@example.com"
        photo_url = None

    profile = build_profile(MockUser(), NOW, "adult", None, None)
    assert profile["grade"] == "upper"

def test_seed_defaults_names():
    mock_transaction = MagicMock()

    with patch("app.core.firestore.assets_collection") as mock_assets_coll, \
         patch("app.core.firestore.categories_collection") as mock_categories_coll:

        # Test Adult
        seed_defaults(mock_transaction, "u1", NOW, age_group="adult")
        args, kwargs = mock_transaction.set.call_args_list[0]
        assert args[1]["name"] == "お財布"

        mock_transaction.set.reset_mock()

        # Test Child
        seed_defaults(mock_transaction, "u2", NOW, age_group="child")
        args, kwargs = mock_transaction.set.call_args_list[0]
        assert args[1]["name"] == "おさいふ"
