# OJT cycle closeout, returning students and partner reuse

Prepared 28 October 2026. Status: **recommendation-only scope corrected, migrated and verified**.
User authorized implementation and the proposed defaults on 28 October 2026.
Branch: `ojt-cycle-closeout-rollover`. Migration authorized and applied on 28 October; no application deployment.

29 October fresh full-branch audit: see the active checklist and evidence in
[full branch verification](BRANCH_VERIFICATION_2026_10_29.md). Its fresh results
supersede older overlapping counts below; no configured-database migration or
live-record mutation is part of that audit.

Audit completed: 538 PostgreSQL API tests (zero skips), 288 frontend tests,
lint/build, Django/migration checks and all final browser replays pass. This
includes the complete production filter/roster run, real cycle/enrollment/admin
and suggestion-draft journeys, analytics and actual export verification. Test
fixtures were corrected without another application change. The audit report
records initial failures, final evidence and untested hosted/device/load behavior.
Documentation/diff checks pass and task-owned helpers are stopped. No required
audit work remains. The user subsequently authorized committing/pushing this
branch and merging/pushing `main`; the audit report records the publication
preflight separately from the earlier local verification state.

## User scope correction — read before continuing

The user clarified that SkillBridge supports OJT recommendations and does not need
**Ongoing OJT** or **OJT completed** tracking. The completion lifecycle, required
training outcomes and related archive/capacity assumptions below describe the
implemented version, not the corrected target. See the
[scope review and correction checklist](OJT_CYCLE_SCOPE_REVIEW.md) before making
further changes. The correction is implemented and migration 0029 is applied. Keep useful enrollment, partner archive and saved recommendation
report work. Removing UI labels alone does not correct the backend dependencies.

## Resume checkpoint

- Branch: `ojt-cycle-closeout-rollover`; changes remain local and uncommitted.
- Active 29 October follow-up: user approved the ImageGen grouped-chip filter
  panel, then required the compact control sizes from their reference. Implemented
  desktop popover/mobile sheet with native single-choice radio chips, staged
  preview/Apply, cancellation, reset and previous-enrollment filtering. Search is
  38px, chips 28px and view buttons 26px inside the familiar 34px toggle. All 284
  Node tests, final lint and build pass. Twelve light/dark responsive groups,
  keyboard/batch isolation and a dedicated load-error/Retry check pass. Duplicate
  sibling keys and cache-refresh Retry issues found in review were fixed. Phone
  cards, desktop cards and desktop lists each passed all 180 enrolled plus 9
  previous-enrollment combinations across scoped runs. The initial combined run
  had an unreproduced list count mismatch; isolated list replay passed all cases
  without another application change. See `work/roster-panel-browser-matrix.txt`
  and `work/roster-panel-browser-list.txt`; do not claim the combined run passed.
  Final compact screenshots were reviewed in `work/roster-panel-final/`.
  An additional 40 repeated desktop-list one-result/all-result pointer applies
  passed with zero page errors or writes; `work/roster-panel-browser-apply-stress.txt`.
  Task-owned port-5178 Vite was stopped. Documentation and focused diff checks pass.
  No required steps remain. No backend/data changes in this follow-up.
- Latest authorized UI follow-up: shared summary/Batch actions icons are implemented.
  The long roster status pills are replaced by paired Assessment status and
  Recommendation status dropdowns, with intersection filtering and Clear filters.
  All 282 frontend tests, lint and build pass. All 15 synthetic Chrome groups pass:
  320/375/768/1024/1440px in both themes, 540 enrolled filter combinations and
  27 previous-enrollment combinations, with exact identities, pagination, search,
  view switching and reset behavior. Zero page errors or API writes. Screenshots
  were reviewed and the task-owned port-5178 server was stopped. Evidence:
  `work/roster-dropdowns-browser.txt` and the ignored roster-toolbar results JSON.
  No required steps or known failures remain in this UI follow-up.
- 29 October: corrected the two status menus opening above despite room below.
  Their picker ordering now prefers below while retaining viewport-edge fallback.
  Four focused Chrome groups pass across mobile/desktop and both themes, including
  Escape focus; no page errors or API writes. Evidence:
  `work/roster-picker-verification.txt`. Frontend lint and build passed, screenshots
  were reviewed and the task-owned server was stopped. No remaining steps.
