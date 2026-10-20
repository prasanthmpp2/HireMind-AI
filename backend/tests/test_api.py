import io
import uuid
from contextlib import redirect_stdout
import unittest
from unittest.mock import patch
from app import create_app, db
from app.models.job import JobDescription
from app.models.candidate import Candidate
from app.models.match import MatchResult
from app.models.interview import InterviewKit
from app.models.auth import User
from app.services.auth_service import create_user
from app.services.groq_client import GroqService, ProviderResult
from app.services.workflow_service import _resume_skills, _resume_text, _structured_resume

class TestFlaskAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        cls.client = cls.app.test_client()
        with cls.app.app_context():
            if not User.query.filter_by(email="test-recruiter@example.test").first():
                create_user("test-recruiter@example.test", "Recruiter-Test-Passphrase-123!", "recruiter")
                db.session.commit()
        auth = cls.client.post("/api/v1/auth/login", json={"email": "test-recruiter@example.test", "password": "Recruiter-Test-Passphrase-123!"})
        cls.client.environ_base["HTTP_X_CSRF_TOKEN"] = auth.get_json()["csrf_token"]
        cls.candidate_counter = 0

    def test_health_endpoint(self):
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json(), {"status": "ok"})

    def test_auth_session_cookies_csrf_roles_and_login_throttle(self):
        anonymous = self.app.test_client()
        self.assertEqual(anonymous.get("/api/v1/jobs").status_code, 401)
        registered = anonymous.post("/api/v1/auth/register", json={
            "email": f"auth-{uuid.uuid4().hex}@example.test", "password": "Candidate-Secure-Passphrase-123!",
            "personal": {"name": "Auth Boundary"}
        })
        self.assertEqual(registered.status_code, 201)
        self.assertTrue(registered.headers.get("Set-Cookie", "").find("HttpOnly") >= 0)
        self.assertTrue(registered.headers.get("Set-Cookie", "").find("SameSite=Lax") >= 0)
        self.assertEqual(registered.headers.get("Cache-Control"), "no-store")
        candidate = anonymous.get("/api/v1/auth/session").get_json()["user"]
        self.assertEqual(candidate["role"], "candidate")
        self.assertEqual(anonymous.get("/api/v1/jobs").status_code, 403)
        self.assertEqual(anonymous.post("/api/v1/candidate-profiles/999/resumes", json={}).status_code, 403)

        no_csrf = self.app.test_client()
        signed_in = no_csrf.post("/api/v1/auth/login", json={"email": "test-recruiter@example.test", "password": "Recruiter-Test-Passphrase-123!"}).get_json()
        no_csrf.environ_base.pop("HTTP_X_CSRF_TOKEN", None)
        denied = no_csrf.post("/api/v1/jobs", json={"title": "CSRF", "raw_description": "Description"})
        self.assertEqual(signed_in["user"]["role"], "recruiter")
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.get_json()["error"]["code"], "csrf_failed")

        throttle_email = f"throttle-{uuid.uuid4().hex}@example.test"
        for _ in range(5):
            response = anonymous.post("/api/v1/auth/login", json={"email": throttle_email, "password": "wrong"})
            self.assertEqual(response.status_code, 401)
        limited = anonymous.post("/api/v1/auth/login", json={"email": throttle_email, "password": "wrong"})
        self.assertEqual(limited.status_code, 429)
        self.assertNotIn("throttle-key", limited.get_data(as_text=True))
        anonymous.environ_base["HTTP_X_CSRF_TOKEN"] = registered.get_json()["csrf_token"]
        self.assertEqual(anonymous.post("/api/v1/auth/logout").status_code, 200)
        self.assertEqual(anonymous.get("/api/v1/auth/session").status_code, 401)

    def test_recruiter_tenant_isolation_for_jobs_and_candidates(self):
        other_client = self.app.test_client()
        with self.app.app_context():
            if not User.query.filter_by(email="other-recruiter@example.test").first():
                create_user("other-recruiter@example.test", "Other-Recruiter-Secure-123!", "recruiter")
                db.session.commit()
        login = other_client.post("/api/v1/auth/login", json={"email": "other-recruiter@example.test", "password": "Other-Recruiter-Secure-123!"})
        other_client.environ_base["HTTP_X_CSRF_TOKEN"] = login.get_json()["csrf_token"]
        job = self._create_v1_job().get_json()["item"]
        self.assertEqual(other_client.get(f"/api/v1/jobs/{job['id']}").status_code, 404)
        self.assertEqual(other_client.delete(f"/api/v1/jobs/{job['id']}").status_code, 404)
        self.assertEqual(other_client.get("/api/v1/jobs").get_json()["items"], [])
        upload = self.client.post("/api/v1/resumes", data={
            "files": (io.BytesIO(b"Tenant Candidate\nEmail: tenant-candidate@example.test\nSkills: Python\n"), "tenant.txt", "text/plain")
        }, content_type="multipart/form-data")
        candidate_id = upload.get_json()["processed"][0]["candidate"]["id"]
        self.assertEqual(other_client.get(f"/api/v1/candidates/{candidate_id}").status_code, 404)
        self.assertEqual(other_client.delete(f"/api/v1/candidates/{candidate_id}").status_code, 404)
        self.assertEqual(other_client.get("/api/v1/candidates").get_json()["items"], [])
        with self.app.app_context():
            record = MatchResult(job_id=job["id"], candidate_id=candidate_id, rationale="Tenant scoped")
            kit = InterviewKit(job_id=job["id"], candidate_id=candidate_id)
            db.session.add_all([record, kit])
            db.session.commit()
            match_id, kit_id = record.id, kit.id
        self.assertEqual(other_client.get(f"/api/v1/matches/{match_id}").status_code, 404)
        self.assertEqual(other_client.get(f"/api/v1/interview-kits/{kit_id}").status_code, 404)
        self.assertEqual(other_client.get(f"/api/v1/jobs/{job['id']}/matches").status_code, 404)

    def _create_v1_job(self):
        return self.client.post("/api/v1/jobs", json={
            "title": "V1 Test Role",
            "raw_description": "Backend role requiring Python and Flask.",
            "required_skills": ["Python", "Flask"],
            "experience_years_min": 2,
        })

    def _create_owned_profile(self, name="Zoë 李"):
        type(self).candidate_counter += 1
        client = self.app.test_client()
        email = f"candidate-{uuid.uuid4().hex}@example.test"
        response = client.post("/api/v1/auth/register", json={"email": email, "password": "Candidate-Test-Passphrase-123!", "personal": {"name": name, "email": email}})
        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        client.environ_base["HTTP_X_CSRF_TOKEN"] = payload["csrf_token"]
        return payload["user"]["candidate_id"], client

    def _resume_payload(self, name="Zoë 李"):
        return {
            "schema_version": 1,
            "name": f"{name} full stack resume",
            "resume": {
                "personal": {"name": name, "email": "zoe@example.test", "phone": "+1 555 0100", "address": "東京", "linkedin": "https://linkedin.com/in/zoe", "github": "https://github.com/zoe", "photo": "data:image/png;base64,AA==", "summary": "Experienced engineer."},
                "education": [{"degree": "MSc", "institution": "東京大学", "year": "2024", "score": "4.0"}],
                "experience": [{"company": "Example", "role": "Engineer", "duration": "2022–2024", "description": "Built services."}],
                "projects": [{"name": "Résumé app", "link": "https://example.test", "description": "Built it.", "tech": "React"}],
                "skills": ["Python", "Unicode skill — 工程"],
                "certifications": [{"name": "Cloud", "issuer": "Example Org", "year": "2025"}],
            },
            "design": {"template": "emerald", "font": "merriweather", "font_size": "large", "section_order": ["summary", "experience", "education", "projects", "skills", "certifications"]},
        }

    def test_v1_job_crud_and_validation(self):
        invalid = self.client.post("/api/v1/jobs", json={"title": "", "raw_description": ""})
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.get_json()["error"]["code"], "validation_error")

        created = self._create_v1_job()
        self.assertEqual(created.status_code, 201)
        job_id = created.get_json()["item"]["id"]
        updated = self.client.patch(f"/api/v1/jobs/{job_id}", json={"title": "Updated V1 Role"})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["item"]["title"], "Updated V1 Role")
        self.assertEqual(self.client.get(f"/api/v1/jobs/{job_id}").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/v1/jobs/{job_id}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/jobs/{job_id}").status_code, 404)

    def test_v1_resume_upload_validation(self):
        missing = self.client.post("/api/v1/resumes", data={}, content_type="multipart/form-data")
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(missing.get_json()["error"]["code"], "missing_file")

        unsupported = self.client.post("/api/v1/resumes", data={
            "files": (io.BytesIO(b"data"), "resume.exe", "application/octet-stream")
        }, content_type="multipart/form-data")
        self.assertEqual(unsupported.status_code, 415)
        self.assertEqual(unsupported.get_json()["error"]["code"], "invalid_file")

        mime_mismatch = self.client.post("/api/v1/resumes", data={
            "files": (io.BytesIO(b"plain text that is not a PDF"), "resume.txt", "application/pdf")
        }, content_type="multipart/form-data")
        self.assertEqual(mime_mismatch.status_code, 415)

        invalid_utf8 = self.client.post("/api/v1/resumes", data={
            "files": (io.BytesIO(b"\xff\xfe\xfa"), "encoding.txt", "text/plain")
        }, content_type="multipart/form-data")
        self.assertEqual(invalid_utf8.status_code, 415)

        empty_file = self.client.post("/api/v1/resumes", data={
            "files": (io.BytesIO(b""), "empty.txt", "text/plain")
        }, content_type="multipart/form-data")
        self.assertEqual(empty_file.status_code, 400)

        original_limit = self.app.config["MAX_UPLOAD_FILE_SIZE"]
        self.app.config["MAX_UPLOAD_FILE_SIZE"] = 8
        try:
            too_large = self.client.post("/api/v1/resumes", data={
                "files": (io.BytesIO(b"this text exceeds eight bytes"), "resume.txt", "text/plain")
            }, content_type="multipart/form-data")
        finally:
            self.app.config["MAX_UPLOAD_FILE_SIZE"] = original_limit
        self.assertEqual(too_large.status_code, 413)

    def test_v1_cors_allows_only_configured_origin(self):
        allowed = self.client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
        blocked = self.client.get("/api/v1/health", headers={"Origin": "https://untrusted.example"})
        self.assertEqual(allowed.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
        self.assertIsNone(blocked.headers.get("Access-Control-Allow-Origin"))

    def test_v1_missing_job_and_empty_candidates(self):
        missing_job = self.client.post("/api/v1/matching-runs", json={"job_id": 999999})
        self.assertEqual(missing_job.status_code, 404)
        self.assertEqual(missing_job.get_json()["error"]["code"], "not_found")

        created = self._create_v1_job()
        job_id = created.get_json()["item"]["id"]
        empty = self.client.post("/api/v1/matching-runs", json={"job_id": job_id, "candidate_ids": []})
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty.get_json()["results"], [])
        self.assertEqual(empty.get_json()["status"], "completed")

    def test_v1_provider_unavailable_reports_fallback(self):
        body = b"Taylor Example\nEmail: taylor@example.com\nSkills: Python, Flask\nExperience: 3 years backend engineering\n"
        with patch.object(GroqService, "call_structured_json", return_value=None):
            upload = self.client.post("/api/v1/screening-runs", data={
                "files": (io.BytesIO(body), "taylor.txt", "text/plain")
            }, content_type="multipart/form-data")
            self.assertEqual(upload.status_code, 200)
            upload_data = upload.get_json()
            self.assertEqual(upload_data["status"], "completed")
            self.assertEqual(upload_data["processed"][0]["ai_mode"], "fallback")
            candidate_id = upload_data["processed"][0]["candidate"]["id"]

            created = self._create_v1_job()
            job_id = created.get_json()["item"]["id"]
            matches = self.client.post("/api/v1/matching-runs", json={
                "job_id": job_id, "candidate_ids": [candidate_id]
            })
            self.assertEqual(matches.status_code, 200)
            self.assertEqual(matches.get_json()["ai_mode"], "fallback")

            kit = self.client.post(f"/api/v1/candidates/{candidate_id}/interview-kits", json={"job_id": job_id})
            self.assertEqual(kit.status_code, 200)
            self.assertEqual(kit.get_json()["ai_mode"], "fallback")

    def test_duplicate_resume_upload_reuses_candidate_record(self):
        body = b"Taylor Duplicate\nEmail: duplicate-resume@example.test\nSkills: Python, Flask\nExperience: 3 years backend engineering\n"
        upload_dir = self.app.config["UPLOAD_FOLDER"]
        before = set(upload_dir.iterdir()) if hasattr(upload_dir, "iterdir") else set()
        response = self.client.post("/api/v1/resumes", data={
            "files": [(io.BytesIO(body), "first.txt", "text/plain"), (io.BytesIO(body), "second.txt", "text/plain")]
        }, content_type="multipart/form-data")
        self.assertEqual(response.status_code, 200)
        items = response.get_json()["processed"]
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["candidate"]["id"], items[1]["candidate"]["id"])
        after = set(upload_dir.iterdir())
        self.assertEqual(after - before, set())

    def test_v1_ai_text_proxy_returns_provider_output_and_safe_unavailable_error(self):
        with patch.object(GroqService, "call_llm_result", return_value=ProviderResult("Revised resume summary", "available", provider="huggingface", model="openai/gpt-oss-120b")):
            result = self.client.post("/api/v1/ai/generate", json={"prompt": "Improve my summary"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.get_json()["text"], "Revised resume summary")
        self.assertEqual(result.get_json()["metadata"]["provider_status"], "available")
        self.assertEqual(result.get_json()["metadata"]["provider"], "huggingface")
        self.assertEqual(result.get_json()["metadata"]["model"], "openai/gpt-oss-120b")

        with patch.object(GroqService, "call_llm_result", return_value=ProviderResult("", "unavailable", "provider_timeout")):
            unavailable = self.client.post("/api/v1/ai/generate", json={"prompt": "Improve my summary"})
        self.assertEqual(unavailable.status_code, 503)
        self.assertEqual(unavailable.get_json()["error"]["code"], "provider_unavailable")
        self.assertNotIn("GROQ", unavailable.get_data(as_text=True))

        with patch.object(GroqService, "call_llm_result", return_value=ProviderResult("", "rate_limited", "provider_rate_limited")):
            limited = self.client.post("/api/v1/ai/generate", json={"prompt": "Improve my summary"})
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(limited.get_json()["metadata"]["provider_status"], "rate_limited")

    def test_v1_ai_text_proxy_validates_input(self):
        missing = self.client.post("/api/v1/ai/generate", json={})
        oversized = self.client.post("/api/v1/ai/generate", json={"prompt": "x" * 12001})
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(oversized.status_code, 400)

    def test_provider_parse_logs_never_include_resume_content(self):
        output = io.StringIO()
        from app.schemas.ai import MatchExplanationOutput
        with patch.object(GroqService, "call_llm_result", return_value=ProviderResult("Not JSON candidate@example.test +1-555-0100", "available")), redirect_stdout(output):
            self.assertIsNone(GroqService.call_structured_result("private prompt", "system", MatchExplanationOutput).data)
        self.assertNotIn("candidate@example.test", output.getvalue())
        self.assertNotIn("+1-555-0100", output.getvalue())

    def test_v1_resume_draft_save_reload_update_delete_fidelity(self):
        candidate_id, candidate_client = self._create_owned_profile()
        payload = self._resume_payload()
        created = candidate_client.post(f"/api/v1/candidate-profiles/{candidate_id}/resumes", json=payload)
        self.assertEqual(created.status_code, 201)
        saved = created.get_json()["item"]
        self.assertEqual(saved["resume"], payload["resume"])
        self.assertEqual(saved["design"], payload["design"])
        reloaded = candidate_client.get(f"/api/v1/candidate-profiles/{candidate_id}/resumes/{saved['id']}")
        self.assertEqual(reloaded.status_code, 200)
        self.assertEqual(reloaded.get_json()["item"]["resume"], payload["resume"])
        self.assertEqual(len(candidate_client.get(f"/api/v1/candidate-profiles/{candidate_id}/resumes").get_json()["items"]), 1)
        self.assertEqual(self.client.get(f"/api/v1/candidates/{candidate_id}").status_code, 404)
        with self.app.app_context():
            candidate = db.session.get(Candidate, candidate_id)
            structured = _structured_resume(candidate)
            self.assertEqual(_resume_skills(candidate, structured)[0], "Python")
            match_text = _resume_text(candidate, structured)
            self.assertIn("Python", match_text)
            self.assertNotIn("zoe@example.test", match_text)
            self.assertNotIn("data:image/png", match_text)

        payload["name"] = "Updated résumé"
        payload["design"]["font_size"] = "xlarge"
        updated = candidate_client.put(f"/api/v1/candidate-profiles/{candidate_id}/resumes/{saved['id']}", json=payload)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["item"]["name"], "Updated résumé")
        self.assertEqual(updated.get_json()["item"]["design"]["font_size"], "xlarge")
        self.assertEqual(candidate_client.delete(f"/api/v1/candidate-profiles/{candidate_id}/resumes/{saved['id']}").status_code, 200)

    def test_v1_resume_draft_empty_optional_sections_and_long_text(self):
        candidate_id, candidate_client = self._create_owned_profile("Long Text Candidate")
        payload = self._resume_payload("Long Text Candidate")
        payload["resume"].update({"education": [], "experience": [], "projects": [], "skills": [], "certifications": []})
        payload["resume"]["personal"]["summary"] = "長" * 15000
        response = candidate_client.post(f"/api/v1/candidate-profiles/{candidate_id}/resumes", json=payload)
        self.assertEqual(response.status_code, 201)
        saved = response.get_json()["item"]["resume"]
        self.assertEqual(saved["education"], [])
        self.assertEqual(saved["skills"], [])
        self.assertEqual(len(saved["personal"]["summary"]), 15000)

    def test_v1_resume_draft_rejects_invalid_urls_and_unauthorized_access(self):
        candidate_id, candidate_client = self._create_owned_profile()
        path = f"/api/v1/candidate-profiles/{candidate_id}/resumes"
        payload = self._resume_payload()
        payload["resume"]["personal"]["linkedin"] = "javascript:alert(1)"
        invalid = candidate_client.post(path, json=payload)
        self.assertEqual(invalid.status_code, 400)
        unsupported_design = self._resume_payload()
        unsupported_design["design"]["template"] = "not-a-template"
        self.assertEqual(candidate_client.post(path, json=unsupported_design).status_code, 400)
        wrong_candidate_id, wrong_client = self._create_owned_profile("Other Candidate")
        missing = self.client.get(path)
        wrong = wrong_client.get(path)
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(wrong.status_code, 403)

        second_id, second_client = self._create_owned_profile("Second Candidate")
        second_draft = second_client.post(f"/api/v1/candidate-profiles/{second_id}/resumes", json=self._resume_payload("Second Candidate")).get_json()["item"]
        cross_profile = candidate_client.get(f"/api/v1/candidate-profiles/{second_id}/resumes/{second_draft['id']}")
        self.assertEqual(cross_profile.status_code, 403)

    def test_v1_resume_draft_rejects_oversized_fields(self):
        candidate_id, candidate_client = self._create_owned_profile("Length Candidate")
        payload = self._resume_payload("Length Candidate")
        payload["resume"]["experience"] = [{"company": "X", "role": "Y", "duration": "", "description": "x" * 20001}]
        response = candidate_client.post(f"/api/v1/candidate-profiles/{candidate_id}/resumes", json=payload)
        self.assertEqual(response.status_code, 400)

    def test_v1_workflow_errors_do_not_expose_exception_text(self):
        with patch("app.routes.api_v1_routes.screen_resume", side_effect=RuntimeError("secret stack detail")):
            result = self.client.post("/api/v1/resumes", data={
                "files": (io.BytesIO(b"Jordan Example\nA valid resume text body."), "jordan.txt", "text/plain")
            }, content_type="multipart/form-data")
        self.assertEqual(result.status_code, 422)
        self.assertNotIn("secret stack detail", result.get_data(as_text=True))

    def test_pages_render(self):
        for path in ["/", "/jobs", "/screening", "/matching", "/interview"]:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200, f"Path {path} failed")

    def test_job_lifecycle(self):
        # Create Job
        res = self.client.post("/api/jobs", json={
            "title": "API Test Engineer",
            "department": "QA",
            "experience_required": "2 years",
            "experience_years_min": 2.0,
            "required_skills": ["Python", "PyTest", "Docker"],
            "raw_description": "We need an API test engineer with Python and Docker."
        })
        self.assertEqual(res.status_code, 201)
        job_data = res.get_json()
        job_id = job_data["id"]

        # Get Jobs
        res = self.client.get("/api/jobs")
        self.assertEqual(res.status_code, 200)
        jobs = res.get_json()
        self.assertTrue(any(j["id"] == job_id for j in jobs))

        # Delete Job
        del_res = self.client.delete(f"/api/jobs/{job_id}")
        self.assertEqual(del_res.status_code, 200)

    def test_resume_upload_and_match(self):
        # Create Job
        job_res = self.client.post("/api/jobs", json={
            "title": "Backend Pythonist",
            "department": "Engineering",
            "experience_required": "3 years",
            "experience_years_min": 3.0,
            "required_skills": ["Python", "Flask", "SQL"],
            "raw_description": "Backend engineer skilled in Python, Flask, and SQL databases."
        })
        job_id = job_res.get_json()["id"]

        # Upload Mock Resume (TXT format)
        resume_content = (
            "Charlie Bucket\n"
            "Email: charlie@bucket.com\n"
            "Phone: 555-9988\n"
            "Skills: Python, Flask, SQL, Docker, Git\n"
            "Summary: Backend developer with 3.5 years of experience in Python and Flask.\n"
            "Experience: 3.5 years as Software Engineer.\n"
        )
        data = {
            "files": (io.BytesIO(resume_content.encode("utf-8")), "charlie_resume.txt")
        }
        upload_res = self.client.post(
            "/api/resumes/upload",
            data=data,
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_res.status_code, 200)
        upload_json = upload_res.get_json()
        self.assertEqual(len(upload_json["processed"]), 1)
        cand_id = upload_json["processed"][0]["candidate"]["id"]

        # Run Matching
        match_res = self.client.post("/api/match/run", json={"job_id": job_id})
        self.assertEqual(match_res.status_code, 200)
        match_json = match_res.get_json()
        self.assertGreaterEqual(len(match_json["results"]), 1)

        # Generate Interview Kit
        kit_res = self.client.post("/api/interview/generate", json={
            "job_id": job_id,
            "candidate_id": cand_id
        })
        self.assertEqual(kit_res.status_code, 200)
        kit_json = kit_res.get_json()
        self.assertIn("kit", kit_json)
        self.assertGreaterEqual(len(kit_json["kit"]["technical_questions"]), 1)

if __name__ == "__main__":
    unittest.main()

