# Staff dashboard and Reports & Analytics implementation

Implemented locally, 20 October 2026. Frontend and backend changes; **no schema
change or new migration**. No configured/live database, deployment, recommendation
regeneration, real account change or notification was used for this work.

User instruction: on PAUSE, stop safely and record remaining work here; resume
on CONTINUE. The approved scope is the full dashboard/analytics proposal with
historical trends limited to evidence actually retained by the application.

## Delivered

### Local activity filtering and quiet refresh — 26 October 2026

Activity dates/periods now filter an authorized loaded snapshot in the browser.
The analytics response adds `activity_days`: sparse Philippine-date/count pairs
for all retained valid submissions in that exact student/assessment scope. It
contains no answer data or additional student identities. The existing current/
prior-attempt deduplication and flagged/foreign exclusions still happen on the
server before aggregation. Direct API date/period filtering remains supported;
out-of-range events are excluded from its requested `activity` series.

Reports reads one shared scope cache key without activity date/period parameters,
reusing the ordinary report/notification/preparation cache. `analyticsActivity`
resolves calendar presets and custom validation, builds bounded day/month/year
buckets and changes only the derived activity/scope fields. Summary/student
objects remain unchanged. Loaded date/period switches and Apply dates make no
extra analytics GET. Scope-changing batch/instructor/course/assessment/company/
area filters still use the authorized backend aggregates, because they can change
selected enrollments, current evidence and shared capacity semantics. Returning
to a fresh cached scope reuses it. The report's redundant initial options GET is
removed; options come from the same authorized snapshot.

The date form no longer remounts when applied dates change. Its focused controls,
calendar draft and graph container remain present, and applying a range resets
only activity-table pagination. Loading feedback is beside the activity controls
and in a fixed status card for explicit server-backed filter changes, avoiding
the extra layout spacing caused by inserting an in-flow update message. The
current results stay visible on a slow request, with a clear warning and retry
after failure. Old cached envelopes without complete daily counts require a
report reload rather than being misrepresented as complete history.

Routine SSE/poll/focus refreshes are silent: no updating card, graph busy state,
remount or scroll jump. They publish the new authorized snapshot when ready.
Snapshot downloads remain available during routine refresh, retaining the actual
displayed data and generation timestamp; they remain blocked for a pending new
scope, errors or definitive access loss. User-triggered retry has visible progress.

The configured fallback is **30 seconds while visible**, with an additional
focus/visibility revalidation after a minimum five-second age. Supported app
mutations publish recipient-scoped events after commit; the existing SSE server
checks the event log about once per second and the browser coalesces changes
before refetching. New supported app data therefore need not wait for the fallback
timer, but arrival also depends on mutation completion, delivery and fetch time.
Direct SQL/external writes that emit no application event wait for a subsequent
fallback/focus refresh. No refresh interval, authorization, ranking, database
schema or mutation behavior changed in this follow-up.

Verification passed 19 backend analytics/calendar tests on in-memory SQLite and
all 173 frontend tests. The focused real-API browser suite passed 14 groups for
both roles with zero page errors, including exact preset/API totals, no new
browser analytics GET for date changes, stable DOM/focus/scroll, delayed scope
requests, failure/retry, silent event refresh with newly supplied counts before
the timer, enabled displayed-snapshot downloads during that refresh and definitive
access-loss clearing. Twenty light/dark responsive layouts were retained. Across
54 local automated period switches, selection-to-applied controls measured
101–258 ms (including browser automation; not a production latency guarantee).
The surrounding analytics test's obsolete date-network expectations now check
local requests/retained controls instead; that full stress suite was not rerun.
No live data or hosted deployment was used.

### Submission activity periods — 26 October 2026

The previous activity default was the last 56 inclusive days (`today - 55`),
which made October 26 start on September 1. Both staff roles now default to
Monthly: the first of the current Manila calendar month through today.
The shared activity filter adds Daily (today), Weekly (Monday through today),
Monthly, Yearly (January 1 through today), All time and Custom dates. Presets
apply immediately and remove explicit date parameters; editing either calendar
switches the draft to Custom dates, which still requires Apply dates. Existing
date-only URLs are treated as custom ranges. Custom validation retains the
366-inclusive-day limit, ordered dates and no future end date.

