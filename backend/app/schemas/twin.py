"""Pydantic v2 schemas for Digital Twin State, Hospitals, Units, and GeoJSON."""

from enum import Enum
from typing import Any, List, Literal
from pydantic import BaseModel, Field, model_validator


class UnitType(str, Enum):
    """Allowed emergency unit types."""
    AMBULANCE = "AMBULANCE"
    FIRE = "FIRE"


class UnitStatus(str, Enum):
    """Allowed emergency unit statuses."""
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"


class Hospital(BaseModel):
    """Hospital capacity and geographic location model."""
    id: str = Field(..., description="Unique identifier for the hospital")
    name: str = Field(..., description="Full facility name")
    total_beds: int = Field(..., gt=0, description="Total licensed beds")
    occupied_beds: int = Field(..., ge=0, description="Currently occupied beds")
    available_beds: int = Field(..., ge=0, description="Currently available beds")
    occupancy_percent: float = Field(..., ge=0.0, le=100.0, description="Current bed occupancy percentage")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")

    @model_validator(mode="after")
    def validate_capacity_consistency(self) -> "Hospital":
        """Ensure mathematical consistency for bed counts and occupancy rate."""
        expected_available = self.total_beds - self.occupied_beds
        if self.available_beds != expected_available:
            raise ValueError(
                f"Hospital {self.id}: available_beds ({self.available_beds}) must equal "
                f"total_beds ({self.total_beds}) - occupied_beds ({self.occupied_beds}) = {expected_available}"
            )
        expected_occupancy = round((self.occupied_beds / self.total_beds) * 100, 2)
        if abs(self.occupancy_percent - expected_occupancy) > 0.1:
            raise ValueError(
                f"Hospital {self.id}: occupancy_percent ({self.occupancy_percent}) must match "
                f"calculated value ({expected_occupancy}%)"
            )
        return self


class EmergencyUnit(BaseModel):
    """Emergency vehicle unit model."""
    id: str = Field(..., description="Unique unit identifier")
    type: UnitType = Field(..., description="Unit type (AMBULANCE, FIRE)")
    status: UnitStatus = Field(..., description="Operational status (AVAILABLE, BUSY)")
    latitude: float = Field(..., description="Current latitude")
    longitude: float = Field(..., description="Current longitude")


class GeoJSONGeometry(BaseModel):
    """GeoJSON Polygon Geometry definition."""
    type: Literal["Polygon"] = "Polygon"
    coordinates: List[List[List[float]]] = Field(..., description="Polygon coordinate rings [longitude, latitude]")


class SectorProperties(BaseModel):
    """Properties payload for GeoJSON sector feature."""
    id: str = Field(..., description="Sector identifier (e.g. SEC-04)")
    name: str = Field(..., description="Sector name")
    type: str = Field(..., description="Zone classification")
    severity: str = Field(..., description="Zone hazard or congestion severity")
    status: str = Field(..., description="Operational status")


class GeoJSONFeature(BaseModel):
    """GeoJSON Feature representation."""
    type: Literal["Feature"] = "Feature"
    geometry: GeoJSONGeometry
    properties: SectorProperties


class GeoJSONFeatureCollection(BaseModel):
    """Standard GeoJSON FeatureCollection."""
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GeoJSONFeature]


class IncidentLocation(BaseModel):
    """Geographic coordinate location for an incident."""
    latitude: float
    longitude: float


class EmergencyIncident(BaseModel):
    """Active incident in the digital twin."""
    id: str = Field(..., description="Incident identifier")
    title: str = Field(..., description="Summary headline")
    type: str = Field(..., description="Incident category")
    severity: str = Field(..., description="Severity level")
    status: str = Field(..., description="Status (ACTIVE, IN_PROGRESS, RESOLVED)")
    sector_id: str = Field(..., description="Associated sector identifier")
    description: str = Field(..., description="Incident details")
    location: IncidentLocation = Field(..., description="Geographic point of incident")


class DigitalTwinState(BaseModel):
    """Complete digital twin situational state."""
    current_risk: float = Field(..., ge=0.0, le=100.0, description="Baseline system risk score (0-100)")
    incidents: List[EmergencyIncident] = Field(..., description="Active emergency incidents")
    hospitals: List[Hospital] = Field(..., description="Monitored hospitals")
    emergency_units: List[EmergencyUnit] = Field(..., description="Tracked emergency units")
    geojson_sectors: GeoJSONFeatureCollection = Field(..., description="City sector polygons")
    available_actions: List[str] = Field(..., description="Decision candidate actions")
