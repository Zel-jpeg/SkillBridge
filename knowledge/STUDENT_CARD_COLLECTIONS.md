# Student collection cards

Updated October 25, 2026. The instructor Students page and admin Users student
cards share the dashboard-inspired [StudentPerformanceCard](../skillbridge-frontend/src/components/StudentPerformanceCard.jsx).
The dashboard layout is unchanged. Cards show identity and status, OJT placement,
an overall bar, compact category scores, highest-scoring categories and a current
company match. Pending cards use a quiet waiting state. Email and detailed
assessment progress remain available in the existing detail modal and list view.
Suggested-company strips use the existing `CompanyImage` component and the
recommendation's `company_image_url`, including on instructor dashboard student
cards. Logos fit inside a 24px frame without cropping; missing or failed images
fall back to company initials. This reuses existing API fields without extra
company lookups or changes to branding storage.

## Evidence and actions

- Cards read normalized combined category evidence. The displayed overall value
  is the rounded arithmetic mean of available category percentages, matching the
  dashboard presentation; it is not a pooled raw/max score or recommendation input.
- Locked, stopped, flagged and archived records do not display positive result or
  recommendation summaries. Missing results remain unavailable; actual zeroes
  remain zeroes. Stale recommendations are excluded from the match strip.
- Up to four category chips are shown, with an overflow label leading readers to
  student details. All highest-score ties are retained in the accessible text.
  Company match percentages remain separate from assessment percentages.
- The card opens the existing student dialog using a native button, with hover
  and keyboard-focus feedback. Instructor removal remains a separate button and
  is unavailable in archived batches. Existing admin instructor cards and role
  access boundaries are preserved. Unknown placement is not labeled unplaced.
- Search, filters, sorting and card/list switching keep the existing collection
  behavior. Admin pagination now counts the full filtered collection rather than
  the current page slice, allowing later pages to appear.

## Verification

- `npm run lint` and `npm run build` pass.
- `node --test`: 214 tests pass, including six card evidence cases covering
  completion locks, invalid/missing values, zeroes, stale matches and ties.
- [Synthetic browser checks](../skillbridge-frontend/tests/student_cards_playwright.py):
  26 groups pass for both roles, using 13 synthetic students at 320, 375, 768,
  1024 and 1366 CSS pixels in light and dark mode. Checks include card content,
  overflow, detail opening and focus restoration, separate removal confirmation,
  archived behavior, page changes, view switching and search resets. No API writes
  occur during the checks. Desktop and phone card screenshots were reviewed.
- Logo follow-up: lint/build, all 26 collection browser groups (including loaded,
  absent and broken logos), and 12 dashboard regression groups pass. These checks
  use synthetic branding rather than live company images.

Browser checks use local headless Chrome with mocked API responses. They do not
establish live-service integration or physical-device coverage. No backend or
database behavior changed.

## Instructor roster filter placement — 28 October 2026

The initial pill-based layout and audit below are historical. The compact-filter
follow-up at the end describes the current instructor controls.

The instructor Students toolbar groups labelled Search students, Course,
Enrollment and Account status controls on one row when its content width reaches
1,000px. Progress/placement pills occupy the next row, with the compact view
switch and filtered count at the right. Narrower layouts wrap by available
content width: paired enrollment/account dropdowns from 420px, and single-column
fields below that. Student cards and the admin roster layout are unchanged.

The shared enrollment filter component accepts an optional presentation class;
its options and other callers retain their existing behavior. Course/status/view
buttons expose their selected state and keyboard focus. Enrollment changes reset
the enrolled roster page and progress filter; existing course/account/search
combination rules and the previously unenrolled collection are preserved. Counts
now distinguish “1 student” from multiple students.

Verification: frontend lint/build pass. The synthetic
[roster toolbar browser check](../skillbridge-frontend/tests/student_roster_toolbar_playwright.py)
covers 320, 375, 768, 1024 and 1440px in light/dark mode, including toolbar geometry,
account/course/progress filters, later-page resets, card/list switching, enrollment
switching, keyboard search and empty-state recovery. It blocks API writes and
external services; no live database is used.

### Complete roster filter audit

Expanded the same browser check to 216 enrolled-roster combinations (all eight
status options × three course options × three account states, in mobile cards,
desktop cards and desktop lists), checking exact student identities as well as
counts. Another 27 combinations cover previously unenrolled course/account
filters in those views. Name, school-ID and email search, mixed case, surrounding
spaces, batch isolation, pagination resets and empty-state recovery are included.

The audit found and fixed untrimmed enrolled-roster searches: pasted values with
surrounding spaces now match consistently with the previously unenrolled view.
Switching enrollment views also exposed a duplicate React sibling key shared
by email progress and the unenrolled collection; email progress now uses a
distinct key prefix. Browser verification checks for that warning and uncaught
page errors. These fixes do not change access, assessment or placement rules.

### Compact status dropdowns — superseded by grouped panel

The long status-pill row is replaced by Assessment status and Recommendation
status dropdowns. They stay side by side on phones with 44px minimum control
heights. Both dimensions combine with search, course and account status; changes
reset pagination and card/list views use the same filtered collection. Complete
means all required assessments are complete. Available requires actual unlocked
recommendations; Awaiting review excludes current approvals. Approved decision
uses the recorded batch decision rather than inferring training progress.

Clear filters appears when needed and resets search, course, account and both
status selections. It retains the selected batch, enrollment collection and view.
Changing enrollment collections resets the two status selections. An empty result
points to the same toolbar reset. Labels and focus states use existing shared
native-select presentation; no new dependency, API or database change is needed.

