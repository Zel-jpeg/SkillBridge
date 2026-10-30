# Student assessment order and anonymous labels

## Active implementation checkpoint — 30 October 2026

Branch: `codex/student-assessment-order`. Keep the existing enrolled student.
Initial implementation was local only. On 30 October the owner additionally
authorized applying the migration, testing after migration, pushing the feature
branch, merging into main and pushing main to GitHub. Existing unrelated release
documentation edits remain outside this feature commit. No student deletion,
real assessment attempt, live assessment publication or live email is needed.

- [x] Review student list, dashboard, attempt, results, retake and history callers.
- [x] Add one JSON field on existing `BatchEnrollment`; no new tables.
- [x] Add saved shuffled order, reserved numbers and student aliases in the API.
- [x] Add atomic, scoped publication of a reviewed group of drafts.
- [x] Add the shared staff publication dialog and student presentation changes.
- [x] Verify isolated API/database behavior, concurrency and migration.
- [x] Run frontend lint/build and focused browser checks.
- [x] Review final diff and document actual results and rollout requirements.

Local implementation and verification are complete. Migration 0030 has also been
applied to the configured SkillBridge database and checked after commit. Matching
backend/frontend source publication follows the owner's GitHub request. Connected
hosting may deploy after main is pushed; a hosted release is not established by
the local and database checks recorded here.

## Contract

Students retain their accounts and enrollments. On the first student assessment
read, published assessments are shuffled once and their IDs are saved in the
enrollment's `assessment_order`. Dashboard prefetch can trigger this read; login
history is irrelevant. Reading an empty/draft-only batch reserves no numbers.
Later releases are shuffled within the new group and appended. Saved slots are
never recycled when assessments close, archive, unpublish or are deleted. A
restored assessment uses its existing slot. Visible cards may have numbering gaps.
Staff display order and titles remain staff metadata. Aliases do not change IDs,
questions, answers, grading, attempt rules, combined eligibility or recommendations.

Use **Publish drafts together** to release the initial set in one transaction,
after reviewing all drafts. Existing individual publication remains available;
publishing and exposing assessments individually can reserve their numbers in
that sequence. The group action preserves existing duration, opening/deadline,
required and competency-inclusion settings, so review these before publication.
No six-assessment assumption is hard coded.

Student titles become `Assessment n` across cards, dashboard, active assessment,
individual/combined results, history and retake requests. Topic badges and API
category metadata are removed from pre-submission questions/cards. Finalized
scores, category interpretation and authorized answer reviews remain available.
Question content itself can reveal its topic. Staff continue seeing real titles,
categories and reports. Student aliases are identifiers within a student/batch,
not a common identifier for comparisons between students.

The existing lifecycle lock protects grouped publication against closeout and
placement changes. Batch-before-enrollment row locks serialize alias initialization, membership
changes and atomic publication. Existing memberships initialize lazily; migration
does not create attempts or overwrite scores. Unenrollment/transfer records the
reserved order in the existing removal audit; same-batch re-enrollment can restore
it. A different batch has a separate mapping. Detached legacy history without a
saved mapping uses stable assessment IDs to establish display numbers.

## Verification and rollout

Migration `0030_batchenrollment_assessment_order` adds only the JSON column.
Apply it before serving the updated backend. Do not migrate the configured/live
database as part of local verification. Existing stored browser data may briefly
show cached titles until revalidation; fresh backend responses use student aliases.

Checks actually run:

- Frontend `npm run lint` and `npm run build`: pass.
- `manage.py check --settings=core.test_settings`: pass.
- `manage.py makemigrations --check --dry-run --settings=core.test_settings`:
  no changes detected beyond the prepared migration.
- `python skillbridge-frontend/tests/run_student_assessment_order_postgres.py`:
  all 166 tests pass in a fresh disposable local PostgreSQL cluster with dotenv
  disabled. Modules: student assessment order and migration, existing assessment
  randomization/submission, multiple assessments, combined competency, archives,
  assessment policy, retake recovery, cycle lifecycle, change events and staff
  management. Evidence: `work/student-assessment-order-postgres-9mia5ndu/tests.txt`.
  The runner stopped its own cluster afterward.
- `python skillbridge-frontend/tests/run_student_assessment_order_browser.py`:
  six acceptance groups pass against the production frontend build and disposable
  synthetic SQLite API. Covers an already-enrolled student before release,
  admin phone/dark publication review and cancel, instructor selection/review/
  publication across collection pagination, two student sessions with six
  anonymous cards and stable mappings on refresh, preserved code line breaks,
  successful answer submission, category results and locked final results while
  required work remains. Zero page errors. Phone and desktop screenshots reviewed.
  Evidence: `skillbridge-frontend/tests/artifacts/student-assessment-order/`.
  External browser traffic is blocked; SSE is stubbed, with server invalidation
  and recipient scope verified separately by API/PostgreSQL tests. The runner
  stops only its own API/frontend process trees.
- `git diff --check`: pass.

Earlier local attempts exposed a test route-name typo, an expected-title assertion
for the previous student API contract, and fixture server/cache limitations. These
were corrected before the passing runs above. Hosted/browser-provider behavior
remains unverified; no real student was logged in or deleted.

## Authorized migration and release checks — 30 October 2026

Only `0030_batchenrollment_assessment_order` was pending on the configured
SkillBridge Supabase database; migration history was at 0029. The Django migration
was applied in a transaction with bounded statement/lock waits and preservation
checks. It created no tables. All existing application-table counts stayed equal,
the existing enrollment's previous values matched their pre-migration digest,
and its new JSON order initialized to an empty array. The database contains no
assessments or attempts at verification time, so the enrolled student can receive
the initial shuffled set normally. No account was recreated.

Aggregate/schema evidence is in the ignored local file
`work/student_assessment_release/migration-verification.json`. It contains no
credentials, names, email addresses or student record values. The comparison is
preservation evidence for this additive migration, not a full database backup.

Post-migration checks:

- Configured `manage.py check` and `manage.py migrate --check`: pass, no pending
  migrations.
- Existing `work/assessment_review/post_migration_readonly.py`: database-enforced
  read-only transaction; admin serialization and instructor scoping pass, zero
  writes. No real student authentication or attempt calls are made.
- Fresh disposable PostgreSQL run: all 166 regression tests pass. Evidence:
  `work/student-assessment-order-postgres-oxura0er/tests.txt`. Tests use separate
  test credentials with dotenv disabled and do not create a production test DB.
- Frontend lint and production build: pass after migration.
- All six production-build browser acceptance groups pass using only the
  disposable synthetic API, with zero page errors. Results are recorded under
  `skillbridge-frontend/tests/artifacts/student-assessment-order/results.json`.

Supabase schema inspection confirmed the same target as the configured Django
connection. The security advisor reports existing informational notices about RLS
enabled without Data API policies; this migration adds no tables, grants, policies
or public API exposure. The application continues using its Django authorization
and database connection. See the [advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Feature source and this note belong on `codex/student-assessment-order` and main;
the Git history records the final publication commits. No manual host deployment
or hosting configuration change is part of the Git publication operation.
