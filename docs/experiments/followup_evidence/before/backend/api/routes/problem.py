from __future__ import annotations

from fastapi import APIRouter, Query

from .analysis_common import cached_get, cached_set, fetch_live_videos, summarize_videos

router = APIRouter(prefix="/problem", tags=["problem"])

@router.get("/summary")
def problem_summary(max_results: int = Query(50, ge=1, le=100)):
    key = f"problem-summary:{max_results}"
    cached = cached_get(key)
    if cached:
        return cached

    videos = fetch_live_videos(max_results=max_results)
    summary = summarize_videos(videos)
    issues = []

    if summary["total"] <= 0:
        issues.append({
            "level": "critical",
            "title": "영상 데이터 없음",
            "message": "YouTube API 키, 할당량, /youtube/live/bulk 응답을 확인하세요.",
        })

    if summary["fallback_count"] > 0 and summary["weighted_soft_voting_count"] == 0:
        issues.append({
            "level": "high",
            "title": "weighted_soft_voting 미사용",
            "message": "AI 점수가 fallback 기반입니다. /predict/status에서 weighted_soft_voting_model=true인지 확인하세요.",
        })

    if summary["avg_ai_score"] <= 5 and summary["total"] > 0:
        issues.append({
            "level": "high",
            "title": "AI 점수 비정상",
            "message": "feature 순서 mismatch 또는 모델 입력 스케일 문제 가능성이 있습니다.",
        })

    if not issues:
        issues.append({
            "level": "ok",
            "title": "핵심 문제 없음",
            "message": "영상 데이터와 예측 점수가 정상적으로 집계되고 있습니다.",
        })

    payload = {
        "ok": True,
        "summary": summary,
        "issues": issues,
    }
    return cached_set(key, payload)
