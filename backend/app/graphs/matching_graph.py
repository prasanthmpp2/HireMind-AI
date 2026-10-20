import json
from typing import Dict, Any, List
from langgraph.graph import StateGraph, END

from app.graphs.state import MatchingState
from app.services.vector_service import VectorService
from app.services.groq_client import GroqService
from app.schemas.ai import MatchExplanationOutput
from app.models import db
from app.models.match import MatchResult
from app.models.match import MatchEvaluation

def vector_similarity_node(state: MatchingState) -> Dict[str, Any]:
    """
    Step 1: Compute dense semantic similarity between candidate resume text and Job Description.
    """
    try:
        vector_svc = VectorService()
        similarity = vector_svc.compute_similarity(
            resume_text=state["candidate_text"],
            job_text=state["job_text"]
        )
        return {
            "semantic_score": similarity["score"],
            "semantic_method": similarity["method"],
            "embedding_status": similarity["provider_status"],
            "fallback_reason": similarity["fallback_reason"],
        }
    except Exception:
        return {
            "semantic_score": VectorService._text_overlap(state["candidate_text"], state["job_text"]),
            "semantic_method": "lexical_overlap_fallback",
            "embedding_status": "unavailable",
            "fallback_reason": "embedding_service_failed",
        }


def skill_matching_node(state: MatchingState) -> Dict[str, Any]:
    """
    Step 2: Compare candidate skills against JD required skills using exact and fuzzy matching.
    """
    req_skills = [s.strip() for s in state.get("required_skills", []) if s.strip()]
    cand_skills = [s.strip() for s in state.get("candidate_skills", []) if s.strip()]
    cand_text_lower = state["candidate_text"].lower()

    if not req_skills:
        return {
            "matched_skills": [],
            "missing_skills": [],
            "skills_score": 0.0,
            "skills_assessed": False,
        }

    matched = []
    missing = []

    cand_skills_lower = {s.lower(): s for s in cand_skills}

    for skill in req_skills:
        s_lower = skill.lower()
        # Direct match in extracted skills
        if s_lower in cand_skills_lower:
            matched.append(cand_skills_lower[s_lower])
        # Substring or in-text match
        elif any(s_lower in c or c in s_lower for c in cand_skills_lower):
            matched.append(skill)
        elif s_lower in cand_text_lower:
            matched.append(skill)
        else:
            missing.append(skill)

    match_ratio = len(matched) / len(req_skills) if req_skills else 1.0
    skills_score = round(match_ratio * 100.0, 1)

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "skills_score": skills_score,
        "skills_assessed": True,
    }


def experience_scoring_node(state: MatchingState) -> Dict[str, Any]:
    """
    Step 3: Evaluate candidate experience against minimum required years.
    """
    req_exp = float(state.get("job_experience_min", 0.0) or 0.0)
    cand_exp = float(state.get("candidate_experience", 0.0) or 0.0)

    assessed = req_exp > 0.0 and state.get("candidate_experience_known", True)
    if not assessed:
        score = 0.0
    elif cand_exp >= req_exp:
        # Full points plus slight bonus for seasoned experience up to 100
        score = min(100.0, 85.0 + ((cand_exp - req_exp) * 3.0))
    else:
        # Scaled proportionally
        ratio = cand_exp / req_exp
        score = max(30.0, ratio * 85.0)

    return {"experience_score": round(score, 1), "experience_assessed": assessed}


