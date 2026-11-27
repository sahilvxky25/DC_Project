#!/usr/bin/env python3
"""Ingest docs/ai-knowledge-base Markdown into Firestore vector search.

Run with Python 3.10+: python scripts/ingest_knowledge_base.py
Required environment: GEMINI_API_KEY and FIREBASE_SERVICE_ACCOUNT_JSON.
"""
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from firebase_admin import credentials, firestore, initialize_app, get_app
from google.cloud.firestore_v1.vector import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "docs" / "ai-knowledge-base"
COLLECTION = "assistant_knowledge_chunks"
MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
DIMENSIONS = 768


def service_account():
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise RuntimeError("Set FIREBASE_SERVICE_ACCOUNT_JSON to the full service-account JSON.")
    account = json.loads(raw)
    if not all(account.get(key) for key in ("project_id", "client_email", "private_key")):
        raise RuntimeError("Service-account JSON is missing project_id, client_email, or private_key.")
    expected = os.environ.get("FIREBASE_PROJECT_ID")
    if expected and expected != account["project_id"]:
        raise RuntimeError("FIREBASE_PROJECT_ID does not match the service-account project.")
    return account


def firestore_client(account):
    try:
        app = get_app()
    except ValueError:
        app = initialize_app(credentials.Certificate(account), {"projectId": account["project_id"]})
    return firestore.client(app=app)


def embed(text, api_key):
    url = "https://generativelanguage.googleapis.com/v1beta/models/%s:embedContent?key=%s" % (MODEL, api_key)
    body = json.dumps({
        "model": "models/" + MODEL, "content": {"parts": [{"text": text}]},
        "taskType": "RETRIEVAL_DOCUMENT", "outputDimensionality": DIMENSIONS,
    }).encode("utf-8")
    for attempt in range(4):
        request = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=35) as response:
                result = json.loads(response.read().decode("utf-8"))
            vector = result.get("embedding", {}).get("values")
            if not isinstance(vector, list) or len(vector) != DIMENSIONS:
                raise RuntimeError("Gemini returned an invalid embedding vector.")
            return vector
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            if error.code not in (429, 500, 502, 503) or attempt == 3:
                raise RuntimeError("Gemini embedding failed (HTTP %s): %s" % (error.code, detail[:500]))
            time.sleep(2 ** attempt)
        except URLError as error:
            if attempt == 3:
                raise RuntimeError("Gemini embedding network error: %s" % error)
            time.sleep(2 ** attempt)


def split_sections(markdown):
    sections, heading, buffer = [], "Introduction", []
    def flush():
        text = "\n".join(buffer).strip()
        if text:
            sections.append((heading, text))
        buffer.clear()
    for line in markdown.replace("\r", "").splitlines():
        match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if match:
            flush()
            heading = match.group(2).strip()
        else:
            buffer.append(line)
    flush()
    return sections


def split_chunks(text, max_chars=1700, overlap=220):
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks, current = [], ""
    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            start = 0
            while start < len(paragraph):
                end = min(start + max_chars, len(paragraph))
                chunks.append(paragraph[start:end])
                if end == len(paragraph):
                    break
                start = end - overlap
        elif current and len(current) + len(paragraph) + 2 > max_chars:
            chunks.append(current)
            current = current[-overlap:] + "\n\n" + paragraph
        else:
            current = current + "\n\n" + paragraph if current else paragraph
    if current.strip():
        chunks.append(current.strip())
    return chunks


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Set GEMINI_API_KEY before ingestion.")
    account = service_account()
    db = firestore_client(account)
    files = sorted(SOURCE_DIR.rglob("*.md"))
    if not files:
        raise RuntimeError("No Markdown files found in docs/ai-knowledge-base.")
    total = 0
    for file_path in files:
        markdown = file_path.read_text(encoding="utf-8")
        relative = file_path.relative_to(ROOT).as_posix()
        title_match = re.search(r"^#\s+(.+)$", markdown, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else file_path.stem
        segments = relative.split("/")
        domain = segments[2] if len(segments) > 3 else "platform"
        active_ids = set()
        for heading, section in split_sections(markdown):
            chunks = split_chunks(section)
            for index, chunk in enumerate(chunks):
                identifier = hashlib.sha256("\n".join((relative, heading, str(index), chunk)).encode("utf-8")).hexdigest()
                vector = embed(chunk, api_key)
                db.collection(COLLECTION).document(identifier).set({
                    "text": chunk, "title": title, "heading": heading, "sourcePath": relative,
                    "domain": domain, "topic": file_path.stem, "chunkIndex": index,
                    "embedding": Vector(vector), "embeddingModel": MODEL, "embeddingDimensions": DIMENSIONS,
                    "contentHash": hashlib.sha256(markdown.encode("utf-8")).hexdigest(),
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                })
                active_ids.add(identifier)
                total += 1
                print("Indexed %s — %s (chunk %s/%s)" % (relative, heading, index + 1, len(chunks)))
                time.sleep(0.25)
        stale_query = db.collection(COLLECTION).where("sourcePath", "==", relative).stream()
        stale = [doc.reference for doc in stale_query if doc.id not in active_ids]
        for offset in range(0, len(stale), 400):
            batch = db.batch()
            for reference in stale[offset:offset + 400]:
                batch.delete(reference)
            batch.commit()
    print("Completed: indexed %s chunks from %s Markdown files." % (total, len(files)))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Knowledge-base ingestion failed: %s" % error, file=sys.stderr)
        sys.exit(1)
