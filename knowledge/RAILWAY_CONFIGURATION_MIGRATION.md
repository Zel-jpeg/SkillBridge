# Railway configuration migration

Prepared 30 October 2026 on `codex/railway-configuration-migration`.
Status: the owner reactivated Railway and deployed using native dashboard
settings. The deployment is Active. CLI authentication, IaC import/cutover/plan
and apply have not happened. Existing TOML files are preserved.

## Hosted result — 30 October

Owner screenshots show deployment `c8706027-8dda-410c-a979-9eda296d3798` Active
after building the image, installing requirements-production.txt, collecting
157 static files (453 post-processed), running pre-deploy with no migrations to
apply, starting Gunicorn 25.3.0 on port 8080 with two gevent workers, and passing
the /api/health/ check. The preceding deployment title matched the published main
update, Merge database performance improvements; the actual Git SHA is not shown
in these screenshots. The deployment ID is not a Git commit hash.

Independent read-only public checks returned health HTTP 200 with status ok,
no-store, and the exact Vercel Access-Control-Allow-Origin; anonymous /api/auth/me/
returned 401; the Vercel homepage returned 200. Evidence is
`work/hosted-readiness-2026-10-30.json`. No authenticated session, private record,
provider mail or production mutation was used for these checks.

The owner then reported a frontend domain change to
https://skillbridge-ic.vercel.app, with the old Vercel domain redirecting to it.
Google's popup shows error 400 origin_mismatch. This occurs before the backend
login call. A read-only GET with the new Origin returned health 200 but no
Access-Control-Allow-Origin, confirming the new frontend is not yet permitted
by the deployed CORS settings.

Current next step: add the new exact origin to the existing Google OAuth web
client's Authorized JavaScript origins (the client referenced by Vercel's
VITE_GOOGLE_CLIENT_ID), then change Railway FRONTEND_URL to the new HTTPS origin
and deploy the variable change. Keep the existing OAuth client identity aligned
with backend GOOGLE_OAUTH_CLIENT_ID; no new OAuth client is needed. Retest real
login after these configuration updates. No Google/Railway values were edited by
the agent. Provider/model/storage, load, proxy/rate-limit and worker/delivery
verification remain.

## Current dashboard route — screenshot review

### Localhost sign-in follow-up

The owner later reported localhost sign-in failure. Safe local inspection
confirmed the frontend points to http://127.0.0.1:8000 with a configured public
Google client ID; backend DEBUG=True and localhost CORS were already configured,
but backend GOOGLE_OAUTH_CLIENT_ID was absent and no process listened on 8000.
The agent added only the matching public client ID to the ignored backend .env,
without printing its value or changing existing credentials. Settings import
confirmed it is configured. No tracked application change was needed.

The local backend was started with the verified work/redeployment-runtime Python
using manage.py runserver 127.0.0.1:8000 --noreload. Task-owned exec session 56891
was subsequently stopped for the owner's own terminal; output is in ignored
work/localhost-backend-2026-10-30.log. GET /api/health/ returned 200/status ok with
Access-Control-Allow-Origin http://localhost:5173. No migration, mail worker or
authenticated production mutation was run. Real local Google login remains for
the owner to retry; exact Google origin registration is not verified here.

The owner then ran Django using the original skillbridge-backend/venv and hit
ModuleNotFoundError for WhiteNoise. That environment had not received the
redeployment dependencies. The agent synchronized it to requirements-local.lock.txt.
Its existing optional Stanza stack exposed two compatibility conflicts; minimal
compatible local updates were torch 2.13.0, huggingface-hub 1.22.0 and its hf-xet
1.7.1 dependency. These optional packages are not added to Railway requirements.

Final checks in the owner's original venv: pip check clean; all 74 applicable
application/model lock entries matched; Django system and WSGI middleware startup
passed; five Google binding regressions passed without a database/provider call;
Torch/Stanza/Hugging Face imports and a synthetic Torch tensor calculation passed;
strict spaCy Medium preprocessing passed without fallback. Installation evidence:
work/local-venv-sync-2026-10-30.txt and work/local-optional-sync-2026-10-30.txt.
Only the two verified work-runtime runserver processes were stopped (child 6024
and its launcher, which exited); user-owned original-venv processes were left
alone. Next: owner Ctrl+C/restarts their terminal with python manage.py runserver
and retries localhost login. No migration or hosted action was performed.

