# HireMind AI regression and release checklist

Audit date: 2026-10-20. Results apply to the local Windows workspace and the current dependency lockfile. This is a regression audit, not a production deployment certification.

## Automated checks

| Check | Command | Result |
|---|---|---|
| Frontend lint | `cd frontend; npm.cmd run lint` | **PASS** ? exit 0, no ESLint warnings/errors |
| Frontend typecheck | Included in `npm.cmd run build` via `tsc -p tsconfig.json` | **PASS** ? production build type-check completed |
| Frontend component tests | `cd frontend; npm.cmd test` | **PASS** ? 3 test files, 3 tests passed |
| Frontend production build | `cd frontend; npm.cmd run build` | **PASS WITH WARNINGS** ? Vite built successfully. Generated JS chunks include 551 KB and 1,065 KB files, and the PDF worker is 1,078 KB (minified-size warnings above 500 KB). |
| Browser E2E | `cd frontend; $env:CI='true'; npm.cmd run test:e2e` | **PASS** ? Chromium, 2 tests passed; covers the candidate registration/edit/preview/PDF/refresh journey and visible API failure handling. |
| Backend unit/API/workflow suite | `cd backend; set isolated DATABASE_URL, CHROMA_PERSIST_DIR, UPLOAD_FOLDER and AI_PROVIDER; python -m pytest -q` | **PASS WITH WARNINGS** ? 34 passed, 157 warnings. Warnings are primarily deprecated `datetime.utcnow()` and SQLAlchemy `Query.get()` use. |
| Full dependency audit | `cd frontend; npm.cmd audit` | **FAIL / DEV TOOLING FOLLOW-UP** - 19 advisories: 5 moderate, 12 high, 2 critical, across development tooling. The available fixes request major upgrades and need a separate migration/test cycle. |
| Production dependency audit | `cd frontend; npm.cmd audit --omit=dev` | **PASS** - 0 production vulnerabilities after upgrading jsPDF and React Router and removing unused Axios. |

Playwright setup was run with `cd frontend; npm.cmd run test:e2e:install` and installed Chromium. The test server uses an isolated ignored SQLite DB, Chroma directory, and upload directory.

## Feature coverage verified

- Candidate UI: real candidate registration and session, resume editing, visible live preview, PDF export download, local autosave across direct refresh, responsive navigation at 390 px, saved-resume empty state, and a visible network failure message. Browser page-error collection was empty in the successful journey.
- Backend/API suite: authenticated job create/read/update/delete and validation; missing/unsupported/invalid/oversized uploads; duplicate files in one batch; parsed resume persistence; missing-job and empty-candidate matching; matching and interview generation with provider-unavailable fallback; candidate detail and interview-kit access; access isolation; CSRF and CORS checks.
- Parser/workflow tests include PDF/DOCX parsing, graph execution, provider-error/schema handling, no-embedding fallback, stale vector ID exclusion, and deterministic scoring.
- The only resume export format implemented by the React builder is PDF; PDF download was exercised in Chromium.

## Not fully verified / required before claiming complete regression coverage

- The builder's file import UI was not exercised end-to-end for each supported input (PDF, PPTX, JPG, PNG). Legacy `.ppt` is intentionally unsupported by the UI. PDF/DOCX/TXT backend screening parsing has existing parser/API tests, but those do not cover the builder's PPTX/image import pipeline.
- Theme/font selection, every template, section drag reorder, photo crop/upload, and import fidelity were inspected in source but not each driven in the browser suite.
- Recruiter UI journeys (create/edit/delete through the browser, single and batch upload UI, results/leaderboard rendering, candidate detail navigation, and interview-kit copy/print) were not run in Chromium. Their backend/API behavior is covered in pytest; recruiter HTML/UI behavior is not fully covered by the current 2 browser tests.
- No desktop/tablet/browser matrix, assistive-technology audit, real clipboard/print spooler check, production HTTPS/cookie/proxy check, database/vector-store backup-and-restore test, or deployment readiness probe was run.
- Live Groq and embedding provider calls were not run. Tests use deterministic patched provider outcomes and explicit fallback paths; provider credentials are not needed for the local regression suite.
- Health verification is liveness only (`GET /api/v1/health`); database/vector/provider readiness is not reported by that endpoint.

## Release decision

### Follow-up dependency repair

After the initial audit, `npm.cmd audit fix` refreshed compatible packages. Then jsPDF was upgraded to `^4.2.1`, React Router to `^7.18.4`, and unused Axios was removed. The frontend lint, typecheck, Vitest, build, and Playwright checks were rerun after these changes and passed. `npm.cmd audit --omit=dev` now reports **0 vulnerabilities**. Full `npm.cmd audit` still reports **19 development dependency advisories** (5 moderate, 12 high, 2 critical), mainly across Vitest/Tinypool, Vite/esbuild, Tailwind/chokidar, and TypeScript ESLint tooling. The remaining fixes request major upgrades and need a separate migration.

**NOT READY FOR PRODUCTION.** Production dependencies now audit clean, but full requested feature-by-feature browser regression remains incomplete and the development toolchain still has two critical advisories. Production CORS/HTTPS, persistent infrastructure, backup/restore, and live provider behavior also remain unverified. Migrate and retest the development toolchain, add recruiter and import/photo/reorder browser coverage, and run deployment-specific checks before release approval.

## Local setup and verification commands

PowerShell from the repository root:

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e:install
npm.cmd run test:e2e

Set-Location ..\backend
python -m pip install -r requirements.txt
python -m pytest -q
```

Production and operations requirements are documented in [DEPLOYMENT.md](DEPLOYMENT.md).
