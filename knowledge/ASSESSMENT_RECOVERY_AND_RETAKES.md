# Assessment interruption recovery and retake requests

27 October integration review: confirmed requests now update immediately even
if a follow-up read fails, with separate saved/refresh-failed feedback. Pending
refs prevent duplicate student/reviewer activation, mutation envelopes confirm
the saved request state, and timestamps use Asia/Manila. Confirmed finalized
attempts clear obsolete browser markers. See
[the branch review](BRANCH_REVIEW_2026_10_27.md) for full verification and limits.

27 October 2026. Implemented on `codex/assessment-recovery-retake-requests`.
Initial implementation used isolated synthetic records and mocked Storage.
The configured database migration and user-created private bucket were subsequently
verified on 27 October as recorded below. Application deployment remains separate.

## Interruption policy

The student assessment now covers the questions during lost focus, hidden-page,
fullscreen-exit or navigation interruptions instead of immediately stopping on the
first signal. Browser signals do not identify an antivirus dialog, emergency call,
notification or intentional app switch. Unobserved overlays remain undetectable.

- Focus-only events below two seconds can recover automatically after focus returns.
- Other interruptions require **Resume assessment**, with desktop fullscreen restored
  by that user action. Mobile continues to omit mandatory fullscreen.
- At least two seconds of focus-only loss, or ten seconds of hidden/fullscreen/page
  interruption, counts as one incident. Overlapping signals share one open incident.
- Three counted incidents or 60 cumulative interrupted seconds require instructor
  review. All durations, including short recovered events, contribute to the total.
  A defensive 100-event cap also requires review rather than growing JSON indefinitely.
- Timers continue. Server deadlines and the existing 30-second submission transport
  allowance remain authoritative. Background timers are not relied on for enforcement;
  server checks run on recovery and final submission. A client-observed 60-second
  interruption also requires review if a network outage delayed recording its start.
- Restricted keyboard actions stay blocked and show a warning. They no longer
  automatically finalize an attempt. Context-menu prevention remains.
- Neutral recovered events do not set `is_flagged`, change scores, reset time or
  grant completion. A review-required stop uses the existing stopped/flagged path,
  saves completed answers and remains excluded from combined competency.

The agreement describes the policy and suggests charging the device, closing chat
bubbles and considering Do Not Disturb with emergency exceptions. It does not
promise that the browser can detect every overlay or authenticate an emergency.

## Reading inactivity reminder

After five minutes without mouse/pointer movement, a press/tap, keyboard input,
touch, scrolling/wheel or input events, an active assessment shows a small
in-page **Are you still there?** reminder with **Continue assessment**. It never
takes focus or leaves fullscreen. Continue or activity outside the panel dismisses
it and starts a fresh inactivity period. An ignored reminder stays visible once,
without repeating announcements or escalating to an integrity incident. Moving
over its own controls does not make the Continue button disappear.

This is local UI only: inactivity sends no integrity event, stops no attempt,
changes no answer, and does not pause or reset the server-backed countdown.
Existing local saves and server draft saves continue normally. The reminder is
mounted only while the question/review screen is active and time remains; it is
removed during interruption recovery, submission, time-warning/confirmation
screens, the open mobile question navigator and after navigation. On mobile/tablet
it sits above the floating navigator button. Each mount starts a fresh five-minute period and
cleans up its timeout and input listeners on unmount. Its clock uses monotonic
elapsed time; event tracking does not re-render the page on every mouse move.

Verification: `tests/assessment_inactivity_playwright.py` passed clock-controlled
Chrome checks at 1280px desktop and 375px mobile. Checks cover the threshold,
ignored reminder without repetition or interruption records, each input reset,
Continue, retained focus/fullscreen/answers, continuing countdown and server
draft saves, interruption priority, mobile navigator clearance and unmount
cleanup. Desktop fullscreen is simulated in this test; it is not a physical
device test. All nine existing recovery/retake browser workflow groups and both
cutoff/last-second-extension regression cases also passed. Frontend lint/build
and `git diff --check` passed. Screenshots/results use synthetic data and mocked
APIs under ignored `tests/artifacts/assessment-inactivity/`. No database migration
or production data change was required.

## Drafts, reloads and evidence boundaries

