# Instructor assessment library

## Three-column cards and six assessments per page — 30 October 2026

The approved [assessment card redesign](ASSESSMENT_CARDS_REDESIGN.md) supersedes
the eight-item page size below. Both staff roles now use three desktop columns,
six cards/list rows per page and pagination from seven matching records. Cards
group schedules, identity and metrics horizontally to reduce height while retaining
category disclosure, details, completion and integrity evidence. Loading geometry
and the single-page footer follow the six-item size. Student cards receive their
separate approved design without adding student pagination or changing actions.
Final verification also resolves the older admin roster-retry fixture failure
described below; all nine admin browser groups now pass. See the linked redesign
record for the missing batch-envelope field and complete test evidence.

## Eight assessments per page — 30 October 2026

Instructor and admin assessment libraries show up to eight assessments per page
in both card and list views. A full desktop card page has two rows of four cards;
the existing two-column and phone layouts remain responsive. Both views preserve
the same ordered page when switching. Pagination starts at nine records, and the
single-page list footer and loading placeholders use the same eight-record size.
Search/filter resets and live result-shrink clamping retain their existing behavior.
This frontend-only update supersedes the older four-record page-size notes below;
it requires no migration and does not change student assessment numbering.

Verification for this update: frontend lint/build and all 11 instructor browser
groups pass with zero page errors. Admin browser assertions also pass card/list
pagination, page preservation, filtered counts and shrinking/growing result sets.
The broader admin suite stops at the separate student-roster retry assertion
(`admin_assessments_playwright.py`, the expected `Showing 1–10 of 23` after a
simulated 503); a repeat run fails at the same check. No roster behavior was
changed for this request. Existing browser expectations now cover eight/nine-item
boundaries and all five matching rows in the admin combined-filter fixture.
The desktop eight-card layout was visually reviewed. Logs are under ignored
`work/assessment_page_size/`; all API data was intercepted and synthetic, with no
live reads or writes. Test previews were stopped. Separate publication-dialog
and student-detail styling edits that appeared during verification were preserved
outside this pagination change.

## Time-limit suggestions and action feedback — 30 October 2026

Staff creation forms offer **30 min**, **60 min (1 hour)** and
**120 min (2 hours)** shortcuts alongside custom minute entry. The shared
instructor/admin settings and question-authoring dialogs offer the same shortcuts;
existing duration locks disable them after an attempt. Shortcuts update the draft
duration; server saves still use the existing save/publication flow. Existing
[attempt cutoff rules](ASSESSMENT_LIFECYCLE_AND_TIMING.md) remain in force.

The instructor/admin header actions and grouped-publication dialog use shared
button styles with visible light/dark hover feedback, pointer cursors and keyboard
focus outlines. Disabled actions remain inactive. The existing staff order field
is labeled **Staff display order**, as described in the
[student order contract](STUDENT_ASSESSMENT_RANDOMIZATION.md).
These UI changes require no backend change or migration.

Verification: frontend lint/build pass; the production-build browser suite passes
eight groups with zero page errors. New cases check all three header actions in
both themes for each staff role, phone duration shortcuts and custom 45-minute
entry. Existing real-local-API cases confirm admin review/cancel, instructor
publication of all six drafts, stable student aliases on refresh and preserved
submission/results. Screenshots of header focus and phone shortcuts were reviewed.
All 166 disposable PostgreSQL regression tests pass, including atomic invalid-draft
rejection, safe publication retries, scope checks and concurrent first reads during
release. Evidence: `skillbridge-frontend/tests/artifacts/student-assessment-order/`
and `work/student-assessment-order-postgres-ajez1auh/tests.txt`. Initial sandboxed
runs were blocked by localhost permissions; the successful reruns used local
network access. Test helpers stopped after completion. No live data was changed.

## Grouped filters — 29 October 2026

