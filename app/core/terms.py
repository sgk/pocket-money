from dataclasses import dataclass
from datetime import datetime, timezone

from app.core import firestore
from app.core.errors import AppError


@dataclass(frozen=True)
class Terms:
    term_id: str
    title: str
    body: str
    display_start: datetime
    grace_end: datetime


@dataclass(frozen=True)
class TermsSnapshot:
    terms: list[Terms]
    terms_by_id: dict[str, Terms]


def _require_string(data: dict, key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise AppError(500, f"Terms missing {key}")
    return value.strip()


def _require_datetime(data: dict, key: str) -> datetime:
    value = data.get(key)
    if not isinstance(value, datetime):
        raise AppError(500, f"Terms missing {key}")
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_terms(doc_id: str, data: dict) -> Terms:
    return Terms(
        term_id=doc_id,
        title=_require_string(data, "title"),
        body=_require_string(data, "body"),
        display_start=_require_datetime(data, "displayStartAt"),
        grace_end=_require_datetime(data, "graceEndsAt"),
    )


def _terms_priority(terms: Terms) -> tuple:
    return (terms.grace_end, terms.display_start, terms.term_id)


def list_terms() -> list[Terms]:
    docs = firestore.terms_collection().stream()
    items = []
    for doc in docs:
        data = doc.to_dict()
        if not isinstance(data, dict):
            raise AppError(500, "Terms invalid")
        items.append(_parse_terms(doc.id, data))
    if not items:
        raise AppError(500, "Terms not configured")
    return items


def select_display_terms(terms: list[Terms], now: datetime) -> Terms | None:
    candidates = [item for item in terms if item.display_start <= now]
    if not candidates:
        return None
    return max(candidates, key=_terms_priority)


def load_terms_snapshot(now: datetime) -> TermsSnapshot:
    terms = list_terms()
    return TermsSnapshot(
        terms=terms,
        terms_by_id={item.term_id: item for item in terms},
    )


def get_terms_by_id(term_id: str) -> Terms | None:
    if not term_id:
        return None
    snap = firestore.terms_doc(term_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict()
    return _parse_terms(snap.id, data)


def resolve_agreed_terms(agreement: dict | None, snapshot: TermsSnapshot) -> Terms | None:
    if not agreement:
        return None
    term_id = agreement.get("termId")
    if not term_id:
        raise AppError(500, "Terms id missing")
    agreed = snapshot.terms_by_id.get(term_id)
    if not agreed:
        raise AppError(500, "Terms id not found")
    return agreed


def filter_terms_for_user(
    terms: list[Terms],
    agreed: Terms | None,
    now: datetime,
) -> list[Terms]:
    candidates = [item for item in terms if item.display_start <= now]
    if agreed:
        candidates = [
            item
            for item in candidates
            if item.term_id != agreed.term_id and item.grace_end > agreed.grace_end
        ]
    return candidates


def select_pending_terms(
    terms: list[Terms],
    agreed: Terms | None,
    now: datetime,
) -> Terms | None:
    candidates = filter_terms_for_user(terms, agreed, now)
    if not candidates:
        return None
    return max(candidates, key=_terms_priority)


def resolve_effective_deadline(
    terms: list[Terms],
    agreed: Terms | None,
    now: datetime,
) -> datetime | None:
    candidates = filter_terms_for_user(terms, agreed, now)
    if not candidates:
        return None
    return min(item.grace_end for item in candidates)


def ensure_terms_can_agree(agreed: Terms | None, next_terms: Terms, now: datetime) -> None:
    if next_terms.display_start > now:
        raise AppError(400, "Terms not started")
    if agreed and next_terms.grace_end < agreed.grace_end:
        raise AppError(400, "Cannot agree older terms")


def terms_payload(terms: Terms) -> dict:
    return {
        "termId": terms.term_id,
        "title": terms.title,
        "body": terms.body,
        "displayStartAt": terms.display_start.isoformat(),
        "graceEndsAt": terms.grace_end.isoformat(),
    }
