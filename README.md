# SkillBridge

**An assessment-based On-the-Job Training placement decision support system for Davao del Norte State College (DNSC).**

SkillBridge connects student competency evidence with the requirements of OJT partner positions. Students complete assessments, instructors and OJT coordinators manage program-specific preparation and placement reviews, and administrators maintain institutional access and shared catalogs. Ranked recommendations help coordinators make placement decisions while preserving the evidence behind those decisions.

The system covers assessment, recommendation, placement decisions, and recommendation-cycle history. It does not track internship attendance, training hours, or OJT completion.

## Contents

- [Key capabilities](#key-capabilities)
- [User roles and access](#user-roles-and-access)
- [Technology and architecture](#technology-and-architecture)
- [Repository structure](#repository-structure)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Assessment and recommendation workflow](#assessment-and-recommendation-workflow)
- [Verification](#verification)
- [Deployment and operations](#deployment-and-operations)
- [Documentation](#documentation)
- [Development conventions](#development-conventions)
- [Licensing and acknowledgments](#licensing-and-acknowledgments)

## Key capabilities

- **Institution and program management:** Configurable institutes, programs, instructor assignments, institute-shared skill definitions, and versioned program competency frameworks.
- **Batch enrollment:** Program-specific batches, reviewed enrollment imports, student profile confirmation, and retained enrollment history. Existing institute-shared batches preserve their full mixed-program rosters.
- **Assessment management:** Manual authoring, scheduling, publication, duplication, archiving, required-completion settings, and multiple-choice, true/false, and identification questions.
- **Questionnaire exchange:** AIKEN and SkillBridge text import/export, plus Excel/CSV import with previews, answer-key review, and category mapping.
- **Assessment integrity and recovery:** Server-validated submissions, timed attempts, interruption handling, reviewed retake requests, and retained attempt history.
- **Competency results:** Individual assessment scores and batch-level combined category evidence, with separate completion and freshness gates.
- **Partner and position catalogs:** Program eligibility, competency requirements, available slots, partner locations, and scoped coordinator catalog management.
- **Placement decision support:** Assessment-led position rankings, provisional suggestions, coordinator approval or rejection, manual assignment, shared-capacity checks, and saved decision evidence.
- **Reports and analytics:** Scoped assessment, competency, placement, and capacity views; geographic placement views; and CSV/PDF reports, with spreadsheet exports in placement reporting.
- **Notifications and data freshness:** Recipient-scoped live updates and a durable email outbox for account and enrollment notices when delivery services are configured.

## User roles and access

| Role | Sign-in | Main responsibilities |
| --- | --- | --- |
| Student | Verified DNSC Google account | Complete profile setup, take assigned assessments, review results and recommendations, request retakes, and view previous batch records. Access requires the applicable approval and enrollment checks. |
| Instructor / OJT coordinator | Verified DNSC Google account and approved active account | Manage owned batches within assigned programs, enroll students, maintain permitted competency definitions and catalog entries, author assessments, review retakes, and make placement decisions. |
| Administrator | Individual email and password | Manage institutes, programs, accounts, instructor grants, shared catalogs, assessments, batches, reports, and recommendation maintenance across the system. |

Authorization is enforced by the Django API. Program grants, batch ownership, enrollment, account state, and record eligibility determine access; frontend navigation reflects those rules. Shared catalog visibility does not itself grant placement eligibility.

## Technology and architecture

| Layer | Implementation |
| --- | --- |
| Web client | React 19, React Router 7, Vite 8, Tailwind CSS 4 |
| Client data and UI | Axios, React Aria Components, TanStack Table, Recharts |
| Reports and files | jsPDF, jsPDF AutoTable, SheetJS |
| API | Django 6, Django REST Framework, Simple JWT |
| Database | PostgreSQL, managed through Django models and migrations |
| Matching and text processing | NumPy, scikit-learn TF-IDF/cosine similarity, selectable spaCy or Stanza preprocessing, deterministic regex fallback |
| Live updates | Django Server-Sent Events (SSE), recipient-scoped invalidation events, and visible-page revalidation |
| Optional integrations | Google OAuth, Supabase Storage, Brevo email delivery, and a separately gated Supabase Realtime pilot |
| Hosting configuration | Vercel for the frontend; Railway/Railpack with Gunicorn, gevent, and WhiteNoise for the backend |

The React client calls the Django REST API through a shared Axios client. Django owns authentication, authorization, grading, recommendation generation, placement validation, and persistence. PostgreSQL stores business records, evidence, audit events, and queued email notices. External providers support specific features; application authentication uses Django JWTs.

Frontend queries reuse cached data and reconcile it with the API through SSE invalidations and periodic visible-page refreshes. Generated reports and model comparisons remain explicit snapshots. The optional Realtime pilot is disabled by default and is separate from the normal SSE transport.

Exact dependency versions are recorded in the frontend [manifest](skillbridge-frontend/package.json) and [lockfile](skillbridge-frontend/package-lock.json), backend [base requirements](skillbridge-backend/requirements.txt), and [local runtime lock](skillbridge-backend/requirements-local.lock.txt).

## Repository structure

```text
SkillBridge/
├── skillbridge-frontend/
│   ├── src/
│   │   ├── api/              # HTTP client, session renewal, cache, live updates
│   │   ├── components/       # Shared and role-specific interface components
│   │   ├── context/          # Session and notification providers
│   │   ├── hooks/            # Data access and workflow hooks
│   │   ├── pages/            # Student, instructor, administrator, and shared pages
│   │   ├── router/           # Role-aware client routing
│   │   └── utils/            # Imports, exports, formatting, and domain helpers
│   ├── public/               # Static images, map assets, and vendor resources
│   ├── tests/                # Browser fixtures and workflow checks
│   └── vercel.json           # SPA rewrites and hosting headers
├── skillbridge-backend/
│   ├── api/
│   │   ├── management/       # Email worker and maintenance commands
│   │   ├── migrations/       # Versioned database schema changes
│   │   ├── models.py         # Domain models and database constraints
│   │   ├── urls.py           # API route definitions
│   │   ├── scoring.py        # Assessment grading and ranking integration
│   │   └── test_*.py         # API, integrity, scope, and regression tests
│   ├── core/                 # Django configuration and isolated test settings
│   ├── scripts/              # Data preparation and verification utilities
│   └── manage.py
├── knowledge/                # Current technical contracts and operating guides
├── refs/                     # Architecture, database, and capstone references
├── outputs/                  # Research, evaluation, and review artifacts
├── .agents/skills/           # Project-specific development and review workflows
├── AGENTS.md                 # Repository working conventions
├── railway.toml              # Backend web-service configuration
└── railway-email-worker.toml # Separate email-worker configuration
```

## Local development

The following commands use **PowerShell** and start from the repository root. The backend and frontend run in separate terminals. See [local setup and operations](knowledge/LOCAL_SETUP_AND_OPERATIONS.md) for detailed recovery guidance and environment-specific notes.

### 1. Install prerequisites

- Git.
- Python **3.13** and pip. The checked-in hosted runtime selection is in [`.python-version`](skillbridge-backend/.python-version); the local lock targets Windows Python 3.13.
- Node.js **24** and npm, matching the documented local reference runtime.
- PostgreSQL server and command-line tools. The documented local reference uses PostgreSQL **17**.
- A Google OAuth web client registered for your local frontend origin if you need student or instructor sign-in.

Use a dedicated local development database. Existing student records and hosted databases are not development or test fixtures.

### 2. Create a local database

With a local PostgreSQL administrator account:

```powershell
createuser -U postgres --pwprompt --createdb skillbridge_local
createdb -U postgres -O skillbridge_local skillbridge_local
```

Enter a new local password when prompted. The role's `CREATEDB` permission supports disposable Django test databases; it is a local development convenience.

### 3. Configure and start the backend

```powershell
cd skillbridge-backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements-local.lock.txt
.\venv\Scripts\python.exe -m pip check

# Create the environment file only if one does not already exist.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit the new `.env` before proceeding:

- Replace `SECRET_KEY` with a newly generated private value. You can generate one locally with `python -c "import secrets; print(secrets.token_urlsafe(50))"`.
- Set `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for the database created above; use `DB_HOST=127.0.0.1` and `DB_PORT=5432`.
- Keep `DEBUG=True`, `ALLOWED_HOSTS=localhost,127.0.0.1`, and `FRONTEND_URL=http://localhost:5173` for this local setup.
- Set `GOOGLE_OAUTH_CLIENT_ID` if testing real Google sign-in.
- Keep external email credentials blank and `ENROLLMENT_SMTP_FALLBACK=False` for synthetic local work.

After confirming that the configuration points to the dedicated local database:

```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py createsuperuser --email local-admin@example.invalid --name "Local Admin" --role admin
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Choose a new administrator password interactively. No default credentials are provided. The local lock includes spaCy Medium and its English model; installation downloads the model rather than downloading it during a request. A smaller base installation can use `requirements.txt`, with optional preprocessing packages described under [configuration](#configuration).

### 4. Configure and start the frontend

In a second terminal, from the repository root:

```powershell
cd skillbridge-frontend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run dev -- --host localhost --port 5173 --strictPort
```

The frontend `.env` should contain:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=
VITE_SUPABASE_REALTIME_PILOT=false
```

`VITE_API_URL` is the API server origin, without an `/api` suffix. For Google sign-in, use the same public web client ID in frontend `VITE_GOOGLE_CLIENT_ID` and backend `GOOGLE_OAUTH_CLIENT_ID`, and register `http://localhost:5173` as an authorized JavaScript origin. Restart Vite after changing its environment values.

Open [the local application](http://localhost:5173). The application administrator sign-in is at [http://localhost:5173/admin/login](http://localhost:5173/admin/login). The backend readiness probe is [http://127.0.0.1:8000/api/health/](http://127.0.0.1:8000/api/health/) and checks database connectivity.

An empty local database has no enrolled students or approved instructors. Use the administrator workflows to configure institutes and programs, add or approve instructors, assign program access, and prepare batches and enrollments. Student and instructor sign-in requires verified `@dnsc.edu.ph` Google identities; creating a local password does not bypass that requirement.

## Configuration

Safe templates are provided in [backend `.env.example`](skillbridge-backend/.env.example) and [frontend `.env.example`](skillbridge-frontend/.env.example). Preserve existing environment files and keep populated files out of version control. Every `VITE_*` value is browser-visible; database passwords, service keys, and signing secrets belong only in backend configuration.

| Area | Variables / files | Purpose |
| --- | --- | --- |
| Django runtime | `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` | Private application key, development mode, and accepted hosts. |
| PostgreSQL | `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Application database connection. `DB_CONNECT_TIMEOUT`, `DB_SSLMODE`, and `DB_SSLROOTCERT` control connection behavior and TLS. |
| Origins | `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` | Exact frontend origins permitted to call the API. |
| Google sign-in | `GOOGLE_OAUTH_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` | Matching public OAuth web client IDs for backend verification and frontend sign-in. |
| Frontend API | `VITE_API_URL` | Backend server origin used by the shared Axios client. |
| Optional images/evidence | `SUPABASE_STORAGE_URL`, `SUPABASE_STORAGE_SERVICE_KEY`, `COMPANY_IMAGE_BUCKET`, `RETAKE_EVIDENCE_BUCKET` | Backend-managed image storage and private retake evidence. Image-free partner management works without Storage configuration. |
| Optional email delivery | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_WEBHOOK_SECRET` | Queued account/enrollment notices and authenticated delivery-event handling. See the template for SMTP and quota settings. |
| Optional Realtime pilot | `REALTIME_PILOT_*`, `SUPABASE_REALTIME_*`, `VITE_SUPABASE_REALTIME_PILOT` | Separately provisioned, restricted pilot; leave disabled for ordinary development. |

The default selected NLP preprocessor is **spaCy Medium**. `requirements-nlp-spacy.txt` installs the pinned spaCy/Medium resources; `requirements-nlp.txt` additionally installs optional Stanza, whose English resources require separate setup. Models load lazily, and unavailable optional resources use a reported deterministic fallback. Inspect requested-model, actual-model, and fallback metadata when evaluating results. NLP preprocessing supports text matching; it does not semantically grade identification answers.

See [NLP runtime verification](knowledge/NLP_RUNTIME_VERIFICATION.md), [image storage](knowledge/PROFILE_IMAGES.md), [email delivery](knowledge/ENROLLMENT_EMAIL_DELIVERY.md), and the [Realtime pilot](knowledge/SUPABASE_REALTIME_PILOT.md) for feature-specific configuration.

## Assessment and recommendation workflow

1. **Prepare the program.** Administrators configure institutional access. Authorized staff maintain competency definitions, partner openings, program eligibility, and numerical position requirements.
2. **Prepare the batch.** Staff enroll students, author or import questions, map questions to categories, and publish assessments with the appropriate timing and completion settings.
3. **Grade the assessment.** The backend validates question and answer ownership before saving. Unanswered questions contribute zero against the full categorized question set. Identification answers use exact matching after trimming and lowercasing.
4. **Combine eligible evidence.** Submitted, unflagged, included assessments contribute raw and maximum category totals. Combined percentage is `100 × sum(raw scores) / sum(maximum scores)`, rather than an average of assessment percentages. Assessment-level history remains separate.
5. **Apply completion and freshness gates.** Active enrollment/batch rules, required assessment completion, profile review, finalized evidence, and current ranking inputs govern recommendation availability. Stale recommendations can be hidden while valid competency results remain readable.
6. **Rank eligible positions.** Program-scoped matching uses the batch's recorded framework and exact category identities. Personal order prioritizes requirement coverage, then requirement-demand alignment, then supporting NLP/location similarity, with stable IDs resolving ties.
7. **Review and decide.** Coordinators review suggestions or make permitted manual assignments. Approval separately checks authorization, enrollment, eligibility, freshness, existing decisions, and capacity, then preserves decision evidence. Cycle closeout retains assessment, recommendation, and decision history.

The retained **60% category / 25% NLP / 15% location** hybrid score is a legacy/reference metric; it does not determine current assessment-led personal order. Coverage, text similarity, and recommendation rank are decision-support measures, not success probabilities. Meeting all listed numerical minimums does not guarantee suitability or automatically approve a placement.

The detailed contracts are [assessment submission integrity](knowledge/ASSESSMENT_SUBMISSION_INTEGRITY.md), [assessment-led recommendations](knowledge/ASSESSMENT_LED_RECOMMENDATIONS.md), [scoped matching inputs](knowledge/SCOPED_RECOMMENDATION_INPUTS.md), and [recommendation-cycle scope](knowledge/OJT_CYCLE_SCOPE_REVIEW.md).

## Verification

### Frontend

From `skillbridge-frontend/`:

```powershell
npm run lint
npm run build
node --test "src/**/*.test.mjs"
```

These run ESLint, create the production bundle in `dist/`, and execute the source Node tests. Browser workflow fixtures live in `tests/` and require separate Python Playwright tooling and a browser runtime. Read each fixture's configuration before running it; fixtures use different ports and synthetic API/database setups. See [local verification guidance](knowledge/LOCAL_SETUP_AND_OPERATIONS.md#isolated-verification).

### Backend: isolated checks

In a dedicated PowerShell test terminal, from `skillbridge-backend/`, prevent loading the application `.env` and use synthetic settings:

```powershell
$env:PYTHON_DOTENV_DISABLED='1'
$env:DEBUG='True'
$env:SECRET_KEY='synthetic-test-only-secret'
.\venv\Scripts\python.exe manage.py check --settings=core.test_settings
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run --settings=core.test_settings
.\venv\Scripts\python.exe manage.py test api.tests api.test_submission_integrity api.test_multiple_assessments api.test_combined_competency api.test_assessment_led --settings=core.test_settings
```

`core.test_settings` uses in-memory SQLite and local-memory email. It supports focused unit/API checks but cannot establish PostgreSQL locking, cross-process event behavior, or production-provider behavior.

### Backend: PostgreSQL regression suite

In the same isolated test terminal, configure a **disposable localhost test database** and a development role with permission to create it:

```powershell
$env:SB_TEST_DB_NAME='test_skillbridge_local'
$env:SB_TEST_DB_USER='skillbridge_local'
$env:SB_TEST_DB_HOST='127.0.0.1'
$env:SB_TEST_DB_PORT='5432'
# Supply SB_TEST_DB_PASSWORD privately in this terminal when required.
.\venv\Scripts\python.exe manage.py test api --settings=core.sse_postgres_test_settings --noinput
```

These settings use `SB_TEST_DB_*` rather than the application credentials and require a database name beginning with `test_`. Django creates and destroys the test database; never point this command at a database containing records you need to retain. Close the test terminal afterward so its synthetic settings do not affect normal development.

Local tests verify the exercised behavior. Live Google sign-in, email delivery, hosted concurrency, backup/restore, and institutional LMS interoperability require their own acceptance checks.

## Deployment and operations

The repository includes deployment configuration for:

| Service | Configuration | Behavior |
| --- | --- | --- |
| Frontend | [Vercel configuration](skillbridge-frontend/vercel.json) | Use `skillbridge-frontend` as the root, `npm ci` to install, `npm run build` to build, and `dist` as output. Includes SPA rewrites and security headers. |
| Backend web | [Railway web configuration](railway.toml) | Commands run from `skillbridge-backend`; installs production requirements, collects static files, runs migrations before deployment, and starts Gunicorn/gevent. Readiness path: `/api/health/`. |
| Email worker | [Railway worker configuration](railway-email-worker.toml) | Separate service running `python manage.py process_email_outbox`. Processes saved notices when delivery is configured. |

The [production requirements](skillbridge-backend/requirements-production.txt) constrain dependencies to the tested lock and include the selected NLP resources. The backend [Procfile](skillbridge-backend/Procfile) also contains web and worker commands. Use Django `runserver` for Windows development; the Gunicorn service configuration targets Linux hosting.

For a new hosted environment, configure production secrets, database TLS, accepted hosts, exact CORS origins, Google authorized origins, frontend API values, and the host-specific Content Security Policy in `vercel.json`. The checked-in CSP includes existing service origins and must be reviewed when domains or providers change. Production Django settings default to HTTPS redirects and required database TLS.

Review the pending migration plan and backups before a release. Starting the email worker can send queued messages; enabling an integration requires its provider configuration. Consult the [release and recovery handoff](knowledge/RELEASE_AND_RECOVERY_HANDOFF.md) and [Railway configuration guide](knowledge/RAILWAY_CONFIGURATION_MIGRATION.md) for operating procedures and dated verification records. The presence of deployment files does not establish current hosted acceptance.

## Documentation

| Resource | What it covers |
| --- | --- |
| [Project overview and documentation map](knowledge/PROJECT_OVERVIEW.md) | Architecture, current behavior, and links to the detailed knowledge base. |
| [Local setup and operations](knowledge/LOCAL_SETUP_AND_OPERATIONS.md) | Installation, isolated verification, dependency recovery, and operating notes. |
| [Multi-institute workflows](knowledge/MULTI_INSTITUTE_WORKFLOWS.md) | Administrative, coordinator, and student workflows across programs. |
| [Questionnaire import](knowledge/QUESTIONNAIRE_IMPORT.md) / [export](knowledge/QUESTIONNAIRE_EXPORT.md) | Supported formats, review steps, answer keys, and interoperability boundaries. |
| [Authentication and recovery](knowledge/AUTHENTICATION_AND_RECOVERY.md) | Sign-in methods, account gates, provider failures, and assisted recovery. |
| [Live data freshness](knowledge/LIVE_DATA_FRESHNESS.md) | Cache behavior, scoped events, reconnection, snapshots, and transport limits. |
| [Database connections](knowledge/DATABASE_CONNECTIONS.md) | Connection timeouts and local startup troubleshooting. |
| [API routes](skillbridge-backend/api/urls.py) / [domain models](skillbridge-backend/api/models.py) | Implemented endpoint definitions and persistence contracts. |
| [ERD](refs/SkillBridge_ERD.md) / [data-flow reference](refs/SkillBridge_DataFlowDiagram.md) | Database and process design background. |
| [Development and acceptance checklist](outputs/defense-review/SkillBridge_Continuous_Development.md) | Recorded development status, acceptance gates, and handoff context. |
| [Agent instructions](AGENTS.md) | Repository conventions, task scope, and verification expectations. |

Feature guides and trackers include dated decisions and verification receipts. Use current code and tests to resolve differences with older architecture notes, research proposals, or historical status reports. Research and evaluation artifacts do not by themselves establish production behavior or independently validated placement effectiveness.

## Development conventions

- Keep changes focused and follow nearby frontend/backend patterns.
- Use the shared Axios client and existing Tailwind v4/Vite setup.
- Enforce role, program, and ownership boundaries in the backend.
- Keep assessment scores, combined competency evidence, and placement snapshots distinct.
- Use synthetic fixtures or dedicated test databases. Keep credentials, personal student records, and downloaded answer keys out of commits and logs.
- Update the relevant feature documentation when behavior changes, run checks appropriate to the change, and report any unverified behavior.
- Preserve the attribution and licenses of bundled third-party assets and development skills.

## Licensing and acknowledgments

This repository does not currently include a project-wide `LICENSE` file. Third-party packages, bundled assets, and external development skills retain their respective licenses and attribution. See [skill sources](knowledge/SKILL_SOURCES.md), the [map boundary notice](skillbridge-frontend/public/maps/BOUNDARY_LICENSE.txt), and the [Leaflet.heat notice](skillbridge-frontend/public/vendor/LEAFLET_HEAT_LICENSE) for included acknowledgments.
