"""Service boundary around the existing LangGraph business workflows."""

import json

from app.graphs.interview_graph import build_interview_graph
from app.graphs.matching_graph import build_matching_graph
from app.graphs.screening_graph import build_screening_graph
from app.models.candidate import Candidate
from app.models.interview import InterviewKit
from app.models.job import JobDescription
from app.models.match import MatchResult
from app.models.candidate import ResumeDraft
from config import Config


_screening_graph = None
_matching_graph = None
_interview_graph = None


def _graph(kind: str):
    global _screening_graph, _matching_graph, _interview_graph
    if kind == "screening":
        _screening_graph = _screening_graph or build_screening_graph()
        return _screening_graph
    if kind == "matching":
        _matching_graph = _matching_graph or build_matching_graph()
        return _matching_graph
    _interview_graph = _interview_graph or build_interview_graph()
    return _interview_graph


def _structured_resume(candidate: Candidate) -> dict | None:
    draft = ResumeDraft.query.filter_by(candidate_id=candidate.id).order_by(ResumeDraft.updated_at.desc()).first()
    return draft.resume_data if draft and isinstance(draft.resume_data, dict) else None


def _resume_skills(candidate: Candidate, structured: dict | None) -> list[str]:
    if structured is not None:
        skills = structured.get("skills", [])
        return [item for item in skills if isinstance(item, str)] if isinstance(skills, list) else []
    resume = candidate.resume
    if resume and isinstance(resume.skills, dict):
        return [skill for group in resume.skills.values() if isinstance(group, list) for skill in group]
    if resume and isinstance(resume.skills, list):
        return resume.skills
    return []


def _resume_text(candidate: Candidate, structured: dict | None) -> str:
    if structured is None:
        resume = candidate.resume
        # Legacy uploads may contain contact details and unrelated personal
        # information. Match only extracted job-related fields.
        if not resume:
            return ""
        facts = {
            "education": resume.education or [],
            "experience": resume.experience or [],
            "projects": resume.projects or [],
            "skills": resume.skills or [],
            "certifications": resume.certifications or [],
        }
        return json.dumps(facts, ensure_ascii=False)
    # Matching receives only relevant editor facts directly; no generated PDF is
    # parsed, and contact details, photo data, and rendering choices are omitted.
    personal = structured.get("personal", {}) if isinstance(structured.get("personal"), dict) else {}
    facts = {
        "education": structured.get("education", []),
        "experience": structured.get("experience", []),
        "projects": structured.get("projects", []),
        "skills": structured.get("skills", []),
        "certifications": structured.get("certifications", []),
    }
    return json.dumps(facts, ensure_ascii=False)


def screen_resume(file_path: str, filename: str, file_type: str, owner_user_id: int | None = None) -> dict:
    result = _graph("screening").invoke({
        "file_path": file_path,
        "filename": filename,
        "file_type": file_type,
        "raw_text": "",
        "extracted_data": {},
        "candidate_id": None,
        "indexed_in_chroma": False,
        "error": None,
        "ai_mode": "fallback",
        "owner_user_id": owner_user_id,
    })
    return result


def match_candidates(job: JobDescription, candidates: list[Candidate]) -> tuple[list[dict], str, dict]:
    results = []
    modes = []
    graph = _graph("matching")
    for candidate in candidates:
        structured = _structured_resume(candidate)
        skills = _resume_skills(candidate, structured)
        state = graph.invoke({
            "job_id": job.id,
            "candidate_id": candidate.id,
            "job_title": job.title,
            "job_text": f"{job.title}\n{job.raw_description}",
            "candidate_name": candidate.name,
            "candidate_text": _resume_text(candidate, structured),
            "required_skills": job.required_skills or [],
            "candidate_skills": skills,
            "job_experience_min": job.experience_years_min or 0.0,
            "candidate_experience": candidate.total_experience_years or 0.0,
            "candidate_experience_known": candidate.total_experience_years is not None,
            "semantic_score": 0.0,
            "skills_score": 0.0,
            "experience_score": 0.0,
            "overall_score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
            "key_strengths": [],
            "key_concerns": [],
            "recommendation": "Review",
            "rationale": "",
            "error": None,
            "ai_mode": "fallback",
        })
        modes.append(state.get("ai_mode", "fallback"))
        row = MatchResult.query.filter_by(job_id=job.id, candidate_id=candidate.id).first()
        if row:
            item = row.to_dict()
            item["ai_mode"] = state.get("ai_mode", "fallback")
            results.append(item)
    results.sort(key=lambda item: item["overall_score"], reverse=True)
    mode = "provider" if modes and all(value == "provider" for value in modes) else "fallback"
    metadata = {
        "provider_status": "available" if mode == "provider" else "unavailable_or_invalid",
        "provider": Config.AI_PROVIDER,
        "model": Config.HF_MODEL if Config.AI_PROVIDER == "huggingface" else Config.GROQ_MODEL,
        "fallback_reasons": sorted({item.get("score_metadata", {}).get("fallback_reason") for item in results if item.get("score_metadata", {}).get("fallback_reason")}),
        "semantic_methods": sorted({item.get("score_metadata", {}).get("semantic_method", "unknown") for item in results}),
        "score_formula": "weighted_mean_v1",
    }
    return results, mode, metadata


def generate_interview_kit(job: JobDescription, candidate: Candidate) -> tuple[dict, str, dict]:
    prior_match = MatchResult.query.filter_by(job_id=job.id, candidate_id=candidate.id).first()
    resume = candidate.resume
    structured = _structured_resume(candidate)
    skills = _resume_skills(candidate, structured)
    content = structured or {}
    personal = content.get("personal", {}) if isinstance(content.get("personal"), dict) else {}
    state = _graph("interview").invoke({
        "job_id": job.id,
        "candidate_id": candidate.id,
        "job_title": job.title,
        "job_description": job.raw_description,
        "candidate_name": candidate.name,
        "candidate_summary": personal.get("summary") or candidate.summary or "",
        "candidate_skills": skills,
        "candidate_projects": content.get("projects", []) if structured is not None else (resume.projects if resume and resume.projects else []),
        "candidate_experience": content.get("experience", []) if structured is not None else (resume.experience if resume and resume.experience else []),
        "missing_skills": prior_match.missing_skills if prior_match else [],
        "technical_questions": [],
        "resume_questions": [],
        "gap_questions": [],
        "behavioral_questions": [],
        "rubrics": {},
        "error": None,
        "ai_mode": "fallback",
    })
    if state.get("error"):
        raise RuntimeError("Interview workflow failed")
    kit = InterviewKit.query.filter_by(job_id=job.id, candidate_id=candidate.id).first()
    ai_mode = state.get("ai_mode", "fallback")
    metadata = {"provider_status": state.get("provider_status", "unavailable"), "fallback_reason": state.get("fallback_reason"), "provider": state.get("provider"), "model": state.get("model")}
    return (kit.to_dict() if kit else state), ai_mode, metadata
