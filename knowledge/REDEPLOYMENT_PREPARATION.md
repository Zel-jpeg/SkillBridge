# Railway and Vercel redeployment preparation

Date: 29 October 2026. Preparation branch: `codex/redeployment-preparation`;
published application merge: `2b0c435` on `main`.

## Authorized scope

Prepare and test local dependency/security fixes and deployment configuration.
Preserve all source tests, migrations, research artifacts and existing secrets.
On 29 October, the owner additionally authorized committing/pushing the preparation
branch, merging/pushing main, and rerunning checks after publication. Pushing main
can trigger the connected hosts' automatic deployments. Direct subscription
changes, manual hosted migrations, live queue processing and live email remain
outside this work; the owner plans to resubscribe after the merged-code checks.

The owner has generated a webhook token, added `BREVO_WEBHOOK_SECRET` as a staged
Railway variable, and saved a disabled Brevo transactional webhook. Its secret is
not copied into this repository. Enable and test it only during hosted release.
Later owner screenshots also show GOOGLE_OAUTH_CLIENT_ID in Railway. Both values
remain masked; their presence is confirmed, not their contents or deployment.

## Existing hosting evidence

Owner screenshots show the backend root `/skillbridge-backend`, branch `main`,
Railpack, Python 3.13.15, one web service, no custom build/start/pre-deploy command,
no healthcheck, serverless disabled and restart on failure. Existing variables
remain masked. Frontend remains on Vercel. Railway is offline after trial expiry.

## Tracker

- [x] Reconcile clean main, project instructions and hosting screenshots.
- [x] Create a local preparation branch.
- [x] Select compatible dependency security updates; preserve NLP behavior.
- [x] Bind Google sign-in to the configured OAuth client and DNSC domain.
- [x] Prepare explicit build/start, static serving, healthcheck and worker config.
- [x] Add targeted regressions and run full isolated PostgreSQL/frontend checks.
- [x] Review final diff, dependency advisories and release instructions.
- [x] Commit and push the preparation branch, then merge and push main.
- [x] Rerun isolated PostgreSQL, frontend and browser checks on merged main.

## Verification baseline

Before these changes: 538 PostgreSQL API tests and 288 frontend tests passed;
lint/build, migration drift and dependency compatibility passed. Security
advisories were found in backend pins and frontend lockfile. These results do
not validate the updated versions or hosted runtime.

## Active checkpoint

Current login blocker, 30 October: owner changed the canonical Vercel domain to
https://skillbridge-ic.vercel.app. Google popup reports origin_mismatch. The live
API responds 200 to health but omits CORS allowance for that new Origin. Next:
owner adds the new JavaScript origin to the existing Google OAuth client and
updates/deploys Railway FRONTEND_URL to the new origin, then retries sign-in.
See the [configuration checkpoint](RAILWAY_CONFIGURATION_MIGRATION.md).

Latest owner update, 30 October: native dashboard deployment
`c8706027-8dda-410c-a979-9eda296d3798` is Active. Screenshots confirm actual image
build/static collection, no pending migrations, two Gunicorn gevent workers on
8080 and passed healthcheck. Independent public GETs confirm /api/health/ 200
with status ok, exact Vercel CORS/no-store, anonymous /api/auth/me/ 401 and Vercel
homepage 200. Next: real hosted owner login/dashboard, remaining provider/storage
and load checks, then separate email worker/delivery setup. No live mail or
authenticated production workflow has been tested by the agent. The earlier
local-preparation/CLI notes below are historical, not a pending deployment.

30 October follow-up: local migration preparation is on
`codex/railway-configuration-migration`. Official CLI 5.71.0 reports that owner
login is required. The [configuration migration guide](RAILWAY_CONFIGURATION_MIGRATION.md)
supersedes the legacy TOML activation instructions below. The owner reports they
have resubscribed, but have not completed CLI login or started a new deployment.
No Railway cutover or apply has occurred. Later owner screenshots confirm the
expected source/root/branch, blank custom commands/healthcheck and no selected
custom config path. Current next step is native dashboard configuration, starting
with the build command; CLI login/import is optional for an IaC migration.

Git publication and post-merge local verification are complete. Preparation
commit `a55c664` was pushed to `codex/redeployment-preparation`; merge `2b0c435`
was pushed to `main` without force. All post-merge checks below passed against
that published application tree. This verification record is a later docs-only
update; it does not alter the tested application files.

The earlier next step was owner reactivation; the owner now reports that complete.
Next, review the service configuration and pending migrations/backups, then
verify the first Linux build and hosted
health/login behavior. Keep the saved webhook disabled and inspect the email
queue before enabling delivery processing. Local tests do not complete these
remaining hosted release gates.

## Changes

- Updated affected Python pins, UTF-8 requirements and the local runtime lock;
  production explicitly includes the selected Medium model with its SHA-256.
- Updated Axios, React Router, Vite and vulnerable transitive frontend packages;
  SheetJS 0.20.3 comes from its official distribution URL, with lockfile integrity.
- Bound the existing Google access-token flow to the configured client and exact
  DNSC Workspace domain. Account, role, approval and enrollment gates remain.
- Added WhiteNoise static serving, explicit database TLS defaults/options, exact
  configurable CORS origins, and a bounded unthrottled internal readiness probe.
