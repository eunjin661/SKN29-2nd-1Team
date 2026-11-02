from fastapi import APIRouter
from api.services.observed_analysis import analysis_summary

router = APIRouter(prefix="/insight", tags=["insight"])


@router.get("/summary")
def insight_summary():
    return analysis_summary()
