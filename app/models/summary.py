from typing import Dict

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    expenseTotal: int
    incomeTotal: int
    net: int
    transferTotal: int
    byCategory: Dict[str, Dict[str, int]]
    byAsset: Dict[str, int]
