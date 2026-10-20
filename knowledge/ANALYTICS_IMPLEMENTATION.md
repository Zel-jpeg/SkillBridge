# Staff dashboard and Reports & Analytics implementation

Implemented locally, 20 October 2026. Frontend and backend changes; **no schema
change or new migration**. No configured/live database, deployment, recommendation
regeneration, real account change or notification was used for this work.

User instruction: on PAUSE, stop safely and record remaining work here; resume
on CONTINUE. The approved scope is the full dashboard/analytics proposal with
historical trends limited to evidence actually retained by the application.

## Delivered

### Header simplification — 20 October 2026

Both dashboards omit the standalone Open Reports & Analytics link below the
summary cards. Both analytics pages start with the Reports & Analytics title,
without the Institution reports / Batch reports label. Sidebar navigation,
linked summary cards and attention links remain available.

### Latest layout and table alignment — 20 October 2026

The user requested dashboard-style tables and removal of isolated utility cards.
The standalone Scope & report notes card is removed. A short displayed-scope line
and distinct-student explanation sit below the existing scope filters; archived
read-only context appears there when relevant. Activity history limits, shared
capacity and recommendation/approval distinctions remain beside their relevant
charts; downloads retain scope/methodology metadata and a snapshot notice.

Individual assessment reports now expand inside the existing analytics records
card on the Assessments tab. `AssessmentReportPanel` accepts `embedded` to omit its
own border/padding/duplicate heading. Its generation/filter/export behavior and
standalone use on the instructor Assessments page remain available.

Student analytics tables now use shared 28px avatars/initials, school ID/course
subtext, status pills, muted 12px headers, soft alternating rows, green hover and
centered/tinted match values. The default columns are Student, Instructor,
Assessment status, Placement, Top recommendation and Match. Required progress and
locked final results remain explicit in the assessment-status cell; full evidence
is accessible through Show all columns and the authorized student dialog.

All analytics aggregate tables and embedded generated assessment tables share
`components/analytics/reportTableStyles.js` for their frame/header/row/cell styling.
TanStack sorting, pagination, mobile cards, background refresh and error handling
are preserved. The already-returned top recommendation position/company are now
included as two additional CSV/PDF columns; original columns remain intact and
category score columns still follow them. No backend fields, permissions, ranking,
grading or database changes are introduced.

Layout verification: frontend lint/build and 16 analytics/cache unit checks pass.
All 24 isolated browser/API groups pass for admin and instructor, including six
default/fourteen full student columns, avatars/status/recommendation identity,
matching sorted CSV fields, real embedded assessment report generation and PDF
download, details/focus return, background date updates, safe error recovery and
375/768/1024/1440px light/dark tab layouts. The student and embedded-report table
screenshots were visually inspected using synthetic records. All 20 local
collection-skill/reference links resolve. Live deployment and production data
were not exercised; the new reference images with real student data were not saved
in the repository.

### Current refinement: compact text and chart/table libraries — 20 October 2026

The user refined the first readability revision: 14–16px text looked too large
beside other SkillBridge pages. Ordinary descriptions, controls, table cells,
chart labels and score guides now use 12px; headings and summary values remain
larger. The improved grouping and whitespace are retained. The local collection
skill/reference records this preference instead of prescribing 14–16px text.

The score guide now explains the unchanged bands in words: **Strong — 80% and
above**, **Fair — 60% to below 80%**, **Needs work — below 60%**. This preserves
decimal results correctly. It explains that bars count students by their final
score in each skill. Missing/locked results remain separate and available in
tooltips, count lists and the category table.

- Recharts 3.10.1 renders horizontal comparisons, stacked count charts, the placement
  donut and submission activity. Charts have axes, tooltips and selectable data.
  Native labeled controls/count disclosures provide keyboard access and access to
  zero values. Full labels remain in tooltips and count lists when axis labels shorten.
  Chart animation is disabled; colors follow the existing score/status meanings.
- TanStack React Table 8.21.3 provides column visibility and client-side sorting
  across all filtered records before pagination. Tables use sticky headers, subtle
  alternating rows and accessible sort buttons with `aria-sort`. Cards and exports
  use the same sorted record identities. CSV/PDF exports retain every column and
  every filtered row and include the chosen sort in the snapshot metadata.
