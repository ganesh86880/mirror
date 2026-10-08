"""Mock Digital Twin environment representing Hyderabad demonstration state for Scenario S-27.

Disclaimer: All geographic sectors, hospitals, units, and coordinates in this module
are synthetic mock simulation data designed for hackathon testing and decision demonstration.
"""

from copy import deepcopy
from typing import Any, Dict, List
from app.schemas.twin import (
    DigitalTwinState,
    EmergencyIncident,
    EmergencyUnit,
    GeoJSONFeature,
    GeoJSONFeatureCollection,
    GeoJSONGeometry,
    Hospital,
    IncidentLocation,
    SectorProperties,
    UnitStatus,
    UnitType,
)

# Hyderabad City Center benchmark
CITY_CENTER = {
    "longitude": 78.4867,
    "latitude": 17.3850,
}

# Baseline emergency risk level
BASELINE_RISK: float = 74.0

# Supported candidate actions
SUPPORTED_ACTIONS: List[str] = ["ROUTE_A", "ROUTE_C", "DELAY_10"]

# Sector definitions (Polygons around Hyderabad)
# Coordinates format: GeoJSON [longitude, latitude], closed ring
_RAW_SECTORS: List[Dict[str, Any]] = [
    {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [78.4810, 17.3880],
                    [78.4880, 17.3880],
                    [78.4880, 17.3940],
                    [78.4810, 17.3940],
                    [78.4810, 17.3880],
                ]
            ],
        },
        "properties": {
            "id": "SEC-04",
            "name": "Sector 04",
            "type": "Fire Hazard Zone",
            "severity": "HIGH",
            "status": "ACTIVE_HAZARD",
        },
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [78.4720, 17.3810],
                    [78.4790, 17.3810],
                    [78.4790, 17.3870],
                    [78.4720, 17.3870],
                    [78.4720, 17.3810],
                ]
            ],
        },
        "properties": {
            "id": "SEC-07",
            "name": "Sector 07",
            "type": "Congested Junction / Traffic Obstruction Zone",
            "severity": "CRITICAL",
            "status": "CONGESTED",
        },
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [78.4780, 17.3970],
                    [78.4850, 17.3970],
                    [78.4850, 17.4030],
                    [78.4780, 17.4030],
                    [78.4780, 17.3970],
                ]
            ],
        },
        "properties": {
            "id": "SEC-09",
            "name": "Sector 09",
            "type": "Blocked Corridor",
            "severity": "HIGH",
            "status": "BLOCKED",
        },
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [78.4680, 17.4060],
                    [78.4750, 17.4060],
                    [78.4750, 17.4130],
                    [78.4680, 17.4130],
                    [78.4680, 17.4060],
                ]
            ],
        },
        "properties": {
            "id": "SEC-11",
            "name": "Sector 11",
            "type": "Designated Safe Emergency Access Zone",
            "severity": "LOW",
            "status": "CLEAR",
        },
    },
]

# Exactly 3 Hospitals with internally consistent capacity
_RAW_HOSPITALS: List[Dict[str, Any]] = [
    {
        "id": "HOSP-01",
        "name": "Osmania General Hospital",
        "total_beds": 500,
        "occupied_beds": 420,
        "available_beds": 80,
        "occupancy_percent": 84.0,
        "latitude": 17.3785,
        "longitude": 78.4735,
    },
    {
        "id": "HOSP-02",
        "name": "Gandhi Hospital",
        "total_beds": 400,
        "occupied_beds": 300,
        "available_beds": 100,
        "occupancy_percent": 75.0,
        "latitude": 17.4243,
        "longitude": 78.5034,
    },
    {
        "id": "HOSP-03",
        "name": "Nizam's Institute of Medical Sciences (NIMS)",
        "total_beds": 300,
        "occupied_beds": 210,
        "available_beds": 90,
        "occupancy_percent": 70.0,
        "latitude": 17.4223,
        "longitude": 78.4526,
    },
]

