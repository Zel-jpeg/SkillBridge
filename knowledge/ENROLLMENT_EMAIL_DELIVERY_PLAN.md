# Enrollment email delivery and recovery plan

Status: the original proposal below has now been implemented locally; see
[current behavior, verification and hosted setup](ENROLLMENT_EMAIL_DELIVERY.md).
The original planning document alone did not authorize real email sending.
Prepared 28 October 2026 from current code and official
Brevo documentation. The user selected automatic resumption after daily allowance
reset, with an explicit pending/limit notice for instructors and administrators.

## Required outcome

Staff can enroll 50–100 students, send immediately or later, see what happened to
each invitation and send another notice when appropriate. A delivery failure or
daily allowance limit never reverses enrollment or prevents an otherwise eligible
student from signing in with their DNSC Google account. Email delivery is not a
student acceptance requirement.

When the daily allowance is reached, show:

> Daily email allowance reached. These students are enrolled. Their emails are
> pending and will resume automatically when the allowance resets.

Show the affected count and next expected attempt in Asia/Manila time when known.
If reset timing cannot be confirmed, say that the next attempt time is unavailable
rather than inventing a midnight deadline. Automatic resumption requires a running
worker and a confirmed usable provider allowance; do not promise an exact arrival.

## Current behavior and gaps

`confirm_rows` registers email callbacks for newly created enrollments after the
enrollment transaction commits. Preview sends nothing. Existing enrollment rows
are skipped without an email. Basic configuration/queue-start failures produce
`dispatch_failed`; network/provider failures return false from delivery and are
logged. Enrollment remains committed.

The current queue is process memory only, with 1,000 waiting slots and one daemon
worker per web process. There is no saved notification history, provider message
ID, webhook, retry schedule, quota coordination or send/resend UI. A successful
queue admission remains `queued` in the response even if the later delivery fails.
Process restart can lose remaining jobs. Adding a resend button alone would not
resolve these gaps. See the [audit](../outputs/terminology-review/BREVO_ENROLLMENT_AUDIT.md).

## Keep three facts separate

1. Enrollment: enrolled, unenrolled or archived according to existing rules.
2. Email: its actual dispatch/delivery state.
3. Student activity: successful SkillBridge sign-in/profile/assessment activity,
   only where existing application records provide evidence.

Provider acceptance is not delivery. Delivery is not proof of reading or sign-in.
Do not treat missing open tracking as failure or automatically resend unread mail.
Do not introduce a new Accept enrollment link or change Google authentication.

## Staff experience

### Enrollment and later sending

- Preserve reviewed IAMS identities, address verification and confirmation.
- Add **Send enrollment emails now** (default, preserving current intent) and
  **Send later**. Both save successful enrollments. Send later creates held notices,
  not jobs that silently auto-release overnight.
- Results report enrollment counts separately from email counts, for example:
  **100 enrolled · 80 emails queued · 20 waiting for daily allowance**.
  Queued counts must describe local jobs, not claim provider acceptance/delivery.
- Add an **Enrollment emails** action to the instructor batch roster and an
  equivalent batch-scoped administrator view. Reuse the shared UI and Axios client.

### Delivery collection

Show Student, verified DNSC address, Email status, Last attempt, Next attempt when
known and Actions. Show the latest invitation state and expandable history for
older requests/attempts; a resend must not erase a previous successful delivery.

Support search by name/ID/address and filters such as Needs attention, Pending,
Waiting for allowance, Delivered and All. Use the existing pagination, full
filtered count, page-reset/clamping and accessible keyboard/confirmation patterns.
Keep the default view focused on pending/attention items. Do not hide enrollment
status or turn absent historical delivery evidence into a failure.

| Email state | Meaning | Staff action |
| --- | --- | --- |
| Not scheduled | Enrolled with Send later | Send selected / Send pending |
| Queued or Sending | A saved job is waiting or being processed | View details; no duplicate send |
| Waiting for daily allowance | SkillBridge has not submitted this job; provider allowance is exhausted | Automatic resume after allowance is available; staff can hold/cancel |
| Accepted by Brevo / Waiting with Brevo | Provider accepted the message and may still be delivering it | View progress; do not automatically submit another copy |
| Delivered | Supported by an authenticated provider event | Optional explicit Send again after confirmation/cooldown |
| Needs attention | Rejected address, bounce, blocked recipient or provider configuration issue | Show safe reason and appropriate correction/retry guidance |
| Delivery uncertain | A timeout/crash leaves provider acceptance unknown | Reconcile first; avoid a blind duplicate |
| History unavailable | Legacy enrollment has no saved delivery record | Explicit staff-reviewed send; never automatically resend all legacy students |
| Cancelled | Enrollment/batch/account no longer eligible, or staff cancelled an unsent job | Explain reason; no background send |

Retry scheduling is a detail of pending jobs. Display a clear Next attempt/reason
instead of presenting every backend substate as a separate filter.

### Actions and selection

