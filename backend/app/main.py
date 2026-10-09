"""FastAPI Application for MIRROR Emergency Response Decision Twin.

Exposes REST APIs for Digital Twin Situational State and What-If Consequence Simulation.
"""

import logging
from typing import Any, Dict, List
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse

from app.routers.ingest import router as ingest_router
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.incidents import router as incidents_router
from app.schemas.simulation import (
    ActionId,
    OutcomeComparisonResult,
    SimulationRequest,
    SimulationResult,
)
from app.schemas.twin import DigitalTwinState
from app.simulation.consequence import compare_all_actions, simulate_action
from app.simulation.mock_city import get_mock_twin_state
from app.db import get_all_hospitals, get_all_units, get_all_incidents, dispatch_fire_engine

# Configure production-clean logging (server-side only)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mirror.api")

app = FastAPI(
    title="MIRROR Backend API",
    description="Emergency Response Decision Twin & Consequence Simulation Engine",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Register routers
app.include_router(ingest_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(incidents_router)

# CORS: Production configuration supporting Vercel and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"], summary="Fast Free-Tier Health Check")
def health_check() -> Dict[str, str]:
    """Lightweight health check endpoint for Render free tier and uptime monitors."""
    return {"status": "ok", "service": "MIRROR-Simulation-Engine", "tier": "free"}


@app.get("/healthz", tags=["Health"], summary="Service Health Check")
async def healthz_check() -> Dict[str, str]:
    """Lightweight health check endpoint for cloud platform probes."""
    return {"status": "healthy", "service": "MIRROR Backend API"}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Safe, structured client error response for invalid or malformed requests."""
    logger.warning("Validation error on %s: %s", request.url.path, exc.errors())
    allowed_actions = [a.value for a in ActionId]
    return JSONResponse(
        status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
        content={
            "error": "Validation Error",
            "message": "Invalid request payload. Ensure 'action_id' is one of the allowed actions.",
            "allowed_actions": allowed_actions,
            "details": [
                {
                    "loc": err.get("loc", []),
                    "msg": err.get("msg", "Invalid value"),
                    "type": err.get("type", "value_error"),
                }
                for err in exc.errors()
            ],
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Safe, structured response for standard HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Client Error",
            "message": exc.detail,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Safely handle unexpected internal exceptions.
    Prevents leaking stack traces, environment variables, or filesystem paths to API clients.
    """
    logger.error("Unhandled internal error processing %s: %s", request.url.path, str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing the simulation.",
        },
    )


@app.get("/", tags=["Health"])
async def root_health_check() -> Dict[str, Any]:
    """Basic health check and service identification."""
    return {
        "status": "online",
        "service": "MIRROR Emergency Response Decision Twin",
        "phase": "Phase 1 - Backend Foundation & Consequence Engine",
    }


@app.get(
    "/api/twin/state",
    response_model=DigitalTwinState,
    tags=["Digital Twin"],
    summary="Get current Digital Twin situation state",
)
async def get_twin_state() -> DigitalTwinState:
    """
    Returns the current situational state of the digital twin, including:
    - baseline risk score (74)
    - active incidents
    - hospitals and capacities
    - emergency units and availability
    - GeoJSON sectors for Hyderabad
    - candidate available response actions
    """
    return get_mock_twin_state()


@app.post(
    "/api/simulate",
    response_model=SimulationResult,
    tags=["Consequence Simulation"],
    summary="Simulate consequences of a candidate response action",
)
async def simulate(request: SimulationRequest) -> SimulationResult:
    """
    Simulates the what-if consequences of taking a candidate action:
    - ROUTE_A
    - ROUTE_C
    - DELAY_10

    Calculates projected risk using the multi-parameter consequence model:
        Overall Risk = (0.35 * Exposure) + (0.25 * Congestion) + (0.20 * HospitalLoad) + (0.20 * SecondaryRisk)

    Programmatically determines comparative recommendation flags.
    """
    try:
        result = simulate_action(request.action_id)
        return result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )


@app.get(
    "/api/simulate/compare",
    response_model=OutcomeComparisonResult,
    tags=["Outcome Comparison"],
    summary="Compare consequences across all candidate response actions",
)
async def compare_simulations() -> OutcomeComparisonResult:
    """
    Evaluates and ranks all candidate response actions, programmatically identifying
    the lowest-risk option based on mathematical risk scores.
    """
    return compare_all_actions()


@app.get("/api/hospitals", tags=["Database"])
async def api_hospitals() -> List[Dict[str, Any]]:
    """Returns persistent hospital records from SQLite database (alias)."""
    return get_all_hospitals()


@app.get("/api/db/hospitals", tags=["Database"])
async def db_hospitals() -> List[Dict[str, Any]]:
    """Returns persistent hospital records from SQLite database."""
    return get_all_hospitals()


