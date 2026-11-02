"""Optional diagnostics bound to the current baseline experiment."""
import json
import math
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

from api.routes.t0_verified import run_directory
from ml.artifact_contract import verified_report, validate_run_id
from ml.data_contract import sha256_file
from ml.diagnostics import METRICS, SEEDS, seed_summary

router = APIRouter(prefix="/predict/t0-verified", tags=["Verified T0 diagnostics"])
ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts"


def validate_diagnostics(data, baseline):
    def unit(value, lower=0, upper=1):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not lower <= value <= upper:
            raise ValueError("Invalid diagnostic number")
        return value
    if data["schema"] != "t0-diagnostics-v1" or data["status"] != "DIAGNOSTICS_COMPLETE" or data["base_run_id"] != baseline["run_id"] or data["dataset_sha256"] != baseline["data"]["dataset_sha256"]:
        raise ValueError("Diagnostic and baseline identity differ")
    rows = data["seed_results"]
    if data["seeds"] != SEEDS or [row["seed"] for row in rows] != SEEDS:
        raise ValueError("Seed result population is incomplete")
    for row in rows:
        unit(row["threshold_validation_f1"])
        for split in ["validation", "test"]:
            for key in METRICS: unit(row[split][key])
            matrix = row[split]["confusion_matrix_tn_fp_fn_tp"]
            if len(matrix) != 4 or any(isinstance(x, bool) or not isinstance(x, int) or x < 0 for x in matrix) or sum(matrix) != baseline["data"]["splits"][split]["rows"]:
                raise ValueError("Seed confusion matrix population differs")
    summary = seed_summary(rows)
    if summary != data["test_seed_summary"]: raise ValueError("Seed summary does not match all five runs")
    bootstrap = data["bootstrap"]
    if bootstrap["attempted"] != 2000 or not isinstance(bootstrap["valid"], int) or bootstrap["valid"] < 2 or bootstrap["valid"] + bootstrap["skipped_single_class"] != 2000 or bootstrap["confidence"] != .95 or bootstrap["events"] != baseline["data"]["splits"]["test"]["rows"] or bootstrap["videos"] != baseline["data"]["splits"]["test"]["unique_videos"]:
        raise ValueError("Bootstrap population differs")
    expected_thresholds = {name: baseline["results"][name]["threshold_validation_f1"] for name in ["logistic", "embedding_mlp"]}
    if bootstrap["thresholds_fixed_before_resampling"] != expected_thresholds: raise ValueError("Bootstrap threshold differs")
    for name in ["logistic", "embedding_mlp", "embedding_minus_logistic"]:
        for key in METRICS:
            bounds = bootstrap["intervals"][name][key]
            lower = unit(bounds["lower"], -1 if name == "embedding_minus_logistic" else 0)
            if lower > unit(bounds["upper"], -1 if name == "embedding_minus_logistic" else 0): raise ValueError("Reversed interval")
    curve = data["validation_threshold_curve"]
    if len(curve) != 91 or any(not math.isclose(point["threshold"], round(.05 + i * .01, 2), abs_tol=1e-12) for i, point in enumerate(curve)):
        raise ValueError("Validation threshold curve is incomplete")
    for point in curve:
        for key in ["precision", "recall", "f1"]: unit(point[key])
    original = baseline["results"]["embedding_mlp"]
    selected = next(point for point in curve if point["threshold"] == baseline["selected_threshold"])
    if any(not math.isclose(selected[key], original["validation"][key], abs_tol=1e-12) for key in ["precision", "recall", "f1"]) or data["baseline_test"] != original["test"]:
        raise ValueError("Original metrics differ")
    if not isinstance(data["limits"], list) or not data["limits"] or any(not isinstance(x, str) or not x for x in data["limits"]): raise ValueError("Missing diagnostic limits")
    return {"schema": data["schema"], "run_id": data["run_id"], "base_run_id": data["base_run_id"], "dataset_sha256": data["dataset_sha256"],
            "seeds": data["seeds"], "seed_results": [{key: row[key] for key in ["seed", "threshold_validation_f1", "validation", "test", "source"]} for row in rows],
            "test_seed_summary": summary, "bootstrap": bootstrap, "validation_threshold_curve": curve,
            "baseline_test": data["baseline_test"], "baseline_selected_threshold": baseline["selected_threshold"], "limits": data["limits"]}


@router.get("/diagnostics")
def diagnostics():
    try:
        run_id = validate_run_id(os.getenv("TRENDIT_T0_DIAGNOSTICS_ID", ""))
        folder = (ARTIFACTS / run_id).resolve()
        if folder.parent != ARTIFACTS.resolve(): raise ValueError("Invalid diagnostic directory")
        data = json.loads((folder / "report.json").read_text())
        base_dir = run_directory()
        baseline = verified_report(base_dir)
        if data["run_id"] != run_id or data["baseline_report_sha256"] != sha256_file(base_dir / "report.json"):
            raise ValueError("Diagnostic identity differs")
        hashes = data["artifact_sha256"]
        if not isinstance(hashes, dict) or not {"protocol.json", "bootstrap.json", "validation_threshold_curve.json"}.issubset(hashes):
            raise ValueError("Missing diagnostic evidence")
        for name, expected in hashes.items():
            path = (folder / name).resolve()
            if not path.is_relative_to(folder) or not path.is_file() or sha256_file(path) != expected:
                raise ValueError("Diagnostic evidence changed")
        return validate_diagnostics(data, baseline)
    except (ValueError, OSError, KeyError, TypeError, AttributeError, StopIteration) as exc:
        raise HTTPException(503, "추가 진단 보고서를 확인할 수 없습니다. 현재 기준 실험과 진단 ID·산출물을 확인하세요.") from exc
