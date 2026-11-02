from __future__ import annotations

from fastapi import APIRouter, Query

from .analysis_common import (
    cached_get,
    cached_set,
    category_growth,
    fetch_live_videos,
    summarize_videos,
    top_video_candidates,
)

router = APIRouter(prefix="/insight", tags=["insight"])

@router.get("/summary")
def insight_summary(max_results: int = Query(50, ge=1, le=100)):
    key = f"insight-summary:{max_results}"
    cached = cached_get(key)
    if cached:
        return cached

    videos = fetch_live_videos(max_results=max_results)
    summary = summarize_videos(videos)
    growth_rows = category_growth(videos)
    candidates = top_video_candidates(videos, limit=5)

    payload = {
        "ok": True,
        "source": "youtube_live_bulk",
        "summary": summary,
        "total": summary["total"],
        "category_count": summary["category_count"],
        "avg_views": summary["avg_views"],
        "avg_ai_score": summary["avg_ai_score"],
        "avg_predicted_24h_views": summary["avg_predicted_24h_views"],
        "avg_growth": summary["avg_growth"],
        "weighted_soft_voting_count": summary["weighted_soft_voting_count"],
        "fallback_count": summary["fallback_count"],
        "category_growth": growth_rows,
        "top_candidates": candidates,
        "insight": _make_insight(summary, growth_rows),
    }
    return cached_set(key, payload)

@router.get("/category-growth")
def insight_category_growth(max_results: int = Query(50, ge=1, le=100)):
    key = f"category-growth:{max_results}"
    cached = cached_get(key)
    if cached:
        return cached

    videos = fetch_live_videos(max_results=max_results)
    rows = category_growth(videos)
    payload = {
        "ok": True,
        "count": len(rows),
        "items": rows,
        "chart": {
            "xKey": "category",
            "series": [
                {"dataKey": "avg_ai_score", "label": "AI 점수"},
                {"dataKey": "strategy_score", "label": "전략 점수"},
            ],
            "data": rows,
        },
    }
    return cached_set(key, payload)

def _make_insight(summary: dict, rows: list[dict]) -> str:
    if summary.get("total", 0) <= 0:
        return "현재 분석 가능한 영상 데이터가 없습니다. YouTube API 연결과 /youtube/live/bulk 응답을 먼저 확인하세요."
    if not rows:
        return "영상 데이터는 있으나 카테고리별 집계가 부족합니다."

    top = rows[0]
    model_msg = "weighted_soft_voting 기반" if summary.get("weighted_soft_voting_count", 0) > 0 else "fallback 보조 계산 기반"
    return (
        f"{model_msg} 분석 결과, 현재 가장 강한 성장 후보 카테고리는 "
        f"{top['category']}입니다. 평균 AI 점수 {top['avg_ai_score']}점, "
        f"예상 성장량 {top['avg_growth']:,}회 기준으로 우선 공략 가치가 높습니다."
    )
