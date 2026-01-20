from typing import Optional
from datetime import datetime

from pydantic import BaseModel, Field


class AssetBase(BaseModel):
    name: str
    type: Optional[str] = None
    currency: str = "JPY"
    isActive: bool = True
    initialBalance: int = 0
    currentBalance: int = 0
    note: Optional[str] = None
    sortOrder: int = 0


class AssetCreate(BaseModel):
    name: str
    type: Optional[str] = None
    initialBalance: int = 0
    note: Optional[str] = None
    sortOrder: int = 0


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    note: Optional[str] = None
    sortOrder: Optional[int] = None
    isActive: Optional[bool] = None


class AssetOut(AssetBase):
    id: str
    createdAt: datetime
    updatedAt: datetime
