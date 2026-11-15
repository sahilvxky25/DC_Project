# BitSecure AI Tutor — implementation notes

## Scope of this branch

This branch adds the first working integration layer for a public AI Tutor:

- A standalone visitor-accessible chat widget, independent of Firebase login.
- A Python FastAPI backend with a Gemini adapter.
- Curated Markdown knowledge for core networking concepts and documented BitSecure features.
- Keyword retrieval that supplies relevant documents to Gemini.
- Request validation, bounded conversation context, CORS configuration, and a starter process-local rate limiter.
- Docker packaging for Azure Container Apps.
- Local setup, Azure deployment template, and initial unit tests.

## Current limitations

This is the initial implementation milestone, not a deployed production service.
The Azure resource has not been created, Gemini credentials have not been supplied,
and the API URL meta tag in `index.html` intentionally remains empty until
deployment. The widget therefore explains that configuration is pending instead
of silently failing.

The current knowledge retriever is keyword-based. Semantic embeddings/vector
retrieval is the next RAG enhancement. Firebase token verification and Firestore
conversation persistence are also intentionally deferred; public visitor chat
does not require a Firebase account.

## Next milestones

1. Run backend tests and local API smoke tests with a Gemini key.
2. Create Azure Container Registry and Container Apps resources in the user's subscription.
3. Add Gemini key as an Azure secret and deploy the container.
4. Set the deployed API origin in the frontend meta tag and configure CORS.
5. Add Firebase ID-token verification for optional signed-in features and Firestore history with strict per-user access controls.
6. Replace process-local rate limiting with a shared limiter or edge gateway policy before scaling beyond one replica.
7. Upgrade keyword retrieval to embeddings and vector search, with retrieval evaluation and source-grounded answer checks.
8. Add streaming, feedback persistence, monitoring, and cost controls after the basic integration is verified.
