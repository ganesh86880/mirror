"""Tests for Digital Twin State API and Mock City Module."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.simulation.mock_city import (
    BASELINE_RISK,
    SUPPORTED_ACTIONS,
    get_mock_twin_state,
)

client = TestClient(app)


def test_get_twin_state_status_and_json():
    """Verify /api/twin/state returns HTTP 200 and valid JSON."""
    response = client.get("/api/twin/state")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    data = response.json()
    assert isinstance(data, dict)


def test_twin_state_required_fields():
    """Verify all required top-level state fields exist and baseline risk is 74."""
    response = client.get("/api/twin/state")
    data = response.json()

    required_fields = [
        "current_risk",
        "incidents",
        "hospitals",
        "emergency_units",
        "geojson_sectors",
        "available_actions",
    ]
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"

    assert data["current_risk"] == BASELINE_RISK
    assert data["current_risk"] == 74.0


def test_twin_state_hospitals():
    """Verify exactly 3 hospitals exist with internally consistent capacity."""
    response = client.get("/api/twin/state")
    hospitals = response.json()["hospitals"]

    assert len(hospitals) == 3

    for h in hospitals:
        # Check required fields
        for key in [
            "id",
            "name",
            "total_beds",
            "occupied_beds",
            "available_beds",
            "occupancy_percent",
            "latitude",
            "longitude",
        ]:
            assert key in h, f"Missing hospital key {key}"

        # Capacity consistency
        assert h["available_beds"] == h["total_beds"] - h["occupied_beds"]
        expected_occ = round((h["occupied_beds"] / h["total_beds"]) * 100, 2)
        assert abs(h["occupancy_percent"] - expected_occ) < 0.1


def test_twin_state_emergency_units():
    """Verify exactly 5 emergency units exist, at least 2 ambulances, some available, some busy."""
    response = client.get("/api/twin/state")
    units = response.json()["emergency_units"]

    assert len(units) == 5

    ambulances = [u for u in units if u["type"] == "AMBULANCE"]
    fire_units = [u for u in units if u["type"] == "FIRE"]
    available_units = [u for u in units if u["status"] == "AVAILABLE"]
    busy_units = [u for u in units if u["status"] == "BUSY"]

    assert len(ambulances) >= 2
    assert len(fire_units) >= 1
    assert len(available_units) >= 1
    assert len(busy_units) >= 1

    for u in units:
        assert u["type"] in ["AMBULANCE", "FIRE"]
        assert u["status"] in ["AVAILABLE", "BUSY"]
        assert "latitude" in u and "longitude" in u


def test_twin_state_geojson_sectors():
    """Verify GeoJSON FeatureCollection structure and specific 4 sectors without flood zone."""
    response = client.get("/api/twin/state")
    geo = response.json()["geojson_sectors"]

    assert geo["type"] == "FeatureCollection"
    assert "features" in geo
    features = geo["features"]
    assert len(features) == 4

    sector_ids = [f["properties"]["id"] for f in features]
    assert "SEC-04" in sector_ids
    assert "SEC-07" in sector_ids
    assert "SEC-09" in sector_ids
    assert "SEC-11" in sector_ids

    # Verify no flood zone exists
    for f in features:
        props = f["properties"]
        assert "flood" not in props["name"].lower()
        assert "flood" not in props["type"].lower()
        assert "flood" not in props["status"].lower()

        # Verify valid GeoJSON polygon geometry
        geom = f["geometry"]
        assert geom["type"] == "Polygon"
        assert len(geom["coordinates"]) > 0
        ring = geom["coordinates"][0]
        assert len(ring) >= 4
        # Closed polygon ring check
        assert ring[0] == ring[-1]


def test_twin_state_available_actions():
    """Verify available actions match candidate set ROUTE_A, ROUTE_C, DELAY_10."""
    response = client.get("/api/twin/state")
    actions = response.json()["available_actions"]
    assert sorted(actions) == sorted(["ROUTE_A", "ROUTE_C", "DELAY_10"])


def test_mock_city_immutability():
    """Verify that multiple state accesses return isolated copies without mutation side-effects."""
    state1 = get_mock_twin_state()
    state1.hospitals[0].occupied_beds = 999  # modify local instance
    state2 = get_mock_twin_state()
    assert state2.hospitals[0].occupied_beds != 999


def test_hospital_endpoints_alias():
    """Verify that both /api/hospitals and /api/db/hospitals return 200 and identical hospital data."""
    res_alias = client.get("/api/hospitals")
    res_db = client.get("/api/db/hospitals")

    assert res_alias.status_code == 200
    assert res_db.status_code == 200
    assert res_alias.json() == res_db.json()
    assert len(res_alias.json()) >= 3

