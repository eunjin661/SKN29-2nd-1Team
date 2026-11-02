from fastapi import APIRouter, Query

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


FALLBACK = {
    "meta": {
        "source": "api",
        "message": "Dashboard API fallback-safe response",
        "updatedAt": "runtime",
    },
    "filters": {
        "years": ["ALL", "2022", "2023", "2024", "2025"],
        "categories": ["ALL", "Entertainment", "Music", "Lifestyle", "Sports", "Gaming"],
    },
    "kpis": {
        "rawSnapshots": 872191,
        "trendEvents": 34964,
        "medianDuration": 108,
        "categories": 5,
    },
    "byYear": {
        "ALL": {"rawSnapshots": 872191, "trendEvents": 34964, "medianDuration": 108},
        "2022": {"rawSnapshots": 165420, "trendEvents": 6200, "medianDuration": 96},
        "2023": {"rawSnapshots": 238190, "trendEvents": 9100, "medianDuration": 104},
        "2024": {"rawSnapshots": 278650, "trendEvents": 11200, "medianDuration": 112},
        "2025": {"rawSnapshots": 189931, "trendEvents": 8464, "medianDuration": 108},
    },
    "categoryStats": [
        {"category": "Entertainment", "events": 9800, "medianDuration": 122, "strategyScore": 86, "risk": "LOW"},
        {"category": "Music", "events": 8200, "medianDuration": 138, "strategyScore": 84, "risk": "LOW"},
        {"category": "Lifestyle", "events": 6900, "medianDuration": 114, "strategyScore": 78, "risk": "MID"},
        {"category": "Sports", "events": 5200, "medianDuration": 82, "strategyScore": 66, "risk": "MID"},
        {"category": "Gaming", "events": 4864, "medianDuration": 74, "strategyScore": 61, "risk": "HIGH"},
    ],
    "trendFlow": [
        {"label": "2022", "value": 6200},
        {"label": "2023", "value": 9100},
        {"label": "2024", "value": 11200},
        {"label": "2025", "value": 8464},
    ],
    "durationDistribution": [
        {"label": "0~24h", "value": 6400},
        {"label": "24~72h", "value": 12900},
        {"label": "72~168h", "value": 9800},
        {"label": "168h+", "value": 5864},
    ],
    "topVideos": [
        {"title": "Long-lived music trend", "category": "Music", "duration": 192, "score": 0.86},
        {"title": "Entertainment viral clip", "category": "Entertainment", "duration": 168, "score": 0.82},
        {"title": "Lifestyle review", "category": "Lifestyle", "duration": 132, "score": 0.76},
        {"title": "Sports highlight", "category": "Sports", "duration": 84, "score": 0.64},
        {"title": "Gaming short burst", "category": "Gaming", "duration": 72, "score": 0.58},
    ],
}


@router.get("/summary")
def get_dashboard_summary(
    year: str = Query("ALL"),
    category: str = Query("ALL"),
):
    """
    운영 대시보드용 요약 API.
    실제 집계 모듈이 없어도 프론트가 깨지지 않도록 fallback-safe 응답을 반환합니다.
    """
    data = dict(FALLBACK)
    data["meta"] = {
        **FALLBACK["meta"],
        "selectedYear": year,
        "selectedCategory": category,
    }

    return data
