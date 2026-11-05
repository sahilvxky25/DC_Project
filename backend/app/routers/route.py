"""Live route: trace the path to a public IP and, if a BitSecure receiver is there, deliver a message."""
import asyncio
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal, get_db
from ..deps import get_current_user
from ..models import TraceRun, User
from ..services.receiver_client import probe_and_deliver
from ..services.route_tools import TargetError, ToolMissing, exec_lines, is_private_hop, parse_line, parse_target

router = APIRouter(prefix="/api/route", tags=["route"])
_slots = asyncio.Semaphore(settings.max_concurrent_traces)


def get_line_source():
    """Dependency so tests can replace the real traceroute with canned output."""
    return exec_lines


class RunIn(BaseModel):
    target: str = Field(max_length=64)
    message: str | None = Field(default=None, max_length=4000)


def _runs_last_hour(db: Session, user_id) -> int:
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    return db.scalar(select(func.count()).select_from(TraceRun).where(TraceRun.user_id == user_id, TraceRun.created_at >= since)) or 0


@router.get("/config")
def config(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        "max_hops": settings.max_hops,
        "max_message_bytes": settings.max_message_bytes,
        "runs_per_hour": settings.runs_per_hour,
        "runs_left": max(0, settings.runs_per_hour - _runs_last_hour(db, user.id)),
        "server_label": settings.server_label,
        "receiver_detection": bool(settings.receiver_secret),
    }


def _line(obj: dict) -> str:
    return json.dumps(obj, separators=(",", ":")) + "\n"


@router.post("/run")
async def run(body: RunIn, user: User = Depends(get_current_user), db: Session = Depends(get_db), lines=Depends(get_line_source)):
    try:
        ip = parse_target(body.target, settings.allow_private_targets)
    except TargetError as e:
        raise HTTPException(422, str(e))
    msg = body.message if body.message and body.message.strip() else None
    if msg and len(msg.encode()) > settings.max_message_bytes:
        raise HTTPException(422, f"Message is too long (max {settings.max_message_bytes} bytes).")
    if _runs_last_hour(db, user.id) >= settings.runs_per_hour:
        raise HTTPException(429, "Hourly limit reached. Try again later.", headers={"Retry-After": "600"})
    recent = datetime.now(timezone.utc) - timedelta(minutes=2)
    running = db.scalar(select(func.count()).select_from(TraceRun).where(
        TraceRun.user_id == user.id, TraceRun.status == "running", TraceRun.created_at >= recent)) or 0
    if running >= 2 or _slots.locked():
        raise HTTPException(429, "The server is busy. Try again in a moment.", headers={"Retry-After": "10"})

    row = TraceRun(user_id=user.id, target_ip=ip, status="running", hops=[])
    db.add(row)
    db.commit()
    return StreamingResponse(
        _stream(str(row.id), row.id, ip, msg, lines), media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream(run_id: str, row_id: uuid.UUID, ip: str, msg: str | None, lines):
    hops: list[dict] = []
    status, delivery = "cancelled", None
    try:
        yield _line({"type": "start", "run_id": run_id, "target": ip, "server_label": settings.server_label})
        reached = False
        async with _slots:
            try:
                async for text in lines(ip, settings.max_hops, settings.trace_timeout_s):
                    h = parse_line(text)
                    if not h:
                        continue
                    h["private"] = bool(h["ip"]) and is_private_hop(h["ip"])
                    hops.append(h)
                    reached = reached or h["ip"] == ip
                    yield _line({"type": "hop", **h})
            except ToolMissing as e:
                status = "error"
                yield _line({"type": "error", "message": f"'{e.exe}' is not installed on the server."})
                return

        found, name = False, None
        if settings.receiver_secret:
            res = await asyncio.to_thread(probe_and_deliver, ip, msg, settings.receiver_secret, settings.receiver_port)
            found, name, delivery = res["found"], res.get("name"), res.get("delivery")
            yield _line({"type": "receiver", "found": found, "name": name})
            if delivery:
                yield _line({"type": "delivery", **delivery})

        if found and msg:
            status = "delivered" if delivery and delivery["ok"] else "delivery_failed"
            text = (f"Delivered to receiver '{name}' and the checksum matched." if status == "delivered"
                    else "A receiver answered, but the delivery failed or the checksum did not match.")
        elif found:
            status, text = "route_only", f"Receiver '{name}' found here. Type a message to deliver it."
        elif reached:
            status = "route_only"
            text = ("The address answered, but no BitSecure receiver is running there, so no data was delivered."
                    if msg else "The address answered. The route is shown above.")
        else:
            status = "unreachable"
            text = "The address did not answer. Many routers and hosts block these probes, so the path may be incomplete."
        yield _line({"type": "done", "status": status, "reached": reached or found, "hops": len(hops), "message": text})
    except Exception:
        status = "error"
        yield _line({"type": "error", "message": "Something went wrong while tracing."})
    finally:
        try:
            with SessionLocal() as s:
                r = s.get(TraceRun, row_id)
                if r:
                    r.status, r.hops, r.delivery = status, hops, delivery
                    s.commit()
        except Exception:
            pass
