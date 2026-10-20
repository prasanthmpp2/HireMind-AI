# Flask route inventory and API v1

## Authentication and access control

`POST /api/v1/auth/register` creates candidate accounts only. `POST /api/v1/auth/login`, `GET /api/v1/auth/session`, `POST /api/v1/auth/logout`, and `DELETE /api/v1/auth/account` manage sessions and candidate accounts. Login returns a CSRF token for in-memory frontend use; both the opaque session identifier and CSRF cookie are HttpOnly. Mutating authenticated routes require `X-CSRF-Token` matching the server-bound CSRF cookie and session hash. Login failures are throttled after five attempts per IP/email key. Uploaded source files are removed after processing and there are no source-file download endpoints.

Recruiters can access only jobs and candidates they own, and matches/interview kits are scoped through those jobs and candidates. Admins are the only cross-tenant role. Candidate users can access only their own structured resume endpoints. Legacy API routes and HTML workspaces are also authenticated. Existing records with no owner remain available to an administrator and are hidden from recruiter tenants until explicitly reassigned.

## Existing route classification

| Route | Type | Purpose |
|---|---|---|
| `/` | HTML | Recruiter dashboard |
| `/jobs` | HTML | Job manager |
| `/screening` | HTML | Resume screening page |
| `/matching` | HTML | Candidate leaderboard |
| `/interview` | HTML | Interview studio |
| `/api/jobs` and `/api/jobs/<job_id>` | Legacy JSON | Job list/detail/create/delete |
| `/api/resumes/candidates[/<candidate_id>]` | Legacy JSON | Candidate list/detail/delete |
| `/api/resumes/upload` | Legacy JSON | Resume upload and screening |
| `/api/match/job/<job_id>`, `/api/match/<match_id>`, `/api/match/run` | Legacy JSON | Match results and matching workflow |
| `/api/interview/<job_id>/<candidate_id>`, `/api/interview/generate` | Legacy JSON | Interview kit read/generation |

The HTML pages and legacy JSON routes remain registered for the old UI during migration.

## Versioned JSON routes

All `/api/v1` errors use `{"error":{"code":"...","message":"...","details":...}}`. IDs must be positive integers. Job and workflow request bodies use Pydantic validation; unknown fields are rejected.

| Method and path | Behavior |
|---|---|
| `GET /api/v1/health` | Process liveness |
| `POST /api/v1/auth/register` | Candidate account registration; never grants staff roles |
| `POST /api/v1/auth/login` | Creates a database-backed session cookie and CSRF token |
| `GET /api/v1/auth/session` | Current user, candidate ID where relevant, and in-memory CSRF token |
| `POST /api/v1/auth/logout` | Revokes the current session |
| `DELETE /api/v1/auth/account` | Candidate self-service account and data deletion |
| `POST /api/v1/ai/generate` | Server-side Groq text generation for the resume builder; JSON `{prompt, system_prompt?}`; provider unavailable returns safe 503 JSON |
| `GET /api/v1/jobs` | List jobs as `{items: [...]}` |
| `POST /api/v1/jobs` | Create job; returns 201 and `{item: ...}` |
| `GET /api/v1/jobs/<id>` | Job detail |
| `PATCH /api/v1/jobs/<id>` | Validated partial job update |
| `DELETE /api/v1/jobs/<id>` | Delete job |
| `GET /api/v1/candidates` | List candidates |
| `GET /api/v1/candidates/<id>` | Candidate detail (resume text is not serialized) |
| `DELETE /api/v1/candidates/<id>` | Delete recruiter-owned candidate and associated records |
| `POST /api/v1/resumes` | Screen one or more multipart `files` |
| `POST /api/v1/screening-runs` | Same synchronous screening operation with explicit terminal status |
| `POST /api/v1/matching-runs` | JSON `{job_id, candidate_ids?}`; omitted IDs means all candidates |
| `GET /api/v1/jobs/<id>/matches` | Match results sorted by score |
| `GET /api/v1/jobs/<id>/leaderboard` | Alias for sorted job match results |
| `GET /api/v1/matches/<id>` | Match detail |
| `POST /api/v1/candidates/<candidate_id>/interview-kits` | JSON `{job_id}`; generates and persists kit |
| `GET /api/v1/interview-kits/<id>` | Interview kit detail |
| `GET /api/v1/jobs/<job_id>/candidates/<candidate_id>/interview-kit` | Read kit by job/candidate |

### Upload policy

Accepted extensions are PDF, DOCX, and TXT. MIME types and basic file signatures/content are checked; empty files, unsupported formats, malformed PDF/DOCX, invalid UTF-8 text, and oversized uploads are rejected. Defaults are 10 MiB per file, 20 files per request, and 16 MiB total request size. Configure `MAX_UPLOAD_FILE_SIZE`, `MAX_UPLOAD_FILES`, and `MAX_CONTENT_LENGTH` in the backend environment. Uploaded files receive unique server names and are deleted after synchronous screening; parsed resume data remains in the database as before.

