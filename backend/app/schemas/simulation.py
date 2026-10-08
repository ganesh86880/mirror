"""Pydantic v2 schemas for Consequence Simulation requests, results, and outcome comparisons."""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ActionId(str, Enum):
    """Allowed candidate response actions for simulation."""
    ROUTE_A = "ROUTE_A"
    ROUTE_C = "ROUTE_C"
    DELAY_10 = "DELAY_10"


class SimulationRequest(BaseModel):
    """Payload for invoking a what-if consequence simulation."""
    action_id: ActionId = Field(
        ...,
        description="Target action identifier to simulate (ROUTE_A, ROUTE_C, DELAY_10)"
    )


class SimulationResult(BaseModel):
    """Simulated consequence outcome for a response action."""
    action_id: ActionId = Field(..., description="Action evaluated")
    baseline_risk: float = Field(..., description="Baseline risk score before action (0-100)")
    projected_risk: float = Field(..., description="Calculated risk score following action (0-100)")
    risk_score: float = Field(..., description="Display risk score (equals projected_risk)")
    risk_difference: float = Field(..., description="Net risk change (projected_risk - baseline_risk)")
    response_time_minutes: float = Field(..., description="Projected response / evacuation time in minutes")
    exposure: float = Field(..., ge=0.0, le=100.0, description="Exposure component score (0-100)")
    congestion: float = Field(..., ge=0.0, le=100.0, description="Congestion component score (0-100)")
    hospital_load: float = Field(..., ge=0.0, le=100.0, description="Hospital load component score (0-100)")
    secondary_risk: float = Field(..., ge=0.0, le=100.0, description="Secondary risk component score (0-100)")
    additional_people_at_risk: int = Field(..., ge=0, description="Estimated count of additional individuals placed at risk")
    flag: Optional[str] = Field(None, description="Outcome flag, e.g. LOWEST_RISK if determined as optimal")
    hospital_load_increase_percent: Optional[float] = Field(
        None,
        description="Projected percentage change in hospital capacity load"
    )
    exposure_increase_percent: Optional[float] = Field(
        None,
        description="Projected percentage change in population exposure"
    )
    explanation: Optional[str] = Field(
        None,
        description="Explainable reasoning detailing why this action yields the projected risk"
    )


class OutcomeComparisonResult(BaseModel):
    """Comparative outcome evaluation across all simulated actions."""
    baseline_risk: float = Field(..., description="Baseline risk score (74)")
    lowest_risk_action: ActionId = Field(..., description="Action ID identified with lowest calculated risk")
    lowest_risk_score: float = Field(..., description="Minimum risk score achieved")
    action_rankings: List[SimulationResult] = Field(
        ...,
        description="Candidate actions ordered from lowest risk to highest risk"
    )
    comparison_summary: str = Field(
        ...,
        description="Summary explaining the comparative trade-offs between routes"
    )
