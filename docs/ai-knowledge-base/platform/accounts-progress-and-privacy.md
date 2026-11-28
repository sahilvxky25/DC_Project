# BitSecure Accounts, Progress, and Privacy

## Authentication

The learning application is available in guest mode without an account. Guest progress is stored locally in the browser under the legacy `dcl.v2` key. Verified Firebase Authentication accounts unlock the AI Assistant and weekly leagues, and enable account-specific Cloud Firestore synchronization. On sign-in, guest progress is merged with the existing account progress; it is not used to replace the account snapshot. Sign-out returns to guest mode and keeps account data isolated in its UID-specific cache. The documented account flows include email/password sign-up and sign-in, Google sign-in when configured, email verification, password reset, password change, and sign-out.

## Progress storage

The README documents account-specific progress in Cloud Firestore at:

`users/{uid}/progress/overview`

The application also maintains a local account-specific cache to support temporary cloud-access issues. The legacy global `dcl.v2` localStorage key is not automatically assigned to an account because it has no Firebase UID; the account-specific cache uses `dcl.v2.user.{uid}`.

The README also documents additional learning data such as achievements, run history, quiz statistics, notes, theme, and last visited screen. Exact fields and write semantics should be confirmed in the current implementation before an assistant gives step-by-step data-schema advice.

## Security boundaries

- Firebase Web app configuration is browser-visible client configuration; it is not a service-account secret.
- Never put Firebase Admin SDK credentials, service-account private keys, Gemini API keys, or other server secrets in browser code or source control.
- Firebase Security Rules must enforce authenticated per-user access.
- Client-side validation and hiding UI controls are not security boundaries.
- Client-written scores can be forged unless a trusted backend validates attempts and awards.
- The repository README warns that the league prototype's client-side XP writes are not tamper-resistant and should not be used for valuable rewards or trusted rankings without server-side validation.

## Privacy guidance for the future assistant

The assistant should only access the signed-in user's own authorized data through a trusted backend. Do not retrieve or reveal another user's profile, progress, quiz results, or conversation history. Do not put passwords, authentication tokens, private keys, or personal user records into the shared knowledge base.

## Chatbot state

The repository currently includes a chatbot launcher UI, but this knowledge base does not itself implement an AI service. A future RAG backend should verify Firebase ID tokens server-side, apply App Check and abuse controls where configured, keep model/embedding credentials in server-side secrets, and scope any conversation history to the authenticated UID.