# Exactly 5 Emergency Units (at least 2 Ambulances, some AVAILABLE, some BUSY)
_RAW_UNITS: List[Dict[str, Any]] = [
    {
        "id": "UNIT-01",
        "type": UnitType.AMBULANCE,
        "status": UnitStatus.AVAILABLE,
        "latitude": 17.3872,
        "longitude": 78.4821,
    },
    {
        "id": "UNIT-02",
        "type": UnitType.AMBULANCE,
        "status": UnitStatus.BUSY,
        "latitude": 17.3745,
        "longitude": 78.4910,
    },
    {
        "id": "UNIT-03",
        "type": UnitType.AMBULANCE,
        "status": UnitStatus.AVAILABLE,
        "latitude": 17.4102,
        "longitude": 78.4615,
    },
    {
        "id": "UNIT-04",
        "type": UnitType.FIRE,
        "status": UnitStatus.BUSY,
        "latitude": 17.3910,
        "longitude": 78.4780,
    },
    {
        "id": "UNIT-05",
        "type": UnitType.FIRE,
        "status": UnitStatus.AVAILABLE,
        "latitude": 17.4350,
        "longitude": 78.4980,
    },
]

# S-27 Scenario Emergency Incidents
_RAW_INCIDENTS: List[Dict[str, Any]] = [
    {
        "id": "INC-2701",
        "title": "Critical Patient Transport - S-27 Emergency Corridor Request",
        "type": "MEDICAL_EMERGENCY",
        "severity": "CRITICAL",
        "status": "IN_PROGRESS",
        "sector_id": "SEC-07",
        "description": "Ambulance transporting polytrauma patient needing swift passage through dense traffic choke point.",
        "location": {"latitude": 17.3820, "longitude": 78.4850},
    },
    {
        "id": "INC-2702",
        "title": "Sector 04 Commercial Structural Fire",
        "type": "FIRE_HAZARD",
        "severity": "HIGH",
        "status": "ACTIVE",
        "sector_id": "SEC-04",
        "description": "Active warehouse fire in Sector 04 generating smoke plume and partial corridor restrictions.",
        "location": {"latitude": 17.3890, "longitude": 78.4760},
    },
    {
        "id": "INC-2703",
        "title": "Major Junction Gridlock & Blocked Corridor",
        "type": "TRAFFIC_OBSTRUCTION",
        "severity": "HIGH",
        "status": "ACTIVE",
        "sector_id": "SEC-09",
        "description": "Multi-vehicle incident blocking arterial artery in Sector 09, diverting secondary traffic flow.",
        "location": {"latitude": 17.3980, "longitude": 78.4890},
    },
]


def get_mock_sectors() -> GeoJSONFeatureCollection:
    """Return validated GeoJSON FeatureCollection of emergency sectors."""
    features = [
        GeoJSONFeature(
            type="Feature",
            geometry=GeoJSONGeometry(
                type="Polygon",
                coordinates=item["geometry"]["coordinates"],
            ),
            properties=SectorProperties(**item["properties"]),
        )
        for item in deepcopy(_RAW_SECTORS)
    ]
    return GeoJSONFeatureCollection(type="FeatureCollection", features=features)


def get_mock_hospitals() -> List[Hospital]:
    """Return deep-copied validated list of exactly 3 hospitals."""
    return [Hospital(**item) for item in deepcopy(_RAW_HOSPITALS)]


def get_mock_emergency_units() -> List[EmergencyUnit]:
    """Return deep-copied validated list of exactly 5 emergency units."""
    return [EmergencyUnit(**item) for item in deepcopy(_RAW_UNITS)]


def get_mock_incidents() -> List[EmergencyIncident]:
    """Return deep-copied list of active emergency incidents."""
    return [
        EmergencyIncident(
            id=item["id"],
            title=item["title"],
            type=item["type"],
            severity=item["severity"],
            status=item["status"],
            sector_id=item["sector_id"],
            description=item["description"],
            location=IncidentLocation(**item["location"]),
        )
        for item in deepcopy(_RAW_INCIDENTS)
    ]


def get_mock_twin_state() -> DigitalTwinState:
    """
    Return the complete, immutable baseline Digital Twin state for Scenario S-27.
    Guarantees no side-effects or mutations on repeated invocations.
    """
    return DigitalTwinState(
        current_risk=BASELINE_RISK,
        incidents=get_mock_incidents(),
        hospitals=get_mock_hospitals(),
        emergency_units=get_mock_emergency_units(),
        geojson_sectors=get_mock_sectors(),
        available_actions=list(SUPPORTED_ACTIONS),
    )
