# Student detail modal redesign

Implemented 29 September 2026. This is a frontend-only presentation change. Existing user changes in AGENTS.md, PROJECT_OVERVIEW.md, SKILL_SOURCES.md and the untracked design-taste skill were preserved.

## Architecture and initial audit

The instructor popup was a small StudentModal shell around AssessmentStudentDetail. The administrator popup used its own shell around the same component, with an alternate instructor edit form. Both used a 3xl maximum width, a scrolling region containing the tabs, text-only Close controls, and backdrop click handling. Neither shell supplied a complete focus/scroll lifecycle. ConfirmModal used a separate z-index overlay.

Every opening path inspected:

| Page | Opening paths | Endpoint / normalization |
| --- | --- | --- |
| EnrolledStudents | Student grid cards and table rows; archived batch rosters use the same modal | /api/instructor/batches/ then /api/instructor/batches/:id/students/ → normalizeStudent in useEnrolledStudents |
| InstructorDashboard | Student grid cards, table rows, and the skill leaderboard callback | /api/instructor/students/recommendations/ → useInstructorDashboard |
| SkillLeaderboardModal | PodiumCard selection, additional ranked cards, and ranked table rows; its callback closes the leaderboard and opens dashboard StudentModal | Already scoped dashboard students; no detail refetch |
| AdminUsers | User grid cards and table rows; role determines student versus instructor presentation | /api/admin/users/ → useAdminUsers |
| AdminAssessments | Student roster button opens an inline AssessmentStudentDetail section, not a student modal | Assessment management roster payload remains raw snake_case |

Scoped batch/student endpoints check staff roles and instructor batch ownership. The dashboard endpoint uses the requesting instructor's active batch. The admin users endpoint requires administrator access. Retake PATCH validates the staff role, exact assessment, finalized response, enrollment and instructor ownership. These backend checks were inspected and left unchanged.

Normalized student fields vary by hook. Their union is:

| Area | Fields |
| --- | --- |
| Identity/enrollment | id, name, studentId, email, course, photoUrl, batch, instructor, role, archived |
| Legacy assessment summary | status, scores, tags, retakeAllowed, assessmentId, isFlagged, stoppedReason, violationCount, competencyProfile |
| Legacy recommendation summary | match, position, company, top_recommendations |
| Current final evidence | assessmentResults, completedRequiredCount, totalRequiredCount, remainingRequiredCount, recommendationsLocked, combinedCategoryScores, combinedCompetencyProfile |
| Placement/location | placement, address |

Roster normalization had dropped the batch wrapper; dashboard normalization had dropped its supplied batch field. These are now retained. Instructor identity uses existing signed-in context when available. Admin identity uses the existing supplied instructor field. No new API fields were added.

Current assessment results contain assessment ID/title, publication/required/inclusion settings, attempt status, response/start/submission metadata, category raw/max/percentage values, integrity flags/reason/count, retake approval and prior attempts. Current management results do not supply an overall total score or separate stopped timestamp; these are not invented. Current stopped attempts use their supplied finalization/submission timestamp, labeled Finalized.

Archived attempts contain attempt number/status, start/submission/stop timestamps, integrity metadata and category snapshots. Some snapshots contain category IDs without names. The UI resolves names from available current category rows and otherwise displays Category followed by the supplied ID. Answer snapshots are never rendered.

Existing loading behavior remains in the page hooks: dialogs open from already returned records, and refreshed scoped data synchronizes the selected record. Switching tabs does not request data.

States preserved and presented explicitly: no active batch, no required assessments, empty results, pending/not started/in progress, submitted, stopped/flagged, archived student/batch, recommendation/profile lock, current finalized profile, unplaced/approved placement, approved/revoked retake, and empty/populated prior history.

Authorized actions remain assessment-specific staff retake approval/revocation and existing administrator edit/remove callbacks. Dashboard details are explicitly read-only. Archived student/batch controls are hidden. Administrator save, cancel and remove confirmation flows remain intact, including their existing hook behavior; this task does not change persistence semantics.

## Design and shared structure

