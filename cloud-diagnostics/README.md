# BitSecure Cloud Diagnostics API

Runs a strict allowlist of real network diagnostics **from the cloud server**, never on the visitor's device.

## Deploy

Create a Python web service on a provider that permits outbound ICMP/traceroute. Set the service root to `cloud-diagnostics`.

- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`

Hosting providers may block ICMP/traceroute even when the commands are installed.

## Required environment variables

- `FIREBASE_PROJECT_ID`: `bit-7ce8a`
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase Admin service-account JSON stored as a **private service secret**. Never commit it or put it in browser code.
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins, e.g. `https://your-project.vercel.app,https://your-domain.example`. No wildcard.

The frontend sends the signed-in user's Firebase ID token as a Bearer token. The backend verifies it before execution and fails closed when server credentials are absent.

## API

`POST /api/diagnostics/run`

```json
{"command":"ping","target":"example.com"}
```

Commands: `ping`, `traceroute`, `nslookup`. Hostnames are validated; ping/traceroute targets must resolve to public IPv4 addresses. Execution uses argument arrays with `shell=False`, a timeout, output cap, and per-user in-memory rate limit.

## Limits

Results originate from the cloud server's network. They do not describe the visitor's Wi-Fi, device routes, or local network. Some providers block ping/traceroute. The in-memory rate limiter is a baseline; use provider-level protections for production scale.
