# Admin management implementation checkpoint

Status: implemented and locally verified, 20 October 2026.

User instruction: on PAUSE, stop at a safe point and record changes, verification
and remaining work here. Resume only on CONTINUE. Do not deploy or change live data.

Accepted scope: full admin assessment creation/import/question editing; correct
instructor selection for admin-created batches; all-batch management, reassignment
and scoped unenrollment; consistent scopes/live refresh; durable management audit
records and regression/browser verification. Preserve scoring and integrity gates.

## Delivered workflows

- Admin navigation includes New Assessment and Batches. Admin creation reuses the
  instructor form, including manual entry, user-scoped draft recovery and
  TXT/CSV/XLSX imports. Destinations, instructor filtering and batch labels are
  role-aware. A selected batch can be carried into the creator.
- Admin Assessments retains its oversight dialog. Questions now offers Edit
  assessment and questions. Settings, question text/type/category, choices, keys,
  additions, imports and removals use the existing atomic authoring save. Attempted
  questions remain locked. Drafts survive failed saves and canceled discards.
- Imported questions are staged locally before the confirmed authoring save.
  Invalid rows show reasons while valid rows remain importable. The shared parser
  loads the installed `xlsx` dependency on demand instead of injecting a CDN
  script. Formats and supported question types are unchanged.
- Batchless drafts without attempts can be assigned to an authorized active batch.
  Moving already assigned/attempted assessments remains blocked. Entire assessment
  deletion remains unsupported.
- Batches supports search, instructor/status filters, shared card/list pagination,
  mobile cards, selected rosters, student details, reviewed enrollment, exact
  assessment retakes and explicit scoped unenrollment. Account archiving remains
  separate. Other enrollments, scores and placements are preserved.
- Admin batch creation requires an active, approved instructor. The acting user
  is recorded separately in nullable `Batch.created_by`. Instructors still create
  batches for themselves. Admins can rename, reassign, archive and reactivate them.
- Reassignment transfers batch-based access without changing assessment authorship,
  memberships or recorded results. Before/after scopes invalidate both owners'
  access after commit.
- Admins can open the shared leaderboard for unlocked combined competency in the
  selected batch. Locked/missing evidence is not ranked as zero. The shared modal
  uses DialogShell for focus, scroll locking and Escape.
- Instructor-oriented recommendation reads support authorized active `batch_id`;
  admins without it get the admin current-student view. Company candidates retain
  every authorized student/batch pair, including overlapping memberships.

Scoring formulas, ranking weights, evidence eligibility, student identity rules
and placement protections are preserved.

## API and audit contract

Existing `/api/instructor/...` management APIs remain shared with admins. Added
admin-only endpoints:

| Endpoint | Behavior |
|---|---|
| `GET /api/admin/batch-instructors/` | Active, approved instructor IDs/names |
| `PATCH /api/admin/batches/<id>/` | Validated rename/reassignment |
| `GET /api/admin/management-actions/` | Optional `batch_id`/`offset`; 50 records per page |

Admin batch creation requires integer `instructor_id`. Admin unenrollment requires
explicit `batch_id`; omission returns 400. Other roles cannot use admin endpoints.

`ManagementAction` records actor, action, target, batch, timestamp and small metadata
for batch lifecycle/ownership, enrollment confirmation/removal, assessment creation/
update, question append/update/delete and retake decisions. Audit writes share the
mutation transaction; failure rolls back the mutation. Keys, question content and
student contact information are excluded. Batch lookup and timestamp fields are
indexed. Selected batches expose action history; the API also supports all actions.

Existing creator attribution stays unknown; no historical actor is invented.
Legacy admin-owned batches are not silently repaired. Manage batch permits an
explicit correction after institutional review. Live counts were not queried.

Sources: [scopes](../skillbridge-backend/api/management_access.py),
[ownership/audit views](../skillbridge-backend/api/management_views.py),
[batch workspace](../skillbridge-frontend/src/pages/admin/AdminBatches.jsx),
[authoring dialog](../skillbridge-frontend/src/components/assessment/AssessmentAuthoringDialog.jsx).

## Migration and release boundary

[Migration 0021](../skillbridge-backend/api/migrations/0021_batch_created_by_managementaction.py)
adds batch creator attribution and management action history. It applied to
disposable SQLite and PostgreSQL databases. It has **not** been applied to the
configured application database or hosted environment. No deployment, live repair
or real notification occurred.

Before using this version, verify the intended runtime database and apply:

```powershell
# From skillbridge-backend, after verifying the intended database configuration
.\venv\Scripts\python.exe manage.py migrate
```

Release backend/frontend together after migration. Do not use synthetic servers
or test settings for the application. Runtime migration is a release step, not
unfinished application implementation.

## Verification

- Frontend lint and production build passed; **126 frontend unit tests passed**.
  Coverage includes navigation, ownership/audit invalidation and response validation.
- Broad SQLite run: 170 tests, 168 passed and two PostgreSQL transport tests skipped.
  A later focused run of 44 passed, including overlapping candidate memberships.
  These suites overlap and should not be added as unique totals.
- **45 PostgreSQL tests passed, no skips**, including admin permissions/ownership,
  both owners' notifications, audit rollback, authoring recovery, actual question/
  delivery locks, capacity races and independent-process committed event visibility.
  Evidence: `work/admin-management-postgres-nmcscb5u/tests.txt`. The cluster stopped.
- Django check passed; migration drift check reported no changes.
- **16 real browser/API groups passed**, with zero page errors or uncontrolled-input
  warnings: leaderboard, ownership, reviewed enrollment, student visibility/key
  denial, reassignment, archive/reactivation, authoring, TXT/CSV/XLSX, deletion,
  failure/retry, draft protection/assignment, attempt locks, unenrollment, audit,
  phone/tablet/desktop and dark layouts.
- **Eight existing assessment-oversight browser scenario groups passed**, covering
  filters, pagination, settings/attempts, live updates, access loss and dialogs.

Browser evidence is under the ignored
`skillbridge-frontend/tests/artifacts/admin-management/` directory: `checks.json`,
screenshots, `frontend-unit.txt`, `lint.txt` and `build.txt`. Reproduce with:

```powershell
# Repository root; requires Python Playwright, Chrome and project dependencies
python skillbridge-frontend/tests/run_admin_management.py
python skillbridge-frontend/tests/run_admin_management.py --oversight
```

The runner uses fresh disposable SQLite storage, synthetic identities, mocked email,
blocked external requests, unused IPv4 ports and server cleanup. The upstream
helper was tried first; its localhost readiness check timed out here. The custom
runner uses IPv4 readiness and shell-free processes with Windows cleanup. Local
socket checks required execution outside the host's restricted sandbox.
PostgreSQL used dedicated `SB_TEST_DB_*` values with dotenv disabled. Harness setup
errors (missing synthetic signing key and HTTPS redirects) were corrected without
weakening application HTTPS settings or assertions.

Concurrent global-toast/other-page edits appeared in this shared workspace and were
preserved. Full frontend checks ran against that shared state. No hosted acceptance
is claimed.

## Checkpoint

No implementation work remains in the accepted scope. Pending release steps:
intended-runtime migration, coordinated release and hosted acceptance. On a later
CONTINUE, inspect this checkpoint and Git status; do not replay completed changes
or implicitly modify live data.
