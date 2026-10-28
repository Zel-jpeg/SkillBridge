# Enrollment workflow review — 28 October 2026

The approved follow-up adds email-group progress and plain-language completion
notifications. Enrollment saving, provider submission and confirmed delivery
remain separate. Progress reuses the existing five email tables; this follow-up
adds no schema migration. See [current delivery behavior](ENROLLMENT_EMAIL_DELIVERY.md).

## Review findings fixed

- **Lost enrollment responses:** confirmation lacked a durable result receipt.
  A frozen UUID/payload now recovers the saved result without another enrollment
  or email notice. Unknown responses show Check enrollment result, while identity,
  method and timing edits are disabled. Known validation errors require review.
- **Backend enrollment access:** preview and confirmation now explicitly require
  active admins or active, approved instructors and preserve batch ownership and
  active-batch checks. Replaying a receipt never bypasses those checks.
- **Malformed success responses:** the client now validates enrollment rows and
  summary counts before showing success. Invalid responses enter explicit recovery.
- **Retry after ownership/address changes:** eligible failure retries use the
  currently authorized requesting staff member and reject changed recipients
  instead of reviving an old address or former instructor's sending authority.
- **Input changes during saving:** enrollment method controls are locked during
  confirmation and uncertain-result recovery. The loading label distinguishes
  validating review data from saving enrollment.
- **Unnecessary service warnings:** the warning now requires eligible unsent jobs
  in the full batch roster. History-only, held, completed and empty states no
  longer claim saved email requests need attention. Instructors see a short
  actionable message; worker/provider diagnostics are returned only to admins
  and remain collapsed in their interface. Filtering cannot hide a real queue.

## Progress and notification contracts

- Groups preserve original notice IDs and totals through filtering, partial
  release, later enrollments, resends and unenrollment. Missing notification rows
  remain visible as requiring attention; their denominator does not disappear.
- Submitted counts represent provider acceptance. Delivered counts require saved
  delivery evidence. Later failure/suppression, uncertain acceptance or cancellation
  prevents a false all-success reminder even if acceptance happened earlier.
- Held jobs do not auto-release. Quota waits, unavailable worker/configuration and
  actionable failures have explicit states; no fake countdown or infinite spinner.
- The page progress strip, modal group selector, completion bell and observed live
  completion toasts use existing authorized reads/invalidation. Five recent groups
  per batch are displayed; completion bell entries additionally use a seven-day
  window and the existing browser read state. Old groups/toasts are not fabricated.

## Verification

- PostgreSQL: **125 tests passed**, no skips, in the main isolated suite, including
  enrollment/import, access/recovery, outbox, quota reset, provider evidence,
  analytics, migration compatibility and actual worker/command concurrency.
- A separate PostgreSQL test passed for two concurrent enrollment submissions
  sharing one receipt, one saved result and one new email job.
- **Seven SQLite progress tests passed**, including fifty-recipient progress,
  missing-notice handling, fixed denominators, receipt recovery, staff scopes,
  bounded reads, retry authority and recipient changes.
- Frontend: **213 tests passed**; ESLint and the production build passed.
- Synthetic email UI checks passed for instructor 1366px/768px and admin
  1366px/375px: group totals, completion toast/bell links, lost-response recovery,
  frozen identities/timing, send/retry reviews, filter/page behavior, dark mode,
  empty/error states, focus and archived read-only access.
- `tests/enrollment_workflow_playwright.py` passed against the real Django API on
  its own disposable SQLite database: instructor IAMS upload with unsupported and
  duplicate rows, observed disabled Enrolling state, two held notices and explicit
  release; admin named confirmation, intentionally dropped committed response,
  same-payload recovery and exactly one saved notice for that student. The worker
  never runs and the fixture API key is blank. Desktop and phone geometry passed.

Evidence: `work/email-outbox-postgres-ptgpr5h1/tests.txt` (main suite),
`work/email-outbox-postgres-3r90_mt7/tests.txt` (concurrent enrollment),
`work/email-progress-targeted.txt`, `work/email-progress-{unit,lint,build,browser}.log`.
The real-API browser evidence is `work/enrollment-flow-review.log` with synthetic
screenshots under `skillbridge-frontend/tests/artifacts/enrollment/workflow-*.png`.
All fixtures are synthetic. Verification does not establish real Brevo allowance,
sender/domain configuration, hosted worker availability or real inbox delivery.
No configured application database was migrated or modified, and no real emails
were sent.

The service-warning follow-up passed 36 relevant SQLite tests (four PostgreSQL-only
concurrency cases were skipped), the 213-test frontend suite, lint/build and the
staff browser checks. Evidence is in `work/email-warning-{backend,unit,lint,build,browser}.log`.
