# BitSecure Assistant — Phase 1 setup

Phase 1 provides an authenticated Grok chat through the Vercel `/api/chat` Edge Function. RAG, persistent conversation history, and account-specific learning data are not included yet.

## Configure Vercel

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Required | Value |
| --- | --- | --- |
| `XAI_API_KEY` | Yes | Your xAI API key from the xAI Console. Server-side only. |
| `FIREBASE_WEB_API_KEY` | Yes | The Firebase project's existing Web API key from `js/auth/firebase-client.js`. This is the Firebase client configuration key, not a service-account secret. |
| `XAI_MODEL` | No | Defaults to `grok-4.7`; set this to another model ID available to your xAI account if needed. |

Apply variables to Preview and Production as needed, then redeploy. Never put `XAI_API_KEY` in HTML, browser JavaScript, source control, or any `NEXT_PUBLIC_`/`VITE_` variable.

## Request and authentication flow

1. The signed-in browser client obtains a Firebase ID token using `getIdToken()`.
2. It sends recent conversation turns to `POST /api/chat` with an Authorization Bearer header.
3. The Vercel Edge Function sends the token to Firebase Identity Toolkit's `accounts:lookup` endpoint. Firebase validates the token; the function accepts only a returned user with a verified email.
4. The Edge Function sends the bounded conversation to the xAI Responses API at `https://api.x.ai/v1/responses` and returns the generated answer in the existing `{ "reply": "..." }` response shape.

The Firebase Web API key is already browser-visible Firebase client configuration. The xAI API key stays on the server. The request uses `store: false` for the xAI response.

## Runtime and safeguards

- Uses the Vercel Edge Runtime and Web Fetch APIs; no Node.js APIs, Node packages, or Python are used by this endpoint.
- POST-only endpoint; signed-in and email-verified Firebase accounts only.
- Validates message roles, limits each message to 4,000 characters, and accepts at most 10 turns.
- Basic per-user rate limit: 12 requests per minute per Edge Function instance. This is **not** a global limit; use a shared rate-limit store before scaling public traffic.
- Upstream request timeout is 30 seconds. Provider errors are logged without exposing API keys or raw provider details to the browser.
- Model output is returned as JSON and should continue to be rendered as text, not HTML.
- No conversation is persisted; a new chat clears the current browser session transcript.
- Consider Firebase App Check, abuse monitoring, usage budgets, and a shared rate limiter before broad public launch.

## Local testing

Use a Vercel-compatible environment that supports Edge Functions. Set the same variables in an untracked local environment file. Never commit secrets.

## Not included in Phase 1

Knowledge-base retrieval and citations, Firestore conversation history, multi-device history sync, module-aware page context, and personalized progress access remain for later phases.
