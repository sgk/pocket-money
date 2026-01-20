from fastapi import Depends

from app.core.auth import authenticate


def get_current_user(user=Depends(authenticate)):
    return user
