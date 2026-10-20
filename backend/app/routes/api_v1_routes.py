import os
import uuid
import zipfile
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from pydantic import ValidationError
from werkzeug.utils import secure_filename

from app.models import db
from app.models.candidate import Candidate, ResumeDraft
from app.models.interview import InterviewKit
from app.models.job import JobDescription
from app.models.match import MatchResult
from app.schemas.api import AiGenerateInput, CandidateResponse, InterviewInput, InterviewKitResponse, JobInput, JobResponse, MatchInput, MatchResponse, ResumeDraftInput
from app.services.groq_client import GroqService
from app.services.workflow_service import generate_interview_kit, match_candidates, screen_resume
from app.services.auth_service import authenticated_user

api_v1_bp = Blueprint("api_v1", __name__, url_prefix="/api/v1")


def serialized(schema, value):
    return schema.model_validate(value).model_dump(mode="json")

MIME_TYPES = {
    "pdf": {"application/pdf"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"},
    "txt": {"text/plain"},
}


def error(code: str, message: str, status: int, details=None):
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return jsonify(body), status


def validate(schema, data):
    try:
        return schema.model_validate(data), None
    except ValidationError as exc:
        details = [
            {"field": ".".join(str(part) for part in item["loc"]), "message": item["msg"]}
            for item in exc.errors()
        ]
        return None, error("validation_error", "Request validation failed.", 400, details)


def _owned_candidate(candidate_id: int):
    candidate = db.session.get(Candidate, candidate_id)
    user = authenticated_user()
    if not candidate or (user.role != "admin" and candidate.user_id != user.id):
        return None, error("not_found", "Candidate profile was not found.", 404)
    return candidate, None


def _apply_resume_contact(candidate: Candidate, personal: dict) -> None:
    # Only fields represented in the existing Candidate model are projected.
    candidate.name = personal.get("name") or "Candidate"
    candidate.email = personal.get("email") or None
    candidate.phone = personal.get("phone") or None
    candidate.location = personal.get("address") or None
    candidate.linkedin = personal.get("linkedin") or None
    candidate.github = personal.get("github") or None
    candidate.summary = personal.get("summary") or None


def _new_draft(candidate: Candidate, payload: ResumeDraftInput) -> ResumeDraft:
    draft = ResumeDraft(
        candidate_id=candidate.id,
        name=payload.name,
        schema_version=payload.schema_version,
        resume_data=payload.resume.model_dump(mode="json"),
        design_metadata=payload.design.model_dump(mode="json"),
    )
    _apply_resume_contact(candidate, payload.resume.personal.model_dump())
    db.session.add(draft)
    return draft


def _validate_file(file):
    filename = secure_filename(file.filename or "")
    if not filename or "." not in filename:
        return None, "A valid filename with an extension is required.", 400
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in MIME_TYPES:
        return None, "Supported file types are PDF, DOCX, and TXT.", 415
    if file.mimetype not in MIME_TYPES[ext] and not (ext == "docx" and file.mimetype == "application/octet-stream"):
        return None, "File MIME type does not match its extension.", 415

    max_bytes = current_app.config["MAX_UPLOAD_FILE_SIZE"]
    file.stream.seek(0, os.SEEK_END)
    size = file.stream.tell()
    file.stream.seek(0)
    if size == 0:
        return None, "Uploaded file is empty.", 400
    if size > max_bytes:
        return None, f"File exceeds the {max_bytes}-byte limit.", 413

    header = file.stream.read(8)
    file.stream.seek(0)
    if ext == "pdf" and not header.startswith(b"%PDF-"):
        return None, "File content is not a valid PDF.", 415
    if ext == "docx":
        try:
            with zipfile.ZipFile(file.stream) as archive:
                if "word/document.xml" not in archive.namelist():
                    return None, "DOCX document content is invalid.", 415
        except (zipfile.BadZipFile, OSError):
            return None, "DOCX document content is invalid.", 415
        finally:
            file.stream.seek(0)
    if ext == "txt":
        content = file.stream.read()
        file.stream.seek(0)
        if b"\x00" in content:
            return None, "Text file contains unsupported binary content.", 415
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            return None, "Text file must use UTF-8 encoding.", 415
    return (filename, ext), None, None


@api_v1_bp.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


@api_v1_bp.post("/setup/first-recruiter")
def setup_first_recruiter():
    """
    One-time bootstrap endpoint.
    Creates the FIRST recruiter account only if NO recruiter or admin exists yet.
    Permanently disabled once any staff account is present in the database.
    """
    from app.models.auth import User
    from app.services.auth_service import create_user

    # Hard-lock: refuse if any staff account already exists
    existing_staff = User.query.filter(User.role.in_(["recruiter", "admin"])).first()
    if existing_staff:
        return jsonify({
            "error": {
                "code": "already_configured",
                "message": "This setup endpoint is permanently disabled because staff accounts already exist."
            }
        }), 409

    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))

    if not email or "@" not in email:
        return jsonify({"error": {"code": "validation_error", "message": "A valid email address is required."}}), 400
    if len(password) < 12 or len(password) > 256:
        return jsonify({"error": {"code": "validation_error", "message": "Password must be between 12 and 256 characters."}}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": {"code": "already_configured", "message": "An account with this email already exists."}}), 409

    user = create_user(email, password, "recruiter")
    db.session.commit()
    return jsonify({"status": "created", "email": user.email, "role": user.role}), 201


@api_v1_bp.post("/ai/generate")
def generate_ai_text():
    payload, failure = validate(AiGenerateInput, request.get_json(silent=True) or {})
    if failure:
        return failure
    outcome = GroqService.call_llm_result(payload.prompt, payload.system_prompt)
    if not outcome.text:
        status = 429 if outcome.provider_status == "rate_limited" else 503
        code = "provider_rate_limited" if status == 429 else "provider_unavailable"
        return jsonify({"error": {"code": code, "message": "The server-side AI provider could not complete this request."}, "metadata": {"provider_status": outcome.provider_status, "fallback_reason": outcome.fallback_reason, "provider": outcome.provider, "model": outcome.model}}), status
    return jsonify({"text": outcome.text, "ai_mode": "provider", "metadata": {"provider_status": outcome.provider_status, "fallback_reason": outcome.fallback_reason, "provider": outcome.provider, "model": outcome.model}}), 200


@api_v1_bp.get("/jobs")
def list_jobs():
    user = authenticated_user()
    query = JobDescription.query if user.role == "admin" else JobDescription.query.filter_by(user_id=user.id)
    jobs = query.order_by(JobDescription.created_at.desc()).all()
    return jsonify({"items": [serialized(JobResponse, job.to_dict()) for job in jobs]}), 200


@api_v1_bp.post("/jobs")
def create_job():
    payload, failure = validate(JobInput, request.get_json(silent=True) or {})
    if failure:
        return failure
    job = JobDescription(**payload.model_dump(), user_id=authenticated_user().id)
    db.session.add(job)
    db.session.commit()
    return jsonify({"item": serialized(JobResponse, job.to_dict())}), 201


@api_v1_bp.get("/jobs/<int:job_id>")
def get_job(job_id):
    job = db.session.get(JobDescription, job_id)
    if not job or (authenticated_user().role != "admin" and job.user_id != authenticated_user().id):
        return error("not_found", "Job was not found.", 404)
    return jsonify({"item": serialized(JobResponse, job.to_dict())}), 200


@api_v1_bp.patch("/jobs/<int:job_id>")
def update_job(job_id):
    job = db.session.get(JobDescription, job_id)
    if not job or (authenticated_user().role != "admin" and job.user_id != authenticated_user().id):
        return error("not_found", "Job was not found.", 404)
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return error("validation_error", "A non-empty JSON object is required.", 400)
    merged = {key: getattr(job, key) for key in JobInput.model_fields}
    merged.update(data)
    unknown_fields = sorted(set(data) - set(JobInput.model_fields))
    if unknown_fields:
        return error("validation_error", "Request validation failed.", 400, [{"field": key, "message": "extra field is not permitted"} for key in unknown_fields])
    payload, failure = validate(JobInput, merged)
    if failure:
        return failure
    for key, value in payload.model_dump().items():
        setattr(job, key, value)
    db.session.commit()
    return jsonify({"item": serialized(JobResponse, job.to_dict())}), 200


@api_v1_bp.delete("/jobs/<int:job_id>")
def delete_job(job_id):
    job = db.session.get(JobDescription, job_id)
    if not job or (authenticated_user().role != "admin" and job.user_id != authenticated_user().id):
        return error("not_found", "Job was not found.", 404)
    try:
        from app.services.vector_service import VectorService
        VectorService().delete_job(job_id)
    except Exception:
        current_app.logger.warning("Job vector deletion failed.")
        return error("deletion_failed", "Job data could not be fully deleted. Retry or contact an administrator.", 503)
    db.session.delete(job)
    db.session.commit()
    return jsonify({"status": "deleted", "id": job_id}), 200


@api_v1_bp.get("/candidates")
def list_candidates():
    user = authenticated_user()
    query = Candidate.query if user.role == "admin" else Candidate.query.filter_by(created_by_user_id=user.id)
    candidates = query.order_by(Candidate.created_at.desc()).all()
    return jsonify({"items": [serialized(CandidateResponse, candidate.to_dict()) for candidate in candidates]}), 200


@api_v1_bp.get("/candidates/<int:candidate_id>")
def candidate_detail(candidate_id):
    candidate = db.session.get(Candidate, candidate_id)
    if not candidate or (authenticated_user().role != "admin" and candidate.created_by_user_id != authenticated_user().id):
        return error("not_found", "Candidate was not found.", 404)
    return jsonify({"item": serialized(CandidateResponse, candidate.to_dict(include_editor_resume=True))}), 200


@api_v1_bp.delete("/candidates/<int:candidate_id>")
def delete_candidate(candidate_id):
    user = authenticated_user()
    candidate = db.session.get(Candidate, candidate_id)
    if not candidate or (user.role != "admin" and candidate.created_by_user_id != user.id):
        return error("not_found", "Candidate was not found.", 404)
    try:
        from app.services.vector_service import VectorService
        VectorService().delete_resume(candidate.id)
    except Exception:
        current_app.logger.warning("Candidate vector deletion failed.")
        return error("deletion_failed", "Candidate data could not be fully deleted. Retry or contact an administrator.", 503)
    db.session.delete(candidate)
    db.session.commit()
    return jsonify({"status": "deleted", "id": candidate_id}), 200


@api_v1_bp.post("/candidate-profiles")
def create_candidate_profile():
    return error("method_not_allowed", "Create a candidate account through /auth/register.", 405)


@api_v1_bp.get("/candidate-profiles/<int:candidate_id>/resumes")
def list_candidate_resumes(candidate_id):
    candidate, failure = _owned_candidate(candidate_id)
    if failure:
        return failure
    drafts = ResumeDraft.query.filter_by(candidate_id=candidate.id).order_by(ResumeDraft.updated_at.desc()).all()
    return jsonify({"items": [item.to_dict() for item in drafts]}), 200


@api_v1_bp.post("/candidate-profiles/<int:candidate_id>/resumes")
def create_candidate_resume(candidate_id):
    candidate, failure = _owned_candidate(candidate_id)
    if failure:
        return failure
    payload, failure = validate(ResumeDraftInput, request.get_json(silent=True) or {})
    if failure:
        return failure
    draft = _new_draft(candidate, payload)
    db.session.commit()
    return jsonify({"item": draft.to_dict()}), 201


@api_v1_bp.get("/candidate-profiles/<int:candidate_id>/resumes/<int:resume_id>")
def get_candidate_resume(candidate_id, resume_id):
    candidate, failure = _owned_candidate(candidate_id)
    if failure:
        return failure
    draft = db.session.get(ResumeDraft, resume_id)
    if not draft or draft.candidate_id != candidate.id:
        return error("not_found", "Resume was not found.", 404)
    return jsonify({"item": draft.to_dict()}), 200


@api_v1_bp.put("/candidate-profiles/<int:candidate_id>/resumes/<int:resume_id>")
def update_candidate_resume(candidate_id, resume_id):
    candidate, failure = _owned_candidate(candidate_id)
    if failure:
        return failure
    draft = db.session.get(ResumeDraft, resume_id)
    if not draft or draft.candidate_id != candidate.id:
        return error("not_found", "Resume was not found.", 404)
    payload, failure = validate(ResumeDraftInput, request.get_json(silent=True) or {})
    if failure:
        return failure
    draft.name = payload.name
    draft.schema_version = payload.schema_version
    draft.resume_data = payload.resume.model_dump(mode="json")
    draft.design_metadata = payload.design.model_dump(mode="json")
    _apply_resume_contact(candidate, payload.resume.personal.model_dump())
    db.session.commit()
    return jsonify({"item": draft.to_dict()}), 200


@api_v1_bp.delete("/candidate-profiles/<int:candidate_id>/resumes/<int:resume_id>")
def delete_candidate_resume(candidate_id, resume_id):
    candidate, failure = _owned_candidate(candidate_id)
    if failure:
        return failure
    draft = db.session.get(ResumeDraft, resume_id)
    if not draft or draft.candidate_id != candidate.id:
        return error("not_found", "Resume was not found.", 404)
    db.session.delete(draft)
    db.session.commit()
    return jsonify({"status": "deleted", "id": resume_id}), 200


def _screen_files(files):
    if not files:
        return error("missing_file", "At least one file is required in the 'files' field.", 400)
    if len(files) > current_app.config["MAX_UPLOAD_FILES"]:
        return error("too_many_files", "The upload contains too many files.", 400)

    validated = []
    for file in files:
        result, message, status = _validate_file(file)
        if message:
            return error("invalid_file", message, status)
        validated.append((file, *result))

    upload_dir = Path(current_app.config["UPLOAD_FOLDER"]).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    processed, failures = [], []
    for file, original_name, ext in validated:
        stored_name = f"{uuid.uuid4().hex}_{original_name}"
        stored_path = (upload_dir / stored_name).resolve()
        if upload_dir not in stored_path.parents:
            return error("invalid_file", "Upload path is invalid.", 400)
        file.save(stored_path)
        try:
            result = screen_resume(str(stored_path), original_name, ext, owner_user_id=authenticated_user().id)
            if result.get("error"):
                failures.append({"filename": original_name, "status": "failed", "message": "Resume could not be screened."})
            else:
                candidate = db.session.get(Candidate, result.get("candidate_id"))
                processed.append({
                    "filename": original_name,
                    "status": "completed",
                    "candidate": serialized(CandidateResponse, candidate.to_dict()) if candidate else result.get("extracted_data"),
                    "ai_mode": result.get("ai_mode", "fallback"),
                    "provider_status": result.get("provider_status", "unavailable"),
                    "fallback_reason": result.get("fallback_reason"),
                    "provider": result.get("provider"),
                    "model": result.get("model"),
                })
        except Exception:
            db.session.rollback()
            failures.append({"filename": original_name, "status": "failed", "message": "Resume screening failed."})
        finally:
            try:
                stored_path.unlink(missing_ok=True)
            except OSError:
                pass

    status = 200 if not failures else (207 if processed else 422)
    return jsonify({
        "status": "completed" if not failures else "completed_with_errors",
        "processed": processed,
        "errors": failures,
        "counts": {"total": len(validated), "succeeded": len(processed), "failed": len(failures)},
        "metadata": {"ai": {"modes": sorted({item["ai_mode"] for item in processed}), "provider_statuses": sorted({item["provider_status"] for item in processed}), "providers": sorted({item["provider"] for item in processed if item["provider"]}), "models": sorted({item["model"] for item in processed if item["model"]}), "fallback_reasons": sorted({item["fallback_reason"] for item in processed if item["fallback_reason"]})}},
    }), status


@api_v1_bp.post("/resumes")
def upload_resumes():
    return _screen_files(request.files.getlist("files"))


@api_v1_bp.post("/screening-runs")
def create_screening_run():
    # Work is currently synchronous; the response reports its terminal status.
    return _screen_files(request.files.getlist("files"))


@api_v1_bp.post("/matching-runs")
def run_matching():
    payload, failure = validate(MatchInput, request.get_json(silent=True) or {})
    if failure:
        return failure
    user = authenticated_user()
    job = db.session.get(JobDescription, payload.job_id)
    if not job or (user.role != "admin" and job.user_id != user.id):
        return error("not_found", "Job was not found.", 404)
    query = Candidate.query if user.role == "admin" else Candidate.query.filter_by(created_by_user_id=user.id)
    if payload.candidate_ids is not None:
        query = query.filter(Candidate.id.in_(payload.candidate_ids))
    candidates = query.all()
    if not candidates:
        return jsonify({"status": "completed", "ai_mode": "not_applicable", "metadata": {"provider_status": "not_applicable", "semantic_methods": []}, "job": serialized(JobResponse, job.to_dict()), "results": []}), 200
    try:
        results, ai_mode, ai_metadata = match_candidates(job, candidates)
    except Exception:
        db.session.rollback()
        return error("workflow_failed", "Matching could not be completed.", 500)
    return jsonify({"status": "completed", "ai_mode": ai_mode, "metadata": ai_metadata, "job": serialized(JobResponse, job.to_dict()), "results": [serialized(MatchResponse, item) for item in results]}), 200


@api_v1_bp.get("/jobs/<int:job_id>/matches")
@api_v1_bp.get("/jobs/<int:job_id>/leaderboard")
def job_matches(job_id):
    job = db.session.get(JobDescription, job_id)
    user = authenticated_user()
    if not job or (user.role != "admin" and job.user_id != user.id):
        return error("not_found", "Job was not found.", 404)
    results = MatchResult.query.filter_by(job_id=job_id).order_by(MatchResult.overall_score.desc()).all()
    return jsonify({"items": [serialized(MatchResponse, item.to_dict()) for item in results]}), 200


@api_v1_bp.get("/matches/<int:match_id>")
def match_detail(match_id):
    item = db.session.get(MatchResult, match_id)
    if not item or (authenticated_user().role != "admin" and item.job.user_id != authenticated_user().id):
        return error("not_found", "Match result was not found.", 404)
    return jsonify({"item": serialized(MatchResponse, item.to_dict())}), 200


@api_v1_bp.post("/candidates/<int:candidate_id>/interview-kits")
def create_interview_kit(candidate_id):
    payload, failure = validate(InterviewInput, request.get_json(silent=True) or {})
    if failure:
        return failure
    job = db.session.get(JobDescription, payload.job_id)
    candidate = db.session.get(Candidate, candidate_id)
    user = authenticated_user()
    if not job or not candidate or (user.role != "admin" and (job.user_id != user.id or candidate.created_by_user_id != user.id)):
        return error("not_found", "Job or candidate was not found.", 404)
    try:
        kit, ai_mode, ai_metadata = generate_interview_kit(job, candidate)
    except Exception:
        db.session.rollback()
        return error("workflow_failed", "Interview kit generation could not be completed.", 500)
    return jsonify({"status": "completed", "ai_mode": ai_mode, "metadata": ai_metadata, "item": serialized(InterviewKitResponse, kit)}), 200


@api_v1_bp.get("/interview-kits/<int:kit_id>")
def get_interview_kit(kit_id):
    kit = db.session.get(InterviewKit, kit_id)
    if not kit or (authenticated_user().role != "admin" and kit.job.user_id != authenticated_user().id):
        return error("not_found", "Interview kit was not found.", 404)
    return jsonify({"item": serialized(InterviewKitResponse, kit.to_dict())}), 200


@api_v1_bp.get("/jobs/<int:job_id>/candidates/<int:candidate_id>/interview-kit")
def get_candidate_interview_kit(job_id, candidate_id):
    kit = InterviewKit.query.filter_by(job_id=job_id, candidate_id=candidate_id).first()
    if not kit or (authenticated_user().role != "admin" and kit.job.user_id != authenticated_user().id):
        return error("not_found", "Interview kit was not found.", 404)
    return jsonify({"item": serialized(InterviewKitResponse, kit.to_dict())}), 200
