from typing import Optional, Literal
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.limits import MAX_NAME_LENGTH

CategoryKind = Literal["expense", "income"]


class CategoryBase(BaseModel):
    name: str = Field(..., max_length=MAX_NAME_LENGTH)
    isActive: bool = True
    sortOrder: int = 0
    kind: CategoryKind = "expense"


class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=MAX_NAME_LENGTH)
    sortOrder: int = 0
    kind: CategoryKind = "expense"


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=MAX_NAME_LENGTH)
    sortOrder: Optional[int] = None
    isActive: Optional[bool] = None
    kind: Optional[CategoryKind] = None


class CategoryOut(CategoryBase):
    id: str
    createdAt: datetime
    updatedAt: datetime