- User authorized the scope correction, implementation, review/testing, then a new
  ImageGen preview. Preserve [PAUSE / CONTINUE instructions](../AGENTS.md).
- Current specification and checklist: [recommendation-cycle scope](OJT_CYCLE_SCOPE_REVIEW.md).
  Training-progress tracking is removed. Keep assessment, ranked recommendations,
  coordinator decisions, partner archives, returning profiles and report history.
- Implemented: shared current-allocation helper, retained per-batch approvals,
  reactivation capacity/archive guards, removed completion endpoint/UI, report
  schema 2 without training outcomes, four meaningful roster cards, aligned header,
  Batch actions review and separate Saved reports. No new tables.
- Compatibility: applied migration 0028 is preserved. New migration 0029 changes
  approval constraints without rewriting rows or dropping fields. Legacy recorded
  statuses/timestamps and issued snapshots remain readable.
- Current browser checks: 14 groups passed, zero page errors, including optional
  flagged assessment versus required completion, archive with approved decisions,
  partner reuse, exact new assessment scores, profile save/confirmation and transfer.
  Evidence: `work/cycle-scope-browser.txt` and ignored cycle-lifecycle screenshots.
- Verification: 537 full PostgreSQL regressions and 121 final guard checks passed;
  85 SQLite cases had 75 passes and 10 database-specific skips; 276 frontend tests,
  lint/build, 14 browser groups, exports, Django check and migration drift passed.
  Runs overlap; details are in the scope-review checkpoint.
- Migration 0029 is applied to the configured database, with a private backup and
  unchanged all-column record digests. Zero pending migrations. Evidence:
  `work/cycle-migration-audit/20261028T130348Z/`.
- Corrected ImageGen concept generated after implementation, review and checks.
  It uses sample data and the four recommendation-focused metrics for the user's
  design review. No known failing checks or required steps remain in this request.
  No push, merge or application deployment was performed. PAUSE means preserve
  this checkpoint and wait for CONTINUE; do not resume the superseded monitoring flow.

## Historical first implementation — superseded scope

The sections below preserve the initial plan and its verification history. Its
training-completion assumptions and unfinished legacy-outcome gate are superseded
by [the corrected scope](OJT_CYCLE_SCOPE_REVIEW.md). Do not reimplement them.

## 1. Goal and boundaries

End an OJT cycle without losing student or placement history; reuse the same
student accounts and partners next cycle; update openings without rewriting the
previous cycle's official records.

**Recommended constraint: no new database tables.** Reuse Batch, BatchEnrollment,
Company, Position, OJTPlacement and ManagementAction. Small additive fields and
Django migrations on existing tables may still be needed. No-schema-change and
no-new-table are different promises. Do not encode lifecycle state in organization
names, addresses, tags, remarks or zero slots merely to avoid a migration.

Batch is the existing history boundary. An academic OJT cycle might contain
several batches: do not silently assume one batch represents the whole college's
cycle. First support explicit per-batch closeout; a combined export can later name
the selected batch IDs without introducing a Cycle table. Separate per-cycle
partner quotas and agreements are outside this first version.

- [x] R01 Review batch archive, enrollment, assessments and profile routing.
- [x] R02 Review partner/position deletion, capacity and recommendation callers.
- [x] R03 Review retained placement evidence and existing export controls.
- [x] D01 Confirm per-batch closeout, admin/owning-instructor scope and clear terminology.
- [x] D02 User authorized the proposed defaults, no new tables and clear UX.

## 2. Reviewed baseline before this update

