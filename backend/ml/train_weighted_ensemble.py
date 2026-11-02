"""Run the shared leakage-controlled T0 experiment from any working directory.

python -m ml.train_weighted_ensemble --include-deep --include-tabnet
Historical binaries/metadata are never overwritten. Output lives in artifacts/.
"""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, average_precision_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from threadpoolctl import threadpool_limits

from .data_contract import FEATURES, PROTOCOL_VERSION, make_preprocessor, prepare_data, sha256_file
from .artifact_contract import validate_run_id

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
ENSEMBLE_WEIGHTS = {"xgboost": .4, "lightgbm": .35, "sklearn_mlp": .25}


def metrics(y, probabilities, threshold=.5):
    if len(np.unique(y)) != 2 or not np.isfinite(probabilities).all():
        raise ValueError("Metrics require both classes and finite probabilities")
    pred = (np.asarray(probabilities) >= threshold).astype(int)
    return {
        "auc": float(roc_auc_score(y, probabilities)), "pr_auc": float(average_precision_score(y, probabilities)),
        "f1": float(f1_score(y, pred, zero_division=0)), "accuracy": float(accuracy_score(y, pred)),
        "precision": float(precision_score(y, pred, zero_division=0)), "recall": float(recall_score(y, pred, zero_division=0)),
        "confusion_matrix_tn_fp_fn_tp": confusion_matrix(y, pred, labels=[0, 1]).ravel().tolist(),
    }


def choose_threshold(y, probabilities):
    candidates = np.round(np.arange(.05, .951, .01), 2)
    return float(max(candidates, key=lambda threshold: (f1_score(y, probabilities >= threshold, zero_division=0), -abs(threshold - .5))))


def sklearn_estimators(seed, threads):
    # No fallback to a different library/model when a dependency is missing.
    from xgboost import XGBClassifier
    from lightgbm import LGBMClassifier
    return {
        "dummy": DummyClassifier(strategy="prior"),
        "logistic": LogisticRegression(max_iter=1500, random_state=seed),
        "xgboost": XGBClassifier(n_estimators=250, max_depth=4, learning_rate=.045, subsample=.9, colsample_bytree=.9, tree_method="hist", eval_metric="logloss", random_state=seed, n_jobs=threads),
        "lightgbm": LGBMClassifier(n_estimators=280, learning_rate=.04, num_leaves=31, subsample=.9, colsample_bytree=.9, random_state=seed, n_jobs=threads, verbosity=-1, deterministic=True, force_col_wise=True),
        # Explicit shared validation is reserved for model/threshold selection.
        # Disabling sklearn's random early-stop holdout keeps temporal semantics.
        "sklearn_mlp": MLPClassifier(hidden_layer_sizes=(96, 48), alpha=.0005, learning_rate_init=.001, max_iter=250, early_stopping=False, random_state=seed),
    }


