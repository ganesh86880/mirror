"""Router for Dynamic Hazard Incidents.
Endpoints:
- GET /api/incidents
- POST /api/incidents
- PATCH /api/incidents/{incident_id}/status
- DELETE /api/incidents/{incident_id}
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.db import (
    create_incident,
    delete_incident,
    get_all_incidents,
    get_incident_by_id,
    update_incident_status,
)
from app.schemas.incident import (
    CreateIncidentRequest,
    IncidentResponse,
    UpdateIncidentStatusRequest,
)

router = APIRouter(prefix="/api/incidents", tags=["Dynamic Hazard Incidents"])


@router.get(
    "",
    response_model=List[IncidentResponse],
    summary="List all dynamic hazard incidents",
)
async def list_incidents(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (ACTIVE, RESPONDING, RESOLVED)")
) -> List[IncidentResponse]:
    rows = get_all_incidents(status=status_filter)
    return [
        IncidentResponse(
            id=r["id"],
            title=r["title"],
            incident_type=r["incident_type"],
            severity=r["severity"],
            lat=r["lat"],
            lng=r["lng"],
            radius_meters=r["radius_meters"],
            status=r["status"],
            description=r.get("description", ""),
            created_at=r.get("created_at"),
        )
        for r in rows
    ]


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create custom incident via manual pin drop or API",
)
async def create_custom_incident(req: CreateIncidentRequest) -> IncidentResponse:
    inc_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    rec = create_incident(
        incident_id=inc_id,
        title=req.title,
        incident_type=req.incident_type.value,
        severity=req.severity.value,
        lat=req.lat,
        lng=req.lng,
        radius_meters=req.radius_meters,
        status=req.status.value,
        description=req.description or req.title,
    )
    return IncidentResponse(
        id=rec["id"],
        title=rec["title"],
        incident_type=rec["incident_type"],
        severity=rec["severity"],
        lat=rec["lat"],
        lng=rec["lng"],
        radius_meters=rec["radius_meters"],
        status=rec["status"],
        description=rec.get("description", ""),
        created_at=rec.get("created_at"),
    )


@router.patch(
    "/{incident_id}/status",
    response_model=IncidentResponse,
    summary="Update incident operational status",
)
async def update_status(incident_id: str, req: UpdateIncidentStatusRequest) -> IncidentResponse:
    updated = update_incident_status(incident_id, req.status.value)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return IncidentResponse(
        id=updated["id"],
        title=updated["title"],
        incident_type=updated["incident_type"],
        severity=updated["severity"],
        lat=updated["lat"],
        lng=updated["lng"],
        radius_meters=updated["radius_meters"],
        status=updated["status"],
        description=updated.get("description", ""),
        created_at=updated.get("created_at"),
    )


@router.delete(
    "/{incident_id}",
    summary="Delete an incident zone",
)
async def remove_incident(incident_id: str):
    success = delete_incident(incident_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return {"status": "deleted", "id": incident_id}
