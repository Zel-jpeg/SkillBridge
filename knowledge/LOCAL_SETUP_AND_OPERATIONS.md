# Local setup and operations

This guide covers local development. The continuous checklist is the acceptance
tracker; installing packages does not establish signoff or authorize deployment.

## Prerequisites

The Windows reference runtime is Python **3.13.7**, Node **24.14.1**, PostgreSQL
**17.11**, Django **6.0.9**, Vite **8.3.5**, React **19.2.4**, spaCy **3.8.16** and
`en_core_web_md` **3.8.0**. `package-lock.json` resolves frontend packages.
`requirements-local.lock.txt` records the tested Python runtime, including the
selected Medium resource. Linux hosting remains a separate check.

Verify `python --version` and `node --version`. Commands below use PowerShell and
explicit venv executables, so activation/execution-policy changes are optional.
Install PostgreSQL server/client tools separately. The ignored workspace test
runtime is a development fixture, not a release dependency.

## Fresh local database and configuration

Preserve an existing `.env`. In a **fresh checkout only**, copy backend
`.env.example` to `.env`. Replace its placeholder key/password with newly generated
local values. Never commit the populated file. Generate a key privately with
`python -c "import secrets; print(secrets.token_urlsafe(50))"`; do not paste it
into reports or chat.

Create a dedicated localhost database using PostgreSQL's interactive password
prompts, for example with a local PostgreSQL administrator:

```powershell
createuser -U postgres --pwprompt --createdb skillbridge_local
createdb -U postgres -O skillbridge_local skillbridge_local
```

Set DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT to that local database.
`DEBUG=True` permits local HTTP; `FRONTEND_URL=http://localhost:5173` matches the
documented CORS origin. Keep email keys blank and SMTP fallback false for synthetic
work. Storage keys are backend-only; image-free CRUD works without them.

In a fresh frontend checkout, copy `.env.example` to `.env` and set
`VITE_API_URL=http://127.0.0.1:8000`. Real Google sign-in needs a public OAuth client
ID and registered origins. Set backend `GOOGLE_OAUTH_CLIENT_ID` to the same
public web client ID as frontend `VITE_GOOGLE_CLIENT_ID`; missing backend client
configuration denies Google sign-in with a retryable service error. Local auth tests mock Google; setup does not invent
provider configuration. Backend keys/database credentials never belong in VITE_*.

## Backend install and startup

From `skillbridge-backend/`:

```powershell
python -m venv venv
venv/Scripts/python.exe -m pip install -r requirements-local.lock.txt
venv/Scripts/python.exe -m pip check
venv/Scripts/python.exe manage.py check
```

For an existing checkout, rerun the install and compatibility commands in its
existing venv after requirements change; a Railway deployment does not update
local packages. A startup error such as `No module named 'whitenoise'` means the
interpreter running Django lacks a required package, even if the preliminary
system check passed. Use `venv/Scripts/python.exe` explicitly to avoid confusing
the normal environment with an ignored verification runtime. Dependency repair
does not require a database migration.

Alternatively install `requirements.txt`, then `requirements-nlp-spacy.txt`.
The latter pins spaCy/Medium and downloads its official compatible wheel during
installation, never during a request. Reconcile the tested lock when updating
packages. `requirements-nlp.txt` additionally installs optional Stanza; its English
resource/memory requirements need separate verification before selection. Small
spaCy is optional; unavailable resources use the explicitly reported fallback.

Before migration, verify DB_HOST is localhost and DB_NAME is your dedicated
development database. Do not use the existing Supabase database for these steps.
Initialize **only that new local database**:

```powershell
venv/Scripts/python.exe manage.py migrate
venv/Scripts/python.exe manage.py createsuperuser --email local-admin@example.invalid --name "Synthetic Local Admin" --role admin
venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

Enter a new password interactively. `createsuperuser` sets Django staff/superuser
flags; choose application role `admin` as shown. Use runserver for Windows
development; Gunicorn belongs to the later Linux hosting checks.

Admins inspect/select NLP configuration in Reports. Default selection is Medium.
Verify requested/actual/fallback metadata rather than assuming installation means
a successful model load. See [NLP runtime verification](NLP_RUNTIME_VERIFICATION.md).

## Frontend install and startup

From `skillbridge-frontend/`:

```powershell
npm ci
npm run lint
npm run build
node --test "src/**/*.test.mjs"
npm run dev -- --host localhost --port 5173 --strictPort
```

Open `http://localhost:5173` and keep both servers running. The default API is
localhost8000. Another browser origin needs matching local CORS configuration.

If the user-level npm shim fails while Node works, invoke the installed CLI
without changing global PATH, policy or npm settings:

```powershell
$taskNpmCli = Join-Path $env:ProgramFiles 'nodejs/node_modules/npm/bin/npm-cli.js'
node $taskNpmCli ci
node $taskNpmCli run lint
node $taskNpmCli run build
node $taskNpmCli run dev -- --host localhost --port 5173 --strictPort
```

Adjust only the executable location if Node is installed elsewhere. Preserve the
normal repository layout: frontend summary tests read `knowledge/fixtures/`, and
the backend import contract invokes sibling `skillbridge-frontend/` with Node.

## Isolated verification

From the backend, use synthetic environment values and disable dotenv:

```powershell
$env:PYTHON_DOTENV_DISABLED='1'
$env:DEBUG='True'
$env:SECRET_KEY='synthetic-test-only-secret'
venv/Scripts/python.exe manage.py check --settings=core.test_settings
venv/Scripts/python.exe manage.py makemigrations --check --dry-run --settings=core.test_settings
```

