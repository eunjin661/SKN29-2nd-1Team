"""Predeclared seed sensitivity and paired video-cluster bootstrap diagnostics.

This diagnoses a previously inspected holdout. It never selects a replacement
model or threshold from Test, and is not a new external-period evaluation.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

from .artifact_contract import verified_report, validate_run_id
from .data_contract import prepare_data, sha256_file
from .train_weighted_ensemble import choose_threshold, metrics

SEEDS = [13, 29, 42, 73, 101]
METRICS = ["auc", "pr_auc", "f1", "precision", "recall"]
BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    temporary.replace(path)


def weighted_metrics(y, probability, threshold, weights):
    positive = probability >= threshold
    tp = float(weights[(y == 1) & positive].sum())
    fp = float(weights[(y == 0) & positive].sum())
    fn = float(weights[(y == 1) & ~positive].sum())
    return {"auc": float(roc_auc_score(y, probability, sample_weight=weights)),
            "pr_auc": float(average_precision_score(y, probability, sample_weight=weights)),
            "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.,
            "precision": tp / (tp + fp) if tp + fp else 0., "recall": tp / (tp + fn) if tp + fn else 0.}


def paired_bootstrap(y, video_ids, predictions, thresholds, *, repeats=2000, seed=20261023):
    if repeats < 2 or len(y) != len(video_ids) or len(np.unique(y)) != 2:
        raise ValueError("Bootstrap requires aligned two-class rows and at least two repetitions")
    names = ["logistic", "embedding_mlp"]
    if any(len(predictions[name]) != len(y) or not np.isfinite(predictions[name]).all() for name in names):
        raise ValueError("Bootstrap predictions must align and be finite")
    unique, inverse = np.unique(video_ids.astype(str), return_inverse=True)
    rng = np.random.default_rng(seed)
    samples = {name: {key: [] for key in METRICS} for name in [*names, "embedding_minus_logistic"]}
    skipped = 0
    for index in range(repeats):
        # Repeating a sampled video repeats ALL its events, using identical
        # multiplicities for the two models. Row counts may vary by replicate.
        weights = np.bincount(rng.integers(0, len(unique), size=len(unique)), minlength=len(unique))[inverse]
        if weights[y == 1].sum() == 0 or weights[y == 0].sum() == 0:
            skipped += 1
            continue
        result = {name: weighted_metrics(y, predictions[name], thresholds[name], weights) for name in names}
        for key in METRICS:
            for name in names: samples[name][key].append(result[name][key])
            samples["embedding_minus_logistic"][key].append(result["embedding_mlp"][key] - result["logistic"][key])
        if (index + 1) % 500 == 0: print(f"paired video bootstrap {index + 1}/{repeats}", flush=True)
    valid = repeats - skipped
    if valid < 2: raise ValueError("Too few two-class bootstrap samples")
    intervals = {name: {key: {"lower": float(np.quantile(values, .025)), "upper": float(np.quantile(values, .975))}
                        for key, values in by_metric.items()} for name, by_metric in samples.items()}
    return {"method": "paired video_id cluster percentile bootstrap", "seed": seed, "attempted": repeats,
            "valid": valid, "skipped_single_class": skipped, "confidence": .95, "events": len(y), "videos": len(unique),
            "thresholds_fixed_before_resampling": thresholds, "intervals": intervals,
            "limits": "Conditional uncertainty of this observed holdout; not future-period uncertainty or cross-seed confidence intervals"}


def seed_summary(rows):
    if len(rows) < 2: raise ValueError("Seed variability requires at least two runs")
    return {key: {"mean": float(np.mean([row["test"][key] for row in rows])),
                  "std_sample": float(np.std([row["test"][key] for row in rows], ddof=1)),
                  "min": float(min(row["test"][key] for row in rows)), "max": float(max(row["test"][key] for row in rows))} for key in METRICS}


def run(args):
    from .torch_models import EmbeddingMLP, probabilities, train_embedding
    import torch

    baseline = args.run_dir.resolve()
    report = verified_report(baseline)
    if report["selected_model"] != "embedding_mlp" or report["config"]["seed"] != 42:
        raise ValueError("This predeclared diagnostic requires the original selected seed-42 Embedding MLP")
    data = prepare_data(args.data.resolve())
    if data.manifest != report["data"]: raise ValueError("Data contract or split differs from the frozen baseline")
    for name, expected in report["source_sha256"].items():
        if sha256_file(ROOT / name) != expected: raise ValueError(f"Baseline source changed: {name}")
    validate_run_id(args.run_id)
    output = args.output_root / args.run_id
    protocol = {"schema": "t0-diagnostics-v1", "run_id": args.run_id, "base_run_id": report["run_id"],
                "baseline_report_sha256": sha256_file(baseline / "report.json"), "dataset_sha256": data.manifest["dataset_sha256"],
                "seeds": SEEDS, "model_family_fixed": "embedding_mlp", "epochs": report["config"]["mlp_max_epochs"],
                "threads": report["config"]["threads"], "threshold_policy": "Per-seed maximum Validation F1 on the unchanged 0.05:0.01:0.95 grid",
                "bootstrap_repeats": 2000, "bootstrap_seed": 20261023, "bootstrap_unit": "video_id", "confidence": .95,
                "baseline_sources": report["source_sha256"], "diagnostic_source_sha256": sha256_file(Path(__file__)),
                "production_model_selection": "Unchanged; no seed or threshold chosen from Test"}
    if output.exists():
        if not args.resume or json.loads((output / "protocol.json").read_text()) != protocol:
            raise ValueError("Use a new diagnostic ID, or resume the exact frozen protocol")
    else:
        output.mkdir(parents=True)
        write_json(output / "protocol.json", protocol)
    started = time.perf_counter()
    torch.set_num_threads(protocol["threads"])
    state = joblib.load(baseline / "embedding_preprocessor.joblib")
    model = EmbeddingMLP(state["category_count"], state["numeric_count"])
    model.load_state_dict(torch.load(baseline / "embedding_mlp.pt", map_location="cpu", weights_only=True))
    saved = pd.read_csv(baseline / "test_predictions.csv")
    expected_keys = data.frames["test"][["video_id", "event_id"]].reset_index(drop=True)
    if len(saved) != len(expected_keys) or not np.array_equal(saved.video_id.astype(str).to_numpy(), expected_keys.video_id.astype(str).to_numpy()) or not np.array_equal(saved.event_id.to_numpy(), expected_keys.event_id.to_numpy()) or not np.array_equal(saved.target_v2.to_numpy(), data.targets["test"]):
        raise ValueError("Saved Test prediction rows do not match the prepared holdout")
    current = probabilities(model, data.features["test"], state)
    discrepancy = float(np.max(np.abs(current - saved.embedding_mlp.to_numpy())))
    if discrepancy > 1e-12: raise ValueError("Seed-42 reload differs from recorded Test predictions")
    val42 = probabilities(model, data.features["validation"], state)
    if choose_threshold(data.targets["validation"], val42) != report["selected_threshold"]:
        raise ValueError("Validation threshold differs after baseline reload")
    rows = []
    for seed in SEEDS:
        folder = output / f"seed-{seed}"; folder.mkdir(exist_ok=True)
        complete = folder / "result.json"
        if complete.exists():
            row = json.loads(complete.read_text())
            for name, expected in row["artifact_sha256"].items():
                if sha256_file(folder / name) != expected: raise ValueError("Resumed seed artifacts changed")
            rows.append(row); print(f"reused completed diagnostic seed {seed}", flush=True); continue
        tick = time.perf_counter()
        if seed == 42:
            candidate, preprocessing, validation, test = model, state, val42, current
            source = "reused original verified seed-42 checkpoint; not retrained"
        else:
            candidate, preprocessing = train_embedding(data.features, data.targets, seed=seed, epochs=protocol["epochs"], threads=protocol["threads"])
            validation = probabilities(candidate, data.features["validation"], preprocessing)
            test = probabilities(candidate, data.features["test"], preprocessing)
            source = "new diagnostic training with frozen model family and procedure"
        threshold = choose_threshold(data.targets["validation"], validation)
        frame = expected_keys.copy(); frame["target_v2"] = data.targets["test"]; frame["probability"] = test
        frame.to_csv(folder / "test_predictions.csv", index=False)
        pd.DataFrame({"target_v2": data.targets["validation"], "probability": validation}).to_csv(folder / "validation_predictions.csv", index=False)
        torch.save(candidate.state_dict(), folder / "embedding_mlp.pt")
        joblib.dump(preprocessing, folder / "embedding_preprocessor.joblib")
        row = {"seed": seed, "source": source, "threshold_validation_f1": threshold,
               "validation": metrics(data.targets["validation"], validation, threshold), "test": metrics(data.targets["test"], test, threshold),
               "training": preprocessing["training"], "elapsed_seconds": round(time.perf_counter() - tick, 3),
               "artifact_sha256": {p.name: sha256_file(p) for p in folder.iterdir() if p.is_file() and p.name != "result.json"}}
        write_json(complete, row); rows.append(row)
        print(f"completed seed {seed}: val AUC={row['validation']['auc']:.6f}, test AUC={row['test']['auc']:.6f}", flush=True)
    logistic_threshold = report["results"]["logistic"]["threshold_validation_f1"]
    bootstrap = paired_bootstrap(data.targets["test"], saved.video_id.to_numpy(),
                                 {"logistic": saved.logistic.to_numpy(), "embedding_mlp": saved.embedding_mlp.to_numpy()},
                                 {"logistic": logistic_threshold, "embedding_mlp": report["selected_threshold"]})
    write_json(output / "bootstrap.json", bootstrap)
    curve = [{"threshold": float(threshold), **{key: value for key, value in metrics(data.targets["validation"], val42, threshold).items() if key in ["f1", "precision", "recall"]}} for threshold in np.round(np.arange(.05, .951, .01), 2)]
    write_json(output / "validation_threshold_curve.json", curve)
    result = {**protocol, "status": "DIAGNOSTICS_COMPLETE", "created_at_utc": datetime.now(timezone.utc).isoformat(),
              "seed_results": rows, "test_seed_summary": seed_summary(rows), "bootstrap": bootstrap,
              "validation_threshold_curve": curve, "baseline_test": report["results"]["embedding_mlp"]["test"],
              "baseline_reload_max_absolute_difference": discrepancy, "runtime": {"python": platform.python_version(), "torch": torch.__version__, "device": "cpu"},
              "elapsed_seconds": round(time.perf_counter() - started, 3),
              "limits": ["The original Test holdout has already been inspected; this is diagnostic reuse, not new external validation",
                         "Five seeds measure training variability with the same split; they are not independent Test datasets",
                         "Video-cluster bootstrap intervals condition on this period and fixed fitted models",
                         "No Test-based seed selection, production model replacement, calibration, causal or business uplift claim"],
              "artifact_sha256": {str(p.relative_to(output)): sha256_file(p) for p in output.rglob('*') if p.is_file() and p.name != "report.json"}}
    write_json(output / "report.json", result)
    print(json.dumps({"status": result["status"], "seed_summary": result["test_seed_summary"], "bootstrap_valid": bootstrap["valid"], "elapsed_seconds": result["elapsed_seconds"]}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=BACKEND / "data/video_trending_events_analysis.parquet")
    parser.add_argument("--output-root", type=Path, default=BACKEND / "artifacts")
    parser.add_argument("--run-id", default="t0-v2-diagnostics-20261023")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    try: run(args)
    except Exception as exc:
        try:
            validate_run_id(args.run_id)
            output = args.output_root.resolve() / args.run_id
            if output.is_dir(): write_json(output / "failure.json", {"time": datetime.now(timezone.utc).isoformat(), "type": type(exc).__name__, "message": str(exc)})
        except ValueError:
            pass
        raise


if __name__ == "__main__": main()
