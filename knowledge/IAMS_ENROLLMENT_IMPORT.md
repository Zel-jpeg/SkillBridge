# IAMS-compatible student enrollment

## Scope and identity

Instructors import into their own active batches. Administrators can choose any
active batch and see its assigned instructor. Both roles use the same review
dialog. Manual single-student enrollment remains available and uses the same
preview/confirmation contract.

`Student Number`, `Student ID`, `student_id`, `studentId` and `school_id` all
normalize to **User.school_id**. Institutional identifiers are text in
`YYYY-NNNNN` format; for example, `0001-00002` and `2026-01982` retain their
leading zeroes and hyphens. Imported identifiers never become **User.id**.
User IDs remain database-generated primary keys. Year level is review metadata;
the existing User schema has no year-level field.

## File format and limits

The installed SheetJS package reads `.xlsx`, `.xls` (BIFF8) and `.csv`; no CDN is
used. Worksheets are read as arrays. Each worksheet's first 50 rows are scanned
for normalized aliases, ignoring capitalization, whitespace and punctuation in
headers. Every recognized worksheet contributes records; ignored sheet names
are reported. Duplicate mapped headers are rejected as ambiguous.

The IAMS format requires Student Number, Last Name, First Name, Program and
YearLevel. The supported example has college name on row 1, address on row 2,
blank rows, Student Data on row 5, System Generated timestamp on row 6, headers
on row 8 and records from row 9. Titles and metadata before the table are not
student records. Source worksheet and one-based row numbers are retained.
Blank and trailing blank rows are ignored within the worksheet size limit.

The shared instructor/admin enrollment dialog offers one **Download enrollment
template** control. It produces an IAMS-compatible XLSX with the five exact
IAMS headers on row 8 and blank student rows from row 9. The original compact
enrollment modal styling, upload panel, and two-tab layout remain in use.
The importer still accepts existing SkillBridge CSV/XLSX files with
`name,student_id,email,course` headers, although no separate legacy template
is offered. The download contains no real student data.

The existing SkillBridge template requires name, an institutional ID alias,
email and course. Its full name is not guessed into first/last name components.
Empty cells remain editable. Unsupported BCRIM records are valid IAMS-format
records and stay visible; only BSIT and BSIS can enroll. Known full names
“Bachelor of Science in Information Technology” and “Bachelor of Science in
Information Systems” normalize unambiguously; unknown programs are not guessed.

Limits: 5 MiB compressed file size, 1,000 records across all sheets, at most
1,050 worksheet rows including metadata and 101 columns. A worksheet with a
larger used range can be rejected even if excess cells are only formatting;
export a clean copy. These bounds reduce accidental oversized imports but are
not a guarantee against malicious compressed workbooks. Missing headers, empty
lists, ambiguous headers and unreadable files produce explicit errors.

## Review contract

1. Select an active target batch and upload/drop a file or enter one student.
   File preview opens a separate wide review dialog; Back returns to the compact
   upload dialog with a Continue review action. On mobile, review fills the
   viewport and the table scrolls within its own container. Manual review stays
   in the compact dialog.
2. `POST /api/instructor/batches/{id}/enroll/preview/` receives `students`.
3. The backend normalizes, generates emails, checks identities/enrollments and
   returns `rows`, `summary` and a signed `review_token`. Preview creates no
   users/enrollments and sends no emails.
4. Review source row, Student ID, first/last/display names, program, year level,
   email, email source, status and issues. Filters include ready, needs review,
   existing, already enrolled, unsupported, duplicate, invalid and conflict.
   Rows can be edited or removed. All copies of a duplicate are blocked until
   corrected or removed and previewed again.
5. Changes invalidate the review and its counts. Review again, then explicitly
   verify final DNSC addresses. The dialog states enrollment, skip and planned
   notification counts before confirmation.
6. `POST /api/instructor/batches/{id}/enroll/` requires the exact reviewed `rows`
   as `students` and its `review_token`. Tokens expire after 30 minutes and bind
   rows, actor and batch. Every eligible row is revalidated against current data.
   Rows blocked in preview never become eligible during confirmation without a
   new preview. A retry after a lost response must start with preview.
