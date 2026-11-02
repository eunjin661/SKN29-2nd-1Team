from fastapi import APIRouter
from api.services.observed_analysis import analysis_summary

router = APIRouter(prefix="/strategy", tags=["strategy"])


@router.get("/summary")
def strategy_summary():
    return analysis_summary()


@router.get("/recommendations")
def strategy_recommendations():
    return {"status": "not_available", "items": [], "message": "실제 광고 효과와 최적 집행 전략은 검증하지 않았습니다. 관측 비교는 /strategy/summary 에서 확인하세요."}