The library now uses the [shared grouped filter panel](GROUPED_COLLECTION_FILTERS.md)
instead of publication tabs, batch dropdown and More filters disclosure. Existing
publication, batch, requirement, competency inclusion, category and availability
choices remain. Search stays visible; chips preview a count and Show assessments
applies them together at page 1. Close/Escape/outside interaction discards drafts.
Clear filters resets search and all groups while preserving card/list choice.
Applied filters remain individually removable. The compact 38px search/trigger,
28px chips and familiar view toggle follow the user's reference. Report-panel
filters and assessment editing, scoring, locks and authorization remain separate.
The older descriptions below preserve prior UI history.

## Compact assessment card design — 28 October 2026

Both roles use the approved compact card concept in `AssessmentCollection`:
title/publication header, batch/duration row, a requirement tag and competency
label, separate availability/order row, expandable category pills, compact
calendar summary, and balanced Questions/Submitted metrics. A muted integrity
count and chevron finish the card; the existing native title button still opens
the whole surface, with independent category controls. Missing opening/due dates
share “No opening or due date set”; actual dates remain Manila-formatted.

The style uses 18px card padding and 12px section gaps, without a fixed height or
smaller body text. The four/two/one-column responsive grid and four-record page
size remain. Admin additionally retains instructor identity, the submitted count
out of assigned students, explicitly labelled completion rate and completed count.
Completion stays separate from submitted totals. List views and dialogs are not
redesigned by this change; the shared progress component's optional submission
heading defaults to visible for all existing callers.

Verification for this card refinement: lint/build, the 11-group instructor and
nine-group admin browser suites, and 24 light/dark grid checks at 320–1920px
pass. Checks include metric labels/values, absent versus real schedules, separate
admin completion evidence, category disclosure, card/list navigation, filters,
pagination, dialogs and no page/card overflow. Desktop/phone screenshots were
reviewed. All browser data is synthetic; no live database or API writes occur.

## Shared collection component — 28 October 2026

Instructor cards and list rows now live in the shared
[AssessmentCollection](../skillbridge-frontend/src/components/assessment/AssessmentCollection.jsx),
also used by admin with additional instructor and completion evidence. Instructor
summaries, filters, reports, four-record pagination and the existing editor stay
unchanged. Both staff collections use the same compact view toggle, card metadata,
category expansion, list-cell activation and responsive card fallback. See
[admin assessment oversight](ADMIN_ASSESSMENT_OVERSIGHT.md) for retained admin scope.

## Shared admin presentation — 26 October 2026

Admin assessment cards and list rows now reuse
[AssessmentCategoryPills](../skillbridge-frontend/src/components/assessment/AssessmentCategoryPills.jsx)
with the instructor library: three neutral pills initially, `+N more` to reveal
the remainder inline, and Show less to collapse. The native toggle has a unique
controlled region and expanded state; it stays independent of card activation.
Admin cards adopt the same quiet border, batch pill and grouped metadata while
retaining admin instructor identity, authoritative activity counts and pagination.

The admin management dialog opts into the instructor's modal settings/policy
variants and calendar, preserving its four oversight sections and confirmed-save
workflow. Publication, duration and display order use aligned 44px controls to
match the shared modern dropdown minimum height in both editors. The calendar
portals into its owning native dialog when present, keeping its controls above
the modal and interactive; other callers retain their existing portal behavior.
See [admin assessment oversight](ADMIN_ASSESSMENT_OVERSIGHT.md) for verification.

25 October analytics reuse: `ScheduleDateTimePicker` also supports an optional
date-only mode for Reports & Analytics activity ranges. Its assessment default
still includes time selection and the same Manila save payload; see the
[analytics refinement](ANALYTICS_IMPLEMENTATION.md).

## New Assessment schedule follow-up — 25 October 2026

Both instructor and admin New Assessment pages now reuse the modal's styled
Schedule section from
[AssessmentSettings](../skillbridge-frontend/src/components/instructor/AssessmentSettings.jsx).
The default and modal layouts share one internal `AssessmentSchedule` renderer,
including the existing lazy-loaded calendar/time picker, Manila timezone label,
Apply/Cancel/Clear actions, accessible error associations and timing explanation.
The other creation controls retain their current layout. Phone/short-height
screens use the existing compact picker dialog; larger screens use its popover.

