from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core import firestore


router = APIRouter(prefix="/api", tags=["bootstrap"])


DEFAULT_CATEGORIES = [
    {"name": "Food", "sortOrder": 1},
    {"name": "Transport", "sortOrder": 2},
    {"name": "Salary", "sortOrder": 3},
]


@router.post("/bootstrap")
def bootstrap(user=Depends(get_current_user)):
    uid = user.uid

    def _work(transaction):
        now = datetime.now(timezone.utc)
        user_ref = firestore.user_doc(uid)
        user_snap = user_ref.get(transaction=transaction)

        if not user_snap.exists:
            profile = {
                "createdAt": now,
                "updatedAt": now,
                "displayName": user.display_name,
                "email": user.email,
                "currency": "JPY",
                "settings": {"timezone": "Asia/Tokyo"},
            }
            transaction.set(user_ref, profile)

            asset_ref = firestore.assets_collection(uid).document()
            transaction.set(
                asset_ref,
                {
                    "name": "Wallet",
                    "type": "cash",
                    "currency": "JPY",
                    "isActive": True,
                    "initialBalance": 0,
                    "currentBalance": 0,
                    "note": None,
                    "sortOrder": 1,
                    "createdAt": now,
                    "updatedAt": now,
                },
            )

            for cat in DEFAULT_CATEGORIES:
                cat_ref = firestore.categories_collection(uid).document()
                transaction.set(
                    cat_ref,
                    {
                        "name": cat["name"],
                        "isActive": True,
                        "sortOrder": cat["sortOrder"],
                        "createdAt": now,
                        "updatedAt": now,
                    },
                )

        return True

    firestore.run_in_transaction(_work)

    profile = firestore.user_doc(uid).get().to_dict()
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

    return {"profile": profile, "assets": assets, "categories": categories}
