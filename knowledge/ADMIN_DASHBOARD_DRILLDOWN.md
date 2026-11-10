# Admin dashboard drilldown

## Active checkpoint · 10 November 2026

Branch: `codex/admin-dashboard-drilldown-20261110`, based on the experimental
assessment Match branch. No merge or GitHub push is authorized for this work.
Unrelated working-tree edits are preserved and excluded from this feature.

Approved design: reuse the instructor dashboard hierarchy, with Institute and
Program selectors in the header. Default school-wide data stays visible. Four
summary cards precede Top matches and Skill results. At school scope these rows
navigate institutes, at institute scope programs, and at program scope they show
student matches and category leaders. Existing uploaded/geometric banners serve
as rectangular institute/program thumbnails. Desktop rows have four cards and
an overflow hint; extra cards scroll horizontally with hidden scrollbars,
arrow controls, touch/trackpad scrolling and keyboard access. Smaller screens
keep readable cards. All students remain searchable and paginated in every scope.

Implementation and local verification complete. The feature is ready for user
review on this branch; no main merge or GitHub push.

## Read contract and behavior

- `GET /api/management/analytics/?view=dashboard` is admin-only. It reuses the
  analytics scope, enrollment selection and evidence gates, with bulk-loaded
  combined categories and the saved top recommendation. It omits report maps,
  submission history and answers. Reads never recalculate recommendations.
- The four cards show students, required complete, students needing actionable
  follow-up, and approved-placement progress. Attention queues, reports,
  administration and remaining shared capacity stay available under Attention
  and administration. Recommendation maintenance remains on Placements.
- Scope changes reset dependent program/student pagination and carousel state.
  Background reconciliation retains controls, page and current content. A failed
  new scope does not display the previous scope's totals. Invalid scopes remain
  explicit rather than falling back to school-wide data.
- Institute/program cards summarize the same distinct newest-enrollment cohort
  as the current table. Shared-institute rows appear in each program card.
  Opening a program applies the backend's full program/shared batch scope, which
  can include a different newest selected enrollment for a multi-enrolled student.
  The page explains this cohort and overlap rule instead of summing program cards.
- Category identity is preserved across different frameworks/versions, including
  identical names. Counts of assessed categories never become an invented
  cross-discipline average. Unassessed/locked values stay missing and earned zero
  remains zero. Current saved Match units and the average category score stay
  separate; Match display uses the shared rounded formatter.
- Program-level student matches and skill leaders also use the carousel variant;
  the instructor dashboard retains its existing grid. Lazy leaderboard closure
  restores focus to its category card. Student details fetch only the selected
  batch/student through the existing authorized endpoint, with read-only actions.
- The default school-wide dashboard and header bell share one query. Filtered
  dashboard scopes retain independent school-wide notification data. Destination
  preparation follows valid scope filters. The client validates the new response
  before caching it. A backend without this projection produces an explicit retry
  state; deploy the corresponding frontend and backend together.

## Checks actually run

- Frontend lint, production build and all **360 source Node tests** passed.
  Receipts: `work/admin-dashboard-lint.txt`, `work/admin-dashboard-build.txt`,
  `work/admin-dashboard-node.txt`.
- **32 API tests** passed on SQLite and isolated PostgreSQL, covering authorization,
  distinct enrollment scope, shared full rosters, numerical zero, stale rankings
  with retained scores, lazy detail access, no writes and bounded query counts.
  Receipts: `work/admin-dashboard-api.txt`,
  `work/branch-review-postgres-xt67vj1a/tests.txt`.
- **Seven dashboard browser groups** passed against the production bundle and a
  temporary synthetic database. Includes four full desktop cards, independent
  hidden-scrollbar rows, arrows/keyboard/focus, scopes, search/clear, card/list
  equivalence, empty/invalid/failure/retry, populated categories and leaderboards,
  pagination and simulated live-query refresh with the current page retained.
  Widths: 320, 390, 768, 1024, 1440 and 1920px, including dark/reduced-motion cases.
  Receipt/screenshots: `work/organization-browser-4eetlwfz/`.
- **Eight retained admin workflow groups** passed, including scoped reports,
  attention drilldowns, archived scope, empty institutes, maintenance confirmation
  and uncertain-completion handling: `work/organization-browser-tdyopci8/`.
- **Twenty sign-in/loading/recovery groups** passed for all roles, including
  deduplicated dashboard preparation, deadline handoff, cancellation/account
  switching, failed API recovery and bounded background warming:
  `work/organization-browser-l9p4210s/`.
- **Nine shared-visibility workflow groups** passed for both IC programs and an
  arbitrary non-IC institute, including the full roster, report/export scopes,
  coordinator editing and responsive layouts:
  `work/organization-browser-i5369vfp/`.
- Desktop and phone screenshots, plus the populated program layout, were visually
  reviewed. Earlier attempts found the missing response-validation contract,
  padded snap alignment and lazy leaderboard focus return; these were corrected
  and the final dashboard flow passed. Older regression selectors/fixtures were
  updated for the approved redesign.

No known failure remains in these feature checks. Browser fixtures block external
providers, simulate the live-query invalidation event for the refresh assertion,
and do not establish hosted SSE delivery, physical-device behavior or deployment
readiness of the whole application. Owned test helpers stopped their servers.
No schema migration, dependency change, configured-school-data write or live
recommendation refresh occurred. Unrelated checkout changes remain untouched.

Next step: review `/admin/dashboard` locally at school, institute and program
scope. Main remains `0fb2c1d`; merge/push requires the user's later instruction.

## Shared instructor collection correction · 10 November 2026

The user requested the actual instructor table/card UI instead of a separately
designed admin collection. Extracted the instructor dashboard's toolbar, cards,
table, tinted skill pills, OJT badges, company strip, Overall cell, hover/focus
feedback, score legend and pagination into
`skillbridge-frontend/src/components/dashboard/DashboardStudentCollection.jsx`.
Both dashboard routes now render that component; the admin-only collection was
removed. Admin adds its institute/program/batch context under student identity.
Instructor data and selected-profile state stay in its role hook; collection
search/filter/sort/view/page state is owned once by the shared component.

No endpoint, role authorization, grade, Match calculation or scope policy changed.
Unknown category percentages render a dash, earned zero remains zero, and an
approval in another batch stays explicit. The existing instructor presentation
now has keyboard-operable sort controls and a contained narrow-table scroller.

Verification complete: frontend lint, production build and all 360 Node tests
passed. Seven dedicated browser groups verified both real staff dashboard routes
use identical table/header/row/card classes, along with keyboard details/focus,
card hover, shared page slices, sort/filter resets, missing-versus-zero values,
separate Match/Overall values, approval elsewhere, phone cards and contained
tablet tables in light/dark modes. Receipt: `work/organization-browser-9p2j55l_/`.
Seven scoped dashboard regression groups also passed after the replacement,
including silent event reconciliation with pagination retained:
`work/organization-browser-6h0p2qmp/`. Desktop screenshots were reviewed for both
roles. These use synthetic data, not configured school records. Backend tests
were not repeated because no backend behavior changed in this correction.

Next: user review of the shared table/cards on the same local feature branch.
Main and GitHub remain unchanged, and unrelated working-tree edits are preserved.