| Area | What exists today | Limit or consequence |
| --- | --- | --- |
| Batch archive | Sets archived status, recalculates combined state and keeps memberships/attempts/scores | Not proof of successful OJT completion; no unfinished-attempt guard or automatic closeout report |
| Returning student | Existing active identity can enroll in another active batch | Archived accounts must be restored; identity/program conflicts require resolution |
| New assessments | Attempts belong to student + assessment; competency evidence is batch-scoped | Old results do not automatically credit new requirements; reopening the same assessment preserves its attempt |
| Current enrollment | Newest enrollment among active batches drives normal student screens | Multiple active memberships remain possible; other enrolled assessments can still pass direct access checks |
| Profile | Account-level phone/address/course/pin survive enrollment | Login uses phone presence for setup routing; no per-batch confirmation; historical rosters use current personal details |
| Archived-only student | Can sign in with retained enrollment | Normal assessment list requires an active batch; no dedicated previous-batch student collection |
| Partners/positions | Shared catalog, editable slots/titles/requirements | Neither model has an archive lifecycle; neither belongs to one batch |
| Delete partner/position | Admin delete controls and API exist | Recorded placement references block deletion with 409; unused active system suggestions are replaceable |
| Recommendation-only references | Position deletion cascades recommendation rows | Absence of placement history does not mean deletion preserves all recommendation history |
| Slots | Total configured capacity minus all approved placements | Shared across batches, not a quota allocated separately to each batch |
| Approved placement | One approved placement per student globally; assignment score/distance components are saved | Archive does not release it; there was no Completed status; old approval may block another cycle |
| Historical labels | Placements retain partner/position foreign keys | Names, address, title and capacity are read from current catalog rows, not complete historical copies |
| Rankings after catalog edits | Fingerprints lock stale results; explicit admin rerun exists | Capacity is a separate approval check; new positions may trigger regeneration automatically |

Zero slots already prevents additional approval through the capacity check, but
does not implement retirement: the ranking code considers positions with
requirements regardless of slot count. Preserve the distinction between a full
position and a retired position.

Sources: [batch/enrollment/result/placement/catalog endpoints](../skillbridge-backend/api/views.py),
[models](../skillbridge-backend/api/models.py),
[current enrollment and availability](../skillbridge-backend/api/assessment_progress.py),
[batch evidence and recalculation](../skillbridge-backend/api/combined_competency.py),
[enrollment matching](../skillbridge-backend/api/enrollment_import.py),
[ranking candidates](../skillbridge-backend/api/scoring.py),
[profile routing](../skillbridge-frontend/src/api/authDestination.js).

## 3. Implemented lifecycle rules

| Action | Implemented effect | History and next-cycle behavior |
| --- | --- | --- |
| Archive batch | Administrative read-only state; block unfinished assessments first | Keep membership/history; do not claim OJT completion or change partner status |
| Complete placement | Authorized staff explicitly confirm actual completion | Preserve approval evidence; record completion; stop consuming an ongoing slot and blocking a future approval |
| Close batch cycle | Resolve outstanding work, save a final snapshot, then archive | Frozen report remains downloadable; preserve exception outcomes such as deferred/unplaced |
| Archive partner | Stop accepting new matching/assignments through that partner | Keep existing placements/history; do not mark them completed; block until ongoing approvals are resolved in the first version |
| Archive position | Retire that opening from future matching/assignments | Preserve past records; resolve ongoing approvals and release provisional suggestions first |
| Restore partner/position | Restore catalog availability after staff review | Does not restore old approvals, reserve slots or reopen a batch; partner and position must both be available |
| Delete partner/position | Narrow cleanup for unused or mistaken catalog entries | Keep existing placement protection and guard retained recommendation references; prefer archive once used |
| Reuse partner next cycle | Keep the same organization identity | Review slots and openings; no duplicate partner solely because the academic year changed |
| Return student | Reuse account, confirm current details, enroll into one current active batch | New assessment evidence stays separate; previous completed placements remain history |

Archiving one batch must never archive a shared partner, reset its slots, finish
another batch's placements or release another batch's suggestions. Administrative
archive and completed-cycle closeout remain distinct actions.

## 4. Existing downloads and the missing closeout record

These controls already exist:

| Location | Controls and scope |
| --- | --- |
| Admin/instructor OJT Placement Management | **Download reports** opens partner/position placements, student placements and placement history; filter by batch/status/partner/position/date; **Download PDF** and **Download XLSX** |
| Admin/instructor Reports & Analytics | Assessment/Skills/Placements tabs; **Batch status: Archived history** and batch filters; **Download displayed CSV** and **Download displayed PDF** |
| Reports & Analytics, Assessments tab | **Individual assessment reports**, Generate report, Download CSV and Download PDF |

The exported files preserve their downloaded contents. Before this update, the app did **not**
persist a complete cycle-closeout package when archiving.
Generating an old-batch report later can show current partner labels/slots and
locked combined results. Placement reports cover positions appearing in those
records; they are not a complete historical inventory of openings with no placements.
The placement report's batch options are derived from loaded placements/students;
check old-batch discoverability rather than assuming every archive is selectable.

