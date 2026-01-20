from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class CategoryBase(BaseModel):
    name: str
    isActive: bool = True
    sortOrder: int = 0


class CategoryCreate(BaseModel):
    name: str
    sortOrder: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    sortOrder: Optional[int] = None
    isActive: Optional[bool] = None


class CategoryOut(CategoryBase):
    id: str
    createdAt: datetime
    updatedAt: datetime