- Added a Gunicorn post-fork psycogreen hook, verified with actual PostgreSQL IO
  yielding to other greenlets in an isolated subprocess.
- Added root Railway web/worker config files and a hosted Python pin. Web migration
  runs in bounded pre-deploy, while static assets/model installation run at build.
- Added image-context exclusions; retained all source tests, migrations and research.

## Completed checks

- **547 PostgreSQL API tests passed, zero skips**, including nine new deployment/
  authentication regressions. Evidence: `work/redeployment-postgres-wce7rnl7/tests.txt`.
- **288 frontend tests passed** after final dependency updates; lint and build pass.
- **12 production-build mocked-provider sign-in browser outcomes passed**, zero
  page errors. Includes Google outage, pending/inactive/domain/role outcomes and
  password admin login. Browser evidence is under ignored
  `skillbridge-frontend/tests/artifacts/auth-contract/results.json`.
- Npm reports **zero advisories**, including development dependencies.
- All **73 Python runtime lock pins** match the isolated installed environment.
  Public PyPI metadata reports no advisories in those 73 distributions. The
  official Medium resource is outside PyPI; its pinned SHA-256 matches the actual
  installed wheel source. Evidence: `work/redeployment-python-advisories.json`.
- Strict actual-model preprocessing uses **spacy_md**, without fallback.
- Collectstatic and both original/hashed Django admin CSS through WhiteNoise return
  200. Assets were generated only under ignored `work/redeployment-static/`.
- Django deploy check has only optional HSTS-preload warning; migration drift and
  pip check pass. No new application migration is required for this preparation.
- Both Railway TOML files validate against Railway's current Draft 2020-12 schema.
- Changed Markdown links and git diff whitespace checks pass; no tracked deletions.
- Disposable PostgreSQL and task-owned preview process shut down. Original backend
  venv and populated .env files were preserved.

The first disposable install failed on a Windows metadata write and is not a
successful-install result. The fresh `work/redeployment-runtime/` installed cleanly.
The initial browser run expected the old outage text; the corrected 12-case run
passes. The initial schema checker supported an older JSON Schema draft; an
isolated Draft 2020-12 validator confirmed both final configurations.
Unit/API tests warn when no collected backend static directory exists; production
collection and actual WhiteNoise serving were separately verified successfully.

## Verification after publishing merged main

The owner requested another run after merging and pushing. On application merge
`2b0c435`, whose application tree matches the preparation branch:

- **547 PostgreSQL API tests passed, zero skips, in 314.031 seconds**. Fresh local
  cluster, synthetic credentials and disabled normal dotenv loading. Evidence:
  `work/redeployment-postgres-vmz1i2ly/tests.txt`.
- **288 frontend tests passed**, zero skips; ESLint and Vite production build
  passed. Logs: `work/postmerge-frontend-tests.txt`,
  `work/postmerge-frontend-lint.txt`, `work/postmerge-frontend-build.txt`.
- **12 production-build sign-in browser outcomes passed**, zero page errors,
  with mocked providers/APIs. Evidence:
  `skillbridge-frontend/tests/artifacts/auth-contract/results.json`.
- Django deploy checks passed with only optional HSTS-preload warning;
  makemigrations reported no changes and pip check reported no broken requirements.
  All 74 applicable lock entries, including pip tooling, match the environment.
- Both Railway TOML schemas passed; 110 local links in the changed knowledge files
  resolved. Original and hashed admin CSS returned 200 through WhiteNoise using
  `work/postmerge-static/`. Strict preprocessing used `spacy_md` without fallback.
- The task-owned preview and disposable database were stopped after verification.

These remain Windows/local results. No successful Vercel deployment, Railway
Linux build, real Google login, hosted migration or live email delivery is claimed.

## Remaining hosted release gates

1. Set backend **GOOGLE_OAUTH_CLIENT_ID** to the same public web client ID as
   Vercel VITE_GOOGLE_CLIENT_ID; it is not a client secret. Missing configuration
   intentionally denies Google login. Preserve all existing private credentials.
2. Confirm DEBUG=False, exact hosts including healthcheck.railway.app, frontend
   origin and database TLS settings. Verify the actual proxy chain before setting
   TRUSTED_PROXY_COUNT. The default cache remains process-local; strict shared
   rate limits and real traffic capacity are not established by these tests.
3. Verify web root /skillbridge-backend and config path /railway.toml. Review actual
   pending migrations through 0029, database/storage backups and recovery. Pushing
   main can auto-deploy; an image rollback does not reconstruct removed schema/data.
4. Build the actual Linux image with Python 3.13.15 and test Gunicorn lifecycle,
   memory, concurrent submissions, SSE/proxy behavior and database connections.
   Local tests ran Windows Python 3.13.7; no Docker/WSL runtime was available.
5. Provision a separate email worker using /railway-email-worker.toml or a bounded
   separate cron service. Inspect the saved queue first; starting it can send mail.
   Deploy the staged webhook secret, then enable the saved Brevo webhook and run
   an owner-controlled real delivery test. The webhook is currently disabled.
6. Verify actual Google login, private evidence bucket, branding storage, exports,
   live migration state and frontend/backend origins on the hosted deployment.

The [release handoff](RELEASE_AND_RECOVERY_HANDOFF.md) contains the owner-run
configuration and recovery sequence. Live credentials and real student records
were not copied into this document or fixtures.