A restrained academic operations workspace uses the existing font, neutral white/gray surfaces, green active controls, amber unplaced status and rose integrity/destructive treatments. The main dialog is 1000px wide at most, 92dvh high, and constrained inside the viewport. Below 640px it becomes a 98dvh sheet. Tablet summaries stack below 768px. Safe-area spacing is included.

The avatar/identity header, close control and tab strip are outside the scrolling panel region. Content height remains stable across all five tabs. The administrator action footer stays reachable independently of panel scrolling.

```text
+-------------------------------------------------+
| Avatar  Name / ID / course                   [X] |
|         Email / batch / completion               |
+-------------------------------------------------+
| Overview | Assessments | Combined | ...          |
+-------------------------------------------------+
| Required assessment progress                    |
| Profile / enrollment       Current OJT           |
| Assessment snapshot                              |
|           independent content scroll             |
+-------------------------------------------------+
| Administrator removal action, when present       |
+-------------------------------------------------+
```

DialogShell is the reusable native-dialog shell. StudentDetailModal supplies one shared identity treatment. Instructor StudentModal and administrator student UserDetailModal both delegate to it. Administrator instructor records use the same shell with their existing edit fields, without student tabs. ConfirmModal uses the same shell with an intrinsic-height confirmation variant.

AssessmentStudentDetail owns the shared five panels and retake confirmation state. Its default inline variant has natural height, compact placement treatment, stacked summary sections and no modal-only snapshot. Only the modal variant owns an independently scrolling content region.

## Information hierarchy and behavioral guardrails

- Overview: API completion counts, a single progress bar, honest zero-required empty state, lock/finalization state, supplied finalization date, enrollment, current placement and a compact modal-only assessment snapshot.
- Assessments: compact individual items with settings, current attempt status, submission/finalization date, aligned category raw/max/percentage rows, restrained integrity notice/count and explicit exact-title retake controls. Inclusion labels represent assessment settings; only eligible submitted/unflagged evidence contributes to the final profile.
- Combined competency: locked state suppresses all partial profile/scores. Unlocked data displays orientation, structured category values, source-assessment context where supplied, structured development suggestions, actual model_used and finalization date. The frontend does not aggregate or recompute scores.
- Recommendations: endpoint order becomes numbered ranks. Company and position lead; Hybrid match, Category fit, NLP fit and Location fit use the existing ScoreLabel explanations. Distance and approved-placement relationship appear where available. Recommendations are fit evidence, not success probabilities or placement approval.
- Retake history: archived attempts appear in a compact timeline, with snapshot scores and integrity metadata. Historical contributions are explicitly distinguished from current results. Retake approval grants permission; archival/reset occurs when the student starts the approved retake, as the current backend code specifies.
- Visibility: missing lock information defaults locked. Locked final profiles, combined scores and recommendation rows are removed before rendering, including from inactive panels. Explicitly stale rows are suppressed if is_current=false is supplied. API-side batch/current-evidence filtering remains the source of truth when that flag is omitted.
- Placement: the existing PlacementStatusCard retains its semantics and snapshot values. Its opt-in detail treatment wraps long text, improves label contrast and avoids a large empty unplaced card.
- Integrity and security: no answer keys, hidden correctness or archived answer snapshots are rendered. Existing backend authorization, scoring, required-progress gates, evidence eligibility and ranking weights are unchanged.

The assessment-review and recommendation-audit skills were applied as guardrails. Existing backend tests verify exact-assessment targeting/ownership, score replacement, stopped/flagged completion exclusions, optional-only locks, stale recommendation suppression and answer-key protections.

## Accessibility and React behavior

Native top-layer dialogs stay above sidebars, sticky headers and tables. Nested confirmations open above their parent; Escape/backdrop cancellation affects the top dialog. A pointer press starting inside and ending outside does not dismiss the parent.

The shell supplies accessible title/description, aria-modal, an icon close button with a 44px target, initial focus, local Tab/Shift+Tab wrapping, body-scroll locking with nested lock counting, and focus restoration. Native inert behavior prevents background interactions. Dialogs yield to the existing session-expiry UI.

Tabs have matching tab/panel IDs, aria-controls, aria-labelledby, aria-selected, one roving tab stop, arrow navigation, Home/End support and visible focus. Small screens use readable horizontally scrolling tabs. Panels remain mounted across switches. Reduced-motion overrides and existing light/dark themes are respected.

