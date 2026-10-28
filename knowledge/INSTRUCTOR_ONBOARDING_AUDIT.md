# Admin-created instructor audit — 28 October 2026

The normal creation-to-sign-in journey works. The original review found three
issues: concurrent duplicate requests returned HTTP 500, the form rejected
addresses the API correctly normalizes, and the overlay lacked accessible
dialog/keyboard behavior. All three were corrected in the user-authorized
follow-up, verified below. Tests use synthetic identities and disposable local
databases, with no real messages, schema changes or production migrations.

## Original findings and implemented fixes

### P2, fixed: Concurrent duplicate creation returned a server error

The original [admin_instructors](../skillbridge-backend/api/views.py) checked
whether an email and instructor ID existed, then created the user. Two requests
could pass those checks. Database uniqueness preserved a single account, but the
endpoint did not handle the losing insert as a normal conflict.

The PostgreSQL diagnostic synchronizes two independent requests after validation.
Observed responses were **201 and 500**, with exactly **one account and one welcome
notice**. The desired response pair is **201 and 409**. The duplicate check works
for sequential retries; this defect concerns overlapping requests.

Resolution: account insertion and unusable-password setup share an atomic block.
After an integrity conflict rolls back its savepoint, the endpoint checks email
and instructor ID and returns the appropriate 409. Unrelated integrity failures
are re-raised rather than mislabeled as duplicates. Email lookup ignores case.
Welcome queueing remains outside that creation block, preserving a saved account
when optional notification storage fails. The existing constraints need no migration.

Both concurrency regressions are ordinary passing tests in
[InstructorCreationRaceAudit](../skillbridge-backend/api/test_instructor_onboarding.py).
The former `expectedFailure` marker was removed. Concurrent requests claiming
the same email/identity or different emails with the same instructor ID now each
produce **201 and 409**, one account and one welcome notice. Additional tests
verify rollback if password setup fails and propagation of unrelated integrity errors.

### P2, fixed: The add-instructor overlay lacked accessible modal behavior

[AddInstructorModal.jsx](../skillbridge-frontend/src/components/admin/AddInstructorModal.jsx)
originally rendered a generic overlay without a dialog role/label, initial input
focus, focus trap or Escape dismissal. Its visible field labels were not associated
with the inputs. Desktop and phone checks confirmed keyboard focus could move to
the underlying page while the overlay remained open, and Escape did not close it.

Resolution: the form uses the shared DialogShell, named controls, associated
labels, linked field errors, email initial focus, Tab/Shift+Tab containment,
Escape dismissal and opener focus restoration. Fields, course choices, Cancel,
close and submit are disabled while saving; Escape/backdrop closure is guarded.
The form body scrolls within the bounded dialog while its footer stays reachable.
The shared shell's optional close-disabled prop defaults to false for other callers.

### P2, fixed: Form email validation conflicted with the API's normalization

The original form checked `email.endsWith('@dnsc.edu.ph')` before trimming or
lowercasing. A valid pasted address such as ` FACULTY.DESKTOP@DNSC.EDU.PH ` was
rejected in the browser without an API request. The API already normalized it.

Resolution: the same trimmed, lowercase email is used for validation and
submission. Institutional-domain and duplicate checks remain authoritative on
the server. Desktop and phone tests now save the uppercase/spaced input and
verify that the request contains its canonical email.

## Expected versus observed

| Case | Expected | Actual |
| --- | --- | --- |
| Admin adds instructor | Approved, active instructor with reviewed ID/department/course | Passed through real UI/API |
| Student/instructor/disabled admin calls creation | Denied without writes | Passed with signed JWTs |
| Welcome notification | Durable account notice queued; no delivery claim | Passed: `email_queued=true`, `email_sent=false`, notice remains queued |
| No delivered welcome email | Instructor can sign in using verified DNSC Google identity | Passed at real login endpoint with synthetic provider identity |
| Password | No default or usable local instructor password | Passed |
| Loading / repeated activation | One pending create; save and cancel guarded | Passed in browser |
| Existing email or occupied student/instructor ID | Conflict without extra account/email | Passed for sequential requests |
| Two overlapping creates for same identity | One create and one clean conflict | Fixed: 201/409; one account and welcome notice for email or ID races |
| Blank/malformed/oversized fields | Reject before creating account or notice | Passed for tested text/type/length/domain cases |
| Lost committed response | Explicit uncertainty; repeat cannot duplicate account | Passed; retry returns existing-email conflict; refresh reveals saved instructor |
| Queue persistence failure | Keep account, report email unavailable, allow Google sign-in | Passed through UI and API |
| No remaining Brevo credits | Welcome stays pending; sign-in independent | Passed with mocked zero-credit allowance |
| Newly signed-in instructor | No foreign batches; can create own batch; no admin API access | Passed on desktop and phone |
| Pending account approval | Repeat approval does not enqueue again; archived account needs restore | Passed in existing account-recovery suite |
| Case/space-normalized email | UI and API accept the same valid address | Fixed and verified on desktop/phone |
| Keyboard modal interaction | Dialog semantics, associated labels, focus containment and Escape | Fixed and verified, including pending-save guards and focus return |

