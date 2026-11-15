"""Process-local limiter for the first public beta.

For multiple replicas, replace this with a shared store or enforce quotas at
an API gateway/WAF. This is not a distributed rate limiter.
"""
from collections import defaultdict, deque
from time import monotonic
from fastapi import HTTPException, Request

_requests: dict[str, deque[float]] = defaultdict(deque)

def enforce_rate_limit(request: Request, limit: int, window_seconds: int) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = monotonic()
    bucket = _requests[client_ip]
    while bucket and now - bucket[0] >= window_seconds:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Too many questions in a short time. Please wait a moment and try again.",
            headers={"Retry-After": str(window_seconds)},
        )
    bucket.append(now)
    if len(_requests) > 5000:
        stale_before = now - window_seconds
        for key in list(_requests)[:1000]:
            if not _requests[key] or _requests[key][-1] < stale_before:
                _requests.pop(key, None)
