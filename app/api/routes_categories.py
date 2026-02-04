from typing import List

from fastapi import APIRouter, Depends, Response

from app.api.deps import get_ready_user
from app.models.categories import CategoryCreate, CategoryOut, CategoryUpdate
from app.services import categories_service


router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=List[CategoryOut])
def list_categories(response: Response, user=Depends(get_ready_user)):
    response.headers["Vary"] = "X-Child-Id"
    return categories_service.list_categories(user.uid)


@router.post("", response_model=CategoryOut)
def create_category(payload: CategoryCreate, user=Depends(get_ready_user)):
    return categories_service.create_category(user.uid, payload)


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: str, payload: CategoryUpdate, user=Depends(get_ready_user)
):
    return categories_service.update_category(user.uid, category_id, payload)


@router.delete("/{category_id}", response_model=CategoryOut)
def delete_category(category_id: str, user=Depends(get_ready_user)):
    return categories_service.delete_category(user.uid, category_id)
