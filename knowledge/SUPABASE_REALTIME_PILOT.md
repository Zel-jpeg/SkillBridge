# Supabase private Broadcast pilot

Local implementation verified 8 November 2026. This is an opt-in transport experiment in
the [system optimization checklist](SYSTEM_OPTIMIZATION_PLAN.md), with ordinary
sessions continuing to use the existing [SSE and query cache](LIVE_DATA_FRESHNESS.md).
No application records are sent through Broadcast. Django remains responsible
for authentication, authorization, grading, result visibility and placement writes.

## Current acceptance state

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
- The application pilot remains disabled. A dedicated trusted signing private
  key and the receiver-role policy still need hosted verification. The current
  public JWKS exposes an ES256 key; its public entry is not possession of a
  private key suitable for Django token issuance.
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

The next hosted step is a bounded change to the existing SkillBridge Supabase
project. Review the prepared role SQL and its rollback, import the dedicated
signer through **Authentication → JWT Signing Keys**, and activate it with the
previous signing keys retained. Activating it changes the project's default
Auth signing key. Treat import and activation as an explicit owner decision.
Keep all application switches off during this step. A match in public JWKS is
useful for identifying the new key, but the signed private-channel join proves
whether Realtime accepts it. [Supabase signing-key lifecycle](https://supabase.com/docs/guides/auth/signing-keys#lifetime-of-a-signing-key)

After approval, apply only the pilot receiver setup. Verify a signed own-topic
join and a single synthetic message before connecting any SkillBridge session.
If the role or trust checks fail, remove the pilot role and policy with the
teardown script and restore the former current signer if the rotation caused
the issue. Keep existing keys available throughout the verification.

The [hosted probe](../skillbridge-frontend/tests/realtime_hosted_probe.mjs) reads
only the five `SUPABASE_REALTIME_*` process variables for URL, publishable key,
publish key, signer PEM and key ID. It does not load `.env`. After the owner
provides those variables in a private process, run it from the repository root
with `node skillbridge-frontend/tests/realtime_hosted_probe.mjs`. It uses random
topics, sends one dummy event on the normal success path and reports only check
names and statuses. The Data API and Storage checks request no application
records. A timeout or unrecognized denial fails the probe. All eleven assertions
were exercised with a mock transport. Hosted execution awaits activation and the
receiver-role setup.

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

Source: [backend exchange/publisher](../skillbridge-backend/api/realtime.py),
[post-commit integration](../skillbridge-backend/api/change_events.py),
[client lifecycle](../skillbridge-frontend/src/api/realtimeStream.js),
[SDK adapter](../skillbridge-frontend/src/api/supabaseRealtime.js).
