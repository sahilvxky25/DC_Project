"""Register and login."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..security import (
    LoginLimiter,
    burn_verify_time,
    create_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = LoginLimiter()


def _issue(user: User, remember: bool) -> TokenOut:
    minutes = settings.remember_token_minutes if remember else settings.access_token_minutes
    return TokenOut(
        access_token=create_access_token(str(user.id), minutes),
        expires_in=minutes * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    exists = HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    if db.scalar(select(User).where(User.email == email)):
        raise exists
    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two sign-ups at the same instant
        db.rollback()
        raise exists
    return _issue(user, body.remember)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.lower()
    key = f"{request.client.host if request.client else 'unknown'}:{email}"
    if limiter.blocked(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Try again in a few minutes.")

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        burn_verify_time(body.password)
        ok = False
    else:
        ok = verify_password(user.password_hash, body.password)

    if not ok:
        limiter.record_failure(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    limiter.reset(key)
    return _issue(user, body.remember)
