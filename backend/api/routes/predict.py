from __future__ import annotations

import json
import math
import os
import pickle
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel

warnings.filterwarnings("ignore")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

router = APIRouter(prefix="/predict", tags=["predict"])

CATEGORY_GROUP_BY_ID = {
    "10": "Music",
    "20": "Gaming",
    "24": "Entertainment",
    "17": "Sports",
    "1": "Entertainment",
    "23": "Entertainment",
    "25": "News",
    "29": "News",
    "27": "Education",
    "28": "Education",
    "19": "Lifestyle",
    "15": "Lifestyle",
    "2": "Lifestyle",
    "22": "Lifestyle",
    "26": "Lifestyle",
}

ROOT = Path(__file__).resolve().parents[2]  # backend/
MODELS_DIR = ROOT / "models"

_CACHE: Dict[str, Any] = {
    "loaded": False,
    "duration": None,
    "tdi": None,
    "view24": None,
    "ensemble": None,
    "ensemble_meta": None,
    "meta": None,
    "model_paths": {},
    "load_error": None,
    "recommended_model": "xgboost",
}

_PRED_CACHE: Dict[str, Dict[str, Any]] = {}


class VideoPredictRequest(BaseModel):
    video_id: Optional[str] = None
    id: Optional[str] = None
    title: Optional[str] = None
    category_id: Optional[str] = "24"
    categoryId: Optional[str] = None
    category_group: Optional[str] = None
    category: Optional[str] = None
    views: float = 0
    view_count: Optional[float] = None
    viewCount: Optional[float] = None
    likes: float = 0
    like_count: Optional[float] = None
    likeCount: Optional[float] = None
    comments: float = 0
    comment_count: Optional[float] = None
    commentCount: Optional[float] = None
    publishedAt: Optional[str] = None
    published_at: Optional[str] = None
    entry_rank: Optional[float] = None
    rank: Optional[float] = None
    # Prediction UI direct-input fields
    published_hour: Optional[float] = None
    published_weekday: Optional[float] = None
    view_growth_24h: Optional[float] = None
    mode: Optional[str] = "T0"


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


def _safe_int(value: Any, default: int = 0) -> int:
    return int(round(_safe_float(value, default)))


def _first_existing(*names: str) -> Optional[Path]:
    for name in names:
        path = MODELS_DIR / name
        if path.exists():
            return path
    return None


def _load_model_file(path: Optional[Path]) -> Any:
    if path is None:
        return None
    suffix = path.suffix.lower()
    if suffix in {".pkl", ".pickle"}:
        with path.open("rb") as f:
            return pickle.load(f)
    import joblib
    return joblib.load(path)


def _load_models(force: bool = False) -> None:
    if _CACHE["loaded"] and not force:
        return

    _CACHE.update({
        "loaded": True,
        "duration": None,
        "tdi": None,
        "view24": None,
        "ensemble": None,
        "ensemble_meta": None,
        "meta": None,
        "model_paths": {},
        "load_error": None,
        "recommended_model": "xgboost",
    })

    try:
        meta_path = _first_existing("xgb_metadata.json", "xgboost_metadata.json", "metadata.json")
        if meta_path:
            _CACHE["meta"] = json.loads(meta_path.read_text(encoding="utf-8"))
            _CACHE["model_paths"]["metadata"] = str(meta_path)

        # Legacy ensemble binaries are historical artifacts only. Removing or
        # losing their retirement marker must never make them loadable again.
        ensemble_meta_path = _first_existing("weighted_soft_voting_metadata.json")
        if ensemble_meta_path:
            _CACHE["ensemble_meta"] = json.loads(ensemble_meta_path.read_text(encoding="utf-8"))
            _CACHE["model_paths"]["ensemble_metadata"] = str(ensemble_meta_path)

        duration_path = _first_existing(
            "xgb_duration_t0.pkl", "xgb_duration_t0.pickle", "xgb_duration_t0.joblib",
            "xgboost_duration_t0.pkl", "xgboost_duration_t0.joblib",
        )
        tdi_path = _first_existing(
            "xgb_tdi_t0.pkl", "xgb_tdi_t0.pickle", "xgb_tdi_t0.joblib",
            "xgb_tdi_classifier_t0.pkl", "xgb_tdi_classifier_t0.joblib",
        )
        view24_path = _first_existing(
            "xgb_view24_t0.pkl", "xgb_view24_t0.pickle", "xgb_view24_t0.joblib",
            "xgb_24h_view_t0.pkl", "xgb_24h_view_t0.joblib", "xgb_view_growth_24h.pkl",
        )

        _CACHE["duration"] = _load_model_file(duration_path)
        _CACHE["tdi"] = _load_model_file(tdi_path)
        _CACHE["view24"] = _load_model_file(view24_path)

        if duration_path:
            _CACHE["model_paths"]["duration"] = str(duration_path)
        if tdi_path:
            _CACHE["model_paths"]["tdi"] = str(tdi_path)
        if view24_path:
            _CACHE["model_paths"]["view24"] = str(view24_path)
    except Exception as exc:
        _CACHE["load_error"] = str(exc)
        print("model load failed:", exc)