The API accepts `activity_period` and returns its resolved period, interval and
date bounds in scope. All time starts at the first retained valid submission in
the authorized student/assessment scope; an empty scope shows zero for today.
Current/history deduplication and flagged/foreign exclusions are preserved.
Yearly uses month buckets; All time uses day buckets up to one year, month buckets
for longer ranges up to 30 years, and year buckets beyond that. Zero buckets and
the exact submission total are preserved without creating an unbounded daily
series. Counts still describe submission activity, never historical completion.

The applied-range note, chart ticks/tooltips, linked activity table and CSV/PDF
snapshot metadata describe the actual period, dates and bucket unit. Selecting
periods changes activity only, preserving student denominators, other report
scope, record selection and authorized access. The custom assessment-style
calendar, retained reports during refresh and existing query-race handling remain.
No migrations or production data changes are needed.

Verification for this follow-up passed lint/build, all 169 frontend JavaScript
tests, and 18 backend analytics/calendar cases on in-memory SQLite. Tests cover
month/week/leap-year boundaries, legacy date URLs, custom validation, bounded
long histories, empty activity, exact totals and current/history deduplication
without foreign or flagged events. The focused real-API browser suite passed
eight groups for both staff roles with zero page errors: all presets, Monthly
default, unchanged authorized student totals, monthly table/CSV units and range
metadata, custom calendar validation, reload and twenty responsive light/dark
layouts in a New York browser timezone. Desktop and narrow dark screenshots were
visually reviewed. The full surrounding analytics stress suite was not rerun.

Run the focused browser workflow with the project Python environment:
`python skillbridge-frontend/tests/run_admin_management.py --analytics --activity-periods`.
It starts hidden local servers and a disposable SQLite database. Screenshots are
in ignored `tests/artifacts/analytics/*activity-period*`; selected previews are in
`outputs/ui-previews/activity-periods-2026-10-26/`. No live accounts or records were
used. Physical devices, screen readers and hosted deployment remain unverified.

### Placement analysis and simpler terminology — 26 October 2026

Implemented the approved [placement concept, version 2](../outputs/ui-concepts/placement-analytics-2026-10-26/DESIGN_BRIEF.md)
through shared lazy-loaded `PlacementInsights` for instructor and admin.

- Student placement progress replaces its donut with exact approved/other-batch/
  unplaced counts and a proportional distribution strip. These actions open the
  selected students' filtered list on the same page, with the active-filter banner
  and records-heading focus. Zero-count actions show an empty list.
- Company comparisons offer Company / Company area switching, paginated native
  drill-down rows and an honest no-approval empty state. Counts and identities
  follow the existing authorized company-filtered analytics payload.
- Shared position slots replaces the large chart and duplicate disclosure with
  one eight-row paginated table, exact full-list total/occupied/remaining values,
  company/position identity, company area and a single View capacity records action.
  Per-row slot counts stay informational. Above-configured occupancy remains
  explicit, while remaining uses the API's bounded count. Small containers present
  labeled position cards with the same values; both themes are supported.
- The existing backend Company area filter is now also visible in the capacity
  section as a clearable chip. Davao City shows only Davao City company positions
  and matching full filtered slot totals; it does not filter student residence.
  Company and position filters compose with it. Clearing the chip clears area and
  the record selection while keeping the other report-scope filters.
- Company comparison and shared-slot counts use company/position/area filters.
  Student progress remains based on the selected batches. Its status drill-downs
  now read `data.students`, so their filtered records match the displayed status
  counts even when a company filter would exclude them. Default placement records
  and company/area drill-downs still use `data.placement_students`. The banner and
  export metadata explicitly describe this status-scope distinction.
- Visible generated copy throughout the application uses **slots**, **batch** or
  **selected students**, replacing seat/cohort wording in staff pages, dashboard
  descriptions, placement dialogs, summaries, export labels and API error/metadata
  messages. Existing API field keys (including `cohort_unit`), database schema,
  URLs, stored batch names and historical records are preserved. User-owned batch
  names are not rewritten merely because they contain an older term.

