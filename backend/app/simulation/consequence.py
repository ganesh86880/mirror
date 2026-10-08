"""Consequence Simulation Engine for MIRROR Emergency Response Decision Twin.

Implements the deterministic multi-parameter risk simulation model:
    Overall Risk = (0.35 * Exposure) + (0.25 * Congestion) + (0.20 * HospitalLoad) + (0.20 * SecondaryRisk)

All component metrics operate strictly on a 0-100 normalized index scale.
The recommendation flag is programmatically derived through outcome comparison,
strictly avoiding hard-coded rules.
"""

from typing import Dict, List, Union
from app.schemas.simulation import ActionId, OutcomeComparisonResult, SimulationResult
from app.simulation.mock_city import BASELINE_RISK, SUPPORTED_ACTIONS

# Risk Model Coefficients (normalized weights summing to 1.0)
WEIGHT_EXPOSURE: float = 0.35
WEIGHT_CONGESTION: float = 0.25
WEIGHT_HOSPITAL_LOAD: float = 0.20
WEIGHT_SECONDARY_RISK: float = 0.20

# Underlying component profiles for candidate response actions
# Each component is defined on an explainable, normalized 0-100 scale.
ACTION_PROFILES: Dict[ActionId, Dict[str, Union[float, int, str]]] = {
    ActionId.ROUTE_A: {
        "response_time_minutes": 21.0,
        "exposure": 75.0,
        "congestion": 81.0,
        "hospital_load": 67.5,
        "secondary_risk": 60.0,
        "hospital_load_increase_percent": 26.0,
        "exposure_increase_percent": 0.0,
        "additional_people_at_risk": 0,
        "explanation": (
            "Route A traverses the primary arterial corridor but encounters dense traffic gridlock "
            "at the Sector 07 junction (81% congestion). This extends response time to 21 minutes "
            "and creates significant hospital intake pressure (+26% load increase)."
        ),
    },
    ActionId.ROUTE_C: {
        "response_time_minutes": 14.0,
        "exposure": 35.0,
        "congestion": 43.0,
        "hospital_load": 45.0,
        "secondary_risk": 30.0,
        "hospital_load_increase_percent": 9.0,
        "exposure_increase_percent": 0.0,
        "additional_people_at_risk": 0,
        "explanation": (
            "Route C utilizes the designated emergency access corridor (Sector 11), entirely bypassing "
            "the Sector 07 bottleneck. Yields the fastest response (14 min), lowest transit congestion (43%), "
            "and minimal hospital surge (+9% load increase), drastically lowering overall system risk."
        ),
    },
    ActionId.DELAY_10: {
        "response_time_minutes": 27.0,
        "exposure": 90.0,
        "congestion": 86.0,
        "hospital_load": 85.0,
        "secondary_risk": 80.0,
        "hospital_load_increase_percent": 35.0,
        "exposure_increase_percent": 31.0,
        "additional_people_at_risk": 640,
        "explanation": (
            "Delaying dispatch by 10 minutes leads to acute hazard propagation (+31% exposure increase, "
            "640 additional individuals placed at direct risk), pushes total response time to 27 minutes, "
            "and escalates regional risk significantly above baseline."
        ),
    },
}


def calculate_risk(
    exposure: float,
    congestion: float,
    hospital_load: float,
    secondary_risk: float,
) -> float:
    """
    Calculate the composite risk score using the weighted risk formula:
        Overall Risk = (0.35 * Exposure) + (0.25 * Congestion) + (0.20 * HospitalLoad) + (0.20 * SecondaryRisk)

    Args:
        exposure: Hazard/population exposure index (0-100)
        congestion: Traffic congestion index (0-100)
        hospital_load: Facility intake strain index (0-100)
        secondary_risk: Cascading hazard risk index (0-100)

    Returns:
        float: Calculated risk score rounded to 2 decimal places.
    """
    risk = (
        (WEIGHT_EXPOSURE * exposure)
        + (WEIGHT_CONGESTION * congestion)
        + (WEIGHT_HOSPITAL_LOAD * hospital_load)
        + (WEIGHT_SECONDARY_RISK * secondary_risk)
    )
    return round(risk, 2)