7. Results distinguish enrolled, already_enrolled, unsupported, duplicate,
   invalid, conflict, skipped and failed, with separate notification statuses.

The central Python `generate_dnsc_email` function lowercases and trims names,
uses Unicode NFKD decomposition, removes combining diacritics, maps typographic
dashes to ASCII, removes whitespace/apostrophes/unsupported punctuation,
preserves ASCII letters/digits/internal hyphens, collapses repeated hyphens and
trims outer hyphens. It generates `lastname.firstname@dnsc.edu.ph`, such as
`bali-os.davidrey@dnsc.edu.ph`. It does not infer suffixes, middle-name rules or
missing components. Unusable components require correction. Generated emails
are predictions, labeled Generated; file addresses are Provided, and user
changes are Edited. Edited/provided addresses must pass backend email validation
and use exactly the DNSC domain.

New students' first, last and display names are formatted during authoritative
backend preview: each word separated by whitespace gets an initial capital,
while the rest is lowercased, including text after a hyphen. Thus `DAVID REY`
and `BALI-OS` become `David Rey Bali-os`; `DELA CERNA` becomes `Dela Cerna`.
The rule also applies to new students from the legacy template and manual entry.
Instructors and administrators may correct the display name in review before
confirming; an explicitly edited display name keeps its chosen capitalization
through re-preview, while changing first or last name resets that override.
Existing student account names are left unchanged, including when
their enrollment fills an empty school_id or course. The model no longer
applies `.title()` to student names on save, which previously changed `Bali-os`
to `Bali-Os`.

## Database integrity and migration

Identity checks use both case-insensitive email and school_id, and reject role,
inactive-account, email, populated-ID and populated-program conflicts. Existing
students can enroll; only empty school_id/course fields are filled, and pending
students are approved. Existing names/emails/populated IDs are preserved.
Already-enrolled students are reported without notification.

Each eligible row uses its own atomic transaction. A failed enrollment rolls
back its newly created account or updates while other valid rows may succeed.
Batch locking rechecks active status; existing user rows are locked. Database
constraints settle races across batches and other account-creation paths.

Migration `0012_user_unique_populated_school_id_and_more` adds a conditional
unique constraint for nonempty school_id and a unique Lower(email) index.
Existing BatchEnrollment uniqueness remains unchanged. No tables are renamed,
no new student-number column exists, and `api_` table names are preserved.

**Apply this migration before enabling confirmation in another existing
deployment.** Review duplicate nonempty school_id and case-insensitive email
groups first. The migration intentionally fails on duplicates; it does not
clean, delete or rewrite identities. Resolve any conflicts with the data owner.
In the Supabase demonstration database, read-only preflight found zero duplicate
populated IDs, zero normalized-email duplicates and no index-name collisions.
Migration 0012 applied successfully there on 2026-09-30. Automated migration
validation still uses SQLite via `core.test_settings`. PostgreSQL concurrent
import behavior has not been stress tested.

## Email dispatch

`api/email_service.py` replaces the unbounded per-email daemon-thread code with
a bounded 1,000-item in-process queue and a single lazily started daemon worker.
Only newly created BatchEnrollment records register `transaction.on_commit`
callbacks. Queue/configuration/start failures return `dispatch_failed` while
enrollment remains committed. Existing enrollments return
`skipped_existing_enrollment`. `queued` means accepted by the local dispatcher,
not provider acceptance or inbox delivery.

The worker uses Brevo's HTTPS transactional endpoint, with a 5-second connect
and 15-second read timeout. Configuration comes from environment variables:

- `BREVO_API_KEY`: required for the primary HTTPS method.
- `BREVO_SENDER_EMAIL`: verified sender; defaults to `DEFAULT_FROM_EMAIL`.
- `DEFAULT_FROM_EMAIL`: also used for SMTP (existing setting).
- `ENROLLMENT_SMTP_FALLBACK=True`: explicit local/supported-environment opt-in.
- `RAILWAY_ENVIRONMENT_ID` or `RAILWAY_PROJECT_ID`: disables SMTP fallback.
- Existing `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`,
  TLS/SSL and `EMAIL_TIMEOUT` configure that optional fallback.