def _hours_since(published_at: Optional[str]) -> float:
    try:
        if not published_at:
            return 24.0
        dt = datetime.fromisoformat(str(published_at).replace("Z", "+00:00"))
        return max((datetime.now(timezone.utc) - dt).total_seconds() / 3600, 1.0)
    except Exception:
        return 24.0


def _extract_raw(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "video_id": raw.get("video_id") or raw.get("id"),
        "title": raw.get("title"),
        "category_id": str(raw.get("category_id") or raw.get("categoryId") or "24"),
        "category_group": raw.get("category_group") or raw.get("category"),
        "views": _safe_float(raw.get("views") or raw.get("view_count") or raw.get("viewCount") or raw.get("T0_view")),
        "likes": _safe_float(raw.get("likes") or raw.get("like_count") or raw.get("likeCount")),
        "comments": _safe_float(raw.get("comments") or raw.get("comment_count") or raw.get("commentCount") or raw.get("T0_comment")),
        "publishedAt": raw.get("publishedAt") or raw.get("published_at"),
        "entry_rank": raw.get("entry_rank") or raw.get("rank"),
        "published_hour": raw.get("published_hour"),
        "published_weekday": raw.get("published_weekday"),
        "view_growth_24h": raw.get("view_growth_24h"),
        "mode": raw.get("mode") or "T0",
    }


def _feature_row(video: VideoPredictRequest) -> Dict[str, Any]:
    _load_models()
    meta = _CACHE.get("meta") or {}
    med = meta.get("numeric_medians", {}) or {}

    views = max(_safe_float(video.views or video.view_count or video.viewCount), 0.0)
    comments = max(_safe_float(video.comments or video.comment_count or video.commentCount), 0.0)
    likes = max(_safe_float(video.likes or video.like_count or video.likeCount), 0.0)
    engagement = (likes + comments) / max(views, 1.0)

    category_id = str(video.category_id or video.categoryId or "24")
    category_group = (
        video.category_group
        or video.category
        or CATEGORY_GROUP_BY_ID.get(category_id, meta.get("default_category_group", "Entertainment"))
    )
    published = video.publishedAt or video.published_at
    hour_since_upload = _hours_since(published)
    pretrend_velocity = views / max(hour_since_upload, 1.0)

    published_weekday = med.get("published_weekday", 3.0)
    hour_sin = med.get("hour_sin", 0.0)
    hour_cos = med.get("hour_cos", 1.0)

    # 1) UI에서 직접 입력한 업로드 시간/요일이 있으면 우선 사용합니다.
    direct_hour = video.published_hour
    direct_weekday = video.published_weekday
    if direct_weekday is not None:
        published_weekday = max(0.0, min(6.0, _safe_float(direct_weekday, published_weekday)))
    if direct_hour is not None:
        hour = max(0.0, min(23.99, _safe_float(direct_hour, 12.0)))
        hour_sin = math.sin(2 * math.pi * hour / 24)
        hour_cos = math.cos(2 * math.pi * hour / 24)

    # 2) 실제 publishedAt이 있으면 더 정확한 시간 정보로 보정합니다.
    try:
        if published:
            dt = datetime.fromisoformat(str(published).replace("Z", "+00:00"))
            published_weekday = float(dt.weekday())
            hour = dt.hour + dt.minute / 60
            hour_sin = math.sin(2 * math.pi * hour / 24)
            hour_cos = math.cos(2 * math.pi * hour / 24)
    except Exception:
        pass

    row = {
        "category_group": str(category_group),
        "entry_rank_log": math.log1p(_safe_float(video.entry_rank or video.rank, math.expm1(med.get("entry_rank_log", 4.6)))),
        "T0_view_log": math.log1p(views),
        "T0_comment_log": math.log1p(comments),
        "T0_engagement_ratio_log": math.log1p(engagement),
        "latency_to_trend_log": med.get("latency_to_trend_log", math.log1p(hour_since_upload)),
        "pretrend_view_velocity_log": math.log1p(pretrend_velocity),
        "published_weekday": published_weekday,
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "saturation_index_30d_mean_prev": med.get("saturation_index_30d_mean_prev", 0.0),
    }

    features = meta.get("features") or list(row.keys())
    normalized: Dict[str, Any] = {}
    for f in features:
        if f in row:
            normalized[f] = row[f]
        elif f == "category_group" or "category" in f.lower():
            normalized[f] = str(category_group)
        else:
            normalized[f] = med.get(f, 0.0)
    return normalized