Static tab/score-label configuration is outside render. Completion percentage is derived from supplied counts during render. Retake state stores only the assessment ID and resolves the current result on each render. No detail fetch is introduced. Tooltip portals stay inside native dialogs, and tooltip listeners exist only while an explanation is open. The legacy roster Escape listener defers to native dialogs; the dashboard detail Escape listener was removed. No heavy application dependency was added.

## Exact file inventory

All paths below are relative to the repository root.

Created:

- skillbridge-frontend/src/components/DialogShell.jsx
- skillbridge-frontend/src/components/StudentDetailModal.jsx
- skillbridge-frontend/src/components/studentDetail.css
- skillbridge-frontend/src/utils/studentDetail.js
- skillbridge-frontend/src/utils/studentDetail.test.mjs
- skillbridge-frontend/tests/.gitignore
- skillbridge-frontend/tests/student-modal/index.html
- skillbridge-frontend/tests/student-modal/data.mjs
- skillbridge-frontend/tests/student-modal/fixture.jsx
- skillbridge-frontend/tests/student_modal_playwright.py
- knowledge/STUDENT_DETAIL_MODAL_REDESIGN.md

Changed:

- skillbridge-frontend/eslint.config.js
- skillbridge-frontend/src/components/AssessmentStudentDetail.jsx
- skillbridge-frontend/src/components/Avatar.jsx
- skillbridge-frontend/src/components/Icons.jsx
- skillbridge-frontend/src/components/ScoreLabel.jsx
- skillbridge-frontend/src/components/admin/ConfirmModal.jsx
- skillbridge-frontend/src/components/admin/UserDetailModal.jsx
- skillbridge-frontend/src/components/instructor/StudentModal.jsx
- skillbridge-frontend/src/components/placements/PlacementStatusCard.jsx
- skillbridge-frontend/src/hooks/admin/useAdminUsers.js
- skillbridge-frontend/src/hooks/instructor/useEnrolledStudents.js
- skillbridge-frontend/src/hooks/instructor/useInstructorDashboard.js
- skillbridge-frontend/src/pages/admin/AdminUsers.jsx
- skillbridge-frontend/src/pages/instructor/EnrolledStudents.jsx
- skillbridge-frontend/src/pages/instructor/InstructorDashboard.jsx

ESLint ignores only generated browser artifacts and the isolated Python runtime; the new JS/MJS files are linted. Existing unrelated lint failures were not repaired or suppressed.

## Verification

Global npm launchers fail because C:\Users\acer\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js is missing. Both requested npm run lint and npm run build were attempted. Node v24.14.1 is available, so equivalent installed project-local entry points were used.

From skillbridge-frontend:

```powershell
node --test
node node_modules/eslint/bin/eslint.js . --format json --output-file tests/artifacts/full-lint.json
node node_modules/vite/bin/vite.js build
python tests/student_modal_playwright.py
```

Targeted ESLint, covering every changed or created JS/JSX/MJS file:

```powershell
node node_modules/eslint/bin/eslint.js eslint.config.js src/components/AssessmentStudentDetail.jsx src/components/DialogShell.jsx src/components/StudentDetailModal.jsx src/components/instructor/StudentModal.jsx src/components/admin/UserDetailModal.jsx src/components/admin/ConfirmModal.jsx src/components/Avatar.jsx src/components/Icons.jsx src/components/ScoreLabel.jsx src/components/placements/PlacementStatusCard.jsx src/hooks/admin/useAdminUsers.js src/hooks/instructor/useInstructorDashboard.js src/hooks/instructor/useEnrolledStudents.js src/pages/instructor/InstructorDashboard.jsx src/pages/instructor/EnrolledStudents.jsx src/pages/admin/AdminUsers.jsx src/utils/studentDetail.js src/utils/studentDetail.test.mjs tests/student-modal/fixture.jsx tests/student-modal/data.mjs
```

From skillbridge-backend, with the existing isolated SQLite test settings:

