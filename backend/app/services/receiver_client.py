"""Talk to a BitSecure receiver (receiver/receiver.py): signed handshake, then deliver a message.

Frames: 4-byte big-endian length + JSON. Every reply is authenticated with HMAC-SHA256 over the shared
secret and per-connection nonces, so only a real receiver is ever "found" and nothing is replayable.
"""
import base64
import hashlib
import hmac
import json
import os
import socket
import time
from datetime import datetime, timezone

MAX_FRAME = 4096


def _mac(secret: str, *parts: str) -> str:
    return hmac.new(secret.encode(), "|".join(parts).encode(), hashlib.sha256).hexdigest()


def _send(sock, obj: dict) -> None:
    body = json.dumps(obj, separators=(",", ":")).encode()
    sock.sendall(len(body).to_bytes(4, "big") + body)


def _recv_exact(sock, n: int) -> bytes:
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("closed")
        buf += chunk
    return buf


def _recv(sock) -> dict:
    n = int.from_bytes(_recv_exact(sock, 4), "big")
    if not 0 < n <= MAX_FRAME:
        raise ValueError("bad frame size")
    obj = json.loads(_recv_exact(sock, n))
    if not isinstance(obj, dict):
        raise ValueError("bad frame")
    return obj


def probe_and_deliver(ip: str, text: str | None, secret: str, port: int, timeout: float = 3.0) -> dict:
    """Returns {found, name?, probe_ms?, delivery?}. found=False means 'no BitSecure receiver here'."""
    result: dict = {"found": False}
    try:
        with socket.create_connection((ip, port), timeout=timeout) as s:
            s.settimeout(timeout)
            t0 = time.monotonic()
            nonce_s = base64.b64encode(os.urandom(16)).decode()
            _send(s, {"type": "hello", "nonce_s": nonce_s})
            ack = _recv(s)
            name, nonce_r = str(ack.get("name", ""))[:64], str(ack.get("nonce_r", ""))
            if ack.get("type") != "hello_ack" or not hmac.compare_digest(
                str(ack.get("mac", "")), _mac(secret, "R", nonce_s, nonce_r, name)
            ):
                return result
            result.update(found=True, name=name, probe_ms=round((time.monotonic() - t0) * 1000, 1))
            if text is None:
                return result
            raw = text.encode()
            digest = hashlib.sha256(raw).hexdigest()
            t1 = time.monotonic()
            try:
                _send(s, {"type": "data", "text": text, "sha256": digest, "mac": _mac(secret, "S", nonce_s, nonce_r, digest)})
                rep = _recv(s)
                ok_mac = rep.get("type") == "ack" and hmac.compare_digest(
                    str(rep.get("mac", "")),
                    _mac(secret, "A", nonce_s, nonce_r, digest, str(rep.get("bytes")), str(rep.get("sha256_ok"))),
                )
                echoed = str(rep.get("text", ""))
                matched = ok_mac and rep.get("sha256_ok") is True and hashlib.sha256(echoed.encode()).hexdigest() == digest
                result["delivery"] = {
                    "ok": bool(matched), "bytes": rep.get("bytes") if ok_mac else None, "sha256_ok": bool(matched),
                    "text": echoed[:MAX_FRAME] if ok_mac else "", "ack_ms": round((time.monotonic() - t1) * 1000, 1),
                    "received_at": str(rep.get("received_at", ""))[:40] if ok_mac else None,
                }
            except (OSError, ValueError):
                result["delivery"] = {"ok": False, "bytes": None, "sha256_ok": False, "text": "", "ack_ms": None, "received_at": None}
    except (OSError, ValueError):
        pass
    return result
