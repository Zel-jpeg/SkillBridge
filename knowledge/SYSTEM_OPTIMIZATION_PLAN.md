# SkillBridge system optimization and Realtime plan

Prepared 6 November 2026 from the current `main` checkout. The source review and
frontend build baseline are complete. The current review adds a synthetic
PostgreSQL read profile and production log samples. The first local optimization
is described below. The private WebSocket pilot is implemented locally and
disabled by default. Hosted application-user acceptance remains pending. The plan covers browser
performance, API and database work, assessment and placement operations, external
providers, hosting and recovery. The screenshot shows the Supabase Realtime
Inspector for the production project. Prefer a separate project for full load
and failure testing. A bounded, synthetic Broadcast test can use the existing
project under the current-project pilot limits below.

Updated 7 November 2026 to include UI motion from the user's animation reference.
The motion work below is planned. Its durations and effect choices are proposed
starting values to verify against current components and measured performance.

Use the [implementation checklist](#implementation-checklist) to track work in
order. The first analytics optimization and notification animation have passed
local checks. Hosted acceptance, the remaining animations and the private
Supabase WebSocket pilot have separate completion checks.

## Current performance review · 7 November 2026

The integrated application source is at `4d08501`. Railway reports its active
web deployment at `181b4d6`, with the web service and email worker online. The
deployed API runs in California (`us-west2`). The connected Supabase project
runs PostgreSQL 17.6 in Tokyo (`ap-northeast-1`). The separation makes the number
of sequential SQL round trips and connection handshakes especially relevant.
Measure their contribution with a matched staging run before moving a service.
[Railway region mapping](https://docs.railway.com/networking/edge-networking)
· [Supabase region mapping](https://supabase.com/docs/guides/platform/regions)

Read-only Railway proxy log samples from the active deployment confirm that some
API reads take several seconds. These are successful GETs on each exact path.
The sample is capped by the connector, combines scopes and cache states, and
does not include client rendering or isolate application and network time.

| GET | HTTP 200 samples | p50 | p95 | Other observed statuses |
| --- | ---: | ---: | ---: | --- |
| `/api/management/analytics/` | 148 | 3.99 s | 4.25 s | 3 × 499 |
| `/api/instructor/students/recommendations/` | 64 | 3.13 s | 3.39 s | 2 × 499 |
| `/api/student/results/combined/` | 83 | 4.30 s | 5.57 s | 4 × 499, 1 × 401 |

These proxy samples describe the deployed revision. The local branch includes
subsequent organization, dashboard, placement and navigation changes. Use a
staging trace to establish timings for that revision. [Railway timing fields](https://docs.railway.com/deployments/troubleshooting/slow-deployments)

The current admin dashboard prepares analytics and organization options at
sign-in. Its own analytics query waits for the options to validate scope. The
staff bell keeps the default full analytics query mounted even when closed.
An unfiltered dashboard can share that response. A scoped dashboard or report
can keep both the default and filtered analytics requests active. The instructor
dashboard also prepares student recommendations, and student sign-in prepares
profile, assessments and combined results. Keep the useful initial content fast
by measuring which data each view needs before rendering. [Dashboard preparation](../skillbridge-frontend/src/api/prefetch.js)
· [Admin dashboard](../skillbridge-frontend/src/pages/admin/AdminDashboard.jsx)
· [Staff notifications](../skillbridge-frontend/src/components/layout/NotificationMenu.jsx)

### Current source profile on isolated PostgreSQL

Measured the actual Django endpoints with JWT-authenticated synthetic users on
disposable localhost PostgreSQL 17.11. Each row uses ten warm, serial in-process
requests after three warmups, with no browser, proxy or remote database. The
cohorts have two assessments per batch, partial/stopped attempts and no finalized
recommendations. The profile measures reads for this fixture. Request time
includes query execution and response rendering, and response sizes are raw JSON.

| Admin analytics workload | SQL statements per request | Raw JSON | Local p50 | Local p95 |
| --- | ---: | ---: | ---: | ---: |
| School-wide, 20 students in four batches | 44 | 35.9 kB | 143 ms | 169 ms |
| School-wide, 200 students in four batches | 44 | 305.7 kB | 173 ms | 204 ms |
| School-wide, 200 students in 20 batches | 140 | 320.0 kB | 416 ms | 607 ms |
| One program within the 200-student, 20-batch fixture | 52 | 83.4 kB | 179 ms | 230 ms |

At a fixed 200 students, adding 16 populated batches added 96 SQL statements.
At four batches, the tenfold increase in students mainly grew the payload.
Other reads for the 200-student, four-batch fixture used 22 statements for
instructor analytics, 15 for instructor dashboard recommendations, and 18, 15
and 15 for student profile, assessments and locked combined results respectively.
The latest Vite build reports 121.32 kB gzipped for the main JS chunk and
132.35 kB for the reports route chunk. Use a browser trace to decide how much
bundle work is worth doing. Local read evidence is stored under ignored
`work/optimization-review-postgres-q5hbsxr0/read-profile.json`.

Start with a small dashboard/reminders read and benchmark it alongside the
existing full report. Keep badge counts, email progress toasts, admin attention
items and report totals sourced from the same authorized calculations. Measure
school-wide analytics by populated batches as well as students. The current API
runs management-state queries separately for each populated batch. Batch those
reads across authorized batches where the evidence rules permit it. Trace student
combined results separately for locked, finalized and legacy recovery cases.
A legacy recovery request may trigger scoring/ranking work. Compare the same
staging revision and fixture from California and an available Asia-Pacific
Railway region to isolate the cost of the network path. [Analytics implementation](../skillbridge-backend/api/analytics.py)
· [Combined competency recovery](../skillbridge-backend/api/combined_competency.py)

### Realtime decision after inspecting the connected project

The connected project exposes `realtime.send(jsonb,text,text,boolean)`. The
database catalog shows zero Django `api_` tables in the `supabase_realtime`
publication, zero policies on `realtime.messages`, and an existing
`(recipient_id, id)` event cursor index. Aggregate PostgreSQL statement statistics
show 59,450 matching cursor polls and 0.781 s of accumulated database execution
time for those statements. This is a cumulative sample with a global stats reset
in August. It measures database execution and excludes network, connection
setup and worker overhead. The evidence supports reducing round trips and
profiling fresh loads before choosing a new index or transport.

Keep private Supabase Broadcast as the staging WebSocket candidate. Compare its
commit-to-visible delay, event volume, GET volume, proxy latency and database
connections against a matched SSE baseline. Send only a recipient-specific
invalidation hint and use normal Django GETs to retrieve data. Keep the relay on
the application event table or in a separate publisher, since Supabase protects
the `realtime` schema from custom objects while allowing policies on its messages
table. A relay through `realtime.send` also needs an active daily message partition.
Test a missing partition, quota limits and provider outage with successful writes
and working refresh fallback. [Protected schema changelog](https://supabase.com/changelog/realtime-schema-locked-down-against-modification)
· [Database Broadcast and partitions](https://supabase.com/docs/guides/realtime/broadcast)

Gate the pilot on an isolated, short-lived token exchange that grants receive
access to exactly one opaque topic. Supabase caches authorization on open channels.
Verify revocation while connected and block further deliveries to ineligible
recipients at publish time. Use the publishable key in the browser, keep privileged
credentials server-side, and prove the token cannot read application tables or
private Storage objects or publish client messages. Match SSE freshness on
reconnect by revalidating affected reads. [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization#updating-rls-policies)
· [Supabase JWT trust](https://supabase.com/docs/guides/auth/jwts#using-custom-or-third-party-jwts)

## Baseline before the first optimization

| Area | Finding | What to verify next |
| --- | --- | --- |
| Staff first load and background reads | The dashboard and closed notification bell both subscribe to `/api/management/analytics/`. The shared cache deduplicates identical in-flight GETs. The API still builds student detail, assessments, history, charts, capacity, report filters and email data. The bell keeps that query mounted on other authenticated staff routes. | Measure server time, query count and bytes on dashboards, lists and unrelated staff routes. Separate the first usable card from complete chart data. |
| Student first load | Sign-in already prepares the dashboard bundle and three essential GETs in parallel, with a 1.5-second handoff cap. Combined results can run a one-student legacy backfill when eligible evidence exists and a saved profile needs repair. That work can reach recommendation generation. | Compare pending, finalized and legacy-backfill students. Break out database, model initialization, ranking and render time. |
| Live updates | Each visible SSE session checks its indexed recipient event log about once a second and releases database connections between reads. A separate 30-second visible-page refresh and focus recovery can re-fetch mounted queries. The client already coalesces event bursts. At 100 continuously visible streams, the loop implies roughly 100 event-log reads per second before heartbeats, scoped checks or page GETs. | Measure with equal HTTP concurrency both with and without streams. Count the actual checks, connection churn, reconnects and resulting GETs per mutation. The 100-stream figure is an estimate from the loop. |
| Browser work | Routes already load lazily. In the current production build the main JavaScript chunk is 119.59 kB gzipped and the main CSS is 26.23 kB gzipped. The files directly referenced by the entry HTML total about 165 kB gzipped before route code, images and API responses. The separate reports route chunk is 130.75 kB gzipped. | Trace what is fetched and executed per route on a phone, including charts, maps, export modules and provider calls. Build sizes are static evidence. |

Source entry points include the [staff bell](../skillbridge-frontend/src/components/layout/NotificationMenu.jsx),
[dashboard overview](../skillbridge-frontend/src/components/dashboard/DashboardOverview.jsx),
[analytics API](../skillbridge-backend/api/analytics.py),
[dashboard preparation](DASHBOARD_FIRST_LOADING.md),
[combined-result recovery](../skillbridge-backend/api/combined_competency.py),
[SSE delivery](../skillbridge-backend/api/sse.py) and
[query refresh](../skillbridge-frontend/src/api/queryRefresh.js).

The October local PostgreSQL benchmark used 200 synthetic students, eight positions,
two 30-question assessments and 20 concurrent users. It reported p95 of 0.298 s
for warm student results, 1.674 s for results during 20 open streams and concurrent
reads, and 3.628 s for concurrent submits. The warm-results and open-stream
samples used different read concurrency, so their difference cannot isolate the
cost of SSE. The 11.801 s cold results/model timing was one sample. These are
historical local figures. [Benchmark evidence and limitations](PERFORMANCE_VERIFICATION.md)

The 30 October isolated Railway test finished the ten-student workflow after
recovering from two submit-time HTTP 502s. A later test-only keepalive diagnostic
recorded zero errors across 100 result reads, but p95 was 2.803 s and the maximum
was 12.472 s. The experiment did not establish a cause for either 502. It used an
older revision, a separate PostgreSQL service and no hosted browser benchmark.
Reproduce the long tail and compare one hosting variable at a time before
increasing concurrency. [Hosted test evidence](HOSTED_TEST_RESULTS_2026_10_30.md)

## Implementation sequence

1. **Measure the current version.** Capture cold sign-in to first usable dashboard,
   warm navigation, filter/page changes, assessment submit/results and cross-account
   update latency. Cover admin, instructor and student on desktop and a mobile
   network profile. Record p50/p95, sample count, failures, request count and bytes,
   browser render time, Django time, database query count/time and response size.
   For hosted diagnosis, identify the actual deployed revision, Railway and Supabase
   regions, runtime, pooler mode and connection usage. Separate cold service wakeup,
   API queueing, database/connect time, response download and browser rendering.
   Use synthetic role accounts in staging for authenticated traces and load. Keep
   only timing and aggregate metadata in shared reports. Reuse the read-only
   [database performance report](DATABASE_IMPROVEMENT.md#hosted-verification-after-railway-reactivation)
   and [local verification workload](PERFORMANCE_VERIFICATION.md).

2. **Reduce first-load and background work.** Start with the staff dashboard and
   bell. Build a lean, role-scoped summary and reminder read using shared metric
   definitions. Where both are needed, reuse the same query result or compare a
   combined summary against separate requests before committing to either shape.
   Fetch report rows, charts, historical drill-down and full evidence as those views
   need them. Move staff recommendations to bounded highlights and fetch detail on
   demand where profiling shows oversized dashboard responses. Preserve filter scope,
   totals and badge/toast behavior. Keep the existing Axios/cache/login preparation,
   preserve existing roster/user server pagination, and profile student map/results
   sections and report bundles before splitting more code. Confirm first-render data
   and focus/scroll behavior against the current UI.

3. **Fix measured server bottlenecks.** Profile the slowest actual query shapes and
   compare `EXPLAIN (ANALYZE, BUFFERS)` for slow reads in isolated PostgreSQL before
   selecting an index or changing joins. Batch repeated per-row work and select only
   needed fields. Check pooler/TLS connection churn, worker saturation and the cold
   NLP model path before changing concurrency or prewarming. Measure legacy backfill
   separately from normal GETs before moving it off the read path. Treat any durable
   background admin rerun/export as a separate change gated by observed runtime,
   scoped job access, idempotency, progress and result parity. Preserve atomic
   assessment writes, completion gates, ranking order and saved placement evidence.

4. **Pilot private Supabase Broadcast in staging.** Start with an opt-in cohort and
   compare it with the existing SSE path under identical load. The pilot below targets
   live-update delay and idle database checks. Any improvement to first-load times
   through lower contention must be measured separately.

5. **Roll out one measured change at a time.** Release the read-path improvements
   separately from the transport. Compare cold/warm p95, errors and role parity with
   the baseline. Expand the pilot only after quota, authorization and recovery checks
   pass. Track event-to-refresh lag, connections, database workload, mutation time,
   and fallback activations. Use the feature switch to return the cohort to SSE if
   the pilot regresses those measures.

### First implementation on the local checkout

Staff dashboards, sign-in preparation and the bell use the overview variant of
the analytics endpoint. Reports and exports use the full response. Both variants
apply the existing authorized cohort selection, completion, ranking visibility,
placement capacity, and reminder rules. The overview skips report history and
chart data. It includes saved skill highlights for a selected program. Shared
cache invalidation covers both variants. A staggered release fallback retries a
single full GET with the same scope when the older backend rejects the new filter.

Analytics loads assessment, response, score and profile evidence across the
selected cohorts and partitions it by each student's selected batch before
applying the existing management rules. Catalog fingerprints are reused within
the request when batches share a ranking scope. The bell's first motion change
is a short CSS entrance and press feedback. The menu and keyboard focus are
driven by existing controls and support reduced motion.

The same synthetic 200-student, 20-batch PostgreSQL fixture returned these results.
Use statement counts and raw JSON sizes to compare the runs. Local elapsed time
varied with other checks on the machine.

| School-wide staff read | SQL statements | Raw JSON |
| --- | ---: | ---: |
| Previous full analytics | 140 | 320.0 kB |
| Current full analytics | 24 | 320.0 kB |
| Current dashboard and notification overview | 20 | 47.8 kB |

The full report used 24 statements at both four and 20 populated batches in
this fixture. Evidence is under `work/optimization-review-postgres-tntg4nk2/`.
Local regression verification passed 787 Django tests on PostgreSQL, 306
frontend tests, lint, the production build and Django's migration drift check.
Browser checks passed for the shared dashboard request, role-specific sign-in
and old API fallback, notification reads and reduced motion, scoped report
CSV/PDF exports, and the three-role assessment-to-placement workflow. PostgreSQL
evidence is under `work/branch-review-postgres-dcjdy09u/`. The scoped report
browser rerun passed under `work/organization-browser-h8lq8qv3/`.

The account review found no isolated Supabase Realtime staging project or branch
for SkillBridge. A separate project is not a Supabase technical requirement.
It provides stronger isolation for load/failure testing. Initial connectivity
and narrowly scoped authorization checks can use the existing project under
the current-project pilot limits below; they do not establish rollout readiness.

### Second local implementation: finalized results and shared motion

The next synthetic PostgreSQL profile separates locked, finalized, stale and
missing-profile recovery reads for legacy and program-scoped batches. Staff
requests explicitly select the same batch as the student. Finalized student
results fetched position requirements once per recommendation. They now prefetch
the requirements and categories in one query before serializing the same rows.

| Student combined-result state | Previous SQL | Current SQL |
| --- | ---: | ---: |
| Legacy batch, 12 current recommendations | 35 | 24 |
| Program batch, 12 current recommendations | 37 | 26 |
| Legacy missing-profile recovery, first request | 78 | 67 |
| Program missing-profile recovery, first request | 77 | 66 |

The one-recommendation reads remain at 24 and 26 statements. Each stable state
was sampled ten times; recovery has one first request followed by ten warm reads.
Instructor reads remained at 19 statements for finalized legacy results and 20
for finalized program results at both recommendation sizes. Locked/stale result
visibility and the measured JSON sizes were unchanged. Stable reads did no
scoring. NLP preprocessing was deterministic test behavior; these are query-work
measurements, not hosted latency or cold model benchmarks. Baseline evidence is
`work/optimization-review-postgres-0d9_u3qo/results-profile.json`; the matching
optimized run is `work/optimization-review-postgres-fkq_bcjn/results-profile.json`.
The regression first failed at 24 versus 35 statements, then passed with exact
recommendation payload/order parity. The 43-test PostgreSQL combined, freshness,
scoped-ranking and management regression passed under
`work/branch-review-postgres-k4runf1n/`.

Shared CSS motion tokens now drive notification entrances/press feedback, toast
entrances and native dialog/session-expiry card entrances. Native dialogs use
160 ms opacity and 4 px translation, with immediate close and existing focus and
scroll behavior. The session-expiry card's inline animation bypassed reduced
motion; its entrance now runs only when the user has no reduced-motion preference.
Toast dismissal still uses its existing independent Web Animation clock.
The source inventory is recorded under `work/motion-inventory-20261107.txt`.
No motion dependency was added. Remaining effects and mobile frame-performance
verification stay on the checklist.

The inventory found existing shell width/margin transitions, native select and
collection color/border transitions, skeleton/loading pulses, map pin feedback,
toast timing, and an inline session-expiry entrance. This pass shares the selected
surface tokens; remaining transitions and specialized map/loading motion keep
their own review items. No row staggering or animation-driven unmount was added.

The 10-group assignment browser run verified rapid nested reopen, Escape, focus
return, retained scroll lock, save retry and desktop/phone light/dark layouts.
The final rebuilt rerun passed under `work/organization-browser-tzuwgyis/`.
Toast checks passed nine
groups, including nested modal/fullscreen behavior, reduced motion, touch and
countdown continuity. Notification checks passed for all three roles. The current
20-group dashboard-first suite passed, including standard/reduced-motion session
expiry, slow/failed sign-in, account changes, preparation cancellation and the
older-backend overview fallback. Its output is in `work/dashboard-motion-check.txt`.
Reports passed nine development browser groups under
`work/organization-browser-duxm2fwk/`. Frontend lint, build and 306 Node tests
passed. This work was verified on the local working tree based on `c3745f9`;
hosted runtime and mobile frame timings are still pending.

An exploratory run of the older `navigation_states_playwright.py` stopped at its
obsolete always-visible `Assessments` sidebar-link expectation after the existing
grouped-navigation redesign. It did not reach its later lifecycle checks. The
failure is retained in `work/navigation-motion-check.txt`; this suite needs its
navigation and dashboard fixtures updated before it can count as full coverage.
Use the current dashboard-first, scoped Reports and actual API dialog suites for
the checks listed here.

## System backlog

Each row names the first experiment and the evidence needed to ship a change.
Run the measurement and first-load work first. Advance other workstreams when
their traces show which cost to remove.

| Workstream | First experiment and candidate change | Release evidence |
| --- | --- | --- |
| Browser and login | Profile Google and password authentication separately from dashboard preparation. Measure first useful content, request waterfalls, script parse/render cost and assets. Reuse login preparation and route splitting. Where traces show competition, defer maps, charts, exports and optional prefetch; cancel abandoned requests and keep visible content during revalidation. | Verify admin, instructor and student cold/warm journeys and slow/offline recovery. Preserve token refresh, pending/setup routing, account-isolated caching and phone accessibility. [Authentication recovery](AUTHENTICATION_AND_RECOVERY.md) · [Browser matrix](BROWSER_MATRIX_VERIFICATION.md) |
| UI animations and interaction | Inventory existing transitions and reduced-motion coverage, then introduce the shared motion rules below in small component groups. Start with buttons and menus, followed by dialogs, toasts and explicit tab changes. Profile collection entrances and live refresh separately. | Complete the motion interaction, accessibility and performance gates below before each release. [Existing motion and safety plan](#ui-animation-plan) |
| API reads and reports | Split the staff bell and dashboard from the heavy report payload first. Profile staff recommendation highlights, instructor rosters, assessment/retake lists, placements and partner catalogs at realistic sizes. Reuse server-side pagination and scoped detail reads where list growth dominates. Trace report download separately from generating the report view. | Compare bytes, query growth and latency at multiple fixture sizes. Verify server-side filter totals, role-scoped pages, reports, PDF/XLSX parity and active versus archived views. [Database collection improvements](DATABASE_IMPROVEMENT.md) · [Report reconciliation](REPORT_RECONCILIATION.md) |
| PostgreSQL and caching | Rank queries by cumulative cost and tail latency. Check plans, lock waits, dead rows, pool saturation and index use for the actual hot paths. Test narrower ORM queries and query-specific indexes in isolation. Add server-side caching only for a measured repeated read with an explicit scope key, invalidation and expiry. | Show bounded query and connection growth, safe index migration behavior, correct cache isolation after grant changes, and preserved historic records. Verify actual TLS/pooler settings before tuning connection reuse. [Read-only diagnostics](DATABASE_IMPROVEMENT.md#hosted-verification-after-railway-reactivation) |
| Assessment write path | Profile start, draft save, submit, stop and retake under concurrent use. Time validation, transaction waits, batched grading writes and combined recalculation separately. Include retry after an uncertain timeout and duplicate submissions against the same attempt. | Compare raw scores, denominators, attempt histories, timing/availability gates and result unlock. A failed/abandoned call can be reconciled without double grading or dropping the saved draft. [Concurrency verification](POSTGRES_CONCURRENCY_VERIFICATION.md) |
| Competency and recommendations | Separate routine reads, legacy profile repair, first spaCy model load, warm ranking and admin rerun. Measure per-process model memory and lock contention before evaluating prewarming. If admin reruns repeatedly exceed the interaction budget, pilot a durable, scoped job with progress, idempotency and explicit failure recovery. | Confirm component scores, candidate order, active-batch completion gates and stale-result visibility match for identical evidence. Confirm a restart or failed job leaves any completed work and retry state consistent. [NLP runtime](NLP_RUNTIME_VERIFICATION.md) · [Assessment-led recommendation contract](ASSESSMENT_LED_RECOMMENDATIONS.md) |
| Placement and OJT cycle | Compare suggestion/draft reconciliation and read-only list/report loads on one batch and across programs. Count invalidation-triggered syncs after an event burst. Profile concurrent approvals for the same slot and closeout preview/export with historical records. | Preserve slot limits, coordinator scope, idempotent draft refresh, explicit approvals, immutable decision evidence and closeout snapshots. [Placement drafts](PLACEMENT_DRAFT_IMPLEMENTATION.md) · [Cycle lifecycle](OJT_CYCLE_CLOSEOUT_AND_ROLLOVER_PLAN.md) |
| Providers, uploads and workers | Measure address/map load, company branding, evidence upload, login provider time and enrollment email queue age separately. Test blocked/slow providers and worker restart. Reuse existing timeouts, upload cleanup and durable email outbox. Tune retries or worker throughput only where queue metrics identify a delay. | Browsing and completed saves recover correctly on provider failure. Preserve required map-pin checks and upload references. Verify queued versus delivered mail states, retry safety and provider-quota recovery using isolated test providers. [Provider recovery](EXTERNAL_SERVICE_RECOVERY.md) · [Durable email delivery](ENROLLMENT_EMAIL_DELIVERY.md) |
| Runtime and hosting | Establish the deployed Git revisions, region/network path, worker settings and resource limits. Reproduce the 502 and long-tail read scenarios with response timing correlated across proxy, Django and PostgreSQL. Compare keepalive, worker sizing, database proximity and model memory with one controlled change per run. | Repeated bounded hosted tests pass with normal throttles and resource/cost headroom. Verify health, logging, worker restarts, a compatible rollback and a restore rehearsal in isolation. [Hosted workflow results](HOSTED_TEST_RESULTS_2026_10_30.md) · [Release and recovery](RELEASE_AND_RECOVERY_HANDOFF.md) |
| Data freshness and WebSockets | Measure current SSE checks, REST refetches, disconnects and commit-to-visible latency. Pilot the private Broadcast transport below with the same reads, mutations and active sessions. | Authorization, missed-event recovery, freshness and database-load gates pass before expanding the cohort. |

## Benchmark and release gates

| Gate | Measurement or acceptance |
| --- | --- |
| Reproducibility | Pin revision, environment, data size, role, device/network profile, process/model warmth and client cache state. Keep redacted per-flow sample counts, p50/p95/max, errors and the slowest trace. Use route names and opaque request IDs to correlate timings without logging URLs with tokens, submitted data or student identities. |
| First useful view | For each role record click-to-first actionable dashboard content and when secondary sections are ready. Separate auth/provider time from post-auth readiness. For the staff read-path change, require a lighter measured response on unrelated staff pages and a repeatable improvement in the bottleneck identified on the dashboard. Set numeric hosted dashboard and byte budgets from the baseline before implementation. |
| Reads, writes and model startup | Keep the existing local workload targets of p95 normal reads under 2 s, p95 warm submit/results under 5 s and first model/results load under 15 s. Report hosted numbers separately. Compare query counts, lock waits, memory, database connections and timeouts as load increases. |
| Capacity and reliability | Reproduce a fresh isolated ten-student hosted cohort with cold and warm phases, and include concurrent staff reads. Run a matched diagnostic for the historical 502s and long-tail reads. Advance to the next planned load stage only after complete runs pass integrity and error gates within the agreed test cap. The previous hosted environment was cleaned up. [Bounded hosted test plan](HOSTED_WORKFLOW_AND_CONCURRENCY_TEST_PLAN.md) |
| Realtime | Proposed pilot gates are p95 commit-to-visible under 2 s and at least 90% fewer idle event-log reads for opted-in sessions, with no first-load or mutation p95 regression. Test failed joins, revoked access, missed events, refresh on reconnect and publish failure. |
| Release | Compare each stage against its matched baseline. Stop rollout for a correctness/role-scope failure, duplicate write, recurring 502, or verified latency/resource regression. Roll back the affected deployment or feature switch and rerun health, login, attempt/result and placement smoke checks. Publish measured results and outstanding limits for each stage. |

## UI animation plan

The supplied image lists twenty animation ideas. Apply them selectively to help
users follow an action or state change. Use a small set of shared duration, easing
and distance tokens in the existing styling system. CSS transform/opacity is the
initial implementation choice for simple effects. Evaluate a motion library only
when a specific shared-element interaction needs it, after checking bundle cost,
React compatibility and accessibility. Current source already includes toast
entrances, shell transitions, loading pulses and reduced-motion rules. Review the
actual scope of each rule, including inline styles and portaled content, before
consolidating them. [Current global styles](../skillbridge-frontend/src/index.css)
· [Shared dialog](../skillbridge-frontend/src/components/DialogShell.jsx)
· [Portal modal layer](../skillbridge-frontend/src/components/layout/ModalLayer.jsx)

### Applying the reference

The item numbers below match the attached image. These values are proposals for
SkillBridge, with final tuning subject to the release checks.

| Image items | Planned treatment |
| --- | --- |
| 1. Ease-out entrances; 9. Ease-in-out moves | Use ease-out for appearing surfaces and ease-in-out for a user-requested move of an existing element. Start at 150–220 ms with a small 4–8 px offset. Keep labels legible while controls move. |
| 2. Dropdowns at 150–250 ms; 10. Popovers start at 0.95 | Start custom dropdown/popover transitions at 150–200 ms. Trial 0.95–1 scale with the transform origin at the trigger. Keep native select behavior and check clipping, click targets and positioning before applying any effect. |
| 3. Stagger rows by 30 ms; 6. Stagger as details settle | Trial a 30 ms stagger on the first few visible cards or detail groups, with total delay capped at 120 ms. Render data and enable permitted actions immediately. Keep table order stable and use a subtle container entrance where row motion obscures scanning. Revalidation should update existing content in place. |
| 4. Scale to 0.97 on press; 14. Immediate response while held | Trial 0.97 press feedback on standalone action buttons or their inner visual surface. Keep the target area stable and apply feedback for pointer and keyboard activation. Reflect press/release immediately, including pointer cancellation and lost focus. Preserve existing disabled and pending states. |
| 5. Stretch moving knobs 12% | Reserve knob stretch for an existing toggle/slider where it helps show movement. Trial a smaller stretch first and check adjacent labels and target size. The control's accessible value and committed state follow its normal input handler. |
| 7. Arcs for object movement; 19. Rubber past bounds | Reserve for a demonstrated spatial interaction after profiling. Use restrained motion within the viewport. Keep forms, tables, assessment answering and scroll boundaries stable. These effects have low priority in this operations app. |
| 8. Pulse to confirm success | Use one restrained pulse on the existing confirmation icon after a confirmed successful operation. Keep the success text available. Assessment submission feedback must follow the saved result or successful reconciliation, and users can continue immediately. |
| 11. Enter from the trigger; 12. Exit to the trigger | Anchor popovers and menus to their opener when it remains visible. Use a short fade when scrolling, navigation or a removed trigger makes that origin misleading. Keep the existing placement/collision handling and keyboard focus restoration. |
| 13. Restrained everyday motion; 15. Exits 20% shorter | Use smooth settling on routine surfaces. Trial exits at about 80% of the matched entrance, such as 160 ms after a 200 ms entrance. Interrupt safely when another interaction supersedes the transition. |
| 16. Overlap old and new states; 18. Crossfade and blur | Trial a short crossfade for decorative content or read-only tab visuals. During overlap expose one active semantic/control tree. Keep text sharp as the default and profile any small decorative blur on mobile before inclusion. Preserve field drafts and chart/map instances. |
| 17. Masks for reveals and colour | Trial a bounded reveal on a decorative surface after verifying paint cost. Keep essential labels, validation, tooltips, focus outlines and actions visible and reachable throughout. |
| 20. Reuse the same layoutId | Consider a scoped shared-element identity only if a later library pilot demonstrates a useful transition. Use stable record keys and unique IDs per active component scope. Preserve one logical instance of each form, dialog and assessment screen across navigation and refresh. |

Prefer transform and opacity when they achieve the intended effect and inspect
paint/layout work in a browser trace. Profile the existing sidebar width and
workspace margin transitions before modifying them. Blur, masks and large layer
counts need their own measurements. [Browser animation performance guidance](https://web.dev/articles/animations-guide)

### Interaction and accessibility gates

- Keep data requests, saves, grading, countdowns and navigation driven by their
  existing state and handlers. Animation completion is visual cleanup. Define a
  safe cleanup path for interruption, unmount, a hidden tab and missing completion
  events. Confirm that disabling all motion still completes every workflow.
- For dialog exits, keep focus contained and the background inert while the
  modal remains active. Complete closing and focus restoration exactly once,
  including nested confirmation, Escape, backdrop click and rapid reopen. Clean
  scroll locks, portal nodes, listeners and pending animation callbacks. Reuse
  the current dialog infrastructure. [Accessible dialog behavior](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Respect `prefers-reduced-motion` across shell, portal, native dialog, session
  expiry, loading indicators, maps and charts. Provide immediate state changes
  and static loading/status text when spatial movement or decorative loops are
  disabled. Handle a preference change during an active transition. [Reduced-motion preference](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- Preserve visible focus, screen-reader announcements, touch target size and
  light/dark contrast. A visual crossfade must expose one set of controls to
  keyboard and assistive technology. Verify focus stays on the active control
  through search, filter, page and card/list changes.
- Preserve assessment answer drafts, active input selection, fullscreen behavior,
  integrity handlers, actual timer values and single submission. Verify no
  animation-driven remount or overlay interrupts typing or captures the next
  click. Use quiet feedback in timed assessment screens.
- Keep SSE and future WebSocket refreshes quiet. Preserve stable record keys,
  scrolling, selections, expanded details, form drafts and pagination. Introduce
  list entrance effects only for deliberate presentation changes, with data
  available independently of their visual delay. [Collection interaction contract](../.agents/skills/skillbridge-collection-ui/references/COLLECTION_UI_REFERENCE.md)

### Delivery and verification

1. Inventory the current component motion and baseline the affected interactions.
   Add shared motion tokens and reduced-motion handling in a focused change, then
   apply them to buttons/menus and verify before expanding to dialog/toast/tab
   effects. Evaluate collection entrances last against real refresh behavior.
2. For each changed group, run frontend lint/build and the applicable existing
   browser flows with synthetic data. Check all three roles, desktop/phone,
   light/dark, keyboard/touch and normal/reduced motion. Exercise rapid open/close,
   double activation, interruption, failed/slow requests, session expiry, nested
   dialogs, pagination and live data updates. Add a focused regression only when
   an existing check misses a concrete lifecycle failure.
3. Compare interaction-to-response and first usable content against the matched
   baseline using the same build, device/network profile and data. Inspect frame
   pacing, layout shifts, long tasks, paint cost and layer count. Aim for smooth
   rendering within the frame budget of the measured device. Require immediately
   responsive controls and investigate repeatable regressions before release.
   Verify no extra GET/mutation is caused by animation state, and take a bundle
   size comparison if a dependency changes.
4. Release one component group at a time after its interaction and performance
   checks pass. Keep the motion styles isolated so their rollback is small.
   Record tested flows, timing evidence and device limitations in this checkpoint.

## WebSocket decision and pilot

| Option | Fit for SkillBridge |
| --- | --- |
| Existing SSE | Baseline and rollback. It delivers one-way events, already fits the WSGI deployment and preserves current per-delivery scope checks. Its idle PostgreSQL polling is the cost to compare. |
| Supabase private Broadcast | Preferred WebSocket pilot. It can deliver small, recipient-scoped invalidations while Django still serves authorized REST data. It can remove the per-client polling loop for the opted-in sessions. It requires a verified token bridge, strict topic authorization and enough quota headroom. [Broadcast documentation](https://supabase.com/docs/guides/realtime/broadcast) |
| Supabase Postgres Changes | Keep application tables out of the pilot. Row changes do not represent the end of multi-step grading or placement operations. This transport also checks access per subscriber for each change. [Postgres Changes scaling](https://supabase.com/docs/guides/realtime/postgres-changes#scaling-postgres-changes) |
| Django Channels WebSocket | Revisit if measured demand exceeds Supabase capacity or SkillBridge needs server-controlled connection policy or bidirectional messages. The checked-in Railway service uses Gunicorn/WSGI. A Channels deployment would need an ASGI WebSocket service and a shared channel layer, typically Redis, for multiple workers. [Railway service configuration](../railway.toml) · [Channels deployment](https://channels.readthedocs.io/en/stable/deploying.html) |

**Pilot flow.** Django completes the operation and writes its recipient-scoped
`ChangeEvent` through the existing post-commit hook. The independently enabled
publisher then uses private REST Broadcast for up to two allowlisted accounts.
The message contains allowlisted invalidation topics and an opaque deduplication
key. The client routes the hint through the existing cache and Django authorizes
each resulting GET. The SSE event remains available if the provider fails. Measure
the cost of the bounded HTTP call before expansion. A separate worker remains an
option if synchronous publication increases write latency. See the [pilot runbook](SUPABASE_REALTIME_PILOT.md)
and [event publication](../skillbridge-backend/api/change_events.py).

### Controlled pilot in the existing project

The user asked whether the current Supabase project can be used safely. Start
with a low-volume private test channel, synthetic messages and one or two test
clients. Inspect current policies, roles, token trust and Realtime settings first.
Use a distinct test topic and a topic-specific receive policy. Check the effective
access from all applicable policies; a narrow new policy does not override an
existing broad permissive policy. Avoid changing project-wide access settings or
existing application policies for a connectivity test.

Publish dummy messages from a server-side REST Broadcast call. This initial test
needs no trigger on student, assessment, score or placement tables and no real
record changes. Keep privileged credentials on the server. A successful test in
the Inspector's `postgres` role proves delivery, not application-user isolation.
Verify the Django-issued limited token separately before connecting an application
test account. Keep the feature disabled for ordinary sessions and retain SSE.
After connectivity and access checks pass, integrate one synthetic cohort's
post-commit invalidation and verify reconnect and fallback. This shares the live
project's resources and configuration; it has less isolation than separate staging.
Run destructive/fault-injection and heavy load scenarios in a disposable or
separate staging environment. No live Realtime settings or policies were changed
when this alternative was documented.
[Server Broadcast](https://supabase.com/docs/guides/realtime/broadcast#broadcast-using-the-rest-api)
· [Channel authorization](https://supabase.com/docs/guides/realtime/authorization)

**Identity and privacy.** Keep Django SimpleJWT for API access. Verify in the pilot
that Django can exchange a current eligible session for a short-lived JWT signed
with a dedicated Supabase-trusted signing key. Give it a server-assigned opaque
recipient topic. Configure private channels and a receive-only RLS policy that
matches the verified topic exactly. Test a dedicated limited database role and
explicitly verify the token grants no application-table/Data API or Storage access.
Treat that as a pilot gate because a trusted signing key or token audience alone
does not isolate database privileges. The browser uses a publishable key plus
its short-lived token. Keep signing and privileged credentials server-side. Stop
the client subscription and clear inaccessible cache on logout or account change.
At publish time verify the recipient remains eligible and send a generic scope
refresh for intentional removal notifications. Supabase caches channel access,
so test revocation on an already-open connection, re-evaluate eligibility on
token renewal, and verify expiry bounds stale connections. Match the existing
delivery-time privacy checks before widening the pilot.
[Supabase JWT trust](https://supabase.com/docs/guides/auth/jwts#using-custom-or-third-party-jwts)
· [Realtime authorization and policy updates](https://supabase.com/docs/guides/realtime/authorization#updating-rls-policies)

**Recovery and capacity.** Use one selected transport per visible tab. Defer the
WebSocket client off the critical rendering path. Add only the staging project's
required HTTPS/WSS origins to the test CSP. Coalesce duplicate hints and resync the
authorized views after subscribe/reconnect or resume. Retain visible and focus
refresh during the pilot, including time-based assessment availability. Test
disconnects, sleep/wake, token rotation, role changes, bulk submissions, out-of-order
or missed messages and blocked WebSockets. On a provider outage, stagger retries
and use visible/focus refresh to avoid opening a burst of fallback SSE streams.
Supabase documents Free defaults of 200 concurrent connections, 100 messages/s and
100 joins/s. Compare measured peak tabs, event fan-out and reconnect rates with the
actual project limits before expanding. [Realtime limits](https://supabase.com/docs/guides/realtime/limits)
· [Production browser policy](PRODUCTION_BROWSER_POLICY.md)

## Implementation checklist

Check an item when its implementation and listed verification are complete.
Record the tested revision, environment and evidence before moving to the next
release. Use the [benchmark and release gates](#benchmark-and-release-gates)
for comparisons. Local, staging and production each have their own checks.

### 0. Stabilize Reports & Analytics

- [ ] Diagnose the local `/admin/reports` crash that reads `useMemo` from `null`
  if it recurs. Capture the first browser console error and its stack, plus the
  Vite terminal output. The isolated checks below did not reproduce it.
- [x] Preserve the per-port Vite development-cache fix at `c3745f9`. Verify
  distinct cache paths for development ports 5173 and 5197 and the ordinary
  production build cache. This prevents parallel development servers from
  replacing each other's optimized React chunks. The original browser session
  still needs a retry before closing its incident.
- [x] Verify local admin and instructor report navigation, table sorting and
  reload in development using a fresh Vite dependency cache and a copy of the
  existing cache. Evidence is under `work/organization-browser-1amymk23/` and
  `work/organization-browser-myd6xtio/`.
- [x] Verify scoped reports, charts and CSV/PDF exports with synthetic data in
  the development server and production build. The report suites passed under
  `work/organization-browser-w6elgmss/` and `work/organization-browser-h8lq8qv3/`.
- [x] Repeat the nine scoped report browser groups in development using the
  actual per-port cache configuration, including admin/instructor access,
  charts, exports and responsive layouts. Evidence:
  `work/organization-browser-duxm2fwk/`.

For a local retry, stop the Vite server, run `npm run dev -- --force` from
`skillbridge-frontend/`, then reopen Reports & Analytics. This asks Vite to
rebuild its optimized development dependencies. [Vite dependency caching](https://vite.dev/guide/dep-pre-bundling.html#caching)

### 1. Establish comparable baselines

- [x] Review the three role entry points, query cache, analytics, event stream,
  previous hosted failures and Supabase Realtime options.
- [x] Build the frontend and record bundle sizes. Profile current read paths for
  all three roles on synthetic PostgreSQL. Record existing deployed proxy
  timings separately from the current local revision.
- [ ] Prepare an isolated staging environment with synthetic records and a
  pinned source revision for frontend, backend and database.
- [ ] Capture cold and warm sign-in, first actionable content, navigation and
  background request volume on desktop and a mobile network profile for all
  three roles. Include a staff page with the notification bell closed.
- [x] Refresh the older navigation-state suite's grouped-sidebar and current
  dashboard fixtures and rerun its lifecycle checks. All 37 groups passed with
  the pilot disabled on 8 November. Evidence is in `work/navigation-states-agent-20261108.txt`.
- [ ] Reproduce the historical slow reads and 502s with bounded staging load.
  Measure request queueing, Django time, database round trips and rendering.
- [ ] Compare the same fixture and workload with the API in California and an
  available Asia-Pacific region. Record resource use, connection churn and cost
  before deciding on a region or pooler change.

### 2. Reduce frontend, API and database work

- [x] Share a compact staff dashboard and notification overview. Verify counts,
  scope, email reminders, invalidation, sign-in and compatibility with an older
  backend. Preserve full data for reports and exports.
- [x] Batch staff analytics evidence reads across authorized cohorts and verify
  response parity and query counts on the 200-student fixture. See the
  [local implementation and measurements](#first-implementation-on-the-local-checkout).
- [ ] Verify the staff overview improvement in staging with the same roles,
  datasets and network profile as the baseline. Record p50/p95, bytes and SQL
  counts for dashboard, closed bell and full report reads.
- [x] Profile instructor dashboard recommendations and student combined results
  separately for locked, finalized and legacy-recovery cases. Implement the
  smallest measured change and verify that visibility and ranking match. The
  [second local implementation](#second-local-implementation-finalized-results-and-shared-motion)
  also covers stale results and both legacy/program scopes.
- [ ] Profile remaining hot reads across rosters, assessment and retake lists,
  partner catalogs, placement history and reports. Bound list payloads and load
  detail when opened where the measurements justify it.
- [ ] Profile scripts, charts, maps, images and exports on a mobile network.
  Defer secondary work where it competes with usable content. Verify that
  navigation cancels unnecessary work and cached data reconciles correctly.
- [ ] Inspect slow SQL plans, lock waits, indexes and pooler behavior in staging.
  Verify any query, caching or index change against role scope and representative
  sizes before rollout.

### 3. Verify writes, jobs and external providers

- [ ] Profile start, autosave, submit, stop and retake under controlled concurrent
  load. Verify timers, saved answers, one finalization, scores and result unlock.
- [ ] Measure recommendation recalculation and cold model startup separately.
  Verify stale-state behavior, ranking parity and safe retries before changing
  worker settings or moving a long-running operation to a job.
- [ ] Profile placement draft reconciliation, approval races and closeout exports.
  Verify capacity limits, explicit approvals, history and saved snapshots.
- [ ] Measure provider delays and email queue age. Verify slow or failed login,
  maps, uploads and email delivery with synthetic inputs, including retries and
  recovery after a worker restart.

### 4. Add UI animation in verified groups

- [x] Add the notification bell entrance and press feedback. Verify reduced
  motion, focus return, read state and responsive behavior for all three roles.
- [x] Inventory existing motion and introduce shared duration, easing, distance
  and press tokens for notification, toast, native dialog and session-expiry
  surfaces. Remove the session card's inline reduced-motion exception.
- [x] Verify native dialog entrances with rapid nested reopen, Escape, focus
  return, scroll locking, save retry and desktop/phone themes. Verify standard
  and reduced-motion session expiry in the current sign-in suite; retain toast
  timer/fullscreen and three-role notification checks. See the second local pass.
- [x] Share the 160 ms ease-out entrance across profile, notification and action
  menus, with reduced-motion support. The local Chrome dropdown suite passed
  16 groups, including keyboard selection and Escape inside a native dialog.
  Profile and notification menu checks passed for all three roles. Frontend
  lint and the synthetic-configuration production build passed.
- [ ] Extend shared tokens to remaining buttons/menus where appropriate and
  verify their reduced-motion behavior, including portaled content.
- [ ] Apply the [animation guidance](#ui-animation-plan) to selected dialogs,
  popovers, toasts and tabs. Verify rapid reopen, nested dialogs, Escape,
  cancellation, loading, errors, focus and keyboard/touch controls.
- [ ] Trial bounded list motion where it helps. Check large collections and live
  refreshes for scroll, selection, drafts, pagination and stable interaction.
- [ ] Verify timed assessments with standard and reduced motion. Compare browser
  traces for frame pacing, layout shift and interaction delay on mobile before
  expanding effects. Record the reference ideas that are deferred.

### 5. Pilot WebSockets through Supabase Realtime

- [x] Review private Broadcast, Postgres Changes, Django Channels and the current
  SSE path. Select private Supabase Broadcast for the staging pilot.
- [x] Inspect current project policies, roles, public signing metadata and
  advisories before the bounded connectivity test. Prepare the additive receiver
  policy and teardown and verify both on disposable PostgreSQL.
- [x] Verify private Broadcast delivery with dummy messages and at most two test
  clients in the existing project. Two successful single-message probes returned
  HTTP 202 and delivered over WebSocket. A public-key-only client was denied.
- [x] Implement the opt-in token exchange, post-commit REST publisher and browser
  transport with SSE fallback. Verify synthetic submission, failure and rollback,
  exact-topic SQL access, and all three browser roles locally. See the [pilot runbook](SUPABASE_REALTIME_PILOT.md).
- [x] Verify the approved signer and receive-only policy against the existing
  hosted project. All 11 authorization and dummy-delivery checks passed. See the
  [real-channel results](SUPABASE_REALTIME_PILOT.md#real-channel-local-application-results).
- [ ] Measure resource headroom before expanding beyond the isolated local pilot.
- [x] Configure a private receive-only channel for one synthetic cohort in an
  isolated local app. Verify short-lived Django session exchange and exact
  recipient-topic access against the real hosted service.
- [x] Publish a small invalidation after a successful student submission commits.
  Verify the assigned instructor's open roster refreshes through the existing
  authorized Django GET. Exercise rollback and publication failure in the local
  regression suite, and verify real socket disconnect selects SSE recovery.
- [ ] Verify anonymous, expired, revoked and cross-account denial. Confirm the
  pilot token cannot read application tables or private Storage, or publish
  client messages.
- [ ] Verify reconnect, missed events, duplicate events, sleeping tabs, quota
  limits and SSE or refresh fallback. Keep one transport per visible pilot tab.
- [ ] Compare the pilot with SSE under matched load. Aim for p95 under two seconds
  from commit to visible update and at least 90% fewer idle event-log reads, with
  stable page loads and writes. Record the go/no-go decision and rollback switch.

### 6. Release and monitor each approved phase

- [x] Verify the first local implementation with the PostgreSQL and frontend
  suites, lint, build and browser workflows. Retain the earlier integration
  baseline at `4d08501` and its evidence under `work/branch-review-postgres-qq4l4102/`.
- [x] Complete the resumed local rehearsal with 816 PostgreSQL tests, 322
  frontend tests, the build, and the instructor/admin enrollment-to-assessment
  browser journey. Retain the API creation chain, separate program UI checks
  and 11 synthetic WebSocket groups in the [local results](SUPABASE_REALTIME_PILOT.md#local-rehearsal-results-after-resuming).
- [ ] Run staging role, accessibility and regression checks after each change
  group. Verify migrations if the group changes the schema.
- [ ] Confirm deployment compatibility, rollback and an isolated restore.
  Release the read changes and WebSocket pilot independently so each can be
  measured and reversed.
- [ ] For each authorized release, record the deployed revision and verify
  health, role-scoped navigation, assessment/results and placement flows.
- [ ] Complete the [login-to-assessment browser workflow](SUPABASE_REALTIME_PILOT.md#login-to-assessment-browser-workflow)
  with synthetic records on the release build. Repeat the submission and roster
  checks with Realtime and its fallback before expanding the pilot.
- [ ] Compare production metrics with the baseline and close each workstream
  when its acceptance gates pass. Record any intentionally deferred changes.

## Navigation and save feedback plan · 8 November 2026

The user requested planning before implementation after reporting slow navigation
and saves. The application baseline for this review is local main `11ed70d`.
The user authorized continuous implementation on 8 November, including agents
and fixes found during verification. Complete and merge each phase locally
before implementing the next.

### Current implementation

React renders authenticated pages in the browser. Django authorizes requests,
queries PostgreSQL and returns the data. Supabase hosts PostgreSQL and Storage.
The browser uses the existing account-scoped query cache, shared in-flight GETs,
route code loading, navigation preparation and background revalidation.
This is server data access with client page rendering. Full HTML server rendering
would be a separate architecture change.

The assessment creator validates locally, sends its POST and shows success after
the API response. Some editors already publish the returned saved record into
the cache immediately and reconcile through a later GET. Operation latency can
include authorization, SQL round trips, locking, recalculation, serialization,
recipient lookup and synchronous post-commit notification delivery. Measure
these contributions before selecting a change.

Historical hosted timings earlier in this document belong to an older deployed
revision. They establish previous slow requests, without establishing the
current revision's bottleneck. The API/database region separation recorded in
that review must be verified again before proposing infrastructure changes.

### Ordered implementation and verification

- [x] N01. Measure current navigation and saves. Trace admin dashboard, batches,
  users, taxonomy, assessments, partners, placements and reports, plus coordinator
  rosters and student assessments/results. Compare cold entry, repeat navigation,
  a page with cached data, changed institute/program, and first submission after
  process startup. Record time to visible content, time to usable data, request
  count, response size and save acknowledgement. Break server time into database,
  calculations and post-commit work on synthetic fixtures. Measure ordinary and
  pilot transport separately. Use timing metadata without student records.
- [ ] N02. Fix the measured navigation causes. Reuse the existing cache and route
  preparation. Render page structure immediately, keep usable same-scope content
  during refresh, and load secondary panels independently. Profile repeated or
  sequential reads, large list responses and background requests competing with
  the destination. Select server query, pagination or connection changes only
  when traces identify their cost. Verify access revocation and account changes.
- [ ] N03. Improve confirmed-save feedback. Show pending feedback immediately,
  preserve draft input and prevent repeated submissions. Use the saved response
  to update the relevant cache and screen before background reconciliation.
  Measure whether a redundant GET or ancillary work extends the visible wait.
  Preserve the server acknowledgement for publishing, scoring, enrollment,
  grants, archives, placement approvals and other consequential operations.
- [ ] N04. Pilot optimistic feedback on a small reversible edit. Prefer an
  isolated display change such as an institute's banner choice. Show its pending
  state immediately and retain it until confirmed. On explicit rejection, restore
  the server value while retaining the attempted input for correction. On an
  uncertain transport failure, check the saved record before offering a retry.
  A late GET or Realtime event must not duplicate or overwrite the pending edit.
- [ ] N05. Broaden only after the pilot passes. Evaluate simple display edits
  individually. Skill descriptions, eligibility, permissions and role requirements
  can change recommendations or access and need confirmed-save handling.
  A background job is appropriate only for identified slow work with durable
  status, retry and failure recovery. Returning before database durability would
  require a separate durable operation receipt.
- [ ] N06. Verify and merge each completed phase locally. Compare before/after
  timings on the same build mode and fixtures. Test delayed success, validation
  failure, lost success response, offline failure, duplicate clicks, competing
  edits, newer edits arriving before older responses, two tabs, logout during a
  request, revoked access and different programs acting together. Preserve exact
  scores, completion gates and placement capacity. Keep the release workflow's
  existing branch, test and local-merge sequence.

### UI state contract

| Situation | What the user sees |
| --- | --- |
| Local form validation fails | Field guidance and the preserved input |
| A confirmed-save operation is pending | Saving or Publishing status with repeated submission blocked |
| A reversible optimistic edit is pending | Immediate visual preview with a Saving indicator |
| The API confirms the saved record | Confirmed values and success feedback |
| The API explicitly rejects the operation | Error guidance and recoverable input, with the authoritative value restored |
| The response is lost or the outcome is uncertain | Checking saved status, followed by reconciliation before retry |

Optimistic updates change the displayed pending state. Their rollback changes
the browser view. Database rollback is controlled by the server transaction.
An operation that committed before its response was lost requires reconciliation.
Success must describe what the server has confirmed. For example, a saved email
request can be queued while delivery remains pending.

Full server rendering can be evaluated later if the measured first render is
dominated by browser startup or dependent requests. It still needs database
reads and save acknowledgements. The initial work should use the existing
React and Django architecture and isolate the actual delays.

Reference definitions follow the
[React optimistic state guide](https://react.dev/reference/react/useOptimistic)
and [MDN server rendering explanation](https://developer.mozilla.org/en-US/docs/Glossary/SSR).

### N01 baseline results

The baseline uses application revision `11ed70d`. The production browser run
used synthetic records with no artificial latency. An additional PostgreSQL
profile used an owned disposable cluster at two fixture sizes. The configured
database probe enforced read-only transactions and recorded only timings,
counts and response sizes.

| Browser route, cold entry | API requests | API response bytes | Visible cards or heading |
| --- | ---: | ---: | ---: |
| Admin batches | 8 | 16,844 | 2,650 ms |
| Admin assessments | 6 | 14,240 | 1,158 ms |
| Admin placements | 8 | 21,110 | 1,035 ms |
| Admin taxonomy | 6 | 14,240 | 784 ms |
| Instructor roster | 7 | 9,501 | 933 ms |
| Student assessments | 3 | 3,031 | 688 ms |
| Student results | 3 | 3,031 | 628 ms |

The first browser case includes cold module work. These are single-run local
timings. Request counts and bytes provide the repeatable before/after comparison.
Warm Tourism/Entrepreneurship switches in batches and assessments used zero
GETs, settling in 269/243 ms respectively.

The admin scope picker starts full collection reads before selection. Required
organization choices begin 156–421 ms after unnecessary reads in the measured
batch/assessment cases. Admin background preparation still requests the old
IC-only skill endpoint. Placement preparation warms a 500-row history URL that
differs from the workspace's scoped first-page URL. N02 will address those paths
using the existing cache.

The configured database's new connections took 852–1,366 ms across three
samples, with same-connection SELECT 1 taking 117–183 ms. Median direct view
times were 3,299 ms for instructor dashboard recommendations (18 SQL), 4,128 ms
for full analytics (24 SQL), 8,108 ms for partner listings (53 SQL) and 5,659 ms
for the roster (34 SQL). These exclude HTTP, connection setup and browser work.
Student profile/results reads attempted work prohibited by the read-only guard,
so the probe stopped those cases. Synthetic student browser checks succeeded.

The loopback PostgreSQL profile at 200 students/20 batches measured admin
overview at 110 ms/20 queries/47,857 bytes and full analytics at
153 ms/24 queries/320,056 bytes. Query counts stayed constant as fixtures grew
from 20 to 200 students. The configured database round trips explain a substantial
part of the observed local wait. Connection policy and service region changes
still require matched deployment measurements.

Receipts are under `work/navigation-baseline-uxz255ah/`,
`work/optimization-review-postgres-zh8t9l7t/` and the refreshed
`work/local-performance-2026-10-30/`. No configured records were changed.

The save profile used disposable PostgreSQL with external publication disabled.
Warm institute banner patches took 48–61 ms with 12 SQL statements, including
audience and event persistence. A first request with cold imports took 4.9 s.
Drafts with 20 MCQs took 196–276 ms and 133 operation SQL statements. Drafts
with 100 MCQs took 666–725 ms and 613 operation SQL statements. Per-question
category lookups and individual question/choice inserts are a measured follow-up
for N03. Preserve the current validation, transaction and error-recovery behavior
when batching those writes. Receipt `work/optimization-review-postgres-mmi9q7la/save-profile.json`.
