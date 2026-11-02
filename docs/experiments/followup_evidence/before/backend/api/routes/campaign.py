from fastapi import APIRouter, Query

try:
    import pandas as pd
    from api.services.data_loader import get_df
except Exception:  # pragma: no cover
    pd = None
    get_df = None

router = APIRouter(prefix="/campaign", tags=["campaign"])

FALLBACK_CATEGORIES = [
    {"category": "Lifestyle", "score": 82, "duration": 132, "risk": "LOW", "action": "장기 브랜딩형 광고 집행", "budgetShare": 35, "conversionFit": 72, "brandFit": 92, "viralFit": 78},
    {"category": "Entertainment", "score": 78, "duration": 120, "risk": "MID", "action": "바이럴 직후 단기 집중 집행", "budgetShare": 30, "conversionFit": 68, "brandFit": 76, "viralFit": 91},
    {"category": "Music", "score": 74, "duration": 118, "risk": "MID", "action": "재진입 감지 후 리타겟팅", "budgetShare": 20, "conversionFit": 64, "brandFit": 86, "viralFit": 80},
    {"category": "Education", "score": 66, "duration": 96, "risk": "LOW", "action": "검색형/정보형 광고 보조 집행", "budgetShare": 10, "conversionFit": 79, "brandFit": 70, "viralFit": 55},
    {"category": "News", "score": 52, "duration": 60, "risk": "HIGH", "action": "단기 이슈성 집행만 제한적으로 운영", "budgetShare": 5, "conversionFit": 48, "brandFit": 45, "viralFit": 62},
]

ACTIONS = {
    "Lifestyle": "장기 브랜딩형 광고 집행",
    "Entertainment": "바이럴 직후 단기 집중 집행",
    "Music": "재진입 감지 후 리타겟팅",
    "Education": "검색형/정보형 광고 보조 집행",
    "News": "단기 이슈성 집행만 제한적으로 운영",
}


def _fallback():
    return {
        "summary": {
            "recommendedCategory": "Lifestyle",
            "objective": "인지도",
            "budget": 3000000,
            "expectedScore": 82,
            "bestTiming": "토요일 18–22시",
            "roiIndex": 128,
            "riskLevel": "LOW",
            "cpm": 3500,
            "budgetBasis": "CPM 기반 추정: 배정 예산 ÷ CPM × 1,000 = 예상 노출",
        },
        "categories": FALLBACK_CATEGORIES,
        "roadmap": [
            {"step": "WEEK 1", "title": "테스트 집행", "desc": "총 예산의 25%로 상위 카테고리 반응을 검증합니다."},
            {"step": "WEEK 2", "title": "성과 확대", "desc": "예측 점수 75점 이상 카테고리에 예산을 재배분합니다."},
            {"step": "WEEK 3", "title": "리타겟팅", "desc": "재진입 가능성이 높은 영상/카테고리를 대상으로 반복 노출합니다."},
            {"step": "WEEK 4", "title": "ROI 정리", "desc": "성과 낮은 카테고리는 중단하고 장기 유지형 중심으로 전환합니다."},
        ],
    }


def _clip_int(value, low=0, high=100):
    try:
        return int(max(low, min(high, round(float(value)))))
    except Exception:
        return low


