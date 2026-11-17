from pydantic import BaseModel, Field, field_validator

class SubmitQuizRequest(BaseModel):
    sessionId: str = Field(pattern=r"^[0-9a-f-]{36}$")
    answers: list[int] = Field(min_length=8, max_length=8)

    @field_validator("answers")
    @classmethod
    def valid_answers(cls, values):
        if any(type(v) is not int or v < -1 or v > 3 for v in values):
            raise ValueError("Answers must be option indexes 0-3, or -1 to skip.")
        return values
