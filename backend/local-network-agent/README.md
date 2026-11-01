# Local Network Agent

Optional Python helper for real diagnostics on the computer where it runs. It is separate from the simulated Troubleshooting Lab.

## Start

Requires Python 3.10+ and OS networking utilities. From the repository root:

```bash
python -m venv .venv
python -m pip install -r backend/local-network-agent/requirements.txt
python -m uvicorn main:app --app-dir backend/local-network-agent --host 127.0.0.1 --port 8765
```

Activate the virtual environment before installing/running (PowerShell: `.venv\\Scripts\\Activate.ps1`; macOS/Linux: `source .venv/bin/activate`). Keep the terminal open. Test `http://127.0.0.1:8765/api/health`; stop the agent with Ctrl+C.

## Supported endpoints

- `POST /api/ping`: real OS ping, limited to 1–10 packets.
- `POST /api/traceroute`: Windows `tracert` or macOS/Linux `traceroute`, limited to 20 hops.
- `POST /api/dns`: system DNS resolver lookup.
- `GET /api/interfaces`: local interface configuration.
- `GET /api/routes`: local routing table.

## Safety and limitations

The agent binds only to loopback, validates hostnames/IPs, uses fixed command argument lists without a shell, and caps counts, hops, output and timeouts. It intentionally has no arbitrary command endpoint. CORS is not authentication; keep the agent local-only and stop it when finished. Interface and route output may expose private network information. Firewalls, VPNs, missing utilities and networks may block ping/traceroute. This diagnoses the computer running the agent, not another device. A browser may restrict HTTPS-to-localhost requests or show a local-network permission prompt.