Sources: [placement report UI](../skillbridge-frontend/src/components/placements/PlacementReportPanel.jsx),
[placement page controls](../skillbridge-frontend/src/pages/placements/PlacementWorkspace.jsx),
[analytics filters and exports](../skillbridge-frontend/src/pages/reports/ReportsAnalytics.jsx),
[assessment exports](../skillbridge-frontend/src/components/AssessmentReportPanel.jsx),
[report reconciliation](REPORT_RECONCILIATION.md).

The **Cycle closeout & saved reports** section now provides **Save final report &
archive batch**, saved-version selection and PDF/XLSX/CSV downloads. Files use the
saved server-side version. They include Summary, Students, Assessment scores,
Combined scores, Saved matches, Placements and Openings at closeout. Empty evidence
is not invented. A downloaded report is an institutional record, not a database backup.

- [x] E01 Add batch closeout preview and clearly scoped final-report downloads.
- [x] E02 Save roster, assessment definitions/progress, eligible raw/max/percentage
  totals, included assessment IDs, finalization/freshness/model facts and placement
  outcomes. Read stored evidence without generating fresh rankings just for an export.
- [x] E03 Preserve relevant student identity/course and partner/position labels,
  requirements and configured slots as of closeout; include unused openings in the
  declared catalog scope. Avoid copying unnecessary contact/location data.
- [x] E04 Record batch IDs/names, server generation time, actor, timezone, format
  version, exact scope and historical-versus-current capacity labels.
- [x] E05 Capture selected-batch placements separately from shared all-batch
  occupancy. Do not disclose another instructor's student identities in capacity data.
- [x] E06 Make closeout mutation/snapshot/archive atomic, repeat-safe and authorized.
  Revalidate preview inputs so intervening writes cannot silently change the report.
- [x] E07 Failed PDF/download generation must allow retry from the saved snapshot;
  never regenerate the snapshot or roll back confirmed completion merely for a file error.
- [x] E08 Existing archives without snapshots say **Historical snapshot unavailable**.
  Any later reconstruction must be dated now and label unavailable past facts.
- [x] E09 Define reopening/recloseout: retain prior immutable snapshot versions,
  append a new explicitly dated version, and never overwrite an issued final record.

## 5. Implementation checklist in dependency order

### Phase A: placement completion and shared capacity

- [x] A01 Extend existing OJTPlacement status with **Completed** and record
  completion time; retain approval dates, remarks and score/distance snapshots.
  Never represent normal completion as Removed or Rejected.
- [x] A02 Permit completion only from an ongoing approved placement after explicit
  staff confirmation; record a small ManagementAction audit event and scoped invalidations.
- [x] A03 Review all status consumers: uniqueness, approval/manual assignment,
  slot validation, suggestions, dashboard cards, notifications, history, analytics,
  student visibility and CSV/PDF/XLSX exports. Completed is history, not deployed now.
- [x] A04 Keep approved placements consuming slots globally until explicitly
  completed/removed. Never free capacity merely because a batch was archived.
- [x] A05 Prevent completion from automatically approving a new placement or
  restoring old suggestions. Keep old completion visible to its owning batch.
- [x] A06 Resolve/release the closing batch's provisional suggestions with audit
  and retained history; protect other batches and never promote suggestions to approvals.

### Phase B: partner and position archive

- [x] B01 Add explicit archive/restore metadata to existing Company and Position
  rows. Keep familiar Partner labels and existing IDs/API terminology.
- [x] B02 First-version archive requires no ongoing approved placements for the
  affected partner/position; show blocking counts and permitted record links.
- [x] B03 Keep archiving a partner independent of individual position archive state;
  restoring it must not restore positions deliberately retired earlier.
- [x] B04 Exclude unavailable partners/positions consistently from ranking candidates,
  matching browse/maps, draft allocation, direct approval and manual assignment.
  Historical views must still resolve retained references.
- [x] B05 Extend recommendation fingerprint inputs/candidate scope for archive state;
  stale selections must fail backend checks even if a browser has cached candidates.
  Preserve grading and ranking weights; do not silently relabel stale output current.
- [x] B06 Preserve delete protection for all placement history, including Completed;
  address recommendation-only history before allowing destructive deletion.
- [x] B07 Add Active/Archived catalog filters, restore actions and accurate named
  confirmations. Follow collection search, pagination and accessibility contracts.
