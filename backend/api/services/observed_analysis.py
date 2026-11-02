"""Historical aggregates with explicit populations; no example-data fallback."""
from __future__ import annotations

from functools import lru_cache
import os
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import HTTPException

from api.services import data_loader
from ml.artifact_contract import verified_report, validate_run_id
from ml.data_contract import NUMERIC_FEATURES, CATEGORICAL_FEATURES, prepare_data, sha256_file

BACKEND = Path(__file__).resolve().parents[2]
SCHEMA = "observed-analysis-v1"


def numeric(frame, column):
    return pd.to_numeric(frame.get(column, pd.Series(np.nan, index=frame.index)), errors="coerce")


def finite(values, minimum=0):
    return np.isfinite(values) & (values >= minimum)


def stats(values):
    values = values.loc[finite(values)]
    if values.empty:
        return {key: None for key in ("min", "q25", "median", "mean", "q75", "max")}
    return {"min": float(values.min()), "q25": float(values.quantile(.25)), "median": float(values.median()),
            "mean": float(values.mean()), "q75": float(values.quantile(.75)), "max": float(values.max())}


def target_population(data, report):
    """Reproduce labels with the existing train-only contract, never legacy TDI."""
    if data.manifest != report["data"]:
        raise ValueError("Current data preparation does not match the reference experiment")
    reference = data.manifest["target"]
    scores, labels = [], []
    for name, subset in data.frames.items():
        q95 = subset.category_group.map(reference["category_q95_train_only"]).fillna(reference["unseen_category_q95"])
        score = (subset.trending_duration_h / q95).clip(0, 1) * (1 - (subset.best_rank - 1) / 200).clip(0, 1)
        expected = (score >= reference["threshold"]).astype(int).to_numpy()
        if not np.array_equal(expected, data.targets[name]):
            raise ValueError("Recomputed TDI targets differ from the experiment")
        scores.extend(score.tolist())
        labels.extend(expected.tolist())
    counts, edges = np.histogram(scores, bins=np.linspace(0, 1, 11))
    if int(counts.sum()) != len(scores):
        raise ValueError("TDI histogram population mismatch")
    unresolved = sum(s["unresolved_label_rows_removed"] for s in data.manifest["splits"].values())
    seen = sum(s["seen_video_rows_removed"] for s in data.manifest["splits"].values())
    exclusions = {"invalid_publication_time": data.manifest["invalid_publication_time_rows_removed"],
                  "unresolved_label": unresolved, "seen_video": seen}
    if len(scores) + sum(exclusions.values()) != data.manifest["source_rows"]:
        raise ValueError("TDI exclusions do not reconcile with source events")
    return {"status": "ready", "run_id": report["run_id"], "protocol": report["protocol"],
            "population": len(scores), "excluded": sum(exclusions.values()), "exclusions": exclusions,
            "positive": int(sum(labels)), "positive_rate": float(np.mean(labels)), "threshold": reference["threshold"],
            "histogram": [{"lower": float(edges[i]), "upper": float(edges[i + 1]), "count": int(n)} for i, n in enumerate(counts)],
            "splits": data.manifest["splits"], "reference": reference,
            "scope": "Accepted train, validation and test events; train-only TDI reference; not prediction scores"}


@lru_cache(maxsize=2)
def _verified_targets(path_name, identity, run_id, report_stamp):
    validate_run_id(run_id)
    path = Path(path_name)
    report = verified_report(BACKEND / "artifacts" / run_id)
    if sha256_file(path) != identity or report["data"]["dataset_sha256"] != identity:
        raise ValueError("Dataset identity differs from the reference experiment")
    return target_population(prepare_data(path), report)


def load_targets(frame):
    try:
        identity = frame.attrs.get("source_sha256")
        if not identity:
            raise ValueError("Loaded observation identity is unavailable")
        run_id = os.getenv("TRENDIT_T0_RUN_ID", "")
        validate_run_id(run_id)
        report_path = BACKEND / "artifacts" / run_id / "report.json"
        stamp = report_path.stat().st_mtime_ns
        return _verified_targets(str(data_loader.ANALYSIS_PATH), identity, run_id, stamp)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return {"status": "unavailable", "reason": str(exc), "histogram": [], "population": None}


