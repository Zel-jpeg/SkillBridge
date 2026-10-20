# Instructor and administrator access review and plan

Implementation follow-up: the accepted operational gaps are addressed in the
working tree. See [implementation and verification](ADMIN_MANAGEMENT_IMPLEMENTATION.md)
for the delivered contract and pending runtime migration. The gap tables below
record the original baseline and are now historical.

Reviewed 20 October 2026 against local source at Git HEAD `2787998`.
This is a review and proposed implementation plan. Application behavior was not
changed, and no production database, hosted account or external notification was
used.

## Main conclusion

The backend already treats admins as system-wide managers for most instructor
operations, including assessment creation and question authoring. The admin
interface exposes only part of those capabilities. **Admin assessment creation
and question editing are primarily missing interface workflows, rather than
missing backend role permission.**

No core instructor management operation in the registered business API was found
to explicitly exclude admins. However, accepting the admin role does not always
produce the intended system-wide behavior: batch creation assigns the acting
admin as the instructor, and two instructor-oriented read endpoints still filter
by the acting user's ownership. Those paths need deliberate handling before
sharing more instructor screens with admins.

Recommended role contract: an admin can perform every instructor **management**
action across batches, with a recorded actor and a clearly selected batch and
instructor. An instructor manages their own cohorts and the existing shared
catalog fields. Both roles retain assessment integrity, evidence freshness,
capacity and history rules. Admin authority does not mean submitting assessments
as students or silently rewriting existing results.

## Scope and evidence

Reviewed the 67 registered API routes in [api/urls.py](../skillbridge-backend/api/urls.py),
their role/ownership branches in [views.py](../skillbridge-backend/api/views.py),
account management, diagnostic endpoints, JWT authentication, SSE recipient
scoping, relevant models and authoring helpers. Traced the admin and instructor
routes, navigation, pages, hooks and shared enrollment, assessment-report,
student-detail and placement components.

The student flows were checked as role boundaries relevant to staff authority;
this is a system-wide role/capability review, not a claim of an exhaustive
line-by-line security or scoring audit of every source file, dependency or
operator command.

Current code and tests take precedence over the older role summaries in
`refs/SKILLBRIDGE_MASTER_CONTEXT.md` and the frontend/backend context documents.
In particular, the current [authentication contract](AUTHENTICATION_AND_RECOVERY.md)
uses DNSC Google sign-in for instructors and individual password sign-in for
admins.

Evidence entry points:

| Reference | Source and relevant location |
|---|---|
| A | [Frontend route tree](../skillbridge-frontend/src/App.jsx), instructor and admin route groups; [role navigation](../skillbridge-frontend/src/navigation/navigation.js), lines 10 onward |
| B | [Instructor creator](../skillbridge-frontend/src/pages/instructor/InstructorUpload.jsx), lines 96 onward; [creator hook](../skillbridge-frontend/src/hooks/instructor/useInstructorUpload.js), lines 666–729 |
| C | [Instructor assessment editor](../skillbridge-frontend/src/hooks/instructor/useInstructorAssessments.js), composite question save around line 350; [assessment page](../skillbridge-frontend/src/pages/instructor/InstructorAssessments.jsx) |
| D | [Admin assessment page](../skillbridge-frontend/src/pages/admin/AdminAssessments.jsx), lines 46 onward; [management dialog](../skillbridge-frontend/src/components/admin/AssessmentManagementDialog.jsx), settings save at line 85, retake at line 111, answer-key display at line 147 |
| E | [Batch and student APIs](../skillbridge-backend/api/views.py), lines 953–1253; [instructor roster actions](../skillbridge-frontend/src/hooks/instructor/useEnrolledStudents.js), lines 279 onward |
| F | [Assessment and question APIs](../skillbridge-backend/api/views.py), lines 1450–2060; [atomic authoring helper](../skillbridge-backend/api/assessment_authoring.py), lines 34 onward |
| G | [Admin users page](../skillbridge-frontend/src/pages/admin/AdminUsers.jsx), enrollment modal at line 94 and button at line 158; [admin user actions](../skillbridge-frontend/src/hooks/admin/useAdminUsers.js), lines 174–327; [account API](../skillbridge-backend/api/admin_accounts.py), lines 21–70 |
| H | [Instructor recommendations and company APIs](../skillbridge-backend/api/views.py), lines 2479–2737; [admin recommendation API](../skillbridge-backend/api/views.py), line 3010 onward |
| I | [Placement APIs](../skillbridge-backend/api/views.py), lines 3964 onward; [shared placement hook](../skillbridge-frontend/src/hooks/usePlacements.js); [placement pages](../skillbridge-frontend/src/pages/placements/PlacementsPage.jsx) |
| J | [Assessment report component](../skillbridge-frontend/src/components/AssessmentReportPanel.jsx); [admin reports](../skillbridge-frontend/src/pages/admin/AdminReports.jsx), line 160; [report API](../skillbridge-backend/api/views.py), line 1260 onward |
| K | [JWT account checks](../skillbridge-backend/api/authentication.py); [frontend role guard](../skillbridge-frontend/src/router/PrivateRoute.jsx); [event recipients](../skillbridge-backend/api/change_events.py), line 53 onward |

