# BitSecure Local Command Agent

This optional helper lets the existing Troubleshooting Lab run a small allowlist of **real operating-system network commands** on your own computer. The website remains static; no cloud server executes commands.

## Requirements

- Python 3.9 or newer
- Windows: built-in `ping`, `tracert`, `nslookup`, `ipconfig`
- macOS/Linux: `ping`, `nslookup`, and either `traceroute` or `tracepath`; `ip` or `ifconfig` for interface details

## Start it

From the repository root:

```bash
python agent/local_agent.py
```

Keep the terminal window open. It listens only on `127.0.0.1:8765`; it is not exposed to your LAN.

By default, local web origins `http://localhost:8000`, `http://127.0.0.1:8000`, `http://localhost:5500`, and `http://127.0.0.1:5500` are allowed. For a deployed HTTPS site, set the **exact origin** before starting the agent. For example in PowerShell:

```powershell
$env:BITSECURE_ALLOWED_ORIGIN = "https://your-site.example"
python agent/local_agent.py
```

macOS/Linux:

```bash
BITSECURE_ALLOWED_ORIGIN="https://your-site.example" python3 agent/local_agent.py
```

Replace the example with the actual origin shown in your browser address bar (scheme + hostname + optional port; no path). Use only the site you trust.

## Commands

- `ping example.com`
- `traceroute example.com` (Windows automatically uses `tracert`)
- `nslookup example.com`
- `ip addr`
- `ip route`
- `ipconfig` (Windows only)
- `help`, `clear`

The agent uses a strict command allowlist, validates hostnames, never uses a shell, limits execution time/output, and rejects browser origins not explicitly allowed. It does **not** accept arbitrary terminal commands. Some operating systems may require extra privileges for traceroute; do not run the agent as administrator/root merely to bypass this.

## Browser note

Modern browsers may apply local-network/private-network access restrictions when an HTTPS site contacts localhost. The agent has explicit CORS origin checks, but browser policy or OS firewall settings may still block the request. If so, use the app from a local HTTP server or check the browser console; the UI should continue to make clear that the real agent is disconnected rather than substituting simulated results.