Opening/deadline locks and chronological validation still use the existing
assessment policy. The minute-precision wall-clock state, draft recovery and
`+08:00` create payload are unchanged. No API, scoring, publication, assignment or
student timing rules changed. This supersedes the earlier statement that the
default settings schedule layout remains unchanged.

Verification: frontend lint/build and six focused date/policy tests pass.
[New Assessment browser checks](../skillbridge-frontend/tests/assessment_create_schedule_playwright.py)
pass 24 groups across both staff roles at 320x568, 390x844, 768x1024, 1440x1000
and 1024x600 in light/dark mode. They cover calendar and AM/PM minute selection,
Apply/Cancel/Clear, invalid date ordering, keyboard/Escape/focus, bounded popup
geometry, and exact mocked save payloads with the browser in America/New_York.
Creation requests are intercepted; no real assessment is saved. Phone and desktop
screenshots are in `tests/artifacts/assessment-create-schedule/` beneath the
frontend. All 11 existing instructor library/modal browser groups also pass,
including locked/editable schedules and focus/dirty-draft behavior. Backend/database
tests are unnecessary for this presentation reuse and were not run.

25 October timing follow-up: [assessment editing and timing](ASSESSMENT_LIFECYCLE_AND_TIMING.md)
locks duration/opening after the first attempt, permits only deadline extensions
or removal, explains settings effects and adds safe draft copies. The rule uses
any configured duration/deadline; example times are illustrative. Active students
can receive explicit audited extra time without losing their selected answers.

25 October archive follow-up: [assessment archives](ASSESSMENT_ARCHIVES.md) adds a
dedicated linked archive page and reversible read-only lifecycle. The current
library and its totals exclude archived records; historical report selectors retain
them. Import questions now sits beside manual question additions, stages rows in
the same draft and saves only through Save All Changes. Closing a dirty editor
requires discard confirmation. Expanding a question does not mark content dirty.

This supersedes the earlier header description of the immediate Upload questions
action. Imported questions, metadata and manual edits share the atomic save and
failed-save recovery behavior in both staff editors.

The October 25, 2026 update implements the approved light/dark design concept on
the instructor Assessments page. The compact cards/list switch copies the
instructor dashboard's gray tray, raised active icon, spacing and shared icons.
It also exposes the selected view through `aria-pressed`.

- The page uses a wider content area, four neutral summary cards and green
  publication-status filters. Counts describe the full authorized assessment
  collection; the result count describes the filtered collection.
- Two assessment cards fill each desktop row. The title is a native button with
  a stretched hit area and visible card-wide keyboard focus. Clicking the card
  opens the existing editor; there is no separate Manage assessment button.
  The +N category button reveals the remaining matching pills inline; Show less
  collapses them again. This button stays independently interactive above the hit area.
  These controls use green outlines, semibold labels and explicit +N more / − Show
  less text to distinguish them from the static gray category pills in both themes.
- The table shows the same settings, categories, schedule and activity as the
  cards. Rows open the editor; title buttons support Enter/Space. The table uses
  contained horizontal scrolling, with a card fallback below 640px.
  The approved list concept adds fixed column proportions, stronger assessment
  titles, stacked Configuration details, explicit Opens/Due rows beneath availability,
  aligned activity counts and decorative row chevrons. Missing dates use a dash;
  zero flags stay neutral. Light/dark rows show a subtle green hover surface.
  A single-page footer shows the displayed range and the fixed four-record page
  size; larger result sets retain the shared pagination below the table.
- Search and batch remain directly visible. Requirement, competency inclusion,
  category and availability are in More filters. Active filters stay visible as
  removable chips when that panel closes. Clear filters sits immediately after
  Closed in the publication controls and resets the whole query.
- Cards/list share the existing assessment filtering/reducer and stable creation
  date/ID ordering. The shared Pagination component shows four records per page.
  Filters reset the page, view changes preserve it and refreshed results clamp it.
- Reports remain independent of collection filters. Labeled controls, wrapping
  export actions and visible hover/focus states improve their presentation.
  CSV still requests an export; PDF still requires a generated snapshot. The
  shared embedded report section also receives those labeled controls.

