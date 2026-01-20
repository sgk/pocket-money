from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TransactionBase(BaseModel):
    type: str
    occurredAt: datetime
    amount: int = Field(..., ge=1)
    memo: Optional[str] = None


class ExpenseCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(..., ge=1)
    memo: Optional[str] = None
    assetId: str
    categoryId: str
    merchant: Optional[str] = None


class IncomeCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(..., ge=1)
    memo: Optional[str] = None
    assetId: str
    categoryId: str
    source: Optional[str] = None


class TransferCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(..., ge=1)
    memo: Optional[str] = None
    fromAssetId: str
    toAssetId: str
    fee: int = Field(0, ge=0)
    feeCategoryId: Optional[str] = None


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    occurredAt: Optional[datetime] = None
    amount: Optional[int] = Field(None, ge=1)
    memo: Optional[str] = None
    assetId: Optional[str] = None
    categoryId: Optional[str] = None
    merchant: Optional[str] = None
    source: Optional[str] = None
    fromAssetId: Optional[str] = None
    toAssetId: Optional[str] = None
    fee: Optional[int] = Field(None, ge=0)
    feeCategoryId: Optional[str] = None


class TransactionOut(BaseModel):
    id: str
    type: str
    occurredAt: datetime
    amount: int
    memo: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    createdBy: str
    assetId: Optional[str] = None
    categoryId: Optional[str] = None
    merchant: Optional[str] = None
    source: Optional[str] = None
    fromAssetId: Optional[str] = None
    toAssetId: Optional[str] = None
    fee: Optional[int] = None
    feeCategoryId: Optional[str] = None