def _make_xgb_input(row: Dict[str, Any]):
    import pandas as pd

    meta = _CACHE.get("meta") or {}
    features = meta.get("features") or list(row.keys())
    clean: Dict[str, Any] = {}
    for k, v in row.items():
        if k == "category_group" or isinstance(v, str):
            clean[k] = str(v)
        else:
            clean[k] = _safe_float(v)
    X = pd.DataFrame([clean])
    X = X.reindex(columns=features, fill_value=0)
    if "category_group" in X.columns:
        X["category_group"] = X["category_group"].astype(str)
    return X


def _fallback_prediction(video: VideoPredictRequest, reason: str = "") -> Dict[str, Any]:
    views = max(_safe_float(video.views or video.view_count or video.viewCount), 0.0)
    likes = max(_safe_float(video.likes or video.like_count or video.likeCount), 0.0)
    comments = max(_safe_float(video.comments or video.comment_count or video.commentCount), 0.0)
    engagement = (likes + comments) / max(views, 1.0)

    # 그래프가 0으로 죽지 않도록 조회수/참여율 기반 최소 점수 생성
    base = 18 + min(45, math.log10(max(views, 1)) * 7) + min(32, engagement * 220)
    ai_score = int(round(max(5, min(92, base))))
    predicted_24h_views = int(round(max(views, views * (1.08 + min(0.55, engagement * 5)) + comments * 25)))
    growth = max(0, predicted_24h_views - int(round(views)))
    duration_h = round(36 + ai_score * 0.9 + min(36, math.log10(max(views, 1)) * 4), 1)

    return {
        "model_type": "rule_fallback",
        "score_source": "rule_fallback" + (f":{reason}" if reason else ""),
        "used_models": [],
        "ai_score": ai_score,
        "tdi_probability": round(ai_score / 100, 4),
        "label": "초기 반응 확인 필요" if ai_score < 55 else ("성장 추세 관찰" if ai_score < 78 else "장기 지속 가능성 높음"),
        "message": "XGBoost 예측을 사용할 수 없어 조회수·참여율 기반 보조 점수를 표시합니다.",
        "predicted_duration_h": duration_h,
        "predicted_24h_views": predicted_24h_views,
        "predicted_growth": growth,
        "feature_row": {},
    }


def predict_video_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    r = _extract_raw(raw)
    req = VideoPredictRequest(**r)
    return _predict(req)


