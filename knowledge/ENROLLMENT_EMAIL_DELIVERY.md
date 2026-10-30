# Durable enrollment email delivery

Implemented locally 28 October 2026. Hosted rollout and real mailbox verification
remain separate. No real messages, production migrations or new hosting services
were triggered during implementation.

## Staff behavior

Enrollment review offers **Send now** (default) or **Send later**. Both preserve the
reviewed identity and enrollment workflow. Send now saves a queued notice; Send
later saves a held notice that will not automatically release overnight. A job is
saved in the enrollment transaction, and the web request never waits on Brevo.
If saving a notification fails, enrollment can still complete with the explicit
`dispatch_failed` result; staff can review that enrollment's email history later.

Both staff roles have **Enrollment emails** on their batch roster. It includes
name/ID/address search, status filters, full filtered selection, ten-row pages,
per-student send/resend controls, bulk send/retry/hold/cancel and recent history.
The email launcher sits in the batch header's action group beside New assessment
and Enroll students. A keyboard-accessible Batch actions menu holds instructor
archiving and administrator manage/archive/reactivate actions.

The content-height email dialog opens on All statuses. A compact batch-wide
summary offers All, Not scheduled, Pending, Delivered and Needs attention, plus
History unavailable when applicable. Pending excludes held/Not scheduled notices;
searching does not change the batch-wide totals. Send selected is the primary
action, with retry/resend/hold/cancel under More actions. Desktop table rows become
stacked records on narrower screens. Student avatars use the existing profile
photo, with initials when missing or unavailable. **View history** is an outlined
button that opens the shared dialog with the current status, recipient address,
failure explanation, attempt history and authorized per-student actions. Closing
history restores focus to its row button; cancelling a nested send/resend review
returns to the history action. Successful confirmation closes both child dialogs.
Service timing and longer guidance are disclosures; quota/availability notices remain
visible. Empty-filter, empty-batch and failed-load states remain distinct. The
dialog scrolls its body as needed and keeps its footer reachable without reserving
an empty fixed-height area. Existing student-detail dialog sizing is unchanged.

Bulk review freezes recipients and a server-signed roster version. Changes to
recipients or delivery status require refreshed review. Unconfirmed requests keep
the same command UUID for an explicit retry, preventing repeat effects after a
lost response. The server rechecks role/batch access and current enrollment.
The final integration check also verifies staff/batch authorization before parsing
email-action fields, so malformed student or foreign-instructor requests receive
an access denial rather than a validation response. Locked authorization still
runs again before mutations.

## Enrollment-group progress and completion

The batch page and email dialog show saved progress for one enrollment/send group,
for example **2 of 50 emails submitted**. A group keeps its original notice IDs
and denominator when the roster is filtered, recipients are removed, later students
are enrolled, or another resend is requested. The dialog can select among the five
most recent groups per batch. Missing notification records count as requiring
attention; the interface never invents successful delivery or historical groups.

Progress metadata and enrollment result receipts reuse `EmailCommand.result`;
no additional table, column or migration is needed beyond 0027. The lightweight
authorized `GET /api/instructor/batches/{id}/email-progress/` endpoint projects only
sanitized group totals. It does not return receipt identity rows, message bodies,
recipient addresses or internal notice IDs. Saved results and worker/provider
changes use the existing batch/email invalidations and visible-page refresh.

The main interface says Submitted and Delivery pending instead of provider names.
Submission counts mean provider acceptance; delivery requires confirmed delivery
evidence. The progress bar is determinate. Held notices remain Not scheduled;
quota waits and a missing/unhealthy sender are explicit states, without an endless
spinner or a promised reset time. Failures, uncertain acceptance, suppression and
cancellation prevent an all-success completion state even when some submissions
were previously accepted. The denominator does not shrink to hide those outcomes.

For active authorized batches, the bell includes completed groups created in the
last seven days (within the five-group window). **All enrollment emails submitted**
is separate from **Enrollment emails delivered**. A toast announces a completion
transition observed while the header subscription is mounted; existing completed
groups appear in the bell without replaying historical toasts on every navigation.
The existing per-account browser read state prevents unchanged reminders becoming
unread repeatedly. These are recent reminders, not a permanent server inbox.

