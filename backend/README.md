# BitSecure FastAPI backend

This backend adds the authenticated adaptive quiz API and the progress-aware BitSecure AI assistant.

## API endpoints

- `GET /health`
- `GET /`
- `POST /api/quiz/start`
- `POST /api/quiz/submit`
- `GET /api/quiz/profile`
- `POST /api/assistant/chat`

Quiz and assistant routes require a Firebase ID token in the `Authorization: Bearer <token>` header. The assistant answers Data Communications, Computer Networks and BitSecure project questions. For progress questions, it reads the signed-in user's own Firestore progress documents and uses that context to personalize its reply.

## Requirements

- Python 3.10 or newer
- A Groq API key
- Firebase Admin service-account credentials for Firebase token verification and Firestore access

## Windows PowerShell setup

Run from the repository root:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

If PowerShell blocks activation, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

## Linux / macOS setup

Run from the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
nano .env
```

## Environment configuration

Set these values in `backend/.env`:

- `GROQ_API_KEY`: a newly generated Groq API key
- `GROQ_MODEL=openai/gpt-oss-120b`
- `ALLOWED_ORIGINS`: comma-separated, exact frontend origins (include your Vercel production URL and local dev origin)
- `GOOGLE_APPLICATION_CREDENTIALS`: absolute path to the Firebase Admin service-account JSON file

Never commit `.env` or the Firebase service-account file. Use forward slashes in Windows paths.

## Run locally

Terminal 1 — from `backend`, with the virtual environment active:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 4320
```

Check:

- http://127.0.0.1:4320/health
- http://127.0.0.1:4320/docs

Terminal 2 — from the repository root:

```powershell
py -m http.server 5500
```

Open http://localhost:5500 and sign in. Set `window.BITSECURE_API_URL` in `js/config.js` to `http://127.0.0.1:4320` for local testing.

## Firestore data

The API uses these signed-in-user paths:

- Progress: `users/{uid}/progress/overview`
- Adaptive quiz profile: `users/{uid}/adaptiveQuiz/profile`
- Adaptive quiz sessions: `users/{uid}/adaptiveQuizSessions/{sessionId}`

The assistant only reads the authenticated user's own documents. It does not expose API keys, access tokens or service-account contents to the browser or the model.

## Deployment note

The Vercel frontend and FastAPI backend are separate deployments. Deploy this backend to a Python-capable host, set the environment variables there, then set `js/config.js` to the deployed HTTPS API origin and ensure that origin is listed in `ALLOWED_ORIGINS`. Until that backend is deployed and configured, the live-site assistant will show that the AI service is not connected.