def _predict(video: VideoPredictRequest) -> Dict[str, Any]:
    _load_models()
    import numpy as np

    row = _feature_row(video)
    X = _make_xgb_input(row)
    views = max(_safe_float(video.views or video.view_count or video.viewCount), 0.0)
    likes = max(_safe_float(video.likes or video.like_count or video.likeCount), 0.0)
    comments = max(_safe_float(video.comments or video.comment_count or video.commentCount), 0.0)
    engagement = (likes + comments) / max(views, 1.0)

    model_type = "rule_fallback"
    used_models = []
    tdi_probability = None
    duration_h = None
    predicted_24h_views = None

    # XGBoost duration
    if _CACHE.get("duration") is not None:
        try:
            duration_h = float(np.expm1(_CACHE["duration"].predict(X)[0]))
            if math.isfinite(duration_h) and duration_h > 0:
                used_models.append("duration")
                model_type = "xgboost"
            else:
                duration_h = None
        except Exception as exc:
            print("duration prediction failed:", exc)
            duration_h = None

    # XGBoost TDI probability
    if _CACHE.get("tdi") is not None:
        try:
            if hasattr(_CACHE["tdi"], "predict_proba"):
                raw_prob = float(_CACHE["tdi"].predict_proba(X)[0, 1])
            else:
                raw_pred = float(_CACHE["tdi"].predict(X)[0])
                raw_prob = 1 / (1 + math.exp(-raw_pred)) if raw_pred < 0 or raw_pred > 1 else raw_pred
            if math.isfinite(raw_prob) and raw_prob > 0.001:
                tdi_probability = max(0.03, min(0.97, raw_prob))
                used_models.append("tdi")
                model_type = "xgboost"
        except Exception as exc:
            print("tdi prediction failed:", exc)

    # XGBoost 24h views
    if _CACHE.get("view24") is not None:
        try:
            raw_24h = float(np.expm1(_CACHE["view24"].predict(X)[0]))
            if math.isfinite(raw_24h) and raw_24h > views:
                predicted_24h_views = raw_24h
                used_models.append("view24")
                model_type = "xgboost"
        except Exception as exc:
            print("24h view prediction failed:", exc)

    if not used_models:
        return _fallback_prediction(video, "xgb_unavailable")

    if duration_h is None:
        duration_h = 48 + math.log1p(views) * 7 + engagement * 120
    if predicted_24h_views is None:
        predicted_24h_views = views * (1.12 + min(0.8, engagement * 4)) + comments * 30
    predicted_24h_views = max(predicted_24h_views, views)
    growth = max(0.0, predicted_24h_views - views)

    if tdi_probability is None:
        # tdi 모델이 없을 때 view24/duration 기반 보조 확률
        tdi_probability = min(0.94, max(0.06, (math.log10(max(growth, 1)) / 7) + min(0.18, engagement * 2)))

    tdi_probability = min(1.0, max(0.0, float(tdi_probability)))
    ai_score = int(round(min(100, max(1, tdi_probability * 100))))

    if ai_score >= 78:
        label = "장기 지속 가능성 높음"
        message = "XGBoost가 초기 반응, 카테고리, 24h 예측 신호를 근거로 높은 지속 가능성을 예측했습니다."
    elif ai_score >= 55:
        label = "성장 추세 관찰"
        message = "초기 신호는 양호하지만 24시간 반응 추이를 함께 확인하는 것이 좋습니다."
    else:
        label = "초기 반응 확인 필요"
        message = "현재 신호만으로는 장기 지속 가능성이 높지 않습니다."

    return {
        "model_type": model_type,
        "score_source": "xgboost_pickle" if model_type == "xgboost" else "rule_fallback",
        "used_models": used_models,
        "ai_score": ai_score,
        "tdi_probability": round(tdi_probability, 4),
        "label": label,
        "message": message,
        "predicted_duration_h": round(max(duration_h, 6.0), 1),
        "predicted_24h_views": int(round(predicted_24h_views)),
        "predicted_growth": int(round(growth)),
        "feature_row": row,
    }


def _category_prior(category: str) -> float:
    """학습 모델이 없거나 UI 입력만 있을 때 쓰는 약한 사전확률 보정값."""
    priors = {
        "Entertainment": 0.055,
        "Music": 0.045,
        "Gaming": 0.030,
        "News": 0.015,
        "Education": -0.010,
        "Lifestyle": -0.005,
        "Sports": 0.020,
    }
    return priors.get(str(category), 0.0)


def _time_prior(hour: float, weekday: float) -> float:
    """KR YouTube 트렌딩에서 흔한 저녁/주말 가중치를 약하게 반영."""
    h = max(0.0, min(23.0, _safe_float(hour, 12.0)))
    w = max(0.0, min(6.0, _safe_float(weekday, 3.0)))
    prime = 0.045 if 18 <= h <= 23 else (0.018 if 11 <= h <= 17 else -0.020)
    weekend = 0.020 if w in (5, 6) else 0.0
    return prime + weekend


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-max(-20.0, min(20.0, x))))


