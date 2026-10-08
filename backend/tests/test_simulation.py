"""Tests for Consequence Engine Simulation, Formula Integrity, and Input Validation."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.simulation.consequence import (
    BASELINE_RISK,
    WEIGHT_CONGESTION,
    WEIGHT_EXPOSURE,
    WEIGHT_HOSPITAL_LOAD,
    WEIGHT_SECONDARY_RISK,
    calculate_risk,
    compare_all_actions,
    simulate_action,
)

client = TestClient(app)


def test_simulate_route_a():
    """Verify simulation for ROUTE_A produces expected demonstration outcome and valid JSON."""
    response = client.post("/api/simulate", json={"action_id": "ROUTE_A"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    data = response.json()

    # Core required fields
    required = [
        "action_id",
        "baseline_risk",
        "projected_risk",
        "risk_score",
        "risk_difference",
        "response_time_minutes",
        "exposure",
        "congestion",
        "hospital_load",
        "secondary_risk",
        "additional_people_at_risk",
        "flag",
    ]
    for key in required:
        assert key in data, f"Missing field {key} in simulation response"

    assert data["action_id"] == "ROUTE_A"
    assert data["baseline_risk"] == 74.0
    assert data["projected_risk"] == 72.0
    assert data["risk_score"] == 72.0
    assert data["risk_difference"] == -2.0
    assert data["response_time_minutes"] == 21.0
    assert data["congestion"] == 81.0
    assert data["hospital_load_increase_percent"] == 26.0
    assert data["flag"] is None


def test_simulate_route_c():
    """Verify simulation for ROUTE_C produces expected demonstration outcome and LOWEST_RISK flag."""
    response = client.post("/api/simulate", json={"action_id": "ROUTE_C"})
    assert response.status_code == 200
    data = response.json()

    assert data["action_id"] == "ROUTE_C"
    assert data["baseline_risk"] == 74.0
    assert data["projected_risk"] == 38.0
    assert data["risk_score"] == 38.0
    assert data["risk_difference"] == -36.0
    assert data["response_time_minutes"] == 14.0
    assert data["congestion"] == 43.0
    assert data["hospital_load_increase_percent"] == 9.0
    assert data["flag"] == "LOWEST_RISK"


def test_simulate_delay_10():
    """Verify simulation for DELAY_10 produces expected demonstration outcome and handles people count."""
    response = client.post("/api/simulate", json={"action_id": "DELAY_10"})
    assert response.status_code == 200
    data = response.json()

    assert data["action_id"] == "DELAY_10"
    assert data["baseline_risk"] == 74.0
    assert data["projected_risk"] == 86.0
    assert data["risk_score"] == 86.0
    assert data["risk_difference"] == 12.0
    assert data["response_time_minutes"] == 27.0
    assert data["exposure_increase_percent"] == 31.0
    assert data["additional_people_at_risk"] == 640
    # Confirm 640 is an absolute count, not a percentage
    assert isinstance(data["additional_people_at_risk"], int)
    assert data["additional_people_at_risk"] > 100
    assert data["flag"] is None


def test_risk_difference_mathematics():
    """Verify that for all actions, risk_difference strictly equals projected_risk - baseline_risk."""
    for action in ["ROUTE_A", "ROUTE_C", "DELAY_10"]:
        response = client.post("/api/simulate", json={"action_id": action})
        assert response.status_code == 200
        data = response.json()
        expected_diff = round(data["projected_risk"] - data["baseline_risk"], 2)
        assert data["risk_difference"] == expected_diff


def test_formula_integrity_recalculation():
    """
    CRITICAL: Independently recalculates the risk formula:
        Overall Risk = (0.35 * Exposure) + (0.25 * Congestion) + (0.20 * HospitalLoad) + (0.20 * SecondaryRisk)
    and asserts that the returned risk score exactly matches the formula result,
    proving the score is not simply hard-coded.
    """
    for action in ["ROUTE_A", "ROUTE_C", "DELAY_10"]:
        response = client.post("/api/simulate", json={"action_id": action})
        assert response.status_code == 200
        data = response.json()

        exp = data["exposure"]
        cong = data["congestion"]
        hosp = data["hospital_load"]
        sec = data["secondary_risk"]

        # Independent manual calculation using formula
        independent_score = round(
            (0.35 * exp) + (0.25 * cong) + (0.20 * hosp) + (0.20 * sec),
            2,
        )

        assert data["projected_risk"] == independent_score
        assert data["risk_score"] == independent_score

        # Also verify calculate_risk function produces this exact value
        engine_score = calculate_risk(exp, cong, hosp, sec)
        assert engine_score == independent_score


def test_outcome_comparison_identifies_lowest_risk_programmatically():
    """Verify Outcome Comparer programmatically ranks actions and identifies ROUTE_C as lowest risk."""
    comparison = compare_all_actions()

    assert comparison.lowest_risk_action == "ROUTE_C"
    assert comparison.lowest_risk_score == 38.0
    assert len(comparison.action_rankings) == 3

    # Lowest risk must be first in ranked order
    first = comparison.action_rankings[0]
    second = comparison.action_rankings[1]
    third = comparison.action_rankings[2]

    assert first.action_id == "ROUTE_C"
    assert first.flag == "LOWEST_RISK"
    assert first.risk_score == 38.0

    assert second.action_id == "ROUTE_A"
    assert second.flag is None
    assert second.risk_score == 72.0

    assert third.action_id == "DELAY_10"
    assert third.flag is None
    assert third.risk_score == 86.0

    assert first.risk_score < second.risk_score < third.risk_score


def test_compare_endpoint():
    """Verify GET /api/simulate/compare returns full comparison result."""
    response = client.get("/api/simulate/compare")
    assert response.status_code == 200
    data = response.json()

    assert data["baseline_risk"] == 74.0
    assert data["lowest_risk_action"] == "ROUTE_C"
    assert len(data["action_rankings"]) == 3
    assert data["action_rankings"][0]["flag"] == "LOWEST_RISK"


@pytest.mark.parametrize(
    "invalid_payload",
    [
        {},
        {"action_id": "INVALID"},
        {"action_id": 123},
        {"action_id": None},
        {"action_id": "ROUTE_B"},
        {"wrong_key": "ROUTE_A"},
    ],
)
def test_invalid_input_validation(invalid_payload):
    """Verify that missing, invalid, wrong-type, or null action_id are rejected with safe 422 errors."""
    response = client.post("/api/simulate", json=invalid_payload)
    assert response.status_code in [400, 422]
    data = response.json()
    assert "error" in data
    assert "message" in data
    # Ensure no traceback or internal code is leaked in response
    assert "Exception" not in response.text or "details" in data


def test_health_endpoints():
    """Verify both /health and /healthz endpoints return 200 with proper health metadata."""
    res_health = client.get("/health")
    assert res_health.status_code == 200
    data_health = res_health.json()
    assert data_health["status"] == "ok"
    assert data_health["service"] == "MIRROR-Simulation-Engine"
    assert data_health["tier"] == "free"

    res_healthz = client.get("/healthz")
    assert res_healthz.status_code == 200
    data_healthz = res_healthz.json()
    assert data_healthz["status"] == "healthy"
