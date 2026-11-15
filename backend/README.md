# BitSecure AI Tutor API

Public Python API for the BitSecure networking and website assistant.

## Local setup

Requires Python 3.11+ and a Gemini API key.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="your-key"
export ALLOWED_ORIGINS="http://localhost:8000,http://127.0.0.1:5500"
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/health` for health status and
`http://localhost:8000/docs` for the interactive API schema.

From the repository root, tests can be run with:

```bash
pip install -r backend/requirements-dev.txt
PYTHONPATH=backend pytest backend/tests
```

## API

- `GET /health`: liveness check.
- `POST /api/chat`: accepts `{"message":"Explain TCP","history":[]}`.
- Request history is short, client-provided context only; this starter does not persist conversations.

The browser widget reads the API base URL from
`<meta name="bitsecure-ai-api" content="https://YOUR-API-HOST">` in
the root `index.html`. Leave it blank until the API is deployed; the widget
will explain that setup is incomplete.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Secret Gemini credential | Required for chat |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.5-flash` |
| `ALLOWED_ORIGINS` | Comma-separated exact browser origins | Local development origins |
| `MAX_MESSAGE_CHARS` | Documented message limit | 2000 |
| `RATE_LIMIT_REQUESTS` | Per-process requests per window | 15 |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate-limit window | 60 |
| `PORT` | Container listening port | 8000 |

## Azure Container Apps deployment

Create an Azure Container Registry and a Container Apps environment in your
subscription first. The resource group and region must be the ones you intend
to use. These commands are a deployment template; resource names are examples.

1. Install Azure CLI and the Container Apps extension, then sign in:

```bash
az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

2. Create a registry (if you do not already have one), then build from the
repository root so the Dockerfile can copy both `backend/` and `ai-knowledge/`:

```bash
az acr create --resource-group YOUR_RESOURCE_GROUP --name YOUR_UNIQUE_ACR_NAME --sku Basic
az acr build --registry YOUR_UNIQUE_ACR_NAME --image bitsecure-ai:latest --file backend/Dockerfile .
```

3. Create the Container Apps environment if it does not already exist:

```bash
az containerapp env create --name YOUR_CONTAINER_ENV --resource-group YOUR_RESOURCE_GROUP --location YOUR_AZURE_REGION
```

4. Create the app with external HTTPS ingress and scale-to-zero:

```bash
az containerapp create \
  --name YOUR_CONTAINER_APP \
  --resource-group YOUR_RESOURCE_GROUP \
  --environment YOUR_CONTAINER_ENV \
  --image YOUR_UNIQUE_ACR_NAME.azurecr.io/bitsecure-ai:latest \
  --registry-server YOUR_UNIQUE_ACR_NAME.azurecr.io \
  --target-port 8000 --ingress external \
  --min-replicas 0 --max-replicas 2 \
  --secrets gemini-api-key="YOUR_GEMINI_API_KEY" \
  --env-vars GEMINI_API_KEY=secretref:gemini-api-key GEMINI_MODEL=gemini-2.5-flash ALLOWED_ORIGINS="https://YOUR_BITSECURE_DOMAIN"
```

For production, prefer a managed identity with AcrPull rather than registry
admin credentials. Set secrets through Azure secret management, not source
control or a committed workflow file. Avoid pasting keys into shell history.

5. Get the API FQDN and test it:

```bash
az containerapp show --name YOUR_CONTAINER_APP --resource-group YOUR_RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv
curl https://YOUR_API_FQDN/health
```

6. Copy the resulting HTTPS origin into the `bitsecure-ai-api` meta tag in
the root `index.html` (without a trailing slash), and ensure the exact
BitSecure website origin is in `ALLOWED_ORIGINS`. Redeploy the website.

## Important beta limitations and production hardening

- The current limiter is process-local. It is suitable only as a starter
  safeguard for a single replica; it is not a distributed quota system.
  Before public promotion, use a shared limiter or Azure API Management /
  Front Door WAF rate limiting and set a maximum replica count.
- The first request after scale-to-zero can be slow. Set minimum replicas to
  one if always-warm response is worth the additional cost.
- This starter does not yet verify Firebase ID tokens or save Firestore chat
  history. Visitors can chat without signing in. Add verified optional identity
  and per-user history as a separate security-reviewed phase.
- Do not use the in-memory chat history for sensitive data. Do not send
  passwords, tokens, or private learner records to Gemini.
- The browser Firebase web configuration is not a server credential. The
  Gemini key must remain in Azure secrets.
- Review the selected Gemini model's current quotas, data-use terms, and
  regional availability before launch. Add spending alerts/quotas.
- Retrieved knowledge documents are bundled into the image. Rebuild and
  redeploy the container when knowledge files change.