- **Send selected** and **Send pending** release held/eligible unsent notices.
  Pending means unsent by SkillBridge; it excludes messages already accepted by
  Brevo, those already queued/sending and permanently invalid/blocked recipients.
- **Retry eligible failures** retries only failures known to be safe to retry.
- **Send again** creates an intentional new invitation request and preserves the
  original history. Confirm recipient/count/reason, apply a cooldown and audit it.
  It does not bypass a daily allowance, blocklist or missing authorization.
- **Hold** / **Cancel pending** affect only unsent jobs. A Brevo-accepted message
  is not retractable by cancelling its local record.
- Bulk review names the batch and selection. “All filtered” must use the full
  server-authorized selection, not silently just one visible page. Selection is
  revalidated at confirmation; reject stale recipient/address versions for review.
- Instructor controls cover currently managed batches only; administrator controls
  use their existing scope. Student users cannot view this collection or send mail.
  Revalidate access, account activity, enrollment and batch activity before dispatch.

## Quota and provider-owned pending messages

The Brevo Free plan currently has 300 daily sends. Its transactional platform can
hold up to 1,000 additional emails in its own retry queue after that allowance is
reached. These are different queues and must not be conflated.

Keep messages that have not been submitted safely in SkillBridge's database. A
message already accepted by Brevo stays with Brevo for delivery tracking; do not
add another send merely because its status is deferred or no delivery event has
arrived. Brevo also retries temporary recipient-server deferrals itself.

The worker pauses new submissions on a confirmed exhausted allowance and resumes
after refreshed provider information shows usable allowance. Use one shared budget
and claim mechanism across both web processes and the worker, including instructor
account emails and other messages using the same Brevo account. Avoid competing
independent limits per instructor/process. Reserve room for essential account mail
through a configurable policy rather than hardcoding a forever-free 300 limit.

Read provider allowance when available, cache it with a checked-at time, and label
local usage estimates honestly. Other apps or manual Brevo sends can consume the
same account's allowance. A local counter alone cannot prove exact remaining credit.
Treat per-second API rate limiting separately from daily allowance exhaustion.

Before enabling production scheduling, verify the actual account plan, reset
behavior/timezone and allowance fields. Render schedules in Manila time. A small
scheduled status/credit refresh may run at a bounded interval; do not repeatedly
attempt all paused recipients to discover whether credits have returned.

## Durable delivery design

Use a Django database outbox and a bounded management-command worker. The current
application already uses PostgreSQL; a small volume does not require Redis/Celery.
This does require an additive database migration and an explicitly configured
background process. The existing Procfile starts web processes only. A future
Railway worker service or scheduled runner must be provisioned and its operational
cost/availability checked before promising automatic next-day delivery. This plan
does not authorize deployment, service provisioning or production migrations.

Proposed persistence:

- Notification request: kind, student/enrollment/batch reference, preserved scope
  IDs, actor, reviewed recipient snapshot/version, template version, held/ready
  policy, logical request UUID, related prior request for intentional resend,
  timestamps and current summary. Preserve minimal history if an enrollment is
  later removed; do not cascade-delete the delivery audit.
- Outbox job/attempt: request reference, due time, attempt count, claim lease,
  safe failure category/HTTP code, provider message ID, idempotency UUID and
  accepted/completed timestamps. Persist the bounded message payload or stable
  rendering inputs so retrying an attempt does not silently change its recipient.
- Provider event: deduplicated event identity, message ID, event type/time and
  sanitized reason. Match to a known attempt using message ID and a private request
  tag. Do not use the webhook's shared configuration ID alone as the event identity.
- Shared sending control: provider account scope, allowance pause state, confirmed
  credit snapshot/check time and coordinated budget reservations.

Create enrollment and the initial outbox intent in the same transaction. A worker
can only see it after commit; an after-commit wakeup is an optimization, not the
sole copy of the job. Preserve the current boolean enqueue wrapper contract for
other email callers while moving them to the same durable dispatcher and quota.

Claim due jobs with short database locks/leases and skip locked rows; commit the
claim before the remote HTTP request. Do not hold row locks during network waits.
Handle stale leases after process failure. If submission might have succeeded,
move to reconciliation rather than treating every expired lease as a fresh send.

Repeated clicks, concurrent admin/instructor actions and repeated HTTP requests
must resolve to one logical request through idempotency and database uniqueness.
Use provider idempotency for retrying the same unchanged payload within its
supported, tested lifetime. Brevo's current guide states 30 minutes; its older
2021 changelog states 15. Confirm current behavior and use a conservative replay
window. A duplicate-key response means no new request was processed; reconcile
the original attempt, rather than fabricating a successful new message ID.
Once that window has elapsed, do not promise exactly-once delivery across an
uncertain network outcome. An intentional Send again uses a new logical request.

## Failure handling and event tracking

