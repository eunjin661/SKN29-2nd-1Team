import json
import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import t0_verified


def client():
    app = FastAPI()
    app.include_router(t0_verified.router)
    return TestClient(app)


def test_unconfigured_experiment_returns_503(monkeypatch):
    monkeypatch.delenv("TRENDIT_T0_RUN_ID", raising=False)
    assert client().get("/predict/t0-verified/status").status_code == 503


def test_run_identifier_cannot_escape_artifact_directory(monkeypatch):
    monkeypatch.setenv("TRENDIT_T0_RUN_ID", "../models")
    assert client().get("/predict/t0-verified/status").status_code == 503


def test_initial_observation_validation_precedes_inference(monkeypatch):
    monkeypatch.delenv("TRENDIT_T0_RUN_ID", raising=False)
    record = {"T0": "2025-01-01T12:00:00+09:00", "published_at": "2025-01-02T12:00:00+09:00", "entry_rank": 10, "T0_view": 1000, "T0_comment": 5, "category_group": "Music"}
    assert client().post("/predict/t0-verified", json=record).status_code == 422


@pytest.mark.parametrize("metadata_status", ["RETIRED_TARGET_LEAKAGE", None, "missing"])
def test_retired_ensemble_binary_is_never_loaded(tmp_path, monkeypatch, metadata_status):
    from api.routes import predict as legacy
    metadata = tmp_path / "weighted_soft_voting_metadata.json"
    metadata.write_text(json.dumps({"status": metadata_status} if metadata_status else {}))
    binary = tmp_path / "weighted_soft_voting.joblib"
    binary.write_bytes(b"must never load")
    monkeypatch.setattr(legacy, "_first_existing", lambda *names: metadata if names[0] == metadata.name and metadata_status != "missing" else binary if names[0] == binary.name else None)
    calls = []
    monkeypatch.setattr(legacy, "_load_model_file", lambda path: calls.append(path))
    monkeypatch.setattr(legacy, "_CACHE", dict(legacy._CACHE, loaded=False))
    legacy._load_models(force=True)
    assert binary not in calls
    assert legacy._CACHE["ensemble"] is None


def test_missing_legacy_metrics_are_not_fabricated(monkeypatch):
    from api.routes import predict as legacy
    monkeypatch.setattr(legacy, "_load_models", lambda: None)
    monkeypatch.setattr(legacy, "_CACHE", dict(legacy._CACHE, meta={}, ensemble_meta={}))
    assert legacy.predict_status()["metadata"] == {}


@pytest.mark.parametrize("damage", ["wrong_protocol", "corrupt_json", "missing_model", "empty_hashes", "wrong_threshold", "missing_category_reference", "wrong_run_id"])
def test_invalid_experiment_never_advertises_ready(saved_run, monkeypatch, damage):
    directory, report = saved_run
    if damage == "wrong_protocol":
        report["protocol"] = "legacy"
    elif damage == "missing_model":
        (directory / "sklearn_models.joblib").unlink()
    elif damage == "empty_hashes":
        report["artifact_sha256"] = {}
    elif damage == "wrong_threshold":
        report["selected_threshold"] = 2
    elif damage == "missing_category_reference":
        report["data"]["target"]["category_q95_train_only"] = {}
    elif damage == "wrong_run_id":
        report["run_id"] = "another-run"
    (directory / "report.json").write_text("{" if damage == "corrupt_json" else json.dumps(report))
    monkeypatch.setattr(t0_verified, "ARTIFACTS", directory.parent)
    monkeypatch.setenv("TRENDIT_T0_RUN_ID", directory.name)
    assert client().get("/predict/t0-verified/status").status_code == 503


def test_status_publishes_only_training_categories(saved_run, monkeypatch):
    directory, _ = saved_run
    monkeypatch.setattr(t0_verified, "ARTIFACTS", directory.parent)
    monkeypatch.setenv("TRENDIT_T0_RUN_ID", directory.name)
    response = client().get("/predict/t0-verified/status")
    assert response.status_code == 200
    assert response.json()["supported_categories"] == ["Entertainment"]


def test_unsupported_category_is_rejected_before_model_loading(saved_run, monkeypatch):
    directory, _ = saved_run
    monkeypatch.setattr(t0_verified, "ARTIFACTS", directory.parent)
    monkeypatch.setenv("TRENDIT_T0_RUN_ID", directory.name)
    import ml.inference
    monkeypatch.setattr(ml.inference.joblib, "load", lambda *_: pytest.fail("Unsupported category must not load a model"))
    record = {"T0": "2025-01-01T12:00:00", "published_at": "2025-01-01T00:00:00", "entry_rank": 10, "T0_view": 1000, "T0_comment": 5, "category_group": "UNSUPPORTED"}
    response = client().post("/predict/t0-verified", json=record)
    assert response.status_code == 422
    assert "Unsupported category_group" in response.json()["detail"]


