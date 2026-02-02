from datetime import datetime, timezone

from fastapi import Depends, Request

from app.core.auth import authenticate
from app.core import firestore
from app.core.errors import AppError
from app.core.terms import load_terms_snapshot
from app.services.account_state import ACCOUNT_STATE_READY, resolve_account_state
from app.services.onboarding_service import check_child_access


def get_current_user(request: Request, user=Depends(authenticate)):
    request.state.user = user
    return user


def get_ready_user(request: Request, user=Depends(authenticate)):
    request.state.user = user
    profile_snap = firestore.user_doc(user.uid).get()
    profile = profile_snap.to_dict() if profile_snap.exists else None
    now = datetime.now(timezone.utc)
    terms_snapshot = load_terms_snapshot(now)
    if not check_child_access(profile, terms_snapshot, now):
        raise AppError(403, "Child access revoked", {"state": "needsAge"})
    state = resolve_account_state(profile, terms_snapshot, now)
    if state != ACCOUNT_STATE_READY:
        raise AppError(403, "Account not ready", {"state": state})
    request.state.profile = profile
    return user
