"""BitSecure cloud diagnostics API. Commands run on this server, never the visitor's device."""
from __future__ import annotations
import ipaddress, json, os, re, shutil, socket, subprocess, time
from collections import defaultdict, deque
from threading import Lock
from typing import Literal
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "bit-7ce8a")
SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
ORIGINS = [x.strip().rstrip("/") for x in os.getenv("ALLOWED_ORIGINS", "").split(",") if x.strip()]
HOST_RE = re.compile(r"^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))+$")
BLOCKED_SUFFIXES = (".local", ".localhost", ".internal", ".test", ".invalid", ".example")
MAX_SECONDS, MAX_OUTPUT, RATE_LIMIT, RATE_WINDOW = 16, 12000, 12, 60
app = FastAPI(title="BitSecure Cloud Diagnostics", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=False, allow_methods=["GET","POST","OPTIONS"], allow_headers=["Authorization","Content-Type"])
bearer = HTTPBearer(auto_error=False)
_rate_lock = Lock()
_rate_events: dict[str, deque[float]] = defaultdict(deque)

def get_admin_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()
    if not SERVICE_ACCOUNT_JSON:
        raise HTTPException(status_code=503, detail="Cloud diagnostics authentication is not configured.")
    try:
        return firebase_admin.initialize_app(credentials.Certificate(json.loads(SERVICE_ACCOUNT_JSON)), {"projectId": PROJECT_ID})
    except Exception:
        raise HTTPException(status_code=503, detail="Cloud diagnostics authentication is not configured.")

def require_user(token: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if token is None:
        raise HTTPException(status_code=401, detail="Sign in to run cloud diagnostics.")
    admin_app = get_admin_app()
    try:
        return firebase_auth.verify_id_token(token.credentials, app=admin_app)
    except Exception:
        raise HTTPException(status_code=401, detail="Your sign-in session is invalid or expired. Sign in again.")

def enforce_rate_limit(uid: str):
    now = time.monotonic()
    with _rate_lock:
        events = _rate_events[uid]
        while events and now - events[0] > RATE_WINDOW:
            events.popleft()
        if len(events) >= RATE_LIMIT:
            raise HTTPException(status_code=429, detail="Rate limit reached. Wait a minute before running more diagnostics.")
        events.append(now)

def valid_hostname(value: str) -> str:
    host = value.strip().rstrip(".")
    if not HOST_RE.fullmatch(host) or host.lower().endswith(BLOCKED_SUFFIXES):
        raise HTTPException(status_code=400, detail="Enter a fully qualified hostname, such as example.com.")
    if any(not label or len(label) > 63 for label in host.split(".")):
        raise HTTPException(status_code=400, detail="Invalid hostname.")
    return host

def resolve_public_ipv4(host: str) -> str:
    try:
        records = socket.getaddrinfo(host, None, family=socket.AF_INET, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="The hostname could not be resolved to a public IPv4 address.")
    addresses = sorted({item[4][0] for item in records})
    if not addresses:
        raise HTTPException(status_code=400, detail="No IPv4 address was found.")
    for address in addresses:
        if not ipaddress.ip_address(address).is_global:
            raise HTTPException(status_code=400, detail="Private, local, reserved, or non-public destinations are blocked.")
    return addresses[0]

class DiagnosticRequest(BaseModel):
    command: Literal["ping", "traceroute", "nslookup"]
    target: str = Field(min_length=1, max_length=253)

@app.get("/health")
def health():
    return {"ok": True, "service": "BitSecure Cloud Diagnostics", "executionLocation": "cloud"}

@app.post("/api/diagnostics/run")
def run_diagnostic(payload: DiagnosticRequest, user: dict = Depends(require_user)):
    enforce_rate_limit(str(user.get("uid", "unknown")))
    host = valid_hostname(payload.target)
    started = time.monotonic()
    if payload.command == "nslookup":
        executable = shutil.which("nslookup")
        if not executable:
            raise HTTPException(status_code=503, detail="nslookup is not installed on the diagnostics server.")
        argv = [executable, host]
    else:
        public_ip = resolve_public_ipv4(host)
        if payload.command == "ping":
            executable = shutil.which("ping")
            if not executable:
                raise HTTPException(status_code=503, detail="ping is not installed on the diagnostics server.")
            argv = [executable, "-c", "4", "-W", "2", public_ip]
        else:
            executable = shutil.which("traceroute")
            if not executable:
                raise HTTPException(status_code=503, detail="traceroute is not installed on the diagnostics server.")
            argv = [executable, "-n", "-m", "12", "-w", "1", "-q", "1", public_ip]
    try:
        result = subprocess.run(argv, shell=False, capture_output=True, text=True, timeout=MAX_SECONDS, check=False, env={"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "LANG": "C"})
        output = (result.stdout + ("\n" + result.stderr if result.stderr else "")).strip() or "(The command returned no output.)"
        return {"ok": result.returncode == 0, "command": payload.command, "target": host, "output": output[:MAX_OUTPUT].splitlines(), "exitCode": result.returncode, "durationMs": round((time.monotonic()-started)*1000), "executionLocation": "cloud", "note": "This result is from the cloud diagnostics server, not the visitor's device."}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail=f"{payload.command} exceeded the {MAX_SECONDS}-second timeout.")
