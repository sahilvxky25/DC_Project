import asyncio
import json
import threading

import pytest

from app.config import settings
from app.routers.route import get_line_source
from app.services.receiver_client import probe_and_deliver
from app.services.route_tools import TargetError, parse_line, parse_target
from receiver import receiver as rcv

SECRET = "s" * 40


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    from app.main import app
    yield
    app.dependency_overrides.clear()


def signup(client, email="r@example.com"):
    r = client.post("/auth/register", json={"email": email, "password": "correct-horse-1"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def fake_trace(*texts):
    from app.main import app
    async def src(ip, max_hops, timeout_s):
        for t in texts:
            yield t.replace("TARGET", ip)
    app.dependency_overrides[get_line_source] = lambda: src


def events(resp):
    return [json.loads(x) for x in resp.text.splitlines() if x]


def start_receiver(secret=SECRET):
    ready, box = threading.Event(), {}
    def go():
        loop = asyncio.new_event_loop()
        async def main():
            srv = await rcv.start("127.0.0.1", 0, "test-node", secret)
            box["port"] = srv.sockets[0].getsockname()[1]
            ready.set()
            await srv.serve_forever()
        loop.run_until_complete(main())
    threading.Thread(target=go, daemon=True).start()
    assert ready.wait(5)
    return box["port"]


# ---- validation + parsing ----
@pytest.mark.parametrize("bad", ["10.0.0.1", "127.0.0.1", "192.168.1.5", "172.16.0.9", "169.254.169.254",
                                 "100.64.0.1", "224.0.0.1", "0.0.0.0", "example.com", "::1", "8.8.8", "8.8.8.8; ls", ""])
def test_rejects_bad_targets(bad):
    with pytest.raises(TargetError):
        parse_target(bad)


def test_accepts_public_and_dev_flag():
    assert parse_target(" 8.8.8.8 ") == "8.8.8.8"
    assert parse_target("127.0.0.1", allow_private=True) == "127.0.0.1"
    with pytest.raises(TargetError):
        parse_target("224.0.0.1", allow_private=True)


def test_parser_linux_and_windows():
    assert parse_line(" 1  10.0.0.1  0.412 ms") == {"hop": 1, "ip": "10.0.0.1", "rtt_ms": 0.412, "timeout": False}
    assert parse_line(" 2  *")["timeout"] is True
    assert parse_line("  1    <1 ms    <1 ms     1 ms  192.168.1.1")["ip"] == "192.168.1.1"
    assert parse_line("  2     *        *        *     Request timed out.")["timeout"] is True
    assert parse_line("  3    10 ms    11 ms     9 ms  8.8.8.8")["rtt_ms"] == 9.0
    for header in ["traceroute to 8.8.8.8 (8.8.8.8), 20 hops max", "Tracing route to 8.8.8.8 over a maximum of 20 hops", "Trace complete.", ""]:
        assert parse_line(header) is None


# ---- endpoints ----
def test_requires_login(client):
    assert client.get("/api/route/config").status_code == 401
    assert client.post("/api/route/run", json={"target": "8.8.8.8"}).status_code == 401


def test_invalid_inputs(client):
    h = signup(client)
    assert client.post("/api/route/run", headers=h, json={"target": "10.0.0.1"}).status_code == 422
    assert client.post("/api/route/run", headers=h, json={"target": "8.8.8.8", "message": "x" * 2000}).status_code == 422


def test_route_only_stream(client):
    h = signup(client)
    fake_trace("traceroute to TARGET", " 1  10.0.0.1  0.5 ms", " 2  *", " 3  TARGET  12.0 ms")
    ev = events(client.post("/api/route/run", headers=h, json={"target": "8.8.8.8", "message": "hi"}))
    assert [e["type"] for e in ev] == ["start", "hop", "hop", "hop", "done"]
    assert ev[1]["private"] is True and ev[2]["timeout"] is True and ev[3]["ip"] == "8.8.8.8"
    assert ev[-1]["status"] == "route_only" and "no data was delivered" in ev[-1]["message"]


def test_unreachable(client):
    h = signup(client)
    fake_trace(" 1  10.0.0.1  0.5 ms", " 2  *")
    assert events(client.post("/api/route/run", headers=h, json={"target": "8.8.8.8"}))[-1]["status"] == "unreachable"


def test_delivery_to_real_receiver(client, monkeypatch):
    h = signup(client)
    port = start_receiver()
    monkeypatch.setattr(settings, "receiver_secret", SECRET)
    monkeypatch.setattr(settings, "receiver_port", port)
    monkeypatch.setattr(settings, "allow_private_targets", True)
    fake_trace(" 1  TARGET  0.1 ms")
    ev = events(client.post("/api/route/run", headers=h, json={"target": "127.0.0.1", "message": "héllo 世界"}))
    kinds = [e["type"] for e in ev]
    assert kinds == ["start", "hop", "receiver", "delivery", "done"]
    assert ev[2]["found"] and ev[2]["name"] == "test-node"
    assert ev[3]["ok"] and ev[3]["sha256_ok"] and ev[3]["text"] == "héllo 世界" and ev[3]["bytes"] == len("héllo 世界".encode())
    assert ev[-1]["status"] == "delivered"


def test_wrong_secret_is_not_a_receiver():
    port = start_receiver()
    assert probe_and_deliver("127.0.0.1", "hi", "x" * 40, port)["found"] is False
    assert probe_and_deliver("127.0.0.1", None, SECRET, port)["found"] is True
    assert probe_and_deliver("127.0.0.1", "hi", SECRET, 1)["found"] is False   # nothing listening


def test_hourly_limit(client, monkeypatch):
    h = signup(client)
    monkeypatch.setattr(settings, "runs_per_hour", 2)
    fake_trace(" 1  TARGET  1 ms")
    for _ in range(2):
        assert client.post("/api/route/run", headers=h, json={"target": "8.8.8.8"}).status_code == 200
    assert client.post("/api/route/run", headers=h, json={"target": "8.8.8.8"}).status_code == 429
    assert client.get("/api/route/config", headers=h).json()["runs_left"] == 0