```powershell
.\venv\Scripts\python.exe manage.py test api.tests api.test_multiple_assessments api.test_combined_competency api.test_management_step4 api.test_nlp_diagnostics api.test_nlp_evaluation --settings=core.test_settings --noinput
```

From the repository root: git diff --check.

| Check | Result |
| --- | --- |
| All frontend Node tests | 24 passed, including 7 new presentation guard tests |
| Targeted ESLint | Exit 0; zero errors or warnings in task files |
| Full ESLint | Exit 1; 17 pre-existing errors and 8 warnings in untouched files |
| Production Vite build | Exit 0; existing large-chunk warning remains |
| Backend behavioral tests | 76 passed; in-memory SQLite only; system check clean |
| Playwright | 29 groups passed; headless Chrome 153; zero page errors |
| git diff --check | Exit 0; no whitespace errors |

Full lint errors remain in AddressDropdowns, SkillTagBadge, PendingDetailModal, SkillLeaderboardModal, ToastContext, useAdminCompanies, useAdminSkills, useAssessmentUpload, useStudentProfile and StudentSetup. Warnings remain in useApi, AdminCompanies, InstructorCompanies, StudentDashboard, StudentProfile, StudentResults and StudentSetup. Detailed machine-readable lint results are in skillbridge-frontend/tests/artifacts/full-lint.json.

The pure tests cover fail-closed final evidence, server-count progress, zero-required completion, completed-but-locked explanation, preservation of supplied combined scores, explicit stale-row filtering, historical count, missing score formatting, structured development suggestions and placement relationship semantics.

Playwright uses synthetic fixtures and intercepts every backend API request during real-page checks. It does not start a live backend or write student results. It verifies all five panels in light/dark at 375x812, 768x1024, 1024x768 and 1366x900; stable dialog bounds; no horizontal panel/document overflow; independently scrolling content; anchored identity/tabs; visible close button; keyboard navigation; focus trapping/restoration; Escape/backdrop/drag behavior; nested approval/revocation at mobile and desktop; empty/pending/locked/unlocked/archived/flagged/unplaced/approved states; long names/email/category/title/company/position strings; compact inline behavior; session expiry; actual roster/dashboard/admin normalization; no tab-triggered refetch; selected-record synchronization; and administrator instructor editing/removal confirmation.

## Screenshots

Screenshots are synthetic. All are under skillbridge-frontend/tests/artifacts/student-modal/; generated artifacts are ignored by Git. results.json records the 29 passed groups and screenshot filenames.

| Requested view | Screenshot |
| --- | --- |
| Overview desktop | overview-1366-light.png |
| Assessments | assessments.png |
| Combined competency | combined-competency.png |
| Recommendations | recommendations.png |
| Retake history | retake-history.png |
| Locked state | locked-mobile.png |
| Approved placement | approved-placement-mobile.png |
| Mobile light | overview-375-light.png |
| Mobile dark | overview-375-dark.png |
| Nested confirmation mobile | nested-retake-375.png |
| Nested confirmation desktop | nested-retake-1366.png |
| Actual instructor roster with mocks | integration-students-instructor.png |
| Actual instructor dashboard with mocks | integration-dashboard-instructor.png |
| Actual administrator student modal with mocks | integration-users-admin.png |

Additional overview screenshots: overview-768-light.png, overview-768-dark.png, overview-1024-light.png, overview-1024-dark.png and overview-1366-dark.png. Nineteen screenshots total.

Visual inspection covered representative desktop overview/results/combined/recommendations/history, approved placement, mobile/dark and nested confirmation renders. Readable numeric values and text convey status independently of color.

## Limits and preserved systems

Browser automation used installed headless Chrome on Windows, synthetic data and mocked management endpoints. Real student records, real mutation persistence, Firefox/WebKit, screen-reader announcements and physical mobile safe-area behavior were not exercised. Current-attempt stopped_at and total-score fields are unavailable in the present management payload. Category names cannot be recovered when neither a snapshot nor current scores supply them; IDs are shown honestly.

No backend files, API payloads, database schema, assessment scoring, combined competency rules, recommendation formula/locking, placement approval or role authorization were changed. No Supabase records or migrations were changed. No Railway or Vercel deployment occurred. Existing tracked and untracked work was preserved.

