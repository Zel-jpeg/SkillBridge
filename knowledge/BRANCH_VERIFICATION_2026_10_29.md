# Full branch verification — 29 October 2026

Branch: `ojt-cycle-closeout-rollover`. Starting commit: `d31a61b`, also current
local main. This branch's implementation remains uncommitted; review includes
tracked edits and new files, rather than only committed differences.

User request: test everything added in this branch, check for bugs and broken
flows, and fix reproducible problems. This is local verification, not deployment,
live-data mutation, message delivery or a guarantee that all possible bugs are absent.

## Active checkpoint

Status: **completed**. No required audit steps remain. Changes remain local and
uncommitted on `ojt-cycle-closeout-rollover`; HEAD is still `d31a61b`.

Publication follow-up, 29 October: after the completed audit the user authorized
committing/pushing this branch and merging/pushing `main`. A fresh fetch confirms
`origin/main`, local `main` and the tested base all remain `d31a61b`; there are no
upstream changes to reconcile. The local/uncommitted statements in this audit
record its completion state before that separate Git publication operation.

- [x] Reconcile Git status and the cycle/filter implementation trackers.
- [x] Read the project overview, assessment/recommendation review skills and
  relevant collection/testing instructions.
- [x] Run the complete API suite on fresh disposable localhost PostgreSQL.
- [x] Check Django configuration and model/migration consistency with test settings.
- [x] Run all frontend tests, lint and production build.
- [x] Review lifecycle, enrollment, allocation, authorization, history and export
  changes against their callers and tests; investigate gaps and failures.
- [x] Run real-API cycle rollover and existing enrollment/assessment/partner flows
  with synthetic local records and providers disabled.
- [x] Verify shared collection filters, roster matrix, both staff assessment
  libraries, Users, keyboard/layout states and regression-sensitive screens.
- [x] Inspect exported artifacts, role boundaries, stale data and compatibility.
- [x] Record results/fixes/limits, validate docs and stop only task-owned services.

Current results: all 538 API tests pass on fresh disposable PostgreSQL (zero
skips); all 288 frontend tests, lint/build, Django check and migration drift pass.
The fresh real-API cycle journey passes 14 groups, with zero page errors. Actual
CSV/XLSX/PDF downloads preserve 7/10=70% assessment and combined evidence, the
approved decision and two recorded slots; seven worksheets/sections/pages and no
XLSX formulas were verified. PDF pages 1/3/7 were rendered and visually inspected.

Fresh production-build collection checks pass: all 31 shared assessment/Users
groups and the complete roster suite in one run. The roster checks 12 responsive
light/dark layouts, keyboard/cancellation, previous-enrollment failure/Retry and
567 exact-identity combinations (180 enrolled plus nine previous-enrollment cases
in phone cards, desktop cards and desktop lists). Zero page errors or writes.
Phone, short-landscape dark and Users phone screenshots were visually inspected.

The real enrollment/setup/two-assessment journey passes six groups for both staff
roles, with queued/held synthetic mail, map outages, saved-response recovery,
unsaved retry and exact 5/6 combined evidence. Real placement analytics passes 28
groups. Partner collection, placement collections, choice-save and recovery pass.
Real admin management passes all 16 groups, including scoped batch reassignment,
archive/reactivation, authoring/import, failed-save retry, attempt locks and safe
unenrollment. The real suggestion-draft journey passes all seven groups and eight
instructor viewport cases, with no page errors. It covers sync failure/explicit
retry, live capacity invalidation, low-score alternatives/conflicts, explicit
approval, manual-decision removal, server history search and instructor scoping.
No application change was needed during this fresh audit; fixture and assertion
corrections are described below. No product defect remains reproduced by the
completed checks. This does not establish that every possible bug is absent.

Some earlier development-server browser runs timed out or lost navigation context;
those runs are not passes. Fifty isolated short-landscape interactions also pass;
the final combined production roster run passes without application changes.
Development reloads/resource contention have not been proven as the sole cause.

Do not reset unrelated work or migrate the configured database during this review.
Only disposable test databases and synthetic/provider-disabled fixtures are used.

## Fresh evidence

- `work/branch-full-postgres-20261029.txt` and
  `work/email-outbox-postgres-xxygjm5v/tests.txt`: 538/538, zero skips.
- `work/branch-full-node-20261029.txt`, `work/branch-full-lint-20261029.txt`,
  `work/branch-full-build-20261029.txt`.
- `work/branch-django-check-20261029.txt`, `work/branch-migration-drift-20261029.txt`.
- `work/branch-cycle-browser-20261029.txt`: 14 real-API browser groups.
- `work/branch-export-20261029/verification.json` and rendered pages.
- UI suites: `work/branch-browser-20261029/`; real journeys:
  `work/branch-real-20261029/` contain initial runs, including failures.
- Final production collection replay: `work/branch-production-ui-20261029.txt`,
  `work/branch-ui-replay-20261029/collection_filters_playwright.txt` and
  `student_roster_toolbar_playwright.txt`; complete synthetic results in ignored
  `tests/artifacts/collection-filters/` and `student-roster-toolbar/`.
