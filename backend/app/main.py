"""BitSecure public AI Tutor API."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.config import get_settings

settings = get_settings()
app = FastAPI(
    title="BitSecure AI Tutor API",
    description="Public educational assistant for BitSecure networking topics and website guidance.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings["allowed_origins"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(health_router)
app.include_router(chat_router, prefix="/api")
