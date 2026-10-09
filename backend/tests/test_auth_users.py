"""Tests for Authentication & Multi-User Live Responder Location.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_seeded_ambulance():
    response = client.post(
        "/api/auth/login",
        json={"email": "ambulance@mirror.emergency", "password": "password123"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "AMBULANCE"
    assert data["user"]["email"] == "ambulance@mirror.emergency"


def test_login_invalid_password():
    response = client.post(
        "/api/auth/login",
        json={"email": "ambulance@mirror.emergency", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_register_and_login_new_responder():
    import uuid
    rand_email = f"police_{uuid.uuid4().hex[:6]}@mirror.emergency"
    reg_response = client.post(
        "/api/auth/register",
        json={
            "name": "Officer Reddy",
            "email": rand_email,
            "password": "mypassword123",
            "role": "TRAFFIC_POLICE",
            "lat": 17.3950,
            "lng": 78.4810,
        },
    )
    assert reg_response.status_code == 201, reg_response.text
    reg_data = reg_response.json()
    assert reg_data["user"]["role"] == "TRAFFIC_POLICE"
    assert "access_token" in reg_data

    # Login with newly created credentials
    login_response = client.post(
        "/api/auth/login",
        json={"email": rand_email, "password": "mypassword123"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["name"] == "Officer Reddy"


def test_get_active_users():
    response = client.get("/api/users/active")
    assert response.status_code == 200
    users = response.json()
    assert isinstance(users, list)
    assert len(users) >= 4
    roles = {u["role"] for u in users}
    assert "AMBULANCE" in roles
    assert "FIRE_ENGINE" in roles


def test_update_location():
    # Login as ambulance
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "ambulance@mirror.emergency", "password": "password123"},
    )
    token = login_resp.json()["access_token"]
    user_id = login_resp.json()["user"]["id"]

    # Update location using Bearer token
    patch_resp = client.patch(
        "/api/users/location",
        headers={"Authorization": f"Bearer {token}"},
        json={"lat": 17.3915, "lng": 78.4835},
    )
    assert patch_resp.status_code == 200, patch_resp.text
    updated = patch_resp.json()
    assert updated["id"] == user_id
    assert abs(updated["lat"] - 17.3915) < 0.0001
    assert abs(updated["lng"] - 78.4835) < 0.0001
