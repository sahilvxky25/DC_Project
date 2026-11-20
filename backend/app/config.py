import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_name = "BitSecure Adaptive Quiz and AI API"
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    # Use a currently supported Groq model by default; override through .env.
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    allowed_origins = [
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5500,http://127.0.0.1:5500,"
            "http://localhost:8000,http://127.0.0.1:8000,"
            "https://bitsecure-ten.vercel.app",
        ).split(",")
        if origin.strip()
    ]
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")


@lru_cache
def get_settings():
    return Settings()
