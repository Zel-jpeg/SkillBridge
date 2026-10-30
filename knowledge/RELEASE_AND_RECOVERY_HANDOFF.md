# Vercel and Railway release handoff

The owner authorized Git publication and post-merge local verification on
29 October 2026; Railway subscription reactivation remains with the owner.
Pushing main can trigger connected hosts' automatic deployments. Direct provider,
production database, Storage policy and live email operations remain outside this
work. The four remaining gates
are V05 hosted integration, V09 provider backup/rollback, V10 hosted recovery and
S02 final hosted acceptance. Their live criteria are not completed by local tests.

30 October hosted update: the owner deployed the web service through native
dashboard settings. The image built, migration pre-deploy reported no migrations
to apply, Gunicorn started and the Railway healthcheck passed. Independent public
HTTP checks confirmed health 200/status ok, exact Vercel CORS, anonymous account
401 and frontend homepage 200. Real login/provider/storage/load/email-worker
acceptance remains pending; see the latest
[configuration checkpoint](RAILWAY_CONFIGURATION_MIGRATION.md).

Later that morning, the owner changed the frontend domain to
https://skillbridge-ic.vercel.app and the old hostname now redirects there.
Google Authorized JavaScript origins and the deployed backend FRONTEND_URL/CORS
must be updated to that canonical origin. The observed login failure is Google's
origin_mismatch; a separate live CORS check also denied the new origin. Earlier
successful CORS evidence below applies to the old origin only.

## Release identity and existing services

Preparation commit `a55c664` on `codex/redeployment-preparation` was merged and
pushed to main as `2b0c435`, based on `e779283`. The subsequent local full backend,
frontend and browser checks passed on that published application tree.
See [the active preparation tracker](REDEPLOYMENT_PREPARATION.md) for current
checks, publication status and limits. Git publication is now owner-authorized.
Railway is connected to main with automatic deployment enabled: pushing main
after reactivation can deploy and migrate. No publication, subscription change
or production operation is independently authorized by this handoff.

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

30 October update: Railway now deprecates TOML Config as Code. The commands below
remain the intended application settings; the TOML selection instructions are
legacy references. Follow [the configuration migration](RAILWAY_CONFIGURATION_MIGRATION.md)
to import the existing web service, preserve dashboard-managed variables, preview
and review the supported replacement before hosted cutover. New workers must
use dashboard/supported IaC settings rather than opting into the worker TOML.

Railway root: `skillbridge-backend`. The repository pins hosted Python 3.13.15,
matching the owner screenshots.
Local verification uses Windows Python 3.13.7; this runtime difference still
needs a Railway build verification.
Linux/Gunicorn packaging still needs a Railway build verification; Windows tests
are not evidence that the actual Railway image has built successfully.

Install base and the selected Medium model resources during the build:

```sh
python -m pip install -r requirements-production.txt
python manage.py collectstatic --noinput
```

The selected local runtime is spaCy Medium 3.8.0 with spaCy 3.8.16. Optional Stanza
is not installed by the command above. Inspect the actual saved selected-model
configuration and results' `model_used`; a fallback is not a selected-model pass.
The application frontend remains on Vercel. WhiteNoise serves collected,
compressed manifest assets for Django admin. Collect during build, not pre-deploy,
because Railway pre-deploy filesystem changes do not persist. Requirements are
UTF-8; production includes the intended spaCy model and constrains dependencies
to the tested local lock. That lock does not certify a Linux build.

Required backend variables are private except explicitly public origins:

| Name | Purpose |
|---|---|
| `SECRET_KEY` | Existing secure application signing secret |
| `GOOGLE_OAUTH_CLIENT_ID` | Same public OAuth client ID as Vercel VITE_GOOGLE_CLIENT_ID; required for Google login |
| `DEBUG` | `False` for the hosted release |
| `ALLOWED_HOSTS` | Exact Railway hostname and `healthcheck.railway.app`, comma-separated; no scheme |
| `FRONTEND_URL` | Existing HTTPS Vercel origin |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Intended Supabase/PostgreSQL connection; confirm provider connection/TLS requirements |
| `DB_CONNECT_TIMEOUT` | Existing connection timeout per resolved address, default 5 seconds |
| `DB_SSLMODE`, `DB_SSLROOTCERT` | DEBUG=False defaults to require; prefer verify-full with provider CA when supported |
| `TRUSTED_PROXY_COUNT` | Verify the real forwarded-IP chain before changing the default zero |
| `BREVO_WEBHOOK_SECRET`, `BREVO_SENDER_EMAIL` | Saved webhook token and verified sender |
| `RETAKE_EVIDENCE_BUCKET` | Private evidence bucket, separate from branding |
| `SUPABASE_STORAGE_URL` | Public HTTPS project API origin used for branding |
| `SUPABASE_STORAGE_SERVICE_KEY` | Backend-only privileged key; never copy into frontend or documentation |
| `COMPANY_IMAGE_BUCKET` | Existing public branding bucket, default `company-branding` |
| `BREVO_API_KEY`, `EMAIL_TIMEOUT` | Configured intended email provider and bounded wait |
| `ENROLLMENT_SMTP_FALLBACK` | Keep `False` on Railway; no live test mail is authorized here |

Backend CORS includes FRONTEND_URL and optional exact origins from the
comma-separated CORS_ALLOWED_ORIGINS variable. Localhost is automatic only with
DEBUG=True. Arbitrary Vercel previews are not permitted automatically. Keep backend
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

Repository latest is `0029_recommendation_cycle_scope`. Review the actual pending
plan; it can include experimental-field/table removal in 0019 and guarded
reversals in 0028/0029. Preserve database and storage backups. An image rollback
does not reverse schema or reconstruct removed data. After the owner reviews
the migration plan and backup boundary:

```sh
python manage.py migrate --noinput
```

Repository-root railway.toml separates migrations into pre-deploy and starts
Gunicorn without migration on every restart. Keep the existing backend service
root and verify its repository-relative config path is `/railway.toml` before
publication. The preserved Procfile remains a legacy migrate-on-start fallback:

```sh
python manage.py migrate --noinput && gunicorn core.wsgi:application --worker-class gevent --workers 2 --worker-connections 1000 --timeout 120 --bind 0.0.0.0:$PORT
```

If the Railway service overrides Procfile commands, compare its actual command.
No service setting was changed here. A separate worker can select
`/railway-email-worker.toml` with the same backend root and environment. Start it
only after reviewed migrations and queue inspection: it can send queued mail.
A lower-frequency alternative is a separate cron service running
`python manage.py process_email_outbox --once --limit 100`, without an HTTP
healthcheck. Do not put an email cron schedule on the web API service.
Keep the saved webhook disabled until backend/secret deployment, then verify
an owner-controlled delivery test.

Worker/model memory, SSE buffering, idle
limits and hosted performance remain measured deployment checks, not inferred
from the local threaded listener benchmark.

## Readiness and manual recovery

`GET /api/health/` and HEAD return 200 with only `{"status":"ok"}` when a database
`SELECT 1` succeeds; database errors return 503 with only
`{"status":"unavailable"}`. Responses are `Cache-Control: no-store`. JWT identity
is intentionally ignored for this probe; normal API permission boundaries and
throttles remain. The probe itself is unthrottled and exempt from HTTPS redirects
for internal checks; business/admin routes retain HTTPS redirects. It does not
load NLP, contact providers, verify migrations or
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
as a routine code rollback. Check old-code/schema compatibility and each
pending migration individually, including removal operations and guarded reversals. If a data restore is needed, use the isolated tested
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
