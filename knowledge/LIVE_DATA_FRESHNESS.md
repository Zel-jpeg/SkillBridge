# Live data freshness

20 October analytics filter refinement: date ranges apply together after local
validation. Analytics keeps its last successful authorized report visible while a
new filter URL fetches, then replaces it on success. Transient failures show a
warning and retry while preserving the old report with its actual scope; exports
remain disabled until the requested result succeeds. Access loss/session cleanup
clears retained records. This uses the shared query store and introduces no new
poller or backend recalculation. See [analytics implementation](ANALYTICS_IMPLEMENTATION.md).

20 October staff analytics follow-up: `management/analytics/` uses the existing
cache/SSE/visible refresh. Cohort, evidence, catalog, configuration and placement
changes invalidate analytics variants; frontend batch-ID pruning is bypassed for
this endpoint because capacity is shared. Existing server event audiences still
apply. Displayed data refreshes; CSV/PDF exports retain the selected loaded snapshot.
See [analytics implementation](ANALYTICS_IMPLEMENTATION.md).

20 October admin management follow-up: ownership changes retain before/after
recipient scopes and invalidate both owners' access. The `management` topic
refreshes observed admin action history; account changes refresh eligible
instructor choices. New actions reuse the existing cache and committed change
pipeline. Reports remain snapshots. See [implementation](ADMIN_MANAGEMENT_IMPLEMENTATION.md).

Implemented and locally verified on 2026-10-16. No deployment or production
database operations were performed.

## Audit and boundaries

The audit started with AGENTS.md and PROJECT_OVERVIEW.md, a clean Git status,
and a first-party file inventory. Application source, route definitions, models,
serializers, validation, scoring/combined-evidence helpers, enrollment import,
tests, Procfile, dependency manifests, Vite/Vercel/Django configuration and
relevant knowledge/reference documents were searched. Dependencies, generated
builds, binary references, datasets containing records and dotenv files were
excluded from content inspection. Current code took precedence over old notes.

Confirmed problems:

- The previous stream compared a few aggregate counts every ten seconds.
  Metadata edits, retakes, availability, question changes and many deletions
  could leave those counts unchanged. Placement timestamps covered only part
  of the remaining changes.
- Instructor aggregates were system-wide; payload invalidation used exact URL
  strings. Students had no stream. Not every protected route started a stream.
- Cache invalidation removed in-flight deduplication. Multiple listeners could
  issue overlapping requests; a newer invalidation needed a serialized retry.
- Some selections retained removed records. Company editing had a separate
  optimistic copy that could mask a fresh shared-cache response.
- Generated reports, taxonomy checks and comparisons had no staleness marker.
  NLP text and the admin authorized question preview were separate GET state.
- Admin instructor editing/archiving/rejection and admin student archiving are
  currently browser-only actions in useAdminUsers. There are no corresponding
  persistence endpoints. This change does not invent those business operations
  or imply that they now synchronize across accounts.

The patch does not change scoring, ranking weights, required-completion gates,
enrollment/retake semantics, placement evidence snapshots, or answer access.

## Change-to-view coverage

All URLs below are under `/api/`. Query parameters are retained during refetch;
matching uses the endpoint path and optional authorized batch/student scope.
Administrators receive management invalidations; instructors receive those for
their affected batches/students; students receive their own private changes.
Shared catalog changes contain no student/batch identifiers.