| Condition | Planned behavior |
| --- | --- |
| Known temporary failure before acceptance | Bounded backoff/retry; visible next attempt; preserve enrollment |
| HTTP 429 | Respect supported retry/rate-reset guidance; coordinate a provider pause; distinguish short rate limit from daily credit exhaustion |
| Daily allowance exhausted | Persist local pending jobs; notify scoped staff; automatically reconsider after reset/credit refresh |
| Missing/invalid API key or sender | Pause dispatch; show administrators a configuration issue; no per-student retry storm |
| Invalid address, permanent bounce or blocklist | Stop automatic sends; require appropriate address/support review; do not automatically unblock contacts |
| Brevo accepted but delivery deferred | Let Brevo continue its delivery attempts; update waiting state; do not submit another copy |
| Read timeout, lost acknowledgement or ambiguous crash | Use stable idempotency/reconciliation; mark uncertain when acceptance cannot be established |
| Repeated failures | Stop after a bounded policy, expose Needs attention and preserve attempts; never retry forever |
| Unenrollment, archived account/batch or changed address | Cancel/hold unsent stale jobs before HTTP submission; require new reviewed intent for a new address |

Introduce an authenticated HTTPS Brevo event endpoint, using a supported secret
header/authentication mechanism. Do not assume the provider signs events unless
the configured mechanism actually does. Bound input sizes and validate shape,
message correlation and event types. Deduplicate repeated events, tolerate events
arriving before the local acceptance save, and retain out-of-order history without
regressing status from a later delivery to an earlier queued/deferred event.
Unmatched events must not update another student merely by matching an address.

Store server timestamps in UTC and display Manila time. Keep addresses and content
out of ordinary logs; store only the necessary protected records. Never expose API
keys, raw provider errors or other students' addresses to students. Staff see only
authorized roster recipients; admin-only configuration details remain separate.

Provider acceptance can be shown immediately from a valid response/message ID.
Only authenticated delivery events establish Delivered. If webhook setup is not
active yet, show Accepted by Brevo / Delivery unconfirmed rather than a fake success.
Use bounded provider-log reconciliation for uncertain/stale accepted attempts;
respect API limits and do not poll the full roster repeatedly.

Use existing live-query invalidation after committed job/event changes, with
recipient/role scope. Do not let status GETs enqueue, retry or send messages.

## Implementation sequence and acceptance

1. Add schema, immutable request identity, durable enqueue compatibility, safe
   legacy History unavailable handling and an inactive-by-default worker command.
2. Add provider response/message-ID handling, shared allowance/rate pause, bounded
   retries, restart/lease recovery, idempotency and reconciliation. Test before
   switching existing callers away from the in-memory queue; never run both
   dispatch paths for the same request.
3. Add authenticated event handling and true delivery/failure state updates.
4. Add enrollment Send now/later and shared roster delivery controls, safe bulk
   review, filters/pagination and current status notifications.
5. Verify entirely with synthetic recipients, fake HTTP, time controls and a
   dedicated test PostgreSQL database. Cover 50/100/1,000 recipients; allowance
   boundaries (e.g. 280 already used plus 100 new, without other account activity);
   reset/resume while staff are offline; held Send later jobs; crashes before and
   after HTTP acceptance; two workers; simultaneous/repeated send clicks; unknown
   timeout outcomes; 429/5xx/auth errors; bounces/deferrals; duplicate/out-of-order
   webhook events; cross-role/batch denials; archive/unenroll/address changes;
   legacy enrollments; failed/uncertain responses; and browser responsive states.
6. Run appropriate frontend lint/build/unit/browser checks and backend system,
   migration, delivery/enrollment/access and PostgreSQL concurrency checks. Then
   document the worker and webhook configuration, monitoring and pause/recovery
   procedure. A controlled owner-approved real delivery test and production
   provisioning are separate rollout steps, not authorized by this plan.

No mass resend or automatic outbox creation for existing enrollments during the
migration. No change to assessment, recommendation, placement or login rules.

## Evidence and provider references

The preceding review passed 35 enrollment/provider tests and a synthetic
100-recipient FIFO dispatcher check. Those verify the current implementation,
not the proposed durable feature. This planning pass changes documentation only;
no new application tests, real sends or account-credit lookups were performed.

- [Current dispatcher](../skillbridge-backend/api/email_service.py)
- [Enrollment confirmation](../skillbridge-backend/api/enrollment_import.py)
- [Shared enrollment UI](../skillbridge-frontend/src/components/enrollment/StudentEnrollmentModal.jsx)
- [Brevo Free plan: daily sends and provider retry queue](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
- [Brevo API rate limits](https://developers.brevo.com/docs/api-limits)
- [Account credit information](https://developers.brevo.com/reference/get-account)
- [Current provider idempotency guide](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
- [Earlier idempotency changelog](https://developers.brevo.com/changelog/2021/11/10)
- [Transactional delivery events](https://developers.brevo.com/docs/transactional-webhooks)
- [Webhook authentication](https://developers.brevo.com/docs/secured-webhooks)
- [Provider handling of temporary/permanent bounces](https://help.brevo.com/hc/en-us/articles/209435165-What-are-soft-bounces-and-hard-bounces-in-email)
