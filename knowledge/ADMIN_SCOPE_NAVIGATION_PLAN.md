# Admin institute and program navigation

Branch: `codex/admin-scope-navigation`. Preserve unrelated instructor-assignment
and optimization edits. Merge locally only after verification; do not push.

## Accepted flow

- [x] Batches: institute banner cards → program banner cards → batches → roster.
- [x] Assessment oversight and archives: same institute/program selection, then
  scoped assessments with the existing batch filter and management actions.
- [x] Retakes: institute/program selection and visible institute/program/batch
  context on requests and reviews; filter on the server before pagination.
- [x] Partners: linked institute then program dropdowns, no records before an
  explicit selection. Original unconfigured openings remain in the IC catalog.
- [x] Placements: institute/program selection before workspace loads; retain
  global shared capacity and recorded decision scope.
- [x] Explicit All programs within a chosen institute preserves mixed IC batches
  and original shared IC openings without relabeling or deleting records.
- [x] Verify invalid links, back navigation, scope switching, archived/empty
  programs, filters, pagination, phone/dark layouts and instructor regression.
- [x] Run focused API/browser tests and frontend lint/build. Record receipts.

The program hierarchy is generic for every institute. Institute/program card
images and saved geometric colors come from the same catalog as Skills. Scope
selection is navigation, not an account permission or placement-eligibility change.

## Behavior and preservation

The shared navigator uses the institute/program banners already saved for Skills.
Its choices are in the URL, support browser Back/refresh, validate that the program
belongs to the institute, and mount the record collection only after selection.
Cards have search, pagination, keyboard links, hover/focus feedback and archived
labels. Partner selectors cascade and reset the program when the institute changes.
Invalid links show an unavailable state; a failed choices request has Retry choices.

Filter resets retain the organization selection. Changing it remounts the record
workspace and resets its record filters/pages. Batch links retain their batch/email
parameters through the choice cards; a conflicting batch cannot open a roster or
email dialog outside the chosen scope. New batches default to and keep the selected
program. Creation requires a specific active program; existing records remain
readable through All programs and archived program choices.

Assessment oversight keeps its batch/instructor/publication and other filters.
Archives and Back to assessments preserve scope. Retake current/history queries
filter by the recorded batch institute/program before counting and pagination,
without expanding an instructor's managed batches. Cards, table rows and reviews
show that context; the student's current profile is not used to relabel the request.

New admin partners record the selected management program. Creating a partner
requires an active specific program; the server validates it. New positions start
with that program selected, while admin-managed explicit sharing remains available.
Original IC openings keep their shared requirements and eligibility. Their UI says
IC shared batch eligibility rather than labeling them past/legacy records.

Placement scope covers its companies, candidate batches and recorded decision
history. Clear filters resets pagination but retains institute/program selection.
Shared slot occupancy remains global. Reports retain their separately labeled
filters and server validation; selection changes do not recalculate evidence or
reassign placement decisions.

A configured read-only transaction confirmed **5 partners, 6 positions**, all six
using shared skills and unconfigured program eligibility, with **zero** explicit
program links or program owners. No existing partner/position was saved as eligible
for other programs. The initial unscoped view obscured their IC context. Existing
records therefore need no data rewrite and remain under IC → All IC programs.
No schema migration, configured data write, push or deployment is included.

## Verification

- Frontend lint and production build passed; all **348** Node tests passed.
- Django system and migration-drift checks passed, with no model changes.
- **40** isolated PostgreSQL tests passed (navigation scopes, current/history
  retakes, catalog validation and opportunity eligibility), including private
  instructor and student boundaries, invalid IDs, scoped partner persistence, and a program archived during image preparation.
  Evidence: `work/organization-postgres-72ec4aid/`.
- The retained staff regression passed **12** real-API browser groups covering
  cards/images, mixed IC scope, program catalogs, shared capacity, scoped placement
  exports and instructor phone navigation. Evidence:
  `work/organization-browser-yqhceopm/`.
