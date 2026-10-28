# Brevo enrollment email review

Reviewed 28 October 2026. This is an assessment, not an email-system implementation.
No real emails were sent or live enrollment/account data changed.

## Current behavior

- Successful enrollment registers one email callback for each newly created
  BatchEnrollment. Callbacks run after the enclosing enrollment transaction commits.
  Preview sends nothing. Enrollment remains saved if notification dispatch fails.
- Each callback calls `queue_email`, which places a private, personalized message
  in a bounded in-memory queue with room for 1,000 waiting messages per process.
- A single lazily started daemon worker per backend process drains its queue in
  FIFO order. Each message makes its own Brevo transactional API request with
  one recipient. A 100-student enrollment does not create 100 sending threads or
  wait for 100 remote deliveries before returning.
- There is no deliberate time delay between sends. Throughput depends on provider
  request latency. The deployment Procfile starts two web workers, so this is not
  one shared global queue across the deployment.
- HTTP connect/read timeouts are 5/15 seconds. A 2xx response means provider
  acceptance, not verified inbox delivery.
- `queued` in enrollment results means admitted to the local queue. The response
  is not updated if a later send fails. Immediate configuration, queue admission
  or worker-start failure produces `dispatch_failed`.
- An already-enrolled student is skipped without an email. Re-importing a batch
  does not resend its existing invitations.

## Reliability gaps

The queue is not persisted. Server restart/redeployment can lose waiting messages.
There is no database outbox, saved delivery status, automatic retry, rate-limit
backoff, saved Brevo message ID, delivery webhook, send-later option, or batch-scoped
send/resend endpoint/button. Provider failures after queue admission are logged
using internal IDs, without changing the saved enrollment result.

Thus, queue capacity accommodates 50–100 invitations when enough room remains,
but this does not guarantee every invitation reaches the recipient. Enrollment
and student DNSC Google access remain separate from notification delivery.

## Recommended next change

Offer **Send now** or **Send later** during enrollment, then provide a batch-scoped
**Send enrollment emails** action for selected students or all pending recipients.
Keep one personalized message per recipient, without exposing other addresses.

Use a persistent outbox and a bounded worker that resumes after restarts. Track
pending/queued, sending, provider-accepted, retryable failure and permanent failure
separately. Only label a message delivered when a verified provider event supports
that status. Handle transient failures and 429 responses with bounded backoff;
protect repeated button clicks and retries against avoidable duplicate sends.

The server must enforce admin/instructor batch permissions, current enrollment
and active-account checks at queueing and dispatch. Retain reviewed DNSC addresses;
show recipient counts and skip already accepted jobs unless an intentional resend
is requested. Do not recreate users or enrollments to resend an email.

For 50–100 recipients, reliable persistence and recovery are more important than
parallelizing sends. Brevo's personalized batch API could be used later with
per-message reconciliation; it is not integrated in the current application.

## Verification and provider limits

- `api.test_enrollment_import` and `api.test_external_failures`: **35 passed** on
  isolated in-memory SQLite, with notifications/providers mocked.
- Exercised the real in-process dispatcher with 100 synthetic recipients and a
  fake delivery function: **100 admitted, 100 fake deliveries, FIFO order retained,
  peak sending concurrency 1**. No external requests or database writes occurred.
- Reviewed the enrollment request/UI, authorization, post-commit callbacks,
  dispatcher, model fields, routes, configuration and deployment command.
- Verified official Brevo documentation: the Free plan currently includes 300
  sends per day; personalized batch sending supports up to 1,000 message versions
  in one request. These are separate limits. The user's actual account plan,
  credits, sender configuration and inbox delivery were not checked.

Sources:

- [Dispatcher](../../skillbridge-backend/api/email_service.py)
- [Enrollment confirmation](../../skillbridge-backend/api/enrollment_import.py)
- [Enrollment request and notification content](../../skillbridge-backend/api/views.py)
- [Current documented dispatch limits](../../knowledge/IAMS_ENROLLMENT_IMPORT.md)
- [Brevo Free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
- [Brevo batch sending](https://developers.brevo.com/docs/batch-send-transactional-emails)
- [Brevo API rate limits](https://developers.brevo.com/docs/api-limits)
