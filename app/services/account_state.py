from datetime import datetime

from app.core.errors import AppError
from app.core.terms import (
    TermsSnapshot,
    resolve_agreed_terms,
    resolve_effective_deadline,
)


ACCOUNT_STATE_READY = "ready"
ACCOUNT_STATE_NEEDS_AGE = "needsAge"
ACCOUNT_STATE_NEEDS_TERMS = "needsTerms"
ACCOUNT_STATE_NEEDS_PARENT_CONSENT = "needsParentConsent"


def resolve_account_state(
    profile: dict | None,
    snapshot: TermsSnapshot,
    now: datetime,
) -> str:
    if not profile:
        return ACCOUNT_STATE_NEEDS_AGE

    age_group = profile.get("ageGroup")
    if not age_group:
        return ACCOUNT_STATE_NEEDS_AGE
    if age_group not in ("adult", "child"):
        raise AppError(500, "Invalid age group")

    if age_group == "child" and not profile.get("parent"):
        raise AppError(500, "Parent info missing")

    if age_group == "child":
        return ACCOUNT_STATE_READY

    agreed_terms = (
        resolve_agreed_terms(profile.get("termsAgreement"), snapshot)
        if profile.get("termsAgreement")
        else None
    )
    if not agreed_terms:
        return ACCOUNT_STATE_NEEDS_TERMS

    deadline = resolve_effective_deadline(snapshot.terms, agreed_terms, now)
    if deadline and now >= deadline:
        return ACCOUNT_STATE_NEEDS_AGE

    return ACCOUNT_STATE_READY