The owner prefers reviewing dashboard screenshots before using the CLI. Fresh
screenshots confirm Zel-jpeg/SkillBridge, main, /skillbridge-backend, Railpack
Python 3.13.15, existing public hostname targeting port 8080, one replica,
serverless off and restart On Failure with ten retries. Custom build/start,
pre-deploy and healthcheck fields are empty. The Config-as-code section shows
Add File Path rather than a selected custom path. That alone does not prove
whether a default repository TOML was previously auto-detected.

For the immediate release, the reviewed build/start/pre-deploy/healthcheck values
can be entered directly in the native service settings. This route does not
require CLI login. Keep the legacy config path blank; do not opt into it.
Stage all intended settings before starting a deployment. Verify their effective
values/source in deployment details because legacy files can override dashboard
values for a service that already uses them. Repo-file retirement or a supported
IaC cutover remains a separate reviewed step if legacy overrides are present.

The owner subsequently staged the build/start/pre-deploy commands, healthcheck
path and timeouts; reported DEBUG=False and was instructed to append the
healthcheck host to ALLOWED_HOSTS. Their deployment is now Active and its health
check passed. The CLI workflow below remains an optional supported-IaC migration;
it was not needed for this dashboard deployment.

## Purpose and scope

Replace reliance on deprecated Config as Code with Railway's supported
Infrastructure as Code for the existing SkillBridge backend. Current official
documentation limits legacy TOML support to 1 December 2026 and excludes new
services from opting in. That is a configuration-format cutoff, not service
expiration. See [Railway's migration guide](https://docs.railway.com/infrastructure-as-code#migrating-from-config-as-code).

The web service must be imported by its existing identity. Do not create a new
project, replace the public hostname, provision a database, import Vercel into
Railway or start the email worker as part of the web configuration migration.
The existing database and Storage stay on Supabase. Keep Railway variables
managed in its dashboard; do not export their values into source or chat.

## Preparation completed

- Checked current project overview, deployment files and the official guide.
- Installed official CLI 5.71.0 and SDK 3.16.0 under ignored
  `work/railway-migration-tools/`; no global or application dependency change.
- Verified CLI help for login, link, pull, migrate, cutover, status, plan and apply.
- Checked authentication: the CLI reports Unauthorized and requires owner login.
- Confirmed the intended project/service identity from the owner's screenshots:
  project `SkillBridge`, environment `production`, existing service `SkillBridge`.
  Confirm these in the authenticated import before applying anything.

CLI 5.71.0 help is more specific than the prose migration example in the guide:
`config migrate --apply` writes the local authoring file only. Switching the live
service away from TOML is a separate `config migrate cutover` operation. Its help
states that it saves the previous config-file paths for reversal. Do not treat
cutover as a read-only preview, and do not delete old files to force a migration.

## Optional IaC route: sign in

Open PowerShell in the repository root and use the prepared local CLI:

```powershell
$railwayCli = Join-Path (Get-Location) 'work/railway-migration-tools/node_modules/.bin/railway.cmd'
& $railwayCli login
```

Complete the browser sign-in using the Railway account that owns SkillBridge.
Do not paste a password or token into chat. Login alone does not reactivate a
subscription, deploy the app or apply the configuration migration.

## Import and inspect after sign-in

Use the existing project, production environment and web service:

```powershell
& $railwayCli link --project SkillBridge --environment production --service SkillBridge
& $railwayCli config migrate status
& $railwayCli config migrate --service SkillBridge --variables unmanaged --show
```

The first command links this checkout; the latter two inspect migration state
and preview the conversion. Keep variable values hidden and inspect output before
sharing it. If the service is not currently using TOML and migration finds nothing,
use a safe current-state import instead:

```powershell
& $railwayCli config pull --variables unmanaged
```

Do not use `--include-variables`, `--decrypt-variables`, `--show-values` or a raw
variables export. Do not use `--force` to overwrite an existing authoring file.
Inspect any `.railway/` files created and ensure actual secrets are absent.

## Expected web settings

Import live state first, then translate only the reviewed settings below. A
candidate written from screenshots alone is not safe to apply: import preserves
the existing source, variables, domain and other live service settings.

| Setting | Intended value |
| --- | --- |
| Existing service | SkillBridge |
| GitHub source | Zel-jpeg/SkillBridge, branch main |
| Root directory | /skillbridge-backend |
| Builder | RAILPACK |
| Python | Existing backend .python-version: 3.13.15 |
| Build | python -m pip install -r requirements-production.txt && python manage.py collectstatic --noinput |
| Pre-deploy | python manage.py migrate --noinput |
| Pre-deploy timeout | 300 seconds |
| Start | gunicorn core.wsgi:application --worker-class gevent --workers 2 --worker-connections 1000 --timeout 120 --bind 0.0.0.0:$PORT |
| Healthcheck | /api/health/ |
| Healthcheck timeout | 120 seconds |
| Restart | ON_FAILURE |

Keep subscription/region/replica/serverless/domain/secret settings as imported
unless an intentional change is separately reviewed. Review any newly surfaced
setting in the actual plan rather than copying a whole-project sample. A
single-service migration should retain the CLI-generated partial ownership;
do not omit other existing resources from a whole-project configuration.

If the preview correctly identifies the existing service and settings, generate
the authoring file without changing the service:

```powershell
& $railwayCli config migrate --service SkillBridge --variables unmanaged --apply
npm.cmd install --prefix .railway --save-exact railway@3.16.0
```

The SDK is tooling for configuration, separate from the frontend/backend runtime.
Commit its generated manifest/lock with the reviewed migration when publication
is authorized. Adding `.railway/railway.ts` to Git alone does not apply it to
Railway; the CLI controls evaluation and apply.

## Hosted cutover and apply — after reviewing the generated file

Before changing the live service, review the imported authoring file, pending
migrations, backup and deployment implications with the owner. Applying the web
settings may redeploy and execute the pre-deploy migration. No subscription or
provider write is authorized by this document alone.

For a service that still reads TOML, the current CLI separates switching from
applying the desired settings:

```powershell
& $railwayCli config migrate cutover --service SkillBridge
& $railwayCli config plan
```

Review the exact existing service and expected command/healthcheck changes.
There must be no unplanned resource creation/deletion, variable deletion, domain
replacement or unrelated service/storage change. Keep variable ownership unmanaged.
If the plan is wrong, stop and use `config migrate undo --help` to inspect the
reversible cutover recovery; do not apply a destructive or guessed graph.

Only after the owner approves that concrete plan:

```powershell
& $railwayCli config apply
& $railwayCli config migrate status
```

Use the interactive review; do not add `--yes` or `--confirm-destructive` to skip it.
Keep the legacy files until the service is confirmed to use the new configuration.
Archive them later if desired; this task does not delete them.

## Email and deployment verification

The existing worker TOML is a reference for settings, not a supported way to
configure a new service. After web migration/health/login verification, prepare
a separate worker in the dashboard or import/declare it in supported IaC with
the same backend root and intended variables. Its build installs
requirements-production.txt and its start command is
`python manage.py process_email_outbox`. It has no HTTP healthcheck. Queue review
and starting delivery are separate owner-controlled actions.

Confirm the next Linux build, /api/health/ HTTP 200, real Google/admin login,
storage and normal API traffic. Keep the Brevo webhook disabled until backend
and secret deployment are verified. The complete release gates remain in
[the release handoff](RELEASE_AND_RECOVERY_HANDOFF.md).

## Verification limits and next step

The final application review on main `3511906` passed 557 PostgreSQL tests,
296 frontend tests, lint/build, 12 sign-in browser cases and 11 collection browser
groups. This preparation changes documentation only; those suites need not be
repeated until application/deployment behavior changes. The migration itself
is not validated by those tests and still needs an authenticated remote plan.

Exact next step: owner tests the hosted login/dashboard, followed by the remaining
provider/storage/workflow release gates and separate email worker setup.
If choosing supported IaC instead, complete CLI login and import/preview the web
service without decrypting variables. No push or IaC cutover/apply was performed
on this branch. Subscription reactivation and dashboard deployment were
owner-performed; the agent performed only read-only hosted HTTP checks.

Additional sources:
[CLI configuration commands](https://docs.railway.com/cli/config),
[IaC authoring and preservation](https://docs.railway.com/infrastructure-as-code/reference),
[the existing preparation record](REDEPLOYMENT_PREPARATION.md).