- React Is 19.2.4 supplies Recharts' peer dependency, matching installed React.
  Dependencies are declared/locked and load with the existing lazy report route.
  The TanStack hook is deliberately not React Compiler memoized; this Vite app
  does not configure that compiler and table consumers read the live instance.

This refinement changes frontend presentation and ordering only. API aggregation,
role authorization, skill thresholds, grading, ranking and the export population
are preserved. Earlier revision details and checks below are historical.

The user's follow-up also addresses filter refresh behavior. `useAnalyticsData`
retains the last successful, still-cached report across filter URLs. Requests still
use the shared Axios/cache/SSE lifecycle; previous results are never written under
a new filter key. The page shows a background-update status and swaps to the new
report only after a valid response. Late results for superseded filter URLs cannot
replace the current report. Record DOM/search/sort/page state survives date updates.

Activity dates are drafts applied together using **Apply dates**, with local checks
for missing/reversed/future ranges and the existing 366-day limit. The visible form
states the range represented by the displayed data; dates do not change cohort
totals. Errors keep the last good report with an explicit warning and **Retry report**.
Exports are disabled until the selected report succeeds, preventing a stale report
from being downloaded under new filter labels. Access loss (401/403/404), session
expiry or removal of the fallback's source cache never retains protected records.
Initial loading/failure still has a section skeleton or retryable error.

Current refinement verification: frontend lint and production build pass, with
16 analytics/cache unit checks and 20 isolated browser/API check groups passing.
The browser suite verifies both roles, 12px table/control text, plain-language
score ranges, real chart tooltips/bar/donut selections, keyboard count controls,
all-row sorting/export order, details/focus, date validation without a request,
retained report DOM/document during delayed requests, newest-selection wins,
safe 503 messages/retry and definitive 403 record removal. Responsive light/dark
checks cover all three tabs at 375/768/1024/1440px in Chrome. Recharts resizing is
allowed to finish through ResizeObserver before measuring overflow. Skill
frontmatter validation passes. No backend, database, deployment or real-data
operations are part of this refinement. A dependency audit did not list either
new library or its new dependencies among the existing reported advisories;
unrelated dependency upgrades were not included.

