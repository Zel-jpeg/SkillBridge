# Admin assessment oversight

## Eight assessments per page — 30 October 2026

The admin and instructor libraries now show eight cards or eight list rows per
page. Desktop cards retain four columns, giving two rows on a full page. The list
footer and loading placeholders share the page size. View switching preserves the
current page, and pagination starts at nine matching assessments. This supersedes
the older four-record collection page-size notes below. Detail-dialog lists keep
their existing page sizes; backend access, grading and student aliases are unchanged.

## Grouped filters — 29 October 2026

Admin now reuses the [compact grouped filter panel](GROUPED_COLLECTION_FILTERS.md)
with instructor Assessments and the student roster. It preserves publication,
instructor, batch, requirement, category, completion, inclusion and availability
choices. Draft selections preview results; Apply commits together and resets page
1 without resetting view. Clear and individual filter removal remain. Initial
failures show an unavailable state rather than a successful zero count. Management
dialogs, answer-key access, saved drafts, retakes, summaries and permissions retain
their existing behavior. The previous toolbar descriptions below are historical.

## Refined assessment cards — 28 October 2026

The shared card now follows the approved compact
[assessment card design](ASSESSMENT_LIBRARY_UI.md): clearer configuration rows,
shorter schedule text and two aligned Questions/Submitted metrics. Admin cards
keep instructor identity, assigned-student totals, completion rate/count and
stopped/flagged evidence. The completion bar is explicitly labelled and still
uses the API completion percentage; it is not derived from the new Submitted
metric. Four-column desktop layout, filters, list view and management workflows
remain. The progress helper only hides its repeated submission heading inside
these cards; the existing dialog/list presentation is unchanged.

## Shared instructor-style library — 28 October 2026

Admin and instructor collections now render the same
[AssessmentCollection](../skillbridge-frontend/src/components/assessment/AssessmentCollection.jsx).
Both use four desktop cards per row, four assessments per page, the shared
compact card/list toggle, neutral category disclosures, grouped metadata and a
contained six-column list. Non-interactive list cells activate the assessment's
native title button; keyboard activation and focus restoration still use that
button. Category expansion stays independent of opening the assessment. Phones
use cards even when the saved view is List.

Admin retains all five global summary metrics, instructor identity and filtering,
batch/publication/requirement/category/completion/inclusion/availability filters,
active filter removal and reset, authoritative submitted/assigned counts,
completion percentage/count, and stopped/flagged counts. Its progress bar measures
completion, not submission rate. Header, tabs, spacing and control styling follow
the instructor library without copying instructor-only summary meanings.
Initial collection skeletons match the grid: four columns from 1280px, two from
768px, and one on phones. This follows the user's four-column refinement; list
view and four-record pagination are unchanged.
The refinement passes lint/build and 24 synthetic layout checks across both
roles at 320, 375, 768, 1024, 1440 and 1920px in light/dark mode, with no page/card
overflow; category disclosure and list switching also pass.

The admin management dialog is unchanged: Overview, Settings, Students & attempts,
and Questions remain, including confirmed saves, dirty-draft protection, explicit
authorized answer-key requests, assessment-specific retakes, authoring, archive
and duplication. Backend scope/permissions, polling and scoring are unchanged.
The four-record collection page size supersedes older ten-record library notes
below; student/answer-key lists inside the admin dialog still use ten records.

Local verification: frontend lint/build, 28 assessment utility tests, all nine
admin browser groups and all 11 instructor browser groups pass. Browser checks
use synthetic intercepted APIs and cover card/list pagination and live clamping,
full-row opening and focus restoration, independent category disclosures, admin
instructor/completion/inclusion/availability filters, save/retake/key workflows,
loading/error/empty/access-loss states, and responsive light/dark layouts from
320 to 1440px. Existing obsolete section-loader labels in the admin test were
updated to the current enrolled-student and authorized-question labels. No live
API writes, database tests or hosted deployment were performed for this UI change.

## Card and management dialog consistency — 26 October 2026

The admin library now shares the instructor's category pill component. Cards,
list rows and the overview initially show three categories; `+N more` expands
all remaining categories inline and Show less collapses them. Reading categories
does not open the assessment or dirty its settings. Cards use a neutral rounded
surface, blue batch pill, grouped configuration and separate progress/schedule.
Admin instructor identity and submission/completion/integrity meanings remain.