## Current capability matrix

“API only” means the server permits the action, but the normal admin interface
does not provide the corresponding control. Instructor assessment ownership is
based on the batch's instructor, or the creator for a batchless assessment.

| Capability | Instructor today | Admin today | Evidence / qualification |
|---|---|---|---|
| Dashboard, progress, scores and student competency details | Own cohorts | All students, with current-enrollment summaries | E, H; batch history also available through assessment management and reports |
| List assessments | Own batches and own batchless assessments | All assessments | D, F |
| Create assessment manually, save draft or publish | Yes | API only | A, B, F; published assessments require a batch and valid questions |
| Import assessment questions from XLSX, CSV or TXT | Creator and append workflows | API accepts the parsed questions; import UI absent | B, C, F; file parsing takes place in the frontend |
| Edit question text/type/category/choices/answer key | Yes, before attempts | API only, across assessments, before attempts | C, D, F |
| Add/remove questions in existing assessments | Yes, before attempts | API only, before attempts | C, D, F |
| Edit title, duration, dates, order, publication, required status and competency inclusion | Yes, in scope | Yes, across assessments | D, F; publication transitions are validated |
| View authorized answer keys | Own assessments | All assessments, explicitly loaded in dialog | D, F; students are excluded |
| Approve/revoke a finalized assessment's retake | Own batch's enrolled students | Any eligible batch/assessment through Users or Assessments | E, G; exact assessment is required when ambiguous |
| Create a batch | Yes | API only, with ownership defect described below | E |
| Archive/reactivate a batch | Own batches | API only, across batches | E |
| Select a batch and inspect its full roster | Dedicated Students workflow | Partial equivalents through reports, enrollment selection and assessment dialogs; no dedicated batch workspace | D, E, G, J |
| Import/enroll students, review validation and confirm | Own active batches | Any active batch through Users | E, G; this is already shared |
| Unenroll a student from one batch | Dedicated action | API only, with explicit `batch_id` | E; account archive is a different operation |
| View individual and combined results, integrity state and prior attempts | Own students/batches | System-wide management views | D, E, G; historical attempt records remain distinct from current evidence |
| Assessment progress/completion/competency reports and CSV/PDF export | Scoped reports | All-batch reports through Reports | J; not an admin gap |
| Click a skill leader and open a ranked cohort leaderboard | Yes | No equivalent interactive leaderboard | [Instructor dashboard](../skillbridge-frontend/src/pages/instructor/InstructorDashboard.jsx), line 94; [leaderboard](../skillbridge-frontend/src/components/instructor/SkillLeaderboardModal.jsx), line 140; admin reports show category averages |
| Browse companies, maps, positions and requirements | Yes | Yes | H, I |
| Edit existing company details/image/location and position title/slots/tags | Yes, shared catalog | Yes | H; instructor company editing is not restricted to companies they created |
| Create/delete companies or positions, change position requirements | No | Yes | [Catalog APIs](../skillbridge-backend/api/views.py), lines 3382–3601; referenced placement history protects deletion |
| View ranked candidate students under a position | On Companies and Placements, scoped | On Placements, system-wide | H, I; missing on Admin Companies is a screen difference, not missing admin authority |
| Review suggestions, approve/reject/remove placements, manually assign | Own authorized batch/student records | System-wide | I; capacity, active-account and applicable recommendation checks remain |
| Placement history and exportable placement reports | Own batches | System-wide | I; historical snapshots preserved |
| System-wide placement capacity/area analytics | No | Yes | `placement_analytics`, views.py line 4528; current guard is admin-only despite an outdated test comment/document sentence |
| Add a skill category | Yes, shared category endpoint/authoring | Yes, Skills and shared API | views.py lines 827 and 3618 |
| Edit/delete shared skill categories | No | Yes, deletion restricted when referenced | views.py line 3646 onward |
| Request category/tag suggestions and inspect student/position NLP text | Authorized staff; student text scoped | Authorized staff, system-wide | views.py lines 858/883; [diagnostic APIs](../skillbridge-backend/api/nlp_diagnostic_views.py) |
| Manage NLP configuration, compare models, rerun recommendations, taxonomy diagnostics | No | Yes | views.py lines 927/3532; [comparison API](../skillbridge-backend/api/evaluation_views.py); admin Reports/Skills |
| Add/approve/edit/archive/restore instructor accounts | No | Yes | G; rejection archives the pending account |
| Archive/restore student accounts | No | Yes | G; archiving disables access and preserves history |
| Edit student identity/profile as staff, change roles or manage other admins through the web UI | No | No general workflow | G; student self-profile and reviewed enrollment rules are separate; admin provisioning/recovery is operator-managed |
| Receive live updates | Instructor recipient-scoped stream | Admin recipient-scoped stream | K; separate stream URLs do not indicate missing management access |

