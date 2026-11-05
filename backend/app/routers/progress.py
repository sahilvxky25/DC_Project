"""Save and load the signed-in user's learning progress."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import User, UserProgress
from ..schemas import ProgressOut, ProgressPut

router = APIRouter(prefix="/api/progress", tags=["progress"])

MAX_BYTES = 256 * 1024  # one user's progress document


def _current(db: Session, user_id) -> UserProgress | None:
    return db.scalar(select(UserProgress).where(UserProgress.user_id == user_id))


def _conflict(db: Session, user_id) -> HTTPException:
    """409 that carries the server's copy so the client can merge and retry."""
    db.rollback()
    row = _current(db, user_id)
    return HTTPException(
        status.HTTP_409_CONFLICT,
        detail={
            "message": "Progress was changed from another device.",
            "version": row.version if row else 0,
            "data": row.data if row else None,
        },
    )


@router.get("", response_model=ProgressOut)
def get_progress(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _current(db, user.id)
    if row is None:
        return ProgressOut(version=0, data=None)
    return ProgressOut(version=row.version, data=row.data, updated_at=row.updated_at)


@router.put("", response_model=ProgressOut)
def put_progress(body: ProgressPut, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payload = body.data.model_dump()
    if len(json.dumps(payload, separators=(",", ":")).encode()) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Progress data is too large")

    now = datetime.now(timezone.utc)
    row = _current(db, user.id)

    if row is None:
        if body.base_version != 0:
            raise _conflict(db, user.id)
        db.add(UserProgress(user_id=user.id, data=payload, version=1, updated_at=now))
        try:
            db.commit()
        except IntegrityError:  # another device saved first
            raise _conflict(db, user.id)
        return ProgressOut(version=1, data=payload, updated_at=now)

    # Compare-and-set: only succeeds if nobody saved since this client last read.
    result = db.execute(
        update(UserProgress)
        .where(UserProgress.user_id == user.id, UserProgress.version == body.base_version)
        .values(data=payload, version=body.base_version + 1, updated_at=now)
    )
    if result.rowcount == 0:
        raise _conflict(db, user.id)
    db.commit()
    return ProgressOut(version=body.base_version + 1, data=payload, updated_at=now)
