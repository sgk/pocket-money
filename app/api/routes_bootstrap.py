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

    children = []
    if auth_profile.get("ageGroup") == "adult":
        child_docs = (
            firestore.users_collection()
            .where(filter=FieldFilter("parentUid", "==", auth_user.uid))
            .stream()
        )
        for doc in child_docs:
            child_data = doc.to_dict()
            if child_data.get("ageGroup") == "child":
                children.append(
                    {
                        "uid": doc.id,
                        "displayName": child_data.get("displayName"),
                        "photoUrl": child_data.get("photoUrl"),
                        "grade": child_data.get("grade"),
                    }
                )

    return {
        "profile": profile,
        "assets": assets,
        "categories": categories,
        "children": children,
        "isParent": getattr(request.state, "is_parent_viewing_child", False),
    }
