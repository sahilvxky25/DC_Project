import ipaddress
import json
import os
import shlex
import socket
import subprocess
import time
from collections import defaultdict, deque
from threading import Lock
from urllib.parse import urlparse

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

app = FastAPI(
    title="BitSecure Cloud Network Command Engine",
    version="1.0.0",
    description="Authenticated, allowlisted network diagnostics executed in an isolated cloud container.",
)

origins = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

bearer = HTTPBearer(auto_error=False)
_rate_lock = Lock()
_request_times = defaultdict(deque)
RATE_LIMIT = int(os.getenv("RATE_LIMIT_PER_MINUTE", "15"))
MAX_OUTPUT = 12000
TIMEOUT_SECONDS = 15


def _firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not configured")
    return firebase_admin.initialize_app(credentials.Certificate(json.loads(raw)))


def current_user(token: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if token is None or token.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to use live network diagnostics.")
    try:
        _firebase_app()
        return firebase_auth.verify_id_token(token.credentials, check_revoked=True)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=401, detail="Your session could not be verified. Sign in again.")


class CommandRequest(BaseModel):
    command: str = Field(min_length=1, max_length=300)


def _rate_limit(uid: str):
    now = time.monotonic()
    with _rate_lock:
        recent = _request_times[uid]
        while recent and now - recent[0] > 60:
            recent.popleft()
        if len(recent) >= RATE_LIMIT:
            raise HTTPException(status_code=429, detail="Rate limit reached. Wait a minute before running another command.")
        recent.append(now)


def _public_host(host: str) -> str:
    host = host.strip().rstrip(".")
    if not host or len(host) > 253 or any(ch.isspace() for ch in host):
        raise ValueError("Enter a valid public hostname or IP address.")
    if host.lower() in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        raise ValueError("Private and local network destinations are not allowed.")
    try:
        addresses = [ipaddress.ip_address(host.strip("[]"))]
    except ValueError:
        try:
            addresses = [ipaddress.ip_address(item[4][0]) for item in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)]
        except socket.gaierror:
            raise ValueError("The hostname could not be resolved from the cloud runner.")
    if not addresses or any(
        not (address.is_global and not address.is_multicast and not address.is_unspecified)
        for address in addresses
    ):
        raise ValueError("Only publicly routable destinations are allowed.")
    return host


def _run(argv: list[str], timeout: int = TIMEOUT_SECONDS) -> tuple[str, int]:
    try:
        result = subprocess.run(
            argv,
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            env={**os.environ, "LC_ALL": "C"},
        )
        output = (result.stdout + result.stderr).strip()
        if not output:
            output = f"Command finished with exit code {result.returncode} and no output."
        return output[:MAX_OUTPUT], result.returncode
    except FileNotFoundError:
        raise ValueError(f"Required utility '{argv[0]}' is not installed in the execution image.")
    except subprocess.TimeoutExpired:
        raise ValueError("The command timed out. Try a different target or a shorter diagnostic.")


def execute_allowlisted(command: str) -> tuple[str, str]:
    try:
        parts = shlex.split(command)
    except ValueError:
        raise ValueError("The command contains invalid quoting.")
    if not parts:
        raise ValueError("Enter a command to run.")
    if any(token in command for token in (";", "|", "&&", "||", ">", "<", "`", "$(", "\\n")):
        raise ValueError("Shell operators, pipes, scripts and command chaining are disabled.")

    name = parts[0].lower()
    args = parts[1:]

    if name == "ping":
        count = 4
        if args and args[0] in {"-c", "-n"}:
            if len(args) < 3 or not args[1].isdigit() or not 1 <= int(args[1]) <= 4:
                raise ValueError("Usage: ping [-c 1..4] public-host")
            count, args = int(args[1]), args[2:]
        if len(args) != 1:
            raise ValueError("Usage: ping [-c 1..4] public-host")
        host = _public_host(args[0])
        output, _ = _run(["ping", "-c", str(count), "-W", "3", host], timeout=14)
        return output, "Ping tests ICMP reachability from the BitSecure cloud runner. Some destinations block ICMP."

    if name in {"traceroute", "tracepath"}:
        max_hops = 12
        if args and args[0] == "-m":
            if len(args) < 3 or not args[1].isdigit() or not 1 <= int(args[1]) <= 12:
                raise ValueError("Usage: traceroute [-m 1..12] public-host")
            max_hops, args = int(args[1]), args[2:]
        if len(args) != 1:
            raise ValueError("Usage: traceroute [-m 1..12] public-host")
        host = _public_host(args[0])
        binary = "traceroute" if name == "traceroute" else "tracepath"
        argv = [binary, "-m", str(max_hops), "-w", "1", host] if binary == "traceroute" else [binary, "-m", str(max_hops), host]
        output, _ = _run(argv, timeout=TIMEOUT_SECONDS)
        return output, "Traceroute shows the route observed from the cloud runner. Routers may hide hops or filter probes."

    if name in {"nslookup", "dig"}:
        if len(args) != 1:
            raise ValueError(f"Usage: {name} public-host")
        host = _public_host(args[0])
        argv = ["nslookup", host] if name == "nslookup" else ["dig", "+time=3", "+tries=1", host]
        output, _ = _run(argv, timeout=8)
        return output, "DNS lookup uses the resolver configured for the cloud runner, not the visitor's device."

    if name == "curl":
        if len(args) != 1:
            raise ValueError("Usage: curl https://public-host/path (only a URL is accepted; curl flags are disabled)")
        url = args[0]
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Use a public http:// or https:// URL without embedded credentials.")
        _public_host(parsed.hostname)
        output, _ = _run(
            ["curl", "--head", "--silent", "--show-error", "--max-time", "10", "--max-redirs", "0", url],
            timeout=12,
        )
        return output, "curl sends a HEAD request from the cloud runner. Redirects are not followed for safety."

    if name == "ip" and args in (["addr"], ["a"], ["route"], ["r"], ["neigh"]):
        output, _ = _run(["ip", *args], timeout=5)
        return output, "This reports the isolated cloud container's interfaces/routes/neighbours, not the visitor's computer."

    if name == "ss" and args in (["-tuna"], ["-tun"], ["-lnt"]):
        output, _ = _run(["ss", *args], timeout=5)
        return output, "This reports socket information inside the cloud execution container."

    raise ValueError(
        "Command not allowed. Supported: ping, traceroute, nslookup, dig, curl, "
        "ip addr, ip route, ip neigh, ss -tuna. No shell commands, scripts or command chaining."
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "BitSecure Cloud Network Command Engine"}


@app.post("/api/commands/execute")
def execute(payload: CommandRequest, request: Request, user=Depends(current_user)):
    _rate_limit(user["uid"])
    started = time.perf_counter()
    try:
        output, explanation = execute_allowlisted(payload.command.strip())
        return {
            "ok": True,
            "command": payload.command.strip(),
            "output": output,
            "explanation": explanation,
            "durationMs": round((time.perf_counter() - started) * 1000),
            "executionLocation": "BitSecure cloud Linux container",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
