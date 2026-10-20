from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AIOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")


class ResumeExtractionOutput(AIOutput):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=255)
    linkedin: str = Field(default="", max_length=2048)
    github: str = Field(default="", max_length=2048)
    portfolio: str = Field(default="", max_length=2048)
    summary: str = Field(default="", max_length=5000)
    total_experience_years: float | None = Field(default=None, ge=0, le=80)
    education: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    skills: dict[str, list[str]] | list[str] = Field(default_factory=dict)
    experience: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    projects: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    certifications: list[str | dict[str, Any]] = Field(default_factory=list, max_length=100)


class MatchExplanationOutput(AIOutput):
    key_strengths: list[str] = Field(min_length=1, max_length=8)
    key_concerns: list[str] = Field(max_length=8)
    rationale: str = Field(min_length=1, max_length=3000)

    @field_validator("key_strengths", "key_concerns")
    @classmethod
    def clean_items(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip()[:500] for value in values if value.strip()]
        return cleaned

    @field_validator("key_strengths")
    @classmethod
    def require_strength(cls, values: list[str]) -> list[str]:
        if not values:
            raise ValueError("at least one non-empty strength is required")
        return values

    @field_validator("rationale")
    @classmethod
    def clean_rationale(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("rationale must not be empty")
        return value


class InterviewQuestionOutput(AIOutput):
    model_config = ConfigDict(extra="allow")
    question: str = Field(min_length=1, max_length=2000)
    topic: str = Field(default="", max_length=200)
    expected_answer: str = Field(default="", max_length=3000)
    red_flags: str = Field(default="", max_length=2000)

    @field_validator("question")
    @classmethod
    def clean_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("question must not be empty")
        return value


class InterviewKitOutput(AIOutput):
    technical_questions: list[InterviewQuestionOutput] = Field(min_length=1, max_length=20)
    resume_questions: list[InterviewQuestionOutput] = Field(min_length=1, max_length=20)
    gap_questions: list[InterviewQuestionOutput] = Field(min_length=1, max_length=20)
    behavioral_questions: list[InterviewQuestionOutput] = Field(min_length=1, max_length=20)


class JobExtractionOutput(AIOutput):
    title: str = Field(min_length=1, max_length=255)
    department: str = Field(default="", max_length=255)
    experience_years_min: float | None = Field(default=None, ge=0, le=80)
    experience_required: str = Field(default="", max_length=100)
    required_skills: list[str] = Field(default_factory=list, max_length=100)
    nice_to_have_skills: list[str] = Field(default_factory=list, max_length=100)
    responsibilities: list[str] = Field(default_factory=list, max_length=100)