## What instructors can do through the interface that admins cannot

### Operational gaps to fix

1. **Create an assessment**, including manual questions, imported questions,
   categories and answer keys, then save or publish it. The admin route/navigation
   has no creator. The admin empty state explicitly says assessments appear when
   instructors create them. The shared POST API already accepts admins and permits
   any batch.
2. **Author questions inside an existing assessment**: edit, add, import and remove
   questions and modify choices/keys/categories before attempts. The admin
   Questions section renders a question/key list. Its save action sends settings
   only; it does not send the instructor editor's `question_changes` payload.
3. **Manage a batch lifecycle from a dedicated screen**: create, archive and
   reactivate batches, with a batch roster as the working context. Existing APIs
   admit admins, but there is no admin batch workspace.
4. **Unenroll a student from a particular batch** without disabling the student
   account. Admin Users provides account archive/restore instead. Account archive
   and enrollment removal have different effects and should be labeled separately.

### Presentation difference

5. **Open an interactive skill-category student leaderboard.** Admins can inspect
   scores and category averages, but cannot open the instructor's ranked cohort
   view. This is lower priority than authoring and batch management.

The position-level matched-student view is also organized differently: instructors
see it in Companies as well as Placements; admins already have it in Placements.
It should not be counted as an absent admin business capability. Enrollment,
retakes, assessment reports and placement decisions likewise already work for
admins.

## Confirmed backend inconsistencies and shared limitations

### Batch creator records the admin as the instructor

`instructor_batches` permits both roles, but creation always uses
`Batch.objects.create(..., instructor=request.user)` at views.py line 974.
The model accepts a general User FK, so the database does not prevent an admin
from occupying this instructor field. A synthetic signed-JWT request containing
an actual instructor's `instructor_id` still created an admin-owned batch.

Impact: simply exposing the existing create button would not let an admin create
a batch for a selected instructor. The expected instructor would not receive
ownership-based access. Instructor attribution would also become misleading.
There is no existing batch rename/reassignment API to repair this through the app.

### Two shared-role reads still use acting-user ownership

- `instructor_student_recommendations` accepts admins but selects the first active
  batch with `instructor=request.user` (views.py line 2489). An admin with no owned
  batch receives an empty list even when instructor batches/students exist. The
  admin dashboard correctly uses the separate admin recommendation endpoint.
- `instructor_companies` accepts admins but scopes matched students to batches
  with `instructor=request.user` (views.py line 2598). Company records remain
  visible, but candidate lists do not become system-wide just because the caller
  is an admin. Admin Placements already provides the system-wide candidate view.

The first case was reproduced with a signed admin JWT; the second was traced in
source. Sharing those hooks unchanged would make new admin views incomplete.

### Unenrollment needs an explicit batch for admins

`instructor_student_remove` defaults to `Batch.objects.filter(instructor=request.user)`
when `batch_id` is omitted (views.py line 1126). With `?batch_id=<id>`, admins can
unenroll from an instructor's batch. Without it, the same request returned 404 in
the synthetic probe. Require the selected batch in any new admin UI; do not infer
that account archive is a substitute.

### Batchless drafts cannot currently be attached later

Creation permits a batchless draft, but the assessment PATCH handler does not
process `batch_id`. A synthetic admin PATCH containing it returned 200 while the
draft remained batchless; publishing then returned 400. This affects both roles,
so it is not an instructor/admin permission difference. Add validated assignment
for an unattempted draft, or require batch selection when saving a draft. The
preferred plan below supports assigning a batchless draft.

### Entire-assessment deletion is not implemented for either role