| Change and mutation boundary | Existing derived work before publication | Consuming GET families and visible views |
| --- | --- | --- |
| Student creation/import/enrollment: `instructor/batches/:id/enroll/`; preview is read-only | Per-row enrollment transactions and existing notification registration finish; one publication for the whole confirmation | `admin/users/`, `admin/stats/`, `instructor/batches/`, `instructor/batches/:id/students/`, staff student recommendations, instructor companies, placements, student `students/me/`, `assessments/`, results; user lists, rosters, dashboard counts and open student detail |
| Student profile: `students/me/profile/`; Google identity update: `auth/google/`; registration: `auth/register-role/` | Existing profile save and eligible combined recalculation finish | User identity, authorized rosters/details, dashboard recommendations, student result/catalog displays, saved NLP text; registration's admin user list |
| Student removal: `instructor/students/:id/` | Existing queryset enrollment deletion finishes | Capture former recipients before deletion; clear removed read-only roster/dashboard selection; remaining enrollment chooses current batch through existing endpoints; last-enrollment removal terminates student subscription |
| Instructor creation/approval: `admin/instructors/`, `admin/instructors/:id/approve/` | Existing account writes finish | Admin users/stats, pending detail and authorized identity; pending detail closes when approval removes the record from the pending list |
| Instructor editing/removal/rejection and admin student archive | No persisted operation exists | Existing local-only behavior remains; not a cross-account synchronization claim |
| Batch creation/archive/unarchive: `instructor/batches/`, `.../:id/archive/`, `.../:id/unarchive/` | Existing enrolled-student recalculation finishes after batch status save | Batch choices, authorized dynamic rosters, assessment lists, student current batch/progress/results, staff dashboards/reports/placements |
| Assessment creation and metadata/publication/closure/availability settings: `instructor/assessments/`, `.../:id/` | Existing publication validation and required/inclusion recalculation finish | Student assessment list/actions and identity/progress; staff assessment counts/lists/rosters and authorized question preview; result/placement dependencies; report snapshot staleness |
| Question add/edit/delete: `instructor/assessments/:id/questions/add/`, `instructor/questions/:id/` | Existing attempt lock, validation and nested writes finish | Staff assessment lists and authorized `instructor/assessments/:id/questions/` preview; new implicitly created categories additionally notify all authorized taxonomy consumers |
| Start/retake start, submit, integrity stop: `assessments/:id/start/`, `submit/`, `stop/` | Inner attempt transaction, assessment profile and **later** combined recalculation/ranking all finish | Staff attempts/completion/integrity counts, rosters, dashboards, relevant result/review variants and NLP text; student's list/progress/result state |
| Retake approval/revocation: `instructor/students/:id/retake/` | Existing exact-assessment permission checks and flag update finish | Open student's assessment actions; staff assessment counters, roster detail and dashboards; approved retakes still replace scores only when started/submitted under existing rules |
| Combined competency/recommendations: successful mutation above, explicit `admin/rerun-recommendations/`, legacy `ensure_combined` backfill | Publish after full `recalculate_combined`; outer operations suppress helper publications and coalesce the rerun | Staff recommendation lists, rosters, catalogs/suggestions, dashboards/reports, student combined/individual/review results and NLP preview; existing saved profile `generated_at`, `active_model`, `model_used` retain their meanings |
| Companies/positions/capacity/requirements: admin company/position endpoints and `instructor/companies/:id/` | Existing nested saves/deletes; position creation's existing best-effort rerun finishes | All authorized catalogs, recommendation display labels/tags, placement suggestions/history/capacity, analytics/dashboard/report data, open company/placement detail, position NLP text |
| Skill categories: `categories/`, `admin/skills/`, `admin/skills/:id/`, implicit creation in question operations | Existing category writes/cascades finish | Category choices, affected assessment/catalog/result/roster displays and NLP previews; taxonomy/comparison snapshots marked stale |
| Placement approval/rejection/removal/manual assignment: `placements/approve/`, `reject/`, `remove/`, `manual-assign/` | Existing locks, capacity/access validation, decision save and evidence copy finish | `placements/` and `placements/suggestions/` with all filter/limit/history variants; staff rosters/dashboard/analytics and affected student's finalized placement/result; unrelated staff receive only shared-capacity invalidation |
| NLP configuration: `admin/nlp-configuration/` | Config save finishes; **no rerun is added** | Live staff configuration display; comparison snapshot staleness. Existing generated results continue describing the model actually used |
| Dashboard/report GETs | Read-only aggregate queries; existing one-student legacy backfill remains | Admin stats/reports/placement analytics and staff/student live displays refetch when their dependencies change |

Authorization remains enforced by every consuming endpoint. Events are hints,
not authorization grants, recalculation commands, or proof of a successful NLP
rerun. Existing best-effort/partial rerun error reporting is preserved.

## Transport and commit boundaries

`api/change_events.py` wraps explicit mutation endpoints. It captures recipient
scope before and after the operation, including queryset deletions and bulk
imports. It registers `transaction.on_commit(..., robust=True)` **after** the
view returns a successful response. Thus an on-commit callback in an inner
attempt transaction cannot notify before later profile/ranking work. An outer
transaction can still defer/discard the callback. Rejected responses do not
publish. Successful no-op/idempotent mutations may send a harmless invalidation.

Standalone combined recalculation, including GET backfill, notifies after its
final update. A ContextVar suppresses those helper publications during a larger
endpoint operation. It stores operation metadata only, not the backend transport.

