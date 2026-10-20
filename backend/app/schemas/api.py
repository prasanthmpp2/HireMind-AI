from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ResumePersonal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(default="", max_length=255)
    email: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=100)
    address: str = Field(default="", max_length=1000)
    linkedin: str = Field(default="", max_length=2048)
    github: str = Field(default="", max_length=2048)
    photo: str = Field(default="", max_length=5_000_000)
    summary: str = Field(default="", max_length=20_000)

    @field_validator("name", "email", "phone", "address", "linkedin", "github", "photo", "summary", mode="before")
    @classmethod
    def trim_contact(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if value and ("@" not in value or value.startswith("@") or value.endswith("@")):
            raise ValueError("must be a valid email address")
        return value

    @field_validator("linkedin", "github")
    @classmethod
    def validate_link(cls, value: str) -> str:
        if value:
            parsed = urlparse(value)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc or any(char.isspace() for char in value):
                raise ValueError("must be an absolute http(s) URL")
        return value


class ResumeEducation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    degree: str = Field(default="", max_length=500)
    institution: str = Field(default="", max_length=500)
    year: str = Field(default="", max_length=100)
    score: str = Field(default="", max_length=100)


class ResumeExperience(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company: str = Field(default="", max_length=500)
    role: str = Field(default="", max_length=500)
    duration: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=20_000)


class ResumeProject(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(default="", max_length=500)
    link: str = Field(default="", max_length=2048)
    description: str = Field(default="", max_length=20_000)
    tech: str = Field(default="", max_length=2000)

    @field_validator("link")
    @classmethod
    def validate_project_link(cls, value: str) -> str:
        if value:
            parsed = urlparse(value)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc or any(char.isspace() for char in value):
                raise ValueError("must be an absolute http(s) URL")
        return value


class ResumeCertification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(default="", max_length=500)
    issuer: str = Field(default="", max_length=500)
    year: str = Field(default="", max_length=100)


class ResumeContent(BaseModel):
    """Schema v1 mirrors the existing React editor keys, preserving its sections."""
    model_config = ConfigDict(extra="forbid")
    personal: ResumePersonal = Field(default_factory=ResumePersonal)
    education: list[ResumeEducation] = Field(default_factory=list, max_length=100)
    experience: list[ResumeExperience] = Field(default_factory=list, max_length=100)
    projects: list[ResumeProject] = Field(default_factory=list, max_length=100)
    skills: list[str] = Field(default_factory=list, max_length=500)
    certifications: list[ResumeCertification] = Field(default_factory=list, max_length=100)

    @field_validator("skills")
    @classmethod
    def validate_skills(cls, values: list[str]) -> list[str]:
        if any(not isinstance(item, str) or len(item) > 500 for item in values):
            raise ValueError("skills must be strings up to 500 characters")
        return [item.strip() for item in values]


class ResumeDesign(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template: str = Field(default="classic", pattern=r"^[A-Za-z0-9_-]{1,50}$")
    font: str = Field(default="inter", pattern=r"^[A-Za-z0-9_-]{1,50}$")
    font_size: str = Field(default="default", pattern=r"^[A-Za-z0-9_-]{1,50}$")
    section_order: list[str] = Field(default_factory=lambda: ["summary", "education", "experience", "projects", "skills", "certifications"], max_length=20)

    @field_validator("template")
    @classmethod
    def validate_template(cls, value: str) -> str:
        allowed = {"classic", "modern", "minimal", "slate", "emerald", "indigo", "amber", "rose", "graphite", "serif", "executive", "aurora", "cobalt", "mono", "clean", "bold", "airy", "contrast", "skyline", "horizon", "ink", "sand", "ocean", "forest"}
        if value not in allowed:
            raise ValueError("unsupported template")
        return value

    @field_validator("font")
    @classmethod
    def validate_font(cls, value: str) -> str:
        allowed = {"inter", "poppins", "lato", "manrope", "montserrat", "nunito", "merriweather", "playfair", "robotoSlab", "sourceSerif", "spaceGrotesk"}
        if value not in allowed:
            raise ValueError("unsupported font")
        return value

    @field_validator("font_size")
    @classmethod
    def validate_font_size(cls, value: str) -> str:
        if value not in {"xsmall", "small", "default", "large", "xlarge"}:
            raise ValueError("unsupported font size")
        return value

    @field_validator("section_order")
    @classmethod
    def validate_section_order(cls, value: list[str]) -> list[str]:
        allowed = {"summary", "education", "experience", "projects", "skills", "certifications"}
        if len(value) != len(set(value)) or any(item not in allowed for item in value):
            raise ValueError("section_order contains an unsupported or repeated section")
        return value


class ResumeDraftInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = Field(default=1, ge=1, le=1)
    name: str = Field(default="Resume", min_length=1, max_length=255)
    resume: ResumeContent
    design: ResumeDesign = Field(default_factory=ResumeDesign)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class CandidateProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    personal: ResumePersonal


class JobInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    raw_description: str = Field(min_length=1, max_length=50000)
    department: str = Field(default="Engineering", max_length=100)
    experience_required: str = Field(default="", max_length=100)
    experience_years_min: float = Field(default=0.0, ge=0, le=80)
    required_skills: list[str] = Field(default_factory=list, max_length=100)
    nice_to_have_skills: list[str] = Field(default_factory=list, max_length=100)
    responsibilities: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("title", "raw_description", "department", "experience_required", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("required_skills", "nice_to_have_skills", "responsibilities")
    @classmethod
    def validate_text_list(cls, values: list[str]) -> list[str]:
        if any(not isinstance(item, str) or not item.strip() or len(item) > 200 for item in values):
            raise ValueError("items must be non-empty strings up to 200 characters")
        return [item.strip() for item in values]


class MatchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: int = Field(gt=0)
    candidate_ids: list[int] | None = Field(default=None, max_length=500)


class InterviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: int = Field(gt=0)


class AiGenerateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=1, max_length=12000)
    system_prompt: str = Field(default="You are a helpful resume-writing assistant.", max_length=2000)

    @field_validator("prompt", "system_prompt", mode="before")
    @classmethod
    def strip_prompt(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any | None = None


class JobResponse(BaseModel):
    id: int
    title: str
    department: str | None = None
    experience_required: str | None = None
    experience_years_min: float | None = None
    required_skills: list[str]
    nice_to_have_skills: list[str]
    responsibilities: list[str]
    raw_description: str
    created_at: datetime | None = None
    match_count: int = 0


class ResumeResponse(BaseModel):
    id: int
    candidate_id: int
    filename: str
    file_type: str
    education: list[Any] = Field(default_factory=list)
    skills: dict[str, Any] | list[Any] = Field(default_factory=dict)
    experience: list[Any] = Field(default_factory=list)
    projects: list[Any] = Field(default_factory=list)
    certifications: list[Any] = Field(default_factory=list)
    created_at: datetime | None = None


class CandidateResponse(BaseModel):
    id: int
    name: str
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    github: str | None = None
    portfolio: str | None = None
    summary: str | None = None
    total_experience_years: float | None = None
    created_at: datetime | None = None
    resume: ResumeResponse | None = None
    editor_resume: "ResumeDraftResponse | None" = None


class ResumeDraftResponse(BaseModel):
    id: int
    candidate_id: int
    name: str
    schema_version: int
    resume: ResumeContent
    design: ResumeDesign
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MatchResponse(BaseModel):
    id: int
    job_id: int
    candidate_id: int
    candidate_name: str
    candidate_email: str
    candidate_experience: float | None
    job_title: str
    overall_score: float
    skills_score: float | None
    experience_score: float | None
    semantic_score: float | None
    recommendation: str
    matched_skills: list[str]
    missing_skills: list[str]
    key_strengths: list[str]
    key_concerns: list[str]
    rationale: str
    score_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class InterviewKitResponse(BaseModel):
    id: int
    job_id: int
    candidate_id: int
    candidate_name: str
    job_title: str
    technical_questions: list[dict[str, Any]] = Field(default_factory=list)
    resume_questions: list[dict[str, Any]] = Field(default_factory=list)
    gap_questions: list[dict[str, Any]] = Field(default_factory=list)
    behavioral_questions: list[dict[str, Any]] = Field(default_factory=list)
    rubrics: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


CandidateResponse.model_rebuild()
