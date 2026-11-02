from decimal import Decimal
import copy

import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import campaign
from api.services import data_loader

BODY = {"budget_won": 1000000, "cpm_won": 10000, "ctr_percent": "1", "cvr_percent": "2", "allocations": [{"category": "Music", "share_percent": "100"}]}


@pytest.fixture
def client(monkeypatch):
    frame = pd.DataFrame({"video_id": ["a"], "category_group": ["Music"], "T0": pd.to_datetime(["2025-01-01"]), "trending_duration_h": [48.]})
    monkeypatch.setattr(data_loader, "get_df", lambda: frame)
    app = FastAPI(); app.include_router(campaign.router)
    return TestClient(app)


def test_explicit_assumptions_match_known_arithmetic(client):
    response = client.post("/campaign/scenario", json=BODY)
    assert response.status_code == 200
    body = response.json()
    assert body["totals"] == {"impressions": 100000., "clicks": 1000., "conversions": 20., "cpa_won": 50000.}
    assert body["rows"][0]["budget_won"] == 1000000
    assert body["model_used"] is False and body["source"] == "user_assumptions"
    assert "roiIndex" not in body and "risk" not in body["rows"][0]


@pytest.mark.parametrize("field", ["ctr_percent", "cvr_percent", "budget_won"])
def test_zero_conversions_return_null_cpa_without_invented_denominator(client, field):
    body = copy.deepcopy(BODY); body[field] = 0
    response = client.post("/campaign/scenario", json=body)
    assert response.status_code == 200
    assert response.json()["totals"]["conversions"] == 0
    assert response.json()["totals"]["cpa_won"] is None


@pytest.mark.parametrize("field,value", [("cpm_won", 0), ("budget_won", -1), ("budget_won", 1.5), ("budget_won", True), ("ctr_percent", "NaN"), ("cvr_percent", "Infinity"), ("ctr_percent", 101), ("ctr_percent", -1), ("cvr_percent", ".001")])
def test_invalid_inputs_are_rejected(client, field, value):
    body = copy.deepcopy(BODY); body[field] = value
    assert client.post("/campaign/scenario", json=body).status_code == 422


@pytest.mark.parametrize("allocations", [[{"category": "Music", "share_percent": "99.99"}], [{"category": "missing", "share_percent": "100"}], [{"category": "Music", "share_percent": "50"}, {"category": "Music", "share_percent": "50"}]])
def test_invalid_allocations_are_rejected(client, allocations):
    assert client.post("/campaign/scenario", json={**BODY, "allocations": allocations}).status_code == 422


def test_integer_won_are_conserved_for_tiny_budget_and_fractional_shares():
    assert campaign.allocate_won(1, [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]) == [0, 0, 1]
    assert campaign.allocate_won(101, [Decimal("50"), Decimal("50")]) == [51, 50]


def test_small_positive_conversion_is_not_rounded_to_zero(client):
    response = client.post("/campaign/scenario", json={**BODY, "budget_won": 1, "cpm_won": 1000000000, "ctr_percent": ".01", "cvr_percent": ".01"})
    assert response.status_code == 200
    assert 0 < response.json()["totals"]["conversions"] < .000001
    assert response.json()["totals"]["cpa_won"] > 0


def test_observed_reference_does_not_predict_advertising_performance(client):
    body = client.get("/campaign/plan").json()
    assert body["prediction"] is None and body["population"]["events"] == 1
    assert body["categories"][0]["median"] == 48
    assert "score" not in body["categories"][0] and "roiIndex" not in body