Existing account/assessment local answer storage is retained. Every 15 seconds,
and when an interruption begins/recovers, the browser sends a validated draft to
`POST /api/assessments/<id>/interruption/`. This endpoint accepts `draft`, `begin`
and `recover` actions with the exact attempt identity. Draft revisions prevent older
in-flight saves replacing newer drafts. Choice/question ownership and payload
structure use the existing submission validator. Draft text and list lengths are
bounded. Draft saves never call the grader or create score rows.

Reloads use the same server attempt, question layout and deadline. Same-attempt
local answers take precedence over the last server draft on the same device.
An open server/local interruption is recovered explicitly. Exit delivery is best
effort; mobile process kills can omit browser events. If no interruption signal
reaches the server, it cannot reconstruct an unseen absence.

An expired unfinished attempt can request a retake using its last server draft.
The request marks it stopped for review without grading the draft or adding
completion credit. The draft remains on the response and is archived inside the
request snapshot when a later retake starts. It is distinct from submitted answers
and scored history. No client-provided late answers are accepted by this path.

## Student request and staff review

- Assessment cards offer **Request retake** only when that response is flagged and
  the API reports it eligible. Ordinary submissions, unstarted attempts and already
  approved retakes do not show this new-request action. Existing requests retain
  **View retake request**, including decisions. The recovery API still supports
  expired/overdue unfinished attempts through its existing direct request path.
  Requests can be filed while published, overdue
  or closed in an active batch; archived assessments remain read-only.
- `/student/assessments/<id>/retake-request` requires a 30–500-character explanation
  and either one image or a 15–500-character reason no image is available. A request
  can be sent once per current attempt. Repeated submission with the same UUID is
  idempotent; a different pending/decided request cannot replace its evidence.
- The supporting-image field has a dashed drop area, a centered keyboard-accessible
  Add/Replace image button and a local image preview with filename/size and Remove.
  Selecting or dropping an image does not upload it until the request is submitted.
  Invalid types, files over 5 MiB and multiple dropped files show inline errors;
  type/size-invalid replacements preserve the existing valid image. The no-image explanation
  reappears when the image is removed. Preview Blob URLs are revoked on replacement
  and unmount. Buttons provide pointer, hover and visible keyboard-focus feedback.
- No image can prove the interruption's cause. Reviewers see this limitation, the
  explanation, absence-of-image reason, interruption records and available image.
- `/instructor/retake-requests` and `/admin/retake-requests` share the existing
  report-table styles and compact cards, with eight requests per page and shared
  pagination. Desktop uses an icon-only cards/list toggle with accessible labels,
  tooltips and pressed state; changing view preserves search, status, order and
  page. Below 1024 CSS pixels the collection uses cards and hides the unnecessary
  toggle. Intermediate desktop tables scroll inside their labeled region.
  Search/status changes reset the page; the server clamps shrinking result sets.
  The toolbar uses status pills and the server's filtered total, without inventing
  per-status counts. Previous-attempt requests have a separate read-only filter.
  Both staff sidebars use the shared circular-arrow icon for Retake requests,
  distinct from the Assessments list icon.
- The toolbar follows the instructor dashboard's compact desktop sizing: 38px
  search input, 28px filter pills and 26px icon buttons in a padded view tray.
  The filtered count sits beside the icon-only toggle. Controls wrap when space
  is limited; coarse-pointer devices and widths below 640px retain 44px targets.
  A focused sizing check verified both roles at 320/768/1024/1440px, including
  matching measurements, icon-only switching, light/dark overflow checks and zero
  page errors. Frontend lint/build and `git diff --check` passed after this change.
- Review/View details opens the existing native `DialogShell`. Only opening a
  request with an image downloads its private evidence. The scrollable body holds
  the explanation, image, interruption disclosure and review note; its footer keeps
  Decline/Approve retake reachable on short screens. Keyboard focus is trapped,
  Escape closes and focus returns to a surviving opener. Reviewed, archived and
  historical requests are read-only. Submission errors retain the note; successful
  decisions close the dialog and invalidate all queue filter variants. No database
  or endpoint change was needed for this collection redesign.
