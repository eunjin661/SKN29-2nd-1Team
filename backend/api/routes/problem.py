from fastapi import APIRouter
from api.services.observed_analysis import analysis_summary

router = APIRouter(prefix="/problem", tags=["problem"])


@router.get("/summary")
def problem_summary():
    return analysis_summary()
