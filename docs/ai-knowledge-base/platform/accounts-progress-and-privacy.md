# BitSecure Accounts, Progress, and Privacy

## Authentication

The project uses Firebase Authentication for email/password account flows. The documented flows include sign-up, sign-in, email verification, password reset, password change, and sign-out. The application shell is shown after successful authentication; the chatbot launcher is intended to be available only inside that authenticated shell.

## Progress storage

The README documents account-specific progress in Cloud Firestore at:

`users/{uid}/progress/overview`

The application also maintains a local account-specific cache to support temporary cloud-access issues. The legacy global `dcl.v2` localStorage key is not automatically assigned to an account because it has no Firebase UID; the account-specific cache uses `dcl.v2.user.{uid}`.

The README also documents additional learning data such as achievements, run history, quiz statistics, notes, theme, and last visited screen. Exact fields and write semantics should be confirmed in the current implementation before an assistant gives step-by-step data-schema advice.

## Security boundaries

- Firebase Web app configuration is browser-visible client configuration; it is not a service-account secret.
- Never put Firebase Admin SDK credentials, service-account private keys, xAI API keys, or other server secrets in browser code or source control.
- Firebase Security Rules must enforce authenticated per-user access.
- Client-side validation and hiding UI controls are not security boundaries.
- Client-written scores can be forged unless a trusted backend validates attempts and awards.
- The repository README warns that the league prototype's client-side XP writes are not tamper-resistant and should not be used for valuable rewards or trusted rankings without server-side validation.

## Privacy guidance for the assistant

The assistant should only access the signed-in user's own authorized data through a trusted backend. Do not retrieve or reveal another user's profile, progress, quiz results, or conversation history. Do not put passwords, authentication tokens, private keys, or personal user records into the shared knowledge base.

## Chatbot state

The authenticated BitSecure Assistant is served by the Vercel `/api/chat` Edge Function. It validates Firebase ID tokens through Firebase Identity Toolkit, forwards bounded recent conversation turns to the xAI Responses API, and keeps the xAI API key server-side. The current phase does not implement RAG retrieval, persistent chat history, or access to account-specific learning data.