def _rule_probability(video: VideoPredictRequest) -> Dict[str, Any]:
    """실제 모델 미연결 상황에서도 기존 고정값보다 안정적인 calibrated baseline."""
    views = max(_safe_float(video.views or video.view_count or video.viewCount), 0.0)
    likes = max(_safe_float(video.likes or video.like_count or video.likeCount), 0.0)
    comments = max(_safe_float(video.comments or video.comment_count or video.commentCount), 0.0)
    growth24 = max(_safe_float(video.view_growth_24h, 0.0), 0.0)
    mode = str(video.mode or "T0").lower()
    category = video.category_group or video.category or CATEGORY_GROUP_BY_ID.get(str(video.category_id or video.categoryId or "24"), "Entertainment")
    hour = _safe_float(video.published_hour, 20.0)
    weekday = _safe_float(video.published_weekday, 5.0)

    log_views = math.log1p(views)
    comment_rate = comments / max(views, 1.0)
    like_rate = likes / max(views, 1.0)
    engagement = comment_rate * 0.72 + like_rate * 0.28
    growth_rate = growth24 / max(views, 1.0)

    # z는 과도한 극단값을 막기 위해 log/clip을 사용합니다.
    z = -2.20
    z += 0.185 * (log_views - 11.0)
    z += min(1.05, math.log1p(comments) / 7.0) * 0.78
    z += min(0.90, engagement * 120.0)
    z += _category_prior(str(category)) * 4.0
    z += _time_prior(hour, weekday) * 3.2
    if mode == "24h" and growth24 > 0:
        z += min(1.25, math.log1p(growth_rate * 100.0) / 3.2) * 1.15

    prob = max(0.04, min(0.96, _sigmoid(z)))
    confidence = 0.54 + min(0.22, log_views / 80.0) + min(0.18, math.log1p(comments) / 40.0)
    if mode == "24h" and growth24 > 0:
        confidence += 0.10
    confidence = max(0.50, min(0.92, confidence))

    expected_duration = 24 + prob * 220 + min(42, math.log10(max(views, 1)) * 7)
    if mode == "24h" and growth24 > 0:
        expected_duration += min(72, growth_rate * 90)

    drivers = [
        {"name": "초기 조회수", "value": int(max(5, min(100, log_views / 15.5 * 100)))},
        {"name": "댓글 밀도", "value": int(max(5, min(100, comment_rate * 8500)))},
        {"name": "참여율", "value": int(max(5, min(100, engagement * 9000)))},
        {"name": "24h 성장", "value": int(max(5, min(100, growth_rate * 180)) if mode == "24h" else 35)},
        {"name": "업로드 타이밍", "value": int(max(5, min(100, 55 + _time_prior(hour, weekday) * 520)))},
    ]
    return {
        "probability": prob,
        "confidence": confidence,
        "expected_duration": expected_duration,
        "drivers": drivers,
        "category": str(category),
    }


def _prediction_level(probability_pct: float) -> str:
    if probability_pct >= 78:
        return "High"
    if probability_pct >= 52:
        return "Medium"
    return "Low"


def _recommendations(probability_pct: float, drivers: list, mode: str) -> list:
    low = sorted(drivers, key=lambda x: x.get("value", 0))[:2]
    recs = []
    if probability_pct >= 78:
        recs.append("장기 지속 가능성이 높으므로 광고 집행·추천 슬롯·후속 콘텐츠 연결을 우선 검토하세요.")
    elif probability_pct >= 52:
        recs.append("중간 구간이므로 6~24시간 성장률을 한 번 더 확인한 뒤 집행 규모를 조절하세요.")
    else:
        recs.append("현재 신호가 약하므로 제목·썸네일·초반 댓글 유도를 먼저 보강하세요.")
    if low:
        recs.append(f"가장 약한 요인은 '{low[0]['name']}'입니다. 해당 지표를 개선하는 액션을 우선 적용하세요.")
    if str(mode).lower() != "24h":
        recs.append("24h 조회수 증가량을 입력하면 T0보다 신뢰도 높은 업데이트 예측을 받을 수 있습니다.")
    else:
        recs.append("24h 성장 신호가 반영되었으므로 캠페인 예산 배분 판단에 더 적합합니다.")
    return recs


