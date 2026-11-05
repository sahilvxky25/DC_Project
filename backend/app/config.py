"""Settings loaded from environment variables / .env."""
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = Field(min_length=32)
    access_token_minutes: int = 720          # 12 hours
    remember_token_minutes: int = 43200      # 30 days ("Remember me")
    cors_origins: str = "http://localhost:8000,http://127.0.0.1:8000"

    # ---- Live route feature ----
    allow_private_targets: bool = False   # development only: never enable in production
    receiver_port: int = 9009
    receiver_secret: str | None = None    # shared with receiver.py; unset = receiver detection off
    max_hops: int = 20
    trace_timeout_s: int = 60
    runs_per_hour: int = 10
    max_concurrent_traces: int = 3
    max_message_bytes: int = 1024
    server_label: str = "BitSecure server"

    @field_validator("receiver_secret")
    @classmethod
    def _check_secret(cls, v):
        if not v:
            return None
        if len(v) < 32:
            raise ValueError("RECEIVER_SECRET must be at least 32 characters")
        return v

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
