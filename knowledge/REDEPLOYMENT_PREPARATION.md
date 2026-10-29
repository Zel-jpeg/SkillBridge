# Railway and Vercel redeployment preparation

Date: 29 October 2026. Branch: `codex/redeployment-preparation`.

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
- [ ] Commit and push the preparation branch, then merge and push main.
- [ ] Rerun isolated PostgreSQL, frontend and browser checks on merged main.

## Verification baseline

Before these changes: 538 PostgreSQL API tests and 288 frontend tests passed;
lint/build, migration drift and dependency compatibility passed. Security
advisories were found in backend pins and frontend lockfile. These results do
not validate the updated versions or hosted runtime.

## Active checkpoint

Local implementation and branch verification are complete. The owner has now
explicitly authorized Git publication and post-merge verification. Publication
is in progress from `codex/redeployment-preparation`, based on `e779283`.

Exact next step: commit/push this branch, merge/push main without force, rerun the
isolated checks, and record their actual results. Keep Railway reactivation and
the remaining hosted release gates with the owner.

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
