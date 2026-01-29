from fastapi import Depends, Request

from app.core.auth import authenticate


def get_current_user(request: Request, user=Depends(authenticate)):
    request.state.user = user
    return user
