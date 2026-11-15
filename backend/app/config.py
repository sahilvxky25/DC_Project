"""Environment-backed configuration for the BitSecure AI API."""
from functools import lru_cache
from pathlib import Path
import os

@lru_cache
def get_settings():
    origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500")
    return {
        "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "allowed_origins": [item.strip() for item in origins.split(",") if item.strip()],
        "knowledge_dir": Path(os.getenv("KNOWLEDGE_DIR", Path(__file__).resolve().parents[2] / "ai-knowledge")),
        "max_message_chars": int(os.getenv("MAX_MESSAGE_CHARS", "2000")),
        "rate_limit_requests": int(os.getenv("RATE_LIMIT_REQUESTS", "15")),
        "rate_limit_window_seconds": int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")),
    }
