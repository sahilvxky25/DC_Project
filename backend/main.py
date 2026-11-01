"""Authenticated, allowlisted real network diagnostics for BitSecure.

Only fixed diagnostic operations are exposed. Never add arbitrary shell execution here.
"""
from __future__ import annotations

import http.client
import ipaddress
import json
import os
import platform
import re
import shutil
import socket
import ssl
import subprocess
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


def initialize_firebase() -> None:
    if firebase_admin._apps:
        return
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw:
        try:
            cert = credentials.Certificate(json.loads(raw))
        except (ValueError, TypeError) as exc:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON") from exc
        firebase_admin.initialize_app(cert)
    else:
        firebase_admin.initialize_app()


initialize_firebase()
app = FastAPI(title="BitSecure Real Network Diagnostics", version="1.0.0")
origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

MAX_OUTPUT = 12_000
TIMEOUT_SECONDS = 12
HOST_RE = re.compile(
    r"^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)"
    r"(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*\.?$"
)


class TargetRequest(BaseModel):
    target: str = Field(min_length=1, max_length=253)


class UrlRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


async def require_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="A Firebase ID token is required.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        return firebase_auth.verify_id_token(token, check_revoked=True)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Firebase authentication failed.") from exc


def validate_host(host: str) -> tuple[str, list[str]]:
    host = host.strip().rstrip(".")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if not literal.is_global:
            raise HTTPException(status_code=400, detail="Only public IP destinations are allowed.")
        return str(literal), [str(literal)]
    if not HOST_RE.fullmatch(host):
        raise HTTPException(status_code=400, detail="Enter a valid public hostname or IP address.")
    try:
        records = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail=f"DNS resolution failed: {exc}") from exc
    addresses = sorted({record[4][0].split("%", 1)[0] for record in records})
    if not addresses:
        raise HTTPException(status_code=400, detail="The hostname did not resolve.")
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise HTTPException(status_code=400, detail="Private or non-public destinations are blocked.")
    return host, addresses


def run_fixed(args: list[str]) -> str:
    """Run only a server-selected executable and argument list; no shell or user command string."""
    executable = shutil.which(args[0])
    if not executable:
        raise HTTPException(status_code=501, detail=f"Required utility '{args[0]}' is not installed on this host.")
    try:
        result = subprocess.run(
            [executable, *args[1:]],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            check=False,
            shell=False,
            env={"PATH": os.environ.get("PATH", ""), "LANG": "C", "LC_ALL": "C"},
        )
    except subprocess.TimeoutExpired as exc:
        partial = exc.stdout or b""
        if isinstance(partial, bytes):
            partial = partial.decode("utf-8", "replace")
        return (str(partial) + "\nTimed out after 12 seconds.").strip()[:MAX_OUTPUT]
    except OSError as exc:
        raise HTTPException(status_code=502, detail=f"Could not start diagnostic utility: {exc}") from exc
    output = (result.stdout + result.stderr).strip()
    if not output:
        output = f"Command finished with exit code {result.returncode} and no output."
    return output[:MAX_OUTPUT]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "BitSecure diagnostics"}


@app.post("/api/diagnostics/ping")
def ping(body: TargetRequest, user: dict = Depends(require_user)) -> dict[str, str]:
    host, _ = validate_host(body.target)
    if platform.system().lower() == "windows":
        args = ["ping", "-n", "4", "-w", "1500", host]
    else:
        args = ["ping", "-c", "4", "-W", "2", host]
    return {"output": run_fixed(args), "executed_on": "backend server"}


@app.post("/api/diagnostics/traceroute")
def traceroute(body: TargetRequest, user: dict = Depends(require_user)) -> dict[str, str]:
    host, _ = validate_host(body.target)
    if platform.system().lower() == "windows":
        args = ["tracert", "-d", "-h", "12", "-w", "800", host]
    else:
        utility = "traceroute" if shutil.which("traceroute") else "tracepath"
        args = ["traceroute", "-n", "-m", "12", "-w", "1", host] if utility == "traceroute" else ["tracepath", host]
    return {"output": run_fixed(args), "executed_on": "backend server"}


@app.post("/api/diagnostics/dns")
def dns(body: TargetRequest, user: dict = Depends(require_user)) -> dict[str, str]:
    host = body.target.strip().rstrip(".")
    if not HOST_RE.fullmatch(host):
        raise HTTPException(status_code=400, detail="Enter a public DNS hostname, not a command.")
    lines = [f"DNS lookup for {host}"]
    try:
        for family, _, _, _, sockaddr in socket.getaddrinfo(host, None):
            address = sockaddr[0]
            ip = ipaddress.ip_address(address.split("%", 1)[0])
            if not ip.is_global:
                raise HTTPException(status_code=400, detail="Private or non-public DNS results are blocked.")
            record = "AAAA" if family == socket.AF_INET6 else "A"
            line = f"{record}\t{address}"
            if line not in lines:
                lines.append(line)
    except socket.gaierror as exc:
        lines.append(f"Lookup failed: {exc}")
    return {"output": "\n".join(lines)[:MAX_OUTPUT], "executed_on": "backend server"}


def http_head(body: UrlRequest, user: dict = Depends(require_user)) -> dict[str, str]:
    parsed = urlsplit(body.url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Enter a valid public http:// or https:// URL without credentials.")
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid URL port.") from exc
    if port not in (80, 443) or (parsed.scheme == "http" and port != 80) or (parsed.scheme == "https" and port != 443):
        raise HTTPException(status_code=400, detail="Only standard HTTP port 80 and HTTPS port 443 are allowed.")
    host, addresses = validate_host(parsed.hostname)
    # Connect directly to an IP already checked above to avoid a second DNS lookup/SSRF rebinding.
    path = parsed.path or "/"
    if parsed.query:
        path += "?" + parsed.query
    conn = None
    started = time.monotonic()
    try:
        address = addresses[0]
        if parsed.scheme == "https":
            raw_sock = socket.create_connection((address, port), timeout=TIMEOUT_SECONDS)
            try:
                tls_sock = ssl.create_default_context().wrap_socket(raw_sock, server_hostname=host)
            except Exception:
                raw_sock.close()
                raise
            conn = http.client.HTTPSConnection(host, port=port, timeout=TIMEOUT_SECONDS, context=ssl.create_default_context())
            conn.sock = tls_sock
        else:
            conn = http.client.HTTPConnection(host, port=port, timeout=TIMEOUT_SECONDS)
            conn.connect = lambda: setattr(conn, "sock", socket.create_connection((address, port), timeout=TIMEOUT_SECONDS))
        conn.request("HEAD", path, headers={"Host": host, "User-Agent": "BitSecure-Network-Diagnostics/1.0", "Connection": "close"})
        response = conn.getresponse()
        status = response.status
        headers = response.headers
    except (OSError, ssl.SSLError, http.client.HTTPException, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail=f"HTTP request failed: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()
    elapsed_ms = round((time.monotonic() - started) * 1000)
    lines = [
        f"HEAD {body.url}",
        f"Resolved addresses: {', '.join(addresses)}",
        f"HTTP status: {status}",
        f"Elapsed: {elapsed_ms} ms",
    ]
    for key in ("server", "content-type", "content-length", "last-modified", "cache-control", "date"):
        if headers.get(key):
            lines.append(f"{key}: {headers.get(key)}")
    return {"output": "\\n".join(lines)[:MAX_OUTPUT], "executed_on": "backend server"}
