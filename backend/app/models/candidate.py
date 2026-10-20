from datetime import datetime
from app.models import db

class Candidate(db.Model):
    __tablename__ = "candidates"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    location = db.Column(db.String(255), nullable=True)
    linkedin = db.Column(db.String(255), nullable=True)
    github = db.Column(db.String(255), nullable=True)
    portfolio = db.Column(db.String(255), nullable=True)
    summary = db.Column(db.Text, nullable=True)
    total_experience_years = db.Column(db.Float, nullable=True, default=None)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    resume = db.relationship("ResumeData", backref="candidate", uselist=False, cascade="all, delete-orphan")
    # ResumeDraft contains structured editor data; ResumeData remains the legacy
    # parsed-file record consumed by the original screening workflow.
    resume_drafts = db.relationship("ResumeDraft", backref="candidate", cascade="all, delete-orphan", lazy="dynamic")
    ownership = db.relationship("CandidateOwnership", backref="candidate", uselist=False, cascade="all, delete-orphan")
    matches = db.relationship("MatchResult", backref="candidate", cascade="all, delete-orphan", lazy="dynamic")
    interview_kits = db.relationship("InterviewKit", backref="candidate", cascade="all, delete-orphan", lazy="dynamic")

    def to_dict(self, include_editor_resume: bool = False):
        result = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "location": self.location,
            "linkedin": self.linkedin,
            "github": self.github,
            "portfolio": self.portfolio,
            "summary": self.summary,
            "total_experience_years": self.total_experience_years,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resume": self.resume.to_dict() if self.resume else None,
        }
        if include_editor_resume:
            latest_editor_resume = self.resume_drafts.order_by(ResumeDraft.updated_at.desc()).first()
            result["editor_resume"] = latest_editor_resume.to_dict() if latest_editor_resume else None
        return result


class ResumeData(db.Model):
    __tablename__ = "resume_data"

    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey("candidates.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(20), default="pdf")
    raw_text = db.Column(db.Text, nullable=False)
    education = db.Column(db.JSON, default=list)
    skills = db.Column(db.JSON, default=dict)
    experience = db.Column(db.JSON, default=list)
    projects = db.Column(db.JSON, default=list)
    certifications = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "candidate_id": self.candidate_id,
            "filename": self.filename,
            "file_type": self.file_type,
            "education": self.education or [],
            "skills": self.skills or {},
            "experience": self.experience or [],
            "projects": self.projects or [],
            "certifications": self.certifications or [],
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class CandidateOwnership(db.Model):
    """Capability credential for development profiles until account auth exists."""
    __tablename__ = "candidate_ownership"

    candidate_id = db.Column(db.Integer, db.ForeignKey("candidates.id", ondelete="CASCADE"), primary_key=True)
    token_hash = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class ResumeDraft(db.Model):
    """Versioned structured editor document, separate from imported-file parse output."""
    __tablename__ = "resume_drafts"

    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False, default="Resume")
    schema_version = db.Column(db.Integer, nullable=False, default=1)
    resume_data = db.Column(db.JSON, nullable=False)
    design_metadata = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "candidate_id": self.candidate_id,
            "name": self.name,
            "schema_version": self.schema_version,
            "resume": self.resume_data,
            "design": self.design_metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

