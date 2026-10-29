# Recommendation-cycle scope correction

Reviewed 28 October 2026 on `ojt-cycle-closeout-rollover` after the user clarified
that SkillBridge is an OJT recommendation system and does not need ongoing-OJT or
OJT-completed tracking. The user subsequently authorized the correction, review,
tests and a replacement ImageGen concept. Implementation is complete; final
regression and configured-database migration evidence is recorded below.

## Finding and cause

The cycle update incorrectly expanded batch rollover into internship monitoring.
The agent interpreted “the OJT cycle is done” as requiring an individual training
completion transition. It used that transition to release approved slots and allow
returning students to receive another placement decision. That was an unnecessary
business assumption. User approval of the broad update did not establish that an
approved recommendation means training has started or finished.

Approved, Suggested, Removed and Rejected placement decision records existed
before this branch. The new Completed status and `completed_at` field were added
by this update. Existing coordinator decisions and slot allocation remain distinct
from real internship attendance, hours, evaluation and completion.

The original project purpose is assessment, competency evidence and ranked
student-to-position recommendations, with a human coordinator retaining the final
decision. Older references have dated implementation details; current code and the
user's clarified scope control this correction.

## Original findings addressed by the correction

| Area | Current change | Required correction |
| --- | --- | --- |
| Placement lifecycle | `placement_complete` changes Approved to Completed and timestamps it | Remove the training-completion action and new writes; retain existing decision history |
| Batch report/archive | Closeout blocks approved placements and requires an outcome for every student without Completed | Save actual assessment/recommendation/decision facts; do not require a training outcome to archive a recommendation batch |
| Partner/position archive | Every approved record is treated as ongoing OJT and blocks archive | Review current decision/slot commitments using explicit batch scope; historical approval alone must not require training completion |
| Returning students and slots | A global approved decision blocks another approval and keeps consuming capacity until Completed/Removed | Design cycle-aware current allocation and approval constraints; retain past approvals without falsely marking training completed or removing decisions |
| Student/staff screens | Completion controls, filters, history labels and the mockup's Ongoing OJT/OJT completed cards | Remove internship-progress concepts; retain assessment progress and coordinator decision labels |
| Analytics/exports | Completed counters/date filters; cycle export defaults an outcome to “OJT completed” | Export recorded recommendation-cycle facts without inferring real OJT success |
| Database compatibility | Applied migration 0028 includes Completed and a nullable timestamp | Preserve the applied migration and existing records; inspect actual usage before any forward schema/data change |

The old global `unique_approved_placement_per_student` constraint was incompatible
with preserved approvals in different batches. Forward migration 0029 replaces it
with one Approved decision per student/batch and one detached Approved decision per
student. No rows are rewritten, no columns are dropped and no tables are added.

### Implemented allocation policy

- `placement_scope.current_approvals` is the shared source for current slot counts
  and approval conflicts. An Approved row counts when its batch is active and the
  student still has that membership. Detached/null-batch approvals remain reserved
  for explicit staff review. Account archiving alone does not release an allocation.
- All active batches share each position's configured total slots. Archiving a
  batch or explicitly removing/transferring membership releases its current
  allocation without changing the saved Approved decision.
- Allocation, approval/manual assignment, catalog edits/archive, analytics,
  student current-decision visibility and report capacity use the same rule.
- A batch cannot reactivate if memberships conflict, an approval would revive on a
  retired opening, a detached approval conflicts, or shared slots would be exceeded.
- Existing allocation locks still serialize competing writes. Conditional batch
  uniqueness preserves one decision per batch; application guards prevent concurrent
  current approvals. Reverse migration refuses to restore the old global constraint
  when it would conflict with retained approvals across batches.

## Updates that still fit the requested purpose

- Preserve old accounts, memberships, assessment attempts, score history and
  coordinator decisions; enroll existing students in a new active batch.
- New assessments and combined competency remain scoped to their own batch.
- Prefilled returning-profile confirmation, validated enrollment/transfer and one
  active membership protect current recommendation inputs and preserve history.
- Archive/restore partners and individual positions independently, protect used
  references from deletion, and exclude retired openings from new recommendations.
- Reuse a partner and update openings/requirements/slots for the next cycle, while
  historical saved reports retain the facts recorded at that time.
- Versioned PDF/XLSX/CSV reports, role boundaries, stale-result checks, signed
  archive review, safe export text, cache fixes and transaction integrity remain useful.
- Keep the proposed aligned header, Batch actions menu and Saved reports access.
  The superseded ImageGen six-card design was a proposal; its training-progress
  cards were never implemented. The corrected roster has four main summaries.

## Corrected user flow

1. Staff assess students, review rankings and record coordinator decisions using
   the existing placement workflow.
2. When this recommendation batch is being closed, choose **Save report & archive
   batch** from Batch actions. Review unresolved assessments/retakes and current
   allocation effects. No claim about real OJT completion is required.
3. Save a version of the actual roster, assessment evidence, ranked matches,
   decisions and openings, then archive the selected batch atomically.
