# MIRROR — Emergency Response Decision Twin (Backend)

> **"What will happen if we take this action?"**

MIRROR is a decision-centric emergency digital twin designed to simulate and compare the consequences of response actions before execution. Rather than serving as a passive map or traffic monitor, MIRROR equips incident commanders with what-if consequence forecasting and programmatic lowest-risk recommendations.

The primary demonstration scenario is **S-27 — Clearing the Way for Ambulances**, set in a synthetic simulation environment based on Hyderabad.

---

> **Disclaimer**: All city sector coordinates, hospital metrics, and emergency incidents represent synthetic mock data designed for hackathon testing and algorithm demonstration.

---

## 1. Project Purpose & Architecture

MIRROR adheres to the closed-loop decision architecture:

```text
REAL-WORLD SIGNALS
        ↓
DIGITAL TWIN (Current Situation: S-27)
        ↓
DECISION ENGINE (Generate Candidate Actions)
        ↓
CONSEQUENCE ENGINE (Multi-Parameter What-If Simulation)
        ↓
OUTCOME COMPARER (Comparative Risk Analysis)
        ↓
LOWEST-RISK RECOMMENDATION (ROUTE_C Flagged)
        ↓
HUMAN DECISION (Incident Commander Evaluation)
        ↓
REAL-WORLD ACTION (Dispatch & Traffic Interventions)
        ↓
DIGITAL TWIN UPDATES ↺
```

---

## 2. Requirements

* **Python**: 3.11+
* **FastAPI**: 0.110+
* **Uvicorn**: 0.28+
* **Pydantic**: v2.6+
* **Pytest**: 8.0+
* **HTTPX**: 0.27+ (for test client execution)

---

## 3. Installation

1. Navigate to the `/backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python 3.11+ virtual environment:
   * **Windows (PowerShell)**:
     ```powershell
     py -3.11 -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   * **Linux / macOS**:
     ```bash
     python3.11 -m venv .venv
     source .venv/bin/activate
     ```

3. Install project dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## 4. How to Run the Backend

Run the development server via Uvicorn:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

* **API Base URL**: `http://127.0.0.1:8000`
* **Interactive OpenAPI Docs**: `http://127.0.0.1:8000/docs`
* **Alternative Redoc**: `http://127.0.0.1:8000/redoc`

---

## 5. How to Run Tests

Execute the comprehensive test suite with Pytest:

```bash
pytest tests -v
```

The test suite validates:
* Situational state integrity and capacity formulas for 3 hospitals and 5 emergency units.
* GeoJSON sector geometry valid rings and non-flood zone compliance.
* Deterministic mathematical calculations for `ROUTE_A`, `ROUTE_C`, and `DELAY_10`.
* Independent formula recalculation proving risk scores are derived rather than hard-coded.
* Programmatic outcome comparison ensuring `ROUTE_C` is flagged `LOWEST_RISK`.
* Safe client error responses on invalid, missing, or malformed payloads.

---

## 6. The Consequence-Risk Formula

All consequence scores are generated using a normalized multi-parameter risk formula:

$$\text{Overall Risk} = (0.35 \times \text{Exposure}) + (0.25 \times \text{Congestion}) + (0.20 \times \text{HospitalLoad}) + (0.20 \times \text{SecondaryRisk})$$

* **Scale**: All component scores operate strictly on a normalized `0–100` scale.
* **Baseline Risk**: Initial state before action is fixed at `74.0`.
* **Risk Difference**: Defined as $\Delta R = \text{Projected Risk} - \text{Baseline Risk}$.
  * Negative $\Delta R$: Risk reduction (desirable).
  * Positive $\Delta R$: Risk escalation (adverse).

### Demonstration Actions (Scenario S-27)

| Action ID | Description | Response Time | Congestion | Hospital Load $\Delta$ | Risk Score | $\Delta$ from Baseline | Flag |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`ROUTE_A`** | Primary arterial route | 21 min | 81% | +26% | **72.0** | -2.0 | `null` |
| **`ROUTE_C`** | Designated emergency access corridor | 14 min | 43% | +9% | **38.0** | -36.0 | `LOWEST_RISK` |
| **`DELAY_10`** | Hold dispatch by 10 minutes | 27 min | 86% | +35% | **86.0** | +12.0 | `null` |