The existing editor, API permissions, questions, scoring and recommendation gates
are preserved. Both instructor and admin cards/list show three category pills
initially and reveal the others inline on demand.

## Instructor editor header

### Approved modal refinement — 25 October 2026

The latest image concept is implemented in the instructor editor. The fixed
header pairs the title with a labeled Edit name action and displays the saved
publication status beside the batch. Name editing still requires that explicit
action; title changes remain unsaved until the confirmed Save All Changes flow.

One amber Some settings are locked notice replaces the repeated attempt/import
warnings. Its native View editing rules disclosure preserves the detailed content,
deadline and active-attempt publication rules. On narrow screens the disclosure
occupies its own row so the explanation remains readable. The separate Schedule
section uses a right-aligned Manila timezone label, paired date controls, visible
lock icons and Not set for locked empty values. How student timing works expands
the existing cutoff/extra-time explanation. Changed-setting impacts remain visible
without requiring a disclosure, and the save confirmation retains its full review.

Duration remains narrow; Publication state and Student display order retain equal
widths, heights and baselines. Requirement and competency panels keep the precise
completion/evidence descriptions. Duplicate as draft and Archive assessment move
below the settings into a subordinate action row, with the existing disabled
reasons and confirmation behavior. Questions and the fixed save/cancel footer
retain their existing functionality. The default shared settings/policy layouts
used elsewhere are unchanged; these presentation refinements opt into the modal
variant. No timing, permission, scoring or save API policy changed.

Verification for this refinement passed frontend lint/build, all 11 focused
policy/date/filter-state tests, the 11-group synthetic instructor browser suite
and both failed-save/retry groups, with zero browser page errors. The browser
checks cover keyboard disclosures without dirtying the draft, duplicate-dialog
open/cancel, locked empty dates, editable existing deadlines, active publication
locks, and equal publication/order geometry across ten locked and ten editable
light/dark modal layouts. Desktop light/dark and 320px dark screenshots were
visually reviewed; a narrow lock-notice wrapping problem was corrected and
rechecked. Concurrent browser cold starts initially exceeded the old navigation
timeout; isolated final runs passed with a 30-second navigation allowance.
All API traffic was mocked; no backend or real-record changes were needed.
Screenshots are in ignored `skillbridge-frontend/tests/artifacts/instructor-assessments/`.

The approved modal header displays the assessment name as text with a real pencil
button. Edit assessment name opens and focuses the title input. Done or Enter
returns to the display view; Cancel or Escape restores the name from before that
edit. Empty names cannot be accepted. Name changes remain part of the modal draft
until Save All Changes. Batch identity and the saved publication badge sit beneath
the title. Import remains beside question additions and unavailable after an
attempt exists.
Duration occupies a narrow column; Publication state and Student display order
have equal columns, matching labels and 40px controls. On phones, duration sits
above the balanced pair and the title gets its own full-width row.

Two checkbox panels group requirement and competency settings. A single
Asia/Manila timezone label covers the paired schedule fields. An amber lock notice
above settings explains restrictions; the question toolbar retains its type counts.
The title and save/cancel footer remain visible while settings and questions share
one scrolling body, including on narrow or short screens.

This layout is an opt-in `modal` variant of AssessmentSettings. Admin management
settings now opt in as well; creation and shared authoring forms retain the default layout. The existing
state setters, validation, attempt locks and save/confirmation flow are unchanged.

### Custom calendar and time selection

The instructor modal's Available at and Due at controls now use React Aria
Components 1.22.1 with @internationalized/date 3.12.4, pinned in package.json and
the lockfile. Native datetime-local inputs remain in the default forms elsewhere.
The new picker is loaded on demand when the modal settings render, with direct
component imports. Its dedicated production chunk is about 80KB gzipped in the
checked local build, plus Vite-managed shared dependencies.

The desktop popover contains a green calendar with month navigation and a
keyboard-editable hour/minute/AM-PM field. On phones or windows up to 760px tall,
the same picker appears in a centered dialog to keep time and actions visible.
Apply updates the assessment draft; Cancel, Escape and outside dismissal discard
unapplied picker changes. Clear removes that schedule value. Save All Changes is
still required to persist the assessment.

