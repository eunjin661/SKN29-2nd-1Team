import json
import pickle
from pathlib import Path

import joblib
import pytest
from fastapi.testclient import TestClient


LEGACY_REQUESTS = [
    ("GET", "/model/compare"),
    ("GET", "/model/final-summary"),
    ("GET", "/model/feature-importance"),
    ("POST", "/predict/preview"),
    ("POST", "/predict/video"),
    ("POST", "/predict/bulk"),
    ("GET", "/predict/status"),
    ("POST", "/predict/reload"),
    ("GET", "/predict/lstm/status"),
    ("POST", "/predict/lstm/preview"),
    ("GET", "/video/summary"),
    ("GET", "/video/list"),
    ("GET", "/video/top"),
]


@pytest.fixture
def retirement_client():
    from api.main import app
    return TestClient(app)


@pytest.mark.parametrize("method,path", LEGACY_REQUESTS)
def test_retired_routes_never_return_metrics_predictions_or_samples(retirement_client, method, path):
    # Even a malformed former request must hit the tombstone, not an old model.
    response = retirement_client.request(method, path, content=b'{"broken":', headers={"Content-Type": "application/json"})
    assert response.status_code == 410
    body = response.json()
    assert body["ok"] is False and body["status"] == "RETIRED_LEGACY_API"
    assert body["path"] == path
    assert not {"metrics", "features", "prediction", "probability", "confidence", "items", "videos", "score"}.intersection(body)
    if body["replacement"] is not None:
        assert body["replacement"] in retirement_client.get("/openapi.json").json()["paths"]


@pytest.mark.parametrize("metadata_status", ["RETIRED_TARGET_LEAKAGE", None, "missing"])
def test_retirement_never_reads_legacy_metadata_or_deserializes_models(retirement_client, monkeypatch, metadata_status):
    reads = []
    original = Path.read_text

    def metadata_read(path, *args, **kwargs):
        if path.name == "weighted_soft_voting_metadata.json":
            reads.append(path)
            if metadata_status == "missing":
                raise FileNotFoundError(path)
            return json.dumps({"status": metadata_status} if metadata_status else {})
        return original(path, *args, **kwargs)

    def forbidden_load(*args, **kwargs):
        pytest.fail("A retired endpoint attempted model deserialization")

    monkeypatch.setattr(Path, "read_text", metadata_read)
    monkeypatch.setattr(joblib, "load", forbidden_load)
    monkeypatch.setattr(pickle, "load", forbidden_load)
    for method, path in LEGACY_REQUESTS:
        assert retirement_client.request(method, path).status_code == 410
    assert reads == []


def test_default_api_documentation_advertises_only_current_contracts(retirement_client):
    schema = retirement_client.get("/openapi.json").json()
    assert all(path not in schema["paths"] for _, path in LEGACY_REQUESTS)
    assert {"/predict/t0-verified", "/predict/t0-verified/status", "/predict/t0-verified/evaluation"}.issubset(schema["paths"])
    assert not {"VideoPredictRequest", "LSTMPredictRequest"}.intersection(schema["components"]["schemas"])


def test_status_separates_current_endpoints_from_retired_routes(retirement_client):
    from api.main import LOADED_ROUTERS
    body = retirement_client.get("/api/status").json()
    assert len(body["retired_endpoints"]) == len(LEGACY_REQUESTS)
    assert {(item["method"], item["path"]) for item in body["retired_endpoints"]} == set(LEGACY_REQUESTS)
    schema = retirement_client.get("/openapi.json").json()["paths"]
    assert all(path in schema for path in body["important_endpoints"])
    assert not {"api.routes.predict", "api.routes.predict_lstm", "api.routes.model", "api.routes.video"}.intersection(LOADED_ROUTERS)


def test_verified_api_retains_its_own_validation_and_unavailable_responses(retirement_client, monkeypatch):
    monkeypatch.delenv("TRENDIT_T0_RUN_ID", raising=False)
    assert retirement_client.get("/predict/t0-verified/status").status_code == 503
    assert retirement_client.post("/predict/t0-verified", json={}).status_code == 422
