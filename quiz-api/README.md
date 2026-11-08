# Gemini Adaptive Quiz API

A separate JavaScript Azure Functions API for BitSecure's adaptive networking quiz. It does not replace or modify the existing Python backend.

## Runtime

This project uses Azure Functions Node.js programming model v4 with plain JavaScript. Azure Functions executes JavaScript on the Node.js runtime; no Express or other web framework is used.

## Local setup

1. Install Node.js 22+ and Azure Functions Core Tools v4.
2. Run `npm install` in this directory.
3. Configure the settings below in `local.settings.json` (do not commit that file).
4. Run `npm start`.

Required settings:

- `GEMINI_API_KEY`: key created in Google AI Studio.
- `QUIZ_SIGNING_SECRET`: random secret of at least 32 characters.
- `FIREBASE_PROJECT_ID`: `bit-7ce8a` for the current BitSecure Firebase project.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: full Firebase service-account JSON (recommended in Azure App Settings). It may be omitted locally only when Google Application Default Credentials are configured.
- `ALLOWED_ORIGIN`: exact deployed frontend origin, for example `https://your-site.vercel.app`.
- `GEMINI_MODEL`: optional; defaults to `gemini-flash-latest` (matching the model alias in the supplied REST example).

Example local settings (replace all placeholders):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY",
    "QUIZ_SIGNING_SECRET": "GENERATE_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARACTERS",
    "FIREBASE_PROJECT_ID": "bit-7ce8a",
    "FIREBASE_SERVICE_ACCOUNT_JSON": "PASTE_SERVICE_ACCOUNT_JSON_HERE",
    "ALLOWED_ORIGIN": "http://localhost:5500",
    "GEMINI_MODEL": "gemini-flash-latest"
  }
}
```

## Routes

- `GET /api/quiz/health`
- `POST /api/quiz/generate` — requires Firebase ID token; returns one question and a signed answer token.
- `POST /api/quiz/answer` — requires Firebase ID token; validates the answer server-side and returns feedback.

The answer key is never sent with the question. The API verifies Firebase ID tokens and binds signed answer tokens to the requesting UID.

## Azure deployment

Create a separate Azure Function App using the Node.js runtime (Linux, Functions v4). Deploy the contents of this folder as the function app root. Add the required settings under **Function App → Settings → Environment variables**. Configure the Function App CORS allowlist with the exact frontend origin as well. Do not put the Gemini key or signing secret in frontend code or source control.

Set the frontend's `<meta name="bitsecure-quiz-api">` content to the Function App URL ending in `/api`.

The default model is `gemini-flash-latest`, matching the model alias in the REST example. Free-tier availability and quotas depend on model, region, account and Google's current policy; verify them before public launch. Add usage monitoring and a budget/limit before making this public.
