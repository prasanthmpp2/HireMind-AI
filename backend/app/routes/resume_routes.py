import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from app.models import db
from app.models.candidate import Candidate
from app.services.workflow_service import screen_resume
from app.services.auth_service import authenticated_user

resume_bp = Blueprint("resume_api", __name__)

@resume_bp.route("/candidates", methods=["GET"])
def get_candidates():
    user = authenticated_user()
    query = Candidate.query if user.role == "admin" else Candidate.query.filter_by(created_by_user_id=user.id)
    candidates = query.order_by(Candidate.created_at.desc()).all()
    return jsonify([c.to_dict() for c in candidates])

@resume_bp.route("/candidates/<int:candidate_id>", methods=["GET"])
def get_candidate(candidate_id):
    candidate = Candidate.query.get_or_404(candidate_id)
    if authenticated_user().role != "admin" and candidate.created_by_user_id != authenticated_user().id:
        return jsonify({"error": "Candidate not found"}), 404
    return jsonify(candidate.to_dict())

@resume_bp.route("/upload", methods=["POST"])
def upload_resumes():
    if "files" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    uploaded_files = request.files.getlist("files")
    if not uploaded_files or uploaded_files[0].filename == "":
        return jsonify({"error": "No selected files"}), 400

    upload_dir = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)

    results = []
    errors = []

    for file in uploaded_files:
        filename = secure_filename(file.filename)
        if not filename:
            continue

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in current_app.config["ALLOWED_EXTENSIONS"] and ext != "txt":
            errors.append({"filename": filename, "error": f"Unsupported format .{ext}"})
            continue

        file_path = os.path.join(upload_dir, f"{uuid.uuid4().hex}_{filename}")
        file.save(file_path)

        try:
            # Execute the existing screening graph through its service boundary.
            final_state = screen_resume(file_path, filename, ext, owner_user_id=authenticated_user().id)

            if final_state.get("error"):
                errors.append({"filename": filename, "error": "Resume screening failed."})
            else:
                candidate_id = final_state.get("candidate_id")
                candidate = Candidate.query.get(candidate_id) if candidate_id else None
                results.append({
                    "filename": filename,
                    "candidate": candidate.to_dict() if candidate else final_state.get("extracted_data")
                })
        except Exception:
            db.session.rollback()
            errors.append({"filename": filename, "error": "Resume screening failed."})
        finally:
            try:
                os.remove(file_path)
            except OSError:
                pass

    return jsonify({
        "message": f"Processed {len(results)} resumes with {len(errors)} errors.",
        "processed": results,
        "errors": errors
    }), 200

@resume_bp.route("/candidates/<int:candidate_id>", methods=["DELETE"])
def delete_candidate(candidate_id):
    candidate = Candidate.query.get_or_404(candidate_id)
    if authenticated_user().role != "admin" and candidate.created_by_user_id != authenticated_user().id:
        return jsonify({"error": "Candidate not found"}), 404
    try:
        from app.services.vector_service import VectorService
        VectorService().delete_resume(candidate.id)
    except Exception:
        current_app.logger.warning("Candidate vector deletion failed.")
        return jsonify({"error": "Candidate data could not be fully deleted. Retry or contact an administrator."}), 503
    db.session.delete(candidate)
    db.session.commit()
    return jsonify({"message": f"Candidate {candidate_id} deleted successfully"}), 200