The callback bulk-inserts `ChangeEvent` rows, one per recipient, through the
existing database. Streams read indexed `(recipient_id, id)` ranges about once
per second, coalescing up to 500 queued records. Payloads contain bounded topic
and authorized ID arrays, never student records, answers, grading keys or tokens.
Large scopes are omitted in favor of broader topic invalidation within the
recipient's endpoint authorization. No per-row import refresh is sent.

This replaces count snapshots as primary detection. It is a database event log
with short reads, not an in-memory bus or a second frontend cache. It works
across processes that use the same PostgreSQL database. It does not use
LISTEN/NOTIFY: PostgreSQL LISTEN is session state, while deployment references
include a pooler and do not establish session affinity. The installed driver is
psycopg2-binary; no cooperative notification adapter is configured. Ordinary
short ORM queries use the existing connection path without a dedicated listening
session or another dependency. Queries remain synchronous; their production
load/latency under gevent has **not** been measured.

The current Procfile starts two gevent workers without preload. Idle sleeps are
cooperative under that worker class. Each stream releases Django database
connections before sleeping/yielding and on disconnect. No transaction or
connection is held open for the lifetime of a subscription. This trades an
indexed read/connection cycle per visible stream per second for pooler-compatible
delivery; production connection/query throughput needs load verification before
increasing subscription counts.

Publication/scope lookup errors are logged without converting a committed
business response into a failure. There is an intentional commit-to-publication
gap (for example process death after commit). The log is not a transactional
business outbox and does not promise exactly-once or ordered commit delivery.
Concurrent insert transaction IDs can become visible out of sequence. These
cases converge through the explicit recovery strategy below.

