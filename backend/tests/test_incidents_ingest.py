"""Tests for Dynamic Hazard Incidents & Ingestion.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_create_and_list_incident():
    # 1. Create a custom incident (e.g. manual pin drop)
    create_resp = client.post(
        "/api/incidents",
        json={
            "title": "Submerged Underpass at Lakdikapul",
            "incident_type": "FLOOD",
            "severity": "HIGH",
            "lat": 17.4055,
            "lng": 78.4640,
            "radius_meters": 300,
            "status": "ACTIVE",
            "description": "2.5 feet waterlogging near metro station",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    inc = create_resp.json()
    assert inc["incident_type"] == "FLOOD"
    assert inc["radius_meters"] == 300
    inc_id = inc["id"]

    # 2. List incidents
    list_resp = client.get("/api/incidents")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(item["id"] == inc_id for item in items)

    # 3. Update status to RESPONDING then RESOLVED
    patch_resp = client.patch(
        f"/api/incidents/{inc_id}/status",
        json={"status": "RESOLVED"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "RESOLVED"


def test_ingest_report_text():
    response = client.post(
        "/api/ingest/report",
        json={
            "text_report": "Severe fire breaking out near commercial complex, flames spreading fast toward road."
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] in ["processed", "success"]
    assert "incident" in data
    assert data["incident"]["incident_type"] in ["FIRE", "ROADBLOCK", "FLOOD", "ACCIDENT", "SOS"]
    assert data["incident"]["radius_meters"] >= 100