- [x] B08 Preserve current staff boundaries. Admin controls organization lifecycle;
  instructors retain their existing catalog-edit rights without gaining archive/delete.

### Phase C: batch archive and returning students

- [x] C01 Block batch archive with unfinished assessments; surface pending retakes
  and unresolved placements in preview. Keep ordinary archive distinct from completion.
- [x] C02 Enforce one current active batch per student through validated enrollment
  and reactivation checks; serialize competing changes and provide an explicit transfer path.
- [x] C03 Preserve old memberships during archive-to-new-cycle enrollment, and keep
  responses, scores and retake history. An active-batch transfer explicitly removes
  only the source membership using the established unenrollment audit, then adds
  the target through validated enrollment. It does not reset attempts or placements.
- [x] C04 Add read-only previous-batch results and an informative archived-only
  student state. Limit historical access to the authorized student's own records.
- [x] C05 Prefill profile review for the new batch; validate actual required fields
  rather than phone presence alone. Keep new map data from rewriting saved closeout facts.
- [x] C06 If confirmation is mandatory per batch, persist its timestamp on existing
  BatchEnrollment and enforce the chosen gate server-side. Do not rely on browser storage.
- [x] C07 New-batch assessments use new records and normal publication/completion
  rules. If copied as drafts, explicitly review dates, required/included flags and publication.
  No automatic previous-score credit in the first version.
- [x] C08 Reactivating an old batch does not clear completed placement history,
  reset old attempts or overwrite prior closeout versions; recheck active-membership conflicts.

### Phase D: closeout and next-cycle preparation

- [x] D03 Implement E01-E09 after completion/capacity semantics are correct.
- [x] D04 Require an explicit outcome for unfinished/deferred/unplaced students;
  do not label every enrolled student a successful OJT completer.
- [x] D05 Present a review of the selected batch, resolved placements, released
  suggestions, exceptions and final report before confirmed closeout.
- [x] D06 Reuse the same partner next cycle. Update the same position's capacity
  when the role is unchanged; create another Position under the same partner for
  a genuinely different role, and archive the old opening when retired.
- [x] D07 Update openings only after reviewing ongoing occupancy across every
  batch. The slot value is total simultaneous capacity, not free slots to add.
- [x] D08 After requirement/title/location/catalog changes, follow the established
  stale-result and recommendation-refresh process. Slots alone remain a capacity change.
- [x] D09 Offer a prefilled next-cycle review of partners/positions without
  automatically copying placements or duplicating organization identities.

## 6. Implemented persistence, without new tables

Migration `0028_ojt_cycle_lifecycle` adds six fields on existing tables and extends
an existing status choice. Existing IDs and approval/score history are preserved.
No tables are added. Existing ManagementAction stores action actors/audit.

| Existing table/model | Added fields / behavior | Purpose |
| --- | --- | --- |
| Company | `archived_at` (nullable) | Explicit partner archive state |
| Position | `archived_at` (nullable) | Independent retirement of an opening |
| OJTPlacement | `completed` in existing status; nullable `completed_at` | Separate finished OJT from ongoing capacity and removal |
| Batch | `closeout_snapshots` JSON list, default empty; maximum 16 MiB including versions | Store issued report facts and metadata, not PDF files or credentials |
| BatchEnrollment | `profile_confirmed_at` (nullable), `profile_review_required` (default false for existing rows) | Returning enrollments require explicit server-validated confirmation; legacy/first-time membership defaults preserve onboarding |
| ManagementAction | Existing action/metadata fields | Small archive/restore/completion/closeout audit events, not the full report store |

A Batch JSON snapshot is a tradeoff: it supports a modest per-batch final record
without another table, but is not a normalized history warehouse. Bound payload
size, version it and measure realistic cohorts. Server-generated snapshots must
have strict permissions and safe serializers; ordinary batch lists must not
return the whole payload. Large queryable history or independent simultaneous
cycle quotas would need a separate design review rather than overloading JSON.

Changing a position's slots in place does not preserve a continuously queryable
history of every capacity change. This proposal preserves capacity at recorded
closeout times only. Do not promise arbitrary historical capacity reconstruction.

## 7. Example: same partner, next cycle

