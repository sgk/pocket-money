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


def get_settings() -> Settings:
    return Settings(
        google_cloud_project=os.getenv("GOOGLE_CLOUD_PROJECT", ""),
        firestore_database=os.getenv("FIRESTORE_DATABASE", "(default)"),
        google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
        dev_user_id=os.getenv("DEV_USER_ID", ""),
    )
