# Vercel and Railway release handoff

The team owns publishing and Railway subscription reactivation. This document
prepares the tested local release; no host, subscription, production database,
Storage policy or live email was changed by the agent. The four remaining gates
are V05 hosted integration, V09 provider backup/rollback, V10 hosted recovery and
S02 final hosted acceptance. Their live criteria are not completed by local tests.

## Release identity and existing services

Current base is `227f794` plus preserved uncommitted application, tests and
documentation. The latest source manifest in the continuous checklist identifies
the verified snapshot. HEAD alone does not contain this implementation. Review
and save the intended application files as a release commit before publishing;
retain user research files and keep populated `.env`, ignored test dumps, runtime
folders and synthetic browser credentials out of the release. No commit/push was
created automatically.

Configured frontend: `https://skill-bridge-six-psi.vercel.app`.
Configured API: `https://skillbridge-production-1e3c.up.railway.app`.
These come from repository settings, not a current served-host verification.
Check that the team still uses these domains. If different, align the Vercel API
URL, backend CORS/hosts/frontend URL, Google authorized origins and exact CSP
entries before publishing. Existing local environment files were preserved.

## Owner-run frontend release

Vercel root directory: `skillbridge-frontend`; framework: Vite; install: `npm ci`;
build: `npm run build`; output: `dist`. Keep `vercel.json` in that root so its SPA
rewrite and headers apply. Required public build variables:

| Name | Value/purpose |
|---|---|
| `VITE_API_URL` | Existing HTTPS Railway API origin, without `/api` suffix |
| `VITE_GOOGLE_CLIENT_ID` | Public web OAuth client ID for the intended project |