The responsive management dialog has an assessment icon, saved status and batch,
responsible instructor, grouped overview facts, and the instructor editor's
settings and schedule presentation. Existing attempt locks are explained in one
expandable notice; changed-setting effects remain visible. Reuse/archive actions
sit below the active section. The title input stays in Settings; the fixed footer
retains review/save, reset and dirty-close confirmation behavior. Ten-record
pagination, live draft reconciliation, lazy roster/key loading, assessment-specific
retakes and backend access boundaries are unchanged.

The shared calendar uses its owning native dialog as the portal container. This
fixes a popup that otherwise appeared behind the admin dialog and was inert.
The existing calendar draft, Apply/Cancel/Clear and Manila conversion are reused.
No API, scoring, timing policy, dependency or backend data changes are required.

Verification passed frontend lint/build, all 167 discovered JavaScript tests,
the nine-group admin assessment browser suite, and all 11 instructor assessment
browser groups with zero page errors. Admin checks include inline expansion in
cards/list/overview, duration validation, dirty/save/retry and access-loss flows,
lazy rosters/keys, retakes, keyboard focus, aligned settings controls, and calendar
Apply/Cancel/Escape in the native dialog. Five widths (320, 375, 768, 1024 and
1440px) were checked in light and dark themes. Desktop cards, overview/settings
and narrow light/dark calendars were visually reviewed. All browser data is
synthetic and API requests are intercepted; live backend writes, authorization
and device-specific screen readers were not exercised. The real-API timing
browser test's selectors now match the shared calendar, but that database-backed
suite was not run for this presentation change.

Previews are in `outputs/ui-previews/admin-assessments-2026-10-26/`; the full
browser screenshots remain in ignored `tests/artifacts/admin-assessments/`.

25 October timing follow-up: [assessment editing and timing](ASSESSMENT_LIFECYCLE_AND_TIMING.md)
adds shared used-assessment locks, settings-impact review, Duplicate as draft and
audited Grant extra time in actionable student details. Backend rules apply to
admins as well as instructors; this supersedes older editable-settings wording.

25 October follow-up: [assessment archives](ASSESSMENT_ARCHIVES.md) adds a dedicated
archive page linked from oversight, shared archive/restore confirmations, and
read-only archived details with authorized results and answer keys. Oversight
library totals exclude archives; report/history reads retain them.

20 October follow-up: [admin management implementation](ADMIN_MANAGEMENT_IMPLEMENTATION.md)
adds the admin creator and shared authoring dialog. Questions offers Edit assessment
and questions, with atomic draft changes and unchanged attempt locks. Existing
settings/attempt workflows remain. Earlier statements below about unchanged
backend contracts describe the original oversight UI change.

The Admin Assessments page follows Admin Users' content width, compact controls,
rounded white surfaces, green accents and default card view. The existing shell
and Admin Users page are unchanged. List view uses a table with its own horizontal
scroll container on narrow screens. Both views share one filtered and ordered
dataset, with ten assessments per page. Changing views preserves the page and
filters; changing any filter resets the page. Live removals clamp the current page.
Clicking anywhere on an assessment card opens its management dialog. Its title
is a native keyboard-accessible button with a stretched hit area and a card-wide
focus outline. Category disclosures stay independently interactive above that
hit area, with no nested interactive controls or separate View details action.
Records sort by creation time descending, then ID descending, so changing completion
or publication does not reshuffle unchanged records.

Summary cards and status-button counts use the complete endpoint response.
The result count and pagination range use the filtered collection. The integrity
summary sums the API's combined `flagged_count`; the UI does not infer separate
stopped and flagged counts. Completion uses the server's `completion_rate` and
`completion_count`, while submissions use `submission_count` and `assigned_count`.
These are deliberately separate measures. Batch filter choices are unique by ID.

The shared native DialogShell provides focus trapping/restoration, nested
confirmation handling, Escape/backdrop behavior and reference-counted scroll
locking. Its four sections separate read-only overview data, editable settings,
student attempts, and explicitly requested authorized answer keys. The roster
subscribes only while Students & attempts is active. Questions subscribe only
while Questions is active and the user has explicitly requested the key. Student
and question lists are bounded to ten visible records per page.