Dates remain minute-precision Manila wall-clock strings in the form state and
use the existing +08:00 API conversion. Browser timezone does not change the
chosen time. Due-at values at or before availability show an inline error; the
existing save validation and backend remain authoritative. No past-date restriction
or automatic schedule was added. An empty picker starts with no selected date and
a visible 9:00 AM time suggestion; Apply requires a date and complete time.

## Verification

Final local checks passed: frontend lint/build, all nine focused state/report
unit tests and seven browser workflow groups with ten responsive screenshots.
The browser run reported zero page errors. Desktop dark and tablet light
screenshots were visually inspected after adjusting report controls to wrap
before their labels became cramped.

The filter/category refinement also passed lint/build, all five shared assessment
state tests and the browser workflow. It verified Clear filters immediately after
Closed, inline pill expansion/collapse in both views, no editor opening from that
toggle, and pagination appearing at five records with four per page. Light/dark
screenshots capture the active status filter and expanded category pills.

The list-table implementation passed lint/build, the five shared assessment state
tests and the full synthetic browser workflow with zero page errors. Additional
checks cover the Configuration header, missing schedule dates, the single-page
footer, desktop column fit and activity labels staying on one line. List-specific
light/dark screenshots at 1440, 1024 and 768px are saved alongside the card layouts;
desktop light/dark and tablet light were visually inspected.

The modal follow-up passed lint/build, the five shared assessment state tests and
the expanded browser workflow with zero page errors. Geometry checks confirm equal
publication/order widths, heights and vertical positions across ten light/dark
modal layouts, including 320px width and a 600px-tall desktop window. Checks also
cover metadata changes, cancel/reopen, locked upload, question-type counts and
scroll access to the last question while the save footer remains visible.
Desktop light and narrow dark screenshots were visually inspected.

Click-to-edit name verification passed lint/build and the full synthetic browser
workflow: the heading stays read-only until the pencil is activated; focus, Done,
Enter, Escape, Cancel and empty-name rejection work. The save-recovery browser
check also passed: a failed save retains the renamed title and question draft,
and a successful retry sends one complete assessment PATCH without replay or an
extra question fetch. Its selectors and API mocks now match the current card,
modal and notification markup. No live API writes were performed.

The custom picker passed lint/build, eight combined schedule/state unit tests and
the expanded synthetic browser workflow with zero page errors. Browser checks
cover date/time selection, AM/PM, Apply/Cancel/Clear, due-date errors, Escape/focus
return and ten responsive light/dark picker layouts. The Apply button is checked
for visibility above the active overlay, including 320px and short-window layouts.
Narrow dark and short-window light screenshots were visually inspected.

Pre-merge verification on October 25, 2026: frontend lint and production build
passed, and all 146 JavaScript tests passed. The synthetic UI and save-recovery
results above apply to the same implementation. Backend behavior is unchanged;
no live data or hosted deployment was used for these checks.

From `skillbridge-frontend`, run `npm run lint`, `npm run build` and:

```powershell
node --test src/utils/adminAssessmentState.test.mjs src/utils/assessmentManagement.test.mjs src/utils/assessmentReportPdf.test.mjs
```

With local Vite on port 5178 and Python Playwright/Chrome installed, run from the
repository root:

```powershell
skillbridge-backend/venv/Scripts/python.exe skillbridge-frontend/tests/instructor_assessments_playwright.py
```

The browser script intercepts all API requests with synthetic data and blocks
external traffic. It checks shared pagination/order, filter combinations/reset,
live page clamping, four/five-record pagination boundaries, inline category
expansion/collapse, Clear filters placement, card/row/keyboard activation,
report failure/retry and scoped CSV/PDF requests, initial/refresh errors, empty
states, and light/dark layouts at 1440, 1024, 768, 390 and 320px. Screenshots are
saved under the ignored `tests/artifacts/instructor-assessments/` directory.
These checks do not exercise live backend mutations or authorization.
