from fastapi import APIRouter, Depends
from google.cloud import firestore as fs
from google.cloud.firestore_v1 import FieldFilter
from pydantic import BaseModel, Field

from app.api.deps import get_parent_user, get_ready_user
from app.core import firestore
from app.core.errors import AppError
from app.core.limits import MAX_EMAIL_LENGTH
from app.core.terms import load_terms_snapshot, resolve_agreed_terms, resolve_effective_deadline
from app.services.onboarding_service import invite_doc_id, normalize_email, now_utc, require_user_email


router = APIRouter(prefix="/api", tags=["invites"])


class InviteCreateRequest(BaseModel):
    childEmail: str = Field(..., max_length=MAX_EMAIL_LENGTH)


def _active_invites(parent_uid: str):
    docs = firestore.invites_collection().where(
        filter=FieldFilter("parentUid", "==", parent_uid)
    ).stream()
    items = []
    for doc in docs:
        data = doc.to_dict()
        if data.get("revokedAt"):
            continue
        items.append((doc, data))
    return items


def _collect_child_keys(parent_uid: str):
    keys = set()
    invites = _active_invites(parent_uid)
    for _, data in invites:
        key = data.get("childEmail") or data.get("childUid")
        if key:
            keys.add(key)

    child_docs_legacy = firestore.users_collection().where(
        filter=FieldFilter("parentUid", "==", parent_uid)
    ).stream()
    child_docs_new = firestore.users_collection().where(
        filter=FieldFilter("parentUids", "array_contains", parent_uid)
    ).stream()

    seen_ids = set()
    for doc in child_docs_legacy:
        if doc.id in seen_ids: continue
        data = doc.to_dict()
        if data.get("ageGroup") != "child":
            continue
        key = data.get("email") or doc.id
        if key:
            keys.add(key)
        seen_ids.add(doc.id)

    for doc in child_docs_new:
        if doc.id in seen_ids: continue
        data = doc.to_dict()
        if data.get("ageGroup") != "child":
            continue
        key = data.get("email") or doc.id
        if key:
            keys.add(key)
        seen_ids.add(doc.id)
    return keys, invites


@router.get("/invites")
def list_invites(user=Depends(get_parent_user)):
    _, invites = _collect_child_keys(user.uid)
    child_uids = [data.get("childUid") for _, data in invites if data.get("childUid")]
    child_profiles = {}
    if child_uids:
        refs = [firestore.user_doc(uid) for uid in child_uids]
        for snap in firestore.get_client().get_all(refs):
            if not snap.exists:
                continue
            data = snap.to_dict() or {}
            name = data.get("displayName")
            child_profiles[snap.id] = {
                "name": name.strip() if isinstance(name, str) and name.strip() else None,
                "photoUrl": data.get("photoUrl"),
            }
    items = []
    for doc, data in invites:
        child_uid = data.get("childUid")
        child_profile = child_profiles.get(child_uid) if child_uid else None
        items.append(
            {
                "id": doc.id,
                "childEmail": data.get("childEmail"),
                "createdAt": data.get("createdAt"),
                "usedAt": data.get("usedAt"),
                "childUid": child_uid,
                "childName": child_profile.get("name") if child_profile else None,
                "childPhotoUrl": child_profile.get("photoUrl") if child_profile else None,
            }
        )
    items.sort(key=lambda item: item.get("createdAt") or "")
    return {"items": items, "limit": 10}


@router.post("/invites")
def create_invite(body: InviteCreateRequest, user=Depends(get_parent_user)):
    now = now_utc()
    parent_email = require_user_email(user)
    child_email = normalize_email(body.childEmail)
    if not child_email:
        raise AppError(400, "Child email is required")
    if child_email == parent_email:
        raise AppError(400, "Child email must be different")

    parent_snap = firestore.user_doc(user.uid).get()
    parent_profile = parent_snap.to_dict()
    snapshot = load_terms_snapshot(now)
    agreement = parent_profile.get("termsAgreement")
    agreed_terms = resolve_agreed_terms(agreement, snapshot)
    if not agreement or not agreed_terms:
        raise AppError(403, "Parent terms missing")
    deadline = resolve_effective_deadline(snapshot.terms, agreed_terms, now)
    if deadline and now >= deadline:
        raise AppError(403, "Parent terms outdated")
    agreed_at = agreement.get("agreedAt")
    if not agreed_at:
        raise AppError(500, "Parent agreedAt missing")

    keys, _ = _collect_child_keys(user.uid)
    if child_email in keys:
        raise AppError(409, "Child already invited")
    if len(keys) >= 10:
        raise AppError(400, "Child limit reached")

    invite_id = invite_doc_id(child_email, parent_email)
    existing_snap = firestore.invite_doc(invite_id).get()
    if existing_snap.exists:
        existing = existing_snap.to_dict()
        if existing.get("revokedAt") is None:
            if existing.get("usedAt"):
                raise AppError(409, "Child already active")
            raise AppError(409, "Invite already exists")
    firestore.invite_doc(invite_id).set(
        {
            "childEmail": child_email,
            "parentEmail": parent_email,
            "parentUid": user.uid,
            "parentDisplayName": parent_profile.get("displayName"),
            "createdAt": now,
            "termsId": agreed_terms.term_id,
            "parentTermsAgreedAt": agreed_at,
        }
    )
    return {"inviteId": invite_id}


@router.delete("/invites/{invite_id}", status_code=204)
def cancel_invite(invite_id: str, user=Depends(get_parent_user)):
    now = now_utc()

    def _work(transaction):
        invite_ref = firestore.invite_doc(invite_id)
        invite_snap = invite_ref.get(transaction=transaction)
        if not invite_snap.exists:
            raise AppError(404, "Invite not found")
        invite = invite_snap.to_dict()
        if invite.get("parentUid") != user.uid:
            raise AppError(403, "Invalid invite")
        if invite.get("revokedAt"):
            raise AppError(400, "Invite already revoked")

        child_uid = invite.get("childUid")
        if child_uid:
            child_ref = firestore.user_doc(child_uid)
            child_snap = child_ref.get(transaction=transaction)
            if child_snap.exists:
                child_profile = child_snap.to_dict()
                if child_profile.get("ageGroup") == "child":
                    parents = child_profile.get("parents") or []
                    parent_uids = child_profile.get("parentUids") or []

                    new_parents = [p for p in parents if p.get("uid") != user.uid]
                    new_parent_uids = [u for u in parent_uids if u != user.uid]

                    updates = {
                        "parents": new_parents,
                        "parentUids": new_parent_uids,
                        "updatedAt": now,
                    }

                    # Also handle legacy fields if they match the user
                    if child_profile.get("parentUid") == user.uid:
                        updates["parentUid"] = fs.DELETE_FIELD
                        updates["parent"] = fs.DELETE_FIELD

                    # If no parents left, reset age group
                    if not new_parent_uids and (child_profile.get("parentUid") == user.uid or not child_profile.get("parentUid")):
                        updates["ageGroup"] = fs.DELETE_FIELD
                        updates["termsAgreement"] = fs.DELETE_FIELD

                    transaction.set(child_ref, updates, merge=True)

        transaction.set(invite_ref, {"revokedAt": now}, merge=True)
        return True

    firestore.run_in_transaction(_work)
