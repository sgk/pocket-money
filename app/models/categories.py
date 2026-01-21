from typing import Optional, Literal
from datetime import datetime

from pydantic import BaseModel

CategoryKind = Literal["expense", "income"]


class CategoryBase(BaseModel):
    name: str
    isActive: bool = True
    sortOrder: int = 0
    kind: CategoryKind = "expense"


class CategoryCreate(BaseModel):
    name: str
    sortOrder: int = 0
    kind: CategoryKind = "expense"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    sortOrder: Optional[int] = None
    isActive: Optional[bool] = None
    kind: Optional[CategoryKind] = None


class CategoryOut(CategoryBase):
    id: str
    createdAt: datetime
    updatedAt: datetime