- Real enrollment/analytics replay: `work/branch-real-replay-20261029/`.
- Real admin management: `work/branch-admin-management-final-20261029.txt` and
  ignored `tests/artifacts/admin-management/checks.json`: 16 groups, no page errors.
- Real draft: `work/branch-placement-draft-final-20261029.txt`,
  `work/branch-ui-replay-20261029/placement_draft_playwright.txt` and ignored
  `tests/artifacts/placement-draft/results.json`: seven groups, no page errors.
- Final partners: `work/branch-partner-recovery-final-20261029.txt` records the
  partner pass; its recovery failure was a stale capacity-label assertion. The
  corrected two-group recovery pass is `work/branch-placement-recovery-final-20261029.txt`.

## Flow coverage

| Flow | Expected behavior | Evidence/result |
| --- | --- | --- |
| Batch closeout | Review unresolved work; save dated report and archive atomically | Passed: lifecycle API tests and real cycle browser |
| Returning student | Existing account/profile/history retained; new batch assessments independent | Passed: retained 7/10 history, new independent 1/1 submission |
| Profile setup | Existing details prefilled; returning confirmation and first setup remain distinct | Passed: returning phone profile edit/confirmation and first-time setup journey |
| Transfer/re-enrollment | Membership/slot conflicts checked; old decisions and attempts preserved | Passed: API rollback/race/retake cases and real transfer audit |
| Partner/opening reuse | Archive and slots respect current allocations; saved facts retain history | Passed: catalog API/partner UI and real cycle reuse |
| Current approvals | Active enrolled batches consume shared slots; historical approvals stay unchanged | Passed: PostgreSQL allocation/race cases, real cycle and analytics |
| Reactivation | Reject conflicting memberships, retired openings and capacity overflow | Passed: API and real cycle checks |
| Reports | Versioned PDF/XLSX/CSV use recorded evidence without inferred OJT completion | Passed: actual downloads parsed and PDF rendered |
| Assessment/retakes | Scoring, locks, integrity, history and completion gates remain correct | Passed: full API, staff library suites and real submissions/recovery |
| Recommendation gates | Current evidence, active batch and actual matching results control visibility | Passed: recommendation/combined tests and real cycle/enrollment journeys |
| Authorization | Student, own instructor, foreign instructor and admin access stays bounded | Passed: complete API access checks and cycle/browser role coverage |
| Shared filters | Draft/apply/cancel/reset, counts, pagination and scope agree in cards/list | Passed: production 31 groups plus full roster suite/567 combinations |
| Resilience | Loading/error/retry, stale responses, archive views and old schema remain safe | Passed: API/schema tests, library/collection suites, choice/recovery and real lost-response journey |

## Test fixture corrections

These repair test setup or assertions; no production rules were relaxed:

- Disposable localhost HTTP servers explicitly disable HTTPS redirection and
  dotenv loading. Test databases/providers stay isolated. The existing admin
  runner can reuse an explicitly supplied frontend and allows 90 seconds for
  startup. Production security settings remain unchanged.
- The admin journey now verifies that an already-current student cannot join a
  second active batch, then enrolls a separate synthetic student. The fixture
  supplies that student's identity for the subsequent assessment access check.
- Stale partner wording, archive confirmation labels and duplicate-text selectors
  follow the current UI. Partner logo checks wait for lazy image loading and
  verify the actual image dimensions and broken-image fallback.
- Placement recovery uses a valid provisional draft and the current review and
  capacity controls. It still verifies safe errors, retained remarks, one write
  per double activation, no replay after a committed save and reconciled capacity.
- The successful isolated first-time journey now has a tracked, provider-disabled
  fixture rather than relying on an ignored local helper. Browser base URLs are
  configurable for managed local runs.
- Admin assignment waits for the actual PATCH response with a bounded timeout;
  the earlier assertion stopped after five seconds while the real save was still
  pending. Initial draft collection loading likewise has a bounded longer wait.
  The real API, analysis, exact counts and database checks remain enabled.

## Verification limits

- Fresh API coverage is 538 PostgreSQL tests with zero skips. Full frontend unit
  coverage is 288 tests with zero skips. These counts are independent; overlapping
  historical runs are not added to them.
- Browser suites use installed headless Chrome, synthetic identities and local
  disposable databases or explicitly mocked API responses. The production-build
  roster/shared-filter runs are fresh combined passes; initial development-run
  interruptions and obsolete-fixture failures are retained as failures, not passes.
- Real Google/Brevo delivery, hosted SSE/proxy behavior, physical mobile devices,
  other browser engines, large-cohort load and long-term snapshot storage growth
  were not exercised. Browser checks do not replace staging/deployment checks.
- No production migration, live-data mutation, external message, deployment,
  commit, push or merge was performed during this audit. Existing local work stays
  uncommitted on `ojt-cycle-closeout-rollover`.

## Final cleanup

Changed Python browser helpers compile successfully. All 206 local Markdown file
links in changed/new documents resolve. `git diff --check` passes; Git reports
existing line-ending normalization notices, not whitespace errors. The disposable
PostgreSQL cluster/test database and real-API helpers shut down. Task-owned Vite
and preview servers were stopped; process/port checks confirm no matching browser
helpers or listeners on 5178/8024/8026. Other user services were left alone.