def build_summary(frame, *, target=None):
    if frame.empty or {"video_id", "category_group", "T0"} - set(frame.columns):
        raise ValueError("Nonempty observations with event identity, category and T0 are required")
    duration = numeric(frame, "trending_duration_h")
    valid_duration = finite(duration)
    category = frame.category_group.fillna("Unknown").astype(str)
    t0 = pd.to_datetime(frame.T0, errors="coerce")
    published = pd.to_datetime(frame.get("published_at", pd.Series(pd.NaT, index=frame.index)), errors="coerce")
    rank = numeric(frame, "entry_rank")
    valid_rank = finite(rank, 1) & (rank <= 200) & (rank % 1 == 0)
    observed24 = frame.get("has_24h_observation", pd.Series(None, index=frame.index, dtype=object))
    known24 = observed24.isin([True, False])
    categories = []
    for name in sorted(category.unique()):
        mask = category == name
        values = duration.loc[mask]
        valid = finite(values)
        categories.append({"category": name, "events": int(mask.sum()), "duration_n": int(valid.sum()),
                           "duration_excluded": int((~valid).sum()), **stats(values)})
    years = []
    for year in sorted(t0.dropna().dt.year.unique()):
        mask = t0.dt.year == year
        counts = category.loc[mask].value_counts()
        years.append({"year": int(year), "events": int(mask.sum()), "categories": [
            {"category": name, "events": int(counts.get(name, 0)), "percent": float(counts.get(name, 0) / mask.sum() * 100)}
            for name in sorted(category.unique())]})
    rank_counts, _ = np.histogram(rank.loc[valid_rank], bins=np.arange(1, 202, 20))
    return {"schema": SCHEMA, "source": "historical_observed_events", "analysis_scope": "historical_observations_only",
            "provenance": {"dataset": data_loader.ANALYSIS_PATH.name, "sha256": frame.attrs.get("source_sha256"),
                           "period_start": str(t0.min()) if t0.notna().any() else None,
                           "period_end": str(t0.max()) if t0.notna().any() else None, "timezone": "Asia/Seoul"},
            "population": {"events": len(frame), "unique_videos": int(frame.video_id.nunique()), "categories": len(categories),
                           "missing_video_ids": int(frame.video_id.isna().sum()), "missing_category": int(frame.category_group.isna().sum())},
            "duration": {"n": int(valid_duration.sum()), "excluded": int((~valid_duration).sum()), "unit": "hours", **stats(duration)},
            "category_summary": categories, "annual": {"n": int(t0.notna().sum()), "excluded": int(t0.isna().sum()), "rows": years},
            "weekday": {"n": int(published.notna().sum()), "excluded": int(published.isna().sum()), "basis": "publication_time",
                        "rows": [{"day": name, "events": int((published.dt.dayofweek == i).sum())} for i, name in enumerate(["월", "화", "수", "목", "금", "토", "일"])]},
            "rank": {"n": int(valid_rank.sum()), "excluded": int((~valid_rank).sum()), "median": float(rank.loc[valid_rank].median()) if valid_rank.any() else None,
                     "histogram": [{"label": f"{i * 20 + 1}–{(i + 1) * 20}", "count": int(n)} for i, n in enumerate(rank_counts)]},
            "observed_24h": {"observed": int((observed24.eq(True) & known24).sum()), "not_observed": int((observed24.eq(False) & known24).sum()), "missing": int((~known24).sum())},
            "tdi": target or {"status": "unavailable", "reason": "Verified target population has not been loaded", "histogram": [], "population": None},
            "features": {"numeric": list(NUMERIC_FEATURES), "categorical": list(CATEGORICAL_FEATURES), "importance_status": "not_computed"},
            "unavailable": {"cluster_test": "Original assignments and reproducible cluster test are not available", "causal_ad_effect": "No measured advertising outcomes"}}


def analysis_summary():
    frame = data_loader.get_df()
    try:
        return build_summary(frame, target=load_targets(frame))
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(503, "관측 자료의 필수 컬럼과 유효 표본을 확인할 수 없습니다.") from exc
