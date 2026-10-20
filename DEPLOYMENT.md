# Production configuration and operations

This document describes deployment requirements. It does not certify that this repository has been deployed or production-tested.

## Origins, HTTPS, and secrets

- Set `FRONTEND_ORIGINS` in the Flask environment to a comma-separated allowlist of exact HTTPS origins, for example `https://app.example.com`. Do not include wildcard origins. The frontend and API must use HTTPS in production.
- Set `AUTH_COOKIE_SECURE=true`; keep the session cookies `HttpOnly` and `SameSite` as configured by the backend. If frontend and API are on different sites, review the SameSite policy and CSRF behavior before deployment.
- Set a unique high-entropy `FLASK_SECRET_KEY`. Store it and `GROQ_API_KEY` / `HUGGINGFACE_API_KEY` in the hosting provider's secret manager. Never set provider credentials as `VITE_*` variables or commit `.env` files.
- Configure `VITE_API_BASE_URL` to the public `/api/v1` URL at frontend build time. This value is public and must contain no credentials.
- Provision recruiter and admin accounts using a controlled operator process. Do not enable public staff-role registration.

## Persistent state

- Configure `DATABASE_URL` for a managed persistent database. SQLite is suitable only for a single-process local/development setup; do not place production SQLite on ephemeral storage or share it across application replicas.
- Set `CHROMA_PERSIST_DIR` to durable storage with access restricted to the backend service. If vector persistence is lost, rebuild embeddings from authorized resume/job records before enabling semantic matching; inspect status metadata and fallback behavior.
- Set `UPLOAD_FOLDER` to private durable temporary storage only if a deployment needs uploads to survive process restarts. Current uploaded source files are removed after synchronous processing; parsed records and generated reports persist in the database until deletion.
- Back up the database and vector store on a schedule, encrypt backups at rest and in transit, limit operator access, and test restore procedures. Coordinate database/vector snapshots so rebuilt or restored vector entries match database records.
- Define a retention schedule for candidate records and reports. Current candidate/account deletion cascades associated records; expired auth sessions and throttles can be pruned with `python -m flask --app run.py prune-auth-data`. Backups need their own expiry and deletion policy.

## Health and operations

- `GET /api/v1/health` is a liveness check only. It does not verify database, vector store, or AI provider readiness. Monitor dependencies separately and alert on errors, latency, disk capacity, failed backups, and elevated provider fallback/rate-limit metadata.
- Run Flask behind a production WSGI server and TLS-terminating reverse proxy. Do not run `python run.py` or Flask's development server in production.
- Restrict backend network access, enforce upload limits, scan/monitor the temporary upload volume, and avoid logging resume text, contact details, session tokens, or provider secrets.
- Document and rehearse incident response, secret rotation, account recovery, backup restoration, and data deletion verification.

## Local verification setup

The local ports are frontend `5173` and Flask `5000`. Copy the checked-in `.env.example` files and use only local secrets. Browser E2E uses a separate ignored SQLite database (`backend/hiremind-e2e.db`) and local Chroma/upload directories. It is not production configuration.