Synthetic Partner A has Network Support with total capacity 5. Batch A has three
ongoing approved placements, and Batch B has one: remaining shared capacity is 1.
Explicitly completing Batch A's three placements leaves Batch B's one approval
consuming capacity. Archiving Batch A alone currently releases none.

After closeout, Partner A may offer total capacity 4 next cycle: with Batch B's
one ongoing placement, 3 slots remain. The closed Batch A report still states its
recorded capacity and outcomes. If a new Software Support role is offered, add a
new position under Partner A; do not rename the old Network Support role into a
different job and depend on live joins to explain past placements.

## 8. Verification and rollout gates

- [x] V01 Test completion, repeated requests and forbidden transitions; reconcile
  ongoing/completed/unplaced dashboard and report counts.
- [x] V02 Test simultaneous approve/complete/archive/slot-edit/enrollment/reactivation
  races on disposable PostgreSQL, including active-enrollment uniqueness at the application boundary.
- [x] V03 Verify archived partner/position direct API denials and all role scopes;
  stale browser candidates cannot bypass eligibility or capacity rules.
- [x] V04 Verify new-batch assessments do not consume old-batch scores, same-batch
  re-enrollment preserves attempts, and required evidence/freshness gates remain intact.
- [x] V05 Verify snapshot downloads remain identical after partner rename, role/slot
  edits, profile changes, recommendation reruns and batch reopen/recloseout.
- [x] V06 Check legacy archived batches, detached/null-batch placements, inactive
  accounts, recommendation-only references, no placements, no required assessments,
  ongoing OJT, multiple instructors and partially completed cycles.
- [x] V07 Test archived-batch report selection, exact selected scope, all filtered
  rows, shared-capacity labels, unused openings, Manila dates and safe spreadsheet text.
- [x] V08 Verify migration defaults preserve existing statuses, memberships,
  scores, snapshots and approvals; no automatic historical completion/backfill.
- [x] V09 Run relevant assessment/enrollment, catalog, placement, capacity, report,
  freshness, authorization and event tests; run frontend lint/build and browser flows
  after implementation. Review screens at desktop/phone sizes and both themes.
- [x] V10 Plan a compatible backend/frontend release: old clients must not
  misinterpret Completed or archived catalog rows. Define rollback for data written
  with new statuses; removing UI code alone is not a complete rollback.
- [ ] V11 Operator reviews legacy ongoing approvals individually; do not bulk mark
  archived batches' placements completed. Legacy outcome reconciliation remains a
  separately authorized operation. The additive schema migration is complete.
- [x] V12 Back up the configured database, apply migration 0028, verify no pending
  migrations and compare existing record digests before/after without logging records.
- [x] V13 Run every backend test module on disposable PostgreSQL, add finalization/
  profile/transfer races, and verify the returning student's new assessment and
  reused-partner placement through the browser while old reports stay unchanged.

## 9. Implementation, verification and rollout

### Delivered behavior

- Owning approved instructors and admins can complete an ongoing placement without
  deleting its approval evidence; Completed no longer consumes an ongoing slot.
  New placement approval in the same completed batch is blocked, while another
  active batch may reuse the same partner/position with fresh evidence.
- Admin-only partner/position archive and restore preserve history, independently
  retain retired openings, block ongoing approvals and enforce availability on the
  server as well as current browsing/matching. Referenced recommendations also
  protect deletion. Slot counts remain shared simultaneous capacity across batches.
- Staff have a focused closeout review, named completion confirmations, explicit
  outcomes for students without completed OJT, saved report versions and next-cycle
  links. Pending requests, approved unused retakes and unfinished attempts block
  closeout. Ordinary batch archive stays an administrative action.
- Closeout captures retained evidence without rerunning grading/ranking. It locks
  source records, verifies a signed review, saves the snapshot and archives atomically.
  Replayed/stale closeout confirmations cannot create duplicate versions. Reopening
  and closing again appends another version without rewriting the first.
- A new current batch never inherits the previous cycle's completed-placement or
  declined-position status. Old batch rosters and competency reports use their own
  placement context. Releasing a batch also clears only its old coordinator choices;
  choices and ongoing placements for other batches remain untouched.
- Transfers require a source/target review and explicit confirmation. Cross-instructor
  transfers require an admin; the original active membership is explicitly removed
  and audited. The same account, prior assessments, placements and membership audit
  remain. New enrollment is validated through the existing service, notification
  intent is held for separate email controls, and failure rolls back the whole move.
