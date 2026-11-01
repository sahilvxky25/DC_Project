"""BitSecure local-only network diagnostics agent."""
import ipaddress
import platform
import re
import socket
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="BitSecure Local Network Agent", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type"])
WINDOWS = platform.system().lower() == "windows"
HOST_RE = re.compile(r"^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*\.?$")

class HostRequest(BaseModel):
    host: str = Field(min_length=1, max_length=253)

class PingRequest(HostRequest):
    count: int = Field(default=4, ge=1, le=10)
    timeout: int = Field(default=2, ge=1, le=5)

class TraceRequest(HostRequest):
    max_hops: int = Field(default=12, ge=1, le=20)
    timeout: int = Field(default=20, ge=5, le=30)

def validate_host(value: str) -> str:
    host = value.strip()
    if not host or any(c in host for c in "\r\n\x00 /\\;|&$\x60'\"<>"):
        raise HTTPException(status_code=422, detail="Enter a hostname or IP address only.")
    try:
        return str(ipaddress.ip_address(host))
    except ValueError:
        if not HOST_RE.fullmatch(host):
            raise HTTPException(status_code=422, detail="Enter a valid hostname or IP address.")
        return host.rstrip(".")

def run_fixed(args: list[str], timeout: int = 15) -> dict:
    try:
        result = subprocess.run(args, shell=False, capture_output=True, text=True, timeout=timeout, check=False, errors="replace")
        output = (result.stdout or "").strip()
        if result.stderr and not output:
            output = result.stderr.strip()
        return {"ok": result.returncode == 0, "exit_code": result.returncode, "output": (output or "Command finished with no output.")[:12000]}
    except FileNotFoundError:
        return {"ok": False, "exit_code": None, "output": f"Required system utility not found: {args[0]}. Install it and try again."}
    except subprocess.TimeoutExpired:
        return {"ok": False, "exit_code": None, "output": "Timed out. The destination may be unreachable or your network may block this diagnostic."}

@app.get("/api/health")
def health():
    return {"ok": True, "agent": "BitSecure Local Network Agent", "platform": platform.platform()}

@app.post("/api/ping")
def ping(body: PingRequest):
    host = validate_host(body.host)
    args = ["ping", "-n", str(body.count), "-w", str(body.timeout * 1000), host] if WINDOWS else ["ping", "-c", str(body.count), "-W", str(body.timeout), host]
    return {"command": "ping", "host": host, **run_fixed(args, timeout=min(20, body.count * body.timeout + 3))}

@app.post("/api/traceroute")
def traceroute(body: TraceRequest):
    host = validate_host(body.host)
    args = ["tracert", "-d", "-h", str(body.max_hops), "-w", "1000", host] if WINDOWS else ["traceroute", "-n", "-m", str(body.max_hops), "-w", "1", host]
    result = run_fixed(args, timeout=body.timeout)
    if not WINDOWS and result.get("output", "").startswith("Required system utility not found"):
        result["output"] += "\nInstall traceroute with your OS package manager."
    return {"command": "tracert" if WINDOWS else "traceroute", "host": host, **result}

@app.post("/api/dns")
def dns(body: HostRequest):
    host = validate_host(body.host)
    try:
        addresses = sorted({item[4][0] for item in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)})
        return {"ok": bool(addresses), "host": host, "addresses": addresses, "output": "\n".join(addresses) or "No addresses found."}
    except socket.gaierror as exc:
        return {"ok": False, "host": host, "addresses": [], "output": f"DNS lookup failed: {exc}"}

@app.get("/api/interfaces")
def interfaces():
    args = ["ipconfig", "/all"] if WINDOWS else ["ip", "addr"]
    return {"command": args[0], **run_fixed(args, timeout=8)}

@app.get("/api/routes")
def routes():
    args = ["route", "print"] if WINDOWS else ["ip", "route"]
    return {"command": " ".join(args), **run_fixed(args, timeout=8)}
