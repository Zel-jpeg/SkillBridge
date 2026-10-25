# Assessment editing, reuse and timing plan

Prepared before application edits on 25 October 2026. Continue on
`codex/assessment-archives`, preserving the preceding uncommitted archive work.

## Scope and policy

- Keep the existing question/key/category/count lock after any student attempt.
  Titles and display order remain editable. Archive remains read-only.
- Lock standard duration and opening time after any attempt, including completed
  attempts. Deadlines may move later or be removed; introducing/shortening a
  deadline after attempts is blocked. Block closing/unpublishing while an attempt
  is in progress. Explain requirement/inclusion/publication effects before save.
- Snapshot each attempt's standard duration and effective expiry at start. The
  effective expiry is the earlier of the duration end and assessment deadline.
  The user explicitly confirmed a 60-minute attempt started at 11:30 with a 12:00
  deadline must show only 30 minutes. Preserve that hard-cutoff policy.
- Extending the assessment deadline does not silently rewrite an existing
  attempt's expiry. An explicit per-attempt extra-time action, with a reason,
  can extend an unexpired current attempt, bounded by the current assessment due
  date. Finalized/stopped/expired attempts use the existing reviewed retake path.
  Student timers resynchronize from a read-only timing endpoint without restarting
  attempts, fetching answer keys or changing local answers.
- Preserve the 30-second submission transport grace after the effective cutoff,
  including a deadline-capped auto-submit, so the request is not falsely late due
  to network transit. The displayed answering time ends at the cutoff. Later
  requests retain validated answers as flagged review evidence rather than losing
  them to an availability error. Already-finalized attempts remain immutable.
- Duplicate as draft copies questions/keys/categories with new IDs into an
  optional target active batch (or a batchless draft). It copies no attempts,
  scores, schedules or placements. Copies default to optional and excluded from
  competency, so creation cannot impose new requirements or double-count evidence.
  Publishing/inclusion requires a separate explicit reviewed action.
- No automatic correction/replacement or rescoring of used assessments. Serious
  content corrections use a separately reviewed copy/retake workflow. No automatic
  migration or recalculation of historical grading or placement evidence.

## Implementation sequence

1. Add timing snapshot and extension fields with a Django migration. Backfill
   only active legacy attempts from the limits in force at migration, matching
   the old server's current policy; do not invent their original historical limits.
   Preserve finalized score/history records.
2. Centralize edit validation and server timing; serialize starts, timing changes,
   extra time and finalization with consistent assessment-before-response locks.
   Add scoped duplicate, timing-read and extra-time endpoints plus audit events.
3. Share lock explanations, precise settings-impact review and duplicate dialog
   across instructor/admin editors, including archived source details. Offer
   extra-time management in the existing assessment/student details.
4. Synchronize active student countdowns from server expiry and show the actual
   cutoff before start. Preserve anti-cheat, stale-attempt identity, local answer
   recovery, submission grace, and saved recommendation/placement boundaries.
5. Test direct API scope, partial saves, legacy migration, due/duration boundaries,
   retakes, immutable snapshots, deadline/extension races and copy isolation;
   browser-check both staff roles and student timing. Run lint/build and relevant
   regression suites using synthetic fixtures/disposable PostgreSQL.

## Verification status

Implementation and local verification are complete on `codex/assessment-archives`.
No configured Supabase migration, hosted deployment or real-record mutation was
performed. Migration 0024 remains an owner-run step before using this backend.

## Delivered contract

| Situation | Staff behavior |
| --- | --- |
| No attempts | Questions, duration and schedule can be edited |
| Any attempt exists | Questions, keys, categories, count, standard duration and opening time are locked |
| Deadline already set, attempts exist | It can move later or be removed; earlier deadlines are rejected |
| No deadline, attempts exist | A new cutoff cannot be introduced |
| Unfinished attempt | Closing/unpublishing is rejected; title and order remain editable |
| Required/inclusion/publication changes | The staff save review explains the actual completion/evidence effects |
| Archived source | Source stays read-only; authorized staff can duplicate it as a new draft |

Students see the effective answering cutoff and a countdown based on the earlier
of `started_at + duration_seconds` and the due date captured at start. The user's
11:30 / 60-minute / 12:00 example produces 1,800 seconds. These values are an
illustration; the same rule handles any valid duration and deadline. A 30-second transport
allowance follows that cutoff, including deadline-capped attempts, for reliable
auto-submit delivery. The timer does not display those extra transport seconds.
Later submissions retain validated answers as flagged/stopped review evidence;
they do not count as required completion or eligible combined competency.

Extending/removing the assessment deadline changes future attempts. Existing
attempts retain their assigned cutoff. Grant extra time is an explicit action for
one current, unexpired attempt: 1–180 whole minutes per request, a required reason,
and an audit record. It cannot exceed the current assessment deadline. Extend the
assessment deadline first if an accommodation needs a later cutoff. Finalized,
stopped and already-expired attempts use the reviewed retake workflow.

