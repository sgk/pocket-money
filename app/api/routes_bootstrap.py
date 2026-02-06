from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from google.cloud.firestore_v1 import FieldFilter

from app.api.deps import get_ready_user
from app.core import firestore
from app.core.errors import AppError


router = APIRouter(prefix="/api", tags=["bootstrap"])


@router.post("/bootstrap")
def bootstrap(request: Request, response: Response, user=Depends(get_ready_user)):
    response.headers["Vary"] = "X-Child-Id"
    uid = user.uid
    profile_snap = firestore.user_doc(uid).get()
    if not profile_snap.exists:
        raise AppError(404, "Profile not found")
    now = datetime.now(timezone.utc)
    updates = {"updatedAt": now}
    if user.display_name:
        updates["displayName"] = user.display_name
    if user.email:
        updates["email"] = user.email
    if user.photo_url:
        updates["photoUrl"] = user.photo_url
    profile = profile_snap.to_dict()
    parent_uids: set[str] = set()
    parents = profile.get("parents")
    if isinstance(parents, list):
        for parent in parents:
            if isinstance(parent, dict) and parent.get("uid"):
                parent_uids.add(parent["uid"])
    legacy_parent = profile.get("parent")
    if isinstance(legacy_parent, dict) and legacy_parent.get("uid"):
        parent_uids.add(legacy_parent["uid"])
    if profile.get("parentUid"):
        parent_uids.add(profile["parentUid"])

    parent_profiles: dict[str, dict] = {}
    if parent_uids:
        refs = [firestore.user_doc(parent_uid) for parent_uid in parent_uids]
        for snap in firestore.get_client().get_all(refs):
            if not snap.exists:
                continue
            parent_data = snap.to_dict() or {}
            parent_profiles[snap.id] = {
                "email": parent_data.get("email"),
                "displayName": parent_data.get("displayName"),
                "photoUrl": parent_data.get("photoUrl"),
            }

    parents_changed = False
    if isinstance(parents, list):
        enriched_parents = []
        for parent in parents:
            if not isinstance(parent, dict):
                enriched_parents.append(parent)
                continue
            parent_uid = parent.get("uid")
            source = parent_profiles.get(parent_uid) if parent_uid else None
            if not source:
                enriched_parents.append(parent)
                continue
            enriched_parent = dict(parent)
            if source.get("email") is not None:
                enriched_parent["email"] = source["email"]
            if source.get("displayName") is not None:
                enriched_parent["displayName"] = source["displayName"]
            if source.get("photoUrl") is not None:
                enriched_parent["photoUrl"] = source["photoUrl"]
            if enriched_parent != parent:
                parents_changed = True
            enriched_parents.append(enriched_parent)
        if parents_changed:
            profile["parents"] = enriched_parents
            updates["parents"] = enriched_parents

    if isinstance(legacy_parent, dict):
        parent_uid = legacy_parent.get("uid")
        source = parent_profiles.get(parent_uid) if parent_uid else None
        if source:
            enriched_parent = dict(legacy_parent)
            if source.get("email") is not None:
                enriched_parent["email"] = source["email"]
            if source.get("displayName") is not None:
                enriched_parent["displayName"] = source["displayName"]
            if source.get("photoUrl") is not None:
                enriched_parent["photoUrl"] = source["photoUrl"]
            if enriched_parent != legacy_parent:
                profile["parent"] = enriched_parent
                updates["parent"] = enriched_parent

    if not profile.get("colorTheme"):
        updates["colorTheme"] = "cream"
    if len(updates) > 1:
        firestore.user_doc(uid).set(updates, merge=True)
        profile.update(updates)
    assets = []
    for doc in firestore.assets_collection(uid).stream():
        data = doc.to_dict()
        data["id"] = doc.id
        assets.append(data)
    categories = []
    for doc in firestore.categories_collection(uid).stream():
        data = doc.to_dict()
        data["id"] = doc.id
        categories.append(data)

    auth_user = getattr(request.state, "auth_user", user)
    auth_profile_snap = firestore.user_doc(auth_user.uid).get()
    auth_profile = auth_profile_snap.to_dict() if auth_profile_snap.exists else {}
    auth_profile_response = {
        "uid": auth_user.uid,
        "displayName": auth_profile.get("displayName") or auth_user.display_name,
        "email": auth_profile.get("email") or auth_user.email,
        "photoUrl": auth_profile.get("photoUrl") or auth_user.photo_url,
    }

    children = []
    if auth_profile.get("ageGroup") == "adult":
        # Legacy query
        child_docs_legacy = (
            firestore.users_collection()
            .where(filter=FieldFilter("parentUid", "==", auth_user.uid))
            .stream()
        )
        # New query
        child_docs_new = (
            firestore.users_collection()
            .where(filter=FieldFilter("parentUids", "array_contains", auth_user.uid))
            .stream()
        )

        seen_uids = set()
        for doc in child_docs_legacy:
            if doc.id in seen_uids: continue
            child_data = doc.to_dict()
            if child_data.get("ageGroup") == "child":
                children.append({
                    "uid": doc.id,
                    "displayName": child_data.get("displayName"),
                    "photoUrl": child_data.get("photoUrl"),
                    "grade": child_data.get("grade"),
                })
                seen_uids.add(doc.id)

        for doc in child_docs_new:
            if doc.id in seen_uids: continue
            child_data = doc.to_dict()
            if child_data.get("ageGroup") == "child":
                children.append({
                    "uid": doc.id,
                    "displayName": child_data.get("displayName"),
                    "photoUrl": child_data.get("photoUrl"),
                    "grade": child_data.get("grade"),
                })
                seen_uids.add(doc.id)

    return {
        "profile": profile,
        "authProfile": auth_profile_response,
        "assets": assets,
        "categories": categories,
        "children": children,
        "isParent": getattr(request.state, "is_parent_viewing_child", False),
    }