The screening operation responds with `status: completed` or `completed_with_errors`, counts, per-file status, and `ai_mode`. Matching and interview responses also report `ai_mode: provider|fallback`. The operations are synchronous today; there is no background job ID or polling endpoint. A future queue must introduce persisted run records before those semantics are added.

## AI provenance and score interpretation

Groq and Hugging Face credentials are read by the Flask process from `backend/.env` or its environment. They must never be configured as `VITE_*` browser variables. Set `AI_PROVIDER=huggingface`, `HF_TOKEN`, `HF_MODEL=openai/gpt-oss-120b`, and `HF_PROVIDER=fireworks-ai` to use the Hugging Face Inference API with `huggingface_hub.InferenceClient`. The documented API accepts a model ID and provider selection; the model page is `openai/gpt-oss-120b`. Calls use the configured timeout. A 429 is surfaced as `provider_rate_limited`; missing keys, timeouts, malformed model output, and provider errors use safe status metadata and deterministic/template fallback in structured workflows. Responses identify provider and model without returning credentials.

Screening results include per-file `ai_mode`, `provider_status`, and `fallback_reason`. Matching results include top-level provider/embedding metadata and per-match `score_metadata`, including explanation mode, embedding status, semantic method, assessed components, weights, and formula. `lexical_overlap_fallback` is a word-overlap heuristic; it is not semantic similarity. `ai_mode: fallback` means deterministic or template output and must not be described as model verified. The numeric overall match is deterministic, even when a model supplied the prose explanation.

The matching score uses the existing supported components: exact/contained required-skill evidence (45% base weight), text or embedding similarity (35%), and recorded experience versus the job minimum (20%). Weights are renormalized when required skill data or experience data is absent. Semantic/lexical method, assessed flags, and actual weights are returned so recruiters can review the calculation. Candidate summaries, contact details, names, and raw legacy resume text are excluded from matching and vector embedding inputs. The recruiter remains responsible for every hiring decision; scores do not make an automated rejection decision.

Legacy match rows without additive evaluation metadata are returned with `ai_mode: unknown` and are not represented as verified model output. Experience values already persisted as `0` by earlier heuristic versions cannot be retroactively distinguished from a genuine zero; new heuristic parses leave unknown experience empty.

## CORS and errors

Cross-origin requests are enabled only for `/api/v1/*` and origins listed in comma-separated `FRONTEND_ORIGINS` (default `http://localhost:5173`). Legacy pages use same-origin requests. API exceptions return generic messages and do not return stack traces, provider keys, or exception text. The health route is liveness only, not dependency readiness.

## Structured candidate resumes

`ResumeData` remains the legacy row produced by PDF, DOCX, and TXT screening. The candidate portal's editor state is stored in `resume_drafts`: those are editable, versioned structured documents and may have several per candidate. Startup creates missing tables and performs additive nullable owner-column migrations; it does not delete legacy candidate/resume records. Unowned legacy records remain admin-only until reassigned.

Schema version 1 is documented by the Pydantic `ResumeDraftInput` DTO. `resume` contains the editor's `personal`, `education`, `experience`, `projects`, `skills`, and `certifications` keys. `design` separately stores `template`, `font`, `font_size`, and `section_order`; rendering choices are not mixed into matching facts. Unknown fields fail validation. Contact links and project links accept only absolute HTTP(S) URLs. Large prose fields have explicit limits and empty optional lists are valid. The React editor's existing `ResumeData` maps directly to the `resume` field without flattening its sections; its selected visual options map to `design`.

| Method and path | Behavior |
|---|---|
| `POST /api/v1/candidate-profiles` | Deprecated; candidate profiles are created by authenticated registration |
| `GET /api/v1/candidate-profiles/<candidate_id>/resumes` | List that profile's structured drafts |
| `POST /api/v1/candidate-profiles/<candidate_id>/resumes` | Save another draft |
| `GET /api/v1/candidate-profiles/<candidate_id>/resumes/<resume_id>` | Load a draft |
| `PUT /api/v1/candidate-profiles/<candidate_id>/resumes/<resume_id>` | Replace a draft after validation |
| `DELETE /api/v1/candidate-profiles/<candidate_id>/resumes/<resume_id>` | Delete a draft |

All draft operations require the signed-in candidate's session and matching candidate ID. The former `X-Resume-Owner` capability is no longer accepted; its stored digests are removed during startup. A candidate may access only their own drafts, while recruiters do not receive candidate-portal draft access. The application currently runs screening synchronously and persists extracted data in `ResumeData`.

When a candidate has a structured draft, matching and interview generation consume the structured resume fields directly. The screening upload parser remains available and its `ResumeData.raw_text` path remains the fallback for imported resumes. No editor-generated PDF is required for matching.

Application code does not log resume payloads, credentials, session tokens, or passwords. API validation errors report field names and generic constraints rather than submitted values.