- The approved review-dialog redesign uses a wider 940px maximum surface, with
  an identity/assessment strip and two columns at 800 CSS pixels and above:
  explanation/evidence on the left, interruption timeline/review note on the right.
  Narrower screens stack these sections and initially collapse the interruption
  disclosure; desktop shows the same records directly. Reason labels use plain
  language, timestamps use local month/day/time formatting, and durations come
  from the recorded events. Partial duration summaries say "recorded"; an unknown
  duration is not represented as zero. The review note retains its 10–1000-character
  contract and has a visible counter. The shared dialog still owns focus, Escape,
  scroll locking and the footer; image authorization and decision payloads stay
  unchanged. Evidence styling is scoped to this dialog, preserving student pages.
  Verification passed all nine synthetic Chrome workflow groups, frontend
  lint/build and `git diff --check`. Both roles were checked at 320, 640, 768,
  800, 1024 and 1440px, including light/dark layouts, collapsed mobile records,
  two-column/stacked ordering, counters, known/unknown durations, footer placement
  with no extra desktop height, and a 420px-tall viewport. Existing approval,
  decline, conflict-retry, private-evidence and read-only-history checks passed.
  Implemented-dialog screenshots with synthetic data are saved in ignored
  `tests/artifacts/retake-recovery/redesigned-review-{desktop,mobile}.png` under
  the frontend. No real review decision was submitted during screenshot capture.
- Instructor scope follows the assessment batch's assigned instructor; admins use
  their existing broader scope. Direct evidence/review endpoints enforce these roles.
  Another student or unrelated instructor cannot view evidence. Evidence is loaded
  only when its disclosure is opened and authorized again on each API request.
- Decisions require a 10–1000-character note, exact attempt identity and request UUID.
  Decisions lock the assessment and response consistently with start/retake flows.
  A second reviewer receives a conflict after the first decision commits.
- Approval sets the existing `retake_allowed` flag. It does not immediately remove
  scores or restart time. The assessment must be available at approval/start; staff
  must reopen or extend a closed/overdue assessment before approving.
- Existing direct retake controls remain available when no request is pending. A
  pending request must be decided in the review queue to preserve its decision.
- The next approved start archives request, reviewer, private image reference and
  interruptions with the prior attempt, then resets current request/draft fields.
  Historical image endpoints retain role/ownership checks. Denied requests cannot
  be silently overwritten; staff can still use their existing manual retake process.

These fields extend `StudentResponse` and `AssessmentAttemptHistory` via migration
`0025_assessmentattempthistory_interruption_events_and_more`; no application table
is created. Migration `0026_alter_studentresponse_retake_explanation` subsequently
limits the current explanation column to `varchar(500)`. Review audit entries
contain decision metadata, not explanations/images.
Recipient-scoped attempt invalidations refresh cards and review queries; the existing
visible-page refresh remains the fallback. No emails or external messages are sent.

## Private image setup

Use the existing Supabase project and backend-only Storage credential. Create a
**private** bucket `retake-evidence` (or configure `RETAKE_EVIDENCE_BUCKET`). This
must differ from `COMPANY_IMAGE_BUCKET`. Do not use the public company-branding
bucket or grant client read/write policies. Django authorizes every upload/read;
the frontend never receives a service credential, object key or public/signed URL.

Set the bucket's allowed MIME type to `image/webp` and object limit to **524288
bytes (512 KiB)**. The backend checks that the bucket reports `public: false` before
upload and download. Configuration failures fail closed and preserve the form.

JPEG/PNG/WebP inputs are decoded and verified on the backend: up to 5 MiB, 20
megapixels, 10,000 pixels per side, one frame. EXIF orientation is applied, then a
fresh pixel-only image removes metadata. Bounded WebP conversion uses up to 1600px
and a 512 KiB cap to retain more screenshot readability than company-logo settings.
If it cannot fit at the supported sizes, the upload is rejected rather than saving
an original or an unreadable thumbnail. Students should crop unrelated private data.

Uploads use unpredictable, server-owned object paths without overwrite. Conversion
and Storage upload happen before assessment row locks; eligibility/attempt identity
are checked again under lock. Conflict/rollback cleanup only deletes unreferenced
objects. Current and archived references protect evidence. Cleanup failure logs no
student content or credentials and requires operator reconciliation. There is no
automatic retention deletion policy in this change; agree institutional retention
before real evidence accumulates.

