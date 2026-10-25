# Instructor assessment library

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
are preserved. The admin assessment library retains its existing presentation;
its category summary is unchanged. Instructor cards/list show three category
pills initially and reveal the others inline on demand.

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

This layout is an opt-in `modal` variant of AssessmentSettings. Admin settings,
creation and shared authoring forms retain the default layout. The existing
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
