"""Pydantic schemas for Dynamic Hazard Incidents.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class IncidentType(str, Enum):
    FIRE = "FIRE"
    FLOOD = "FLOOD"
    ACCIDENT = "ACCIDENT"
    ROADBLOCK = "ROADBLOCK"
    SOS = "SOS"


class IncidentSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    SAFE = "SAFE"


class IncidentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    RESPONDING = "RESPONDING"
    RESOLVED = "RESOLVED"


class IncidentResponse(BaseModel):
    id: str
    title: str
    incident_type: str
    severity: str
    lat: float
    lng: float
    radius_meters: int = 250
    status: str = "ACTIVE"
    description: Optional[str] = ""
    created_at: Optional[str] = None


class CreateIncidentRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    incident_type: IncidentType
    severity: IncidentSeverity
    lat: float
    lng: float
    radius_meters: int = Field(default=250, ge=50, le=1000)
    status: IncidentStatus = IncidentStatus.ACTIVE
    description: Optional[str] = ""


class UpdateIncidentStatusRequest(BaseModel):
    status: IncidentStatus


class GeminiStructuredIncidentExtraction(BaseModel):
    """Enforced structured schema for Gemini API extraction."""
    incident_type: str = Field(
        ...,
        description="Strictly one of: FIRE, FLOOD, ACCIDENT, ROADBLOCK, SOS"
    )
    severity: str = Field(
        ...,
        description="Strictly one of: CRITICAL, HIGH, MODERATE, SAFE"
    )
    extracted_location_name: str = Field(
        ...,
        description="Name of the affected street, junction, landmark, or locality in Hyderabad"
    )
    estimated_lat: float = Field(
        ...,
        description="Estimated latitude coordinate in Hyderabad (around 17.36 to 17.46)"
    )
    estimated_lng: float = Field(
        ...,
        description="Estimated longitude coordinate in Hyderabad (around 78.44 to 78.54)"
    )
    radius_meters: int = Field(
        default=250,
        description="Estimated impact radius in meters (typically 200m to 400m)"
    )
    summary: str = Field(
        ...,
        description="Operational summary of the incident"
    )
