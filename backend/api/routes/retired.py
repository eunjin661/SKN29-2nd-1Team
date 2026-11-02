"""Explicit tombstones for retired prediction and fixed-sample endpoints."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()

RETIRED_ENDPOINTS = (
    ("GET", "/model/compare", "/predict/t0-verified/evaluation"),
    ("GET", "/model/final-summary", "/predict/t0-verified/evaluation"),
    ("GET", "/model/feature-importance", "/feature/importance"),
    ("POST", "/predict/preview", "/predict/t0-verified"),
    ("POST", "/predict/video", "/predict/t0-verified"),
    ("POST", "/predict/bulk", "/predict/t0-verified"),
    ("GET", "/predict/status", "/predict/t0-verified/status"),
    ("POST", "/predict/reload", None),
    ("GET", "/predict/lstm/status", None),
    ("POST", "/predict/lstm/preview", None),
    ("GET", "/video/summary", "/youtube/live/bulk"),
    ("GET", "/video/list", "/youtube/live/bulk"),
    ("GET", "/video/top", "/youtube/live/bulk"),
)
_REPLACEMENTS = {(method, path): replacement for method, path, replacement in RETIRED_ENDPOINTS}


def retired_endpoint(request: Request):
    return JSONResponse(
        status_code=410,
        content={
            "ok": False,
            "status": "RETIRED_LEGACY_API",
            "message": "구버전 예측·고정 예시 API는 제공을 종료했습니다. 현재 경로의 입력 형식과 관측 범위를 확인하세요.",
            "path": request.url.path,
            "replacement": _REPLACEMENTS[(request.method, request.url.path)],
            "documentation": "/docs",
        },
    )


def retired_endpoints():
    return [
        {"method": method, "path": path, "status": "retired", "http_status": 410, "replacement": replacement}
        for method, path, replacement in RETIRED_ENDPOINTS
    ]


for method, path, _ in RETIRED_ENDPOINTS:
    router.add_api_route(path, retired_endpoint, methods=[method], include_in_schema=False)
