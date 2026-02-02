from typing import List

from fastapi import APIRouter, Depends

from app.api.deps import get_ready_user
from app.models.assets import AssetCreate, AssetOut, AssetUpdate
from app.services import assets_service


router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("", response_model=List[AssetOut])
def list_assets(user=Depends(get_ready_user)):
    return assets_service.list_assets(user.uid)


@router.post("", response_model=AssetOut)
def create_asset(payload: AssetCreate, user=Depends(get_ready_user)):
    return assets_service.create_asset(user.uid, payload)


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: str, payload: AssetUpdate, user=Depends(get_ready_user)):
    return assets_service.update_asset(user.uid, asset_id, payload)


@router.delete("/{asset_id}", response_model=AssetOut)
def delete_asset(asset_id: str, user=Depends(get_ready_user)):
    return assets_service.deactivate_asset(user.uid, asset_id)