The assessment-detail route accepts PATCH only; DELETE returned 405 in the probe.
Neither role has a general assessment-delete feature. Closing an assessment is
already supported. Deletion should be a separate, narrowly scoped requirement,
not described as an existing instructor power missing from admins.

### Admin is not a universal runtime bypass

Business APIs authorize using the stored `user.role` and object scope. Django's
`is_staff`/`is_superuser` and model permission mixin do not automatically override
those explicit checks. The Django admin site is a separate operator interface;
[api/admin.py](../skillbridge-backend/api/admin.py) registers no application models.
Changing one frontend role guard or toggling `is_superuser` will not provide a
complete admin workflow.

## Recommended implementation plan

### Phase 1 — Establish the role contract and fix batch ownership

- Document one capability matrix: admins manage all batches, instructors manage
  their own, and student actions remain student-specific. Keep existing instructor
  access to shared catalog fields unless a separate policy change is requested.
- Add small, shared backend helpers for management role checks and batch/assessment
  scoping, then apply them to touched endpoints. Preserve all existing role denial
  and foreign-object tests; avoid replacing every check with a universal bypass.
- For admin batch creation, require a selected active, approved instructor ID.
  Instructor creation continues to use the signed-in instructor. Keep operational
  ownership separate from the admin who performed the action.
- Add an admin-only batch rename/reassignment operation with explicit validation
  and history handling. Reassignment currently changes access to all assessments
  and historical student records in that batch because authorization follows the
  batch owner. Define that transfer behavior and notify both old and new owners.
- Inventory existing admin-owned batches before proposing any data repair. Present
  affected counts and a proposed mapping; perform no automatic reassignment.

Acceptance: an admin creates a batch for Instructor A; A can manage it, Instructor B
cannot; the acting admin remains identifiable. Inactive or unapproved owners and
unauthorized instructor reassignment are rejected. Existing placements, scores
and creator attribution survive transfer.

### Phase 2 — Expose full admin assessment authoring

- Add an admin assessment-creation route and a New Assessment control on the admin
  page. Extract/reuse the existing creator, import parser and question editor.
  Parameterize destinations, labels and batch selection; the current creator has
  instructor-specific navigation links.
- Let admins filter/select instructor and batch; show both author and responsible
  instructor. Reuse user/role-scoped draft storage, which already admits admins.
- Add editable questions and import/add/remove actions to admin assessment
  management before attempts. Reuse the existing atomic metadata/question save
  contract instead of creating a second authoring implementation.
- Support attaching a batchless, unattempted draft to an authorized batch. Reject
  reassignment after attempts; do not move score evidence between cohorts.
- Keep attempted questions locked for admins and instructors. Display why the
  lock exists. Corrections after attempts should use a new assessment/version and
  an explicit evidence decision, rather than silently replacing graded questions.
- Preserve current publication validation, availability and batch gates,
  assessment-level history, combined competency recalculation and recommendation
  freshness checks.

Acceptance: an admin can create manually or import XLSX/CSV/TXT, save/recover a draft,
assign its batch, edit questions and publish; the assigned instructor can see it.
Question edits after an attempt return 409 while permitted metadata edits work.
Students cannot reach authoring APIs or answer keys. Failed saves retain drafts
and leave the database unchanged.

### Phase 3 — Add an admin batch and enrollment workspace

- Provide all-batch search, instructor/status filters, roster selection,
  create/archive/reactivate and the controlled reassignment action from Phase 1.
- Reuse the shared enrollment preview/confirm workflow already used by Admin Users.
- Expose Unenroll from this batch separately from Archive student account. Always
  send `batch_id`; preserve other enrollments, assessment history and placement
  snapshots. Continue invalidating affected combined evidence and recommendations.
- Define archive behavior accurately in the UI. The current archive action changes
  batch availability and recalculates evidence; it does not enforce a universal
  write prohibition on every staff endpoint. Avoid promising blanket read-only
  behavior unless that is implemented and verified.

Acceptance: admins manage another instructor's batch without changing their own
login role; unenrolling from A leaves membership in B intact and does not disable
the account; archived and active data are clearly distinguished.

### Phase 4 — Resolve read-scope and reporting differences

- Keep existing admin-wide read endpoints where they already fit. For shared cohort
  views, accept an explicit authorized batch filter, or introduce a management
  endpoint with clear scope. Do not reuse an acting-user-only instructor hook for
  a system-wide admin screen.
- Align current-batch selection across the new screens. The instructor dashboard
  uses the first active owned batch, whereas student current enrollment uses the
  latest active enrollment. Show the selected batch rather than hiding that choice.