### Delivered confirmation dismissal — 30 October 2026

The compact progress card on instructor Students and admin batch details can be
dismissed only after its current group reaches confirmed **Delivered**. It hides
after ten uninterrupted seconds while the page is visible and the card is not
being hovered, focused or reviewed in the Enrollment emails dialog. Interaction
or a hidden tab cancels that timer; a fresh ten-second window starts afterward.
Polling the same group does not restart the timer. A keyboard-accessible 44px
close control also dismisses the delivered confirmation immediately.

Dismissals survive navigation/reload in the same browser when local storage is
available. Only the latest 100 opaque group IDs are stored, separately by staff
account and role; no recipient details are stored. New groups show independently.
Sending, submitted-but-awaiting-delivery, held, quota, failed, uncertain and stale
refresh states stay visible and have no dismissal control. A later problem for a
previously dismissed group is shown again. The compact card observes the existing
query store's error state so a transient background failure cannot hide behind a
cached success. No extra request, email send, backend change or migration is added.

Viewing progress opens the existing dialog without dismissing it; the timer stays
paused while that dialog is open so focus can return to its opener. Full group
progress/history inside Enrollment emails remains visible, regardless of compact
card dismissal. Header-bell read state and completion toasts remain separate.

Verification: frontend lint/build and all 299 Node tests passed. The synthetic
email browser suite passed four dismissal groups and four existing workflow
groups on instructor desktop/tablet and admin phone/desktop pages, with light/dark
layout checks. These cover timeout, manual/keyboard dismissal, reload persistence,
new groups, submitted/pending/error retention, interaction/dialog pauses, focus
return and unchanged history/send/recovery controls. Storage tests cover account
isolation, bounded records, malformed data and unavailable browser storage. The
older workflow fixture's instructor archive-menu label now matches the current
closeout workflow. All API/provider requests were intercepted; no real emails,
database writes, migrations or hosted deployments were performed. Logs are in
`work/dashboard-ui/email-dismiss-{node-tests,browser,regression,build}.log`.

### Enrollment confirmation and email controls

Enrollment confirmation now sends a frozen request UUID, reviewed rows and email
timing. A same-actor/same-payload replay returns the original saved result before
checking review expiry; batch authorization/activity is still checked first.
Changing the payload or actor with that ID returns 409. If a response is lost,
**Check enrollment result** explicitly retries that saved request; identity edits,
method changes and email timing are locked until recovery. There is no automatic
mutation replay. Known validation errors require a fresh review. Confirmation shows
Enrolling while saving and Validating while refreshing review. Database saving
remains separate from provider submission and delivery.

The audit also added approved/active staff checks at enrollment preview/confirmation,
response-envelope/count checks before showing enrollment success, and refreshed
staff authorization when retrying an eligible failed email. No real messages,
configured-database writes or hosted services were triggered by this review.

New controls:

- **Send selected** sends explicitly reviewed legacy notices or releases held
  notices. **Send all not scheduled** releases up to 1,000 held notices per action.
  Neither automatically resubmits already queued or Brevo-accepted messages.
- **Retry eligible failures** applies to known connection, configuration and
  request-rate failures. It does not blindly retry an uncertain submission.
- **Send again** requires a reason, recipient confirmation and a 15-minute cooldown
  since the last request update. It creates a separate notice and preserves the
  original history. Suppressed recipients remain blocked.
- **Hold** and **Cancel** apply to unsent jobs. They cannot retract an email already
  submitted to Brevo. Archived batches remain read-only.

History displays the five most recent requests and up to five attempts per request;
older database records remain preserved. Existing enrollments have **History
unavailable**, not a fabricated Not sent/Failed status. Migration does not enqueue
or resend messages to existing students.

Enrollment, provider acceptance, delivery and student activity are separate facts.
Email failure does not remove enrollment or change Google sign-in requirements.
The application does not require the student to accept an invitation link or track
email opens to decide whether to resend.

