# Local security verification

V03 covers the Django API and browser client with synthetic identities and
disposable databases. It does not certify a hosted release or the configured
Supabase project. The continuous development checklist remains the only task
tracker; this document describes the verified behavior and its limits.

JWT requests now check the current database role, active account, instructor or
student approval, and student enrollment. Revoking access takes effect on existing
tokens. Password changes invalidate signed access and refresh credentials; refresh
cannot extend the fixed seven-day session boundary. The SSE transport separately
checks current permissions before delivering events. Authorization uses database
roles rather than client role claims.

The direct API matrix exercises every private route anonymously, staff routes as
a student, and admin routes as an instructor, preserving the intentionally shared
scoped placement analytics endpoint. Existing assessment, enrollment, catalog,
report and recovery tests cover owned and foreign objects. Delivery and finalized
review exclude answer keys. Student review returns only that student's submitted
answer and correctness; it retains the existing historical review contract.

Placement changes check the placement's recorded batch as well as the requesting
instructor's recommendation/enrollment scope. This includes legacy records linked
to an owned recommendation but recorded in another instructor's batch. Removing,
rejecting, acknowledging or approving that record cannot disclose or overwrite
the foreign snapshot. Admin oversight remains system-wide. Manual assignment
uses an instructor-owned batch and rejects a selected foreign batch. Foreign
current-placement conflicts return a generic conflict without a private snapshot.

New manual assignments and recommendation approvals require an active student.
Restoring the account permits assignment again. Existing archived-student
placements can still be removed, freeing their seats while retaining score and
decision history. Ranking weights, evidence gates and the agreed manual override
contract are unchanged; no historical production records were repaired.

Password login has an IP-based ten-per-minute limit, including requests carrying
an existing valid JWT. Local requests ignore untrusted forwarded IP headers.
Email matching is case-insensitive; unknown identities perform a dummy password
hash and return the same credential error. Existing normalized-email uniqueness
prevents case-colliding identities. Oversized login/refresh inputs are rejected
before hashing/token decoding. Provider verification, domain, role and malformed
identity checks remain covered by the authentication tests.

Django access/request handlers redact credential query parameters and bearer
tokens. Provider/email errors omit recipient addresses, bodies and secrets.
Notification identity fields are HTML-escaped. Dynamic Leaflet labels/popups
escape catalog text; the browser fixture verifies literal text with no injected
elements or executed handlers. React continues to render normal fields as text.

Session browser verification covers real-token renewal, one exchange for twenty
concurrent expired reads, bounded authentication retry, uncertain writes sent
once, expired refresh with owner-only draft retention, and logout during refresh.
Frontend unit tests also verify account/cache changes discard stale responses
and stored data; no authentication-storage redesign is introduced.

Evidence under `work/defense_audit/`:

- `v03-targets-before.txt`: three reproduced placement failures before fixes.
- `v03-suggestion-before.txt`: adjacent foreign suggestion overwrite reproduced.
- `v03-postgres-final.txt`: final full PostgreSQL result, including named
  permission, authentication, placement, report and concurrency tests.
- `v03-role-matrix.txt`: nineteen security tests passed before the final extra
  legacy-suggestion test; the final full run includes that extra test.
- `v03-session-browser.txt`: six real-token session browser groups passed.
- `v03-map-resumed.txt`: catalog markup remains literal; zero executed markup.
- `v03-frontend-unit.txt`: 116 frontend tests passed.
- `v03-check.txt` and `v03-model-drift-final.txt`: Django check and no model drift.
- E02 resumed lint/build and company-map evidence cover the same frontend source.

Intermediate harness failures are retained: a nonexistent recovery module name,
a browser click behind an open modal, a sandbox-denied local database connection,
and an attempted case-collision fixture rejected by the existing unique index.
The collision was not an authentication defect and required no source change.
The initial PostgreSQL model-drift check warned that its disposable database did
not exist; the final drift check used isolated in-memory settings, and the full
PostgreSQL tests applied all migrations successfully.

Hosted acceptance still needs actual TLS/CORS/CSP, provider settings, proxy hop
count, access-log redaction outside Django, multi-worker rate-limit behavior,
database API exposure/permissions, and Storage policy verification. Supabase's
[Storage access-control documentation](https://supabase.com/docs/guides/storage/security/access-control)
explains that service keys bypass Storage RLS: this application's key stays in
the server environment. A local Django permission test does not establish RLS or
Data API safety in the hosted project. The current
[Supabase changelog](https://supabase.com/changelog) and official Storage docs were
reviewed without accessing a project; the Markdown changelog endpoint was not
readable through the available fetcher, so its HTML index was used. No provider
configuration, live query, external message or deployment occurred.