This is presentation and record-selection work. No capacity arithmetic, approval
rules, mutation payloads, ranking, grading or backend authorization changed. Official
slot occupancy still counts approvals across all batches; provisional suggestions
remain separate. The concept's illustrative companies and totals are not inserted
into application data. The new panels preserve independent pagination, scope reset,
live downward page clamping, loading/errors and last-good report behavior.

Verification: lint/build and all 225 frontend Node tests pass. The expanded
isolated analytics suite passes 156 browser groups with no page errors, covering
both roles, Davao/Panabo area filtering, scoped company/area drill-downs, independent
student-status counts, exact all-batch slot totals, filtered CSV metadata, eight-row
pagination/live clamps, legacy over-capacity, empty/zero states and six responsive
sizes in both themes. Desktop/phone screenshots were reviewed. The surrounding
placement collections and candidate workspace pass 30 and 44 browser groups.
The latter's test now uses visible Next controls when a page is hidden behind
pagination ellipses. All browser data is synthetic or from a disposable local
fixture. Backend analytics/capacity tests pass 13 cases on in-memory SQLite;
placement draft tests pass 21 cases, with five database-specific cases skipped
by their existing guards on SQLite. No production database, deployment or physical
device was used.

### Skills count matrix and company-match filters — 26 October 2026

Implemented the approved [Skills concept](../outputs/ui-concepts/skills-analytics-2026-10-26/DESIGN_BRIEF.md)
in a shared, lazy-loaded `SkillsInsights` component for both staff roles. One
category matrix replaces the duplicated chart/count accordion, and a separate
company-match panel distinguishes recommendation fit from category evidence.
Other analytics charts retain their existing presentation.

- Matrix rows use the API's Strong/Fair/Needs work student counts with the same
  80/60 thresholds. Unavailable uses the supplied missing/locked count, remains
  neutral and informational, and never becomes a zero score. No category mean
  or recommendation score is recalculated by this presentation.
- Each scored-band count is a native button, including zero counts. Its arrow
  selects the existing `skill:<category>:<band>` record filter. Company rows
  select the existing `band:<name>` groups using each student's best current
  recommendation. No current recommendation maps to `No current match`; Final
  results locked maps to `Locked`. Both stay neutral rather than appearing as
  scored bands or approved placements.
- Arrow actions switch records to list view, clear local record search/sort,
  reset record pagination, scroll to/focus the records heading, and expose the
  category/band or company-match selection in the existing clearable filter
  banner. The report scope is retained. A zero-count selection opens the empty
  filtered list; it does not navigate to a different page or create data.
- View category table opens the existing read-only category aggregate table.
  The category matrix has independent eight-category pagination, resets when
  cohort scope changes, and persistently clamps after refreshed results shrink.
  Company group totals count the full authorized cohort rather than a page slice.
- Wide layouts use two panels. Below 1200px they stack; matrix containers at
  520px or below show labeled category cards with the same controls. Both themes,
  keyboard selection/focus, 44px count controls and reduced motion are supported.
  Empty cohorts and unavailable final evidence have explicit messages.

API contracts, authorization, final-evidence gates, score history, ranking weights,
recommendation regeneration and placement approval rules are unchanged. The
human-readable company-filter labels also appear in snapshot export metadata.
The concept's sample counts are not inserted into the application.

Verification: frontend lint/build and all 224 Node tests pass. The expanded
analytics browser suite passes 128 groups with no page errors against a fresh
disposable SQLite fixture. Every category-band and company-match arrow is checked
against real isolated API student identities/counts, including zero results,
forced list view, records-heading focus, pressed state, filter labels and clearing.
Responsive checks cover 320x568, 375x812, 768x1024, 1024x768, 1440x1000 and 812x375
in both themes for both roles. Synthetic stress responses cover 19 categories,
long names, pagination, live shrink/regrowth, all-locked evidence and empty cohorts.
The full suite also retains its export, report-scope, access-loss, date picker
and previous collection regression checks. Desktop/phone Skills screenshots were
reviewed under `skillbridge-frontend/tests/artifacts/analytics/`. No production
database, hosted deployment or physical device was exercised.