References: [PostgreSQL LISTEN](https://www.postgresql.org/docs/current/sql-listen.html),
[Django on-commit behavior](https://docs.djangoproject.com/en/6.0/topics/db/transactions/#performing-actions-after-commit).

## Recovery, identity and caching

Session renewal now uses shared coordinated refresh and SSE preflight recovery;
see [authentication and recovery](AUTHENTICATION_AND_RECOVERY.md). Token renewal
keeps the same authenticated session mounted, while logout/new sign-in changes
its session ID. This supersedes the earlier assumption that access expiry always
immediately requires signing in again. Revoked refresh/permissions remain terminal.

- Every protected entry point starts the shared managed stream, including setup,
  assessment-taking and direct navigation to reports/placements.
- A connection is keyed to role/user/token. Duplicate ensures share one stream
  and preflight. Logout, expiry and identity changes cancel sources, listeners,
  coalescing timers, watchdogs and retry timers. Obsolete preflight results and
  old-source messages cannot reopen a previous identity's connection.
- Axios preflights the role's event endpoint with `check=1`. This exposes 401/403
  that EventSource otherwise hides. The server requires active accounts and
  approved instructors/students, and an enrollment for students. Streams recheck
  token expiry and current authorization before changes and every heartbeat.
  Revocation is terminal; database outages use transient recovery.
- Heartbeats arrive every 15 seconds; the client reconnects after 45 seconds
  without a message. Retry delays are bounded at 1, 2, 4, 8, 16, 30 seconds.
  Hidden tabs close their stream and pause background requests. Return reconnects.
- Every connection announces resynchronization. Clients invalidate all known
  live query families, refresh mounted visible queries, and mark persisted
  unmounted entries stale. Historical log replay/Last-Event-ID is not required.
- Mounted visible queries retain the existing approximately 30-second fallback
  and tab/focus return checks. This covers failed publication and scheduled
  assessment opening/due dates without a mutation. Time-based availability
  therefore has a fallback-interval guarantee, not a 1–3 second claim.
- Topics match paths, dynamic IDs and parameter variants; refetch uses each
  query's original URL/parameters. Scoped batch/student variants stay untouched
  when unrelated. Reconnection deliberately refreshes all active live data.
- A newer invalidation during a GET invalidates its response version and queues
  one serialized follow-up. Multiple mounted consumers share that request.
  Identity/cache epochs also prevent older responses from publishing.
- Network/5xx failures retain last-good data. Definitive 403/404 removes the
  affected cached data and informs mounted consumers, clearing inaccessible
  detail/results. Filters and scroll are preserved; pagination clamps only when
  a page is no longer valid. Read-only selections reconcile against full source
  lists rather than filtered lists.

## Live views, drafts and snapshots

| Display | Automatic behavior |
| --- | --- |
| Admin/instructor dashboards, user/pending lists, batch choices/rosters, assessment lists, catalogs, placement suggestions/history and live analytics | Refetch relevant mounted shared-cache queries; invalidated unmounted variants refresh on next use |
| Student identity/dashboard, assessment availability/retake list, individual result/review and final combined result | Scoped student stream plus existing visible-page fallback; backend eligibility remains authoritative |
| Open student/company/placement read-only detail and staff authorized question/NLP text preview | Reconcile refreshed records; clear missing/inaccessible selections; cheap read-only preview GETs use the existing cache |
| Student dashboard/result map pins and popups | Reconcile changed markers and shared profile coordinates; retain map instance and current viewport after initial framing |
| Metadata/question/company/profile drafts, import review and action remarks | Keep local edits; refreshed source data does not replace drafts; saving still uses existing backend validation |
| Active assessment | Only list/progress data revalidates; no event invokes start/submit/stop or resets answers, question order, timer, fullscreen/integrity monitoring |
| Generated assessment report | Retains payload, filters and generated-at meaning; shows a stale indication and Regenerate report action |
| Taxonomy check and NLP comparison | Retain explicit results and timestamps; mark possibly stale and invite explicit rerun; never automatically repeat diagnostics |
| Downloaded CSV/PDF/XLSX and saved placement assignment evidence | Intentional snapshots; no regeneration or rewriting |

Snapshots are also conservatively marked possibly stale on return, resync, and
after at least 30 seconds while visible. This covers missing notifications
without automatically rerunning expensive work. A stale indication does not
assert that scores were recalculated.

## Configuration and local verification

Apply the new `0013_changeevent` migration during the normal approved release.
Keep the existing Gunicorn/gevent deployment; no service or dependency addition
is needed. Proxies must stream `text/event-stream`, honor disabled buffering,
and allow idle periods longer than the 15-second heartbeat. EventSource retains
the existing query-token authentication; redact event URL query strings from
access/proxy logs and use HTTPS. Do not add worker preload without reviewing
gevent patch initialization and Django connection isolation.

Run `python manage.py prune_change_events` regularly (for example daily) through
the existing operations process. It removes metadata older than one day. No
scheduler or external service was provisioned. The stream does not depend on
retaining history because every new connection resynchronizes.

Safe test commands, from the backend:

```powershell
$env:PYTHON_DOTENV_DISABLED = '1'
$env:SECRET_KEY = 'synthetic-local-test-key-not-for-deployment'
$env:DEBUG = 'True'
venv/Scripts/python.exe manage.py check --settings=core.test_settings
venv/Scripts/python.exe manage.py makemigrations --check --dry-run --settings=core.test_settings
venv/Scripts/python.exe manage.py test api.test_change_events api.tests api.test_multiple_assessments api.test_combined_competency api.test_enrollment_import api.test_management_step4 api.test_nlp_diagnostics api.test_nlp_evaluation --settings=core.test_settings --noinput
```

The existing SQLite test settings isolate these tests from normal DB credentials.
For the PostgreSQL independent-process test, use `core.sse_postgres_test_settings`
with explicit `SB_TEST_DB_NAME` (must start `test_`), `SB_TEST_DB_USER`, and optional
`SB_TEST_DB_PASSWORD`, `SB_TEST_DB_HOST`, `SB_TEST_DB_PORT`. This is a **disposable
database**: Django creates/drops that name. These settings never reuse `DB_*`
variables and disable dotenv loading. Run `api.test_change_events` with that
settings module only after a dedicated test database/server is supplied.

From the frontend, run Node's cache/refresh/stream/invalidation tests, lint and
build. On this host the npm wrapper was broken, so the installed CLI was invoked
as `node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run lint`
and the corresponding `run build`, without changing dependencies/manifests.

Browser checks use `tests/freshness_server.py` and
`tests/freshness_playwright.py`. The former creates a unique local SQLite file,
disables dotenv, mocks all email delivery, and seeds synthetic data. Use the
backend virtualenv Python in two local terminals, and run Vite on 127.0.0.1:5178
with `VITE_API_URL=http://127.0.0.1:8018`. The browser script uses headless Chrome
and three isolated contexts, blocks nonlocal requests, and saves ignored artifacts
under `tests/artifacts/freshness/`. SSE is intentionally long-lived, so readiness
uses the resync event and rendered controls rather than network-idle.
Python Playwright was installed only into the existing ignored local virtualenv;
production dependency manifests were not changed. The testing skill's helper was
tried, but its Windows shell/relative-path startup failed; servers were managed
directly and stopped after verification.

Checks actually completed:

| Check | Result |
| --- | --- |
| Focused frontend cache/refresh/invalidation/stream/auth/assessment-action tests | 21 passed |
| Django assessment, combined evidence, management, enrollment, NLP and new event tests | 120 run: 119 passed, 1 PostgreSQL-only subprocess test skipped |
| Django system check and migration consistency | No issues; no missing migrations |
| Frontend lint | Passed, zero errors and five retained warnings |
| Frontend production build | Passed; existing XLSX import/chunk-size warnings |
| Synthetic real API/browser workflow suite | 18 checks passed, zero page errors |
| Diff whitespace and local documentation links | Passed |

Observed complete browser run (2026-10-16): 18 checks passed, zero page errors.
Timing is **completed mutation HTTP response to observed DOM**, one sample per
scenario, on local SQLite/runserver/Vite/headless Chrome. It does not measure the
exact final database commit timestamp, and is not evidence of PostgreSQL,
Gunicorn/gevent, proxy, WAN, or production-load performance.

| Observed update | Milliseconds |
| --- | ---: |
| Student UI submission → both open staff dashboards | 875 |
| Retake → open student list | 1389 |
| Publication → open student list | 851 |
| Profile → open student detail | 868 |
| Company edit → open staff/placement/student views | 1152 |
| Capacity → open placement suggestions | 1357 |
| Manual placement → open student result | 341 |
| Offline mutation → reconnect convergence | 148 |
| Enrollment/import → open instructor dashboard | 1435 |
| Removal → detail closes and student stream terminates | 380 |
| Archive → instructor dashboard reconciles | 883 |

Other browser assertions covered active attempt preservation, unsaved metadata,
report snapshot timestamp/staleness, maximum one live stream per page, and logout
cleanup. Two further checks exercised production map effects using an instrumented
Leaflet stub, covering marker/popup reconciliation and live student/company
coordinates without recreating/reframing the map. Remote tiles and actual Leaflet
rendering were blocked and were not verified. Fullscreen preservation on desktop and production connection capacity
were not exercised. Backend PostgreSQL cross-process delivery remains explicitly
unverified; its test skips on SQLite. Do not treat the observed local sub-1.5s
response-to-DOM times as proof of the 1–3s production commit-to-display target.

## Changed files and reasons

Final diff review: all 43 changed first-party files have a reason below. The
initial working tree was clean. No dependency manifests, deployment configuration,
scoring/ranking formula, completion/enrollment/retake permission logic, skill
packages, or unrelated styling were changed. The combined helper's only changes
are post-completion notification calls. No production services/data, email sends,
or deployments were used. Local test services were stopped after verification.

Paths are repository-relative; only freshness implementation, regression tests,
isolated verification setup and directly relevant documentation changed.

| File | Reason |
| --- | --- |
| `skillbridge-backend/api/change_events.py` | Explicit commit-boundary publication, scope capture, bulk coalescing and failure isolation |
| `skillbridge-backend/api/models.py` | Recipient-scoped event metadata model/index |
| `skillbridge-backend/api/migrations/0013_changeevent.py` | Create the shared transport table/index |
| `skillbridge-backend/api/views.py` | Decorate actual mutation boundaries; mark implicitly created shared categories |
| `skillbridge-backend/api/combined_competency.py` | Notify after standalone/backfill recalculation; no algorithm change |
| `skillbridge-backend/api/sse.py` | Replace count polling with scoped committed event delivery, authorization, heartbeat/resync and connection cleanup |
| `skillbridge-backend/api/urls.py` | Student event route |
| `skillbridge-backend/api/management/commands/prune_change_events.py` | Bounded metadata retention through existing operations tooling |
| `skillbridge-backend/api/test_change_events.py` | Commit/rollback, scope, bulk, failure, subscriber, resync/revocation and PostgreSQL subprocess tests |
| `skillbridge-backend/api/test_enrollment_import.py` | Account for the new publication callback while retaining the email assertion |
| `skillbridge-backend/core/sse_postgres_test_settings.py` | Opt-in dedicated PostgreSQL verification without normal credentials |
| `skillbridge-frontend/src/api/cacheStore.js` | Serialize invalidated in-flight GETs; enumerate persisted queries and clear inaccessible data |
| `skillbridge-frontend/src/api/cacheStore.test.mjs` | In-flight invalidation and access-loss regression cases |
| `skillbridge-frontend/src/api/queryInvalidation.js` | One topic/path/query-variant dependency contract |
| `skillbridge-frontend/src/api/queryInvalidation.test.mjs` | Dynamic scopes, variants, persistence, mounted/unmounted and unrelated-query coverage |
| `skillbridge-frontend/src/api/eventStream.js` | Testable identity/visibility/reconnect/heartbeat/coalescing lifecycle |
| `skillbridge-frontend/src/api/eventStream.test.mjs` | Lifecycle, deduplication, offline, identity, expiry and timer tests |
| `skillbridge-frontend/src/api/axios.js` | Central authenticated 401 handling with obsolete-token guard |
| `skillbridge-frontend/src/hooks/useApi.js` | Apply the contract through the existing cache; access-loss status and expiry cleanup |
| `skillbridge-frontend/src/hooks/useSSE.js` | Bind one managed stream to current role/user/token and browser events |
| `skillbridge-frontend/src/router/PrivateRoute.jsx` | Start/clean up streams on every protected entry point |
| `skillbridge-frontend/src/context/SessionContext.jsx` | Stop requests/stream and clear cache on terminal authorization failure |
| `skillbridge-frontend/src/hooks/useSnapshotFreshness.js` | Staleness metadata without automatic snapshot regeneration |
| `skillbridge-frontend/src/components/AssessmentReportPanel.jsx` | Preserve generated reports and expose explicit regeneration |
| `skillbridge-frontend/src/components/admin/TaxonomyQuality.jsx` | Mark explicit taxonomy checks possibly stale |
| `skillbridge-frontend/src/components/admin/NlpModelComparison.jsx` | Mark explicit comparisons possibly stale without rerunning them |
| `skillbridge-frontend/src/components/NlpTextPreview.jsx` | Cheap read-only preview GETs join the existing cache |
| `skillbridge-frontend/src/components/layout/ProfileMenu.jsx` | Staff identity reads use the shared authenticated query too |
| `skillbridge-frontend/src/hooks/admin/useAdminDashboard.js` | Clamp pagination after live list shrinkage |
| `skillbridge-frontend/src/hooks/admin/useAdminUsers.js` | Reconcile/clear user and pending selections; clamp pagination |
| `skillbridge-frontend/src/hooks/instructor/useEnrolledStudents.js` | Clear inaccessible rosters/selections, remove duplicate SSE refetch listener, clamp pagination |
| `skillbridge-frontend/src/hooks/instructor/useInstructorDashboard.js` | Clear missing detail selection and clamp pagination |
| `skillbridge-frontend/src/hooks/instructor/useInstructorCompanies.js` | Publish optimistic data into the existing cache instead of masking it with a separate copy |
| `skillbridge-frontend/src/pages/instructor/InstructorCompanies.jsx` | Reconcile detail against full source, clear removed company and preserve filters |
| `skillbridge-frontend/src/pages/admin/AdminAssessments.jsx` | Live read-only header/roster/question preview while keeping metadata draft separate |
| `skillbridge-frontend/src/pages/placements/PlacementsPage.jsx` | Resolve open read-only placement detail from fresh suggestions |
| `skillbridge-frontend/src/hooks/student/useStudentResults.js` | Source location from the live shared profile instead of a permanent local-storage memo |
| `skillbridge-frontend/src/pages/student/StudentDashboard.jsx` | Refresh map markers while preserving the map/viewport and surviving popup selection |
| `skillbridge-frontend/src/pages/student/StudentResults.jsx` | Refresh map markers and avoid remounting the map for live recommendation changes |
| `skillbridge-frontend/tests/freshness_server.py` | Isolated synthetic local API and no-email fixtures |
| `skillbridge-frontend/tests/freshness_playwright.py` | Real stream/browser convergence, draft/attempt/snapshot and cleanup checks |
| `knowledge/PROJECT_OVERVIEW.md` | Replace outdated admin/instructor-only/count freshness description |
| `knowledge/LIVE_DATA_FRESHNESS.md` | Audit, coverage map, transport rationale, behavior/configuration, verification limits and per-file reasons |
