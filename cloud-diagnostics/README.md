# BitSecure Cloud Diagnostics API

This service executes a narrow allowlist of real network diagnostics **from the cloud server**. It never executes commands on a visitor's device and does not provide a general-purpose shell.

## Deploy as a separate service

Create a Python web service on a provider that permits outbound ICMP/traceroute and install the packages from this directory.

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`

The repository includes a Render blueprint at `render.yaml`. Create the service from that blueprint or configure the same commands manually. Hosting provider/network policy may block ping or traceroute even when the utilities are installed.

## Required environment variables

- `FIREBASE_PROJECT_ID`: `bit-7ce8a` for the current project.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: a Firebase Admin service-account JSON object stored as a **private service secret**, never committed to Git or placed in frontend code. Create a service account with the minimum necessary permissions; token verification itself does not require broad data access.
- `ALLOWED_ORIGINS`: comma-separated exact deployed frontend origins, e.g. `https://your-project.vercel.app,https://your-custom-domain.example`. Do not use `*`.

The frontend obtains a Firebase ID token from the signed-in user and sends it as a Bearer token. The backend verifies the token before running a command. If Firebase Admin credentials are not configured, diagnostic requests fail closed.

## Supported requests

`POST /api/diagnostics/run`

```json
{"command":"ping","target":"example.com"}
```

Allowed command names: `ping`, `traceroute`, `nslookup`.

The service validates fully qualified hostnames, blocks local/internal suffixes and non-public destinations for ping/traceroute, uses argument arrays with `shell=False`, applies a timeout and output cap, and limits requests per authenticated UID. `ping` and `traceroute` use a validated public IPv4 address to reduce DNS-rebinding risk. `nslookup` performs a DNS lookup for the validated hostname.

## Limitations and security

- Output is from the cloud server's network, not the visitor's machine.
- Ping/traceroute may be unsupported by the hosting provider or network.
- Rate limits are in-memory and reset on service restart; use provider-level limits/WAF for production scale.
- Run only on a provider you control, keep dependencies updated, and do not add arbitrary shell commands, user-supplied flags, or unrestricted URL fetching.
