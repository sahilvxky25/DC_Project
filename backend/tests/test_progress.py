from sqlalchemy import select

from app.db import SessionLocal
from app.models import User, UserProgress


def signup(client, email="a@example.com"):
    r = client.post("/auth/register", json={"email": email, "password": "correct-horse-1"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


DOC = {"visited": {"dash": 1, "http": 2}, "ach": {"first": 5}, "runs": [{"ts": 1}], "stats": {"quizBest": 3},
       "notes": {"http": "hello"}, "theme": "light", "last": "/m/http"}


def test_requires_login(client):
    assert client.get("/api/progress").status_code == 401
    assert client.put("/api/progress", json={"base_version": 0, "data": DOC}).status_code == 401


def test_empty_then_save_then_load(client):
    h = signup(client)
    assert client.get("/api/progress", headers=h).json() == {"version": 0, "data": None, "updated_at": None}
    r = client.put("/api/progress", headers=h, json={"base_version": 0, "data": DOC})
    assert r.status_code == 200 and r.json()["version"] == 1
    got = client.get("/api/progress", headers=h).json()
    assert got["version"] == 1 and got["data"]["visited"] == DOC["visited"] and got["data"]["theme"] == "light"
    r2 = client.put("/api/progress", headers=h, json={"base_version": 1, "data": {**DOC, "last": "/m/dns"}})
    assert r2.json()["version"] == 2


def test_stale_save_gets_409_with_server_copy(client):
    h = signup(client)
    client.put("/api/progress", headers=h, json={"base_version": 0, "data": DOC})
    other = {**DOC, "visited": {"dash": 1, "tcp": 9}}
    client.put("/api/progress", headers=h, json={"base_version": 1, "data": other})   # "another device" -> v2
    stale = client.put("/api/progress", headers=h, json={"base_version": 1, "data": DOC})
    assert stale.status_code == 409
    detail = stale.json()["detail"]
    assert detail["version"] == 2 and detail["data"]["visited"] == other["visited"]
    assert client.put("/api/progress", headers=h, json={"base_version": 5, "data": DOC}).status_code == 409
    assert client.put("/api/progress", headers=h, json={"base_version": 3, "data": DOC}).status_code == 409


def test_first_save_with_wrong_base_is_conflict(client):
    h = signup(client)
    assert client.put("/api/progress", headers=h, json={"base_version": 4, "data": DOC}).status_code == 409


def test_users_are_isolated(client):
    a, b = signup(client, "a@example.com"), signup(client, "b@example.com")
    client.put("/api/progress", headers=a, json={"base_version": 0, "data": DOC})
    assert client.get("/api/progress", headers=b).json()["data"] is None
    client.put("/api/progress", headers=b, json={"base_version": 0, "data": {**DOC, "last": "/m/b"}})
    assert client.get("/api/progress", headers=a).json()["data"]["last"] == "/m/http"


def test_validation_and_size_limit(client):
    h = signup(client)
    assert client.put("/api/progress", headers=h, json={"base_version": 0, "data": {"theme": "x" * 40}}).status_code == 422
    assert client.put("/api/progress", headers=h, json={"base_version": -1, "data": DOC}).status_code == 422
    big = {**DOC, "notes": {"n": "x" * 300_000}}
    assert client.put("/api/progress", headers=h, json={"base_version": 0, "data": big}).status_code == 413
    ok = client.put("/api/progress", headers=h, json={"base_version": 0, "data": {**DOC, "evil": "dropped"}})
    assert ok.status_code == 200 and "evil" not in ok.json()["data"]


def test_progress_row_is_created(client):
    h = signup(client)
    client.put("/api/progress", headers=h, json={"base_version": 0, "data": DOC})
    with SessionLocal() as db:
        assert db.scalar(select(UserProgress)) is not None