## Verification

Current follow-up verification:

- **72 PostgreSQL tests passed**, no skips or expected failures, including both
  independent-connection uniqueness races, partial-account rollback, unrelated
  integrity errors, queue failures, Google sign-in and existing admin/outbox checks.
  Evidence: `work/instructor-onboarding-fix-postgres.log` and
  `work/email-outbox-postgres-sn_bdzd5/tests.txt`.
- **213 frontend tests passed**, plus lint and production build. Evidence:
  `work/instructor-onboarding-fix-{unit,lint,build}.log`.
- All **six real-API browser scenario groups passed**, with zero page errors and
  no outstanding findings in the updated script. Desktop 1366×950 and phone
  390×640 cover light/dark layout, linked labels/errors, initial focus, tab loop,
  Escape/focus return, uppercase email normalization, pending controls, save/reload,
  lost-response recovery, queue failure, Google-boundary sign-in and scoped batches.
  Evidence: `work/instructor-onboarding-fix-browser.log` and the updated synthetic
  screenshots/`checks.json` under `tests/artifacts/instructor-onboarding/`.

Original audit evidence, retained separately; do not add these overlapping counts
to the follow-up. The separate enrollment-email error-order mismatch was outside
these three fixes and was subsequently corrected in the
[28 October integration review](BRANCH_REVIEW_2026_10_28.md): staff/batch access
is now checked before action validation, with authorization rechecked under lock
before writes.

- Focused PostgreSQL run: **69 tests**, **68 passed**, **one expected failure**
  for the confirmed duplicate-creation race, **no skips**. It covers the new
  instructor journey, authentication, admin account recovery/management,
  outbox behavior and email-schema rollout. Evidence:
  `work/instructor-onboarding-focused-postgres.log` and
  `work/email-outbox-postgres-guw37ydz/tests.txt`.
- A separate repeat of the race diagnostic confirmed an unhandled
  `IntegrityError` alongside the 201/500 response pair:
  `work/instructor-onboarding-race-postgres.log` and
  `work/email-outbox-postgres-2u4nqstp/tests.txt`. This overlaps the known expected
  failure above and is not an additional successful regression.
- Initial broader PostgreSQL run: **89 tests**, **88 passed**, **one failure**
  in an existing access-scan expectation unrelated to instructor creation.
  The scan picked POST for enrollment-email actions and expected 401/403 for an
  empty student request, but payload validation returns 400 before staff access
  is checked. The valid action path still calls `staff_batch` before writes.
  The result is recorded in `work/instructor-onboarding-postgres.log` and
  `work/email-outbox-postgres-yk1mu_lr/tests.txt`. These runs overlap; do not add
  their counts. This failure was not hidden by modifying the existing security test.
- A separate isolated role-order check verifies a valid-shaped student send
  request is rejected with 403 and creates no notices. Evidence:
  `work/instructor-email-access-check.log`. This distinguishes the error-order
  mismatch from an authorization bypass.
- [Browser script](../skillbridge-frontend/tests/instructor_onboarding_playwright.py):
  six scenario groups passed with zero page errors, while explicitly recording
  the UI findings that were unresolved at that time. Admin desktop at 1366×950 and phone at
  390×640 cover validation, loading, duplicate responses, creation, roster refresh,
  notification truthfulness, lost-response retry, queue failure, instructor login,
  dashboard and own-batch access. Evidence:
  `work/instructor-onboarding-browser.log` and
  `skillbridge-frontend/tests/artifacts/instructor-onboarding/checks.json`.
- [Synthetic server](../skillbridge-frontend/tests/instructor_onboarding_server.py)
  disables normal dotenv loading, uses a process-specific SQLite file and a blank
  Brevo key, and does not run a worker. Only its Google userinfo boundary and one
  deliberate queue-failure identity are replaced. Other application API behavior
  remains real. Logs/screenshots contain synthetic data only.
- Django system checks and Python compilation passed in the original audit.
  That review changed only tests/documentation; the current implementation's
  frontend verification is recorded separately above.

To reproduce PostgreSQL checks, pass the relevant Django labels to
`skillbridge-frontend/tests/run_email_outbox_postgres.py` from the repository root.
For the browser, use the testing skill's `with_server.py` from the frontend with
Vite on **5187**, `tests/instructor_onboarding_server.py` on **8027**, then
`tests/instructor_onboarding_playwright.py`. Verify and stop any remaining
helper-owned child listeners on Windows. These are separate from normal app ports.

## Retained behavior and limits

Approved accounts remain saved even when optional welcome-email storage fails.
Google-only authentication and instructor/admin access boundaries are preserved.
Account notices currently use the shared durable
outbox; the enrollment-email roster is not an instructor-welcome history/resend
screen. This audit does not add such a feature.

Actual hosted Google popup/origin configuration, real inbox delivery, Brevo
allowance/reset times and deployed worker availability remain unverified.
This is not a load benchmark. No live account was created or messaged.

See [authentication](AUTHENTICATION_AND_RECOVERY.md),
[account management](ADMIN_MANAGEMENT_IMPLEMENTATION.md), and
[email delivery](ENROLLMENT_EMAIL_DELIVERY.md).
