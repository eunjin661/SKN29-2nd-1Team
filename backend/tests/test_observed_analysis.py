import pandas as pd
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from api.routes import sustain
from api.services import data_loader


@pytest.fixture
def observed_client(monkeypatch):
    frame = pd.DataFrame({
        "video_id": ["a", "b", "a"], "event_id": [1, 1, 2],
        "title": ["[live] Music", "Other", "Replay"],
        "category_group": ["Music", "News", "Music"],
        "trending_duration_h": [24., 48., 72.], "entry_rank": [3, 2, 1],
        "T0": pd.to_datetime(["2025-01-01", "2025-01-02", "2025-01-03"]),
    })
    monkeypatch.setattr(sustain, "get_df", lambda: frame)
    app = FastAPI()
    app.include_router(sustain.router)
    return TestClient(app)


def test_observed_summary_uses_duration_data_without_invented_predictions(observed_client):
    response = observed_client.get("/sustain/summary")
    assert response.status_code == 200
    body = response.json()
    assert body["analysis_scope"] == "historical_observations_only"
    assert body["stats"]["median"] == 48.
    assert body["dataScale"] == {"snapshots": None, "events": 3, "videos": 2, "reentries": 1}
    assert body["modelMetrics"] == {} and body["modelCompare"] == [] and body["featureImportance"] == []
    assert not any("score" in row or "pred" in row for row in body["videos"])
    assert next(row for row in body["categoryDuration"] if row["category"] == "Music")["duration"] == 48.


def test_observed_video_search_is_literal_and_filtered_empty_is_empty(observed_client):
    response = observed_client.get("/sustain/videos", params={"search": "[", "category": "Music"})
    assert response.status_code == 200 and response.json()["count"] == 1
    assert response.json()["items"][0]["title"] == "[live] Music"
    assert observed_client.get("/sustain/videos", params={"search": ".*"}).json()["items"] == []
    assert observed_client.get("/sustain/videos", params={"category": "missing"}).json()["items"] == []


@pytest.mark.parametrize("damage", ["missing_data", "missing_columns", "invalid_durations"])
def test_unavailable_observations_return_503_without_example_rows(observed_client, monkeypatch, damage):
    def unavailable():
        raise HTTPException(503, "missing data")
    if damage == "missing_data": monkeypatch.setattr(sustain, "get_df", unavailable)
    elif damage == "missing_columns": monkeypatch.setattr(sustain, "get_df", lambda: pd.DataFrame({"video_id": ["a"]}))
    else: monkeypatch.setattr(sustain, "get_df", lambda: pd.DataFrame({"video_id": ["a"], "category": ["Music"], "duration_h": [float("nan")]}))
    for path in ["/sustain/summary", "/sustain/videos"]:
        response = observed_client.get(path)
        assert response.status_code == 503 and "fallback" not in response.text


def test_application_startup_preloads_observations(monkeypatch):
    from api import main
    called = []
    monkeypatch.setattr(data_loader, "preload_all", lambda: called.append(True))
    monkeypatch.setattr(data_loader, "get_df", lambda: pd.DataFrame({"video_id": ["a"]}))
    with TestClient(main.app) as client:
        assert called == [True]
        assert client.get("/api/status").json()["analysis_data"]["status"] == "ready"


def test_missing_optional_analysis_does_not_stop_the_api(monkeypatch):
    from api import main
    monkeypatch.setattr(data_loader, "preload_all", lambda: None)
    monkeypatch.setattr(data_loader, "_df", None)
    with TestClient(main.app) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/api/status").json()["analysis_data"]["status"] == "unavailable"


def test_reload_cannot_keep_a_previous_missing_dataset(tmp_path, monkeypatch):
    monkeypatch.setattr(data_loader, "ANALYSIS_PATH", tmp_path / "missing.parquet")
    monkeypatch.setattr(data_loader, "T0_MODEL_PATH", tmp_path / "missing-t0.parquet")
    monkeypatch.setattr(data_loader, "H24_MODEL_PATH", tmp_path / "missing-24h.parquet")
    monkeypatch.setattr(data_loader, "_df", pd.DataFrame({"old": [1]}))
    data_loader.preload_all()
    with pytest.raises(HTTPException) as error:
        data_loader.get_df()
    assert error.value.status_code == 503
