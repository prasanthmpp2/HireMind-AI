from flask import Blueprint, request, jsonify
from app.models import db
from app.models.job import JobDescription
from app.models.candidate import Candidate
from app.models.match import MatchResult
from app.services.workflow_service import match_candidates
from app.services.auth_service import authenticated_user

match_bp = Blueprint("match_api", __name__)

@match_bp.route("/job/<int:job_id>", methods=["GET"])
def get_job_matches(job_id):
    user = authenticated_user()
    job = JobDescription.query.get_or_404(job_id)
    if user.role != "admin" and job.user_id != user.id:
        return jsonify({"error": "Job not found"}), 404
    matches = MatchResult.query.filter_by(job_id=job_id).order_by(MatchResult.overall_score.desc()).all()
    return jsonify([m.to_dict() for m in matches])

@match_bp.route("/<int:match_id>", methods=["GET"])
def get_match_detail(match_id):
    match_record = MatchResult.query.get_or_404(match_id)
    if authenticated_user().role != "admin" and match_record.job.user_id != authenticated_user().id:
        return jsonify({"error": "Match not found"}), 404
    return jsonify(match_record.to_dict())

@match_bp.route("/run", methods=["POST"])
def run_matching():
    data = request.get_json() or {}
    job_id = data.get("job_id")
    candidate_ids = data.get("candidate_ids")

    if not job_id:
        return jsonify({"error": "job_id is required"}), 400

    job = JobDescription.query.get_or_404(job_id)
    user = authenticated_user()
    if user.role != "admin" and job.user_id != user.id:
        return jsonify({"error": "Job not found"}), 404

    if candidate_ids and isinstance(candidate_ids, list):
        query = Candidate.query.filter(Candidate.id.in_(candidate_ids))
        if user.role != "admin":
            query = query.filter_by(created_by_user_id=user.id)
        candidates = query.all()
    else:
        # Match against all registered candidates
        candidates = Candidate.query.all() if user.role == "admin" else Candidate.query.filter_by(created_by_user_id=user.id).all()

    if not candidates:
        return jsonify({"message": "No candidates found to match against", "results": []}), 200

    try:
        results, _ai_mode, _metadata = match_candidates(job, candidates)
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Matching could not be completed."}), 500

    return jsonify({
        "message": f"Successfully evaluated {len(results)} candidates for {job.title}.",
        "job": job.to_dict(),
        "results": results
    }), 200

