from datetime import datetime, timezone

from fastapi import Depends, Request

from app.core.auth import authenticate
from app.core import firestore
from app.core.errors import AppError
from app.core.terms import load_terms_snapshot
from app.services.account_state import ACCOUNT_STATE_READY, resolve_account_state
from app.services.onboarding_service import (
    check_child_access,
    detach_parent_from_children,
    is_parent_access_revoked,
)


def get_current_user(request: Request, user=Depends(authenticate)):
    request.state.user = user
    return user


def get_ready_user(request: Request, user=Depends(authenticate)):
    request.state.user = user
    request.state.auth_user = user
    uid = user.uid
    child_id = request.headers.get("X-Child-Id")
    is_parent_viewing_child = False
    auth_profile = None

    if child_id:
        auth_profile_snap = firestore.user_doc(user.uid).get()
        auth_profile = auth_profile_snap.to_dict() if auth_profile_snap.exists else None
        child_profile_snap = firestore.user_doc(child_id).get()
        if not child_profile_snap.exists:
            raise AppError(404, "Child profile not found")
        profile = child_profile_snap.to_dict()
        parent_uids = profile.get("parentUids") or []
        if user.uid != profile.get("parentUid") and user.uid not in parent_uids:
            raise AppError(403, "Not authorized to access this child data")
        uid = child_id
        is_parent_viewing_child = True
    else:
        profile_snap = firestore.user_doc(uid).get()
        profile = profile_snap.to_dict() if profile_snap.exists else None
        auth_profile = profile

    now = datetime.now(timezone.utc)
    terms_snapshot = load_terms_snapshot(now)
    if is_parent_access_revoked(auth_profile, terms_snapshot, now):
        detach_parent_from_children(user.uid, now)
        parent_state = resolve_account_state(auth_profile, terms_snapshot, now)
        raise AppError(403, "Account not ready", {"state": parent_state})
    if not check_child_access(profile, terms_snapshot, now):
        raise AppError(403, "Child access revoked", {"state": "needsAge"})
    state = resolve_account_state(profile, terms_snapshot, now)
    if state != ACCOUNT_STATE_READY:
        raise AppError(403, "Account not ready", {"state": state})

    request.state.profile = profile
    request.state.is_parent_viewing_child = is_parent_viewing_child

    if is_parent_viewing_child:
        # Return a modified user object so that subsequent services use the child's UID
        from app.core.auth import AuthResult

        return AuthResult(
            uid=uid,
            email=profile.get("email"),
            display_name=profile.get("displayName"),
            photo_url=profile.get("photoUrl"),
        )

    return user


def get_parent_user(user=Depends(authenticate)):
    from app.core.config import get_settings

    settings = get_settings()
    if settings.dev_user_id and user.uid == settings.dev_user_id:
        return user

    profile_snap = firestore.user_doc(user.uid).get()
    if not profile_snap.exists:
        raise AppError(404, "Profile not found")
    profile = profile_snap.to_dict()
    if profile.get("ageGroup") != "adult":
        raise AppError(403, "Only adult can perform this action")
    return user


def get_export_user(request: Request, user=Depends(authenticate)):
    request.state.user = user
    request.state.auth_user = user

    child_id = request.headers.get("X-Child-Id")
    if not child_id or child_id == user.uid:
        return user

    child_profile_snap = firestore.user_doc(child_id).get()
    if not child_profile_snap.exists:
        raise AppError(404, "Child profile not found")
    profile = child_profile_snap.to_dict() or {}
    parent_uids = profile.get("parentUids") or []
    if user.uid != profile.get("parentUid") and user.uid not in parent_uids:
        raise AppError(403, "Not authorized to access this child data")

    request.state.profile = profile
    request.state.is_parent_viewing_child = True

    from app.core.auth import AuthResult

    return AuthResult(
        uid=child_id,
        email=profile.get("email"),
        display_name=profile.get("displayName"),
        photo_url=profile.get("photoUrl"),
    )
