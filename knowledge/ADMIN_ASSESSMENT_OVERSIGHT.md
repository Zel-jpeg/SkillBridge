# Admin assessment oversight

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
