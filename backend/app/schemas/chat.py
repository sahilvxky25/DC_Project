"""Validated request and response models for chat."""
from typing import Literal
import os
from pydantic import BaseModel, Field, field_validator

MAX_MESSAGE_CHARS = max(100, min(int(os.getenv("MAX_MESSAGE_CHARS", "2000")), 10000))

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Please enter a question.")
        return value

class SourceReference(BaseModel):
    title: str
    category: str

class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceReference] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
