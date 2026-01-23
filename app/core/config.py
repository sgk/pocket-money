import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    google_cloud_project: str
    firestore_database: str
    google_client_id: str
    dev_user_id: str
    session_secret: str
    session_expire_days: int


def get_settings() -> Settings:
    session_expire_raw = os.getenv("SESSION_EXPIRE_DAYS", "7")
    try:
        session_expire_days = int(session_expire_raw)
    except ValueError as exc:
        raise ValueError("SESSION_EXPIRE_DAYS must be integer") from exc
    return Settings(
        google_cloud_project=os.getenv("GOOGLE_CLOUD_PROJECT", ""),
        firestore_database=os.getenv("FIRESTORE_DATABASE", "(default)"),
        google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
        dev_user_id=os.getenv("DEV_USER_ID", ""),
        session_secret=os.getenv("SESSION_SECRET", ""),
        session_expire_days=session_expire_days,
    )