Library references: [Recharts installation](https://recharts.github.io/en-US/guide/installation/),
[TanStack sorting](https://tanstack.com/table/v8/docs/guide/sorting) and
[column visibility](https://tanstack.com/table/v8/docs/guide/column-visibility).

### Readability revision — 20 October 2026

The user found the first Reports & Analytics layout cramped, with small text and
too many competing controls. The shared admin/instructor report page now uses:

- A 30–36px page title, 24px report-section titles, 18px chart headings and
  14–16px operational text. Scope controls are 48px high; actions are at least 44px.
- A distinct scope panel, labeled report navigation and three contextual summary
  figures per section, rather than repeating the entire dashboard metric set.
- Wider chart panels, 20–28px panel padding, 24–40px section gaps, more legible
  legends/segment controls and a horizontally scrollable activity chart on phones.
  Comparisons use one consistent color; status and skill bands retain their meanings.
- A five-column default student table with school ID, course and batch beneath
  identity. Show all columns exposes the original full table; downloads always
  retain every original column and all filtered rows. Cards serve narrow layouts.
- Explicit selected record buttons, labeled search, larger pagination controls,
  expandable scope/methodology notes, individual assessment exports and admin tools.
  Metric-specific units and essential limitations remain beside the relevant charts.

The analytics API, authorization, aggregation, score/ranking logic and export
dataset are unchanged by this revision. It uses the existing React/native HTML
chart implementation. UI/JavaScript libraries are allowed when beneficial; avoiding
dependencies is no longer a visual design constraint in the local collection skill.
The original collection reference is an optional baseline rather than a whole-page
template. Changes to that original skill are recorded in
[skill sources](SKILL_SOURCES.md).

Revision verification: frontend lint and production build pass; all four analytics
unit checks pass; 14 browser/API check groups pass using synthetic accounts and a
disposable SQLite database. Both roles cover key/full column switching, readable
type/control sizing, details/focus return, filter and chart selections, CSV/PDF
downloads, archives, advanced access boundaries and access-loss handling. All three
report sections have light/dark screenshots and overflow checks at 375, 768, 1024
and 1440px in headless Chrome. The collection skill validator passes and its 19
local reference links resolve. Live deployment, real data and other browsers were
not exercised by this UI revision. Earlier backend/PDF verification below belongs
to the initial feature implementation, not new backend changes in this revision.

### Initial feature delivery

- Admin dashboard: five linked cards for current active-cohort students, required
  completion, students awaiting placement review, approved/cohort placement progress
  and shared remaining OJT seats. Instructor dashboard: four linked cards for
  enrollment, required completion, distinct students needing follow-up and placement
  progress. Both retain the instructor-style white/dark cards.
- Conditional Needs attention links expose current stopped/flagged work, actual
  overdue required work, missing required assignments, completed-but-unavailable
  final results and no-current-recommendation cases. Pending instructor approvals
  are admin-only and open the existing Users Pending tab.
- Both roles have Reports & Analytics, with Assessments, Skills and Placements
  sections. Admin's existing Reports destination is reused; instructor navigation,
  route preparation and page loading now include the new destination.
- Assessment charts compare required completion by batch and mutually exclusive
  current attempt states. Tables expose approved retakes separately. Existing
  assessment-specific report/export controls load only on explicit expansion.
- Skill charts use final current combined category distributions and one best
  current recommendation per student. Locked, unmatched and missing evidence stay
  visible. Mean category percentages in the category table are explicitly the
  mean of final student percentages, not regrading or averaging assessments.
- Placement charts show approved/other-batch-approved/unplaced students, approved
  decisions by distinct company or company area, and occupied/free position seats.
  A separate residence/company-area table retains cohort residents, unplaced
  residents, approved company deployments and shared seats with distinct labels.
  Current capacity remains shared across batches; company/position/area filters
  affect approved records/capacity rather than silently changing cohort totals.
- Chart selections lead to their supporting filtered records. Student rows open
  the existing authorized batch roster detail in a read-only dialog, with a link
  to batch management. Batch-management destinations accept the selected batch.
  Mobile student records use cards with visible identity/detail actions.
- Admin NLP model configuration, comparison and taxonomy evaluation are preserved
  behind an explicit Advanced expansion. Instructor routes never render these
  controls and the existing admin endpoints remain protected.
- The displayed table exports all filtered rows to CSV or PDF from the same loaded
  snapshot, with generation time, scope, readable filter names, selection, search,
  unit and activity/capacity caveats. CSV strings neutralize formula prefixes.
  Existing placement management and decision-history exports remain linked.

## Read-only API and metrics

`GET /api/management/analytics/` requires an active admin or approved instructor.
Supported filters: `batch_id`, admin-only `instructor_id`, `course`, `batch_status`
(`active`, `archived`, `all`), `assessment_id`, `company_id`, `position_id`, `area`,
`date_from`, `date_to`. The existing client `_t` cache-buster is ignored. Unknown,
repeated, malformed and foreign-scope filters are rejected. No answer content,
keys, contacts, ranking fingerprints or foreign student identities are returned.
Catalog capacity is shared reference data; instructors see their own cohorts.

For the default active scope, admin totals select one newest active enrollment
per active student; instructor totals select the newest owned active batch, as
their existing dashboard does. An explicit batch selects its roster. Across
selected historical batches, one newest selected enrollment per student is used,
so batch counts reconcile with the distinct cohort total. Explicit archived
cohorts retain historical enrollments even when the student account was archived.
Scope text explains these units; no new institution/year field is invented.

Required completion uses the existing submitted/unflagged required-progress rules.
Current final scores and recommendations additionally use the existing finalization,
active-batch, source-assessment and catalog-freshness checks through
`bulk_management_states(..., include_history=False)`. This optional argument only
avoids reading archived answer snapshots for analytics; existing callers preserve
their original history behavior. Analytics reads never call recalculation/NLP.

Awaiting placement review means an unplaced student with current final evidence
and at least one current recommendation. It is not approval eligibility. Existing
approval protections, capacity and stored placement evidence remain authoritative.
An approved placement from a different batch is labeled separately and prevents a
second placement candidate; its foreign-batch details are not disclosed.

Current follow-up reasons are deduplicated by student. Several stopped/flagged
attempts count once in the card. Only required published work with an actual past
deadline is overdue; archived attempts alone never create a current violation.
Archived cohorts do not populate current attention queues.

## Historical line chart boundary

Recorded submission activity is included. It uses valid submitted current attempts
and retained prior attempts, grouped by **Philippine calendar date**. An identical
current/history timestamp for the same student and assessment is deduplicated.
Actual separate retained retake submissions count separately. Date ranges apply
only to that activity chart/table; they do not reinterpret current cohort totals.
The default covers 56 calendar days, including the end date; ranges are bounded to
366 days and cannot end in the future.

This is activity from retained records, not proof of a complete historical event
log. Deleted records cannot be reconstructed. Historical completion percentages,
readiness percentages and past remaining-capacity lines are deliberately absent:
their past states are not saved as certified periodic snapshots. Adding those
would require a separate durable-history design and, if new models are needed,
a migration. No fake historical values are backfilled.

## Cache, errors and snapshots

Analytics uses the existing Axios, shared query store, SSE lifecycle and visible
refresh. Relevant data topics invalidate all analytics parameter variants. A
foreign-cohort placement can consume shared seats, so frontend dependency matching
does not discard capacity changes simply because its batch ID differs. The server
continues to authorize every read and the event stream's existing audience applies.
Access loss clears unauthorized records; transient refresh errors preserve the
last good snapshot and its timestamp. Downloaded files remain explicit snapshots.

Filters are shareable URL parameters. Record selection/search/pagination operate
on the same authorized loaded collection. Report tabs clear irrelevant assessment
or company/position/area filters; reset remains available after an invalid request.
No new frontend dependency or chart library is required.

## Verification and evidence

- Django system check: no issues. `makemigrations --check --dry-run`: no changes.
- 84 PostgreSQL regression tests passed, no skips, on a fresh disposable localhost
  cluster: analytics, admin management, change events, combined competency, multiple
  assessments, management step 4, capacity/areas and report reconciliation.
  Final evidence: `work/analytics-postgres-rxhkgtho/tests.txt`; cluster stopped.
- 135 frontend unit tests passed, including new selection/export/metric tests and
  shared-capacity invalidation. Frontend lint and production build pass.
- 12 real browser/API check groups passed for both roles: linked dashboard cards,
  authorized details and focus return, report tables/CSV agreement, PDF downloads,
  skill/missing/zero data, global capacity and filters, archive ownership, advanced
  admin tools, responsive light/dark layouts and access loss. Disposable migrated
  SQLite fixture only; browser external traffic blocked. No real notifications.
- 12 synthetic dashboard highlight check groups passed after fixture updates,
  retaining existing top match/skill/student interaction, zero/missing evidence,
  focus, empty/error and 375/768/1366px behavior.
- Downloaded admin/instructor PDFs were independently text-checked and rendered
  with the bundled PDF tools. Role-specific rows and filter metadata matched.
  Browser screenshots cover 375/768/1440px; PDFs and screenshots are ignored
  artifacts under `skillbridge-frontend/tests/artifacts/analytics/`.

Reproduce browser/API checks from the repository root:

```powershell
.\skillbridge-backend\venv\Scripts\python.exe skillbridge-frontend/tests/run_admin_management.py --analytics
```

Backend tests must use test settings and a disposable database as described in
[local operations](LOCAL_SETUP_AND_OPERATIONS.md). Normal DB credentials were not
used. Runtime/deployment with the user's actual environment is unverified. Deploy
matching frontend/backend code; no new `migrate` step is introduced by this feature.

## Sources

- [Approved proposal](DASHBOARD_AND_ANALYTICS_PLAN.md)
- [Analytics API](../skillbridge-backend/api/analytics.py) and [tests](../skillbridge-backend/api/test_analytics.py)
- [Shared report page](../skillbridge-frontend/src/pages/reports/ReportsAnalytics.jsx)
- [Metric/selection/export helpers](../skillbridge-frontend/src/utils/analytics.js)
- [Real browser checks](../skillbridge-frontend/tests/analytics_playwright.py)
- [Report reconciliation](REPORT_RECONCILIATION.md) and [capacity meanings](CAPACITY_AND_AREAS.md)