## Allowance and failure recovery

All outgoing account/enrollment jobs use one shared provider credit snapshot and
database sending lease. Account notices have priority when credits are available.
`BREVO_ACCOUNT_EMAIL_RESERVE` optionally holds a credit reserve for account notices;
the default 0 allows enrollment messages to use all available credits.

The worker reads Brevo account `plan`/`sendLimit` credit information. Unknown or
unavailable allowance fails closed, leaving jobs saved. Cached credits are
reserved under the shared lease, not independently per web process. Outside use
of the same account may change actual allowance between checks; provider acceptance
and events remain authoritative.

With exhausted allowance, queued notices remain pending and resume automatically
after provider checks report usable credits. Instructors/admins see the scoped
pending/problem groups in their existing notification bell, with links directly
to the affected batch's email panel. Repeated unchanged quota checks do not create
new unread versions. Each affected row shows the reason and next attempt/check.
The service warning is shown only when the full authorized batch roster has
eligible unsent jobs (Queued, Retry scheduled, Waiting for allowance or Sending)
and sending needs attention. Search/status filters do not change that decision.
Empty, history-only, held, submitted, delivered or failed-only views do not imply
that sending is blocked. Instructors see **Emails are waiting. Automatic sending
needs administrator attention.** when a sender has not checked in within ten
minutes. A collapsed Service details disclosure is admin-only; the backend sends
its worker/provider check timestamps only to admins, and only when unsent work
exists. Stale global service reasons are suppressed for a batch with no such work.

No reset timezone or guaranteed delivery time is invented. Active allowance is
cached for 60 seconds; unavailable/exhausted allowance is normally checked after
five minutes. All displayed dates use Asia/Manila. Automatic resumption requires
the configured worker to remain available.

Brevo-accepted/deferred messages stay with Brevo, rather than being submitted again
when allowance changes. Authenticated delivery events can establish **Delivered**.
Read timeouts, ambiguous server errors and expired in-flight leases become
**Delivery uncertain**, with no blind automatic resend. Connection timeouts and
explicit request-rate failures have bounded backoff, with at most five automatic
attempts. HTTP Retry-After is respected, bounded to seven days. Invalid API keys
or sender configuration pause the service rather than creating a per-student
request storm. Permanent bounce/block/spam/unsubscribe suppression cannot be
bypassed by cancelling a notice or requesting a resend.

An optional bounded reconciliation path in the worker checks tagged provider
events: at most one lookup per minute globally, for requests at least two minutes
old and no more than seven days old; a checked notice waits fifteen minutes before
another lookup. It reads at most 100 events and never sends another message.
Verified webhooks remain the primary timely delivery source. Missing provider
evidence remains unconfirmed, never fabricated as Delivered.

The worker validates the current account, DNSC address, enrollment, batch and
requesting staff assignment immediately before dispatch. Account/archive/address
or ownership changes cancel stale unsent notices. A change after HTTP submission
cannot retract a message already in transit. Recipient addresses/content and raw
provider error bodies are not placed in ordinary logs or staff notification cards.

## Schema and routes

Additive migration **0027** creates `EmailNotice`, `EmailAttempt`,
`EmailProviderEvent`, `EmailDispatchControl` and `EmailCommand`. Email bodies and
recipient snapshots remain backend-only; the staff API returns authorized roster
addresses and sanitized status/history. Existing identity, assessment, ranking and
placement schemas/behavior are preserved.

During rollout, staff analytics checks that all five email tables exist before
reading optional email reminder groups. Before migration 0027, analytics still
returns its normal reports with `email_storage_ready: false` and an empty
`email_notifications` list. This flag describes schema availability only, not
provider configuration or worker health. Database connection errors and unrelated
query failures are not hidden. The readiness check is not cached, so applying the
migration enables those reads without restarting the process.

Authorized enrollment-email GET/POST requests return HTTP 503 with
`code: email_setup_required` while tables are missing. Staff role/batch access
checks still apply first. The worker exits with an explicit migration instruction
instead of starting against missing tables. To enable email storage in the intended
environment, run `python manage.py migrate` from `skillbridge-backend/` with its
Python environment activated. The compatibility guard does not apply migrations
or enqueue existing enrollments.