- Final admin navigation matrix passed **10** real-API browser groups with zero
  page errors. It covers initial selection gates, drilldown/back/refresh, matching
  and conflicting batch links, archive links, cascading partner filters and saved
  ownership, current/history retake paging and context, placement history, invalid
  contexts, empty/archived programs, choices retry, four responsive widths and
  instructor dark-phone regression. Evidence:
  `work/organization-browser-ypmiu0qv/`. Total browser groups: **22**.

Early browser runs corrected stale test selectors and direct-fixture cache setup.
A concurrent build also replaced preview assets during one run. Preview runners
now copy the completed bundle into their owned evidence directory before starting
Vite, so other workspace builds cannot remove the run's hashed assets. Initial
sandbox attempts could not connect to loopback servers; the dedicated runners
were rerun with permission and own their synthetic databases/server cleanup.

## Checkpoint

Resumed on CONTINUE, 6 November 2026. Final screenshot and diff review completed.
The 320/390/768/1440px card layouts were reviewed, with no clipping or hidden
navigation. The final review added one save-race guard: an active program is
revalidated under the existing institute lock after image preparation, before
partner persistence. The 40-test PostgreSQL rerun passed, including that case.

Feature branch: `codex/admin-scope-navigation`, based on `f168a37`. Implementation,
focused verification and review are complete; delivery is a feature commit followed
by a fast-forward to local main. No schema migration, configured write, push or
deployment is part of this delivery. Test runners completed and cleaned up their
owned servers. Known unresolved feature failures: none from the checks performed.

Next use: review the admin institute → program journeys locally, especially IC →
All IC programs for existing shared records. Keep reports' separately labeled
filters in mind when downloading a different scope. No automated continuation or
GitHub push is authorized by this checkpoint.

Task-owned delivery files:

- This plan and `knowledge/STAFF_WORKSPACE_SCOPE_AND_NAVIGATION.md`.
- Backend: `api/retake_requests.py`, `api/views.py`,
  `api/test_admin_navigation_scope.py`.
- Frontend components: `admin/AdminScopeNavigator.jsx`,
  `admin/CompanyCollectionCard.jsx`, `admin/PositionDialog.jsx`,
  `RetakeReviewDialog.jsx`, `TaxonomyLibraryCards.jsx`.
- Frontend hook/util: `hooks/admin/useAdminCompanies.js`,
  `utils/organizationScope.js`.
- Frontend pages: `RetakeRequests.jsx`, `admin/AdminAssessments.jsx`,
  `admin/AdminBatches.jsx`, `admin/AdminCompanies.jsx`, `admin/AdminPlacements.jsx`,
  `assessments/AssessmentArchives.jsx`, `placements/PlacementWorkspace.jsx`.
- Frontend tests: `admin_scope_navigation_playwright.py`, `organization_server.py`,
  `run_organization_browser.py`, `staff_scope_playwright.py`.

Unrelated ongoing edits observed at pause must stay outside this feature commit:
`knowledge/DYNAMIC_PROGRAM_PROFILES.md`, `knowledge/PROJECT_OVERVIEW.md`,
`knowledge/PROGRAM_ASSIGNMENT_PICKER.md`, `knowledge/SYSTEM_OPTIMIZATION_PLAN.md`,
`src/components/ProgramSelect.jsx`, `src/components/admin/AddInstructorModal.jsx`,
`src/components/admin/InstituteProgramSelect.jsx`,
`src/components/admin/addInstructor.css`, `src/components/programSelect.css`,
`src/index.css`, `src/pages/admin/AdminUsers.jsx`,
`src/pages/admin/userManagement.css`, `tests/dynamic_profiles_playwright.py`,
`tests/program_batches_playwright.py`, and
`tests/program_assignment_cards_playwright.py`. Source/test paths in this list are
relative to `skillbridge-frontend/`.
