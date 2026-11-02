"""Load an explicitly selected experiment and predict from genuine T0 inputs."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from .data_contract import make_features
from .artifact_contract import ArtifactError, UnsupportedCategoryError, verified_report


def predict(run_dir: Path, records: list[dict]) -> dict:
    run_dir = run_dir.resolve()
    report = verified_report(run_dir)
    frame = make_features(pd.DataFrame(records))
    supported = set(report["data"]["target"]["category_q95_train_only"])
    unknown = set(frame.category_group) - supported
    if unknown:
        raise UnsupportedCategoryError(f"Unsupported category_group: {sorted(unknown)}; supported: {sorted(supported)}")
    try:
        proba = np.asarray(model_probabilities(run_dir, report, frame), dtype=float)
    except Exception as exc:
        raise ArtifactError("Saved model could not produce valid predictions") from exc
    if proba.shape != (len(frame),) or not np.isfinite(proba).all() or ((proba < 0) | (proba > 1)).any():
        raise ArtifactError("Saved model returned invalid probabilities")
    threshold = report["selected_threshold"]
    return {"run_id": report["run_id"], "model": report["selected_model"], "target": "tdi_v2", "threshold": threshold, "predictions": [{"probability": float(value), "label": int(value >= threshold)} for value in proba]}


def model_probabilities(run_dir, report, frame):
    selected = report["selected_model"]
    if selected == "embedding_mlp":
        import torch
        from .torch_models import EmbeddingMLP, probabilities
        state = joblib.load(run_dir / "embedding_preprocessor.joblib")
        model = EmbeddingMLP(state["category_count"], state["numeric_count"])
        model.load_state_dict(torch.load(run_dir / "embedding_mlp.pt", map_location="cpu", weights_only=True))
        proba = probabilities(model, frame, state)
    elif selected == "tabnet":
        from pytorch_tabnet.tab_model import TabNetClassifier
        model = TabNetClassifier(device_name="cpu")
        model.load_model(str(run_dir / "tabnet.zip"))
        proba = model.predict_proba(joblib.load(run_dir / "tabnet_preprocessor.joblib").transform(frame).astype("float32"))[:, 1]
    else:
        bundle = joblib.load(run_dir / "sklearn_models.joblib")
        if selected == "weighted_soft_voting":
            proba = sum(bundle["pipelines"][name].predict_proba(frame)[:, 1] * weight for name, weight in bundle["weights"].items())
        else:
            proba = bundle["pipelines"][selected].predict_proba(frame)[:, 1]
    return proba


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    args = parser.parse_args()
    records = json.loads(args.input.read_text())
    print(json.dumps(predict(args.run_dir, records if isinstance(records, list) else [records]), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