*Note: For `DELAY_10`, the simulation predicts a +31% exposure escalation affecting 640 additional individuals (absolute count).*

---

## 7. API Endpoints

### `GET /api/twin/state`
Returns the complete situational state of the emergency digital twin.

**Response Structure (`HTTP 200`):**
```json
{
  "current_risk": 74.0,
  "incidents": [
    {
      "id": "INC-2701",
      "title": "Critical Patient Transport - S-27 Emergency Corridor Request",
      "type": "MEDICAL_EMERGENCY",
      "severity": "CRITICAL",
      "status": "IN_PROGRESS",
      "sector_id": "SEC-07",
      "description": "Ambulance transporting polytrauma patient needing swift passage through dense traffic choke point.",
      "location": { "latitude": 17.382, "longitude": 78.485 }
    }
  ],
  "hospitals": [
    {
      "id": "HOSP-01",
      "name": "Osmania General Hospital",
      "total_beds": 500,
      "occupied_beds": 420,
      "available_beds": 80,
      "occupancy_percent": 84.0,
      "latitude": 17.3785,
      "longitude": 78.4735
    }
  ],
  "emergency_units": [
    {
      "id": "UNIT-01",
      "type": "AMBULANCE",
      "status": "AVAILABLE",
      "latitude": 17.3872,
      "longitude": 78.4821
    }
  ],
  "geojson_sectors": {
    "type": "FeatureCollection",
    "features": [...]
  },
  "available_actions": ["ROUTE_A", "ROUTE_C", "DELAY_10"]
}
```

---

### `POST /api/simulate`
Simulates consequences for a specified action candidate.

**Request:**
```json
{
  "action_id": "ROUTE_C"
}
```

**Response (`HTTP 200`):**
```json
{
  "action_id": "ROUTE_C",
  "baseline_risk": 74.0,
  "projected_risk": 38.0,
  "risk_score": 38.0,
  "risk_difference": -36.0,
  "response_time_minutes": 14.0,
  "exposure": 35.0,
  "congestion": 43.0,
  "hospital_load": 45.0,
  "secondary_risk": 30.0,
  "additional_people_at_risk": 0,
  "flag": "LOWEST_RISK",
  "hospital_load_increase_percent": 9.0,
  "exposure_increase_percent": 0.0,
  "explanation": "Route C utilizes the designated emergency access corridor (Sector 11), entirely bypassing the Sector 07 bottleneck. Yields the fastest response (14 min), lowest transit congestion (43%), and minimal hospital surge (+9% load increase), drastically lowering overall system risk."
}
```

---

### `GET /api/simulate/compare`
Executes programmatic ranking and comparative evaluation across all candidate actions.

**Response (`HTTP 200`):**
```json
{
  "baseline_risk": 74.0,
  "lowest_risk_action": "ROUTE_C",
  "lowest_risk_score": 38.0,
  "action_rankings": [ ... ],
  "comparison_summary": "Comparative evaluation across 3 actions identified ROUTE_C as the optimal intervention with a projected risk of 38.0 (-36.0 change from baseline 74.0)."
}
```

---

## 8. Security & Validation

* **CORS**: Strict single-origin policy configured for `http://localhost:3000`. Wildcards (`*`) and unauthenticated credentials are disabled.
* **Input Validation**: Enforced via Pydantic v2. Invalid or unexpected action identifiers immediately return structured `HTTP 422` responses.
* **Error Hygiene**: Tracebacks, system paths, environment variables, and internal code details are shielded from API clients.

---

## 9. Phase 1 Limitations

* **Deterministic Mock Data**: All sectors, hospitals, units, and telemetry are static mock assets calibrated for Scenario S-27.
* **No Live Integrations**: Phase 1 excludes external real-time maps, live traffic feeds, hospital HL7/FHIR feeds, and persistent databases.
* **Frontend Scope**: Frontend UI dashboards are reserved for Phase 2.
