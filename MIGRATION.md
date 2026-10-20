# Migration record

## Source preservation

The original repositories remain untouched in `Interactive_Resume_Builder/` and `Ai_HR_Recruiter/`. Each has a local backup branch named `codex/pre-integration-backup-2026-10-20` at its original HEAD. The builder source had a pre-existing staged edit to `.env.example`; it remains in the original checkout and was not copied because the integration copy uses a safe public-only frontend environment template.

## Copied module origins

- `frontend/src/**`, `frontend/index.html`, Vite/TypeScript/Tailwind/PostCSS configuration, package manifest/lockfile, README, and docs: copied from `Interactive_Resume_Builder/`. Existing resume editor behavior was not intentionally changed.
- `backend/app/**`, `backend/config.py`, `backend/run.py`, `backend/seed_data.py`, `backend/requirements.txt`, `backend/tests/**`, sample resume data, and backend README: copied from `Ai_HR_Recruiter/`. One additive health route and one health test were added in the integration copy.
- Root `.gitignore`, `README.md`, and this migration note are new integration files.

## Excluded from copies

Git metadata, `.env` files, installed dependencies, build output, Python caches, local SQLite files, Chroma persistence, and uploaded documents were excluded. Sample resume fixtures were retained for existing parser tests.

## Phase 1 changes

Only repository scaffolding, environment templates, documentation, ignore rules, and a liveness endpoint were added. No recruiter or resume business workflow was deliberately rewritten. The frontend currently contains direct Hugging Face browser integration from its source project; provider proxying is a required follow-up before production use.

## Phase 2 changes

- Added `backend/app/routes/api_v1_routes.py` for versioned JSON endpoints and `backend/app/schemas/api.py` for validated request and response models.
- Added `backend/app/services/workflow_service.py` as the service boundary for the existing screening, matching, and interview LangGraph workflows. Legacy JSON route handlers now delegate graph execution through this service while retaining their paths and response behavior.
- Restricted CORS for `/api/v1/*` to configured `FRONTEND_ORIGINS`; added request/file limits and generic versioned API error responses.
- Kept all recruiter HTML routes and legacy JSON routes registered. Route classification and API details are in `backend/API.md`.
- Added integration tests for CRUD, invalid input, missing/unsupported files, MIME and size checks, missing jobs, no candidates, fallback mode, and CORS.

## Phase 3: structured resume integration

- Kept `ResumeData` and its single uploaded-file relationship intact for existing screening imports. Added `ResumeDraft` for structured resumes; its old `CandidateOwnership` development capability is invalidated and removed at startup.
- The React builder maps its complete resume plus template, font, font size, and section order to the API. Synced drafts appear on recruiter candidate detail and are fed directly to matching/interview context. Imported PDF/DOCX/TXT screening remains unchanged.
- Validation, round-trip fidelity, empty/long/Unicode data, invalid URL, ownership isolation, upload edge cases, and sensitive log output are covered in the backend suite. API/model relationships and DTO details are documented in `backend/API.md`.

## Phase 4: account authentication and tenant access

- Added candidate, recruiter, and admin accounts with Werkzeug password hashing. Public registration creates candidates only; staff roles are provisioned with the Flask `create-user` command.
- Replaced browser-persisted candidate bearer credentials with opaque random session tokens stored hashed in the database and sent through HttpOnly, SameSite cookies. Sessions expire after the configured lifetime and are individually revoked on logout/account deletion. Mutating requests require a double-submit CSRF token; the frontend keeps it in memory and sends it in `X-CSRF-Token`.
- Added role and tenant checks to versioned APIs, legacy JSON APIs, and HTML recruiter routes. Recruiters are scoped to owned jobs and imported candidates; match and interview records are scoped through those resources. Admin access spans tenants. Candidates access only their own structured resume endpoints.
- Added additive startup migration for `user_id`/`created_by_user_id`; preexisting unowned records remain intact and admin-only until reassigned. Existing development owner token hashes are deleted because those credentials are no longer accepted.
- Uploads are removed after parsing. Candidate deletion cascades database resume drafts, parsed resume data, matches, and interview kits and removes the vector record; account deletion also revokes sessions. Generated reports are retained until explicit deletion. Periodic `prune-auth-data` removes expired session and login-throttle records.
- Backend authorization tests cover anonymous access, candidate/recruiter role boundaries, cross-candidate draft reads, recruiter tenant isolation, CSRF enforcement, secure cookies, login throttling, and session behavior.

## Phase 5: unified product flow and vector-store compatibility

- Candidate and recruiter workflows are available in the React application under separate `/candidate/*` and `/recruiter/*` route groups. The original project repositories remain as source references; no business modules were deleted.
- Corrected candidate dashboard and saved-resume copy to describe the implemented account sync accurately.
- Chroma stores explicit vectors in versioned `hiremind_resumes_v2` and `hiremind_jobs_v2` collections. Legacy collections are left intact; this avoids relying on provider-client objects in Chroma's persisted embedding configuration. Matching continues to consume current resume/job text directly through the embedding service and reports lexical fallback when embeddings are unavailable.
- Local regression checks passed with an isolated SQLite test database and Chroma directory: frontend lint, component tests, production build, candidate browser journeys, and backend API/workflow suite. Recruiter workflows are covered by backend API integration tests; a full recruiter browser journey and every resume import modality were not separately exercised.