Student timing reads run every 15 seconds and once before timer-driven submission,
without fetching questions or resetting answers/integrity. The backend also rejects
an automatic submit if the attempt still has granted time, returning its canonical
timing so the student can continue. Manual early submission remains allowed.
Choice and identification editing stop at zero while the last timing check is
pending; a confirmed extension enables them again without losing saved answers.
Retakes preserve the old timing in history and start a new snapshot with zero
extra-time seconds.

Duplicate as draft copies question text, types, category references, order and
answer keys into new question/choice IDs. The copy is Draft, Optional, Excluded
from competency and has no opening/deadline; a target active managed batch can be
chosen or assigned later. No attempts, scores, histories or placements are copied.
Creation therefore cannot introduce a completion requirement or double-count
evidence. Duplicate and extra-time requests use UUID request IDs for safe retries.

For a serious content correction after attempts, preserve the original evidence
and prepare a reviewed draft copy. Do not silently treat both versions as required
competency evidence. Replacement/retake decisions remain explicit staff decisions;
there is no automatic historical rescoring or evidence substitution.

## Migration and API

Migration `0024_attempt_timing_snapshots` follows `0023_assessment_archives`. It adds
duration, effective expiry, due-date snapshot and cumulative extra seconds to
StudentResponse and AssessmentAttemptHistory. Existing active rows with a start
time are backfilled from assessment limits in force at migration. Original legacy
limits cannot be reconstructed if they were previously edited; no such history is
invented. Finalized results, answers, score history and placement snapshots are not
rewritten. The reverse data step is a no-op before the added fields are removed.

Apply 0024 to the intended configured database before running the updated backend,
then restart Django. Coordinate this when students are not actively taking an
assessment. Only disposable test databases were migrated by the agent.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/instructor/assessments/<id>/duplicate/` | Scoped copy; `request_id`, optional title and target `batch_id` |
| `GET /api/assessments/<id>/timing/?attempt_started_at=...` | Student's own exact attempt, no-store/read-only; no answer keys |
| `POST /api/instructor/assessments/<id>/students/<student_id>/extra-time/` | Scoped active attempt; exact identity, request ID, minutes and reason |

Starts, settings edits, extensions, retakes and finalization share an
assessment-before-response lock order. Archived writes remain blocked. Permission
checks use the existing managed assessment/batch scopes; admin is not an exception
to timing or evidence rules. Extra-time reasons are audit data, not notifications
or logs. Existing saved-score and placement evidence is preserved.

## Verification evidence

- Final disposable PostgreSQL run: all 95 tests passed, including the 12 policy
  tests, timing/grace boundaries, legacy migration rollback/forward, real
  extension/submit races, idempotent copy requests, archive/authoring/start locks,
  and preserved recommendation/placement behavior. Evidence:
  `work/assessment-archives-postgres-bunuoq4b/tests.txt` (ignored).
- Existing assessment, multiple-assessment, submission, management and access
  regression suite: all 75 tests passed. The focused policy/submission/migration
  SQLite run also passed 34 tests. Final Django checks and migration drift passed.
- Frontend: all 150 JavaScript tests passed; final lint and production build passed.
- Real isolated API/browser checks passed for both instructor and admin: deadline
  capping, used-assessment locks, reviewed deadline removal preserving the current
  cutoff, explicit extra-time synchronization without answer loss, and safe draft
  copies with editable duration and no copied evidence/schedule. No page errors.
- Existing browser regressions passed: instructor editor/picker and save recovery,
  admin oversight, both roles' archive/restore and CSV/TXT/XLSX import staging,
  including failure/retry, scope and responsive light/dark layouts.
- New synthetic timer browser checks passed: automatic cutoff submission,
  answer-input locking while the final timing read is pending, and recovery when
  an extension commits after that read but before submit. Original answers and
  exact attempt identity remain intact. No page errors.
- All six slow/lost/unconfirmed submission browser cases passed with no page
  errors. The older native-alert assertion now checks the current in-app failure
  message; the recovery behavior itself remains unchanged.
- Inspected mobile student extension/recovery and mobile dark staff screenshots;
  `git diff --check` passed.

Real policy browser tests live in
`skillbridge-frontend/tests/assessment_policy_playwright.py`; run with
`run_admin_management.py --policy` using the same isolated test environment as the
archive tests. The timer regression is `assessment_timer_recovery_playwright.py`;
set `SKILLBRIDGE_TEST_BASE` to an isolated Vite URL. Screenshots/checks are under
ignored `skillbridge-frontend/tests/artifacts/assessment-policy/`,
`assessment-timer-recovery/`, and `assessment-submission-timeout/`.

These checks use synthetic data, local Chromium and disposable databases. They
do not establish hosted behavior, native-device behavior or the state of the
configured Supabase database after 0024; that migration was not applied there.