Vite variables are embedded during build; rebuild after changing them. Never put
Django, database, email or Storage service credentials in a `VITE_` variable.
[Vercel environment guidance](https://vercel.com/docs/environment-variables)
explains build-time configuration. The local production build and exact policy
checks passed; see [browser policy](PRODUCTION_BROWSER_POLICY.md).

## Owner-run backend release

Railway root: `skillbridge-backend`. The local verified Python version is 3.13.7;
select a compatible Python runtime before installing this Django 6/spaCy stack.
Linux/Gunicorn packaging still needs a Railway build verification; Windows tests
are not evidence that the actual Railway image has built successfully.

Install base and the selected Medium model resources during the build:

```sh
pip install -r requirements.txt -r requirements-nlp-spacy.txt
python manage.py collectstatic --noinput
```

The selected local runtime is spaCy Medium 3.8.0 with spaCy 3.8.16. Optional Stanza
is not installed by the command above. Inspect the actual saved selected-model
configuration and results' `model_used`; a fallback is not a selected-model pass.
The current application static frontend is on Vercel. Django admin static files
are collected, but this repository has no production static-serving middleware;
verify any required Django-admin static serving on the actual deployment.

Required backend variables are private except explicitly public origins:

| Name | Purpose |
|---|---|
| `SECRET_KEY` | Existing secure application signing secret |
| `DEBUG` | `False` for the hosted release |
| `ALLOWED_HOSTS` | Exact Railway hostname and `healthcheck.railway.app`, comma-separated; no scheme |
| `FRONTEND_URL` | Existing HTTPS Vercel origin |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Intended Supabase/PostgreSQL connection; confirm provider connection/TLS requirements |
| `DB_CONNECT_TIMEOUT` | Existing connection timeout per resolved address, default 5 seconds |
| `SUPABASE_STORAGE_URL` | Public HTTPS project API origin used for branding |
| `SUPABASE_STORAGE_SERVICE_KEY` | Backend-only privileged key; never copy into frontend or documentation |
| `COMPANY_IMAGE_BUCKET` | Existing public branding bucket, default `company-branding` |
| `BREVO_API_KEY`, `EMAIL_TIMEOUT` | Configured intended email provider and bounded wait |
| `ENROLLMENT_SMTP_FALLBACK` | Keep `False` on Railway; no live test mail is authorized here |

Backend CORS currently explicitly lists the configured Vercel origin. Do not
assume an arbitrary Vercel preview URL is permitted. Keep the existing backend
secret/credential values in host settings; this handoff does not ask you to paste
them into chat.

Before the team activates a release that applies migrations, capture/verify the
intended database and separate branding backup. Review these commands in the
intended Railway environment, then run migration only as the owning operator:

```sh
python manage.py check --deploy
python manage.py showmigrations api
python manage.py migrate --plan
```

Repository latest is `0015_user_department`, additive after `0014_company_image_key`.
Record the actual pending plan; do not assume only 0015 is pending on a paused or
older deployment. Once the owner has reviewed the plan and backup boundary:

```sh
python manage.py migrate --noinput
```

The preserved Procfile already runs migration before starting Gunicorn:

```sh
python manage.py migrate --noinput && gunicorn core.wsgi:application --worker-class gevent --workers 2 --worker-connections 1000 --timeout 120 --bind 0.0.0.0:$PORT
```

If the Railway service overrides Procfile commands, compare its actual command.
No service setting was changed here. Worker/model memory, SSE buffering, idle
limits and hosted performance remain measured deployment checks, not inferred
from the local threaded listener benchmark.

## Readiness and manual recovery

`GET /api/health/` and HEAD return 200 with only `{"status":"ok"}` when a database
`SELECT 1` succeeds; database errors return 503 with only
`{"status":"unavailable"}`. Responses are `Cache-Control: no-store`. JWT identity
is intentionally ignored for this probe; normal API permission boundaries and
throttles remain. It does not load NLP, contact providers, verify migrations or
assert that all application workflows work.

A real local HTTP200 -> unavailable-local-port 503 -> recovered 200 rehearsal is
recorded in `work/defense_audit/v10-probe-recovery.*`. The final full 291-test PostgreSQL suite passes with no skips. Four API tests cover status,
invalid JWT, safe outage logs, HEAD and method rejection. Connection setup uses
the existing DB timeout per address; a client/monitor must still impose its own
request deadline. Do not describe it as a guaranteed global DB/network deadline.

After deployment, configure the Railway healthcheck path `/api/health/`, include
its healthcheck hostname in allowed hosts, and verify how the host forwards HTTPS
for Django's secure redirect. Do not disable HTTPS security to make a probe pass.
Railway's [healthcheck documentation](https://docs.railway.com/deployments/healthchecks)
states that this check gates deployment and is not continuous monitoring. An
operator can use a bounded read-only check after deployment or a restart:

```sh
curl --fail --max-time 8 https://skillbridge-production-1e3c.up.railway.app/api/health/
```

Recommended release recovery is option 1 discussed with the team: inspect safe
status/logs, restore database/provider connectivity, restart or redeploy the known
release, then verify health and essential role flows. The owner is the team,
including whoever controls Railway, Vercel and the database/Storage project.
This is manual recovery with platform restart, not verified automatic multi-server
failover. Confirm the accepted paper/panel wording before hosted sign-off; no
multi-server capability or paid service has been assumed or purchased.

## Backup scope and tested isolated restore

The actual provider backup schedule, retention, point-in-time recovery coverage
and branding-object version/retention are still unknown. The team must record
these from its actual plan/settings. A PostgreSQL archive contains tables and
branding keys, not Storage object bytes. Protect a separate copy/export of the
referenced branding objects and record when both copies were captured. Provider
policy/configuration and credentials also need a private operator record.

`work/defense_audit/v09_restore.py` used PostgreSQL17.11 `pg_dump --format=custom`
and `pg_restore --exit-on-error` on a synthetic source and a distinct disposable
localhost target. It did not restore over the source. All application-table row
counts/content hashes matched; known 1/2 and 1/1 category scores, finalized competency,
placement recommendation ID/snapshot and the database image key were recovered.
A separate archive restored the synthetic WebP bytes to a distinct directory and
matched their SHA256. The source remained unchanged. Local measured dump took
0.990 seconds and restore 1.938 seconds; these small synthetic timings are not
production recovery estimates. Evidence: `v09-local-restore.txt` and
`v09-artifacts/results.json` under `work/defense_audit/`.

Use provider-approved backup connection settings and tools for the actual project;
never export real records here as a demonstration. Rehearse the production
procedure only into a separately authorized isolated target. PostgreSQL's
[pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) and
[pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) documentation
describe the custom archive flow used locally. Hosted retention, Storage recovery
and actual release rollback remain unchecked V09 criteria.

## Release rollback and final checks

Record the previous Vercel deployment ID, Railway deployment ID/image, Git commit,
build variables and DB migration level before the owner publishes. If the new
release fails, restore the previous frontend/backend deployment together through
the provider controls, then check health, authentication, attempt/result reads,
capacity and exports. Do not reverse migrations or overwrite newer business data
as a routine code rollback. Check old-code/schema compatibility first; this
release's latest migration adds a field, but actual pending migrations must be
reviewed individually. If a data restore is needed, use the isolated tested
procedure and a separately approved cutover; a restore can discard newer writes.
No hosted rollback has been executed or claimed.

When the user-operated release is available, record the exact served commit and
headers and authorize a separate synthetic demo boundary. V05/S02 require real
Google origins/sign-in, API/TLS/CORS/CSP, selected model, intended email/Storage,
maps/photos, imports/downloads, SSE/reconnection, three roles and error/retry cases.
Use synthetic accounts/records only in that authorized boundary, retain report
samples, and document cleanup by exact IDs. Existing grades and placements are
not smoke-test data. The accepted 200 student/8 position workload is a local result;
repeat appropriate hosted latency/error observations before final acceptance.

The official LMS file comparison remains a later follow-up by explicit user
scope decision. The accepted final current format and official IAMS importer are
preserved. Local readiness is not hosted readiness, and 24/28 does not mean the
four live operational tasks have passed.
