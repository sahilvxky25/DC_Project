import pytest
from pydantic import ValidationError
from app.schemas.chat import ChatRequest


def test_chat_request_trims_message():
    request = ChatRequest(message="  Explain DNS  ")
    assert request.message == "Explain DNS"


def test_chat_request_rejects_blank_message():
    with pytest.raises(ValidationError):
        ChatRequest(message="   ")


def test_chat_request_rejects_oversized_message():
    with pytest.raises(ValidationError):
        ChatRequest(message="x" * 2001)
