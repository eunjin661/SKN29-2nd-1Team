from fastapi import APIRouter

router = APIRouter(prefix="/eda", tags=["eda"])


@router.get("/summary")
def eda_summary():
    """
    프론트 메인/트렌딩 분석 페이지가 호출하는 EDA 요약 API.
    실제 집계 파일이 없어도 화면이 깨지지 않도록 fallback-safe 응답을 반환합니다.
    """
    return {
        "ok": True,
        "source": "fallback_safe",
        "raw_snapshots": 872191,
        "trend_events": 34964,
        "unique_videos": 17884,
        "median_duration_h": 108,
        "category_groups": 5,
        "period": "2022-2025",
        "summary": {
            "rawSnapshots": 872191,
            "trendEvents": 34964,
            "uniqueVideos": 17884,
            "medianDuration": 108,
            "categories": 5,
            "period": "2022-2025",
        },
        "kpis": [
            {"label": "RAW 스냅샷", "value": 872191, "display": "872,191"},
            {"label": "트렌딩 이벤트", "value": 34964, "display": "34,964"},
            {"label": "중앙 지속 시간", "value": 108, "display": "108h"},
            {"label": "카테고리 그룹", "value": 5, "display": "5"},
        ],
        "category_summary": [
            {"category": "Entertainment", "events": 9800, "median_duration_h": 122},
            {"category": "Music", "events": 8200, "median_duration_h": 138},
            {"category": "Lifestyle", "events": 6900, "median_duration_h": 114},
            {"category": "Sports", "events": 5200, "median_duration_h": 82},
            {"category": "Gaming", "events": 4864, "median_duration_h": 74},
        ],

        "clusterShare": [
            {"category": "Education", "c0": 0.9, "c1": 16.8, "c2": 54.7, "c3": 27.7},
            {"category": "Entertainment", "c0": 3.9, "c1": 25.3, "c2": 44.3, "c3": 26.5},
            {"category": "Lifestyle", "c0": 3.8, "c1": 23.4, "c2": 52.5, "c3": 20.3},
            {"category": "Music", "c0": 18.3, "c1": 22.6, "c2": 30.2, "c3": 28.9},
            {"category": "News", "c0": 2.0, "c1": 17.1, "c2": 36.9, "c3": 44.1},
        ],
        "clusterLabels": {
            0: "C0 Music / High engagement",
            1: "C1 Fast response",
            2: "C2 Delayed / Same-day exit",
            3: "C3 Slow entry / Long duration",
        },
        "clusterStats": {"chi2": 1769.2, "p": "<0.001", "dof": 12, "cramersV": 0.147},
    }