def run(args):
    if args.include_tabnet and not args.include_deep:
        raise ValueError("--include-tabnet requires --include-deep")
    if args.epochs < 1 or args.tabnet_epochs < 1 or args.threads < 1:
        raise ValueError("Epochs and threads must be positive")
    data_path = args.data.resolve()
    data = prepare_data(data_path)
    estimators = sklearn_estimators(args.seed, args.threads)
    if args.include_deep:
        import torch
    if args.include_tabnet:
        from pytorch_tabnet.tab_model import TabNetClassifier
    run_id = args.run_id or datetime.now(timezone.utc).strftime("t0-v2-%Y%m%dT%H%M%SZ")
    validate_run_id(run_id)
    output = args.output_root.resolve() / run_id
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    source_hashes = {str(path.relative_to(REPO)): sha256_file(path) for path in sorted((BACKEND / "ml").glob("*.py"))}
    head = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    data.assignments.to_csv(output / "split_assignments.csv", index=False)
    (output / "split_manifest.json").write_text(json.dumps(data.manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"run_id": run_id, "splits": data.manifest["splits"]}, ensure_ascii=False), flush=True)
    pipelines, validation, durations = {}, {}, {}
    with threadpool_limits(limits=args.threads):
        for name, estimator in estimators.items():
            tick = time.perf_counter()
            pipeline = Pipeline([("features", make_preprocessor()), ("classifier", estimator)])
            pipeline.fit(data.features["train"], data.targets["train"])
            validation[name] = pipeline.predict_proba(data.features["validation"])[:, 1]
            durations[name] = time.perf_counter() - tick
            pipelines[name] = pipeline
            print(f"{name}: validation_auc={roc_auc_score(data.targets['validation'], validation[name]):.4f} ({durations[name]:.2f}s)", flush=True)
    validation["weighted_soft_voting"] = sum(validation[name] * weight for name, weight in ENSEMBLE_WEIGHTS.items())
    durations["weighted_soft_voting"] = sum(durations[name] for name in ENSEMBLE_WEIGHTS)
    joblib.dump({"pipelines": pipelines, "weights": ENSEMBLE_WEIGHTS}, output / "sklearn_models.joblib")
    deep_model = deep_state = tabnet = tab_preprocessor = None
    if args.include_deep:
        import torch
        from .torch_models import probabilities, train_embedding
        tick = time.perf_counter()
        deep_model, deep_state = train_embedding(data.features, data.targets, seed=args.seed, epochs=args.epochs, threads=args.threads)
        validation["embedding_mlp"] = probabilities(deep_model, data.features["validation"], deep_state)
        durations["embedding_mlp"] = time.perf_counter() - tick
        torch.save(deep_model.state_dict(), output / "embedding_mlp.pt")
        joblib.dump(deep_state, output / "embedding_preprocessor.joblib")
    if args.include_tabnet:
        import torch
        from pytorch_tabnet.tab_model import TabNetClassifier
        tick = time.perf_counter()
        tab_preprocessor = make_preprocessor()
        tab_train = tab_preprocessor.fit_transform(data.features["train"]).astype("float32")
        tab_val = tab_preprocessor.transform(data.features["validation"]).astype("float32")
        tabnet = TabNetClassifier(n_d=16, n_a=16, n_steps=5, gamma=1.5, lambda_sparse=.0001, seed=args.seed, verbose=10, device_name="cpu", optimizer_fn=torch.optim.Adam, optimizer_params={"lr": .02})
        tabnet.fit(tab_train, data.targets["train"], eval_set=[(tab_val, data.targets["validation"])], eval_name=["validation"], eval_metric=["auc"], max_epochs=args.tabnet_epochs, patience=15, batch_size=256, virtual_batch_size=128, num_workers=0, drop_last=False)
        validation["tabnet"] = tabnet.predict_proba(tab_val)[:, 1]
        durations["tabnet"] = time.perf_counter() - tick
        tabnet.save_model(str(output / "tabnet"))
        joblib.dump(tab_preprocessor, output / "tabnet_preprocessor.joblib")
    # Freeze model choice and thresholds BEFORE any test predictions are made.
    selected = max(sorted(validation), key=lambda name: roc_auc_score(data.targets["validation"], validation[name]))
    thresholds = {name: choose_threshold(data.targets["validation"], proba) for name, proba in validation.items()}
    test = {name: pipeline.predict_proba(data.features["test"])[:, 1] for name, pipeline in pipelines.items()}
    test["weighted_soft_voting"] = sum(test[name] * weight for name, weight in ENSEMBLE_WEIGHTS.items())
    if deep_model is not None:
        from .torch_models import probabilities
        test["embedding_mlp"] = probabilities(deep_model, data.features["test"], deep_state)
    if tabnet is not None:
        test["tabnet"] = tabnet.predict_proba(tab_preprocessor.transform(data.features["test"]).astype("float32"))[:, 1]
    results = {}
    for name in validation:
        results[name] = {
            "fit_and_validation_seconds": round(durations[name], 3), "threshold_validation_f1": thresholds[name],
            "validation": metrics(data.targets["validation"], validation[name], thresholds[name]),
            "test": metrics(data.targets["test"], test[name], thresholds[name]),
            "test_threshold_0_5": metrics(data.targets["test"], test[name], .5),
        }
    predictions = data.frames["test"][["video_id", "event_id", "category_group"]].copy()
    predictions["target_v2"] = data.targets["test"]
    for name, proba in test.items():
        predictions[name] = proba
    predictions.to_csv(output / "test_predictions.csv", index=False)
    # Report per-category sample counts; undefined category AUC stays null.
    subgroup = {}
    for category in sorted(predictions.category_group.unique()):
        mask = predictions.category_group.to_numpy() == category
        actual = data.targets["test"][mask]
        subgroup[category] = {"rows": int(mask.sum()), "positives": int(actual.sum()), "auc": float(roc_auc_score(actual, test[selected][mask])) if len(np.unique(actual)) == 2 else None}
    versions = {}
    for package in ["numpy", "pandas", "scikit-learn", "xgboost", "lightgbm", "torch", "pytorch-tabnet", "pyarrow"]:
        try:
            versions[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            versions[package] = None
    report = {
        "run_id": run_id, "status": "OFFLINE_EVALUATION_COMPLETE", "protocol": PROTOCOL_VERSION,
        "created_at_utc": datetime.now(timezone.utc).isoformat(), "base_commit": head, "source_sha256": source_hashes,
        "data": data.manifest, "config": {"seed": args.seed, "threads": args.threads, "mlp_max_epochs": args.epochs, "tabnet_max_epochs": args.tabnet_epochs, "ensemble_weights": ENSEMBLE_WEIGHTS},
        "runtime": {"python": platform.python_version(), "platform": platform.platform(), "device": "cpu", "packages": versions},
        "selected_model": selected, "selection_rule": "maximum validation ROC-AUC; deterministic alphabetical tie break; test never selects a model",
        "selected_threshold": thresholds[selected], "results": results, "selected_test_by_category": subgroup,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "limits": ["Single chronological holdout and seed; no uncertainty interval.", "Unseen-video evaluation excludes later repeats of training/validation videos; it does not estimate returning-video performance.", "Starts from committed cleaned analysis events, not a raw YouTube collection rebuild.", "tdi_v2 uses training-only label references and recomputed T0 features, so legacy scores are not directly comparable.", "Offline classification only; no live-video timing, duration regression, 24h prediction, or business uplift validation."],
    }
    report["artifact_sha256"] = {p.name: sha256_file(p) for p in sorted(output.iterdir()) if p.is_file()}
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"output": str(output), "selected_model": selected, "test": results[selected]["test"], "elapsed_seconds": report["elapsed_seconds"]}, ensure_ascii=False, indent=2), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=BACKEND / "data/video_trending_events_analysis.parquet")
    parser.add_argument("--output-root", type=Path, default=BACKEND / "artifacts")
    parser.add_argument("--run-id")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--tabnet-epochs", type=int, default=100)
    parser.add_argument("--include-deep", action="store_true")
    parser.add_argument("--include-tabnet", action="store_true")
    return run(parser.parse_args())


if __name__ == "__main__":
    main()