Provider acceptance and errors log only internal user IDs and HTTP status codes;
no full addresses, credentials, exception text or provider response bodies.
The existing HTML enrollment message and DNSC Google login instructions remain;
dynamic HTML values are escaped, and notifications name the batch's instructor.

The queue is deliberately lightweight and **not durable**. Process shutdown can
lose queued jobs. Worker failures after the response are logged, not reflected
retroactively in the API response; there is no persistent delivery history or
automatic retry. A durable outbox is a future enhancement if reliable recovery
becomes required. Enrollment is never rolled back for notification failures.

## Original defects addressed

- CDN SheetJS loading, first-sheet-only parsing and first-row-only headers.
- Unsupported/invalid rows dropped instead of retained for review/correction.
- No backend preview, required review binding or authoritative email generation.
- Administrator enrollment incorrectly filtered batches by instructor ownership.
- Enrollment accepted missing/invalid identifiers, arbitrary courses and unsafe
  identity matches; no database uniqueness for populated institutional IDs.
- User creation and enrollment were not atomic per row.
- Full recipient/provider response logging, no HTTPS timeout, uncontrolled SMTP
  fallback and unbounded daemon threads.
- Instructor UI fabricated optimistic IDs and could report skipped rows as new
  students; it now reloads actual server records after confirmation.

## Verification and controlled-test record

Automated tests use `core.test_settings` only, with Brevo disabled and email
delivery mocked. Cross-stack tests invoke the actual SheetJS parser from Python
to verify metadata/header/worksheet mapping at the backend boundary.

The browser harness uses its own SQLite database under ignored `tests/artifacts`,
synthetic instructor/admin/student accounts, and mocked notification dispatch.
It routes API traffic exclusively to port 8017, never the normal backend.
Run from the repository root:

```powershell
node skillbridge-frontend/tests/enrollment_fixture.mjs
python .agents/skills/webapp-testing/scripts/with_server.py --server "node skillbridge-frontend/node_modules/vite/bin/vite.js skillbridge-frontend --host 127.0.0.1 --port 5174 --strictPort" --port 5174 --server "skillbridge-backend/venv/Scripts/python.exe -u skillbridge-frontend/tests/enrollment_server.py" --port 8017 --timeout 60 -- python skillbridge-frontend/tests/enrollment_playwright.py
```

The browser script needs Python Playwright (the existing `tests/.runtime`
installation) and Chrome. Sandbox access may require approval.

The isolated gates passed before live work. The 17 previously existing lint
errors were cleared with small local changes; full lint exits successfully with
eight warnings. The build and isolated tests pass. The connection to the
Supabase demonstration database succeeded through the configured pooler;
configuration identifies project reference `xlkyxnljcvpkdwnqaskc`. No
credentials or connection string were printed. A connection alone does not
independently establish which Supabase dashboard project the user intended.

The first two addresses offered by the user belong to an existing instructor
and an existing student. A separate controlled DNSC test address was confirmed
absent from the User table before import. Neither existing identity was changed.
The first synthetic address had a missing character and hard-bounced. The
mistype is consistent with the bounce, though Brevo's detailed reason was not
retrieved. The user supplied a corrected address, so the second
synthetic record completed the authorized initial 1–2 student test. Railway
and Vercel were not deployed. At that stage, no Supabase data was reset,
deleted or manually modified; a later user-requested cleanup is recorded below.

### Controlled Supabase demonstration result

- Existing user count before the test: 18. The configured instructor is active,
  approved and has internal User ID 20.
- Applied `api.0012_user_unique_populated_school_id_and_more` after confirming
  zero conflicting identity groups, the required auth migration and no index
  name collisions. The migration added constraints and did not rewrite rows.
- Created active batch **TEST ONLY - IAMS Enrollment 2026-09-30** through the
  existing instructor API; batch ID **5**.
- Created a one-student XLSX with the exact IAMS metadata/header structure:
  header row 8, student row 9, Student Number `2099-00001` as text, BSIT and
  YearLevel 4. The installed frontend parser preserved that ID and row number.
- Preview showed the expected generated DNSC email; a second preview applied
  the user's controlled address as **Edited**. Both previews returned one ready
  row and left User and BatchEnrollment counts unchanged.
