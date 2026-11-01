#!/usr/bin/env python3
"""BitSecure local command agent.

Runs only a small allowlist of networking diagnostics on this computer.
It never invokes a shell and binds exclusively to loopback.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import platform
import re
import shutil
import subprocess
import time
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = int(os.environ.get("BITSECURE_AGENT_PORT", "8765"))
DEFAULT_ORIGINS = {
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
}
extra_origin = os.environ.get("BITSECURE_ALLOWED_ORIGIN", "").strip()
if extra_origin:
    DEFAULT_ORIGINS.add(extra_origin.rstrip("/"))
ALLOWED_ORIGINS = DEFAULT_ORIGINS
HOST_RE = re.compile(r"^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*\.?$")

def target_ok(value):
    return isinstance(value, str) and bool(HOST_RE.fullmatch(value)) and not value.startswith("-")

def command_for(command):
    """Translate a narrow command grammar to an argv list. No shell expansion."""
    if not isinstance(command, str) or len(command) > 300:
        raise ValueError("Enter one supported command (maximum 300 characters).")
    parts = command.strip().split()
    if not parts:
        raise ValueError("Enter a command. Type help for supported commands.")
    name = parts[0].lower()
    if name == "help" and len(parts) == 1:
        return None, [
            "Real commands available: ping <host>, traceroute <host>, nslookup <host>, ip addr, ip route, ipconfig",
            "Only these diagnostic commands are allowed. Arbitrary shell commands are disabled."
        ]
    if name == "clear" and len(parts) == 1:
        return None, []
    if name in ("ping", "traceroute", "tracert", "nslookup"):
        if len(parts) != 2 or not target_ok(parts[1]):
            raise ValueError(f"Usage: {name} <hostname-or-IP>")
        target = parts[1]
        system = platform.system().lower()
        if name == "ping":
            argv = ["ping", "-n", "4", target] if system == "windows" else ["ping", "-c", "4", target]
        elif name in ("traceroute", "tracert"):
            if system == "windows":
                argv = ["tracert", "-d", "-h", "12", "-w", "1000", target]
            elif shutil.which("traceroute"):
                argv = ["traceroute", "-m", "12", "-w", "1", "-n", target]
            elif shutil.which("tracepath"):
                argv = ["tracepath", "-m", "12", target]
            else:
                raise RuntimeError("Neither traceroute nor tracepath is installed on this computer.")
        else:
            if not shutil.which("nslookup"):
                raise RuntimeError("nslookup is not installed on this computer.")
            argv = ["nslookup", target]
        return argv, None
    if name == "ip" and len(parts) == 2 and parts[1].lower() in ("addr", "route"):
        if platform.system().lower() == "windows":
            return ["ipconfig", "/all"] if parts[1].lower() == "addr" else ["route", "print"], None
        if parts[1].lower() == "addr":
            if shutil.which("ip"):
                return ["ip", "addr"], None
            if shutil.which("ifconfig"):
                return ["ifconfig"], None
            raise RuntimeError("Neither ip nor ifconfig is installed.")
        if shutil.which("ip"):
            return ["ip", "route"], None
        raise RuntimeError("The ip command is not installed.")
    if name == "ipconfig" and len(parts) == 1:
        if platform.system().lower() != "windows":
            raise RuntimeError("ipconfig is available on Windows. On macOS/Linux, try ip addr.")
        return ["ipconfig"], None
    raise ValueError("Command not allowed. Type help for the supported commands.")

class Handler(BaseHTTPRequestHandler):
    server_version = "BitSecureLocalAgent/1.0"

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "")
        if origin not in ALLOWED_ORIGINS:
            self.send_json(403, {"error": "This website origin is not allowed. Set BITSECURE_ALLOWED_ORIGIN to the exact site origin."})
            return
        self.send_json(204, {})

    def do_GET(self):
        origin = self.headers.get("Origin", "")
        if origin and origin not in ALLOWED_ORIGINS:
            self.send_json(403, {"error": "Website origin not allowed."})
            return
        if urlparse(self.path).path == "/health":
            self.send_json(200, {"ok": True, "agent": "BitSecure Local Command Agent", "platform": platform.system()})
        else:
            self.send_json(404, {"error": "Not found."})

    def do_POST(self):
        origin = self.headers.get("Origin", "")
        if origin not in ALLOWED_ORIGINS:
            self.send_json(403, {"error": "Website origin not allowed. Configure BITSECURE_ALLOWED_ORIGIN for your exact site origin."})
            return
        if urlparse(self.path).path != "/run":
            self.send_json(404, {"error": "Not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 2048:
                raise ValueError("Request must be between 1 and 2048 bytes.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            argv, immediate = command_for(payload.get("command"))
            if immediate is not None:
                self.send_json(200, {"ok": True, "output": immediate, "durationMs": 0})
                return
            started = time.monotonic()
            # Fixed argv only, no shell, bounded runtime and captured output.
            result = subprocess.run(argv, shell=False, capture_output=True, text=True,
                                    errors="replace", timeout=18)
            output = (result.stdout + (("\n" if result.stdout and result.stderr else "") + result.stderr)).strip()
            lines = output.splitlines()[:120]
            output = "\n".join(lines)
            if len(output) > 16000:
                output = output[:16000] + "\n[output truncated]"
            if not output:
                output = f"Command finished with exit code {result.returncode} and no output."
            self.send_json(200, {"ok": True, "output": output.splitlines(), "exitCode": result.returncode,
                                 "durationMs": round((time.monotonic() - started) * 1000)})
        except subprocess.TimeoutExpired:
            self.send_json(200, {"ok": False, "output": ["Command timed out after 18 seconds."], "error": "timeout"})
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        # Keep normal terminal output concise; requests contain no credentials.
        print("%s - %s" % (self.address_string(), fmt % args))

if __name__ == "__main__":
    print(f"BitSecure Local Command Agent listening only on http://{HOST}:{PORT}")
    print("Keep this terminal open while using Real diagnostics. Press Ctrl+C to stop.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
