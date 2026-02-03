from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import get_ready_user
from app.models.summary import SummaryResponse
from app.services import summary_service


router = APIRouter(prefix="/api/summary", tags=["summary"])


@router.get("/monthly", response_model=SummaryResponse)
def monthly_summary(
    response: Response,
    user=Depends(get_ready_user),
    year: int = Query(..., ge=1970),
    month: int = Query(..., ge=1, le=12),
):
    response.headers["Vary"] = "X-Child-Id"
    return summary_service.get_month_summary(user.uid, year, month)
