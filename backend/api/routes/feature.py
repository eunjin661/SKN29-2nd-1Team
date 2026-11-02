from fastapi import APIRouter
from api.services.observed_analysis import analysis_summary

router = APIRouter(prefix="/feature", tags=["feature"])


@router.get("/summary")
def feature_summary():
    return analysis_summary()


@router.get("/importance")
def feature_importance():
    return {"status": "not_computed", "items": [], "message": "검증한 모델의 피처 중요도·SHAP은 산출하지 않았습니다."}
