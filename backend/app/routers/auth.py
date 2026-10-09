"""Authentication router for MIRROR.
Endpoints:
- POST /api/auth/register
- POST /api/auth/login
"""

import uuid
from fastapi import APIRouter, HTTPException, status
from app.auth import create_access_token, hash_password, verify_password
from app.db import create_user, get_user_by_email
from app.schemas.user import TokenResponse, UserLoginRequest, UserRegisterRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user responder",
)
async def register(req: UserRegisterRequest) -> TokenResponse:
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    user_id = f"usr-{uuid.uuid4().hex[:10]}"
    password_hash = hash_password(req.password)
    new_user = create_user(
        user_id=user_id,
        name=req.name,
        email=req.email,
        password_hash=password_hash,
        role=req.role.value,
        lat=req.lat if req.lat is not None else 17.3850,
        lng=req.lng if req.lng is not None else 78.4867,
        is_online=True,
    )

    token = create_access_token(user_id=new_user["id"], email=new_user["email"], role=new_user["role"])
    user_resp = UserResponse(
        id=new_user["id"],
        name=new_user["name"],
        email=new_user["email"],
        role=new_user["role"],
        lat=new_user["lat"],
        lng=new_user["lng"],
        is_online=bool(new_user["is_online"]),
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_resp)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate responder & receive JWT token",
)
async def login(req: UserLoginRequest) -> TokenResponse:
    user = get_user_by_email(req.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user_id=user["id"], email=user["email"], role=user["role"])
    user_resp = UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        lat=user["lat"],
        lng=user["lng"],
        is_online=bool(user["is_online"]),
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_resp)