@router.get("/plan")
def campaign_plan(
    budget: int = Query(3000000, ge=100000, le=100000000),
    cpm: int = Query(3500, ge=500, le=50000),
):
    """광고 캠페인 플래너 API.
    인사이트 요약이 아니라 목표별 예산 배분, ROI 지수, 위험도, 실행 판단에 필요한 값을 반환합니다.
    """
    if get_df is None or pd is None:
        return _fallback()

    try:
        df = get_df()
        if df is None or len(df) == 0 or "category_group" not in df.columns:
            return _fallback()

        dur_col = "trending_duration_h" if "trending_duration_h" in df.columns else None
        tdi_col = "TDI" if "TDI" in df.columns else None
        view_col = "view_count" if "view_count" in df.columns else None
        like_col = "like_count" if "like_count" in df.columns else None
        comment_col = "comment_count" if "comment_count" in df.columns else None

        grouped = df.groupby("category_group")
        count = grouped.size().rename("events")
        duration = grouped[dur_col].median() if dur_col else count * 0 + 100
        tdi = grouped[tdi_col].mean() if tdi_col else count * 0 + 0.5
        views = grouped[view_col].median() if view_col else count * 0 + 100000
        likes = grouped[like_col].median() if like_col else count * 0 + 1000
        comments = grouped[comment_col].median() if comment_col else count * 0 + 100

        raw = (
            pd.concat([
                count,
                duration.rename("duration"),
                tdi.rename("tdi"),
                views.rename("views"),
                likes.rename("likes"),
                comments.rename("comments"),
            ], axis=1)
            .fillna(0)
            .reset_index()
            .rename(columns={"category_group": "category"})
        )

        max_duration = max(float(raw["duration"].max()), 1.0)
        max_events = max(float(raw["events"].max()), 1.0)
        max_views = max(float(raw["views"].max()), 1.0)
        max_likes = max(float(raw["likes"].max()), 1.0)
        max_comments = max(float(raw["comments"].max()), 1.0)

        raw["score"] = (
            (raw["duration"] / max_duration) * 40
            + (raw["tdi"].clip(0, 1)) * 30
            + (raw["events"] / max_events) * 20
            + (raw["views"] / max_views) * 10
        ).round().astype(int).clip(40, 95)

        raw["viralFit"] = (
            (raw["views"] / max_views) * 45
            + (raw["likes"] / max_likes) * 25
            + (raw["comments"] / max_comments) * 20
            + (raw["events"] / max_events) * 10
        ).round().astype(int).clip(35, 95)

        raw["brandFit"] = (
            (raw["duration"] / max_duration) * 60
            + (raw["tdi"].clip(0, 1)) * 30
            + (raw["events"] / max_events) * 10
        ).round().astype(int).clip(35, 95)

        raw["conversionFit"] = (
            (raw["comments"] / max_comments) * 35
            + (raw["likes"] / max_likes) * 25
            + (raw["tdi"].clip(0, 1)) * 25
            + (raw["duration"] / max_duration) * 15
        ).round().astype(int).clip(35, 95)

        raw = raw.sort_values("score", ascending=False).head(5)
        total_score = max(float(raw["score"].sum()), 1.0)

        categories = []
        for _, row in raw.iterrows():
            cat = str(row["category"])
            score = _clip_int(row["score"], 40, 95)
            risk = "LOW" if score >= 75 else "MID" if score >= 60 else "HIGH"
            budget_share = int(round(score / total_score * 100))
            allocated_budget = budget * (budget_share / 100)
            estimated_reach = int(round((allocated_budget / max(cpm, 1)) * 1000))
            action_rate = 0.025 + (score / 2500)
            estimated_action = int(round(estimated_reach * action_rate))
            cost_per_action = int(round(allocated_budget / max(estimated_action, 1)))
            categories.append({
                "category": cat,
                "score": score,
                "duration": int(round(float(row["duration"]))),
                "risk": risk,
                "action": ACTIONS.get(cat, "성과 기반 테스트 집행"),
                "budgetShare": budget_share,
                "allocatedBudget": int(round(allocated_budget)),
                "cpm": cpm,
                "estimatedReach": estimated_reach,
                "estimatedAction": estimated_action,
                "costPerAction": cost_per_action,
                "conversionFit": _clip_int(row["conversionFit"], 35, 95),
                "brandFit": _clip_int(row["brandFit"], 35, 95),
                "viralFit": _clip_int(row["viralFit"], 35, 95),
            })

        if categories:
            diff = 100 - sum(c["budgetShare"] for c in categories)
            categories[0]["budgetShare"] += diff

        best = categories[0] if categories else FALLBACK_CATEGORIES[0]
        return {
            "summary": {
                "recommendedCategory": best["category"],
                "objective": "인지도",
                "budget": budget,
                "cpm": cpm,
                "expectedReach": sum(c.get("estimatedReach", 0) for c in categories),
                "expectedAction": sum(c.get("estimatedAction", 0) for c in categories),
                "avgCPA": int(round(budget / max(sum(c.get("estimatedAction", 0) for c in categories), 1))),
                "budgetBasis": "CPM 기반 추정: 배정 예산 ÷ CPM × 1,000 = 예상 노출",
                "expectedScore": best["score"],
                "bestTiming": "토요일 18–22시",
                "roiIndex": int(round(best["score"] * (1.45 if best["risk"] == "LOW" else 1.18 if best["risk"] == "MID" else 0.82))),
                "riskLevel": best["risk"],
            },
            "categories": categories or FALLBACK_CATEGORIES,
            "roadmap": _fallback()["roadmap"],
        }
    except Exception:
        return _fallback()
