from flask import Blueprint, jsonify, request, g, current_app

from app.models import db
from app.models.auth import AuthSession, User
from app.models.candidate import Candidate
from app.schemas.api import CandidateProfileInput
from app.services.auth_service import authenticated_user, create_user, digest, fail, login_user, set_session_cookie
from app.services.auth_service import csrf_valid

auth_bp = Blueprint("auth_api", __name__)


def _public_user(user):
    candidate = Candidate.query.filter_by(user_id=user.id).first() if user.role == "candidate" else None
    return {"id": user.id, "email": user.email, "role": user.role, "candidate_id": candidate.id if candidate else None}


@auth_bp.post("/register")
def register_candidate():
    body = request.get_json(silent=True) or {}
    profile, failure = _validate_profile(body.get("personal", {}))
    if failure:
        return failure
    raw_email = body.get("email", profile.email or "")
    password = body.get("password", "")
    if not isinstance(raw_email, str) or not isinstance(password, str) or len(password) < 12 or len(password) > 256:
        return jsonify({"error": {"code": "validation_error", "message": "Password must be between 12 and 256 characters."}}), 400
    email = raw_email.strip().lower()
    if not email or "@" not in email or not profile.name.strip():
        return jsonify({"error": {"code": "validation_error", "message": "A valid email and candidate name are required."}}), 400
    if not email or User.query.filter_by(email=email).first():
        return jsonify({"error": {"code": "registration_unavailable", "message": "An account could not be created with these details."}}), 409
    try:
        user = create_user(email, password, "candidate")
        personal = profile.model_dump()
        candidate = Candidate(name=profile.name, user_id=user.id)
        candidate.email = email
        candidate.phone = personal.get("phone") or None
        candidate.location = personal.get("address") or None
        candidate.linkedin = personal.get("linkedin") or None
        candidate.github = personal.get("github") or None
        candidate.summary = personal.get("summary") or None
        db.session.add(candidate)
        db.session.commit()
        token, csrf, user = login_user(email, password)
        response = jsonify({"user": _public_user(user), "csrf_token": csrf})
        set_session_cookie(response, token)
        response.set_cookie(current_app.config["AUTH_CSRF_COOKIE_NAME"], csrf, max_age=current_app.config["AUTH_SESSION_TTL_SECONDS"], httponly=True, secure=current_app.config["AUTH_COOKIE_SECURE"], samesite="Strict", path="/")
        return response, 201
    except Exception:
        db.session.rollback()
        current_app.logger.warning("Candidate registration failed.")
        return jsonify({"error": {"code": "registration_failed", "message": "Account registration could not be completed."}}), 400


def _validate_profile(personal):
    from pydantic import ValidationError
    try:
        return CandidateProfileInput.model_validate({"personal": personal}).personal, None
    except ValidationError:
        return None, (jsonify({"error": {"code": "validation_error", "message": "Candidate profile details are invalid."}}), 400)


@auth_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    email, password = body.get("email", ""), body.get("password", "")
    if not isinstance(email, str) or not isinstance(password, str) or len(password) > 256:
        return fail("invalid_credentials", "Email or password is incorrect.", 401)
    token, csrf, outcome = login_user(email, password)
    if outcome == "throttled":
        return fail("login_throttled", "Too many failed attempts. Try again later.", 429)
    if outcome == "invalid":
        return fail("invalid_credentials", "Email or password is incorrect.", 401)
    response = jsonify({"user": _public_user(outcome), "csrf_token": csrf})
    set_session_cookie(response, token)
    response.set_cookie(current_app.config["AUTH_CSRF_COOKIE_NAME"], csrf, max_age=current_app.config["AUTH_SESSION_TTL_SECONDS"], httponly=True, secure=current_app.config["AUTH_COOKIE_SECURE"], samesite="Strict", path="/")
    return response, 200


@auth_bp.get("/session")
def session_info():
    user = authenticated_user()
    if not user:
        return fail()
    csrf = request.cookies.get(current_app.config["AUTH_CSRF_COOKIE_NAME"], "")
    record = getattr(g, "auth_record", None)
    if not record or not csrf or not __import__("hmac").compare_digest(record.csrf_hash, digest(csrf)):
        return fail("session_invalid", "Please sign in again.", 401)
    response = jsonify({"user": _public_user(user), "csrf_token": csrf})
    response.headers["Cache-Control"] = "no-store"
    return response, 200


@auth_bp.post("/logout")
def logout():
    user = authenticated_user()
    if not csrf_valid():
        return fail("csrf_failed", "Request verification failed. Refresh your session and try again.", 403)
    record = getattr(g, "auth_record", None)
    if user and record:
        db.session.delete(record)
        db.session.commit()
    response = jsonify({"status": "signed_out"})
    response.delete_cookie(current_app.config["AUTH_COOKIE_NAME"], path="/")
    response.delete_cookie(current_app.config["AUTH_CSRF_COOKIE_NAME"], path="/")
    response.headers["Cache-Control"] = "no-store"
    return response, 200


@auth_bp.delete("/account")
def delete_candidate_account():
    from app.services.auth_service import csrf_valid
    user = authenticated_user()
    if not user or user.role != "candidate":
        return fail("forbidden", "Candidate account deletion is unavailable for this account.", 403)
    if not csrf_valid():
        return fail("csrf_failed", "Request verification failed.", 403)
    candidate = Candidate.query.filter_by(user_id=user.id).first()
    if candidate:
        try:
            from app.services.vector_service import VectorService
            VectorService().delete_resume(candidate.id)
        except Exception:
            current_app.logger.warning("Candidate vector deletion failed.")
            return jsonify({"error": {"code": "deletion_failed", "message": "Account data could not be fully deleted. Retry or contact an administrator."}}), 503
        db.session.delete(candidate)
        AuthSession.query.filter_by(user_id=user.id).delete()
        db.session.delete(user)
    db.session.commit()
    response = jsonify({"status": "account_deleted"})
    response.delete_cookie(current_app.config["AUTH_COOKIE_NAME"], path="/")
    response.delete_cookie(current_app.config["AUTH_CSRF_COOKIE_NAME"], path="/")
    response.headers["Cache-Control"] = "no-store"
    return response, 200
