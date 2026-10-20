import os
from flask import Blueprint, current_app, render_template, send_from_directory

web_bp = Blueprint("web", __name__)

def _get_dist_dir():
    candidates = [
        os.path.abspath(os.path.join(current_app.root_path, "..", "dist")),
        os.path.abspath(os.path.join(current_app.root_path, "..", "..", "frontend", "dist")),
        os.path.abspath(os.path.join(current_app.root_path, "..", "..", "dist")),
    ]
    for candidate in candidates:
        if os.path.isdir(candidate) and os.path.isfile(os.path.join(candidate, "index.html")):
            return candidate
    return None

@web_bp.route("/assets/<path:filename>")
def serve_assets(filename):
    dist_dir = _get_dist_dir()
    if dist_dir:
        assets_dir = os.path.join(dist_dir, "assets")
        if os.path.isdir(assets_dir) and os.path.isfile(os.path.join(assets_dir, filename)):
            return send_from_directory(assets_dir, filename)
    return ("Not found", 404)

@web_bp.route("/")
@web_bp.route("/jobs")
@web_bp.route("/screening")
@web_bp.route("/matching")
@web_bp.route("/interview")
@web_bp.route("/auth")
@web_bp.route("/candidate")
@web_bp.route("/candidate/<path:subpath>")
@web_bp.route("/recruiter")
@web_bp.route("/recruiter/<path:subpath>")
def spa_page(**_kwargs):
    dist_dir = _get_dist_dir()
    if dist_dir:
        return send_from_directory(dist_dir, "index.html")
    return render_template("index.html")

@web_bp.route("/<path:path>")
def static_proxy(path):
    if path.startswith("api/") or path.startswith("api_v1/"):
        return ("Not found", 404)
    dist_dir = _get_dist_dir()
    if dist_dir:
        target = os.path.join(dist_dir, path)
        if os.path.isfile(target):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, "index.html")
    return ("Not found", 404)
