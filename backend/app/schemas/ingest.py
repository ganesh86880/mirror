"""Pydantic v2 schemas for Citizen Report Ingestion and Gemini-parsed structured outputs."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class IncidentType(str, Enum):
    """Allowed incident classifications from Gemini extraction."""
    ROAD_BLOCKAGE = "ROAD_BLOCKAGE"
    FLOOD = "FLOOD"
    FIRE = "FIRE"
    MEDICAL_SOS = "MEDICAL_SOS"


class CitizenReportRequest(BaseModel):
    """Citizen report submission payload (text-based)."""
    text_report: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Free-form citizen report text describing the emergency or obstruction"
    )
    image_base64: Optional[str] = Field(
        None,
        description="Optional base64-encoded image of the incident"
    )
    audio_base64: Optional[str] = Field(
        None,
        description="Optional base64-encoded audio memo"
    )


class ParsedIncident(BaseModel):
    """Structured output extracted by Gemini from unstructured citizen report."""
    incident_type: str = Field(..., description="ROAD_BLOCKAGE | FLOOD | FIRE | MEDICAL_SOS")
    severity_score: int = Field(..., ge=1, le=10, description="Severity from 1 (minor) to 10 (critical)")
    affects_emergency_corridor: bool = Field(..., description="True if the incident blocks or compromises an emergency vehicle route")
    blocked_road_name: str = Field(..., description="Name or description of the blocked road or junction")
    estimated_delay_minutes: int = Field(..., ge=0, description="Estimated additional transit delay in minutes")
    summary: str = Field(..., description="Brief summary of the incident for operational display")


class IngestReportResponse(BaseModel):
    """Response payload after processing a citizen report."""
    status: str = Field(..., description="Processing status: 'processed' or 'error'")
    parsed_incident: Optional[ParsedIncident] = Field(None, description="Structured incident data extracted by Gemini")
    corridor_compromised: bool = Field(False, description="True if an emergency corridor was flagged")
    reroute_triggered: bool = Field(False, description="True if route re-simulation was triggered")
    alert_message: Optional[str] = Field(None, description="Operational alert message for dashboard display")
    incident_marker: Optional[dict] = Field(None, description="Map marker data for frontend plotting")
