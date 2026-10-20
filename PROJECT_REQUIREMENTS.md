# HireMind AI completion requirements

Use this as the acceptance list for completing the merged application. Passing the current automated checks does not mean every acceptance item has been exercised.

## Product and feature requirements

- Candidate portal: create/edit structured resumes; live preview; all existing templates, theme/font/font-size settings, section reordering, photo crop/upload, import from each supported format, autosave and restore, saved copies, account sync, and PDF export.
- Recruiter workspace: authenticated job create/read/update/delete; one-file and batch resume uploads; validate and parse supported PDF/DOCX/TXT files; run matching and show actual result/leaderboard data and evidence; candidate detail; generate and persist interview kits; copy and print/export the real kit.
- Keep existing LangGraph screening, matching, and interview workflows; expose real services through the REST API. Provider-unavailable output must be labeled fallback, with no fabricated metrics or success states.
- Ensure all visible controls perform the documented action or are disabled with an explanation. Include responsive desktop/tablet/mobile layouts, keyboard and screen-reader labels, loading/empty/error states, direct URL refresh, and useful network-failure messages.

## Data, privacy, and security requirements

- Validate versioned resume/job/candidate/workflow schemas server-side and preserve editor sections/design metadata without turning presentation data into matching evidence.
- Enforce candidate/recruiter/admin permissions and tenant ownership in the backend for reads, writes, uploads, reports, matches, and interview kits. Protect cookie sessions with CSRF, secure production cookies, password hashing, throttling, and safe errors.
- Keep provider credentials server-side; bound provider timeouts/retries; validate model output; expose provider/fallback metadata; never log PII, resume text, credentials, or tokens.
- Validate upload extension, MIME/content signature, size, and file count. Define retention and account deletion for uploaded source files, parsed records, generated reports, and backups.
- Keep original source projects and local user data intact during integration. Ignore secrets, local databases, uploads, vector-store files, and generated outputs in Git.

## Engineering and release requirements

- Maintain React + TypeScript/Vite frontend and Flask API backend, documented local setup, environment examples, CORS origins, ports, and health semantics.
- Maintain unit, API integration, and browser E2E suites for core candidate/recruiter journeys, validation/error paths, tenant boundaries, provider fallback, and existing features.
- Pass frontend lint, typecheck, tests, and production build; pass backend parser/workflow/API tests; pass supported browser journeys at mobile and desktop sizes with direct refresh and no unhandled console errors.
- Keep production dependencies free of known advisories; review high/critical development-tooling advisories in a dedicated upgrade/test cycle. Review build-size warnings and run deployment-specific HTTPS, persistent DB/vector/upload storage, health/readiness, encrypted backup, restore, and retention checks.
- Do not call the application production-ready until all required acceptance items are verified in the target deployment environment.

## Current audit status

The current check results and explicitly unverified items are maintained in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Current coverage is partial: automated tests pass locally, but many builder controls and recruiter browser journeys still need direct E2E coverage, development-tooling advisories need a planned migration, and deployment checks have not run.