### Collection balance, filter context and activity calendar — 25 October 2026

The student collection now uses fixed responsive columns rather than stretching
the available cards across the row. Its content container uses one, two, three
or four columns at 0/500/730/960px; a wide layout retains four columns even when
only two students match. Cards retain the dashboard/Students visual language,
with 16px padding and the existing authorized analytics fields. The list keeps
shared table styling, sorting and key/full columns. Both views still use the
same eight-student page, and no assessment overall score is fabricated.

The analytics card/list tray now uses compact 28px buttons for mouse pointers,
retaining 44px controls on coarse-pointer touch devices and 14px shared icons.
The assessment library's default toggle sizing is unchanged.

Student drill-downs now show an explicit green Active record filter banner with
the selected batch, assessment/state or other student selection. Batch actions
explain that all students in that batch are shown; attempt actions explain the
current assessment status being filtered. The existing full filtered count stays
visible, including zero results. Clear record selection removes this selection
while retaining the report scope. Chart actions focus the records heading and
scroll it into view, respecting reduced motion. Aggregate record views keep their
active view buttons and existing clear action rather than duplicating their title
in a student filter banner.

Recorded submission activity reuses `ScheduleDateTimePicker` in its new optional
date-only mode. The default assessment date/time behavior remains intact. Activity
dates use the same calendar, green styling, responsive popover/modal and
Apply/Cancel/Clear actions, with no time field. Picked dates remain `YYYY-MM-DD`
calendar dates in Manila regardless of the browser timezone. Calendar Apply
updates the date draft; Apply dates requests the activity range. Missing dates,
reversed ranges, future end dates and ranges longer than 366 inclusive days keep
the prior validation. Field groups expose invalid state and error associations.
Activity-only filtering, last-good report retention, latest-request handling and
exports preserve their existing contracts. No API or backend behavior changed.

Verification: lint/build and all 224 frontend Node tests pass. The expanded
analytics browser suite passes 100 groups for both roles, with no page errors.
It verifies four columns at wide content widths even with only two records,
compact desktop toggles, responsive cards/list, visible batch/attempt filter
context, heading focus, zero-result selections, calendar Apply/Cancel/Clear,
missing/reversed/future/oversized date ranges, exact activity-only requests,
latest-response handling, exports and access loss. Calendar overlays are checked
at 320x568, 375x812, 768x1024, 1440x1000 and 812x375 in both themes, in a New York
browser timezone. Opening a focused field brings an offscreen anchor back into
view before positioning its popup, including after resize or content updates.
The existing assessment date/time creation suite also passes all 24 groups,
including unchanged Manila save payloads. Desktop/phone card, filter-banner and
calendar screenshots were reviewed. These use synthetic records and disposable
local fixtures, not production data or physical-device verification.

### Required completion and attempt panels — 25 October 2026

Implemented the approved [two-panel concept](../outputs/ui-concepts/analytics-progress-panels-2026-10-25/DESIGN_BRIEF.md)
in shared `AssessmentProgressPanels` for instructor and admin. These two panels
replace their former large chart axes and duplicate count-list disclosures;
other analytics charts retain Recharts and their existing behavior.

- Required completion uses the API's cohort completion rate and each batch's
  exact completed/total counts. Tracks use the real count ratio, labels retain
  the reported rate, and explicit Completed/Remaining cells stay distinct from
  attempt status. View batch students opens the existing `batch:<id>` selection.
- Attempt status uses exact per-assessment counts and denominators. Its summary
  sums submitted and assigned student-assessment assignments across the full
  analysis scope, including rows on other panel pages. This is not a distinct
  student count or the cohort's required completion rate. Selecting an assessment
  changes attempt analysis while retaining cohort completion, as before.
- Four native status buttons retain submitted, in-progress, not-started and
  stopped/flagged counts. All remain selectable at zero and open the same
  `attempt:<id>:<state>` filtered student records. Active selections expose
  `aria-pressed`; controls have visible focus and at least 44px touch height.
