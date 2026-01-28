from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TransactionBase(BaseModel):
    type: str
    occurredAt: datetime
    amount: int = Field(...)
    memo: Optional[str] = None
    dayOrder: Optional[int] = Field(None, ge=0)


class ExpenseCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(...)
    memo: Optional[str] = None
    assetName: str
    categoryName: str
    merchant: Optional[str] = None
    dayOrder: Optional[int] = Field(None, ge=0)


class IncomeCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(...)
    memo: Optional[str] = None
    assetName: str
    categoryName: str
    source: Optional[str] = None
    dayOrder: Optional[int] = Field(None, ge=0)


class TransferCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(...)
    memo: Optional[str] = None
    counterparty: Optional[str] = None
    fromAssetName: str
    toAssetName: str
    fee: int = Field(0, ge=0)
    feeCategoryName: Optional[str] = None
    dayOrder: Optional[int] = Field(None, ge=0)


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    occurredAt: Optional[datetime] = None
    amount: Optional[int] = None
    memo: Optional[str] = None
    assetName: Optional[str] = None
    categoryName: Optional[str] = None
    merchant: Optional[str] = None
    source: Optional[str] = None
    fromAssetName: Optional[str] = None
    toAssetName: Optional[str] = None
    fee: Optional[int] = Field(None, ge=0)
    feeCategoryName: Optional[str] = None
    counterparty: Optional[str] = None
    dayOrder: Optional[int] = Field(None, ge=0)


class TransactionOut(BaseModel):
    id: str
    type: str
    occurredAt: datetime
    amount: int
    memo: Optional[str] = None
    dayOrder: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime
    createdBy: str
    assetName: Optional[str] = None
    categoryName: Optional[str] = None
    merchant: Optional[str] = None
    source: Optional[str] = None
    fromAssetName: Optional[str] = None
    toAssetName: Optional[str] = None
    fee: Optional[int] = None
    feeCategoryName: Optional[str] = None
    counterparty: Optional[str] = None
