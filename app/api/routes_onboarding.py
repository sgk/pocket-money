from fastapi import APIRouter, Depends
from google.cloud import firestore as fs
from pydantic import BaseModel

from app.core import firestore
from app.core.auth import authenticate
from app.core.errors import AppError
from app.core.terms import (
    TermsSnapshot,
    ensure_terms_can_agree,
    load_terms_snapshot,
    resolve_agreed_terms,
    resolve_effective_deadline,
    select_display_terms,
    select_pending_terms,
    terms_payload,
)
from app.services.account_state import resolve_account_state
from app.services.onboarding_service import (
    build_profile,
    build_terms_agreement,
    check_child_access,
    invite_doc_id,
    normalize_email,
    now_utc,
    require_user_email,
    seed_defaults,
)


router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


class AgreeTermsRequest(BaseModel):
    ageGroup: str | None = None


class AcceptInviteRequest(BaseModel):
    parentEmail: str


@router.get("/status")
def onboarding_status(user=Depends(authenticate)):
    profile_snap = firestore.user_doc(user.uid).get()
    profile = profile_snap.to_dict() if profile_snap.exists else None
    now = now_utc()
    snapshot = load_terms_snapshot(now)
    if profile and profile.get("ageGroup") == "child":
        if not check_child_access(profile, snapshot, now):
            profile = None
    agreed_terms = _resolve_agreed_terms(profile, snapshot)
    deadline = (
        resolve_effective_deadline(snapshot.terms, agreed_terms, now)
        if agreed_terms
        else None
    )
    pending_terms = select_pending_terms(snapshot.terms, agreed_terms, now)
    display_terms = pending_terms or agreed_terms or select_display_terms(snapshot.terms, now)
    if not display_terms:
        raise AppError(500, "Terms not available")
    state = resolve_account_state(profile, snapshot, now)
    return {
        "state": state,
        "terms": terms_payload(display_terms),
        "profile": profile,
        "agreedTerms": terms_payload(agreed_terms) if agreed_terms else None,
        "effectiveDeadline": deadline.isoformat() if deadline else None,
    }


@router.post("/agree-terms")
def agree_terms(body: AgreeTermsRequest, user=Depends(authenticate)):
    now = now_utc()
    snapshot = load_terms_snapshot(now)

    def _work(transaction):
        user_ref = firestore.user_doc(user.uid)
        snap = user_ref.get(transaction=transaction)
        profile = snap.to_dict() if snap.exists else None
        agreement = profile.get("termsAgreement") if profile else None
        agreed_terms = resolve_agreed_terms(agreement, snapshot) if agreement else None
        pending_terms = select_pending_terms(snapshot.terms, agreed_terms, now)
        if not pending_terms:
            raise AppError(400, "No terms to agree")
        ensure_terms_can_agree(agreed_terms, pending_terms, now)
        agreement = build_terms_agreement(pending_terms, now, user.uid)
        if not snap.exists:
            if body.ageGroup != "adult":
                raise AppError(400, "Age group required")
            require_user_email(user)
            profile = build_profile(user, now, "adult", agreement, None)
            transaction.set(user_ref, profile)
            seed_defaults(transaction, user.uid, now)
            return profile

        age_group = profile.get("ageGroup") or body.ageGroup
        if age_group != "adult":
            raise AppError(400, "Only adult can agree")
        updates = {"termsAgreement": agreement, "updatedAt": now}
        if not profile.get("ageGroup"):
            updates["ageGroup"] = "adult"
        if user.display_name:
            updates["displayName"] = user.display_name
        if user.email:
            updates["email"] = user.email
        if user.photo_url:
            updates["photoUrl"] = user.photo_url
        transaction.set(user_ref, updates, merge=True)
        profile.update(updates)
        return profile

    profile = firestore.run_in_transaction(_work)
    state = resolve_account_state(profile, snapshot, now)
    agreed_terms = (
        resolve_agreed_terms(profile.get("termsAgreement"), snapshot)
        if profile and profile.get("termsAgreement")
        else None
    )
    deadline = (
        resolve_effective_deadline(snapshot.terms, agreed_terms, now)
        if agreed_terms
        else None
    )
    pending_terms = select_pending_terms(snapshot.terms, agreed_terms, now)
    display_terms = pending_terms or agreed_terms or select_display_terms(snapshot.terms, now)
    if not display_terms:
        raise AppError(500, "Terms not available")
    return {
        "state": state,
        "terms": terms_payload(display_terms),
        "profile": profile,
        "agreedTerms": terms_payload(agreed_terms) if agreed_terms else None,
        "effectiveDeadline": deadline.isoformat() if deadline else None,
    }