def test_prediction_rejects_future_and_fractional_count_inputs():
    record = {"T0": "2025-01-01T12:00:00", "published_at": "2025-01-01T00:00:00", "entry_rank": 10, "T0_view": 1000, "T0_comment": 5, "category_group": "Entertainment"}
    assert client().post("/predict/t0-verified", json=dict(record, trending_duration_h=99)).status_code == 422
    assert client().post("/predict/t0-verified", json=dict(record, T0_comment=2.5)).status_code == 422


@pytest.mark.parametrize("invalid", [True, "1000", 2**53])
def test_count_contract_matches_browser_integer_precision(invalid):
    record = {"T0": "2025-01-01T12:00:00", "published_at": "2025-01-01T00:00:00", "entry_rank": 10, "T0_view": invalid, "T0_comment": 5, "category_group": "Entertainment"}
    assert client().post("/predict/t0-verified", json=record).status_code == 422


@pytest.mark.parametrize("identifier", ["", "..", "../run", "run.with.dot", "한글", "a" * 97])
def test_training_and_api_share_run_identifier_rules(identifier):
    from ml.artifact_contract import validate_run_id
    with pytest.raises(ValueError):
        validate_run_id(identifier)


@pytest.fixture
def evaluation_run(saved_run):
    directory, report = saved_run
    split = {"rows": 10, "unique_videos": 8, "positive_rate": .5,
             "T0_min": "2025-01-01 00:00:00", "T0_max": "2025-01-02 00:00:00"}
    report["data"].update({"source_rows": 30, "label_confirmation_hours": 6,
                           "group_policy": "video_id disjoint", "timezone": "KST",
                           "splits": {name: dict(split) for name in ("train", "validation", "test")}})
    report["data"]["target"]["threshold"] = .4
    metrics = {"auc": .5, "pr_auc": .5, "f1": .5, "accuracy": .5,
               "precision": .5, "recall": .5, "confusion_matrix_tn_fp_fn_tp": [3, 2, 3, 2]}
    report["results"] = {"dummy": {"threshold_validation_f1": .5, "validation": dict(metrics), "test": dict(metrics)}}
    report["selection_rule"] = "maximum validation ROC-AUC; test never selects a model"
    report["limits"] = ["Single holdout and seed"]
    (directory / "report.json").write_text(json.dumps(report))
    return directory, report


def test_evaluation_uses_report_metrics_and_sample_counts(evaluation_run, monkeypatch):
    directory, report = evaluation_run
    monkeypatch.setattr(t0_verified, "ARTIFACTS", directory.parent)
    monkeypatch.setenv("TRENDIT_T0_RUN_ID", directory.name)
    response = client().get("/predict/t0-verified/evaluation")
    assert response.status_code == 200
    body = response.json()
    assert body["run_id"] == report["run_id"]
    assert body["models"][0]["test"] == report["results"]["dummy"]["test"]
    assert body["data"]["splits"]["test"]["rows"] == 10
    assert body["selected_threshold"] == .5
    assert body["target"]["label_threshold"] == .4


@pytest.mark.parametrize("damage", ["missing_results", "nan_metric", "negative_count", "threshold_mismatch", "wrong_matrix", "noninteger_matrix", "missing_period", "missing_limits"])
def test_incomplete_evaluation_returns_503_without_fallback(evaluation_run, monkeypatch, damage):
    directory, report = evaluation_run
    if damage == "missing_results": report.pop("results")
    elif damage == "nan_metric": report["results"]["dummy"]["test"]["auc"] = float("nan")
    elif damage == "negative_count": report["data"]["splits"]["train"]["rows"] = -1
    elif damage == "threshold_mismatch": report["results"]["dummy"]["threshold_validation_f1"] = .7
    elif damage == "wrong_matrix": report["results"]["dummy"]["test"]["confusion_matrix_tn_fp_fn_tp"] = [3, 2, 3, 1]
    elif damage == "noninteger_matrix": report["results"]["dummy"]["test"]["confusion_matrix_tn_fp_fn_tp"] = [3., 2, 3, 2]
    elif damage == "missing_period": report["data"]["splits"]["test"].pop("T0_min")
    elif damage == "missing_limits": report["limits"] = []
    (directory / "report.json").write_text(json.dumps(report))
    monkeypatch.setattr(t0_verified, "ARTIFACTS", directory.parent)
    monkeypatch.setenv("TRENDIT_T0_RUN_ID", directory.name)
    assert client().get("/predict/t0-verified/evaluation").status_code == 503