- Confirmed only that row through the enrollment endpoint. Internal User ID
  **74**, BatchEnrollment ID **36**; `User.school_id` is exactly `2099-00001`.
  The internal key is database-generated. User and enrollment counts each rose
  by one. The API reported `enrolled` and notification `queued`.
- The Brevo sender was registered and active. Its HTTPS API accepted the
  transactional request. Brevo event history then recorded `requests` followed
  about one second later by **`hardBounces`**. The user checked inbox and spam
  and reported **not received**. The provider accepted the request but delivery
  failed. A later read-only request for the bounce reason was rejected, so the
  cause remains unknown. Do not claim delivery from provider acceptance alone.
- Re-previewing and confirming the same row returned `already_enrolled` and
  `skipped_existing_enrollment`, with zero new users/enrollments and zero
  notification calls.
- The user corrected the controlled recipient address. A read-only check showed
  the corrected address and Student ID `2099-00002` were unused. A second
  one-student XLSX used the same IAMS row structure with BSIS. Generated email
  formatting matched `testcase.bridgetwo@dnsc.edu.ph`; review marked the
  corrected controlled address **Edited**. Preview returned one ready row and
  created no user or enrollment.
- Confirming the second row created User ID **75** and BatchEnrollment ID **37**;
  `User.school_id` is exactly `2099-00002`, distinct from internal `User.id`.
  One user and one enrollment were added; the API returned `enrolled` and
  notification `queued`. Brevo accepted the request and recorded **`delivered`**
  on 2026-09-30 at 11:36:11 +08:00. The user independently confirmed the
  message arrived in the **inbox**. This establishes actual delivery for the
  corrected test account.
- The first synthetic User ID **74** remained in the labeled test batch immediately
  after the live test. It was never overwritten or retried. A later requested
  cleanup deleted that user and its enrollment; no additional emails were sent.

### User-requested demonstration cleanup on 2026-09-30

The user requested removal of User IDs 6, 56–66 and 68–74 and their linked data.
The read-only preview found 16 existing accounts; IDs 59–61 were already absent.
The user confirmed that the two `QA Sep25` batches owned by test instructors
69 and 70 could be deleted, along with approved OJT placement ID 1 for student
58. A guarded Django ORM transaction checked those exact identities, roles,
batch names and ownership, assessment IDs, placement state, and absence of
other students in those QA batches before deleting. It deleted 16 users, QA
batches 3 and 4, assessments 4–10, the approved placement, and related student
enrollment/assessment records. No raw SQL or manual table edit was used, and
no notification was sent.

An independent read-only verification found zero requested users, zero
enrollments or responses for those IDs, no QA assessments 4–10, and no placement
ID 1. Batches 1, 2 and 5 remain, as do User IDs 3, 20, 67 and 75. The corrected
synthetic import test (User 75 in batch 5) was outside the requested deletion
range and remains available for repeat testing.

### Results on 2026-09-30

| Check | Actual result |
| --- | --- |
| `python manage.py check` | Passed, no issues (no database mutation) |
| `python manage.py test api.test_enrollment_import --settings=core.test_settings` | 31 tests passed |
| `python manage.py test api.test_enrollment_import api.tests api.test_multiple_assessments api.test_combined_competency api.test_management_step4 --settings=core.test_settings` | 86 tests passed; SQLite only, mocked delivery |
| `python manage.py makemigrations --check --dry-run --settings=core.test_settings` | Passed, no changes detected |
| `node --test src/api/*.test.mjs src/navigation/*.test.mjs src/utils/*.test.mjs src/pages/student/*.test.mjs` | 36 passed, including 12 import tests |
| `npm run lint`, `npm run build` | Global npm launcher failed because its npm-cli.js is missing; used installed local binaries below |
| `node node_modules/eslint/bin/eslint.js .` | Passed after small fixes to existing errors; 0 errors, 8 warnings |
| Local ESLint on all seven changed JS/JSX application files | Passed, no findings |
| `node node_modules/vite/bin/vite.js build` | Passed; warns about a >500 kB chunk and SheetJS being both statically and dynamically imported |
| `git diff --check` | Passed; only Windows LF/CRLF informational warnings |
| Python Playwright + installed Chrome | 11 scenarios passed, zero page errors |

