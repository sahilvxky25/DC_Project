# BitSecure Assistant — RAG setup (Python-only)

Phase 2 adds retrieval-augmented generation (RAG) to the authenticated Gemini assistant. The Vercel API is implemented in Python. The browser never receives service-account credentials. The Python API verifies Firebase ID tokens, creates query embeddings, retrieves relevant Firestore chunks, and supplies those excerpts to Gemini. Responses include links to the source Markdown files.

**Runtime policy:** This assistant backend and knowledge-base ingestion workflow use Python only. No Node.js, npm, JavaScript server functions, or JavaScript ingestion scripts are required.

## Architecture

1. Curated Markdown files under `docs/ai-knowledge-base/` are split by heading and into bounded overlapping chunks.
2. The Python ingestion script generates `gemini-embedding-001` document embeddings with 768 dimensions and writes chunk text, source metadata, hashes, and vectors to `assistant_knowledge_chunks`.
3. `POST /api/chat` is served by the Python Vercel function at `api/chat.py`.
4. The API verifies the signed-in, email-verified Firebase ID token using Firebase Admin SDK.
5. The server embeds the latest user question using `RETRIEVAL_QUERY`, runs a Firestore cosine nearest-neighbour search (top 5), and sends retrieved excerpts to Gemini with explicit grounding rules.
6. The API returns source metadata; the existing browser chat UI renders safe links to the corresponding Markdown documents.

## Python dependencies

The repository's `requirements.txt` lists the required Python packages:

- `firebase-admin` — verifies Firebase ID tokens and initializes trusted Firebase access.
- `google-cloud-firestore` — Firestore vector queries and document writes.

Use Python 3.10 or newer. Install dependencies with:

```bash
python -m pip install -r requirements.txt
```

## Vercel environment variables

Configure these for the Preview deployment (and Production when ready):

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Gemini API key. Server-side only; used for chat and embeddings. |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID, currently `bit-7ce8a`. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Full JSON contents of a service account for the same Firebase project. Server-side only. |
| `GEMINI_MODEL` | No | Chat model; defaults to `gemini-2.5-flash`. |
| `GEMINI_EMBEDDING_MODEL` | No | Embedding model; defaults to `gemini-embedding-001`. |

Create a dedicated service account with only the IAM permissions needed to read and query Firestore and write the knowledge collection during ingestion. Do not use a personal key, commit the JSON, put it in browser variables, or paste it into chat. Add the JSON as one Vercel secret environment variable. The service-account project ID must match `FIREBASE_PROJECT_ID`.

The service account is used by the trusted Python Vercel function and Python ingestion script. End users do not receive it. The Gemini API key also remains on the server.

## Create the Firestore vector index

The repository's `firestore.indexes.json` includes a 768-dimensional flat vector index for collection group `assistant_knowledge_chunks`. Create/deploy this index in the same Firestore database used by the service account.

In the Google Cloud Console, open **Firestore → Indexes → Manual → Create Index** and configure:
- Collection ID: `assistant_knowledge_chunks`
- Query scope: `Collection`
- Field: `embedding`
- Field type: **Vector**
- Dimensions: `768`
- Index type: **Flat**

Wait until the index is ready before testing retrieval. Vector search requires a matching index.

## Ingest the knowledge base (Python only)

From the repository root, set the secrets in your shell or load them from a protected, untracked environment file:

```bash
export GEMINI_API_KEY="your-server-side-gemini-key"
export FIREBASE_PROJECT_ID="bit-7ce8a"
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'
python -m pip install -r requirements.txt
python scripts/ingest_knowledge_base.py
```

The JSON shown is illustrative; use the complete service-account JSON locally. Never commit it. The script recursively reads Markdown under `docs/ai-knowledge-base/`, creates deterministic chunk IDs, writes embeddings and source metadata, and removes stale chunks for a source document only after its current chunks have been written.

Re-run ingestion after editing or adding a knowledge-base Markdown document. Embedding calls consume Gemini quota; the script pauses between chunks and retries transient provider errors.

## Verify

1. Confirm the Firestore vector index is ready.
2. Confirm `assistant_knowledge_chunks` contains documents with `text`, `sourcePath`, `title`, `heading`, `embedding`, `embeddingModel`, and `embeddingDimensions: 768`.
3. Deploy the branch to a Vercel Preview with all server-side variables configured. Vercel should detect the Python function at `api/chat.py`.
4. Ask a question grounded in a specific KB document, such as "How does BitSecure model reliable transfer?"
5. Confirm the response includes one or more source links. Test a question outside the curated KB and confirm the assistant does not invent BitSecure implementation details.

## Operational and security notes

- RAG content is evidence, not instructions. Retrieved text is explicitly treated as untrusted.
- The server returns only source title, heading, and repository-relative path; vectors and credentials are never sent to the browser.
- The assistant currently retrieves shared course/platform documentation only. It does not read private user progress or conversation history.
- The in-memory API rate limiter is per serverless instance, not a global quota. Add a shared limiter and abuse monitoring before broad public use.
- Gemini API quota exhaustion still depends on the Google project's allocated limits. Embeddings also consume quota.
- Firestore vector search runs on each chat request.
- If service-account credentials or the vector index are missing, retrieval fails rather than silently falling back to ungrounded platform claims.

## Not included yet

Persistent chat history, multi-device sync, module-aware browser context, personalized learning data, reranking, and automated CI ingestion are later phases.
