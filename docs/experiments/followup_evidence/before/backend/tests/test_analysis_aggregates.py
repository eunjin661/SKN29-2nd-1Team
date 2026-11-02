from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.services import observed_analysis as analysis
from api.routes import eda, feature, insight, problem, strategy
from ml.data_contract import prepare_data


@pytest.fixture
def frame():
    return pd.DataFrame({
        "video_id": ["a", "b", "a", "c"], "category_group": ["Music", "News", "Music", "News"],
        "T0": pd.to_datetime(["2024-01-01", "2024-01-02", "2025-01-03", "2025-01-04"]),
        "published_at": pd.to_datetime(["2023-12-31", "2024-01-01", "2025-01-02", "2025-01-03"]),
        "trending_duration_h": [12., 24., 36., 48.], "entry_rank": [1, 20, 21, 200],
        "has_24h_observation": [True, False, True, False],
    })


def test_aggregates_reconcile_with_hand_calculated_observations(frame):
    result = analysis.build_summary(frame)
    assert result["population"] == {"events": 4, "unique_videos": 3, "categories": 2, "missing_video_ids": 0, "missing_category": 0}
    assert result["duration"]["mean"] == result["duration"]["median"] == 30
    music = next(row for row in result["category_summary"] if row["category"] == "Music")
    assert music["events"] == 2 and music["median"] == music["mean"] == 24
    assert music["q25"] == 18 and music["q75"] == 30
    assert sum(row["events"] for row in result["weekday"]["rows"]) == 4
    assert [row["events"] for row in result["annual"]["rows"]] == [2, 2]
    assert [row["count"] for row in result["rank"]["histogram"]][:2] == [2, 1]
    assert sum(row["count"] for row in result["rank"]["histogram"]) == 4
    assert result["observed_24h"] == {"observed": 2, "not_observed": 2, "missing": 0}
    assert result["tdi"]["status"] == "unavailable"


def test_mean_is_not_average_of_category_medians(frame):
    frame.loc[3, "trending_duration_h"] = 1000
    result = analysis.build_summary(frame)
    assert result["duration"]["mean"] == 268
    assert result["duration"]["median"] == 30
    assert next(row for row in result["category_summary"] if row["category"] == "News")["mean"] == 512


def test_missing_and_invalid_observations_are_accounted_per_metric(frame):
    frame.loc[0, "trending_duration_h"] = np.inf
    frame.loc[1, "trending_duration_h"] = -1
    frame.loc[0, "entry_rank"] = 0
    frame.loc[1, "entry_rank"] = 200.5
    frame.loc[2, "published_at"] = pd.NaT
    frame.loc[3, "has_24h_observation"] = None
    result = analysis.build_summary(frame)
    assert result["population"]["events"] == 4
    assert result["duration"]["n"] == 2 and result["duration"]["excluded"] == 2
    assert result["rank"]["n"] == 2 and result["rank"]["excluded"] == 2
    assert result["weekday"]["n"] == 3 and result["weekday"]["excluded"] == 1
    assert result["observed_24h"]["missing"] == 1


def test_modified_rows_change_aggregates_without_example_constants(frame):
    frame.loc[0, "category_group"] = "New category"
    frame.loc[0, "trending_duration_h"] = 120
    result = analysis.build_summary(frame)
    assert result["population"]["categories"] == 3
    assert next(row for row in result["category_summary"] if row["category"] == "New category")["median"] == 120


@pytest.mark.parametrize("damage", ["empty", "missing_category", "missing_t0"])
def test_invalid_populations_are_rejected(frame, damage):
    if damage == "empty": frame = frame.iloc[:0]
    elif damage == "missing_category": frame = frame.drop(columns="category_group")
    else: frame = frame.drop(columns="T0")
    with pytest.raises(ValueError): analysis.build_summary(frame)


def test_all_analysis_routes_use_the_same_observed_contract(frame, monkeypatch):
    monkeypatch.setattr(analysis.data_loader, "get_df", lambda: frame)
    app = FastAPI()
    for module in [eda, feature, insight, problem, strategy]: app.include_router(module.router)
    client = TestClient(app)
    for name in ["eda", "feature", "insight", "problem", "strategy"]:
        body = client.get(f"/{name}/summary").json()
        assert body["schema"] == analysis.SCHEMA and body["population"]["events"] == 4
        assert "avg_ai_score" not in body and "modelMetrics" not in body
    assert client.get("/feature/importance").json()["items"] == []
    assert client.get("/strategy/recommendations").json()["items"] == []


def test_unavailable_targets_do_not_fabricate_a_tdi_histogram(frame):
    result = analysis.load_targets(frame)
    assert result["status"] == "unavailable" and result["histogram"] == [] and result["population"] is None


def test_real_target_histogram_and_exclusions_reconcile(tmp_path):
    # Independent synthetic temporal population, with both classes in each split.
    rows = []
    for i in range(160):
        t0 = pd.Timestamp("2023-01-01") + pd.Timedelta(days=i * 2)
        duration = 6 if i % 2 == 0 else 72
        rows.append({"video_id": f"v{i}", "event_id": 1, "T0": t0, "T_end": t0 + pd.Timedelta(hours=duration),
                     "published_at": t0 - pd.Timedelta(hours=12), "trending_duration_h": duration, "best_rank": 1,
                     "entry_rank": 10, "T0_view": 1000, "T0_comment": 20, "category_group": "Music"})
    path = tmp_path / "events.parquet"; pd.DataFrame(rows).to_parquet(path)
    prepared = prepare_data(path)
    result = analysis.target_population(prepared, {"data": prepared.manifest, "run_id": "fixture", "protocol": prepared.manifest["protocol"]})
    assert sum(row["count"] for row in result["histogram"]) == result["population"]
    assert result["population"] + result["excluded"] == len(rows)
    assert result["positive"] == sum(y.sum() for y in prepared.targets.values())
    with pytest.raises(ValueError): analysis.target_population(prepared, {"data": {}})