def _simulate_raw_action(action: ActionId) -> SimulationResult:
    """
    Simulate a candidate action by evaluating its parameters against the risk formula.
    Does not assign comparative recommendation flags.
    """
    profile = ACTION_PROFILES[action]
    exposure = float(profile["exposure"])
    congestion = float(profile["congestion"])
    hospital_load = float(profile["hospital_load"])
    secondary_risk = float(profile["secondary_risk"])

    # Calculate projected risk through the actual mathematical formula
    projected_risk = calculate_risk(
        exposure=exposure,
        congestion=congestion,
        hospital_load=hospital_load,
        secondary_risk=secondary_risk,
    )

    risk_diff = round(projected_risk - BASELINE_RISK, 2)

    return SimulationResult(
        action_id=action,
        baseline_risk=BASELINE_RISK,
        projected_risk=projected_risk,
        risk_score=projected_risk,
        risk_difference=risk_diff,
        response_time_minutes=float(profile["response_time_minutes"]),
        exposure=exposure,
        congestion=congestion,
        hospital_load=hospital_load,
        secondary_risk=secondary_risk,
        additional_people_at_risk=int(profile["additional_people_at_risk"]),
        flag=None,
        hospital_load_increase_percent=float(profile["hospital_load_increase_percent"]),
        exposure_increase_percent=float(profile["exposure_increase_percent"]),
        explanation=str(profile["explanation"]),
    )


def compare_all_actions() -> OutcomeComparisonResult:
    """
    Outcome Comparer: Evaluates all candidate response actions, ranks them
    by calculated risk, and programmatically tags the lowest-risk option.

    Returns:
        OutcomeComparisonResult: Comparison rankings and summary.
    """
    # 1. Run simulation for all supported actions
    evaluated: Dict[ActionId, SimulationResult] = {}
    for aid_str in SUPPORTED_ACTIONS:
        aid = ActionId(aid_str)
        evaluated[aid] = _simulate_raw_action(aid)

    # 2. Programmatically identify the lowest calculated risk score
    lowest_action_id = min(evaluated.keys(), key=lambda a: evaluated[a].risk_score)
    lowest_score = evaluated[lowest_action_id].risk_score

    # 3. Assign recommendation flag purely based on outcome comparison
    for aid, result in evaluated.items():
        if aid == lowest_action_id:
            result.flag = "LOWEST_RISK"
        else:
            result.flag = None

    # 4. Rank actions by risk score ascending
    ranked = sorted(evaluated.values(), key=lambda r: r.risk_score)

    summary = (
        f"Comparative evaluation across {len(evaluated)} actions identified {lowest_action_id.value} "
        f"as the optimal intervention with a projected risk of {lowest_score} "
        f"({round(lowest_score - BASELINE_RISK, 2):+0.1f} change from baseline {BASELINE_RISK})."
    )

    return OutcomeComparisonResult(
        baseline_risk=BASELINE_RISK,
        lowest_risk_action=lowest_action_id,
        lowest_risk_score=lowest_score,
        action_rankings=ranked,
        comparison_summary=summary,
    )


def simulate_action(action_id: Union[str, ActionId]) -> SimulationResult:
    """
    Simulate consequences for a single candidate action.
    The recommendation flag (e.g. LOWEST_RISK) is determined dynamically
    via comparative outcome analysis across all candidate actions.

    Args:
        action_id: Identifier of the action (ROUTE_A, ROUTE_C, DELAY_10)

    Returns:
        SimulationResult: Detailed consequence simulation output.

    Raises:
        ValueError: If action_id is not in supported candidate actions.
    """
    if isinstance(action_id, str):
        try:
            target_action = ActionId(action_id)
        except ValueError:
            allowed = [a.value for a in ActionId]
            raise ValueError(f"Unknown action_id: '{action_id}'. Allowed actions: {allowed}")
    else:
        target_action = action_id

    # Execute comparative evaluation to ensure flags are derived from global rankings
    comparison = compare_all_actions()
    for result in comparison.action_rankings:
        if result.action_id == target_action:
            return result

    # Fallback to direct raw evaluation if not found in comparison set
    return _simulate_raw_action(target_action)
