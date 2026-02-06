from datetime import datetime, timezone

from app.api.routes_transactions import _is_not_modified


def test_is_not_modified_false_when_same_second():
    ims = datetime(2026, 2, 6, 12, 0, 0, tzinfo=timezone.utc)
    last_modified = datetime(2026, 2, 6, 12, 0, 0, 500000, tzinfo=timezone.utc)

    assert _is_not_modified(last_modified, ims) is False


def test_is_not_modified_false_when_equal_second_without_microseconds():
    ims = datetime(2026, 2, 6, 12, 0, 0, tzinfo=timezone.utc)
    last_modified = datetime(2026, 2, 6, 12, 0, 0, tzinfo=timezone.utc)

    assert _is_not_modified(last_modified, ims) is False


def test_is_not_modified_true_when_last_modified_is_older():
    ims = datetime(2026, 2, 6, 12, 0, 0, tzinfo=timezone.utc)
    last_modified = datetime(2026, 2, 6, 11, 59, 59, tzinfo=timezone.utc)

    assert _is_not_modified(last_modified, ims) is True

