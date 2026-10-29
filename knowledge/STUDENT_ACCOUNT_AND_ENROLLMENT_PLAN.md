# Student account archiving, unenrollment and re-enrollment plan

28 October follow-up: the [cycle closeout update](OJT_CYCLE_CLOSEOUT_AND_ROLLOVER_PLAN.md)
adds one-active-batch enrollment checks, explicit reviewed transfers and returning-student
profile confirmation/history. Archive-to-next-cycle enrollment preserves old memberships.
An active transfer explicitly removes/audits only the source membership, retaining the
account, evidence and placement records. That later update uses migration 0028; the
27 October implementation and no-schema-change evidence below describe its original scope.

Created and implemented 27 October 2026. Status: **implemented and locally verified**.
This records the agreed student removal/archive scope and the previously
unenrolled filter/re-enrollment workflow. No deployment or live-data changes
were performed. The implementation and verification notes are in section 9.

## 1. Agreed behavior and destinations

| Action | Allowed staff | Effect | Where staff find the record |
| --- | --- | --- | --- |
| Archive student account | Admin | Disable account access; retain memberships and recorded history | Admin Users → Archived; retained batch memberships remain visible with an archived-account badge |
| Restore student account | Admin | Reactivate the same account; existing approval/enrollment requirements still apply | Admin Users → Students; no new enrollment is created automatically |
| Unenroll from this batch | Owning instructor or admin | Remove only the selected membership; retain the account, other memberships and recorded history | Selected batch → Previously unenrolled, where a removal audit record exists; active accounts also remain in Admin Users → Students |
| Re-enroll in this batch | Owning instructor or admin | Add the existing student back through validated enrollment | Selected batch → Enrolled students |
| Archive batch | Owning instructor or admin | Retain the cohort and history with the existing archived-batch restrictions | Instructor Students batch selector; Admin Batches → Archived status filter |

Account archiving, batch archiving and unenrollment are separate states. An
unenrolled student is not automatically an archived account. A student enrolled
in another batch stays enrolled there. Permanent student deletion is outside
this plan; do not add a purge button or cascade-delete history.

## 2. Verified current baseline

- [Admin account API](../skillbridge-backend/api/admin_accounts.py) uses HTTP
  DELETE to set `User.is_active=False`; it does not delete the account. PATCH
  with `is_active=True` restores it. Preserve these existing routes.
- [Admin Users](../skillbridge-frontend/src/pages/admin/AdminUsers.jsx) already
  has an Archived tab and an Archive student confirmation. Its originating
  detail button still says Remove student, and the confirmation does not list
  preserved history.
- [Student unenrollment](../skillbridge-backend/api/views.py) removes the selected
  `BatchEnrollment`, marks that batch's recommendations noncurrent and combined
  profile unfinalized, and records `enrollment.remove` in `ManagementAction`.
  Assessment results and placements are retained.
- The instructor roster currently has no individual-account archive filter or
  previously unenrolled collection. The roster read does not supply the account
  active flag needed for a reliable archived-account badge/read-only guard.
- The archived-user response currently supplies basic identity/account details,
  not the complete assessment and retake history consumed by the student dialog.
- [Existing enrollment](../skillbridge-backend/api/enrollment_import.py) recognizes
  matching existing students and uses `get_or_create` for membership. Its signed
  preview/review contract binds the actor, batch and reviewed identities. Archived
  accounts are blocked; batch activity is checked again while confirming.
- The previous review ran 10 existing account/unenrollment tests successfully on
  isolated SQLite. This is baseline evidence, not verification of planned work.

## 3. Phase 1 — Clear labels, confirmations and audit

1. Rename the admin student detail action to **Archive student account** and its
   confirmation action to **Archive account**. Use the shared archive icon.
2. Rename instructor removal controls and their confirmation to **Unenroll from
   this batch**. Keep the admin batch wording consistent. Identify the student
   and selected batch in the confirmation.
3. Replace ambiguous confirmation/toast text with the actual effect. Retain
   Cancel, pending feedback, duplicate-submit protection and inline failure.
4. Record real student account archive/restore transitions through the existing
   management-action helper, with actor, time and target ID. Repeated no-op
   requests must not create misleading duplicate transition records.

Suggested account archive confirmation:

> Archive [student name] ([student ID])? This disables their SkillBridge access.
> Their profile, enrollments, assessment answers and scores, retake history, and
> placement history will be preserved. An admin can restore this account later.

Suggested unenrollment confirmation:

> Unenroll [student name] from [batch name]? Their account, assessment results,
> retake history and placement history will be preserved. Access to this batch's
> assessments and current recommendations will be removed. Other batch
> memberships will remain unchanged.

Restoring an account must not silently create an enrollment, approve a retake,
unlock results or approve a placement. Keep those actions separate in feedback.

## 4. Phase 2 — Archived account visibility and preserved history

