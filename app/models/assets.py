from typing import Optional
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.limits import MAX_AMOUNT, MIN_AMOUNT, MAX_MEMO_LENGTH, MAX_NAME_LENGTH


class AssetBase(BaseModel):
    name: str = Field(..., max_length=MAX_NAME_LENGTH)
    type: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    currency: str = "JPY"
    isActive: bool = True
    initialBalance: int = Field(0, ge=MIN_AMOUNT, le=MAX_AMOUNT)
    currentBalance: int = 0
    note: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    sortOrder: int = 0


class AssetCreate(BaseModel):
    name: str = Field(..., max_length=MAX_NAME_LENGTH)
    type: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    initialBalance: int = Field(0, ge=MIN_AMOUNT, le=MAX_AMOUNT)
    note: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    sortOrder: int = 0


class AssetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    type: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    initialBalance: Optional[int] = Field(None, ge=MIN_AMOUNT, le=MAX_AMOUNT)
    note: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    sortOrder: Optional[int] = None
    isActive: Optional[bool] = None


class AssetOut(AssetBase):
    id: str
    createdAt: datetime
    updatedAt: datetime