Settings drafts and their baseline are separate from live assessment data.
Pristine settings follow server updates; dirty drafts are preserved and show a
notice if server settings differ. Reset reloads current settings. Save retains
the existing confirmation and server validation, then publishes the mutation
response through the shared cache before reconciliation. Closing dirty settings
requires a discard confirmation. Deletion or definitive loss of access replaces
the dialog with an unavailable state and removes its management controls.
Read-only overview data and selected student attempts follow cache updates.
Retake controls target only the assessment opened in this dialog. The shared
student detail's combined competency and recommendations remain batch-level
information; they are not recalculated by this page.

No API contract, backend permission, scoring rule, recommendation gate, schema,
production data, deployment, polling loop or frontend dependency was changed.

## Verification

Run from `skillbridge-frontend` with dependencies installed:

```powershell
npm run lint
npm run build
node --test "src/**/*.test.mjs"
```

The host's npm launcher referenced a missing global npm installation. Equivalent
project tools were run successfully with:

```powershell
node node_modules/eslint/bin/eslint.js .
node node_modules/vite/bin/vite.js build
```

The unit suite passed all 76 tests, including five focused state tests for combined
filtering before pagination, deterministic ordering, page clamping/view state,
dirty-draft reconciliation and settings validation. Lint had no errors and five
existing warnings in unrelated company/profile/setup files.

For synthetic browser checks, start local Vite on port 5175:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort
```

Then run from the repository root with Python Playwright and Chrome available:

```powershell
python skillbridge-frontend/tests/admin_assessments_playwright.py
```

The test uses installed Python Playwright, or the ignored test-local `.runtime-win`
or `.runtime` package directory. It intercepts every API request and blocks
unrelated external requests. It needs no backend, real credentials or database.
Screenshots are written under
`skillbridge-frontend/tests/artifacts/admin-assessments/` (ignored).

Coverage includes 27 assessments; pagination and switching in both layouts;
combined search/status/instructor/batch/category/requirement filters; independent
global counts; deduplicated batches; live clamping; shared modal opening;
validation and nested confirmations; save failure/retry/success; lazy roster and
key requests; bounded lists; exact retake payload and refreshed approval; dirty
settings during simulated SSE invalidation; deletion/access loss; loading, empty,
background failure and retry states; focus handling; scroll locking; and mobile,
tablet, desktop and dark layouts. The browser uses reduced-motion preferences.

Actual SSE transport, backend/database mutations and production authorization
were not exercised by these mocked browser checks. The existing backend permission
and response paths were read during the audit; backend rules were not modified.
Native mobile keyboards, screen-reader announcements and non-Chromium browsers
still need device-specific verification.

## Changed files

- `src/pages/admin/AdminAssessments.jsx`: page hierarchy, summaries, controls,
  shared card/table results, pagination and selection.
- `src/hooks/admin/useAdminAssessments.js`: cache-observed assessment reads,
  including background failures and definitive access loss; replaces the unused
  legacy active/inactive filtering implementation.
- `src/components/admin/AssessmentManagementDialog.jsx`: sectioned management
  dialog, protected settings, lazy detail queries and existing save/retake flows.
- `src/components/admin/AssessmentPresentation.jsx`: page/modal badges, category
  disclosure, progress, range/pagination wrapper, skeletons and retry/action states.
- `src/components/AssessmentStudentDetail.jsx`: optional assessment ID to scope
  retake controls in this dialog while preserving full student history and batch
  evidence. Other callers retain their existing controls.
- `src/utils/adminAssessmentState.js` and its `.test.mjs`: testable filtering,
  ordering, pagination, draft reconciliation and validation.
- `tests/admin_assessments_playwright.py`: isolated browser regression scenarios
  and representative screenshots.
- `tests/.gitignore` and `eslint.config.js`: exclude the Windows test-local
  Playwright runtime from tracking and lint traversal.
- This document and `knowledge/PROJECT_OVERVIEW.md`: behavior, verification
  commands, remaining limits and the discoverable overview link.
