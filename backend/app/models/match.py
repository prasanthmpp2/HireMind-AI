from datetime import datetime
from sqlalchemy import Boolean
from app.models import db

class MatchResult(db.Model):
    __tablename__ = "match_results"

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey("job_descriptions.id"), nullable=False)
    candidate_id = db.Column(db.Integer, db.ForeignKey("candidates.id"), nullable=False)
    
    overall_score = db.Column(db.Float, nullable=False, default=0.0)
    skills_score = db.Column(db.Float, nullable=False, default=0.0)
    experience_score = db.Column(db.Float, nullable=False, default=0.0)
    semantic_score = db.Column(db.Float, nullable=False, default=0.0)
    
    # "Strongly Recommended", "Recommended", "Review", "Not Recommended"
    recommendation = db.Column(db.String(50), nullable=False, default="Review")
    
    matched_skills = db.Column(db.JSON, default=list)
    missing_skills = db.Column(db.JSON, default=list)
    key_strengths = db.Column(db.JSON, default=list)
    key_concerns = db.Column(db.JSON, default=list)
    rationale = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    evaluation = db.relationship("MatchEvaluation", backref="match", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        evaluation = self.evaluation
        metadata = {
            "ai_mode": evaluation.ai_mode,
            "provider_status": evaluation.provider_status,
            "fallback_reason": evaluation.fallback_reason,
            "semantic_method": evaluation.semantic_method,
            "embedding_status": evaluation.embedding_status,
            "skills_assessed": evaluation.skills_assessed,
            "experience_assessed": evaluation.experience_assessed,
            "weights": evaluation.weights or {},
            "score_formula": evaluation.score_formula,
        } if evaluation else {
            "ai_mode": "unknown",
            "provider_status": "unknown",
            "fallback_reason": "legacy_record_without_evaluation_metadata",
            "semantic_method": "unknown",
            "embedding_status": "unknown",
            "skills_assessed": None,
            "experience_assessed": None,
            "weights": {},
            "score_formula": "unknown",
        }
        metadata["semantic_component_score"] = round(self.semantic_score, 1)
        return {
            "id": self.id,
            "job_id": self.job_id,
            "candidate_id": self.candidate_id,
            "candidate_name": self.candidate.name if self.candidate else "Unknown",
            "candidate_email": self.candidate.email if self.candidate else "",
            "candidate_experience": self.candidate.total_experience_years if self.candidate else None,
            "job_title": self.job.title if self.job else "Unknown",
            "overall_score": round(self.overall_score, 1),
            "skills_score": round(self.skills_score, 1) if metadata["skills_assessed"] is not False else None,
            "experience_score": round(self.experience_score, 1) if metadata["experience_assessed"] is not False else None,
            "semantic_score": round(self.semantic_score, 1) if metadata["semantic_method"].endswith("_cosine") else None,
            "recommendation": self.recommendation,
            "matched_skills": self.matched_skills or [],
            "missing_skills": self.missing_skills or [],
            "key_strengths": self.key_strengths or [],
            "key_concerns": self.key_concerns or [],
            "rationale": self.rationale or "",
            "score_metadata": metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class MatchEvaluation(db.Model):
    """Additive provenance for scores and model-generated explanation state."""
    __tablename__ = "match_evaluations"

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey("match_results.id", ondelete="CASCADE"), nullable=False, unique=True)
    ai_mode = db.Column(db.String(32), nullable=False, default="fallback")
    provider_status = db.Column(db.String(32), nullable=False, default="unavailable")
    fallback_reason = db.Column(db.String(100), nullable=True)
    semantic_method = db.Column(db.String(64), nullable=False, default="unknown")
    embedding_status = db.Column(db.String(32), nullable=False, default="unknown")
    skills_assessed = db.Column(Boolean, nullable=False, default=True)
    experience_assessed = db.Column(Boolean, nullable=False, default=True)
    weights = db.Column(db.JSON, nullable=False, default=dict)
    score_formula = db.Column(db.String(64), nullable=False, default="weighted_mean_v1")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