Images are downloaded through a Django JWT-authorized endpoint, with `private,
no-store` and WebP/nosniff headers. Browser Blob URLs are revoked on unmount. Existing
company images, matching text, score aggregation and placement history are unchanged.

References checked: [Supabase private/public buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[authenticated downloads](https://supabase.com/docs/reference/python/storage-from-download)
and the [changelog](https://supabase.com/changelog). The current HTTP/TLS deprecation
does not change this existing server REST integration. No Supabase Auth or SDK added.

## Rollout and verification

For another environment, back up the intended database, apply Django migration
0025 during a window with no active assessments, configure the private bucket and
restart the backend. Keep backend/frontend rollout coordinated because the updated
frontend expects the draft/recovery endpoints. The previous strict policy is not
changed for already finalized history. Do not apply migration commands to an
unknown/production database merely to run tests.

Run isolated checks with `PYTHON_DOTENV_DISABLED=1`, a synthetic `SECRET_KEY`,
`DEBUG=True` and `--settings=core.test_settings`. Backend suites cover the new
request/recovery contracts plus submission, timing, multiple-assessment, combined
competency and change-event regressions. Storage is mocked. The SQLite test setup
does not establish PostgreSQL row-lock interleavings.

Browser checks: `tests/retake_recovery_playwright.py` uses synthetic intercepted
APIs and installed Chrome. It checks student requests, instructor/admin review,
pagination/search/reset, transient/hidden interruption recovery, offline retry,
local draft/reload, restricted-shortcut warning and review stop. The existing
`assessment_timer_recovery_playwright.py` checks cutoff and last-second extensions.
Native calls, antivirus notifications, Android bubbles, iOS Safari, production
Storage and PostgreSQL concurrency remain unverified physical/environment checks.

Recorded local results: 201 frontend Node tests passed. The 100-test backend
regression run passed 95 tests, with five PostgreSQL-only checks skipped on the
isolated SQLite configuration; all 20 new recovery/request/evidence tests passed.
The four synthetic retake/recovery browser groups and two existing timer-recovery
groups passed without page errors. Phone request/review and desktop review
screenshots were inspected. Frontend lint/build, Django check, migration drift
check and `git diff --check` passed. Storage HTTP was mocked; no private bucket
or live migration was created/applied.

## Configured migration and live bucket verification (27 October 2026)

The user explicitly authorized migration and testing after creating the bucket.
The configured Django database and Storage point to the SkillBridge Supabase
project. No unexpired in-progress attempts were present at migration time.

- A local custom-format backup of the public application schema/data was saved
  under ignored `work/retake-live-verification/`; it is not committed or included
  in fixtures. Treat it as private application backup data.
- Django migration `0025_assessmentattempthistory_interruption_events_and_more`
  was applied transactionally to the configured PostgreSQL database. It added
  12 response columns and two history columns. No application table was created.
  Before/after row counts and fingerprints, excluding the added columns, matched
  for every existing `api_` table. Django reports no pending plan for 0025, and
  the system check passes. New starts were prevented during the transaction with
  the existing assessment-table lock order and a bounded lock timeout.
- The existing `retake-evidence` bucket is private and allows `image/webp`.
  Its configured object limit is 1 MiB; the backend still enforces 512 KiB.
  No bucket configuration, policy, credential, company image or real student
  record was modified during verification.
- A generated PNG (11,902 bytes) was submitted through the real request API using
  synthetic users/attempts in an **in-memory SQLite database**, with real Storage.
  It became a 6,322-byte WebP at 1600 × 889, with metadata removed. Student,
  assigned instructor and admin reads succeeded with `private, no-store` headers;
  unrelated student/instructor reads returned 403. An anonymous public-object
  read was denied. Approval, next-attempt start and private historical evidence
  retrieval passed through the API. No synthetic users were created in Supabase.
- The synthetic Storage object was removed by the normal cleanup helper, with
  absence confirmed through authenticated object listing. Immediate authenticated
  download remained cached temporarily after deletion; origin-listing verification
  avoids incorrectly treating that cached response as a failed deletion. Supabase
  documents propagation delay in its [CDN guidance](https://supabase.com/docs/guides/storage/cdn/smart-cdn).
  SkillBridge continues to authorize reads through Django and never gives students
  Storage credentials or public/signed evidence URLs.
- A fresh disposable **local PostgreSQL** cluster ran all 100 assessment,
  recovery/request/evidence, timing, submission, combined-competency and event
  regression tests: **100 passed, zero skips**. This supersedes the initial
  SQLite-only concurrency limitation for those tests. The first PostgreSQL run
  found that review queries locked the nullable side of an outer join; both
  review locks now explicitly target `of=('self',)`, preserving parent-before-
  response locking while avoiding PostgreSQL's nullable-join restriction.
  The new cluster was stopped and its test database removed after the run.

Local evidence: ignored `work/retake-live-verification/live-evidence-result.json`
and `work/retake-recovery-postgres-q6ndb5te/tests.txt`. Physical phone calls,
Android overlays, iOS Safari and the hosted application's deployment remain
outside these checks.

The pre/post migration Supabase security advisor initially showed a pre-existing
finding: `public.api_managementaction` had RLS disabled, with `anon`/`authenticated`
table privileges. The user subsequently enabled RLS; a read-only query on 27 October
confirmed `relrowsecurity = true`. Both tables changed by 0025 also retain RLS enabled.
No permissions were changed by the agent as part of this migration. Reference:
[Supabase's RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

## Explanation length limit

The explanation now accepts 30–500 characters in the frontend and API, with a
visible counter associated with the textarea. PostgreSQL also enforces the
500-character maximum through `varchar(500)`. Migration 0026 checks for existing
values longer than 500 before altering the type and aborts if any exist; it never
silently truncates an explanation. Previously archived JSON snapshots are retained.
The no-image reason and reviewer-note limits retain their existing contracts.

This limit improves brevity and validation; it does not reserve or recover a fixed
500-character storage allocation. PostgreSQL `text` and `varchar(n)` store actual
text plus overhead. Fixed-width `char(n)` pads shorter strings with spaces. A
read-only demonstration with 100 ASCII characters returned 104 bytes for
`varchar(1000)` and 1004 bytes for `char(1000)`; these expression sizes exclude
overall row/index overhead. See [PostgreSQL character types](https://www.postgresql.org/docs/current/datatype-character.html).

Migration 0026 was applied to the configured PostgreSQL database on 27 October
2026 after a private backup. No existing explanation exceeded 500 characters;
before/after fingerprints and row counts matched across all existing `api_`
tables. The resulting column is `character varying(500)`. Verification passed
103 tests in disposable local PostgreSQL (zero skips), the synthetic browser
workflow including the counter/input cap, frontend lint/build and Django's
migration-state check. Live application deployment remains separate from this
database migration.

The subsequent student UI refinement passed frontend lint/build and all seven
synthetic Chrome workflow groups, with no page errors. The added checks cover
assessment-specific action visibility, actual desktop hover feedback, keyboard
file selection, drag/drop, decoded previews, replacement/removal, invalid type and
oversized replacement handling, light/dark layouts at 375px and 1280px, and the
selected image bytes in the submitted multipart request. These use mocked APIs;
the prior real private-Storage verification remains recorded above. No backend,
database or Storage configuration change was needed for this UI refinement.

The staff collection redesign subsequently passed all nine synthetic Chrome
workflow groups, ten navigation tests, frontend lint/build and `git diff --check`.
Both instructor/admin layouts were checked at 320, 640, 768, 1024 and 1440 CSS
pixels; the full review flows also cover 375 and 1280 pixels. Checks cover
icon-only controls, page preservation across views, search/status resets,
approval/decline payloads, conflict retry with retained notes, read-only historical
requests, evidence loaded only on opening, Escape/focus restoration, sidebar
clearance and no page-wide horizontal overflow. Review dialogs were also checked
at 420px height in dark mode, with trapped keyboard focus and visible footer
actions. These checks use intercepted synthetic APIs and installed Chrome, not
physical mobile devices or a hosted deployment. Screenshots/results remain in
ignored `skillbridge-frontend/tests/artifacts/retake-recovery/`.
