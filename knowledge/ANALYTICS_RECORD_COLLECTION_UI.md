# Analytics detailed-record table and card alignment

10 November 2026. Reviewed the admin and instructor Reports & Analytics detailed
records against the instructor dashboard's DashboardStudentCollection. Both
analytics roles use the same AnalyticsRecordTable and AnalyticsStudentCards,
so the changes stay consistent without duplicating either page.

## Changes

- Cards use the dashboard's 20px padding, 16px content gaps, readable student
  heading, placement block, progress treatment, two-column category summaries
  and compact recommendation strip. The responsive grid has one, two or three
  columns, giving analytics context more room than the previous four columns.
- Analytics retains required-assessment progress, batch, instructor, evidence
  availability and follow-up reasons. Required progress replaces the dashboard's
  overall score; no overall grade is synthesized from analytics data.
- Tables retain the dashboard's neutral header, subtle alternating rows, green
  hover/focus, student identity and aligned numeric cells. Compact instructor
  cells also show the batch; placement cells show the approved partner/opening
  separately from the highest recommendation. Real percentage values have a
  subtle score-band surface; saved rank-only recommendations remain neutral.
- Clicking a noninteractive student-row cell opens the existing authorized detail
  dialog. The name remains a native keyboard button, and focus returns there.
  Aggregate report rows remain read-only rather than opening student details.
- Final evidence uses competency_locked when supplied, independently of a stale
  recommendation lock. Locked skill evidence is unavailable in both views.
  Missing current recommendations are explicit; earned zero stays zero. Suggested
  allocations retain their own partner, opening and value rather than borrowing
  the student's highest alternative or implying approval.

Search, filters, sorting, column visibility, pagination, snapshot exports and API
scope remain owned by the existing ReportsAnalytics page and record engine. No
backend, scoring, authorization, chart or map behavior was changed. The shared
report row style also supplies keyboard-focus feedback to embedded report tables.

## Verification

- Frontend lint and production build passed; scoped Git whitespace check passed.
- All 13 focused analytics, activity and recommendation-display tests passed.
- The new analytics_records_ui_playwright.py check passed for admin and instructor
  at 1440, 768, 390 and 320px, including light/dark views, row/dialog keyboard
  focus, matching card/table ordering, search/empty states, pagination resets,
  column visibility and no horizontal page overflow.
- Both roles' CSV and PDF downloads passed. CSV retained all 12 filtered synthetic
  students in the displayed sort order, including records beyond the current page.
- Focused final desktop checks passed after the unavailable-recommendation and
  locked-evidence fixes. They cover distinct allocated-versus-highest scores,
  zero-versus-missing evidence and current competency with locked recommendations.

Browser checks used synthetic GET responses and made no API writes. They verify
presentation and interaction, not live backend authorization or production data.
An initial focused rerun exceeded its navigation setup timeout; the rerun passed
with a separate 30-second navigation allowance for local Vite startup.

Screenshots and receipts: skillbridge-frontend/tests/artifacts/analytics-records-ui.
Use the webapp-testing with_server.py helper to start Vite on port 5211 and run
skillbridge-frontend/tests/analytics_records_ui_playwright.py. UI_TEST_WIDTH=1440
runs only the focused desktop cases; omit it for the complete responsive check.

## Nine-record pages and partner logos follow-up

10 November 2026. Student records now paginate nine at a time in both views,
filling the desktop card grid as 3 × 3 while retaining identical card/table page
membership. Aggregate report page sizes stay at ten. The previous eight-record
limit was a retained pagination constant, not missing data.

The recommendation strip now isolates its logo from text styling in a fixed
32px frame. A broad span selector had overridden the initials fallback's flex
centering. Scoped text selectors preserve centered initials and contained logo
images, including the fallback after a failed image load.

The read-only analytics response adds top_company_image_url and
company_image_url using the existing validated public company-image URL helper.
Top recommendations and saved suggested allocations use their own respective
partner image; a missing allocation logo never borrows the highest alternative's
image. Existing selected company objects supply their image keys without new
database queries. No schema change, migration, upload or scoring change is needed.

Verification: frontend lint/build, nine focused frontend tests and all 26
analytics API tests passed. The API tests used core.test_settings with an isolated
in-memory SQLite database. The eight responsive admin/instructor browser cases
passed again at 1440/768/390/320px with nine records, correct final-page counts,
wide-logo containment, centered missing/broken-image initials and distinct
allocation logo binding, plus the existing sorting/dialog/download checks.
Browser API responses and image assets were synthetic; no live records, storage
uploads or external logo-provider availability were tested.