def explainable_recommendation_node(state: MatchingState) -> Dict[str, Any]:
    """
    Step 4: Synthesize overall composite score, recommendation tier, and explainable AI rationale via Groq.
    """
    skills_score = state["skills_score"]
    semantic_score = state["semantic_score"]
    experience_score = state["experience_score"]

    # Fixed weights are renormalized over components supported by the job data.
    base_weights = {"skills": 0.45, "semantic": 0.35, "experience": 0.20}
    active = {"semantic": semantic_score}
    if state.get("skills_assessed", True):
        active["skills"] = skills_score
    if state.get("experience_assessed", True):
        active["experience"] = experience_score
    denominator = sum(base_weights[key] for key in active)
    weights = {key: round(base_weights[key] / denominator, 6) for key in active}
    overall = round(max(0.0, min(100.0, sum(active[key] * weights[key] for key in active))), 1)

    # Determine recommendation tier
    if overall >= 85.0:
        recommendation = "Strongly Recommended"
    elif overall >= 70.0:
        recommendation = "Recommended"
    elif overall >= 50.0:
        recommendation = "Review"
    else:
        recommendation = "Not Recommended"

    matched = state.get("matched_skills", [])
    missing = state.get("missing_skills", [])

    # Use Groq LLM to generate professional recruiter explanation
    system_prompt = (
        "You are an objective, explainable HR Assessment AI. "
        "Analyze job-related evidence only. Do not use or infer protected traits, personal identity, age, gender, race, religion, disability, family status, or other sensitive characteristics. Do not invent experience, skills, achievements, or evidence. Explain only the supplied score components and exact matched/missing skills. The recruiter makes all final decisions."
    )
    user_prompt = f"""
Job Title: {state.get('job_title', 'Role')}
Required Skills: {', '.join(state.get('required_skills', []))}
Job Experience Min: {state.get('job_experience_min', 0)} years

Candidate Experience: {state.get('candidate_experience', 0) if state.get('experience_assessed', True) else 'Not provided'} years
Matched Skills: {', '.join(matched) if matched else 'None'}
Missing Critical Skills: {', '.join(missing) if missing else 'None'}
Composite Score: {overall}% ({recommendation})

Generate a JSON object with:
{{
  "key_strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "key_concerns": ["Concern 1", "Concern 2"],
  "rationale": "2-3 sentences summarizing the hiring recommendation for the recruiter."
}}
"""

    ai_result = GroqService.call_structured_result(user_prompt, system_prompt, MatchExplanationOutput)
    ai_analysis = ai_result.data
    if ai_analysis:
        ai_mode = "provider"
        strengths = ai_analysis.get("key_strengths", [])
        concerns = ai_analysis.get("key_concerns", [])
        rationale = ai_analysis.get("rationale", "")
    else:
        ai_mode = "fallback"
        # Deterministic fallback
        strengths = [f"Required skills evidenced: {', '.join(matched[:3])}"] if matched else []
        if state.get("experience_assessed"):
            strengths.append(f"Recorded experience: {state.get('candidate_experience', 0)} years against a {state.get('job_experience_min', 0)} year minimum")
        strengths.append(f"Text overlap score: {semantic_score}%" if state.get("semantic_method") == "lexical_overlap_fallback" else f"Semantic similarity score: {semantic_score}%")
        concerns = [
            f"Required skills not found in resume evidence: {', '.join(missing[:3])}" if missing else "No missing required skills in the supplied skill list",
        ]
        rationale = (
            f"The job-related score is {overall}% ({recommendation}) from the assessed skills, experience, and "
            f"{'text-overlap fallback' if state.get('semantic_method') == 'lexical_overlap_fallback' else 'semantic similarity'} components. "
            f"Review the listed evidence and gaps before making a decision."
        )

    return {
        "overall_score": overall,
        "recommendation": recommendation,
        "key_strengths": strengths,
        "key_concerns": concerns,
        "rationale": rationale,
        "ai_mode": ai_mode,
        "provider_status": ai_result.provider_status,
        "provider": getattr(ai_result, "provider", None),
        "model": getattr(ai_result, "model", None),
        "fallback_reason": ";".join(filter(None, [ai_result.fallback_reason, state.get("fallback_reason")] )) or None,
        "score_weights": weights,
        "score_formula": "weighted_mean_v1",
    }


def save_match_node(state: MatchingState) -> Dict[str, Any]:
    """
    Step 5: Persist match result to database.
    """
    try:
        job_id = state["job_id"]
        candidate_id = state["candidate_id"]

        match_record = MatchResult.query.filter_by(job_id=job_id, candidate_id=candidate_id).first()
        if not match_record:
            match_record = MatchResult(job_id=job_id, candidate_id=candidate_id)
            db.session.add(match_record)

        match_record.overall_score = state["overall_score"]
        match_record.skills_score = state["skills_score"]
        match_record.experience_score = state["experience_score"]
        match_record.semantic_score = state["semantic_score"]
        match_record.recommendation = state["recommendation"]
        match_record.matched_skills = state.get("matched_skills", [])
        match_record.missing_skills = state.get("missing_skills", [])
        match_record.key_strengths = state.get("key_strengths", [])
        match_record.key_concerns = state.get("key_concerns", [])
        match_record.rationale = state.get("rationale", "")

        db.session.flush()
        evaluation = MatchEvaluation.query.filter_by(match_id=match_record.id).first()
        if not evaluation:
            evaluation = MatchEvaluation(match_id=match_record.id)
            db.session.add(evaluation)
        evaluation.ai_mode = state.get("ai_mode", "fallback")
        evaluation.provider_status = state.get("provider_status", "unavailable")
        evaluation.fallback_reason = state.get("fallback_reason")
        evaluation.semantic_method = state.get("semantic_method", "unknown")
        evaluation.embedding_status = state.get("embedding_status", "unknown")
        evaluation.skills_assessed = bool(state.get("skills_assessed", True))
        evaluation.experience_assessed = bool(state.get("experience_assessed", True))
        evaluation.weights = state.get("score_weights", {})
        evaluation.score_formula = state.get("score_formula", "weighted_mean_v1")

        db.session.commit()
        return {}
    except Exception as e:
        db.session.rollback()
        return {"error": f"Failed to save match result: {str(e)}"}


def build_matching_graph():
    """
    Constructs the LangGraph workflow for candidate-job matching.
    """
    workflow = StateGraph(MatchingState)

    workflow.add_node("vector_similarity", vector_similarity_node)
    workflow.add_node("skill_matching", skill_matching_node)
    workflow.add_node("experience_scoring", experience_scoring_node)
    workflow.add_node("explainable_recommendation", explainable_recommendation_node)
    workflow.add_node("save_match", save_match_node)

    workflow.set_entry_point("vector_similarity")

    workflow.add_edge("vector_similarity", "skill_matching")
    workflow.add_edge("skill_matching", "experience_scoring")
    workflow.add_edge("experience_scoring", "explainable_recommendation")
    workflow.add_edge("explainable_recommendation", "save_match")
    workflow.add_edge("save_match", END)

    return workflow.compile()

