# Supabase private Broadcast pilot

Local implementation verified 8 November 2026. This is an opt-in transport experiment in
the [system optimization checklist](SYSTEM_OPTIMIZATION_PLAN.md), with ordinary
sessions continuing to use the existing [SSE and query cache](LIVE_DATA_FRESHNESS.md).
No application records are sent through Broadcast. Django remains responsible
for authentication, authorization, grading, result visibility and placement writes.

## Current acceptance state

- The approved receive-only setup was applied to the existing SkillBridge
  Supabase project on 8 November. The configured signer matched its advertised
  public key. All 11 hosted checks passed, followed by a local application
  journey using real private Broadcast and local SSE fallback. Only the isolated
  test processes enabled the application pilot. See the [real-channel results](#real-channel-local-application-results).
- The SkillBridge project was inspected through read-only catalog queries. All
  34 `api_` tables have RLS enabled; none is in the Realtime publication. There
  were no `realtime.messages` policies and no `sb_realtime_receiver` role. No
  public-schema security-definer functions were found. The health advisory was
  empty. Existing application grants to `anon`/`authenticated` are broad, which
  is why the receiver role must not inherit either role.
- One random, private connectivity channel was joined by a server-only client
  using the existing server credential. A public-key-only client was denied.
  Two single-message probes returned HTTP 202 and delivered their dummy marker
  over WebSocket in 433 ms and 476 ms. The second used the same API-key-only
  headers as the Django publisher. The first join attempt failed transiently.
  These samples establish basic transport connectivity. Hosted application-user
  authorization and matched latency testing are separate acceptance steps.
  Evidence is in `work/realtime-broadcast-connectivity.json` and
  `work/realtime-broadcast-connectivity-apikey.json`.
- The connectivity check changed no student/assessment/placement records,
  application-table publications, policies, roles or signing keys. Privileged
  credentials stayed inside local server processes.
- Before provisioning, the dedicated signing key and receiver-role policy still
  needed hosted verification. The project advertised an ES256 public key, which
  by itself cannot issue Django's dedicated Realtime tokens.
- On 8 November, the configured Realtime publish key returned HTTP 202 and
  delivered one dummy message to a private channel in 731 ms. The public-key
  client was denied. The locally prepared ES256 signer and topic secret passed
  Django configuration and local signature validation. The candidate key was
  absent from the hosted public signing metadata. The project audit found zero
  Supabase Auth users, recent Auth sessions and Edge Functions, and found no
  pilot receiver role or policies. Evidence for the message test is in
  `work/realtime-configured-credentials-check.json`.

## Local verification

- The full backend suite passed 814 tests on a disposable PostgreSQL cluster,
  including the nine receiver-policy and teardown cases. The additional student
  submission regression exercises the actual endpoint with a mocked publisher.
  Evidence is under `work/branch-review-postgres-akpuuagp/` and
  `work/branch-review-postgres-8xkq5ysg/`.
- The frontend passed 322 Node tests and lint. The enabled browser run passed 11
  groups with the pinned SDK and an intercepted WebSocket server. It covered
  private joins, authorized GET reconciliation, duplicate hints, visibility,
  logout, account switches and fallback. SDK teardown uses a normal WebSocket
  close, and the controller waits for teardown before starting a replacement.
  The browser harness observes routed close events because Playwright's Python
  callback can fail when the driver omits an optional close code or reason.
  Evidence is in `work/realtime-browser-verified-20261108.txt`.
- Both production build variants passed. The normal build omits the SDK chunk.
  The pilot build loads the 16.88 kB gzipped SDK chunk after a valid ticket.
  Build logs are `work/realtime-default-final-build-20261108.txt` and
  `work/realtime-enabled-final-build-20261108.txt`.
- With the pilot disabled, the repaired navigation suite passed 37 browser
  groups across the three roles. One development warning reported a select value
  of `null` during the instructor segment. The run passed without page errors.
  Evidence is in `work/navigation-states-agent-20261108.txt` and
  `work/navigation-states-agent-server-20261108.txt`.

## Runtime flow

1. Only a build with `VITE_SUPABASE_REALTIME_PILOT=true` attempts the exchange.
   The regular build starts SSE directly, without an exchange request or SDK load.
2. React POSTs `/api/realtime/session/` through the existing Axios client. The
   endpoint rechecks the current account, approval/enrollment and a server-side
   allowlist capped at two accounts. Disabled/incomplete configuration and
   nonpilot sessions return `{ "transport": "sse" }` with `no-store`.
3. An eligible session receives a project URL, public API key, server-assigned
   opaque recipient topic and an ES256 JWT. The token uses the fixed limited
   database role, an opaque UUID subject, and at most 60 seconds of validity,
   capped by the current Django access token. It grants no application role.
   Client-supplied roles, recipient IDs and topics are ignored.
4. The client lazily loads the standalone Realtime SDK, sets the limited JWT,
   and joins one private channel. A valid hint causes a generic resync through
   the existing cache. IDs or URLs from a provider payload are never applied.
   Instructor joins and scope-change hints use the existing scope-eviction path.
   Ordinary hints revalidate while keeping the current data visible.
5. The existing operation finishes and commits. Its ordinary recipient-scoped
   event log is written first. An independently enabled publisher then rechecks
   eligible pilot recipients and sends a small private invalidation through the
   REST Broadcast endpoint. Messages contain only the fixed type, allowlisted
   topic names and a random event key. Publishing uses bounded two-account
   fanout, short timeouts and no redirect/retry. Provider failure cannot turn a
   completed operation into an API failure or remove its SSE event.
6. Hidden tabs disconnect. Resume/join resynchronizes authorized GETs. Renewal
   rechecks Django eligibility before token expiry. A failed exchange, join or
   renewal closes the pilot and selects SSE; account changes/logout cancel old
   work. Existing visible/focus refresh remains available for missed events and
   time-based availability changes. Tokens remain in memory.

The pilot adds server HTTP work only when its publication switch is explicitly
enabled. Its overhead, repeated joins and event fanout need measurement before
expanding beyond two accounts. Short expiry bounds cached channel authorization;
it does not establish instantaneous revocation of an already-open channel.

## Configuration and signing trust

In the SkillBridge Supabase dashboard, open **Connect** for the project URL and
publishable key. In **Settings → API Keys**, obtain a backend secret key for
the REST publisher. Put these values in the local backend `.env` or the hosted
Railway backend service variables. Keep the secret out of chat and Git.
[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys#find-your-keys)

```dotenv
SUPABASE_REALTIME_URL=https://xlkyxnljcvpkdwnqaskc.supabase.co
SUPABASE_REALTIME_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_REALTIME_PUBLISH_KEY=sb_secret_...
SUPABASE_REALTIME_SIGNING_KEY=
SUPABASE_REALTIME_SIGNING_KID=
SUPABASE_REALTIME_TOPIC_SECRET=
REALTIME_PILOT_USER_IDS=
REALTIME_PILOT_ENABLED=False
REALTIME_PILOT_PUBLISH_ENABLED=False
```

The blank fields require a trusted dedicated ES256 signer, its key ID, an
independent random secret generated locally, and the Django IDs of one or two
synthetic pilot accounts. Supabase does not export a managed private key. Leave
both backend switches off until the signer and exact-topic receiver permissions
have been verified. Confirm the impact on the existing Auth configuration before
activating any imported signing key.

The frontend's local `.env` or Vercel environment uses only the build flag
`VITE_SUPABASE_REALTIME_PILOT=false`. Django provides the public URL and key in
the exchange response. Change the flag in the intended frontend build after the
backend and Supabase checks pass.

Backend settings are documented in [.env.example](../skillbridge-backend/.env.example):

| Setting | Purpose |
| --- | --- |
| `REALTIME_PILOT_ENABLED` | Exchange opt-in; default `False` |
| `REALTIME_PILOT_PUBLISH_ENABLED` | Post-commit publication opt-in; default `False` |
| `REALTIME_PILOT_USER_IDS` | At most two explicit test account IDs |
| `SUPABASE_REALTIME_URL` | Exact HTTPS hosted project origin or `/realtime/v1` URL |
| `SUPABASE_REALTIME_PUBLISHABLE_KEY` | Modern public API key |
| `SUPABASE_REALTIME_SIGNING_KEY` | Dedicated, already trusted P-256 private PEM; backend secret |
| `SUPABASE_REALTIME_SIGNING_KID` | Matching trusted key ID |
| `SUPABASE_REALTIME_TOPIC_SECRET` | Independent random secret of at least 32 characters |
| `SUPABASE_REALTIME_PUBLISH_KEY` | Explicit backend-only publish credential |

Do not substitute Django's `SECRET_KEY`, the Storage credential JWT, or a public
JWKS value for a signing private key. Importing a Supabase standby signing key
does not immediately make signatures trusted: activating it changes project-wide
Auth signing. No import, activation or rotation is automated by this feature.
Configure a deliberate trust arrangement before hosted application-user tests.
[Supabase signing-key lifecycle](https://supabase.com/docs/guides/auth/signing-keys#lifetime-of-a-signing-key)

The dedicated receiver role needs only the Realtime schema/message read grants
and an exact-topic receive policy. It must have no inherited application-table,
Storage, security-definer-function or client-publish capability. Inspect effective
`PUBLIC` privileges too. Custom-role policies read the verified
`request.jwt.claims` setting without adding managed-auth privileges.
[Custom-role guidance](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema-9e32e7)
· [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)

The [manual setup](../skillbridge-backend/ops/realtime_pilot_setup.sql) and
[teardown](../skillbridge-backend/ops/realtime_pilot_teardown.sql) are opt-in SQL
operations. They are separate from Django migrations and startup. Their policy
tests model the managed message table locally. Hosted grants and key acceptance
still require the pilot checks below.

## Hosted acceptance and rollback

### Rollout checkpoint

The owner approved the signing-key activation and receive-only pilot policy.
Public checks on the canonical deployment passed: frontend HTTP 200, API health
HTTP 200 with the canonical frontend origin allowed, and anonymous account API
HTTP 401. Public JWKS returned one ES256 key. The read-only Supabase preflight
found two Storage buckets, no Supabase Auth users, recent sessions, Edge
Functions, pilot policy, receiver role, or published application tables. The
Realtime table still has RLS. The owner confirmed a fresh SkillBridge Google
sign-in and a Supabase Storage image loading in a partner profile before
rotation. This baseline covers Google login and an image read. No production
changes were applied in this checkpoint.

After the authenticated baseline, the owner imports the prepared private JWK
directly in the project dashboard, retains the current key and activates the
imported standby key. Repeat the baseline with the existing session and a fresh
session before provisioning the receiver policy. If the baseline regresses,
restore the prior current key and leave the pilot disabled.

After rotation, the owner confirmed instructor and student sign-ins and the same
partner image loading from Storage in the local app. The owner subsequently
confirmed sign-in and the partner image in the live deployment too. The owner
reported slower data loading on the first local dashboard and after navigation.
Three local database health
requests took 0.93–1.16 s. Three anonymous account requests returned the expected
401 in 0.004–0.022 s. The default local frontend port was unavailable for timing.
The health check measures database access end to end without isolating connection
setup or query time. The affected authenticated requests still need timing.

Separately, public hosted API health took 1.31–1.72 s across three requests.
Railway returned no successful samples for the authenticated routes queried. Its
backend revision `181b4d6` predates the optimization at `323f587`.

The selected Supabase project already records migrations through
`0041_organization_banner_colors`. The institute, program, instructor assignment
and competency framework tables have RLS enabled and no access policies. Recheck
the exact target and migration plan in the release rehearsal. The Realtime
receiver role was still absent at this check.

The owner imported and activated the dedicated signer in the dashboard. The
signed private-channel join subsequently passed. The approved receiver policy
was applied as `skillbridge_receive_only_realtime_pilot` after repeating the
privilege and health checks. Use the reviewed teardown to remove the marked
pilot policy and role if the pilot is retired. Retaining earlier signing keys
preserves the separate signing rollback. [Supabase signing-key lifecycle](https://supabase.com/docs/guides/auth/signing-keys#lifetime-of-a-signing-key)

The [hosted probe](../skillbridge-frontend/tests/realtime_hosted_probe.mjs) reads
only the five `SUPABASE_REALTIME_*` process variables for URL, publishable key,
publish key, signer PEM and key ID. It does not load `.env`. After the owner
provides those variables in a private process, run it from the repository root
with `node skillbridge-frontend/tests/realtime_hosted_probe.mjs`. It uses random
topics, sends one dummy event on the normal success path and reports only check
names and statuses. The Data API and Storage checks request no application
records. A timeout or unrecognized denial fails the probe. All eleven assertions
were exercised with a mock transport and subsequently passed against the real
project. The join probe allows 12 seconds for an explicit server response.
Timeouts fail the check. Storage permission errors wrapped in HTTP 400 must
contain a recognized permission-denied indication. An unrelated 400, missing
bucket or successful 200 fails the denial check. Five local mock cases verify
those classifications.

- Verify the exact dedicated key is trusted and the limited role can join only
  its own private topic. Test foreign/missing/expired/forged claims, anonymous
  clients, cross-account topics, direct application Data API and private Storage
  denial, and client publish denial.
- Inspect every applicable policy before adding the pilot policy. A narrow
  permissive policy cannot override an existing broad permissive policy. A
  connection in the Inspector's `postgres` role is not an app-user access test.
- Start with dummy markers and then one synthetic assessment/cohort. Verify a
  successful post-commit change causes an authorized roster GET. Compare with
  SSE using the same fixture, including write latency, disconnect recovery,
  expired/changed access, event duplication and idle event-log reads.
- The checked-in [Vercel policy](../skillbridge-frontend/vercel.json) permits
  the exact SkillBridge HTTPS and WSS origins in `connect-src`. Confirm those
  directives on the hosted pilot frontend. For a different Supabase test project,
  use that project's exact origins in the test build's policy.
- Set the frontend flag and both backend switches back to false to return to
  ordinary SSE. Active pilot tabs close on their next renewal or reload; reload
  affected tabs for an immediate return. Existing persisted events and ordinary
  visible/focus refresh provide recovery.

Keep destructive failure and heavy load tests in disposable/local or isolated
staging environments. A same-project connectivity test shares current resources
and does not replace these acceptance checks.

## Login-to-assessment browser workflow

Run this on the release build after the private-channel probe passes. Use a fresh
synthetic cohort backed by an isolated application database. Adding programs and
assessment catalog records to the live application can affect shared views and
recommendation state. Bootstrap only the test administrator. Record the build,
each outcome, the transport observed, and any external services substituted.

- [ ] Sign in through the admin login page. Add a new instructor, add a program,
  and assign that instructor to the program. Reload to confirm the assignment.
- [ ] Sign in as the new instructor/OJT coordinator. Create a batch and its
  competency category, add and publish an assessment, then enroll a test student.
- [ ] Sign in as the enrolled student. Complete profile setup, open the published
  assessment, answer, review and submit. Confirm the expected score and completion
  after reload. Verify a repeat submit leaves one saved attempt.
- [ ] Keep the assigned instructor's roster open in another browser session.
  Verify the same completion appears through an authorized Django request. Confirm
  student access to staff pages and unrelated roster data is denied.
- [ ] Compare the submission and roster checks on ordinary SSE and on the
  allowlisted WebSocket. Interrupt the socket during the pilot and verify the
  roster catches up through fallback or on reconnect without a duplicate attempt.

The [local API rehearsal](../skillbridge-backend/api/test_release_workflow.py)
exercises this record chain with both pilot switches off and a simulated Google
identity provider response. Browser acceptance and hosted transport checks are
tracked separately above.

### Real-channel local application results

The owner authorized loading only `SUPABASE_REALTIME_*` settings from the backend
environment file for this test. Credentials remained in local process memory.
The frontend process received public build settings only. The probe matched
the configured private signer to the project's public key before using it.

The hosted probe passed all 11 assertions. Own-topic join and dummy delivery
succeeded. Publishing with the receiver token returned 403. Foreign topics,
expired tokens and public-key-only clients received explicit denials. The
receiver was denied application-table and private Storage access. The first
two foreign-topic probes timed out with the original four-second timeout. With
a 12-second bounded join, the server explicitly denied the join. This changes
the diagnostic probe's timeout. The application adapter keeps its existing
eight-second join timeout and fallback.

The approved role is NOLOGIN, NOINHERIT and has no application-table or Storage
privileges. A post-setup health advisory was empty. The security advisor returned
one informational RLS-without-policies finding. Existing Django-only tables are
protected by RLS without direct client policies. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

The local journey used a disposable SQLite database with two allowlisted
synthetic accounts and an independent random topic secret. The browser used the
real application transport, real Django token exchange and post-commit publisher,
and the real hosted private channel. Submission used the normal Django API.
No application records were written to the hosted database by this fixture.

- The instructor joined the private channel while its SSE stream was inactive.
- A committed student submission delivered through hosted Broadcast, triggered
  a mounted roster GET and showed one required assessment complete.
- Closing only the Supabase socket selected the existing local SSE transport.
- A second submission refreshed the roster through SSE and retained the exact
  final 6/6 combined score. The passing run had zero browser page errors.

The passing samples measured 1,814 ms from the first submit request to the
observed roster read and 1,603 ms for the second submission using SSE fallback.
These are single samples from different assessments, including the write request
and browser reconciliation. They do not establish p95 commit-to-visible latency,
matched-load superiority, idle-query reduction or faster initial page loading.

Evidence is in `work/realtime-hosted-acceptance.json` and
`work/real-realtime-journey-6b8fmjug/results.json`. Earlier failed harness runs
are retained. Their observer initially mistook Vite frames and OPTIONS responses
for application traffic and closed Vite's development socket during fault
injection. The passing harness filters to the actual Supabase socket and roster
GETs. The test servers were stopped after the run. The approved hosted role and
policy remain provisioned for the pilot.

### Local rehearsal results after resuming

The release UI review repeated the 11 hosted probe checks and the 11 local
browser transport checks. A separate local synthetic assessment submission
refreshed the coordinator's roster through real hosted Broadcast. After
disconnect, the next submission used SSE and the final competency was 6 of 6.
The [multi-program release simulation](GENERALIZED_SYSTEM_FIX_PLAN.md#release-simulation-after-the-ui-review)
also verifies the exact post-commit recipient set for three program cohorts.

Resumed on 8 November 2026 at `f8e4658` with the preserved working-tree changes.
The full disposable PostgreSQL run passed 816 tests in 504.318 seconds and stopped
its cluster. Its evidence is in `work/branch-review-postgres-ywtcu00f/tests.txt`.
This includes the API chain from administrator login through instructor/program
creation, assignment, assessment publication, student login and graded submission
to instructor-visible completion, plus the receiver-policy tests.

The enrollment browser journey now passes all six groups for instructor and
admin enrollment. Students completed profile setup and two assessments with
MCQ, true/false and identification answers. Both journeys saved the expected
5/6 combined result, enforced required completion, recovered from interrupted
submission, and verified completion through both staff roster APIs. The final
browser run recorded zero page errors. Evidence is in
`skillbridge-frontend/tests/artifacts/enrollment-assessment-journey/checks.json`.

The fixture now selects BSIT before enrollment preview, follows institute/program
navigation for the shared IC cohort, and checks the saved student-facing title
from the canonical result response. These updates address outdated fixture
assumptions found during this rehearsal. The production application code was
unchanged during this resumed pass.

The prior 322 frontend tests, production build, 12 browser sign-in cases, eight
multi-institute groups, four program-dialog groups and 11 synthetic WebSocket
groups passed in this rehearsal. Google identity, map responses and the
WebSocket server were substituted where documented by each fixture. The linked
API chain exercised instructor and program creation. Separate UI suites covered
program forms and assignments. The whole workflow was not performed as one
browser-only scenario.
Hosted private-channel authorization and matched load timing remain open.

### Earlier local rehearsal pause checkpoint

Paused on 8 November 2026 on local `main` at `f8e4658`, 75 commits ahead of
`origin/main`, with the existing working-tree edits preserved. The owner
authorized local verification only and will review the system before publishing.
The rehearsal used synthetic data and disabled normal dotenv loading.

- Passed 322 frontend Node tests and a local production build with the pilot off.
- Passed eight multi-institute browser checks and four program-management dialog
  checks against isolated APIs. This covered the existing mixed IC cohort,
  new-program assessment completion, roster and grading-key scope, assignment,
  and an institute-scoped report. Evidence is in
  `work/organization-browser-754pc7f0/browser.txt` and
  `work/organization-browser-dgnbqlq0/browser.txt`.
- Passed 12 browser sign-in contract checks and 11 browser Realtime checks
  across the three roles. The Realtime suite used the actual SDK against an
  intercepted synthetic server and verified authorized refresh, reconnect and
  SSE fallback. It did not contact the hosted private channel.
- The enrollment-to-assessment browser run stopped at the instructor enrollment
  review. The fixture left Course empty in its unscoped legacy batch before
  previewing and waited for a button labelled `Confirm 1 enrollments`. The
  preview returned HTTP 200. The fixture correction has not been applied.
- The exact login-to-assessment API test passed on disposable PostgreSQL. The
  full suite was already running at pause. Its runner stops the cluster on exit.
  Check `work/branch-review-postgres-ywtcu00f/tests.txt` for the final result
  before rerunning any completed checks.

On resume, inspect the PostgreSQL result and Git status. Select `BSIT` in the
manual enrollment fixture before `Preview student` in
`skillbridge-frontend/tests/enrollment_assessment_journey_playwright.py`, then
rerun only that browser journey with the local harness. Check the confirmation,
student profile setup, assessment result, and instructor roster before closing
the local rehearsal. Hosted Realtime authorization and timing remain separate.

Source: [backend exchange/publisher](../skillbridge-backend/api/realtime.py),
[post-commit integration](../skillbridge-backend/api/change_events.py),
[client lifecycle](../skillbridge-frontend/src/api/realtimeStream.js),
[SDK adapter](../skillbridge-frontend/src/api/supabaseRealtime.js).