- Each panel has independent four-row pagination and a bounded scroll area for
  taller rows, rather than hiding batches/assessments after the first one. Scope
  changes reset panel pages; background refresh preserves them where valid and
  persistently clamps shrinking results. Missing rates display an em dash;
  empty batches/assignments retain explicit zero counts without invented rates.
- Wide screens place panels side by side; below 1200px they stack. Narrow
  containers stack count/status tiles, wrap long labels and contain pagination.
  Light/dark themes and reduced-motion preferences are supported. Shared icons,
  the current API/cache lifecycle and the existing pagination component are used.

No API fields, database writes, grading, authorization, eligibility, student record
filters or export calculations changed. The generated concept's example data is
not inserted into the application. The implementation keeps the user's compact
12px ordinary text scale rather than the larger raster concept's text sizing.

Verification: lint/build and all 224 frontend Node tests pass. The full isolated
analytics browser suite passes 78 groups with no page errors, including both roles
at 320x568, 375x812, 768x1024, 1024x768, 1440x1000 and 812x375 in both themes.
Coverage includes exact track proportions, batch/zero/nonzero keyboard drill-downs,
assessment filter boundaries, multiple/empty rows, independent pagination and
live page clamp/regrowth, alongside the existing analytics/export/access checks.
Snapshots use a disposable SQLite fixture and synthetic empty-row stress data;
no production database or physical device was used. Panel captures are under
`skillbridge-frontend/tests/artifacts/analytics/`.

Reproduce all checks from the repository root:

```powershell
.\skillbridge-backend\venv\Scripts\python.exe skillbridge-frontend/tests/run_admin_management.py --analytics
```

Add `--panels-only` for the focused panel checks, including long-label geometry.

### Student cards and list view — 25 October 2026

The shared instructor/admin student records section now offers the same compact
card/list toggle used elsewhere in SkillBridge, with labeled 44px controls also
available on phones. List remains the initial view. Cards reuse the student-card
visual language while rendering analytics snapshot fields directly: identity,
batch/instructor, required completion, final-evidence availability, OJT placement,
follow-up reasons and a separately labeled current recommendation. Skill records
also retain category results; missing values remain explicit and zero stays zero.
No management-profile score or overall percentage is fabricated from report data.

Both views show the same eight-student page in TanStack's full filtered order.
Switching views preserves search, selection, sort and page; search/filter/sort
changes return to page one. Refreshed result shrink persists its page clamp.
Cards provide a labeled Sort students select; the list keeps sortable headers
and key/full columns. Aggregate tables retain ten rows per page. Narrow list
views use contained, keyboard-focusable scrolling; cards form a responsive grid.
Student names open the existing authorized details dialog with focus return.
Compact list status cells now also show the actual follow-up reasons.

CSV/PDF downloads still include all filtered records and all original columns,
using the same sort order in either view. Charts, scope controls, API fields,
calculation/eligibility rules and backend permissions are unchanged. The wider
[ImageGen concept](../outputs/ui-concepts/reports-analytics-2026-10-25/DESIGN_BRIEF.md)
reimagines the whole page as requested; its sample records/charts are illustrative,
and only the student collection behavior is implemented in this refinement.

Verification: frontend lint and production build pass; all 224 frontend Node
tests pass. The expanded [isolated analytics browser suite](../skillbridge-frontend/tests/analytics_playwright.py)
covers both roles with a disposable SQLite fixture, eight-record card/list
equivalence, page preservation, full sorted CSV exports, detail-dialog focus,
follow-up filters, missing/locked evidence, explicit zero category scores and
page clamp/regrowth after background refresh. Its 50 groups include both views
at 320x568, 375x812, 768x1024, 1024x768, 1440x1000 and 812x375 in light/dark mode,
plus the existing chart drill-down, scope/access, error recovery and export checks.
No page errors were recorded. Desktop/phone student-card screenshots were reviewed
under `skillbridge-frontend/tests/artifacts/analytics/`. Production services,
physical devices and deployment were not exercised.

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
