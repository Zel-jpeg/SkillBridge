# Assessment archives: plan and implementation

Prepared before application edits on 25 October 2026.
Branch: `codex/assessment-archives`. Whole-assessment deletion is out of scope.

## Product contract

- Dedicated `/instructor/assessments/archives` and `/admin/assessments/archives`
  pages share one collection implementation and are linked from Assessments.
- Instructors see only their managed batch assessments and their batchless drafts;
  admins see all. Backend scope checks govern reads, archive and restore.
- Archive is a reversible organization action, separate from publication and
  competency inclusion. Only Draft/Closed assessments without unfinished attempts
  can be archived. Published assessments must be explicitly closed first.
- Archived assessments are read-only, unavailable for starts/retakes, hidden from
  normal staff libraries and retained in authorized results, reports and evidence.
  Archive/restore preserve publication, requirements, inclusion, scores, answers,
  retake snapshots, combined evidence and placement snapshots. Restore does not
  publish. No scoring or ranking formula changes.
- Store archive time and actor; record archive/restore audit events. Serialize
  transitions with assessment starts/authoring using the assessment row lock.
- Instructor and admin imports append to the local authoring draft. No question
  writes occur before the confirmed atomic Save action. Parsing errors, canceled
  imports and failed saves preserve other unsaved edits.

## Ordered implementation

1. Add nullable archive metadata through the existing Django migration workflow,
   scoped archive/restore APIs, read-only write guards and additive serialization.
   Keep the existing all-assessment GET contract for historical report callers.
2. Add a shared archive action and archive page with search, batch/instructor
   filters, pagination, read-only details, restore confirmation, loading/errors,
   keyboard access and responsive light/dark layouts. Filter archived records out
   of the normal libraries without removing them from report selectors.
3. Fix instructor import staging using the admin editor's existing shared hook;
   protect parse/save/cancel recovery and avoid stale asynchronous import results.
4. Verify migration consistency, direct API authorization, archived write attempts,
   unchanged evidence/gates, active-attempt conflicts and restore behavior. Exercise
   both roles and import formats in synthetic local browser checks. Run frontend
   lint/build, focused unit tests and relevant backend regression suites.
5. Record actual results and limitations here. No production migrations,
   deployment or real-data changes are included.

## Verification status

Implemented on the branch above. The plan was saved before application edits.

### Delivered behavior

- Normal instructor/admin libraries link to Assessment archives and exclude
  archived assessments from their collections and summary totals. The shared
  historical GET still includes archives for reports and authorized history.
- Archives offer title/batch/instructor search, batch filtering, admin instructor
  filtering, ten-record pagination, visible filtered totals, distinct empty/error
  states, retry, archive time/actor and read-only details with authorized keys.
  Filter changes reset pagination and refreshed results clamp the page. Mobile
  cards place Restore below the details; themes preserve the same hierarchy.
- Archive is available from instructor assessment settings and admin oversight
  details. Unsaved edits disable archive. Both archive and restore require a
  confirmation and preserve state on failure. Successful changes update the
  shared cache and committed scoped live invalidations reconcile other views.
- Archived settings, questions, keys and retake permissions cannot be changed
  through direct APIs. Restore preserves Draft/Closed status and never publishes.
  Repeated archive/restore requests are idempotent and do not duplicate audit rows.
- Import questions now sits beside manual question additions in the instructor
  editor. Both staff editors stage imports and save metadata, updates, removals
  and additions in one transaction. Canceled/obsolete async parses cannot populate
  later panels. Failed saves preserve drafts; closing a dirty instructor editor
  requires a discard confirmation. Expanding a question does not dirty its content.
- Retake changes acquire the assessment lock before the response lock, matching
  start/authoring lock order, and recheck that the attempt is still finalized.

### Backend contract and migration

`0023_assessment_archives` adds nullable `archived_at` and `archived_by` fields and
a database constraint preventing an archived Published assessment. Existing rows
remain unarchived. No historical data is rewritten. Django owns these schema
changes; no Supabase SQL, policy or hosted configuration change is included.

| API | Behavior |
| --- | --- |
| `GET /api/instructor/assessments/` | Additive `is_archived`, `archived_at`, `archived_by_id`, `archived_by_name`, `unfinished_attempt_count`; role-scoped, includes history |
| `POST /api/instructor/assessments/<id>/archive/` | Archive Draft/Closed without unfinished attempts; Published or unfinished returns 409 |
| `POST /api/instructor/assessments/<id>/restore/` | Clear current archive metadata; keep publication unchanged |

Both mutations are transactional, use the existing management scope and audit
records, and publish invalidations only after commit. No assessment DELETE route
was added. Prior archive/restore actors remain available in ManagementAction after
current archive metadata is cleared on restore.

Closing remains an independent action with its existing completion/recommendation
effects. If an unfinished attempt remains on a Closed assessment, it must be
resolved before archive; this work does not discard or force-finalize attempts.

The subsequent [editing and timing policy](ASSESSMENT_LIFECYCLE_AND_TIMING.md)
also blocks publication changes while an unfinished attempt exists and provides
Duplicate as draft from authorized archived details. The source stays read-only;
the new optional, excluded copy contains no results or schedules. Migration 0024
is required in addition to 0023 for that subsequent timing work.

