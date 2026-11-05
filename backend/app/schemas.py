"""Request / response shapes."""
import uuid
from datetime import datetime

from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    remember: bool = False


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserOut


class ProgressDoc(BaseModel):
    """Shape of the saved progress. Unknown keys are dropped; sizes are capped."""

    model_config = ConfigDict(extra="ignore")
    visited: dict[str, Any] = Field(default_factory=dict)
    flags: dict[str, Any] = Field(default_factory=dict)
    ach: dict[str, Any] = Field(default_factory=dict)
    runs: list[Any] = Field(default_factory=list, max_length=200)
    stats: dict[str, Any] = Field(default_factory=dict)
    notes: dict[str, Any] = Field(default_factory=dict)
    tut: dict[str, Any] = Field(default_factory=dict)
    theme: str = Field("", max_length=32)
    last: str = Field("", max_length=256)


class ProgressPut(BaseModel):
    base_version: int = Field(ge=0)  # the version this client last saw (0 = nothing saved yet)
    data: ProgressDoc


class ProgressOut(BaseModel):
    version: int
    data: dict[str, Any] | None
    updated_at: datetime | None = None