- Optionally expose the shared skill leaderboard with instructor/batch filters.
  Use the existing combined evidence rules; do not mix category percentages from
  different assessment histories into an undocumented ranking.
- Optionally link Companies to filtered placement candidates; the admin already
  has that capability in Placements, so duplicating its data pipeline is unnecessary.
- Update live-query invalidation and prefetch coverage for every new route and
  action. Ownership transfer must invalidate both prior and new access scopes.

Acceptance: admin views show the intended selected cohort or all-batch scope;
instructors receive only authorized data. Existing assessment/placement exports
continue to reconcile with the corresponding selected records.

### Phase 5 — Record privileged actions and verify the complete workflow

- Add a durable management-action audit trail for relevant admin edits, ownership
  transfers, enrollment changes and retake approvals: actor, action, target,
  timestamp and necessary change metadata. Existing creator fields, placement
  actor fields and cache `ChangeEvent` metadata are not a general before/after
  assessment-edit audit trail. Avoid copying student personal data or answer keys
  unnecessarily into audit records.
- Add permanent regression tests for the implemented contract: admin, owning
  instructor, foreign instructor, student, unapproved/inactive account and anonymous
  caller; include both HTTP authorization and allowed object scope.
- Verify atomic failure, exact-assessment retakes, question locks, other-batch
  preservation, source freshness, publication gates, capacity, report reconciliation,
  draft recovery, live refresh and account-switch cache isolation.
- Run relevant Django tests with disposable settings; run frontend lint/build and
  meaningful unit tests, then real local browser workflows with synthetic users.
  Use dedicated PostgreSQL for row-lock/concurrency and cross-worker SSE evidence.
- Update the overview, admin assessment documentation, live-refresh/navigation maps
  and role descriptions to match delivered behavior. Apply the collection UI and
  React skills during implementation, and the browser-testing skill for browser QA.

Acceptance: one documented admin-through-instructor workflow succeeds locally,
including instructor visibility and student access, with no weakened role boundary
or integrity rule. Report hosted/deployment checks separately.

## Recommended scope for the next implementation task

Start with **admin assessment creation/question authoring and correct instructor
ownership for admin-created batches**. Then add the admin batch/unenrollment
workspace. The interactive leaderboard is optional follow-up work. Keep general
assessment deletion, arbitrary role changes, student impersonation and unrestricted
score editing outside this implementation scope.

## Verification performed for this review

All database verification used `core.test_settings`, an in-memory SQLite database
with in-memory email delivery and provider email disabled. Synthetic identities
were used. No hosted database or real messages were involved.

1. **81 existing tests passed**:

   ```powershell
   # From skillbridge-backend
   .\venv\Scripts\python.exe manage.py test api.test_access_security api.test_management_step4 api.test_authoring_recovery api.test_batch_taxonomy_recovery api.test_admin_account_recovery api.test_enrollment_import --settings=core.test_settings --noinput --verbosity=1
   ```

2. **51 additional existing tests discovered: 49 passed, 2 skipped**:

   ```powershell
   # From skillbridge-backend
   .\venv\Scripts\python.exe manage.py test api.tests.OJTPlacementAPITests api.test_report_reconciliation api.test_catalog_validation api.test_capacity_areas api.test_nlp_diagnostics.TextPreviewAPITests api.test_auth_contract api.test_change_events --settings=core.test_settings --noinput --verbosity=1
   ```

   The skips are the two PostgreSQL-only SSE transport tests. SQLite results are
   not evidence for production concurrency or independent-worker delivery.

3. **10 targeted signed-JWT probes passed**, covering admin assessment creation
   in an instructor batch; composite and individual question editing/addition/
   deletion; both roles' attempt locks; admin batch ownership; cross-instructor
   archive/reactivation/roster access; explicit-batch unenrollment; retake approval;
   the instructor-read/admin-read difference; ignored batch assignment and
   unsupported assessment deletion; and foreign-instructor denial.

   ```powershell
   # From repository root; local ignored review harness
   .\skillbridge-backend\venv\Scripts\python.exe work/role_access_review.py
   ```

   Local reproduction files: [probe harness](../work/role_access_review.py) and
   [final results](../work/role-access-review-results.txt). These are ignored local
   review artifacts, not committed regression coverage. An initial probe assumed
   `student_id` in the admin response; it was corrected to the actual `id` field
   before the successful run.

Total: **140 passed, 2 skipped**. Django system checks in the test runs reported
no issues. This review did not run browser sessions, frontend build/lint, the
entire backend suite or hosted acceptance; no application code changed. Interface
absence and presentation differences were established by route/component source
inspection, not a new browser run.
