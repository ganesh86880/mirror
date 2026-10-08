"""Tests for Citizen Ingestion Endpoint with Gemini API."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ingest_report_text():
    """Verify citizen report intake parses report and returns structured incident event."""
    payload = {
        "text_report": "Fallen tree and rising water completely blocking MG Road junction, ambulances cannot pass"
    }
    response = client.post("/api/ingest/report", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "processed"
    assert "parsed_incident" in data
    parsed = data["parsed_incident"]

    assert parsed["incident_type"] in ["ROAD_BLOCKAGE", "FLOOD", "FIRE", "MEDICAL_SOS"]
    assert 1 <= parsed["severity_score"] <= 10
    assert parsed["affects_emergency_corridor"] is True
    assert "mg road" in parsed["blocked_road_name"].lower()
    assert parsed["estimated_delay_minutes"] > 0
    assert len(parsed["summary"]) > 5

    assert data["corridor_compromised"] is True
    assert data["reroute_triggered"] is True
    assert "Corridor Compromised" in data["alert_message"]
    assert data["incident_marker"] is not None
    assert len(data["incident_marker"]["coordinates"]) == 2


def test_ingest_empty_report_rejected():
    """Verify empty or missing reports are rejected with 422."""
    response = client.post("/api/ingest/report", json={"text_report": ""})
    assert response.status_code == 422
