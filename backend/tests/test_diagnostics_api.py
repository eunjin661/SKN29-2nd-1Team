import copy
import numpy as np
import pytest
from fastapi import HTTPException

from api.routes import diagnostics as route
from ml.diagnostics import SEEDS, METRICS, seed_summary


@pytest.fixture
def reports():
    metrics = {**{key: .5 for key in METRICS}, "confusion_matrix_tn_fp_fn_tp": [1, 1, 1, 1]}
    base = {"run_id": "baseline", "selected_threshold": .44, "data": {"dataset_sha256": "a" * 64, "splits": {name: {"rows": 4, "unique_videos": 2} for name in ["validation", "test"]}},
            "results": {name: {"threshold_validation_f1": .44 if name == "embedding_mlp" else .5, "validation": copy.deepcopy(metrics), "test": copy.deepcopy(metrics)} for name in ["logistic", "embedding_mlp"]}}
    rows = [{"seed": seed, "threshold_validation_f1": .44, "validation": copy.deepcopy(metrics), "test": copy.deepcopy(metrics), "source": "unit fixture"} for seed in SEEDS]
    data = {"schema": "t0-diagnostics-v1", "status": "DIAGNOSTICS_COMPLETE", "run_id": "diagnostic", "base_run_id": "baseline", "dataset_sha256": "a" * 64,
            "seeds": SEEDS, "seed_results": rows, "test_seed_summary": seed_summary(rows), "baseline_test": copy.deepcopy(metrics), "limits": ["unit fixture"],
            "validation_threshold_curve": [{"threshold": round(.05 + i * .01, 2), "precision": .5, "recall": .5, "f1": .5} for i in range(91)],
            "bootstrap": {"attempted": 2000, "valid": 2000, "skipped_single_class": 0, "confidence": .95, "events": 4, "videos": 2,
                          "thresholds_fixed_before_resampling": {"logistic": .5, "embedding_mlp": .44},
                          "intervals": {name: {key: {"lower": -.1 if name == "embedding_minus_logistic" else .2, "upper": .8} for key in METRICS} for name in ["logistic", "embedding_mlp", "embedding_minus_logistic"]}}}
    return data, base


def test_complete_diagnostics_are_bound_to_current_baseline(reports):
    data, base = reports
    result = route.validate_diagnostics(data, base)
    assert result["base_run_id"] == "baseline" and len(result["seed_results"]) == 5
    assert result["baseline_selected_threshold"] == .44


@pytest.mark.parametrize("damage", ["seed", "base", "dataset", "interval_nan", "interval_reversed", "bootstrap_count", "curve", "confusion", "summary"])
def test_damaged_diagnostics_cannot_be_presented_as_valid_metrics(reports, damage):
    data, base = reports
    if damage == "seed": data["seed_results"].pop()
    elif damage == "base": data["base_run_id"] = "other"
    elif damage == "dataset": data["dataset_sha256"] = "b" * 64
    elif damage == "interval_nan": data["bootstrap"]["intervals"]["embedding_mlp"]["auc"]["lower"] = np.nan
    elif damage == "interval_reversed": data["bootstrap"]["intervals"]["embedding_mlp"]["auc"]["lower"] = .9
    elif damage == "bootstrap_count": data["bootstrap"]["valid"] = 0
    elif damage == "curve": data["validation_threshold_curve"].pop()
    elif damage == "confusion": data["seed_results"][0]["test"]["confusion_matrix_tn_fp_fn_tp"] = [1, 1, 1, 2]
    elif damage == "summary": data["test_seed_summary"]["auc"]["mean"] = .99
    with pytest.raises(ValueError): route.validate_diagnostics(data, base)


def test_unconfigured_or_path_like_diagnostic_id_returns_503(monkeypatch):
    for value in ["", "../outside"]:
        monkeypatch.setenv("TRENDIT_T0_DIAGNOSTICS_ID", value)
        with pytest.raises(HTTPException) as error: route.diagnostics()
        assert error.value.status_code == 503
