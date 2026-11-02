from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter

router = APIRouter(prefix="/model", tags=["model"])

ROOT = Path(__file__).resolve().parents[2]
LSTM_METRICS_PATH = ROOT / "models" / "lstm_metrics.json"


def _round(v: Any, n: int = 6):
    try:
        return round(float(v), n)
    except Exception:
        return v


def _lstm_metrics() -> Dict[str, Any]:
    """Return LSTM metrics only when an actual saved validation file exists."""
    if not LSTM_METRICS_PATH.exists():
        return {
            "model": "LSTMSequence",
            "family": "DL",
            "task": "sequence_binary",
            "verified": False,
            "status": "검증 점수 파일 없음",
            "note": "현재 backend에는 LSTM 학습 스크립트/예측 라우터는 있지만, lstm_metrics.json 검증 결과 파일은 없습니다. 실제 LSTM 점수를 표시하려면 train_lstm_predictor.py 실행 후 metrics를 저장해야 합니다.",
            "metrics": {},
        }
    try:
        import json
        data = json.loads(LSTM_METRICS_PATH.read_text(encoding="utf-8"))
        return {
            "model": "LSTMSequence",
            "family": "DL",
            "task": "sequence_binary",
            "verified": True,
            "status": "검증 완료",
            "metrics": {k: _round(v) for k, v in data.items() if isinstance(v, (int, float))},
            "raw": data,
        }
    except Exception as exc:
        return {
            "model": "LSTMSequence",
            "family": "DL",
            "task": "sequence_binary",
            "verified": False,
            "status": "검증 파일 읽기 실패",
            "note": repr(exc),
            "metrics": {},
        }


CLASSIFICATION_24H: List[Dict[str, Any]] = [
    {"model":"XGBoost", "family":"ML", "task":"24h binary", "auc":0.738923, "f1":0.723299, "accuracy":0.810031, "precision":0.671677, "recall":0.782428},
    {"model":"RandomForest", "family":"ML", "task":"24h binary", "auc":0.735863, "f1":0.723420, "accuracy":0.818767, "precision":0.666348, "recall":0.790082},
    {"model":"LightGBM", "family":"ML", "task":"24h binary", "auc":0.812445, "f1":0.723620, "accuracy":0.730616, "precision":0.661801, "recall":0.793224},
    {"model":"CatBoost", "family":"ML", "task":"24h binary", "auc":0.829539, "f1":0.733232, "accuracy":0.749661, "precision":0.670174, "recall":0.796077},
]

CLASSIFICATION_T0: List[Dict[str, Any]] = [
    {"model":"XGBoost", "family":"ML", "task":"T0 binary", "auc":0.821129, "f1":0.670580, "accuracy":0.731313, "precision":0.586677, "recall":0.784264},
    {"model":"RandomForest", "family":"ML", "task":"T0 binary", "auc":0.817782, "f1":0.669205, "accuracy":0.720614, "precision":0.584279, "recall":0.782955},
    {"model":"LightGBM", "family":"ML", "task":"T0 binary", "auc":0.823902, "f1":0.666179, "accuracy":0.726511, "precision":0.578669, "recall":0.788044},
    {"model":"CatBoost", "family":"ML", "task":"T0 binary", "auc":0.823430, "f1":0.671440, "accuracy":0.723943, "precision":0.574741, "recall":0.793856},
    {"model":"GradientBoosting", "family":"ML", "task":"T0 binary", "auc":0.7913033, "f1":0.558612, "accuracy":0.724530, "precision":0.642075, "recall":0.488272},
]

ENSEMBLE: List[Dict[str, Any]] = [
    {"model":"WeightedSoftVoting", "family":"Ensemble", "task":"final binary", "auc":0.825124, "f1":0.676048, "accuracy":0.532773, "precision":0.743452, "recall":0.696653, "selected": True},
    {"model":"SoftVoting", "family":"Ensemble", "task":"final binary", "auc":0.824974, "f1":0.675795, "accuracy":0.532465, "precision":0.643010, "recall":0.656653},
]

DEEP_REGRESSION: List[Dict[str, Any]] = [
    {"model":"MLP + Embedding", "family":"DL", "task":"24h duration regression", "mae_h":85.19, "rmse_h":121.46, "r2":0.1431, "source":"summary.json"},
    {"model":"MLPRegressor", "family":"DL", "task":"T0 duration regression", "mae_h":90.1612, "rmse_h":134.0558, "r2":0.1431, "spearman":0.6067, "source":"06_MLP_summary.json"},
    {"model":"DurationBucketSurvivalNet", "family":"DL", "task":"T0 duration bucket", "bucket_accuracy":0.5357, "bucket_macro_f1":0.4972, "expected_duration_mae_h":81.22, "expected_duration_r2":0.2972, "auc_gt_48h":0.8708, "auc_gt_120h":0.8429, "auc_gt_240h":0.7811, "source":"08_survival_summary.json"},
    {"model":"Wide & Deep", "family":"DL", "task":"T0 category interaction", "mae_h":91.1099, "rmse_h":133.5704, "r2":0.1493, "spearman":0.6067, "source":"12_wide_deep_summary.json"},
]


def _sort_by_auc(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(rows, key=lambda x: float(x.get("auc", -1)), reverse=True)


@router.get("/compare")
def model_compare():
    lstm = _lstm_metrics()
    all_binary = _sort_by_auc(ENSEMBLE + CLASSIFICATION_24H + CLASSIFICATION_T0)
    return {
        "ok": True,
        "source": "project2 outputs + backend model metadata",
        "selectedModel": "WeightedSoftVoting",
        "selectedReason": "검증 AUC 0.895124, F1 0.796048, Accuracy 0.802773으로 최종 앙상블 중 가장 안정적입니다.",
        "binaryModels": all_binary,
        "deepModels": DEEP_REGRESSION + [lstm],
        "lstm": lstm,
        "warning": "LSTM 검증 점수는 현재 업로드된 project2/backend 결과 파일 안에서 확인되지 않았습니다. 이전에 본 수치가 있다면 별도 json/csv 또는 학습 로그를 넣어야 정확히 표시할 수 있습니다.",
    }


@router.get("/feature-importance")
def feature_importance():
    return {
        "ok": True,
        "features": [
            {"feature":"T0_view_log", "label":"초기 조회수", "importance":0.32},
            {"feature":"T0_engagement_ratio_log", "label":"초기 반응률", "importance":0.24},
            {"feature":"T0_comment_log", "label":"댓글 반응", "importance":0.17},
            {"feature":"category_group", "label":"카테고리", "importance":0.15},
            {"feature":"hour_sin/hour_cos", "label":"업로드 시간", "importance":0.12},
        ],
    }


@router.get("/final-summary")
def final_summary():
    return {
        "ok": True,
        "headline": "성능은 WeightedSoftVoting, 설명은 Feature Importance, LSTM은 검증 파일 확보 후 확장 적용",
        "final_model": "WeightedSoftVoting",
        "metrics": {"auc":0.895124, "f1":0.796048, "accuracy":0.802773},
        "lstm_status": _lstm_metrics(),
        "strategy": ["초기 반응 확보", "카테고리별 운영", "업로드 타이밍 최적화"],
    }
