"""Pydantic schemas for User Authentication and Multi-User Roles.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Role(str, Enum):
    AMBULANCE = "AMBULANCE"
    FIRE_ENGINE = "FIRE_ENGINE"
    TRAFFIC_POLICE = "TRAFFIC_POLICE"
    PUBLIC = "PUBLIC"


class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=3, max_length=120)
    password: str = Field(..., min_length=6)
    role: Role = Role.PUBLIC
    lat: Optional[float] = 17.3850
    lng: Optional[float] = 78.4867


class UserLoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    lat: float
    lng: float
    is_online: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UpdateLocationRequest(BaseModel):
    lat: float
    lng: float
    user_id: Optional[str] = None
