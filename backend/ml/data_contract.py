"""T0 feature allowlist, purged chronological splits, and train-only labels.

Stored naive timestamps in the project are Korea Standard Time. Six-hour
snapshots establish an event's end only after the next collection interval.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

PROTOCOL_VERSION = "t0-v2-purged-unseen-video"
NUMERIC_FEATURES = (
    "entry_rank_log", "T0_view_log", "T0_engagement_ratio_log",
    "latency_to_trend_log", "pretrend_view_velocity_log",
    "weekday_sin", "weekday_cos", "hour_sin", "hour_cos",
)
CATEGORICAL_FEATURES = ("category_group",)
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
RAW_FEATURES = ("T0", "published_at", "entry_rank", "T0_view", "T0_comment", "category_group")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def make_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Recompute features from initial observations; ignore supplied derived columns."""
    missing = set(RAW_FEATURES) - set(frame.columns)
    if missing:
        raise ValueError(f"Missing T0 inputs: {sorted(missing)}")
    t0 = pd.to_datetime(frame["T0"], errors="raise")
    published = pd.to_datetime(frame["published_at"], errors="raise")
    if t0.dt.tz is not None:
        t0 = t0.dt.tz_convert("Asia/Seoul").dt.tz_localize(None)
    if published.dt.tz is not None:
        published = published.dt.tz_convert("Asia/Seoul").dt.tz_localize(None)
    if t0.isna().any() or published.isna().any():
        raise ValueError("Timestamps must not be missing")
    latency = (t0 - published).dt.total_seconds() / 3600
    rank = pd.to_numeric(frame["entry_rank"], errors="raise")
    views = pd.to_numeric(frame["T0_view"], errors="raise")
    comments = pd.to_numeric(frame["T0_comment"], errors="raise")
    values = pd.DataFrame({"rank": rank, "views": views, "comments": comments, "latency": latency})
    if not np.isfinite(values.to_numpy(dtype=float)).all():
        raise ValueError("Initial numeric observations must be finite and present")
    if not rank.between(1, 200).all() or (views < 0).any() or (comments < 0).any() or (latency < 0).any():
        raise ValueError("Invalid initial rank, counts, or publication time")
    if frame["category_group"].isna().any():
        raise ValueError("category_group must not be missing")
    result = pd.DataFrame(index=frame.index)
    result["entry_rank_log"] = np.log1p(rank)
    result["T0_view_log"] = np.log1p(views)
    result["T0_engagement_ratio_log"] = np.log1p(comments / views.clip(lower=1))
    result["latency_to_trend_log"] = np.log1p(latency)
    result["pretrend_view_velocity_log"] = np.log1p(views / latency.clip(lower=1))
    result["weekday_sin"] = np.sin(2 * np.pi * published.dt.dayofweek / 7)
    result["weekday_cos"] = np.cos(2 * np.pi * published.dt.dayofweek / 7)
    result["hour_sin"] = np.sin(2 * np.pi * published.dt.hour / 24)
    result["hour_cos"] = np.cos(2 * np.pi * published.dt.hour / 24)
    result["category_group"] = frame["category_group"].astype(str)
    return result.loc[:, list(FEATURES)]


def make_preprocessor() -> ColumnTransformer:
    return ColumnTransformer([
        ("numeric", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), list(NUMERIC_FEATURES)),
        ("category", OneHotEncoder(handle_unknown="ignore", sparse_output=False), list(CATEGORICAL_FEATURES)),
    ], remainder="drop")


@dataclass
class PreparedData:
    frames: dict[str, pd.DataFrame]
    features: dict[str, pd.DataFrame]
    targets: dict[str, np.ndarray]
    manifest: dict
    assignments: pd.DataFrame