For locking/transport tests, provide a dedicated localhost PostgreSQL role with
CREATEDB and a disposable name beginning with `test_`. Supply its password privately
in SB_TEST_DB_PASSWORD if needed. Django creates/destroys this test database;
never substitute normal application credentials:

```powershell
$env:SB_TEST_DB_NAME='test_skillbridge_local'
$env:SB_TEST_DB_USER='skillbridge_local'
$env:SB_TEST_DB_HOST='127.0.0.1'
$env:SB_TEST_DB_PORT='5432'
venv/Scripts/python.exe manage.py test api --settings=core.sse_postgres_test_settings --noinput
```

These settings reject other database-name prefixes and disable dotenv. SQLite
cannot prove PostgreSQL row locks or cross-process events. Test settings are not
a production configuration.

Browser fixtures in `skillbridge-frontend/tests/` need Python Playwright (reference
version **1.64.0**) and installed Google Chrome (`channel='chrome'`). Keep this
tooling in a development/test environment. Package installation alone does not
install a browser. Read each script's ports/options: newer fixtures use 5178/8018;
older ones may use 5174/8017 or 5179/8019. Match Vite's local API URL. Fixture servers
use synthetic databases and mocked email, never a normal application database.

## User and operator guidance

- Admins use individual passwords; students/instructors use DNSC Google with
  approval/enrollment/active gates. Follow
  [authentication and recovery](AUTHENTICATION_AND_RECOVERY.md) for assisted admin
  recovery. No self-service reset-email service is selected.
- Instructors manage their batches and supported Excel/text imports. Publication
  requires valid classified questions/keys; attempts prevent question changes.
  Individual scores, required completion and final competency are separate.
  The current questionnaire format is accepted as final for this release; later
  official-file comparison is a follow-up. Existing official IAMS is verified
  and preserved; see [accepted question format](QUESTION_IMPORT_FORMAT.md).
- Students retain answers through transient renewal and check current records
  before retrying uncertain writes. Submission has a 30-second grace, then requires
  instructor review. Profile result-notification emails are unavailable.
- Staff approvals require current evidence/capacity. Recommendation similarity is
  not an approval or success probability. Reports use Philippine dates and saved
  assignment scores. See [report reconciliation](REPORT_RECONCILIATION.md).
- Restart after model/package/configuration changes. Check actual-model metadata
  and use explicit map/photo retry guidance; provider failures do not erase saved
  records. Never treat a fallback as a successful selected-model load.
- `manage.py prune_change_events` removes invalidation metadata older than one
  day, not business records. Run only against the intended authorized database.
  Reconnect resynchronizes data. Before authorized storage cleanup, verify object
  ownership and absence of database references; do not bulk-delete objects.
- Review/test migrations locally before an authorized release. The current chain
  ends at 0029; check the actual pending plan and preserve backups. Hosting, backups/restore/rollback, health and live-provider
  checks remain later checklist gates.

## Verification record

V11 in the continuous checklist records clean install/check/model results and
`work/defense_audit/v11-*` evidence. The ignored clean source/dependency folders
contain no copied `.env` or real database. They are verification fixtures, not a
release package. Failed or omitted checks are not passing evidence.

Verified on 18 October 2026: clean npm install (228 packages), clean Python base
and selected NLP installs, pip dependency check, Django check, no migration drift,
and full **259/259 PostgreSQL tests** passed from copied source with no .env.
The first copied-layout run omitted the expected sibling frontend name; fixing
that fixture path restored the actual cross-language import test. A missing shared
knowledge fixture in an initial frontend copy was likewise corrected, not skipped.
Clean frontend: **114/114 tests**, lint **zero errors/warnings**, build passed.
The real Medium load reported requested=actual=spacy_md, no fallback (9.066s for
startup plus one text; not a formal performance acceptance measurement).
Documented admin bootstrap/password sign-in and old-event pruning were exercised
on migrated in-memory synthetic data. Source browser regressions passed six grouped
map/profile/draft cases with zero page errors.

Evidence: `v11-npm-ci.txt`, `v11-pip-{base,nlp,check}.txt`,
`v11-clean-{check,migrations,postgres-final,model,bootstrap-final}.txt`,
`v11-clean-{lint-final,build-final,unit-final2}.txt`, `v11-map-browser.txt` and
`v11-profile-browser.txt` under `work/defense_audit/`. Initial failed fixture logs
remain. Dependency installs used public package/model sources; no global npm
settings or existing application .env files were modified.

## 29 October redeployment preparation

See [the preparation tracker](REDEPLOYMENT_PREPARATION.md) for the updated package
and deployment checks. The verification runtime is isolated under ignored
`work/redeployment-runtime/`; the original backend venv was preserved. Install
`requirements-production.txt` to reproduce the selected dependency/model set.
The production manifest constrains the dependencies to the tested local lock;
Linux/Gunicorn and hosted Python 3.13.15 remain release checks. The temporary
first installation attempt under `work/redeployment-venv/` failed on a Windows
metadata write and is not verification evidence.

Production database connections require TLS by default. Local DEBUG=True uses
libpq's prefer mode; configure DB_SSLMODE/DB_SSLROOTCERT according to provider
policy. Static-file collection and WhiteNoise serving are now explicit. Tests,
migrations and research artifacts were retained; the backend .dockerignore
excludes development-only files from the image context.
