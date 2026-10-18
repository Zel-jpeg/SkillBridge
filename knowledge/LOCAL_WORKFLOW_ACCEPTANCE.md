# Local three-role workflow verification

V01 uses the currently accepted Excel/CSV/text question format and the existing
official IAMS enrollment layout. The user explicitly authorized continuing local
workflow/device/performance checks and subsequently designated this question format as final for the 28-task
release. The unseen official LMS comparison is now a later follow-up, not a P01
or S01 blocker; see [accepted import format](QUESTION_IMPORT_FORMAT.md).

`work/defense_audit/v01_fixture.py` creates a dedicated localhost PostgreSQL
`test_skillbridge_v01_<pid>` database, applies migrations and drops that exact
database on exit. Dotenv is disabled. Google identity lookup, email, address/map
providers are mocked; Django authentication, permissions, writes, scoring,
recommendations, reports and React/API calls are real. Catalog/batch/enrollment
setup uses signed API clients; the browser performs sign-in, approval, question
import/publication, profile setup, attempts, retake, placement and downloads.
No configured Supabase database or real student/provider action is involved.

`v01-flow-progress7.txt` records the passing fifteen-group linked workflow:

- Admin password and instructor/student mocked-provider sign-in use the actual
  authentication endpoints. Admin instructor approval persists.
- Instructor publishes one text-imported assessment with MCQ, true/false and
  identification questions, and one CSV-imported assessment using installed
  SheetJS. The current CSV importer is exercised through its existing CDN entry
  point with the local installed library supplied by the test adapter.
- Student profile setup saves school/course/contact, selected address and an
  explicit map pin. Student flow uses Chrome phone emulation; staff use desktop.
- The real server supplies randomized question/choice layouts. Repeated start
  preserves order and attempt identity; local answers belong to the current
  student. Both required assessments must complete before final matches unlock.
- Known submitted answers produce combined Programming3/3 and Networking0/1,
  retaining individual assessment evidence.
- Instructor confirms a retake for the exact assessment. Existing results remain
  until the retake starts; starting it archives prior evidence and relocks final
  recommendations. Completion restores the gate and retains one prior attempt.
- Admin approval reserves one seat, removal retains history, and manual
  reassignment creates one current approval. Student sees the finalized placement.
  Direct student/instructor calls to admin data return403.
- Actual placement PDF/XLSX files are downloaded. Independent pypdf/openpyxl
  verification finds both Removed and Approved rows, the correct institutional
  ID/company, and no executable workbook formulas (`v01-export-verification.txt`).

The existing recovery fixtures separately check rejected/malformed writes,
repeated clicks, draft retention, background failures, protected deletes,
loading/empty states, access loss and account boundaries. Seven fixtures passed
in `v01-regressions-run.txt`; the admin-assessment and sign-in fixtures needed
their old raw503 error expectations updated to the already-implemented safe
outage wording. Their final logs are `v01-admin_assessments_playwright.txt` and
`v01-auth-browser-final.txt`. The auth browser run passes all twelve cases.
`v01-timing-regression.txt` passes four real-API timing/failed-submit/retry/expired
review groups. Previous V03 full280 PostgreSQL and116 frontend passes cover the
same application source; this task changes browser fixtures/documentation only.

Intermediate workflow logs are retained. Incorrect route/tab/label assumptions,
test ORM calls inside Playwright's event loop, a barangay option value, an
incomplete Leaflet adapter and retake-gate timing were harness errors. One desktop
fullscreen start timed out while other browser fixtures ran; the final student
chain used phone emulation. Desktop fullscreen is explicitly left to V07's
separate matrix, without claiming the timeout passed. The passing map adapter
checks backend data/pins and UI state, not real tile availability. Browser-close
broken-pipe diagnostics and intentional403 logs are not failed assertions.

Screenshots, final DOM, control inventories and saved reports are in
`work/defense_audit/v01-artifacts/`. This is reproducible local evidence, not
physical-device, performance, live Google/email or hosted acceptance.