- Returning students review their saved profile instead of filling blank onboarding
  again. Confirmation validates identity, phone, residence/travel and address/pin
  fields server-side, then clears the enrollment gate. Batch history shows their own
  score summaries and approved/completed placements; private decision notes, rejected
  decisions, retake answers and other students' records are excluded.
- Existing archives without a snapshot remain labeled as such; no past slot totals,
  OJT completion, frozen personal details or model execution are fabricated.

### Checks actually run

- PostgreSQL regression suite: **299 passed**, no skips; evidence
  `work/cycle-postgres-final.txt` and `work/email-outbox-postgres-pf5m90wp/tests.txt`.
- PostgreSQL focused follow-up: **86 passed**, including reused-position placement,
  concurrent enrollment/reactivation and migration table/history preservation;
  `work/cycle-postgres-focused.txt` and `work/email-outbox-postgres-gs2zhnt9/tests.txt`.
- SQLite regression suite: **288 discovered, 273 passed, 15 database-specific skips**;
  `work/cycle-lifecycle-regressions.txt`. Additional optional-email schema,
  enrollment-to-assessment and profile checks: **11 passed** in `work/cycle-rollout-tests.txt`.
- Frontend: **216 tests passed**, lint passed, production build passed. Evidence:
  `work/cycle-frontend-tests-final.txt` and `work/cycle-build-final.txt`.
- Real API/Chrome browser acceptance: **12 grouped checks**, zero page errors,
  using disposable SQLite, synthetic people and blocked external providers. Includes
  completion, archived downloads, independent archive/restore, unchanged snapshots
  after catalog edits, returning profile/history, explicit transfer, and conflicting
  reactivation. Desktop light, phone light and tablet dark layouts were inspected.
  Runner: `python skillbridge-frontend/tests/run_admin_management.py --cycles`.
- Saved exports: seven PDF pages rendered and visually inspected; seven XLSX sheets,
  exact raw/max/percentage, historical partner/slot values, completion timestamps,
  CSV content, page numbering and absence of spreadsheet formula cells verified.
  Files/screenshots: ignored `skillbridge-frontend/tests/artifacts/cycle-lifecycle/`.
- Django system check passed and migration dry-run reported **No changes detected**.
- Final PostgreSQL lock-order/schema follow-up: **70 passed**, including closeout
  versus retake review, independent-connection races and optional-email schema recovery;
  `work/cycle-final-locking-tests.txt` and
  `work/email-outbox-postgres-ij2_mlkc/tests.txt`.
- Choice-release/rollback/draft SQLite follow-up: **34 passed**, migration dry-run
  unchanged; `work/cycle-choice-release-tests.txt`.
- CONTINUE final verification: **36 SQLite cases passed** in
  `work/cycle-resume-tests.txt`, followed by **50 PostgreSQL cases passed, no skips**
  in `work/cycle-resume-postgres.txt` and
  `work/email-outbox-postgres-kpz57u9u/tests.txt`. Includes same-batch retained-score
  refresh, repeat-safe confirmation, malformed requests, coordinator-choice release,
  rollback guards, migration preservation and independent-connection lifecycle and
  allocation races. No browser/frontend rerun was needed for these backend-only
  confirmation refinements; their preceding passing evidence is retained above.
  All commands use disposable databases, never the normal configured DB or
  production credentials. Counts above overlap; do not sum them as distinct tests.

### Compatibility and release limits

Migration 0028 is applied in the configured environment. Other environments must
apply it before starting the updated backend. Release the matching frontend and
have staff refresh existing tabs before using the
new actions. A rollback guard refuses to drop lifecycle fields when completion,
archive, closeout or profile-confirmation records exist. Preserve a recoverable
backup and plan a forward recovery instead of silently discarding issued reports.

The configured additive migration was applied with a recoverable local backup and
unchanged existing-record digests. No legacy record reconciliation, email dispatch,
recommendation regeneration against real records, application deployment, push or
merge was performed. Table counts were checked on disposable upgrades. Large-cohort snapshot/load
benchmarks, physical devices, screen readers and hosted provider behavior remain
unverified. Slot totals have closeout snapshots, not an arbitrary historical trend.

### Migration and whole-flow audit follow-up (28 October)