Six focused filter tests cover intersections, stale/empty recommendations, optional
flags, current approvals, identity searches and evidence preservation. All 282
frontend tests, lint and production build pass. Browser verification uses synthetic
API fixtures and blocks writes. All 15 browser groups pass: five widths in both
themes, 540 enrolled combinations and 27 previous-enrollment combinations across
phone cards, desktop cards and desktop lists. Exact identities, pagination, search,
batch isolation, view switching and reset behavior pass, with zero page errors or
API writes. Mobile and desktop screenshots were reviewed. Evidence is in
`work/roster-dropdowns-browser.txt` and the ignored roster-toolbar artifacts.

### Status menu opening direction — 29 October 2026, historical

Chrome's native customizable picker uses `position-try-order: most-block-size`.
On the desktop roster it chose the larger space above the status fields even
though both option menus fitted below. The roster's two status pickers now use
`position-try-order: normal`, preferring their native below-field position and
retaining the upward fallback when there is too little space below. Other shared
dropdowns retain their existing presentation.

Four focused Chrome groups pass: both fields at 375px and 1440px, in light and
dark themes, open below with space, flip above near the viewport edge and restore
focus on Escape. Screenshots were inspected; no page errors or API writes occurred.
Frontend lint and production build pass.
Evidence: `work/roster-picker-verification.txt` and the ignored roster-toolbar
`picker-results.json`. The focused run sets `UI_TEST_PICKER_ONLY=1` when running
`tests/student_roster_toolbar_playwright.py` from the frontend directory against
its local port-5178 server. These checks use synthetic API fixtures.

### Grouped chip filter panel — 29 October 2026

The panel and compact CSS are now shared with the [collection filter rollout](GROUPED_COLLECTION_FILTERS.md).
The roster retains its async previous-enrollment preview and dependent group rules.
Its original stylesheet is a compatibility import of `src/styles/collectionFilters.css`.

The user approved the ImageGen concept based on a grouped shopping-filter example.
The instructor toolbar now keeps search visible beside a Filters button and the
existing desktop card/list toggle. Filters opens a desktop popover; phones and
short landscape screens use a bottom sheet. Five labelled native radio groups
cover Course, Enrollment, Account status, Assessment status and Recommendation
status. Each allows one selection; the badge counts nondefault groups and does
not count the separately visible search query. The summary names applied groups
and shows the full filtered count out of the selected collection's total.

Selections are staged. The preview count follows the draft and current search;
Show students applies the draft and resets pagination. Escape, close and outside
interaction discard the draft and restore focus to Filters. Clear filters inside
the panel stages all defaults, including clearing search and returning Enrollment
to Enrolled students; Show students confirms that reset. The toolbar reset applies
those defaults immediately. Batch selection and card/list choice stay intact.
This reset behavior supersedes the older dropdown reset that retained enrollment.

Previously unenrolled previews and their actual collection share the same search,
course and account helper. Assessment/recommendation controls are disabled for
that collection and reset when enrollment scope changes. Its preview uses the
existing authorized endpoint and shared query cache, with loading/error handling
and Retry; it does not add an API or database table. Apply waits for initial
roster/previous-enrollment data instead of presenting a premature zero count.

The user explicitly requested the compact dimensions in their reference after
the first implementation used larger controls. Search and Filters are 38px high;
chips are 28px high. The original quiet card/list toggle uses 26px buttons in a
34px frame with the white/gray selected treatment. The grouped panel uses compact
spacing, scrolls its body when needed and keeps its footer accessible. These sizes
are intentional user preferences and supersede earlier 44px roster-control notes.
Desktop list controls retain their existing mobile hiding/card fallback behavior.

Implementation: [StudentRosterToolbar](../skillbridge-frontend/src/components/instructor/StudentRosterToolbar.jsx),
[filter helpers](../skillbridge-frontend/src/utils/studentRosterFilters.js) and
[toolbar styles](../skillbridge-frontend/src/pages/instructor/studentRosterToolbar.css).
React Aria provides popover/modal dismissal, focus containment and restoration;
native radio inputs provide group names, selected state and arrow navigation.
Shared icons and existing dependencies are reused.

Verification: all 284 Node tests, lint and production build pass. Twelve
responsive light/dark groups at 320x568, 375x812, 768x1024, 1024x768, 1440x1000 and
812x375, keyboard interaction and batch isolation pass. A dedicated preview error/
retry check passes. Review caught a duplicate sibling key and a Retry action that
did not update the shared cache; both were fixed. The failure fixture now accepts
the cache-busting query parameter. Final phone/desktop screenshots were inspected.
The exact-identity matrix passed 180 enrolled and 9 previous-enrollment combinations
in each of phone cards, desktop cards and desktop lists: 540 and 27 combinations
respectively. The first combined run stopped at an applied-count mismatch in the
desktop list after the two card matrices passed. The final isolated desktop-list
replay passed its entire matrix without an application change; that initial
mismatch was not reproduced and the combined run is not recorded as passing.
An additional 40 repeated desktop-list one-result/all-result pointer applies passed
with zero page errors or writes (`work/roster-panel-browser-apply-stress.txt`).
Responsive/keyboard, error recovery and matrix checks amount to 17 passing groups
across the scoped runs. Browser checks use synthetic API responses, block writes
and do not establish live-service or physical-device behavior. Evidence:
`work/roster-panel-browser.txt` (responsive checks),
`work/roster-panel-browser-error.txt`, `work/roster-panel-browser-matrix.txt`
(card passes and initial list mismatch), `work/roster-panel-browser-list.txt`
(final list pass), `work/roster-panel-final-capture.txt`, lint/build/Node logs and
ignored grouped roster-toolbar artifacts.
