from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.core.limits import MAX_AMOUNT, MIN_AMOUNT, MAX_MEMO_LENGTH, MAX_NAME_LENGTH


class TransactionBase(BaseModel):
    type: str
    occurredAt: datetime
    amount: int = Field(..., ge=MIN_AMOUNT, le=MAX_AMOUNT)
    memo: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    dayOrder: Optional[int] = Field(None, ge=0)


class ExpenseCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(..., ge=MIN_AMOUNT, le=MAX_AMOUNT)
    memo: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    assetId: Optional[str] = None
    assetName: str = Field(..., max_length=MAX_NAME_LENGTH)
    categoryId: Optional[str] = None
    categoryName: str = Field(..., max_length=MAX_NAME_LENGTH)
    merchant: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    dayOrder: Optional[int] = Field(None, ge=0)


class IncomeCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(..., ge=MIN_AMOUNT, le=MAX_AMOUNT)
    memo: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    assetId: Optional[str] = None
    assetName: str = Field(..., max_length=MAX_NAME_LENGTH)
    categoryId: Optional[str] = None
    categoryName: str = Field(..., max_length=MAX_NAME_LENGTH)
    source: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    dayOrder: Optional[int] = Field(None, ge=0)


class TransferCreate(BaseModel):
    occurredAt: datetime
    amount: int = Field(..., ge=MIN_AMOUNT, le=MAX_AMOUNT)
    memo: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    counterparty: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    fromAssetId: Optional[str] = None
    fromAssetName: str = Field(..., max_length=MAX_NAME_LENGTH)
    toAssetId: Optional[str] = None
    toAssetName: str = Field(..., max_length=MAX_NAME_LENGTH)
    fee: int = Field(0, ge=MIN_AMOUNT, le=MAX_AMOUNT)
    feeCategoryId: Optional[str] = None
    feeCategoryName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    dayOrder: Optional[int] = Field(None, ge=0)


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    occurredAt: Optional[datetime] = None
    amount: Optional[int] = Field(None, ge=MIN_AMOUNT, le=MAX_AMOUNT)
    memo: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    assetId: Optional[str] = None
    assetName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    categoryId: Optional[str] = None
    categoryName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    merchant: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    source: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    fromAssetId: Optional[str] = None
    fromAssetName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    toAssetId: Optional[str] = None
    toAssetName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    fee: Optional[int] = Field(None, ge=MIN_AMOUNT, le=MAX_AMOUNT)
    feeCategoryId: Optional[str] = None
    feeCategoryName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    counterparty: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    dayOrder: Optional[int] = Field(None, ge=0)


class TransactionOut(BaseModel):
    id: str
    type: str
    occurredAt: datetime
    amount: int = Field(..., ge=MIN_AMOUNT, le=MAX_AMOUNT)
    memo: Optional[str] = Field(None, max_length=MAX_MEMO_LENGTH)
    dayOrder: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime
    createdBy: str
    assetId: Optional[str] = None
    assetName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    categoryId: Optional[str] = None
    categoryName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    merchant: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    source: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    fromAssetId: Optional[str] = None
    fromAssetName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    toAssetId: Optional[str] = None
    toAssetName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    fee: Optional[int] = Field(None, ge=MIN_AMOUNT, le=MAX_AMOUNT)
    feeCategoryId: Optional[str] = None
    feeCategoryName: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    counterparty: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
