# BitSecure Assistant — Phase 1 setup

Phase 1 replaces the visual-only launcher with an authenticated Gemini chat. RAG, persistent conversation history, and account-specific learning data are not included yet.

## Configure Vercel

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Required | Value |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Your Gemini API key. Server-side only. |
| `FIREBASE_PROJECT_ID` | Yes | `bit-7ce8a` for the current Firebase project. |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash`; override with an available Gemini model ID. |

Apply variables to Preview and Production as needed, then redeploy. Do not add the Gemini key to HTML, browser JavaScript, or any `NEXT_PUBLIC_`/`VITE_` variable.

## Request and authentication flow

1. The signed-in browser client obtains a Firebase ID token using `getIdToken()`.
2. It sends recent conversation turns to `POST /api/chat` with an Authorization Bearer header.
3. The Vercel function verifies the JWT signature using Google's published Firebase signing certificates, then validates the project audience, issuer, expiry, UID, and verified-email claim.
4. The server sends the bounded conversation to Gemini and returns the generated answer.

The Firebase web configuration remains in the browser as required by Firebase client SDKs. The Gemini key stays on the server.

## Current safeguards and limits

- POST-only endpoint; signed-in and email-verified Firebase accounts only.
- Validates message roles, limits each message to 4,000 characters, and accepts at most 10 turns.
- Basic per-user rate limit: 12 requests per minute per serverless instance.
- Model output is inserted as text, not HTML.
- No conversation is persisted; a new chat clears the current browser session transcript.
- The in-memory rate limiter is per instance, not a global quota. Use a shared rate-limit store before scaling public traffic.
- Consider Firebase App Check, abuse monitoring, usage budgets, and a shared rate limiter before broad public launch.

## Local testing

Run the repository using a Vercel-compatible local environment so that `/api/chat` is served as a function. Set the same variables in an untracked local environment file. Never commit secrets.

## Not included in Phase 1

Knowledge-base retrieval and citations, Firestore conversation history, multi-device history sync, module-aware page context, and personalized progress access remain for later phases.