- `GET /api/instructor/batches/{id}/emails/`: read-only roster/status and signed review.
- `POST` to the same route: scoped, idempotent reviewed send/retry/resend/hold/cancel.
- `POST /api/email/brevo-events/`: bounded, authenticated transactional events.
  This endpoint uses its own configured secret, not user JWT authentication.

Worker/event changes publish recipient-scoped `email` invalidations only to admins
and the current batch instructor. Existing account/batch topics also refresh open
email panels. Analytics includes sanitized batch-level email reminder groups for
the staff bell; student-role requests remain denied. GET/status refresh never sends.

## Hosted rollout — not executed here

1. Apply migration 0027 through the existing controlled deployment process before
   starting the new web/worker code. There is no legacy email backfill.
2. Set backend-only `BREVO_API_KEY` and a verified `BREVO_SENDER_EMAIL`.
   Generate a strong random `BREVO_WEBHOOK_SECRET` through secrets management;
   do not put credentials in Vite variables, documentation or shell history.
3. Run a dedicated process with the same database and backend environment:
   `python manage.py process_email_outbox`. The Procfile includes a worker entry;
   Railway still needs an explicitly provisioned service/start command. Web
   processes do not start background threads. Check hosting cost/availability
   before enabling that service.
4. A bounded scheduled alternative is
   `python manage.py process_email_outbox --once --limit 100` at an appropriately
   frequent interval. Do not run the command against a real queue merely as a
   diagnostic: it can send every eligible due job. Stop the process to pause
   delivery; saved jobs survive. In-flight leases become uncertain after 90 seconds.
5. Configure Brevo's transactional webhook to the HTTPS `/api/email/brevo-events/`
   URL with **bearer authentication** matching `BREVO_WEBHOOK_SECRET` (a configured
   `X-SkillBridge-Webhook` header is also supported). Subscribe to request/sent,
   delivered, deferred, hard/soft bounce, blocked, invalid, error, spam and
   unsubscribed events. Use single-event payloads; the endpoint rejects arbitrary
   arrays, oversized payloads, bad timestamps and unknown event types.
6. Deploy frontend controls and confirm the worker heartbeat, scoped access and
   saved queue status. Only an owner-approved controlled real-recipient send can
   verify sender configuration, actual account allowance and inbox/event delivery.

The durable worker intentionally uses Brevo HTTPS. The old synchronous delivery
helper remains only for existing isolated diagnostics/tests; enabling the legacy
SMTP fallback setting does not start or bypass the durable worker. Do not invoke
both paths for the same invitation.

## Verification

Synthetic tests cover real 50-student enrollment without provider IO, a
100-recipient 20-credit/80-pending/reset scenario, 1,000 saved jobs, restart and
timeout uncertainty, bounded retries, sender faults, provider events, scoped
permissions, legacy history, suppression, command deduplication, optional reserve
and bounded bulk-send query counts. PostgreSQL tests additionally exercise two
workers/one credit, concurrent duplicate commands and hold during an allowance
lookup. UI checks cover both staff roles, full filtered selection/paging, reviewed
resends, response loss, bell deep links, Send later, focus, mobile and dark mode.
Schema-rollout regression tests migrate a disposable database back to 0026,
exercise admin/instructor analytics and scoped email controls, then apply 0027 and
confirm reads recover without a restart or sending/backfilling any messages.

Completed checks:

- Full frontend unit suite: **213 passed**.
- Frontend ESLint and production Vite build: passed.
- Django system check: no issues; migration dry run: no unrecorded model changes.
- `tests/run_email_outbox_postgres.py`: **125 tests passed, no skips** on a new
  disposable localhost PostgreSQL cluster. This includes the final bulk mutation
  implementation and bounded-query regression, alongside enrollment, access,
  account recovery, analytics, provider, schema rollout and real concurrency/commit tests.
