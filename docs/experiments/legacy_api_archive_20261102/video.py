from fastapi import APIRouter, Query

router = APIRouter(prefix="/video", tags=["video"])

SAMPLE = [
    {"video_id": "dQw4w9WgXcQ", "title": "Music trend sample", "category": "Music", "views": 1850000, "duration_h": 192, "score": 0.86},
    {"video_id": "9bZkp7q19f0", "title": "Entertainment viral sample", "category": "Entertainment", "views": 2400000, "duration_h": 168, "score": 0.82},
    {"video_id": "kJQP7kiw5Fk", "title": "Lifestyle sample", "category": "Lifestyle", "views": 980000, "duration_h": 132, "score": 0.76},
]


@router.get("/summary")
def video_summary():
    return {
        "ok": True,
        "source": "fallback_safe",
        "total_videos": len(SAMPLE),
        "total_views": sum(x["views"] for x in SAMPLE),
        "categories": sorted({x["category"] for x in SAMPLE}),
    }


@router.get("/list")
def video_list(limit: int = Query(30, ge=1, le=100), category: str = Query("ALL")):
    items = SAMPLE * ((limit // len(SAMPLE)) + 1)
    if category != "ALL":
        items = [x for x in items if x["category"] == category]
    return {"ok": True, "items": items[:limit], "videos": items[:limit], "count": len(items[:limit])}


@router.get("/top")
def video_top(limit: int = Query(10, ge=1, le=50)):
    items = sorted(SAMPLE, key=lambda x: x["score"], reverse=True)
    return {"ok": True, "items": items[:limit], "videos": items[:limit]}