Apply migration 0023 in the intended runtime before releasing the updated backend.
During implementation the agent applied it only to disposable test databases;
no deployment or real-record changes were made. The user subsequently applied the
migration, verified in the localhost follow-up below. Hosted verification remains
a separate release step.

### Checks

- Frontend lint/build passed. The focused state, reports, response-contract,
  preparation and navigation suites passed all 35 checks.
- The initial SQLite lifecycle/authoring/admin/combined suite passed 56 tests;
  the combined suite with approved-placement preservation then passed all 12.
- Additional assessment, submission, timing, management and access regressions:
  73 tests completed successfully, with three PostgreSQL-only tests skipped.
- The final disposable PostgreSQL run passed 70 tests including actual concurrent
  archive/republish requests, duplicate archives, authoring/start locks, audit
  rollback, committed SSE transport, existing placement concurrency and stale
  retake-state rechecking after the parent lock. Evidence is under
  `work/assessment-archives-postgres-lquzknd_/tests.txt`.
- Real local API/browser suite passed 12 workflow groups across both roles with
  zero page errors. It exercises all three import formats, invalid keys, preserved
  title/question edits, failed save/retry, discard cancellation, delayed parser
  cancellation, archive/restore confirmations, failed restore/retry, authorized
  read-only keys, foreign access, pagination/filter/reset and initial-load retry.
- Existing instructor library (ten workflow groups), transactional save recovery
  (two groups), and admin oversight (eight groups) browser regressions passed.
- Screenshots cover desktop/tablet/mobile, including 320px, and light/dark themes;
  desktop admin and narrow dark instructor archives were visually inspected.
- Django system checks, migration drift check and `git diff --check` passed.

Browser evidence: ignored `skillbridge-frontend/tests/artifacts/assessment-archives/`
(`checks.json`, screenshots and synthetic workbook fixtures). Existing regression
evidence remains in its respective test artifact folders. PostgreSQL evidence is
in ignored `work/assessment-archives-postgres-*/tests.txt`.

Reproduce the archive browser suite from the repository root with an isolated
test environment (`PYTHON_DOTENV_DISABLED=1`, `DEBUG=True`, synthetic `SECRET_KEY`):

```powershell
skillbridge-backend/venv/Scripts/python.exe skillbridge-frontend/tests/run_admin_management.py --archives
skillbridge-backend/venv/Scripts/python.exe skillbridge-frontend/tests/run_admin_management.py --oversight
skillbridge-backend/venv/Scripts/python.exe skillbridge-frontend/tests/run_assessment_archives_postgres.py
```

The PostgreSQL runner requires the existing local test runtime under
`work/defense_audit/postgres-runtime/pgsql/bin`; it uses a fresh temporary cluster,
synthetic credentials and `SB_TEST_DB_*`, disables normal dotenv configuration,
and stops its server in `finally`. Browser runners likewise stop their test servers.
Local socket operations required approved execution outside the socket sandbox.

## Post-migration localhost verification — 25 October 2026

The user confirmed the intended environment is localhost, with the existing
configured Supabase PostgreSQL database. No further schema changes were performed.

- Read-only Supabase metadata queries confirmed `0023_assessment_archives` is
  recorded as applied, both nullable columns have the expected types, the archive
  actor foreign key exists, and `assessment_archive_nonpublished` is validated.
- Aggregate integrity checks found zero archived Published assessments, zero
  unfinished attempts on archived assessments, and zero actor values without an
  archive timestamp. No names, question content or personal records were logged.
- The running API at `http://127.0.0.1:8000/api/health/` returned 200/`ok`.
  Unauthenticated OPTIONS requests to the assessment list, archive and restore
  routes returned 401, confirming that those routes are loaded and protected.
- Vite at `http://localhost:5173` returned 200 and served both role-specific
  archive routes plus the staged-import implementation.
- The current ORM/view code successfully serialized the migrated database's
  assessment collection for admin and every represented instructor scope. These
  were in-process role requests inside a PostgreSQL-enforced READ ONLY transaction,
  separate from login verification. No account/token was created and no row was
  changed. This does not claim a real-user authenticated browser mutation against
  the existing database.
- The fresh disposable PostgreSQL run passed all 70 regression/concurrency tests.
  Evidence: `work/assessment-archives-postgres-xxky4f8d/tests.txt`.
- Additional local assessment/submission/timing/access/management/multiple-
  assessment regressions completed 85 tests: 82 passed and three PostgreSQL-only
  tests were skipped in SQLite. Django reported no issues or migration drift.
- Frontend lint/build and all 35 focused frontend checks passed again.
- The real disposable API/browser archive suite passed all 12 workflow groups for
  instructor and admin with zero page errors. Existing admin oversight (eight
  groups), instructor library (ten groups) and save recovery (two groups) also
  passed. The instructor runner initially hit a 10-second navigation timeout
  while other suites ran; an isolated rerun passed without application changes.
- Browser writes remained in disposable synthetic databases. The configured
  migrated database was read-only throughout this verification. Existing browser
  sessions were not accessed; local browser access is disabled in Work settings.

No new functional defects were found in this pass. No additional migration is
needed for the archive feature. The localhost runtime and migrated schema agree;
hosted deployment is outside the user's confirmed verification scope.

Additional ignored evidence is under `work/assessment_review/`:
`post-migration-readonly.json`, `post-migration-local-runtime.json`, and the
read-only verification script. Browser evidence remains in the artifact folders
described above. No application source was changed during this final check.
