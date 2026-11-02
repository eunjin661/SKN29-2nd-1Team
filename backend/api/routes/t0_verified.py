"""Explicit v2 inference; requires actual initial chart-entry observations."""
import os
import math
from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ml.data_contract import make_features
from ml.inference import predict
from ml.artifact_contract import ArtifactError, UnsupportedCategoryError, validate_run_id, verified_report

router = APIRouter(prefix="/predict/t0-verified", tags=["Verified T0"])
ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts"


class InitialObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    T0: datetime
    published_at: datetime
    entry_rank: int = Field(strict=True, ge=1, le=200)
    T0_view: int = Field(strict=True, ge=0, le=2**53 - 1)
    T0_comment: int = Field(strict=True, ge=0, le=2**53 - 1)
    category_group: str = Field(min_length=1)


def run_directory():
    run_id = os.getenv("TRENDIT_T0_RUN_ID", "")
    try:
        validate_run_id(run_id)
    except ValueError as exc:
        raise HTTPException(503, "TRENDIT_T0_RUN_ID에 완료된 실험 ID를 설정하세요.") from exc
    directory = ARTIFACTS / run_id
    if directory.resolve().parent != ARTIFACTS.resolve() or not (directory / "report.json").is_file():
        raise HTTPException(503, "설정된 실험을 먼저 재현하세요.")
    return directory


@router.get("/status")
def status():
    try:
        report = verified_report(run_directory())
    except ArtifactError as exc:
        raise HTTPException(503, "실험 산출물 검증에 실패했습니다. 실험을 다시 생성하세요.") from exc
    return {"run_id": report["run_id"], "status": report["status"], "selected_model": report["selected_model"], "protocol": report["protocol"], "supported_categories": sorted(report["data"]["target"]["category_q95_train_only"]), "evaluation_scope": "offline unseen-video classification"}


def evaluation_summary(report: dict) -> dict:
    """Expose report-backed metrics only; fail closed on an incomplete report."""
    def unit_interval(value):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
            raise ArtifactError("Invalid evaluation metric")
        return value

    def count(value, minimum=0):
        if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
            raise ArtifactError("Invalid evaluation sample count")
        return value

    try:
        data = report["data"]
        splits = {}
        for name in ("train", "validation", "test"):
            split = data["splits"][name]
            rows = count(split["rows"], 1)
            videos = count(split["unique_videos"], 1)
            if videos > rows:
                raise ArtifactError("Video count exceeds event count")
            splits[name] = {"rows": rows, "unique_videos": videos,
                            "positive_rate": unit_interval(split["positive_rate"]),
                            "T0_min": split["T0_min"], "T0_max": split["T0_max"]}
            if any(not isinstance(splits[name][key], str) or not splits[name][key] for key in ("T0_min", "T0_max")):
                raise ArtifactError("Missing evaluation period")
        results = report["results"]
        if not isinstance(results, dict) or not results or report["selected_model"] not in results:
            raise ArtifactError("Missing model evaluation")
        models = []
        for name, result in results.items():
            if not isinstance(name, str) or not name:
                raise ArtifactError("Invalid evaluation model name")
            row = {"name": name, "threshold": unit_interval(result["threshold_validation_f1"])}
            for split_name in ("validation", "test"):
                metrics = result[split_name]
                row[split_name] = {key: unit_interval(metrics[key]) for key in ("auc", "pr_auc", "f1", "accuracy", "precision", "recall")}
                matrix = metrics["confusion_matrix_tn_fp_fn_tp"]
                if not isinstance(matrix, list) or len(matrix) != 4 or sum(count(value) for value in matrix) != splits[split_name]["rows"]:
                    raise ArtifactError("Invalid confusion matrix")
                row[split_name]["confusion_matrix_tn_fp_fn_tp"] = matrix
            models.append(row)
        selected = next(row for row in models if row["name"] == report["selected_model"])
        if selected["threshold"] != report["selected_threshold"]:
            raise ArtifactError("Selected threshold does not match the evaluation")
        rule = report["selection_rule"]
        limits = report["limits"]
        if not isinstance(rule, str) or not rule or not isinstance(limits, list) or not limits or any(not isinstance(item, str) or not item for item in limits):
            raise ArtifactError("Missing selection rule or limitations")
        target_threshold = unit_interval(data["target"]["threshold"])
        return {
            "run_id": report["run_id"], "protocol": report["protocol"],
            "selected_model": report["selected_model"], "selected_threshold": report["selected_threshold"],
            "selection_rule": rule, "threshold_rule": "maximum validation F1; test never selects a threshold",
            "target": {"name": data["target"]["name"], "label_threshold": target_threshold,
                       "category_q95_train_only": data["target"]["category_q95_train_only"]},
            "data": {"source_rows": count(data["source_rows"], 1), "splits": splits,
                     "feature_columns": data["feature_columns"],
                     "label_confirmation_hours": count(data["label_confirmation_hours"], 1),
                     "group_policy": data["group_policy"], "timezone": data["timezone"]},
            "models": models, "limits": limits,
            "evaluation_scope": "offline unseen-video classification",
        }
    except ArtifactError:
        raise
    except (KeyError, TypeError, ValueError, AttributeError, StopIteration) as exc:
        raise ArtifactError("Evaluation report is incomplete") from exc


@router.get("/evaluation")
def evaluation():
    try:
        return evaluation_summary(verified_report(run_directory()))
    except ArtifactError as exc:
        raise HTTPException(503, "평가 보고서를 확인할 수 없습니다. 실험 산출물을 확인하세요.") from exc


@router.post("")
def predict_initial(observation: InitialObservation):
    record = observation.model_dump(mode="json")
    try:
        make_features(pd.DataFrame([record]))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    try:
        return predict(run_directory(), [record])
    except UnsupportedCategoryError as exc:
        raise HTTPException(422, str(exc)) from exc
    except ArtifactError as exc:
        raise HTTPException(503, "실험 산출물 검증에 실패했습니다. 실험을 다시 생성하세요.") from exc
