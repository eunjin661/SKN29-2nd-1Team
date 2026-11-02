from pathlib import Path
from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.services import data_loader
from api.routes.retired import retired_endpoints


@asynccontextmanager
async def lifespan(application: FastAPI):
    error = None
    try:
        data_loader.preload_all()
    except Exception as exc:
        error = str(exc)
        logging.getLogger(__name__).warning("Historical data preload failed: %s", exc)
    try:
        frame = data_loader.get_df()
        application.state.analysis_data = {"status": "degraded" if error else "ready", "events": len(frame), "error": error}
    except Exception as exc:
        application.state.analysis_data = {"status": "unavailable", "events": None, "error": str(exc)}
    yield


app = FastAPI(
    title="YouTube Trend Analyzer API",
    lifespan=lifespan,
    version="1.0.0",
    description="YouTube trend, EDA, feature, video, sustain, campaign, dashboard API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "ok": True,
        "message": "YouTube Trend Analyzer API is running",
        "docs": "/docs",
        "status": "/api/status",
    }


@app.get("/healthz")
def healthz():
    return {"ok": True}


LOADED_ROUTERS = {}


def safe_include(module_path: str, attr: str = "router"):
    try:
        module = __import__(module_path, fromlist=[attr])
        router = getattr(module, attr)
        app.include_router(router)
        LOADED_ROUTERS[module_path] = {"loaded": True, "error": None}
    except Exception as e:
        LOADED_ROUTERS[module_path] = {"loaded": False, "error": repr(e)}


# Current contracts plus explicit HTTP 410 tombstones; archived modules are never imported.
for module_path in [
    "api.routes.retired",
    "api.routes.t0_verified",
    "api.routes.diagnostics",
    "api.routes.eda",
    "api.routes.youtube",
    "api.routes.feature",
    "api.routes.dashboard",
    "api.routes.sustain",
    "api.routes.campaign",
    "api.routes.strategy",
    "api.routes.insight",
    "api.routes.problem",
]:
    safe_include(module_path)


@app.get("/api/status")
def api_status():
    return {
        "ok": True,
        "message": "API server is running",
        "loaded_routers": LOADED_ROUTERS,
        "retired_endpoints": retired_endpoints(),
        "analysis_data": getattr(app.state, "analysis_data", {"status": "not_started"}),
        "important_endpoints": [
            "/predict/t0-verified",
            "/predict/t0-verified/status",
            "/predict/t0-verified/evaluation",
            "/predict/t0-verified/diagnostics",
            "/feature/importance",
            "/eda/summary",
            "/feature/summary",
            "/youtube/live/bulk",
            "/youtube/trending",
            "/youtube/categories",
            "/dashboard/summary",
            "/sustain/summary",
            "/campaign/plan",
            "/problem/summary",
            "/insight/summary",
            "/strategy/summary",
        ],
    }


@app.get("/api/routes")
def api_routes():
    return LOADED_ROUTERS