def prepare_data(path: Path) -> PreparedData:
    frame = pd.read_parquet(path).copy()
    required = {"video_id", "event_id", "T0", "T_end", "trending_duration_h", "best_rank", *RAW_FEATURES}
    if required - set(frame.columns):
        raise ValueError(f"Analysis parquet is required; missing {sorted(required - set(frame.columns))}")
    if frame[["video_id", "event_id"]].isna().any().any() or frame.duplicated(["video_id", "event_id"]).any():
        raise ValueError("Event keys must be present and unique")
    for column in ["T0", "T_end"]:
        frame[column] = pd.to_datetime(frame[column], errors="raise")
    if frame[["T0", "T_end"]].isna().any().any() or (frame.T_end < frame.T0).any():
        raise ValueError("Event observation times are invalid")
    for column in ["best_rank", "trending_duration_h"]:
        frame[column] = pd.to_numeric(frame[column], errors="raise")
    if not np.isfinite(frame[["best_rank", "trending_duration_h"]]).all().all():
        raise ValueError("Target source values must be finite")
    if not frame.best_rank.between(1, 200).all() or (frame.trending_duration_h <= 0).any():
        raise ValueError("Target source values are out of range")
    source_rows = len(frame)
    # Premiere/scheduled publication timestamps can occur AFTER chart entry.
    # Exclude and account for these rows instead of fabricating zero latency.
    invalid_time = pd.to_datetime(frame["published_at"], errors="raise") > frame.T0
    invalid_rows = frame.loc[invalid_time].copy()
    frame = frame.loc[~invalid_time].copy()
    make_features(frame)
    frame = frame.sort_values(["T0", "video_id", "event_id"], kind="stable").reset_index(drop=True)
    if len(frame) < 30:
        raise ValueError("At least 30 events are required for temporal evaluation")
    train_boundary = frame.iloc[int(len(frame) * .70)].T0
    test_boundary = frame.iloc[int(len(frame) * .85)].T0
    observation_end = frame.T_end.max()
    if not frame.T0.min() < train_boundary < test_boundary < observation_end:
        raise ValueError("Insufficient distinct timestamps for chronological evaluation")
    frame["label_available_at"] = frame.T_end + pd.Timedelta(hours=6)
    windows = {
        "train": (frame.T0 < train_boundary, train_boundary),
        "validation": ((frame.T0 >= train_boundary) & (frame.T0 < test_boundary), test_boundary),
        "test": (frame.T0 >= test_boundary, observation_end),
    }
    frames, audit, seen = {}, {}, set()
    frame["split"] = "excluded"
    for name, (mask, end) in windows.items():
        candidate = frame.loc[mask]
        matured = candidate.loc[candidate.label_available_at <= end]
        accepted = matured.loc[~matured.video_id.isin(seen)].copy()
        audit[name] = {
            "candidate_rows": len(candidate), "unresolved_label_rows_removed": len(candidate) - len(matured),
            "seen_video_rows_removed": len(matured) - len(accepted), "rows": len(accepted),
            "unique_videos": int(accepted.video_id.nunique()),
            "T0_min": str(accepted.T0.min()), "T0_max": str(accepted.T0.max()),
        }
        if accepted.empty:
            raise ValueError(f"Empty {name} after maturity/group filtering")
        frames[name] = accepted
        frame.loc[accepted.index, "split"] = name
        seen.update(accepted.video_id)
    # Fit the label reference ONLY on mature training events. Outcome values are
    # legitimate target inputs; they never enter the feature matrix.
    train = frames["train"]
    q95 = train.groupby("category_group").trending_duration_h.quantile(.95)
    global_q95 = float(train.trending_duration_h.quantile(.95))
    targets = {}
    for name, subset in frames.items():
        reference = subset.category_group.map(q95).fillna(global_q95)
        score = (subset.trending_duration_h / reference).clip(0, 1) * (1 - (subset.best_rank - 1) / 200).clip(0, 1)
        targets[name] = (score >= .4).astype("int64").to_numpy()
        if len(np.unique(targets[name])) != 2:
            raise ValueError(f"Both classes are required in {name}; do not publish undefined AUC")
        audit[name]["positive_rate"] = float(targets[name].mean())
        frame.loc[subset.index, "target_v2"] = targets[name]
    manifest = {
        "protocol": PROTOCOL_VERSION, "dataset_sha256": sha256_file(path), "source_rows": source_rows,
        "invalid_publication_time_rows_removed": len(invalid_rows), "eligible_rows_before_split": len(frame),
        "timezone": "Asia/Seoul (stored naive KST)",
        "train_boundary": str(train_boundary), "test_boundary": str(test_boundary),
        "observation_end": str(observation_end), "label_confirmation_hours": 6,
        "group_policy": "video_id disjoint across train/validation/test; later repeats excluded",
        "target": {"name": "tdi_v2", "threshold": .4, "category_q95_train_only": q95.to_dict(), "unseen_category_q95": global_q95},
        "feature_columns": list(FEATURES), "features_recomputed_from": list(RAW_FEATURES),
        "excluded_feature_policy": "All columns outside the allowlist, including duration, other labels, post-T0 growth and historical saturation",
        "splits": audit,
    }
    keys = ["video_id", "event_id", "T0", "T_end", "label_available_at", "split", "target_v2"]
    if not invalid_rows.empty:
        invalid_rows["label_available_at"] = invalid_rows.T_end + pd.Timedelta(hours=6)
        invalid_rows["split"] = "excluded_invalid_publication_time"
        invalid_rows["target_v2"] = np.nan
        assignments = pd.concat([frame[keys], invalid_rows[keys]], ignore_index=True)
    else:
        assignments = frame[keys]
    return PreparedData(frames, {k: make_features(v) for k, v in frames.items()}, targets, manifest, assignments)
