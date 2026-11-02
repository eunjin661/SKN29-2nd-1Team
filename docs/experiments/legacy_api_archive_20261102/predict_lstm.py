from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/predict/lstm", tags=["predict-lstm"])

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "models"
LSTM_MODEL_PATH = MODELS_DIR / "lstm_trend_sequence.keras"

_CACHE: Dict[str, Any] = {"model": None, "loaded": False, "error": None}


class LSTMPredictRequest(BaseModel):
    category: str = "Entertainment"
    view_count: float = 300000
    comment_count: float = 1200
    published_hour: int = 20
    published_weekday: int = 5
    view_growth_24h: Optional[float] = None


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        value = float(value)
        if math.isnan(value) or math.isinf(value):
            return default
        return value
    except Exception:
        return default


def _load_lstm() -> bool:
    if _CACHE["loaded"]:
        return _CACHE["model"] is not None
    _CACHE["loaded"] = True
    if not LSTM_MODEL_PATH.exists():
        _CACHE["error"] = "LSTM model file not found. Train backend/ml/train_lstm_predictor.py first."
        return False
    try:
        from tensorflow.keras.models import load_model
        _CACHE["model"] = load_model(LSTM_MODEL_PATH)
        _CACHE["error"] = None
        return True
    except Exception as exc:
        _CACHE["error"] = repr(exc)
        return False


def _sequence_features(req: LSTMPredictRequest) -> np.ndarray:
    views = max(_safe_float(req.view_count), 0.0)
    comments = max(_safe_float(req.comment_count), 0.0)
    growth = max(_safe_float(req.view_growth_24h), 0.0)
    hour = max(0, min(23, int(req.published_hour)))
    weekday = max(0, min(6, int(req.published_weekday)))

    base = np.array([
        math.log1p(views),
        math.log1p(comments),
        math.log1p(growth),
        math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24),
        weekday / 6,
    ], dtype="float32")

    # 현재 입력 화면은 시간별 연속 스냅샷이 없으므로,
    # T0 -> 24h로 증가하는 3-step pseudo sequence를 구성합니다.
    # 실제 정확도 향상은 0h/6h/12h/24h 같은 관측값이 있을 때 가장 큽니다.
    seq = np.stack([
        base * np.array([0.70, 0.85, 0.00, 1, 1, 1], dtype="float32"),
        base * np.array([0.88, 0.93, 0.50, 1, 1, 1], dtype="float32"),
        base,
    ], axis=0)
    return seq.reshape(1, 3, 6)


@router.get("/status")
def lstm_status():
    loaded = _load_lstm()
    return {
        "ok": True,
        "lstm_enabled": loaded,
        "model_path": str(LSTM_MODEL_PATH),
        "error": _CACHE.get("error"),
        "note": "LSTM is useful when sequential snapshots such as 0h/6h/12h/24h are available.",
    }


@router.post("/preview")
def lstm_preview(req: LSTMPredictRequest):
    if not _load_lstm():
        return {
            "ok": False,
            "lstm_enabled": False,
            "message": "LSTM 모델이 아직 학습되지 않았습니다. 현재 서비스는 XGBoost 예측을 기본으로 사용하세요.",
            "next_step": "backend/ml/train_lstm_predictor.py로 모델을 학습한 뒤 models/lstm_trend_sequence.keras를 생성하세요.",
            "error": _CACHE.get("error"),
        }

    x = _sequence_features(req)
    pred = _CACHE["model"].predict(x, verbose=0)
    probability = float(np.clip(pred[0][0] * 100, 0, 100))
    return {
        "ok": True,
        "lstm_enabled": True,
        "prediction": {
            "probability": round(probability, 1),
            "modelMode": "LSTM",
            "message": "LSTM 시퀀스 모델 기반 장기 트렌딩 확률입니다.",
        },
    }
