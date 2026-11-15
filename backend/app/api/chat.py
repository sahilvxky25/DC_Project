"""Public chat endpoint."""
import asyncio
from fastapi import APIRouter, HTTPException, Request
from app.ai.gemini import GeminiService
from app.config import get_settings
from app.core.rate_limiter import enforce_rate_limit
from app.knowledge.retriever import KnowledgeRetriever
from app.schemas.chat import ChatRequest, ChatResponse, SourceReference

router = APIRouter()
_settings = get_settings()
_retriever = KnowledgeRetriever(_settings["knowledge_dir"])

@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request):
    enforce_rate_limit(request, _settings["rate_limit_requests"], _settings["rate_limit_window_seconds"])
    if not _settings["gemini_api_key"]:
        raise HTTPException(status_code=503, detail="The BitSecure AI Tutor is not configured yet. Please try again later.")
    documents = _retriever.retrieve(payload.message, limit=4)
    context = "\n\n---\n\n".join(
        f"DOCUMENT: {doc.title}\nCATEGORY: {doc.category}\n{doc.content}" for doc in documents
    )
    history = [turn.model_dump() for turn in payload.history[-8:]]
    try:
        service = GeminiService(_settings["gemini_api_key"], _settings["gemini_model"])
        answer = await asyncio.to_thread(service.answer, payload.message, history, context)
    except Exception as exc:
        print(f"Gemini request failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail="The AI service is temporarily unavailable. Please try again shortly.") from exc
    sources = [SourceReference(title=doc.title, category=doc.category) for doc in documents]
    return ChatResponse(
        answer=answer,
        sources=sources,
        suggestions=[
            "Can you give me a practical example?",
            "Explain this step by step.",
            "Which BitSecure module should I explore next?",
        ],
    )
