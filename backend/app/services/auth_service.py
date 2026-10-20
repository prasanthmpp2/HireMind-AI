import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from functools import wraps

from flask import current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from app.models import db
from app.models.auth import AuthSession, LoginThrottle, User

_DUMMY_PASSWORD_HASH = generate_password_hash(secrets.token_urlsafe(24))


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def fail(code="authentication_required", message="Authentication is required.", status=401):
    return jsonify({"error": {"code": code, "message": message}}), status


def authenticated_user():
    if hasattr(g, "auth_user"):
        return g.auth_user
    token = request.cookies.get(current_app.config["AUTH_COOKIE_NAME"], "")
    if not token:
        g.auth_user = None
        return None
    session_record = AuthSession.query.filter_by(token_hash=digest(token)).first()
    now = datetime.utcnow()
    if not session_record or session_record.expires_at <= now:
        if session_record:
            db.session.delete(session_record)
            db.session.commit()
        g.auth_user = None
        return None
    user = db.session.get(User, session_record.user_id)
    g.auth_record = session_record
    g.auth_user = user if user and user.active else None
    return g.auth_user


def roles_required(*roles):
    def decorate(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            user = authenticated_user()
            if not user:
                return fail()
            if user.role not in roles:
                return fail("forbidden", "You do not have access to this resource.", 403)
            return fn(*args, **kwargs)
        return wrapped
    return decorate


def csrf_valid():
    record = getattr(g, "auth_record", None)
    supplied = request.headers.get("X-CSRF-Token", "")
    cookie_token = request.cookies.get(current_app.config["AUTH_CSRF_COOKIE_NAME"], "")
    return bool(record and supplied and cookie_token and hmac.compare_digest(cookie_token, supplied) and hmac.compare_digest(record.csrf_hash, digest(supplied)))


def create_user(email: str, password: str, role="candidate") -> User:
    normalized = email.strip().lower()
    user = User(email=normalized, password_hash=generate_password_hash(password), role=role)
    db.session.add(user)
    db.session.flush()
    return user


def login_user(email: str, password: str):
    now = datetime.utcnow()
    key = digest(f"{request.remote_addr or 'unknown'}:{email.strip().lower()}")
    throttle = db.session.get(LoginThrottle, key)
    if throttle and throttle.locked_until and throttle.locked_until > now:
        return None, None, "throttled"
    if throttle and now - throttle.window_started_at > timedelta(minutes=15):
        throttle.failures = 0
        throttle.window_started_at = now
        throttle.locked_until = None

    user = User.query.filter_by(email=email.strip().lower(), active=True).first()
    password_matches = check_password_hash(user.password_hash if user else _DUMMY_PASSWORD_HASH, password)
    if not user or not password_matches:
        if not throttle:
            throttle = LoginThrottle(key_hash=key, failures=0, window_started_at=now)
            db.session.add(throttle)
        throttle.failures += 1
        if throttle.failures >= 5:
            throttle.locked_until = now + timedelta(minutes=15)
        db.session.commit()
        return None, None, "invalid"

    if throttle:
        db.session.delete(throttle)
    # Issue a fresh opaque token on every login. Other devices keep independent
    # revocable sessions until logout or expiry.
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    record = AuthSession(
        user_id=user.id,
        token_hash=digest(token),
        csrf_hash=digest(csrf),
        expires_at=now + timedelta(seconds=current_app.config["AUTH_SESSION_TTL_SECONDS"]),
    )
    db.session.add(record)
    db.session.commit()
    return token, csrf, user


def set_session_cookie(response, token):
    secure = current_app.config["AUTH_COOKIE_SECURE"]
    response.set_cookie(
        current_app.config["AUTH_COOKIE_NAME"], token,
        max_age=current_app.config["AUTH_SESSION_TTL_SECONDS"],
        httponly=True,
        secure=secure,
        samesite="None" if secure else "Lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return response
