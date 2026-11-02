from fastapi import APIRouter
from api.services.observed_analysis import analysis_summary

router = APIRouter(prefix="/eda", tags=["eda"])


@router.get("/summary")
def eda_summary():
    return analysis_summary()