- The configured Supabase/PostgreSQL database now records migration 0028. Only
  existing tables gained lifecycle fields; no data backfill or automatic completion
  was performed. `verification.json` in the private ignored migration evidence
  folder records zero pending migrations and unchanged existing-row digests.
- Saving a returning student's profile previously replaced the dashboard cache
  with a smaller serializer response, temporarily hiding the batch and confirmation
  controls. The save now merges same-user fields and revalidates the complete read.
  The browser reproducer edits/saves contact details before confirming the new batch.
- Reopening a closed batch now shows its current assessment results in student
  history; issued closeout versions remain unchanged and separately downloadable.
- Transfer now rejects pending requests and approved unused retakes, preventing
  those assessment permissions from being stranded in a removed membership.
- Submission and integrity-stop finalization now commit scores, profiles and
  combined evidence together. Batch and assessment locks prevent archive from
  overtaking finalization. Profile save/confirmation, transfer and unenrollment
  follow compatible parent/identity lock order; PostgreSQL races exercise this.
  Finalization serializes within a batch; high-concurrency latency is not benchmarked.
- Browser acceptance also performs the next batch's real assessment submission,
  verifies its exact 1/1 result excludes the prior 7/10 evidence, approves the reused
  partner and checks the previous closeout remains identical. The dark-mode check
  sets the application's saved theme and asserts the rendered dark class.
- Full backend discovery across all 50 `api/test*.py` files: **532 passed, no skips**,
  `work/cycle-audit-full-postgres-final.txt` and
  `work/email-outbox-postgres-8h2bmr9s/tests.txt`. The first full run reproduced the
  finalization deadlock; the corrected run passed. Two presentation test doubles
  were updated to include the new model field.
- After the last profile/confirmation locking changes: **80 PostgreSQL tests
  passed, no skips**, including independent-connection profile-save/submission and
  transfer/start races, recovery, freshness, enrollment and access checks;
  `work/cycle-audit-profile-locking-final.txt` and
  `work/email-outbox-postgres-x_pfyqhj/tests.txt`.
- Frontend **216 passed**, lint/build passed in `work/cycle-audit-frontend-tests.txt`
  and `work/cycle-audit-build.txt`. The final real-API Chrome run passed **14 groups,
  zero page errors**, `work/cycle-audit-browser-final.txt`. Phone light and tablet
  actual-dark screenshots were inspected. The expanded submission uses the real
  local NLP runtime; the original five-second browser assertion was increased to
  accommodate analysis. No scoring or model result is mocked by the cycle fixture.
- Django system check: no issues; `makemigrations --check --dry-run`: no changes.
  Local Markdown link checks and `git diff --check` passed. Test helpers shut down
  their own servers. All synthetic flows use disposable databases. The configured
  database was used only for the authorized backup, migration and integrity checks.

The optional-email readiness regression now physically removes/recreates only email
tables while keeping current mandatory core columns. It preserves the real missing-
table/access-order check without running current models against the pre-0028 core.

Closeout outcome text is visible to the relevant student; keep private staff notes
in the existing internal decision/retake workflows. The full staff snapshot is not
returned by ordinary batch lists or student history endpoints.

Related contracts:

- [Student accounts, unenrollment and recovery](STUDENT_ACCOUNT_AND_ENROLLMENT_PLAN.md)
- [Assessment archive versus batch archive](ASSESSMENT_ARCHIVES.md)
- [Assessment timing and safe copies](ASSESSMENT_LIFECYCLE_AND_TIMING.md)
- [Shared placement suggestions](PLACEMENT_DRAFT_IMPLEMENTATION.md)
- [Shared slots and area definitions](CAPACITY_AND_AREAS.md)
- [Catalog validation and deletion protection](CATALOG_VALIDATION.md)
- [Recommendation freshness](RECOMMENDATION_FRESHNESS.md)
- [Report reconciliation](REPORT_RECONCILIATION.md)
- [Analytics and historical snapshot limits](DASHBOARD_AND_ANALYTICS_PLAN.md)
- [Partner terminology and preserved API/model names](PARTNER_TERMINOLOGY.md)
- [Collection UI contracts for future archive collections](../.agents/skills/skillbridge-collection-ui/SKILL.md)

Apply the assessment/recommendation review skills when implementing the related
gates, collection UI guidance for archive collections, React guidance for affected
components and the local webapp-testing workflow for browser acceptance.
