from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.schemas import UserLogin, UserRegister, TokenOut
from database import supabase
from config import settings
from jose import jwt, JWTError
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer()


def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm
    )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    """Decode JWT and return user profile."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    profile = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    if not profile.data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    return profile.data


async def require_admin(user=Depends(get_current_user)):
    """Dependency that requires admin role."""
    if user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


@router.post("/register", response_model=TokenOut)
async def register(body: UserRegister):
    """Register a new user via Supabase auth."""
    try:
        auth_resp = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {
                "data": {
                    "username": body.username,
                    "full_name": body.full_name or ""
                }
            }
        })
        if not auth_resp.user:
            raise HTTPException(400, "Registration failed")

        user_id = auth_resp.user.id
        token = create_token(user_id)

        # Fetch the auto-created profile
        profile = supabase.table("profiles").select("*").eq("id", user_id).single().execute()

        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user_id,
            "username": profile.data["username"],
            "role": profile.data["role"]
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/login", response_model=TokenOut)
async def login(body: UserLogin):
    """Login and receive a JWT."""
    try:
        auth_resp = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password
        })
        if not auth_resp.user:
            raise HTTPException(401, "Invalid credentials")

        user_id = auth_resp.user.id
        token = create_token(user_id)

        profile = supabase.table("profiles").select("*").eq("id", user_id).single().execute()

        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user_id,
            "username": profile.data["username"],
            "role": profile.data["role"]
        }
    except Exception as e:
        raise HTTPException(401, "Invalid credentials")


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user


@router.post("/make-admin/{user_id}")
async def make_admin(user_id: str, caller=Depends(require_admin)):
    """Promote a user to admin (admin only)."""
    result = supabase.table("profiles").update(
        {"role": "admin"}
    ).eq("id", user_id).execute()
    return result.data[0]
