from datetime import datetime, timezone

from google.cloud import firestore as fs

from app.core import firestore
from app.core.auth import AuthResult
from app.core.errors import AppError
from app.core.terms import Terms, TermsSnapshot, resolve_agreed_terms, resolve_effective_deadline


DEFAULT_CATEGORIES = [
    {"name": "\u305f\u3079\u3082\u306e", "sortOrder": 1, "kind": "expense"},
    {"name": "\u306e\u308a\u3082\u306e", "sortOrder": 2, "kind": "expense"},
    {"name": "\u3076\u3093\u307c\u3046\u3050", "sortOrder": 3, "kind": "expense"},
    {"name": "\u304a\u3053\u3065\u304b\u3044", "sortOrder": 10, "kind": "income"},
]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(value: str) -> str:
    return value.strip().lower()


def invite_doc_id(child_email: str, parent_email: str) -> str:
    return f"{child_email}__{parent_email}"


def build_terms_agreement(terms: Terms, agreed_at: datetime, agreed_by_uid: str) -> dict:
    return {
        "termId": terms.term_id,
        "agreedAt": agreed_at,
        "agreedByUid": agreed_by_uid,
    }


def build_profile(
    user: AuthResult,
    now: datetime,
    age_group: str,
    terms_agreement: dict | None,
    parent: dict | None,
) -> dict:
    if age_group not in ("adult", "child"):
        raise AppError(400, "Invalid age group")

    profile = {
        "createdAt": now,
        "updatedAt": now,
        "transactionsUpdatedAt": now,
        "displayName": user.display_name,
        "email": user.email,
        "photoUrl": user.photo_url,
        "currency": "JPY",
        "settings": {"timezone": "Asia/Tokyo"},
        "ageGroup": age_group,
    }
    if terms_agreement:
        profile["termsAgreement"] = terms_agreement
    if parent:
        profile["parent"] = parent
        profile["parents"] = [parent]
        parent_uid = parent.get("uid")
        if parent_uid:
            profile["parentUid"] = parent_uid
            profile["parentUids"] = [parent_uid]
    return profile


def seed_defaults(transaction: fs.Transaction, uid: str, now: datetime) -> None:
    asset_ref = firestore.assets_collection(uid).document()
    transaction.set(
        asset_ref,
        {
            "name": "\u304a\u3055\u3044\u3075",
            "type": "\u3052\u3093\u304d\u3093",
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
                "kind": cat["kind"],
                "createdAt": now,
                "updatedAt": now,
            },
        )


def require_user_email(user: AuthResult) -> str:
    if not user.email:
        raise AppError(400, "Email is required")
    return normalize_email(user.email)


def check_child_access(
    profile: dict | None,
    snapshot: TermsSnapshot,
    now: datetime,
) -> bool:
    if not profile or profile.get("ageGroup") != "child":
        return True

    parent_uids = profile.get("parentUids") or []
    if not parent_uids and profile.get("parentUid"):
        parent_uids = [profile.get("parentUid")]

    if not parent_uids:
        return False

    for parent_uid in parent_uids:
        parent_snap = firestore.user_doc(parent_uid).get()
        if not parent_snap.exists:
            continue
        parent_profile = parent_snap.to_dict() or {}
        if parent_profile.get("ageGroup") != "adult":
            continue
        parent_terms = parent_profile.get("termsAgreement")
        if not parent_terms:
            continue
        try:
            agreed_terms = resolve_agreed_terms(parent_terms, snapshot)
        except AppError:
            continue
        deadline = resolve_effective_deadline(snapshot.terms, agreed_terms, now)
        if not deadline or now < deadline:
            return True

    return False