@router.post("/preview")
def predict_preview(video: VideoPredictRequest) -> Dict[str, Any]:
    """프론트 예측 시스템 전용 응답.

    기존 /predict/video의 XGBoost 결과를 우선 사용하고, UI 직접 입력값과 24h 성장량을
    calibrated baseline으로 보정해 데모 화면의 고정 fallback보다 더 일관된 결과를 제공합니다.
    """
    try:
        model_pred = _predict(video)
    except Exception:
        model_pred = _fallback_prediction(video, "preview_predict_failed")

    baseline = _rule_probability(video)
    model_prob = _safe_float(model_pred.get("tdi_probability"), 0.0)
    if model_pred.get("model_type") == "xgboost" and model_prob > 0:
        # 실제 모델 72%, UI/24h baseline 28%로 블렌딩해 입력 변화 민감도를 높입니다.
        prob = model_prob * 0.72 + baseline["probability"] * 0.28
        source = "xgboost_calibrated_blend"
        confidence = min(0.96, baseline["confidence"] + 0.08)
    else:
        prob = baseline["probability"]
        source = "calibrated_rule_baseline"
        confidence = baseline["confidence"]

    probability_pct = round(max(1.0, min(99.0, prob * 100.0)), 1)
    duration = round(max(6.0, min(720.0, (model_pred.get("predicted_duration_h") or baseline["expected_duration"]) * 0.62 + baseline["expected_duration"] * 0.38)), 1)
    level = _prediction_level(probability_pct)

    return {
        "ok": True,
        "modelType": source,
        "prediction": {
            "probability": probability_pct,
            "expectedDuration": duration,
            "level": level,
            "confidence": round(confidence * 100, 1),
            "modelMode": video.mode or "T0",
            "message": (
                f"{source} 기준 예측입니다. 신뢰도 {round(confidence * 100, 1)}%로 "
                f"장기 지속 가능성을 {level} 수준으로 판단했습니다."
            ),
        },
        "drivers": baseline["drivers"],
        "recommendations": _recommendations(probability_pct, baseline["drivers"], video.mode or "T0"),
        "rawModel": model_pred,
    }


@router.post("/video")
def predict_video(video: VideoPredictRequest) -> Dict[str, Any]:
    return _predict(video)


@router.post("/bulk")
def predict_bulk(data: Dict[str, Any]) -> Dict[str, Any]:
    """프론트 VideoPage용 bulk 예측.

    요청 형식:
    {"videos": [{"video_id": "...", "views": 123, ...}, ...]}

    응답은 프론트 병합이 쉽도록 predictions/items 둘 다 제공합니다.
    """
    videos = data.get("videos") or data.get("items") or []
    if not isinstance(videos, list):
        videos = []

    result: Dict[str, Any] = {}
    items = []
    for v in videos:
        if not isinstance(v, dict):
            continue
        vid = v.get("video_id") or v.get("id")
        if not vid:
            continue
        cache_key = f"{vid}:{v.get('views') or v.get('view_count') or v.get('viewCount') or 0}:{v.get('comments') or v.get('comment_count') or 0}"
        try:
            pred = _PRED_CACHE.get(cache_key)
            if pred is None:
                pred = predict_video_dict(v)
                _PRED_CACHE[cache_key] = pred
            pred = dict(pred)
            pred["video_id"] = vid
            pred["id"] = vid
        except Exception as exc:
            fallback_req = VideoPredictRequest(**_extract_raw(v))
            pred = _fallback_prediction(fallback_req, exc.__class__.__name__)
            pred["video_id"] = vid
            pred["id"] = vid
        result[str(vid)] = pred
        items.append(pred)

    return {
        "ok": True,
        "predictions": result,
        "items": result,
        "list": items,
        "count": len(result),
    }


@router.get("/status")
def predict_status() -> Dict[str, Any]:
    _load_models()
    meta = _CACHE.get("meta") or {}
    ens_meta = _CACHE.get("ensemble_meta") or {}

    # tdi_t0 메트릭 (XGBoost 실측값)
    tdi_metrics = (meta.get("metrics") or {}).get("tdi_t0") or {}

    return {
        "ok": True,
        "recommended_model": "xgboost",
        "weighted_soft_voting_model": _CACHE.get("ensemble") is not None,
        "weighted_soft_voting_model_loaded": _CACHE.get("ensemble") is not None,
        "weighted_soft_voting_used": False,
        "duration_model": _CACHE.get("duration") is not None,
        "tdi_model": _CACHE.get("tdi") is not None,
        "view24_model": _CACHE.get("view24") is not None,
        "model_paths": _CACHE.get("model_paths", {}),
        "load_error": _CACHE.get("load_error"),
        "metadata": meta,
        "legacy_evaluation_status": "UNVERIFIED_LEGACY_PROTOCOL",
        "ensemble_metadata": ens_meta,
        "prediction_cache_size": len(_PRED_CACHE),
    }


@router.post("/reload")
def reload_predict_models() -> Dict[str, Any]:
    _CACHE["loaded"] = False
    _PRED_CACHE.clear()
    _load_models(force=True)
    return predict_status()
