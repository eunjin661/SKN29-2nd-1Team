"""Observed historical duration analysis; predictions belong to the verified T0 API."""
from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from api.services.data_loader import get_df

router = APIRouter(prefix="/sustain", tags=["sustain"])


def analysis_frame() -> pd.DataFrame:
    source = get_df()
    duration = next((name for name in ("trending_duration_h", "trending_duration_h_raw", "duration_h") if name in source.columns), None)
    category = next((name for name in ("category_group", "category", "category_name") if name in source.columns), None)
    if duration is None or category is None or "video_id" not in source.columns:
        raise HTTPException(503, "지속성 분석에 필요한 관측 컬럼이 없습니다.")
    values = pd.to_numeric(source[duration], errors="coerce")
    valid = np.isfinite(values) & (values >= 0)
    frame = source.loc[valid].copy()
    if frame.empty:
        raise HTTPException(503, "지속성 분석에 사용할 유효한 관측 이벤트가 없습니다.")
    frame["_duration"] = values.loc[valid]
    frame["_category"] = frame[category].fillna("Unknown").astype(str)
    return frame


def observed_rows(frame: pd.DataFrame, limit: int) -> list[dict]:
    rows = []
    for _, row in frame.head(limit).iterrows():
        event = pd.to_numeric(row.get("event_id", 1), errors="coerce")
        event_id = int(event) if pd.notna(event) and np.isfinite(event) else 1
        rows.append({
            "video_id": str(row["video_id"]), "event_id": event_id,
            "title": str(row.get("title", "제목 없음")),
            "channel_title": str(row.get("channel_title", "")),
            "category": row["_category"], "duration": round(float(row["_duration"]), 1),
            "t0": str(row.get("T0", ""))[:19], "is_reentry": event_id > 1,
        })
    return rows


@router.get("/summary")
def sustain_summary():
    frame = analysis_frame()
    duration = frame["_duration"]
    q25, median, q75 = duration.quantile([.25, .5, .75])
    categories = frame.groupby("_category").agg(duration=("_duration", "median"), avg_duration_h=("_duration", "mean"), count=("_duration", "size")).sort_values("duration", ascending=False)
    events = pd.to_numeric(frame.get("event_id", pd.Series(1, index=frame.index)), errors="coerce")
    groups = [duration <= q25, (duration > q25) & (duration <= median), (duration > median) & (duration <= q75), duration > q75]
    labels = ["하위 지속 구간", "중하위 지속 구간", "중상위 지속 구간", "상위 지속 구간"]
    clusters = [{"id": f"Q{index + 1}", "name": labels[index], "duration": round(float(duration[mask].median()), 1), "ratio": round(float(mask.mean() * 100), 1)} for index, mask in enumerate(groups) if mask.any()]
    return {
        "ok": True, "source": "historical_observed_events",
        "analysis_scope": "historical_observations_only",
        "stats": {"min": float(duration.min()), "q25": float(q25), "median": float(median), "mean": float(duration.mean()), "q75": float(q75), "max": float(duration.max())},
        "dataScale": {"snapshots": None, "events": len(frame), "videos": int(frame.video_id.nunique()), "reentries": int((events > 1).sum())},
        "categoryDuration": [{"category": name, "duration": round(float(row.duration), 1), "avg_duration_h": round(float(row.avg_duration_h), 1), "count": int(row["count"])} for name, row in categories.iterrows()],
        "clusters": clusters,
        "videos": observed_rows(frame.sort_values("_duration", ascending=False), 100),
        "featureImportance": [], "modelCompare": [], "modelMetrics": {},
        "warning": "과거 관측의 지속 시간 집계입니다. 예측 성능과 광고 효과를 의미하지 않습니다.",
    }


@router.get("/videos")
def get_sustain_videos(
    category: str = Query("ALL"), search: str = Query(""),
    sort: str = Query("duration", pattern="^(duration|recent|rank)$"),
    limit: int = Query(50, ge=1, le=300),
):
    frame = analysis_frame()
    if category.upper() != "ALL":
        frame = frame[frame._category.str.casefold() == category.casefold()]
    if search:
        query = search.casefold()
        title = frame.get("title", pd.Series("", index=frame.index)).fillna("").astype(str).str.casefold()
        channel = frame.get("channel_title", pd.Series("", index=frame.index)).fillna("").astype(str).str.casefold()
        frame = frame[title.str.contains(query, regex=False) | channel.str.contains(query, regex=False) | frame._category.str.casefold().str.contains(query, regex=False)]
    if sort == "recent" and "T0" in frame.columns:
        frame = frame.sort_values("T0", ascending=False)
    elif sort == "rank" and "entry_rank" in frame.columns:
        frame = frame.sort_values("entry_rank")
    else:
        frame = frame.sort_values("_duration", ascending=False)
    return {"items": observed_rows(frame, limit), "count": len(frame.head(limit)), "source": "historical_observed_events"}


@router.get("/feature-importance")
def get_feature_importance():
    return {"items": [], "status": "not_available", "source": "historical_observations_only", "message": "현재 검증 모델의 범위는 /predict/t0-verified/evaluation 에서 확인하세요."}
