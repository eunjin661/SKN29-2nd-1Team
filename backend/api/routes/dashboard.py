"""Filtered observed aggregates; no proportional estimates or strategy scores."""
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from api.services import data_loader
from api.services.observed_analysis import numeric, finite, stats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def dashboard_summary(frame, year="ALL", category="ALL"):
    if {"T0", "video_id", "category_group"} - set(frame.columns):
        raise HTTPException(503, "관측 자료의 필수 컬럼을 확인할 수 없습니다.")
    t0 = pd.to_datetime(frame.T0, errors="coerce")
    names = frame.category_group.fillna("Unknown").astype(str)
    mask = pd.Series(True, index=frame.index)
    if year != "ALL": mask &= t0.dt.year.eq(int(year))
    if category != "ALL": mask &= names.eq(category)
    selected = frame.loc[mask]
    selected_names = names.loc[mask]
    duration = numeric(selected, "trending_duration_h")
    valid = finite(duration)
    snapshots = numeric(selected, "n_snapshots")
    snapshot_valid = finite(snapshots) & (snapshots % 1 == 0)
    categories = [{"category": name, "events": int((selected_names == name).sum()),
                   "medianDuration": stats(duration.loc[selected_names == name])["median"]} for name in sorted(selected_names.unique())]
    flow = t0.loc[mask].dt.year.value_counts().sort_index()
    rows = []
    for index in duration.loc[valid].sort_values(ascending=False).head(20).index:
        row = selected.loc[index]
        event = pd.to_numeric(row.get("event_id"), errors="coerce")
        event_id = int(event) if pd.notna(event) and float(event).is_integer() else None
        rows.append({"title": str(row.get("title", "제목 없음")), "category": selected_names.loc[index], "duration": float(duration.loc[index]), "video_id": str(row.video_id), "event_id": event_id})
    buckets = [("0–24h", (duration < 24) & valid), ("24–72h", duration.ge(24) & duration.lt(72) & valid),
               ("72–168h", duration.ge(72) & duration.lt(168) & valid), ("168h 이상", duration.ge(168) & valid)]
    return {"schema": "observed-dashboard-v1", "meta": {"source": "historical_observed_events", "selectedYear": year, "selectedCategory": category, "dataset_sha256": frame.attrs.get("source_sha256"),
             "scope": "Actual rows matching both filters; event snapshot sum is not the original raw collection total"},
            "filters": {"years": ["ALL", *[str(int(value)) for value in sorted(t0.dropna().dt.year.unique())]], "categories": ["ALL", *sorted(names.unique())]},
            "kpis": {"eventSnapshots": int(snapshots.loc[snapshot_valid].sum()) if snapshot_valid.any() else None, "snapshotExcluded": int((~snapshot_valid).sum()), "trendEvents": len(selected),
                     "medianDuration": stats(duration)["median"], "categories": len(categories), "durationN": int(valid.sum()), "durationExcluded": int((~valid).sum())},
            "categoryStats": categories, "trendFlow": [{"label": str(int(value)), "value": int(count)} for value, count in flow.items()],
            "durationDistribution": [{"label": label, "value": int(mask.sum())} for label, mask in buckets], "topVideos": rows}


@router.get("/summary")
def get_dashboard_summary(year: str = Query("ALL", pattern="^(ALL|[0-9]{4})$"), category: str = Query("ALL", min_length=1, max_length=100)):
    return dashboard_summary(data_loader.get_df(), year, category)
