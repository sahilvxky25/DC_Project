"""Database tables."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)  # stored lowercase
    password_hash: Mapped[str] = mapped_column(String(255))                   # argon2id hash, never plain text
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# JSONB on PostgreSQL (indexable, compact); plain JSON elsewhere (e.g. SQLite for quick tests).
_JsonDoc = JSON().with_variant(JSONB(), "postgresql")


class UserProgress(Base):
    """One progress document per user: visited screens, achievements, runs, stats, notes, theme..."""

    __tablename__ = "user_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    data: Mapped[dict] = mapped_column(_JsonDoc)
    # Incremented on every successful save; lets the API detect two devices saving over each other.
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class TraceRun(Base):
    """One "Live route" run: the path traced to a public IP and, if a receiver answered, the delivery."""

    __tablename__ = "trace_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    target_ip: Mapped[str] = mapped_column(String(45))
    status: Mapped[str] = mapped_column(String(32), default="running")
    hops: Mapped[list] = mapped_column(_JsonDoc, default=list)
    delivery: Mapped[dict | None] = mapped_column(_JsonDoc, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
