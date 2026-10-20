import os
import click
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge
from config import Config
from app.models import db

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    if not app.config.get("SECRET_KEY") or app.config.get("SECRET_KEY") in {"replace-with-a-random-local-development-secret", "changeme"}:
        if os.getenv("FLASK_ENV") == "production":
            raise RuntimeError("FLASK_SECRET_KEY must be configured in production.")
        app.config["SECRET_KEY"] = os.urandom(32)

    # Cross-origin access is limited to explicitly configured frontend origins.
    CORS(app, supports_credentials=True, resources={r"/api/v1/*": {
        "origins": app.config["FRONTEND_ORIGINS"],
        "allow_headers": ["Content-Type", "X-CSRF-Token"],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }})

    # Initialize SQLAlchemy database
    db.init_app(app)

    # Ensure upload directory exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["CHROMA_PERSIST_DIR"], exist_ok=True)

    with app.app_context():
        # Create database tables
        db.create_all()
        # Additive compatibility migration for existing databases. New installs
        # receive these columns from model metadata; existing rows remain intact.
        from app.migrations import upgrade_auth_ownership
        upgrade_auth_ownership(db.engine)

    @app.cli.command("create-user")
    @click.option("--email", prompt=True)
    @click.option("--role", type=click.Choice(["admin", "recruiter"]), prompt=True)
    @click.password_option()
    def create_staff_user(email, role, password):
        """Provision a recruiter or administrator; public signup is candidate-only."""
        from app.models.auth import User
        from app.services.auth_service import create_user
        if User.query.filter_by(email=email.strip().lower()).first():
            raise click.ClickException("An account with this email already exists.")
        if len(password) < 12:
            raise click.ClickException("Password must be at least 12 characters.")
        create_user(email, password, role)
        db.session.commit()
        click.echo(f"Created {role} account {email.strip().lower()}.")

    @app.cli.command("prune-auth-data")
    def prune_auth_data():
        """Remove expired sessions and old failed-login throttle records."""
        from datetime import datetime, timedelta
        from app.models.auth import AuthSession, LoginThrottle
        expired = AuthSession.query.filter(AuthSession.expires_at <= datetime.utcnow()).delete()
        old_throttles = LoginThrottle.query.filter(LoginThrottle.window_started_at <= datetime.utcnow() - timedelta(days=1)).delete()
        db.session.commit()
        click.echo(f"Removed {expired} expired sessions and {old_throttles} expired throttle records.")

    # Register Blueprints
    from app.routes.web_routes import web_bp
    from app.routes.job_routes import job_bp
    from app.routes.resume_routes import resume_bp
    from app.routes.match_routes import match_bp
    from app.routes.interview_routes import interview_bp
    from app.routes.api_v1_routes import api_v1_bp
    from app.routes.auth_routes import auth_bp

    app.register_blueprint(web_bp)
    app.register_blueprint(api_v1_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(job_bp, url_prefix="/api/jobs")
    app.register_blueprint(resume_bp, url_prefix="/api/resumes")
    app.register_blueprint(match_bp, url_prefix="/api/match")
    app.register_blueprint(interview_bp, url_prefix="/api/interview")

    @app.before_request
    def enforce_authentication_and_csrf():
        path = request.path
        if not path.startswith("/api/") and not path.startswith("/api"):
            return None
        if path == "/api/v1/health" or path.startswith("/api/v1/auth/") or path == "/api/v1/setup/first-recruiter" or path == "/api/v1/setup/reset-staff" or request.endpoint == "static":
            return None
        from app.services.auth_service import authenticated_user, csrf_valid, fail
        user = authenticated_user()
        if not user:
            return fail()
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and not csrf_valid():
            return fail("csrf_failed", "Request verification failed. Refresh your session and try again.", 403)
        if user.role == "candidate":
            # Candidates can access only their own structured resume endpoints.
            if not path.startswith("/api/v1/candidate-profiles/"):
                return fail("forbidden", "You do not have access to this resource.", 403)
            from app.models.candidate import Candidate
            candidate = Candidate.query.filter_by(user_id=user.id).first()
            try:
                resource_id = int(path.split("/")[4])
            except (ValueError, IndexError):
                return fail("forbidden", "You do not have access to this resource.", 403)
            if not candidate or resource_id != candidate.id:
                return fail("forbidden", "You do not have access to this resource.", 403)
        elif user.role not in {"recruiter", "admin"}:
            return fail("forbidden", "You do not have access to this resource.", 403)
        return None

    @app.errorhandler(RequestEntityTooLarge)
    def request_too_large(_error):
        if request.path.startswith("/api/v1/"):
            return jsonify({"error": {"code": "request_too_large", "message": "Request exceeds the configured size limit."}}), 413
        return "Request too large", 413

    @app.errorhandler(404)
    def not_found(_error):
        if request.path.startswith("/api/v1/"):
            return jsonify({"error": {"code": "not_found", "message": "Resource was not found."}}), 404
        return _error

    @app.errorhandler(405)
    def method_not_allowed(_error):
        if request.path.startswith("/api/v1/"):
            return jsonify({"error": {"code": "method_not_allowed", "message": "Method is not allowed for this resource."}}), 405
        return _error

    @app.errorhandler(Exception)
    def api_unhandled_error(exc):
        if request.path.startswith("/api/v1/"):
            app.logger.error("Unhandled API error: %s", type(exc).__name__)
            return jsonify({"error": {"code": "internal_error", "message": "An internal error occurred."}}), 500
        raise exc

    return app

