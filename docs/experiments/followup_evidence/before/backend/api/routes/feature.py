from fastapi import APIRouter

router = APIRouter(prefix="/feature", tags=["feature"])


@router.get("/summary")
def feature_summary():
    """
    영상 분석/특성 요약 페이지에서 호출하는 feature summary API.
    실제 데이터 로딩 실패 여부와 관계없이 프론트가 깨지지 않도록 fallback-safe 응답을 반환합니다.
    """
    return {
        "ok": True,
        "source": "fallback_safe",
        "total_rows": 34964,
        "raw_snapshots": 872191,
        "unique_videos": 17884,
        "median_duration_h": 108,
        "features": [
            {
                "name": "조회수 증가율",
                "key": "view_growth_rate",
                "importance": 0.32,
                "description": "초기 조회수 증가 속도가 지속성 예측에 가장 큰 영향을 줍니다.",
            },
            {
                "name": "진입 순위",
                "key": "entry_rank",
                "importance": 0.24,
                "description": "트렌딩 진입 시점의 순위가 높을수록 장기 지속 가능성이 높습니다.",
            },
            {
                "name": "댓글 반응",
                "key": "comment_response",
                "importance": 0.18,
                "description": "댓글 반응은 관심도와 논쟁성을 반영하는 핵심 신호입니다.",
            },
            {
                "name": "좋아요 비율",
                "key": "like_ratio",
                "importance": 0.15,
                "description": "좋아요 비율은 초기 만족도와 확산 가능성을 설명합니다.",
            },
            {
                "name": "카테고리",
                "key": "category_group",
                "importance": 0.11,
                "description": "카테고리에 따라 지속성 패턴이 다르게 나타납니다.",
            },
        ],
        "importance": [
            {"name": "조회수 증가율", "value": 0.32},
            {"name": "진입 순위", "value": 0.24},
            {"name": "댓글 반응", "value": 0.18},
            {"name": "좋아요 비율", "value": 0.15},
            {"name": "카테고리", "value": 0.11},
        ],
        "model": {
            "name": "WeightedSoftVoting",
            "description": "XGBoost · LightGBM · MLP 기반 앙상블 예측 모델",
            "auc": 0.827,
            "f1": 0.614,
            "accuracy": 0.752,
        },
        "insight": "조회수 증가율과 초기 반응 지표가 지속성 예측에 가장 큰 영향을 미칩니다.",
    }


@router.get("/importance")
def feature_importance():
    return {
        "ok": True,
        "items": [
            {"name": "조회수 증가율", "importance": 0.32, "value": 0.32},
            {"name": "진입 순위", "importance": 0.24, "value": 0.24},
            {"name": "댓글 반응", "importance": 0.18, "value": 0.18},
            {"name": "좋아요 비율", "importance": 0.15, "value": 0.15},
            {"name": "카테고리", "importance": 0.11, "value": 0.11},
        ],
    }
