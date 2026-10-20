import json
import re
from dataclasses import dataclass
from typing import Any, Type

from pydantic import BaseModel, ValidationError

from config import Config


@dataclass(frozen=True)
class ProviderResult:
    text: str
    provider_status: str
    fallback_reason: str | None = None
    provider: str | None = None
    model: str | None = None


@dataclass(frozen=True)
class StructuredResult:
    data: dict[str, Any] | None
    provider_status: str
    fallback_reason: str | None = None
    provider: str | None = None
    model: str | None = None


class GroqService:
    _llm = None
    _hf_client = None

    @classmethod
    def _timeout(cls) -> float:
        return max(1.0, min(float(Config.LLM_TIMEOUT_SECONDS), 120.0))

    @classmethod
    def _max_retries(cls) -> int:
        return max(0, min(int(Config.LLM_MAX_RETRIES), 2))

    @classmethod
    def get_llm(cls):
        if cls._llm is None and Config.GROQ_API_KEY:
            try:
                from langchain_groq import ChatGroq
                cls._llm = ChatGroq(
                    groq_api_key=Config.GROQ_API_KEY,
                    model_name=Config.GROQ_MODEL,
                    temperature=0.2,
                    timeout=cls._timeout(),
                    max_retries=cls._max_retries(),
                )
            except Exception:
                print("[GroqService] Provider initialization failed.")
                cls._llm = None
        return cls._llm

    @classmethod
    def get_hf_client(cls):
        if cls._hf_client is None and (Config.HF_TOKEN or "").strip():
            from huggingface_hub import InferenceClient
            cls._hf_client = InferenceClient(
                provider=Config.HF_PROVIDER,
                api_key=Config.HF_TOKEN.strip(),
                timeout=cls._timeout(),
            )
        return cls._hf_client

    @staticmethod
    def _error_status(exc: Exception) -> tuple[str, str]:
        response = getattr(exc, "response", None)
        status = getattr(exc, "status_code", None) or getattr(response, "status_code", None)
        name = type(exc).__name__.lower()
        if status == 429 or "ratelimit" in name or "rate_limit" in str(name):
            return "rate_limited", "provider_rate_limited"
        if "timeout" in name or isinstance(exc, TimeoutError):
            return "unavailable", "provider_timeout"
        return "unavailable", "provider_error"

    @classmethod
    def call_llm_result(cls, prompt: str, system_message: str = "You are an expert HR Recruitment AI.") -> ProviderResult:
        if Config.AI_PROVIDER == "huggingface":
            return cls._call_huggingface_result(prompt, system_message)

        if not (Config.GROQ_API_KEY or "").strip():
            return ProviderResult("", "unavailable", "missing_api_key", "groq", Config.GROQ_MODEL)

        from langchain_core.messages import HumanMessage, SystemMessage
        messages = [SystemMessage(content=system_message), HumanMessage(content=prompt)]
        primary = cls.get_llm()
        primary_reason = "provider_unavailable"
        if primary is not None:
            try:
                response = primary.invoke(messages)
                text = response.content.strip() if isinstance(response.content, str) else ""
                if text:
                    return ProviderResult(text, "available", provider="groq", model=Config.GROQ_MODEL)
                primary_reason = "empty_response"
            except Exception as exc:
                status, primary_reason = cls._error_status(exc)
                print(f"[GroqService] Primary request status: {status}.")
                if status == "rate_limited":
                    return ProviderResult("", status, primary_reason, "groq", Config.GROQ_MODEL)
        else:
            primary_reason = "provider_initialization_failed"

        fallback_model = (Config.GROQ_FALLBACK_MODEL or "").strip()
        if not fallback_model or fallback_model == Config.GROQ_MODEL:
            return ProviderResult("", "unavailable", primary_reason, "groq", Config.GROQ_MODEL)
        try:
            from langchain_groq import ChatGroq
            fallback = ChatGroq(
                groq_api_key=Config.GROQ_API_KEY,
                model_name=fallback_model,
                temperature=0.2,
                timeout=cls._timeout(),
                max_retries=0,
            )
            response = fallback.invoke(messages)
            text = response.content.strip() if isinstance(response.content, str) else ""
            if text:
                return ProviderResult(text, "available", "primary_model_failed", "groq", fallback_model)
            return ProviderResult("", "unavailable", "empty_response", "groq", fallback_model)
        except Exception as exc:
            status, reason = cls._error_status(exc)
            print(f"[GroqService] Fallback request status: {status}.")
            return ProviderResult("", status, reason, "groq", fallback_model)

    @classmethod
    def _call_huggingface_result(cls, prompt: str, system_message: str) -> ProviderResult:
        provider = "huggingface"
        model = Config.HF_MODEL
        if not (Config.HF_TOKEN or "").strip():
            return ProviderResult("", "unavailable", "missing_api_key", provider, model)
        try:
            client = cls.get_hf_client()
            if client is None:
                return ProviderResult("", "unavailable", "provider_initialization_failed", provider, model)
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=2048,
            )
            choices = getattr(completion, "choices", None) or []
            message = getattr(choices[0], "message", None) if choices else None
            text = getattr(message, "content", "") if message else ""
            if not isinstance(text, str) or not text.strip():
                return ProviderResult("", "unavailable", "empty_response", provider, model)
            return ProviderResult(text.strip(), "available", provider=provider, model=model)
        except Exception as exc:
            status, reason = cls._error_status(exc)
            # Avoid logging request bodies, provider error text, tokens, or resume content.
            print(f"[AIProvider] Hugging Face request status: {status}.")
            return ProviderResult("", status, reason, provider, model)

    @classmethod
    def call_llm(cls, prompt: str, system_message: str = "You are an expert HR Recruitment AI.") -> str:
        """Backward-compatible text interface; detailed status is available via call_llm_result."""
        return cls.call_llm_result(prompt, system_message).text

    @classmethod
    def call_structured_result(cls, prompt: str, system_message: str, schema: Type[BaseModel]) -> StructuredResult:
        json_system_message = (
            f"{system_message}\n"
            "Return only one valid JSON object matching the requested schema. Do not include markdown or prose."
        )
        outcome = cls.call_llm_result(prompt, json_system_message)
        if not outcome.text:
            return StructuredResult(None, outcome.provider_status, outcome.fallback_reason, outcome.provider, outcome.model)
        clean = outcome.text.strip()
        clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", clean, flags=re.IGNORECASE).strip()
        try:
            payload = json.loads(clean)
        except (json.JSONDecodeError, TypeError):
            match = re.search(r"\{[\s\S]*\}", clean)
            if not match:
                return StructuredResult(None, "invalid_output", "malformed_json", outcome.provider, outcome.model)
            try:
                payload = json.loads(match.group(0))
            except json.JSONDecodeError:
                return StructuredResult(None, "invalid_output", "malformed_json", outcome.provider, outcome.model)
        if not isinstance(payload, dict):
            return StructuredResult(None, "invalid_output", "invalid_output_shape", outcome.provider, outcome.model)
        try:
            validated = schema.model_validate(payload)
        except ValidationError:
            return StructuredResult(None, "invalid_output", "schema_validation_failed", outcome.provider, outcome.model)
        return StructuredResult(validated.model_dump(mode="json"), outcome.provider_status, outcome.fallback_reason, outcome.provider, outcome.model)

    @classmethod
    def call_structured_json(cls, prompt: str, system_message: str) -> dict[str, Any] | None:
        """Compatibility wrapper for legacy callers; new workflows use typed schemas."""
        class GenericObject(BaseModel):
            model_config = {"extra": "allow"}

        return cls.call_structured_result(prompt, system_message, GenericObject).data