4. Preserve previous records and apply the reviewed current-allocation policy.
   Archiving a recommendation batch does not certify or deny training completion.
5. Reuse partners/openings, confirm current slots, and enroll existing accounts in
   the next batch. Returning students review saved details and take the new batch's
   assessments. Previously issued report versions stay unchanged.

The student-page summaries are Enrolled students (with course breakdown), Required
assessments complete (with the required-assessment count), Recommendations available
(unlocked with actual ranked matches), and Awaiting coordinator review (current
matches without a current approval). Stopped/flagged and approved-retake counts
remain actionable filters. Required completion reads the actual required-work flag,
so an optional flagged attempt does not incorrectly reduce that count.

The header has aligned Enrollment emails, labelled Batch actions and Enroll students
controls. Batch actions contains New assessment, Transfer student, Save report &
archive batch and Archive without final report. Saved reports has its own section;
the large closeout banner and per-student training-outcome form are removed.

### Icon and compact-filter follow-up

The current filter arrangement is the user-approved grouped-chip panel described
in [student collections](STUDENT_CARD_COLLECTIONS.md#grouped-chip-filter-panel--29-october-2026).
The paired-dropdown implementation and opening-direction correction below are
retained as verification history and are superseded by that panel.

The grouped panel preserves the user's compact reference: 38px search/trigger,
28px chips and the original quiet 34px card/list toggle. Draft choices preview a
count and apply together; close/Escape/outside interaction cancels. Clear filters
resets all five groups and search, including enrollment back to Enrolled students.
All 284 frontend tests, lint/build, responsive/keyboard/error-recovery checks and
the full filter matrices pass across scoped browser runs. The initial combined
run's unreproduced list-count mismatch is documented with the final isolated list
pass in the linked collection notes. No database or backend change was required.

The four summaries now use shared people, assessment-check, report and clock icons.
Every Batch actions item has an icon; the trigger and enrollment button use the
same shared icon family. Menu icons have a consistent size/weight and decorative
icons are hidden from assistive technology. Admin Manage batch also has an icon.
Frontend lint/build and the 14-group synthetic browser workflow passed. Evidence:
`work/roster-icons-lint.txt`, `work/roster-icons-build.txt`,
`work/roster-icons-browser.txt`. Responsive capture disables transitions so the
desktop screenshot does not capture the sidebar mid-resize.

The user subsequently authorized a less space-consuming mobile alternative to the
long status-pill row. It now uses two labelled dropdowns: Assessment status
(All, Complete, Incomplete, Stopped/flagged, Retake approved) and Recommendation
status (All, Available, Awaiting review, Approved decision), side-by-side on mobile.
Both selections combine with course, account and trimmed identity search. Clear
filters resets these controls and pagination while retaining the selected batch,
enrollment collection and card/list view. Changing enrollment collections resets
both status selections; previously unenrolled records keep their own filters.
Available requires actual unlocked matches, and Awaiting review also excludes
students with a current approval. Complete follows required-assessment completion,
so a flagged optional attempt can coexist with completed required work.

- [x] Replace the status pills with compact, explicitly labelled dropdowns.
- [x] Preserve intersection filtering, pagination resets and empty-state recovery.
- [x] Add six focused filter tests; all 282 frontend tests, lint and build pass.
- [x] Verify 15 synthetic Chrome groups: five widths in both themes, 540 enrolled
  filter combinations and 27 previous-enrollment combinations, including exact
  identities, pagination, keyboard search, view switching and reset behavior.
  Zero page errors or API writes; mobile/light/dark/desktop screenshots reviewed.
  Evidence: `work/roster-dropdowns-browser.txt`, `work/roster-dropdowns-node.txt`,
  `work/roster-dropdowns-lint.txt`, `work/roster-dropdowns-build.txt` and ignored
  `skillbridge-frontend/tests/artifacts/student-roster-toolbar/results.json`.
  Uses mocked API reads; physical-device and live-service behavior is unverified.

29 October follow-up: the browser's default `most-block-size` picker ordering
opened the two status filters upward on desktop despite enough room below. A
roster-scoped `position-try-order: normal` now prefers below and retains edge
fallback. Four focused mobile/desktop light/dark Chrome groups pass for opening
direction and Escape focus, with no page errors or API writes. Evidence:
`work/roster-picker-verification.txt`; details in
[student collections](STUDENT_CARD_COLLECTIONS.md#status-menu-opening-direction--29-october-2026).

## Correction checklist

- [x] Compare this branch with the pre-update placement states and trace lifecycle,
  archiving, capacity, enrollment, student history, reports and UI consumers.
- [x] Record the user's scope clarification and supersede the training-monitoring
  assumptions in the original rollout plan and visual concepts.
- [x] Define batch-scoped current commitments and approval uniqueness, including
  overlapping batches, legacy/null-batch records, archive and reactivation.
- [x] Remove new completion actions and ongoing/completed UI concepts consistently.
- [x] Simplify final report/archive validation and remove mandatory training outcomes.
- [x] Correct partner archive rules, returning approvals and all slot-count consumers.
- [x] Correct analytics, saved-report generation and exports; preserve issued versions
  and distinguish legacy facts from newly generated recommendation-cycle records.
- [x] Check actual usage of migration-0028 fields before any forward schema change.
  Do not delete/reverse the already applied migration as a shortcut.
- [x] Re-run assessment/ranking, allocation/approval, archive/restore, re-enrollment,
  reports and concurrency tests against the corrected business scope, then browser UX.
- [x] Generate the corrected ImageGen preview after the completed implementation review.

Migration 0029 changes approval constraints and the legacy status label. Migration
0028 remains in history. Its nullable timestamp and legacy stored status are kept
for compatibility, with no endpoint or user action that writes training completion.
Historical records and issued JSON report versions are not rewritten. New reports
use schema version 2, actual decision facts and an optional staff archive note.
Legacy stored outcomes/timestamps remain readable without inferred success labels.

## Evidence and verification limits

- [Project overview](PROJECT_OVERVIEW.md) and
  [original project purpose](../refs/SKILLBRIDGE_MASTER_CONTEXT.md).
- [Lifecycle endpoints](../skillbridge-backend/api/cycle_lifecycle.py): completion,
  archive restrictions, closeout validation, own-history and returning-profile flow.
- [Models](../skillbridge-backend/api/models.py) and
  [applied migration](../skillbridge-backend/api/migrations/0028_ojt_cycle_lifecycle.py):
  new completion fields and the existing global conditional approval constraint.
- [Allocation](../skillbridge-backend/api/placement_drafts.py),
  [approval/report endpoints](../skillbridge-backend/api/views.py) and
  [analytics](../skillbridge-backend/api/analytics.py): decision/capacity consumers.
- [Current closeout panel](../skillbridge-frontend/src/components/BatchCyclePanel.jsx),
  [roster](../skillbridge-frontend/src/pages/instructor/EnrolledStudents.jsx) and
  [cycle exports](../skillbridge-frontend/src/utils/cycleReports.js).
- [Original implementation tracker](OJT_CYCLE_CLOSEOUT_AND_ROLLOVER_PLAN.md).

The original review used local source and Git diffs. The subsequent correction
adds tests for current/archived allocations, overlapping batches, detached records,
reactivation capacity/availability, removed completion endpoint, retained legacy
records, approval history and reverse migration protection. The real-API browser
flow also covers the flagged optional-assessment completion count and archive
through Batch actions, with no training outcome requirement. Final results follow.

## Verification and migration checkpoint

- Real-API Chrome browser: **14 grouped checks passed**, zero page errors;
  `work/cycle-scope-browser-final.txt`. Synthetic accounts, disposable SQLite, phone,
  tablet dark and desktop layouts; actual new-cycle assessment and reused-partner
  approval preserve the old approved decision and saved report.
- Full disposable PostgreSQL regression: **537 passed, no skips**, in
  `work/cycle-scope-full-postgres-final.txt` and
  `work/email-outbox-postgres-jbl34fjc/tests.txt`. An old capacity fixture was corrected
  to include the active membership required for a current allocation.
- Final review guards: **121 PostgreSQL tests passed, no skips**, in
  `work/cycle-scope-final-review-postgres.txt` and
  `work/email-outbox-postgres-m150kygv/tests.txt`. Includes the same-batch re-enrollment
  guard for occupied/retired openings and direct-API read-only archived/previous
  decisions. The initial guard added a needless preview query; an EXISTS annotation
  preserves the two-query bulk-preview contract for ordinary enrollment.
- Additional final SQLite check: **85 discovered, 75 passed, 10 PostgreSQL-specific
  skips**; `work/cycle-scope-last-guards-final.txt`. Counts overlap; do not sum runs.
- Frontend: **276 Node tests passed**, lint and production build passed;
  `work/cycle-scope-frontend-tests-final.txt`, `work/cycle-scope-lint-final.txt`,
  `work/cycle-scope-build-final.txt`. Raw/max/percentage CSV evidence, seven XLSX
  sheets, no formula cells and PDF header were checked in
  `work/cycle-scope-export-verification.json`; desktop/phone/tablet screenshots were
  inspected. Django checks and migration drift check passed.
- Configured database: **migration 0029 applied**, zero pending migrations.
  Backup archive and all-column before/after row digests verify existing records,
  saved reports and schema-0028 fields are unchanged. Real legacy status/timestamp
  usage was zero at verification; no automatic cleanup was performed. Evidence and
  private backup: `work/cycle-migration-audit/20261028T130348Z/`; summary
  `work/cycle-scope-configured-migration.txt`. No table/column removal.
- No push, merge or application deployment. Changes remain local/uncommitted on
  `ojt-cycle-closeout-rollover`. The corrected ImageGen preview was generated after
  final verification, as requested: four recommendation-focused summaries, Batch
  actions, Saved reports and synthetic example students. It is a visual proposal
  for review; the actual implementation screenshots are in the ignored browser
  artifacts. No further visual implementation is implied before the user's review.
  Physical devices, large-cohort load
  and hosted provider behavior remain outside these local/synthetic checks.
