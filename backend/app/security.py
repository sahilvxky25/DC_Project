"""Password hashing, JWT tokens and a small login rate limiter."""
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from .config import settings

_ph = PasswordHasher()  # argon2id with library defaults
_DUMMY_HASH = _ph.hash("timing-equaliser-not-a-real-password")


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def burn_verify_time(password: str) -> None:
    """Spend the same time as a real check so unknown emails are not detectable by timing."""
    verify_password(_DUMMY_HASH, password)


def create_access_token(user_id: str, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> str | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"]).get("sub")
    except jwt.PyJWTError:
        return None


class LoginLimiter:
    """Blocks a key (ip + email) after too many failures in a time window.
    In-memory: fine for one server process. Use Redis if you run several."""

    def __init__(self, max_failures: int = 5, window_seconds: int = 900):
        self.max_failures = max_failures
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    def _prune(self, key: str) -> deque:
        q = self._hits[key]
        cutoff = time.monotonic() - self.window
        while q and q[0] < cutoff:
            q.popleft()
        return q

    def blocked(self, key: str) -> bool:
        return len(self._prune(key)) >= self.max_failures

    def record_failure(self, key: str) -> None:
        self._prune(key).append(time.monotonic())

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)

    def clear(self) -> None:
        self._hits.clear()