Browser coverage includes both instructor/admin pages at 375, 768, 1024 and
1366 pixels: the single IAMS template download, file parsing, wide review,
email and name editing, explicit revalidation, Back/Continue, unsupported and
duplicate filters, counts, no document horizontal overflow, and internal table
scrolling. Both roles completed manual enrollment. Admin completed a real IAMS
confirmation against the isolated API, then repeated preview and observed three
already-enrolled rows with zero ready rows/notifications. Keyboard focus remained
inside the dialog; Escape closed it. Screenshots were inspected at 375 and 1366
pixels. Header/footer stay visible while the content scrolls. Mocked notification
acceptance in these tests is not evidence of Brevo acceptance or inbox delivery.

### Changed files

Backend:

- [enrollment_import.py](../skillbridge-backend/api/enrollment_import.py)
- [email_service.py](../skillbridge-backend/api/email_service.py)
- [test_enrollment_import.py](../skillbridge-backend/api/test_enrollment_import.py)
- [models.py](../skillbridge-backend/api/models.py)
- [views.py](../skillbridge-backend/api/views.py)
- [urls.py](../skillbridge-backend/api/urls.py)
- [migration 0012](../skillbridge-backend/api/migrations/0012_user_unique_populated_school_id_and_more.py)
- [settings.py](../skillbridge-backend/core/settings.py)
- [test_settings.py](../skillbridge-backend/core/test_settings.py)

Frontend:

- [StudentEnrollmentModal.jsx](../skillbridge-frontend/src/components/enrollment/StudentEnrollmentModal.jsx)
- [EnrollModal.jsx](../skillbridge-frontend/src/components/instructor/EnrollModal.jsx)
- [studentEnrollmentImport.js](../skillbridge-frontend/src/utils/studentEnrollmentImport.js)
- [studentEnrollmentImport.test.mjs](../skillbridge-frontend/src/utils/studentEnrollmentImport.test.mjs)
- [EnrolledStudents.jsx](../skillbridge-frontend/src/pages/instructor/EnrolledStudents.jsx)
- [useEnrolledStudents.js](../skillbridge-frontend/src/hooks/instructor/useEnrolledStudents.js)
- [AdminUsers.jsx](../skillbridge-frontend/src/pages/admin/AdminUsers.jsx)
- [useAdminUsers.js](../skillbridge-frontend/src/hooks/admin/useAdminUsers.js)
- [index.css](../skillbridge-frontend/src/index.css)
- [enrollment_fixture.mjs](../skillbridge-frontend/tests/enrollment_fixture.mjs)
- [enrollment_server.py](../skillbridge-frontend/tests/enrollment_server.py)
- [enrollment_playwright.py](../skillbridge-frontend/tests/enrollment_playwright.py)

Lint-gate repairs in existing files:

- [AddressDropdowns.jsx](../skillbridge-frontend/src/components/AddressDropdowns.jsx)
- [SkillTagBadge.jsx](../skillbridge-frontend/src/components/SkillTagBadge.jsx)
- [PendingDetailModal.jsx](../skillbridge-frontend/src/components/admin/PendingDetailModal.jsx)
- [SkillLeaderboardModal.jsx](../skillbridge-frontend/src/components/instructor/SkillLeaderboardModal.jsx)
- [ToastContext.jsx](../skillbridge-frontend/src/context/ToastContext.jsx)
- [useAdminCompanies.js](../skillbridge-frontend/src/hooks/admin/useAdminCompanies.js)
- [useAdminSkills.js](../skillbridge-frontend/src/hooks/admin/useAdminSkills.js)
- [useAssessmentUpload.js](../skillbridge-frontend/src/hooks/instructor/useAssessmentUpload.js)
- [useStudentProfile.js](../skillbridge-frontend/src/hooks/student/useStudentProfile.js)
- [StudentSetup.jsx](../skillbridge-frontend/src/pages/student/StudentSetup.jsx)

Documentation: this file and [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).
No dependencies were added. Test databases, synthetic workbooks, screenshots and
test-only tokens are under the existing ignored `tests/artifacts` directory.