1. Reuse **Admin Users → Archived**. Supply authorized read-only assessment,
   retake and placement history to the existing student details UI. When records
   span batches, identify the batch and preserve the existing separation between
   individual assessment scores, combined evidence and saved placement snapshots.
2. Add an **Account status** filter to the selected batch roster in both roles:
   All accounts, Active accounts and Archived accounts. Default to All accounts
   to preserve the current complete-roster view. Use the existing active flag.
3. Show an **Account archived** badge. Preserve memberships rather than moving
   account records between database tables. Instructors can read only their
   authorized batch records; only admins can restore accounts.
4. Enforce archived-account assessment restrictions in the backend as well as
   the UI, including retake and extra-time mutations. Preserve authorized history
   and private evidence access, while keeping these assessment records read-only.
5. Keep historical scores visible as historical evidence; never replace missing
   data with zero or present old rankings as current eligible recommendations.

Archiving an account does not remove an approved placement or free its occupied
slot. Preserve the explicit placement-removal action and its confirmation. Test
existing provisional-suggestion reconciliation without changing allocation rules.

## 5. Phase 3 — Previously unenrolled collection

Within the selected batch, add an **Enrollment** filter with two values:

- **Enrolled students**: the existing current membership roster; default view.
- **Previously unenrolled**: students with a recorded `enrollment.remove` for
  this batch who have no current membership in this same batch.

Use the existing management-action records, deduplicate students and show the
latest known removal date. Check current batch ownership on every backend read;
an instructor must not receive a system-wide student directory. Account status
and enrollment are independent filters. Archived accounts can appear, but cannot
be re-enrolled until an admin restores them.

Keep existing search, course filters, cards/list behavior and pagination. Both
views must show the same filtered page and truthful total; reset/clamp pages as
results change. Empty, loading, failed-read and no-search-results states must be
distinct. Use the established collection UI and shared pagination components.

**Legacy limitation:** older removals without an audit record cannot reliably be
classified as previously unenrolled. Explain this limitation; do not fabricate
removal dates or use all students outside the batch as a substitute. A broader
**Not enrolled in this batch** directory is optional future scope, not this list.

## 6. Phase 4 — Re-enroll in this batch

1. Add **Re-enroll in this batch** to eligible previously unenrolled cards/rows.
   Open the existing enrollment review with the selected saved student identity
   prefilled and the target batch fixed. Do not require a fresh spreadsheet.
2. Preserve existing identity validation, preview token, review/verification and
   final confirmation; never bypass the enrollment service with a direct frontend
   membership write. Revalidate access and account/batch activity at confirmation.
3. Use **Re-enroll student** for the final action, naming both student and batch:

   > Enroll [student name] back into [batch name]? Their existing assessment
   > records and other batch memberships will be preserved.

4. Archived batch: show Reactivate batch first. Archived account: admins receive
   a route/action to restore it; instructors see Admin restoration required.
   Restoration remains explicit and does not itself enroll the student.
5. Handle concurrent/already completed enrollment without duplicate memberships
   or repeated notifications. A lost/unconfirmed save response must lead to a
   fresh review, not blind mutation replay. Keep truthful email-queue feedback.
6. On confirmed success, update the enrolled and previously unenrolled lists,
   counts and open details through existing shared cache/live invalidation.
   A failed refresh must distinguish confirmed enrollment from a failed write.

**Eligibility checkpoint:** unenrollment invalidates the batch's current combined
profile/recommendations. Before implementing this phase, trace and test the
existing re-enrollment/recalculation lifecycle. Retained attempts must not be reset;
reenrollment must not unconditionally flip finalization/current flags or bypass
required completion, freshness and batch gates. Reuse the established evidence
validation/recalculation path where reconciliation is needed. No ranking formula,
grading, retake permission or placement decision changes are proposed.

## 7. Storage and implementation boundaries

No new tables, columns or migration were added. The implementation reuses `User.is_active`, batch
status, `BatchEnrollment`, existing assessment/placement records and
`ManagementAction` (including batch-ID snapshots). No live backfill is proposed.
This still requires backend read/authorization work; it is not only UI styling.

Primary touchpoints:

- Frontend: AdminUsers, UserDetailModal, useAdminUsers, EnrolledStudents,
  useEnrolledStudents, AdminBatches, managementStudent normalization, shared
  student details, ConfirmModal and StudentEnrollmentModal.
- Backend: admin_accounts, account/roster reads and scoped unenrollment in views,
  student_records, management_access, enrollment_import, archived assessment mutation guards and
  existing change-event publication boundaries.
- Follow [collection UI contracts](../.agents/skills/skillbridge-collection-ui/SKILL.md),
  [enrollment review](IAMS_ENROLLMENT_IMPORT.md),
  [batch collection behavior](ADMIN_BATCH_COLLECTION_UI.md) and
  [live freshness](LIVE_DATA_FRESHNESS.md). Preserve existing Axios and auth scopes.

