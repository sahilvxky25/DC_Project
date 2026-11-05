#!/usr/bin/env python3
"""BitSecure receiver: accepts a message from the BitSecure server and sends back an acknowledgement.

Standard library only; runs on Ubuntu and Windows.
  python receiver.py --secret <32+ chars> [--port 9009] [--name my-node]
The secret must equal RECEIVER_SECRET in the backend. Environment variable BITSECURE_RECEIVER_SECRET also works.
"""
import argparse
import asyncio
import base64
import hashlib
import hmac
import json
import os
import socket
import sys
from datetime import datetime, timezone

MAX_FRAME, MAX_TEXT, IDLE_S, MAX_CONN = 4096, 1024, 5, 20


def mac(secret: str, *parts: str) -> str:
    return hmac.new(secret.encode(), "|".join(parts).encode(), hashlib.sha256).hexdigest()


def frame(obj: dict) -> bytes:
    body = json.dumps(obj, separators=(",", ":")).encode()
    return len(body).to_bytes(4, "big") + body


async def read_frame(reader) -> dict:
    n = int.from_bytes(await asyncio.wait_for(reader.readexactly(4), IDLE_S), "big")
    if not 0 < n <= MAX_FRAME:
        raise ValueError("bad frame size")
    obj = json.loads(await asyncio.wait_for(reader.readexactly(n), IDLE_S))
    if not isinstance(obj, dict):
        raise ValueError("bad frame")
    return obj


def _log(path, line: str) -> None:
    if not path:
        return
    try:
        if os.path.exists(path) and os.path.getsize(path) > 1_000_000:
            os.replace(path, path + ".1")
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


async def start(host: str, port: int, name: str, secret: str, log_path: str | None = None):
    """Start the server and return it (used by main() and by the tests)."""
    active = {"n": 0}

    async def handle(reader, writer):
        peer = (writer.get_extra_info("peername") or ("?",))[0]
        if active["n"] >= MAX_CONN:
            writer.close()
            return
        active["n"] += 1
        try:
            hello = await read_frame(reader)
            nonce_s = str(hello.get("nonce_s", ""))
            if hello.get("type") != "hello" or not 0 < len(nonce_s) <= 64:
                return
            nonce_r = base64.b64encode(os.urandom(16)).decode()
            writer.write(frame({"type": "hello_ack", "name": name, "nonce_r": nonce_r,
                                "mac": mac(secret, "R", nonce_s, nonce_r, name)}))
            await writer.drain()
            data = await read_frame(reader)          # a probe-only client closes here: ends quietly
            text, digest = data.get("text"), str(data.get("sha256", ""))
            if data.get("type") != "data" or not isinstance(text, str):
                return
            raw = text.encode()
            if len(raw) > MAX_TEXT or not hmac.compare_digest(
                str(data.get("mac", "")), mac(secret, "S", nonce_s, nonce_r, digest)
            ):
                return
            ok = hashlib.sha256(raw).hexdigest() == digest
            now = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
            line = f"[{now}] from {peer}: {text!r} ({len(raw)} bytes, checksum {'ok' if ok else 'MISMATCH'})"
            print(line, flush=True)
            _log(log_path, line)
            writer.write(frame({"type": "ack", "bytes": len(raw), "sha256_ok": ok, "text": text, "received_at": now,
                                "mac": mac(secret, "A", nonce_s, nonce_r, digest, str(len(raw)), str(ok))}))
            await writer.drain()
        except (asyncio.TimeoutError, asyncio.IncompleteReadError, ConnectionError, ValueError, OSError):
            pass                                      # bad or idle client: drop silently
        finally:
            active["n"] -= 1
            writer.close()

    return await asyncio.start_server(handle, host, port)


async def main() -> None:
    ap = argparse.ArgumentParser(description="BitSecure receiver")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=9009)
    ap.add_argument("--name", default=socket.gethostname())
    ap.add_argument("--secret", default=os.environ.get("BITSECURE_RECEIVER_SECRET", ""))
    ap.add_argument("--log", default="received.log")
    a = ap.parse_args()
    if len(a.secret) < 32:
        sys.exit("Refusing to start: --secret (or BITSECURE_RECEIVER_SECRET) must be at least 32 characters.")
    server = await start(a.host, a.port, a.name, a.secret, a.log)
    print(f"BitSecure receiver '{a.name}' listening on {a.host}:{a.port}  (Ctrl+C to stop)", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
