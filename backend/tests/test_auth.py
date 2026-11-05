from sqlalchemy import select

from app.db import SessionLocal
from app.models import User

CREDS = {"email": "Student@Example.com", "password": "correct-horse-1"}


def register(client, **over):
    return client.post("/auth/register", json={**CREDS, **over})


def test_register_returns_token_and_user(client):
    r = register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["access_token"] and body["user"]["email"] == "student@example.com"


def test_password_is_stored_hashed(client):
    register(client)
    with SessionLocal() as db:
        u = db.scalar(select(User))
    assert u.password_hash != CREDS["password"]
    assert u.password_hash.startswith("$argon2id$")


def test_duplicate_email_case_insensitive(client):
    assert register(client).status_code == 201
    assert register(client, email="STUDENT@example.com").status_code == 409


def test_short_password_and_bad_email_rejected(client):
    assert register(client, password="short").status_code == 422
    assert register(client, email="not-an-email").status_code == 422


def test_login_ok_and_me(client):
    register(client)
    r = client.post("/auth/login", json=CREDS)
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == "student@example.com"


def test_wrong_password_and_unknown_email_look_identical(client):
    register(client)
    a = client.post("/auth/login", json={**CREDS, "password": "wrong-password"})
    b = client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever123"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_me_requires_valid_token(client):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_lockout_after_repeated_failures(client):
    register(client)
    bad = {**CREDS, "password": "wrong-password"}
    for _ in range(5):
        assert client.post("/auth/login", json=bad).status_code == 401
    assert client.post("/auth/login", json=bad).status_code == 429
    assert client.post("/auth/login", json=CREDS).status_code == 429  # even the right password waits


def test_remember_me_gives_longer_token(client):
    short = register(client).json()["expires_in"]
    long_ = client.post("/auth/login", json={**CREDS, "remember": True}).json()["expires_in"]
    assert long_ > short