## 8. Verification and completion criteria

Use synthetic fixtures and a disposable local/dedicated test database only.

- Archive/restore preserves identity, memberships, answers, scores, prior attempts,
  retake evidence references and placement snapshots. Inactive accounts lose
  access, and only admins can restore them. Cancel/failed actions do not change
  records; successful state transitions have accurate audit history.
- Unenrollment affects only the selected authorized batch. Another membership,
  completed attempt and approved placement remain unchanged. Required-completion
  and recommendation gates reflect the selected batch correctly.
- Previously unenrolled data cannot leak foreign students. Re-enrollment removes
  the student from that list; missing legacy audit records remain explicit.
- Re-enrollment uses the existing account and membership uniqueness, preserves
  historical scores, reconciles eligibility correctly and never grants automatic
  placement/retake approval. Test inactive/archive races and concurrent requests.
- Browser checks cover both roles, archived read-only history, filter combinations,
  search, cards/list consistency, pagination/clamping, keyboard use, narrow screens,
  dark mode, duplicate activation, cancel, save/read failure, retry and live refresh.
- Run relevant existing and new backend account, enrollment, access, history,
  recommendation and capacity tests; frontend lint/build and relevant cache tests.
  Finish with `git diff --check` and document actual results and remaining limits.

Deployment, production migrations and production test enrollments are outside
this task.

## 9. Implemented behavior and local verification

- Student account archive uses an archive icon, accurate named confirmation and
  the existing reversible account API. Real archive/restore transitions record
  actor/time/target in `ManagementAction`; repeated no-ops do not duplicate them.
- Admin Users → Archived opens lazy, admin-only preserved history grouped by
  batch, including detached/score-only records, prior attempts, saved combined
  evidence and recorded placement decisions. Saved evidence remains explicitly
  historical; current recommendations remain locked. Restore invalidates cached
  history as well as the user directory.
- Both selected-batch pages now have independent Enrollment and Account status
  filters. Archived enrolled students are labeled and their assessment details
  are read-only. Existing search/course filters, views and roster totals remain.
- The new scoped `instructor/batches/:id/unenrolled/` read derives recorded
  removals from audit history and excludes current memberships. It keeps the
  legacy-coverage notice and provides ten-record card/list pages, filter reset
  and persistent page clamping. Archived account/batch prerequisites are visible.
- Re-enroll opens the existing enrollment dialog in manual review with the saved
  identity prefilled/read-only and target batch fixed. Preview, verification,
  signed review token, named final confirmation and backend revalidation remain.
  The confirmed endpoint locks the selected batch through the write so archive
  or reassignment cannot race past its ownership/activity check.
  Confirmed enrollments are removed immediately from the cached previous list;
  normal roster/history reads reconcile through shared cache and SSE invalidation.
- Re-enrollment with a recorded prior removal invokes `ensure_combined`, which
  reuses the existing evidence/required-completion gates and calculation. It does
  not reset attempts, force eligibility, grant a retake or approve a placement.
- Backend account activity checks protect legacy retake, retake-request review
  and extra-time writes. Retake queues mark archived accounts/batches read-only;
  private evidence reads retain existing authorization.

Verification completed:

- **137 PostgreSQL tests, all passed, zero skipped**, on a fresh disposable local
  PostgreSQL cluster with normal credentials disabled. Modules: student record
  recovery, admin account recovery, batch taxonomy recovery, enrollment import,
  attempt timing, retake recovery, access security, admin management and combined
  competency. Includes actual archive/enroll and duplicate-enroll row-lock races.
  The test database was destroyed and the temporary cluster stopped afterward.
- **36 frontend Node tests passed**: cache, invalidation, response contracts,
  account collection, student detail semantics and account filtering.
- **Three new real React/Django browser workflow groups passed** against disposable
  SQLite with email dispatch mocked. They cover admin archive/cancel/restore and
  preserved history, both role-specific removal/re-enrollment flows, pagination,
  account restrictions, 320/768/1440px layouts, light/dark themes, preview/save/read
  outages, cancellation, re-preview, duplicate activation and read-only retries.
  No page errors were reported.
- **Eight existing admin batch browser groups and two existing admin account
  recovery browser groups passed**, including their prior responsive, history,
  confirmation, failure and restoration checks.
- Frontend lint/build, Django system checks, migration dry-run (No changes
  detected), Markdown links and `git diff --check` passed.

Evidence: `api/test_student_record_recovery.py`,
`tests/student_record_recovery_playwright.py` and ignored browser artifacts under
`tests/artifacts/student-record-recovery/`. Disposable PostgreSQL evidence is in
`work/student-record-recovery-postgres-n4y9soxn/`. These checks establish local
behavior, not production deployment, hosted RLS or real-email delivery.

Known limitation remains intentional: unenrollments predating audit recording
cannot be reconstructed reliably. They are not invented or backfilled.