- A separate targeted PostgreSQL test verified two concurrent initial enrollment
  submissions return one receipt and save one email job. Seven SQLite progress
  regressions also passed; see the [workflow review](ENROLLMENT_WORKFLOW_REVIEW.md).
- `tests/enrollment_emails_playwright.py`: instructor at 1366px/768px and admin at
  1366px/375px (812px-tall phone viewport),
  including quota notice/bell navigation, all-filtered selection across pages,
  reset/clamp behavior, uncertain-response command reuse, intentional resend reason,
  Send later request/result, compact empty filtering, dark layout, geometry and
  focus return. The redesign checks also cover More actions/Escape/focus restoration,
  reviewed hold actions, history dialogs, batch action menus, archived read-only
  state, page clamping after refresh, missing worker details, empty batches and
  failed-load Retry without showing a false empty collection.
  The progress follow-up also verified fixed denominators through filtering,
  submission completion toast/bell links and frozen enrollment request recovery
  after an intentionally lost committed response.
- `tests/enrollment_workflow_playwright.py`: real-API IAMS review/enrollment, held
  notice persistence and release, disabled Enrolling state, plus admin recovery
  after an intentionally lost committed response; disposable SQLite only, blank
  provider key, no running worker. See `work/enrollment-flow-review.log`.
- `tests/admin_batches_playwright.py`: eight workflow groups passed, including
  manage/archive/reactivate from Batch actions, failed archive recovery and twelve
  light/dark desktop/tablet/mobile/short layouts. The existing backend-connected
  `admin_management_playwright.py` selectors were updated for the menu; that suite
  was not rerun for this frontend-only redesign.
- `tests/batch_recovery_playwright.py`: both instructor create/recovery and
  archive/unarchive recovery groups passed against the production frontend preview.
  The test scopes inline error assertions separately from notification toasts.
- Targeted SQLite schema-rollout and analytics suite: **15 tests passed**. The
  PostgreSQL suite also covers the final provider parser, including ignoring
  open/click tracking and malformed entries without hiding a valid delivery event.
- Documentation links and `git diff --check`: passed.

PostgreSQL evidence is under `work/email-outbox-postgres-ptgpr5h1/tests.txt` and
`work/email-outbox-postgres-3r90_mt7/tests.txt`;
original frontend logs are `work/email-outbox-{frontend-tests,lint,build}.log`;
redesign verification is recorded in `work/email-redesign-{unit,lint,build,browser}.log`
and `work/email-redesign-batch-regression.log`; the separate final instructor
recovery check is `work/email-redesign-instructor-recovery.log`.
Progress/follow-up logs are `work/email-progress-{unit,lint,build,browser}.log`.
Synthetic screenshots are under `skillbridge-frontend/tests/artifacts/enrollment-emails/`.

### Profile-photo and history-dialog follow-up

The email roster now returns the existing `User.photo_url` through its scoped GET;
there is no new table, column, migration or separate photo query. The shared Avatar
handles absent and failed images. The history dialog reuses the current row as
live data updates and preserves existing sending permissions and reviewed actions.

Verification for this follow-up: 213 frontend tests, lint and production build
passed. The isolated SQLite email suite ran 41 tests: 37 passed and four
PostgreSQL-only concurrency tests were skipped. Browser checks passed for instructor
at 1366px/768px and admin at 1366px/375px, including photos, absent/broken fallbacks,
history with/without saved records, Tab/Shift+Tab/Escape, nested resend cancellation
and confirmation, focus return, dark mode and responsive geometry. No real email
was sent. Logs: `work/email-history-{unit,lint,build,backend,browser}.log`.
These ignored local artifacts contain only synthetic verification data. Tests use
disposable databases and mocked providers; they do not prove hosted service
configuration, actual remaining Brevo credits or real inbox delivery.

Sources: [original plan](ENROLLMENT_EMAIL_DELIVERY_PLAN.md),
[Brevo account credits](https://developers.brevo.com/reference/get-account),
[provider idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails),
[event history](https://developers.brevo.com/reference/get-email-event-report),
[webhook authentication](https://developers.brevo.com/docs/secured-webhooks).
