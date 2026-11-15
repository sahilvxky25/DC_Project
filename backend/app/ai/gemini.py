"""Gemini generation adapter."""
from google import genai
from google.genai import types
from app.ai.prompts import SYSTEM_INSTRUCTIONS

class GeminiService:
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise RuntimeError("The chatbot AI service is not configured yet.")
        self.client = genai.Client(api_key=api_key)
        self.model = model

    def answer(self, message: str, history: list[dict], context: str) -> str:
        parts = [
            SYSTEM_INSTRUCTIONS,
            "\n\nKNOWLEDGE CONTEXT (retrieved BitSecure documents):\n",
            context or "No matching BitSecure document was retrieved.",
            "\n\nRECENT CONVERSATION:\n",
        ]
        for turn in history[-8:]:
            label = "Learner" if turn["role"] == "user" else "Tutor"
            parts.append(f"{label}: {turn['content'][:2000]}\n")
        parts.append(f"\nLearner's current question: {message}\nTutor:")
        response = self.client.models.generate_content(
            model=self.model,
            contents="".join(parts),
            config=types.GenerateContentConfig(temperature=0.35, max_output_tokens=900),
        )
        answer = (response.text or "").strip()
        if not answer:
            raise RuntimeError("The AI service returned an empty response.")
        return answer
