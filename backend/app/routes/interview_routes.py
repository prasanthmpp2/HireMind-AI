from flask import Blueprint, request, jsonify
from app.models import db
from app.models.job import JobDescription
from app.models.candidate import Candidate
from app.models.interview import InterviewKit
from app.services.workflow_service import generate_interview_kit as build_interview_kit
from app.services.auth_service import authenticated_user

interview_bp = Blueprint("interview_api", __name__)

@interview_bp.route("/<int:job_id>/<int:candidate_id>", methods=["GET"])
def get_interview_kit(job_id, candidate_id):
    user = authenticated_user()
    job = JobDescription.query.get_or_404(job_id)
    if user.role != "admin" and job.user_id != user.id:
        return jsonify({"error": "Interview kit not found"}), 404
    kit = InterviewKit.query.filter_by(job_id=job_id, candidate_id=candidate_id).first()
    if not kit:
        return jsonify({"message": "Interview kit not generated yet", "kit": None}), 404
    return jsonify(kit.to_dict())

@interview_bp.route("/generate", methods=["POST"])
def generate_interview_kit():
    data = request.get_json() or {}
    job_id = data.get("job_id")
    candidate_id = data.get("candidate_id")

    if not job_id or not candidate_id:
        return jsonify({"error": "job_id and candidate_id are required"}), 400

    job = JobDescription.query.get_or_404(job_id)
    candidate = Candidate.query.get_or_404(candidate_id)
    user = authenticated_user()
    if user.role != "admin" and (job.user_id != user.id or candidate.created_by_user_id != user.id):
        return jsonify({"error": "Job or candidate not found"}), 404

    try:
        kit, _ai_mode, _metadata = build_interview_kit(job, candidate)
        return jsonify({"message": "Interview kit successfully generated", "kit": kit}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to generate interview kit"}), 500

