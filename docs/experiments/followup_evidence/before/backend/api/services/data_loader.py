"""
api/services/data_loader.py
────────────────────────────
parquet 파일을 서버 시작 시 1회 로드하고 이후 읽기 전용으로 제공.
멀티워커 환경에서는 각 워커가 독립적으로 1회 로드함 (프로세스 격리).
"""

from pathlib import Path

import pandas as pd
from fastapi import HTTPException

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
DATA_DIR = BASE_DIR / "data"

ANALYSIS_PATH = DATA_DIR / "video_trending_events_analysis.parquet"
T0_MODEL_PATH = DATA_DIR / "video_trending_events_T0_model.parquet"
H24_MODEL_PATH = DATA_DIR / "video_trending_events_24h_model.parquet"

_df: pd.DataFrame | None = None
_t0_df: pd.DataFrame | None = None
_h24_df: pd.DataFrame | None = None


def _parse_datetime_col(df: pd.DataFrame) -> pd.DataFrame:
    """연도 컬럼 파생 — 있는 datetime 컬럼을 순서대로 시도"""
    for col in ("T0", "trending_at"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
            df["year"] = df[col].dt.year
            return df
    df["year"] = 2025
    return df


def preload_all() -> None:
    """lifespan 핸들러에서 호출 — 서버 시작 시 전체 데이터 미리 로드"""
    global _df, _t0_df, _h24_df
    _df = _t0_df = _h24_df = None

    if ANALYSIS_PATH.exists():
        _df = _parse_datetime_col(pd.read_parquet(ANALYSIS_PATH))

    if T0_MODEL_PATH.exists():
        _t0_df = pd.read_parquet(T0_MODEL_PATH)
    elif _df is not None:
        _t0_df = _df.copy()

    if H24_MODEL_PATH.exists():
        _h24_df = pd.read_parquet(H24_MODEL_PATH)
    elif _df is not None:
        _h24_df = _df.copy()


def get_df() -> pd.DataFrame:
    if _df is None:
        raise HTTPException(
            status_code=503,
            detail=(
                f"데이터 파일 없음: {ANALYSIS_PATH} "
                f"(backend/data/ 에 video_trending_events_analysis.parquet 필요)"
            ),
        )
    return _df


def get_t0_df() -> pd.DataFrame:
    if _t0_df is None:
        return get_df()
    return _t0_df


def get_h24_df() -> pd.DataFrame:
    if _h24_df is None:
        return get_df()
    return _h24_df
