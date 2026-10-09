"""User management and live responder location router.
Endpoints:
- GET /api/users/active
- PATCH /api/users/location
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_optional_current_user_payload
from app.db import get_active_users, update_user_location, get_user_by_id
from app.schemas.user import UpdateLocationRequest, UserResponse

router = APIRouter(prefix="/api/users", tags=["Users & Fleet Telemetry"])


@router.get(
    "/active",
    response_model=List[UserResponse],
    summary="Get all online responders and coordinates",
)
async def list_active_users() -> List[UserResponse]:
    """Returns all online responders, their roles, and current GPS coordinates."""
    users = get_active_users()
    return [
        UserResponse(
            id=u["id"],
            name=u["name"],
            email=u["email"],
            role=u["role"],
            lat=u["lat"],
            lng=u["lng"],
            is_online=bool(u["is_online"]),
        )
        for u in users
    ]


@router.patch(
    "/location",
    response_model=UserResponse,
    summary="Update user's live GPS coordinates",
)
async def update_location(
    req: UpdateLocationRequest,
    token_payload: Optional[Dict[str, Any]] = Depends(get_optional_current_user_payload),
) -> UserResponse:
    """Updates current user's GPS coordinates. Supports Bearer token or payload user_id."""
    target_user_id = None
    if token_payload and "sub" in token_payload:
        target_user_id = token_payload["sub"]
    elif req.user_id:
        target_user_id = req.user_id

    if not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID must be provided via Bearer token or request payload.",
        )

    updated = update_user_location(target_user_id, req.lat, req.lng)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{target_user_id}' was not found.",
        )

    return UserResponse(
        id=updated["id"],
        name=updated["name"],
        email=updated["email"],
        role=updated["role"],
        lat=updated["lat"],
        lng=updated["lng"],
        is_online=bool(updated["is_online"]),
    )
