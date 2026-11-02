"""Budget scenarios calculated solely from explicit user assumptions."""
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
from typing import Annotated

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from api.services.observed_analysis import analysis_summary

router = APIRouter(prefix="/campaign", tags=["campaign"])
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2, allow_inf_nan=False)]


class Allocation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: str = Field(min_length=1, max_length=100)
    share_percent: Percent


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    budget_won: int = Field(strict=True, ge=0, le=10**12)
    cpm_won: int = Field(strict=True, gt=0, le=10**9)
    ctr_percent: Percent
    cvr_percent: Percent
    allocations: list[Allocation] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def allocation_contract(self):
        names = [row.category for row in self.allocations]
        if len(names) != len(set(names)):
            raise ValueError("Categories must be unique")
        if sum(row.share_percent for row in self.allocations) != Decimal(100):
            raise ValueError("Allocation shares must add up to exactly 100 percent")
        return self


def allocate_won(budget, shares):
    """Largest remainder allocation conserves integer won, including tiny budgets."""
    exact = [Decimal(budget) * share / 100 for share in shares]
    rounded = [int(value.to_integral_value(rounding=ROUND_FLOOR)) for value in exact]
    remaining = budget - sum(rounded)
    order = sorted(range(len(exact)), key=lambda i: (-(exact[i] - rounded[i]), i))
    for index in order[:remaining]: rounded[index] += 1
    assert sum(rounded) == budget
    return rounded


def scenario_metrics(budget, cpm, ctr, cvr):
    impressions = Decimal(budget) / cpm * 1000
    clicks = impressions * ctr / 100
    conversions = clicks * cvr / 100
    return {"impressions": float(impressions), "clicks": float(clicks), "conversions": float(conversions),
            "cpa_won": float((Decimal(budget) / conversions).quantize(Decimal(".000001"), rounding=ROUND_HALF_UP)) if conversions > 0 else None}


def calculate_scenario(request):
    budgets = allocate_won(request.budget_won, [row.share_percent for row in request.allocations])
    return {"schema": "campaign-scenario-v1", "source": "user_assumptions", "model_used": False,
            "assumptions": request.model_dump(mode="json"),
            "totals": scenario_metrics(request.budget_won, request.cpm_won, request.ctr_percent, request.cvr_percent),
            "rows": [{"category": row.category, "share_percent": float(row.share_percent), "budget_won": budget,
                      **scenario_metrics(budget, request.cpm_won, request.ctr_percent, request.cvr_percent)} for row, budget in zip(request.allocations, budgets)],
            "scope": "Arithmetic under supplied assumptions; no observed ad performance, ROI estimate or causal validation",
            "count_unit": "Expected counts may be fractional; totals are computed before display rounding"}


@router.get("/plan")
def campaign_plan():
    data = analysis_summary()
    return {"schema": "campaign-reference-v1", "source": "historical_observed_events", "provenance": data["provenance"],
            "population": data["population"], "categories": data["category_summary"], "prediction": None,
            "message": "관측 통계는 참고 자료이며 광고 전환율·ROI의 검증 근거가 아닙니다."}


@router.post("/scenario")
def campaign_scenario(request: Scenario):
    available = {row["category"] for row in campaign_plan()["categories"]}
    if any(row.category not in available for row in request.allocations):
        raise HTTPException(422, "현재 관측 자료에 없는 카테고리입니다.")
    return calculate_scenario(request)
