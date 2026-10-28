# 28 October 2026 integration review

Reviewed the combined `UI-polish` working tree starting at `534f5ce`, which was
also local `main`. The requested integration is a local commit and merge; remote
push, hosting changes and live database migrations are separate.

## Reviewed scope

- User-facing **OJT Partners** wording across roles, maps and report headings,
  preserving existing Company models, IDs, API keys/routes and ranking behavior.
- Durable enrollment/account email outbox, migration **0027**, worker command,
  provider events, saved failures/allowance waiting, reviewed bulk/per-student
  actions, fixed-recipient progress and completion notifications.
- Enrollment response-loss recovery, instructor/admin access checks, email
  profile photos and history dialogs, and clearer required-location setup.
- Admin-created instructor uniqueness conflicts, account insertion rollback,
  normalized email and shared accessible form/dialog behavior.
- The completed instructor/admin assessment collection redesign from the shared
  workspace: shared cards/list, four-record pages, filters, categories, counts,
  skeletons and responsive/dark presentation. Its source, documentation and browser
  checks were included in this integration review, not omitted as unrelated work.

See [partner terminology](PARTNER_TERMINOLOGY.md),
[email delivery](ENROLLMENT_EMAIL_DELIVERY.md),
[enrollment journey](ENROLLMENT_TO_ASSESSMENT_AUDIT.md),
[instructor onboarding](INSTRUCTOR_ONBOARDING_AUDIT.md),
[assessment library](ASSESSMENT_LIBRARY_UI.md), and
[admin assessment oversight](ADMIN_ASSESSMENT_OVERSIGHT.md).

## Integration findings addressed

1. The existing broad access scan could receive a validation error for a malformed
   student's email action because action parsing preceded staff authorization.
   Email controls now check staff role and batch ownership before action parsing,
   while retaining the locked access recheck before writes. Regression cases cover
   malformed student and foreign-instructor POSTs, with no notices created.
2. The original full API run passed 503 of 504 checks. The one failing retake
   migration assertion migrated from 0024 through *all current migrations*, then
   blamed migration 0027's five email tables on the field-only retake migrations.
   The test now explicitly targets 0026, uses the historical models at that target
   and restores the latest migration graph in teardown. The unchanged-table and
   score/history preservation assertions remain intact. No application migration
   was altered to make the test pass.

## Verification

**All 504 tests in the complete Django API suite passed on fresh disposable
PostgreSQL, with zero skips or expected failures.** The corrected migration
regression and malformed-action access checks are included. Final evidence:
`work/merge-review-postgres-final.log` and
`work/email-outbox-postgres-u3yamohq/tests.txt`. The initial 503/504 run is retained
in `work/email-outbox-postgres-h5m5mv4s/tests.txt` and
`work/merge-review-postgres.log`.

- **213 frontend tests passed**, no skips: `work/merge-review-unit.log`.
- Frontend **lint and production build passed**:
  `work/merge-review-{lint,build}.log`.
- **Django system check passed** and migration dry-run reported **No changes
  detected**, using test settings with normal dotenv disabled:
  `work/merge-review-{django-check,migrations}.log`.
- Final instructor-assessment, admin-assessment and enrollment-email browser
  suites passed: `work/merge-review-browser.log` and
  `work/merge-browser-{instructor_assessments,admin_assessments,enrollment_emails}_playwright.log`.
  These checks use intercepted synthetic APIs and cover the combined UI, dialog,
  selection/filter/page behavior and responsive/dark states.
- The preceding real-API enrollment-to-assessment and instructor-onboarding
  journeys passed on desktop and phone; they are documented in their linked
  audits, including submission recovery, exact scores, queue failure, sign-in and
  role boundaries. They do not represent production provider verification.
- Credential/artifact scan found **no private keys, embedded credentials/JWTs,
  credential-bearing database URLs or local databases/binaries** in the reviewed
  source/document/test set. New Markdown links and Git whitespace checks passed.
  Runtime files, populated `.env`, test databases, logs, screenshots and synthetic
  browser tokens stay ignored. The safe `.env.example` is included.

All backend checks use fresh disposable localhost PostgreSQL with mocked
providers. The test helper stops the cluster and destroys its test database;
normal application credentials are disabled. Browser helper-owned listeners are
verified and stopped separately. No real messages or live data were changed.

## Local integration and deployment limits

The verified source tree is intended to be committed on `UI-polish` and merged
into local `main` without discarding either branch. Remote push/deployment is not
part of this integration. A clean working tree and matching source/merge tree
are checked after the merge.

Before hosted use, ensure migration **0027** is applied, the dedicated email
worker is running, and the verified Brevo sender/API configuration is present.
Delivery events require reachable authenticated webhook setup; local provider
acceptance/submission is not proof of inbox delivery. Hosting, Google OAuth
origins, production latency/quotas and real mailboxes remain outside these tests.
The company-to-partner change does not rename database tables or alter ranking.
