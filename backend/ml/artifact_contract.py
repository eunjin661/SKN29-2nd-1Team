"""Shared experiment validation for training IDs, status checks and inference."""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

from .data_contract import FEATURES, PROTOCOL_VERSION, sha256_file


class ArtifactError(ValueError):
    """A completed experiment is missing, incompatible, or damaged."""


class UnsupportedCategoryError(ValueError):
    """An inference category was not present in the training reference."""


def validate_run_id(value: str) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[A-Za-z0-9_-]{1,96}", value) is None:
        raise ValueError("run-id must contain 1-96 ASCII letters, numbers, underscores or hyphens")
    return value


def verified_report(run_dir: Path) -> dict:
    """Validate required artifacts before advertising readiness or unpickling."""
    run_dir = run_dir.resolve()
    try:
        report = json.loads((run_dir / "report.json").read_text(encoding="utf-8"))
        if not isinstance(report, dict):
            raise ArtifactError("Report must be an object")
        if report.get("status") != "OFFLINE_EVALUATION_COMPLETE" or report.get("protocol") != PROTOCOL_VERSION:
            raise ArtifactError("Only completed v2 experiments are accepted")
        if validate_run_id(report.get("run_id")) != run_dir.name:
            raise ArtifactError("Experiment identifier does not match its directory")
        selected = report.get("selected_model")
        required = {
            "dummy": {"sklearn_models.joblib"}, "logistic": {"sklearn_models.joblib"},
            "xgboost": {"sklearn_models.joblib"}, "lightgbm": {"sklearn_models.joblib"},
            "sklearn_mlp": {"sklearn_models.joblib"}, "weighted_soft_voting": {"sklearn_models.joblib"},
            "embedding_mlp": {"embedding_mlp.pt", "embedding_preprocessor.joblib"},
            "tabnet": {"tabnet.zip", "tabnet_preprocessor.joblib"},
        }
        if not isinstance(selected, str) or selected not in required:
            raise ArtifactError("Unsupported selected model")
        threshold = report.get("selected_threshold")
        if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not math.isfinite(threshold) or not 0 <= threshold <= 1:
            raise ArtifactError("Invalid selected threshold")
        data = report.get("data", {})
        if data.get("feature_columns") != list(FEATURES) or data.get("target", {}).get("name") != "tdi_v2":
            raise ArtifactError("Incompatible feature or target contract")
        categories = data["target"].get("category_q95_train_only")
        if not isinstance(categories, dict) or not categories:
            raise ArtifactError("Missing training category reference")
        if any(not isinstance(key, str) or not key.strip() or isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0 for key, value in categories.items()):
            raise ArtifactError("Invalid training category reference")
        hashes = report.get("artifact_sha256")
        if not isinstance(hashes, dict) or not required[selected].issubset(hashes):
            raise ArtifactError("Required artifact checksums are missing")
        for name, expected in hashes.items():
            if not isinstance(name, str) or Path(name).name != name or name in {".", ".."}:
                raise ArtifactError("Invalid artifact filename")
            path = (run_dir / name).resolve()
            if path.parent != run_dir:
                raise ArtifactError("Artifact must stay inside its experiment directory")
            if not isinstance(expected, str) or re.fullmatch(r"[0-9a-fA-F]{64}", expected) is None:
                raise ArtifactError("Invalid artifact checksum")
            if not path.is_file() or sha256_file(path).lower() != expected.lower():
                raise ArtifactError(f"Artifact checksum mismatch: {name}")
        return report
    except ArtifactError:
        raise
    except (OSError, UnicodeError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise ArtifactError("Experiment report or artifacts are invalid") from exc