@router.post("/accept-invite")
def accept_invite(body: AcceptInviteRequest, user=Depends(authenticate)):
    now = now_utc()
    snapshot = load_terms_snapshot(now)
    child_email = require_user_email(user)
    parent_email = normalize_email(body.parentEmail)
    if not parent_email:
        raise AppError(400, "Parent email is required")
    invite_id = invite_doc_id(child_email, parent_email)

    def _work(transaction):
        invite_ref = firestore.invite_doc(invite_id)
        invite_snap = invite_ref.get(transaction=transaction)
        if not invite_snap.exists:
            raise AppError(403, "Invitation not found")
        invite = invite_snap.to_dict()
        if invite.get("revokedAt"):
            raise AppError(403, "Invitation revoked")
        if invite.get("usedAt"):
            raise AppError(403, "Invitation already used")
        parent_uid = invite.get("parentUid")
        if not parent_uid:
            raise AppError(403, "Invalid invitation")

        parent_ref = firestore.user_doc(parent_uid)
        parent_snap = parent_ref.get(transaction=transaction)
        if not parent_snap.exists:
            raise AppError(403, "Parent account not found")
        parent_profile = parent_snap.to_dict()
        if parent_profile.get("ageGroup") != "adult":
            raise AppError(403, "Parent must be adult")
        parent_terms = parent_profile.get("termsAgreement")
        if not parent_terms:
            raise AppError(403, "Parent terms missing")
        try:
            agreed_terms = resolve_agreed_terms(parent_terms, snapshot)
        except AppError:
            raise AppError(403, "Parent terms invalid")
        deadline = resolve_effective_deadline(snapshot.terms, agreed_terms, now)
        if deadline and now >= deadline:
            raise AppError(403, "Parent terms outdated")
        agreed_at = parent_terms.get("agreedAt") if parent_terms else None
        if not agreed_at:
            raise AppError(403, "Parent agreedAt missing")

        parent_info = {
            "uid": parent_uid,
            "email": parent_profile.get("email"),
            "displayName": parent_profile.get("displayName"),
        }
        user_ref = firestore.user_doc(user.uid)
        user_snap = user_ref.get(transaction=transaction)
        if user_snap.exists:
            existing = user_snap.to_dict()
            if existing.get("ageGroup") and existing.get("ageGroup") != "child":
                raise AppError(400, "Invalid age group")
            if existing.get("termsAgreement"):
                existing_terms = resolve_agreed_terms(existing.get("termsAgreement"), snapshot)
                ensure_terms_can_agree(existing_terms, agreed_terms, now)
            updates = {
                "ageGroup": "child",
                "parent": parent_info,
                "parentUid": parent_uid,
                "updatedAt": now,
            }
            if user.display_name:
                updates["displayName"] = user.display_name
            if user.email:
                updates["email"] = user.email
            if user.photo_url:
                updates["photoUrl"] = user.photo_url
            if not existing.get("createdAt"):
                updates["createdAt"] = now
            if not existing.get("transactionsUpdatedAt"):
                updates["transactionsUpdatedAt"] = now
            if not existing.get("currency"):
                updates["currency"] = "JPY"
            if not existing.get("settings"):
                updates["settings"] = {"timezone": "Asia/Tokyo"}
            transaction.set(user_ref, updates, merge=True)
            profile = {**existing, **updates}
        else:
            profile = build_profile(user, now, "child", None, parent_info)
            transaction.set(user_ref, profile)
            seed_defaults(transaction, user.uid, now)

        transaction.set(
            invite_ref,
            {"usedAt": now, "childUid": user.uid},
            merge=True,
        )
        return profile

    profile = firestore.run_in_transaction(_work)
    state = resolve_account_state(profile, snapshot, now)
    agreed_terms = (
        resolve_agreed_terms(profile.get("termsAgreement"), snapshot)
        if profile and profile.get("termsAgreement")
        else None
    )
    deadline = (
        resolve_effective_deadline(snapshot.terms, agreed_terms, now)
        if agreed_terms
        else None
    )
    pending_terms = select_pending_terms(snapshot.terms, agreed_terms, now)
    display_terms = pending_terms or agreed_terms or select_display_terms(snapshot.terms, now)
    if not display_terms:
        raise AppError(500, "Terms not available")
    return {
        "state": state,
        "terms": terms_payload(display_terms),
        "profile": profile,
        "agreedTerms": terms_payload(agreed_terms) if agreed_terms else None,
        "effectiveDeadline": deadline.isoformat() if deadline else None,
    }


@router.post("/withdraw-terms", status_code=204)
def withdraw_terms(user=Depends(authenticate)):
    now = now_utc()

    def _work(transaction):
        user_ref = firestore.user_doc(user.uid)
        snap = user_ref.get(transaction=transaction)
        if not snap.exists:
            raise AppError(404, "Profile not found")
        updates = {
            "ageGroup": fs.DELETE_FIELD,
            "termsAgreement": fs.DELETE_FIELD,
            "parent": fs.DELETE_FIELD,
            "parentUid": fs.DELETE_FIELD,
            "updatedAt": now,
        }
        transaction.set(user_ref, updates, merge=True)
        return True

    firestore.run_in_transaction(_work)


def _resolve_agreed_terms(profile: dict | None, snapshot: TermsSnapshot) -> object | None:
    if not profile:
        return None
    agreement = profile.get("termsAgreement")
    if not agreement:
        return None
    return resolve_agreed_terms(agreement, snapshot)