@app.get("/api/db/units", tags=["Database"])
async def db_units() -> List[Dict[str, Any]]:
    """Returns persistent emergency units (Ambulances & Fire Engines) from SQLite database."""
    return get_all_units()


@app.post("/api/db/dispatch-fire", tags=["Database"])
async def db_dispatch_fire() -> Dict[str, Any]:
    """Dispatches Fire Engine FE-01 directly to Sector 04 Fire Hazard zone in database."""
    return dispatch_fire_engine()


@app.get("/api/map/plotly", response_class=HTMLResponse, tags=["Geospatial"])
async def get_plotly_map():
    """
    Renders an interactive, zero-API-key emergency map using Plotly + OpenStreetMap.
    Plots all live hazard zones, emergency units, hospitals, and tactical navigation routes.
    """
    import plotly.graph_objects as go

    fig = go.Figure()

    # 1. Hospitals (Green markers)
    hospitals = get_all_hospitals()
    if hospitals:
        fig.add_trace(
            go.Scattermapbox(
                lat=[h["lat"] for h in hospitals],
                lon=[h["lng"] for h in hospitals],
                mode="markers+text",
                marker=go.scattermapbox.Marker(size=14, color="#10B981"),
                text=[f"{h['name']}<br>Beds: {h['available_beds']}/{h['capacity']}" for h in hospitals],
                textposition="top right",
                name="Hospitals (Triage)",
            )
        )

    # 2. Responders / Units (Blue markers)
    units = get_all_units()
    if units:
        fig.add_trace(
            go.Scattermapbox(
                lat=[u["lat"] for u in units],
                lon=[u["lng"] for u in units],
                mode="markers+text",
                marker=go.scattermapbox.Marker(size=16, color="#3B82F6"),
                text=[f"{u['name']} ({u['unit_type']})<br>Status: {u['status']}" for u in units],
                textposition="bottom right",
                name="Emergency Responders",
            )
        )

    # 3. Dynamic Incidents / Hazard Zones
    incidents = get_all_incidents()
    if incidents:
        colors = {"FIRE": "#EF4444", "FLOOD": "#3B82F6", "ACCIDENT": "#F59E0B", "ROADBLOCK": "#F97316"}
        fig.add_trace(
            go.Scattermapbox(
                lat=[inc["lat"] for inc in incidents],
                lon=[inc["lng"] for inc in incidents],
                mode="markers+text",
                marker=go.scattermapbox.Marker(
                    size=[max(20, min(45, inc["radius_meters"] // 8)) for inc in incidents],
                    color=[colors.get(inc["incident_type"], "#EF4444") for inc in incidents],
                    opacity=0.75,
                ),
                text=[f"{inc['title']} ({inc['incident_type']})<br>Radius: {inc['radius_meters']}m" for inc in incidents],
                textposition="top left",
                name="Hazard Zones",
            )
        )

    # 4. Tactical Bypass Route Line (Green)
    bypass_lats = [17.388, 17.393, 17.395, 17.396]
    bypass_lons = [78.455, 78.458, 78.462, 78.466]
    fig.add_trace(
        go.Scattermapbox(
            lat=bypass_lats,
            lon=bypass_lons,
            mode="lines",
            line=dict(width=5, color="#2E856E"),
            name="Tactical Bypass Route (Clear)",
        )
    )

    # 5. Congested Route Line (Amber)
    congested_lats = [17.388, 17.389, 17.392, 17.396]
    congested_lons = [78.455, 78.460, 78.464, 78.466]
    fig.add_trace(
        go.Scattermapbox(
            lat=congested_lats,
            lon=congested_lons,
            mode="lines",
            line=dict(width=4, color="#D97706"),
            name="Congested Direct Route",
        )
    )

    # Plotly Open-Street-Map layout (ZERO API KEY REQUIRED)
    fig.update_layout(
        mapbox_style="open-street-map",
        mapbox_center={"lat": 17.396, "lon": 78.466},
        mapbox_zoom=13.5,
        margin={"r": 0, "t": 40, "l": 0, "b": 0},
        title=dict(
            text="MIRROR // Emergency Tactical Decision Twin (Plotly Open-Street-Map Engine)",
            font=dict(color="#FFFFFF", size=14, family="monospace"),
            x=0.02,
            y=0.98,
        ),
        paper_bgcolor="#11141A",
        plot_bgcolor="#11141A",
        legend=dict(
            bgcolor="rgba(22, 27, 34, 0.9)",
            bordercolor="rgba(255, 255, 255, 0.15)",
            borderwidth=1,
            font=dict(color="#F0F6FC", size=11, family="monospace"),
            x=0.01,
            y=0.02,
        ),
    )

    return HTMLResponse(
        fig.to_html(
            include_plotlyjs="cdn",
            full_html=True,
            config={"responsive": True, "displayModeBar": True},
        )
    )



if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)

