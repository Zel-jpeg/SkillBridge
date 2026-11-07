# SkillBridge system optimization and Realtime plan

Prepared 6 November 2026 from the current `main` checkout. The source review and
frontend build baseline are complete. The current-version benchmark, application
optimization and private WebSocket pilot are pending. This plan covers browser
performance, API and database work, assessment and placement operations, external
providers, hosting and recovery. The screenshot shows the Supabase Realtime
Inspector for the production project. Use a separate project for the pilot.

Updated 7 November 2026 to include UI motion from the user's animation reference.
The motion work below is planned. Its durations and effect choices are proposed
starting values to verify against current components and measured performance.

## What the current system does

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

**Pilot flow.** Django completes the existing business operation and writes the
recipient-scoped `ChangeEvent` through its current post-commit hook. In staging,
attach a guarded `AFTER INSERT` relay to that event table for opted-in recipients.
Use private `realtime.send()` with an allowlisted invalidation topic and an opaque
deduplication key.
Keep the SSE log row if Broadcast fails and test that the relay adds little time to
the publication callback. If isolation or callback cost fails, disable the relay and
evaluate a separate bounded publisher before retrying the pilot. Send no application
records, entity IDs, answers, scores or tokens in messages. React feeds those hints
into the existing cache invalidation path. Django enforces authorization on every
resulting GET. [Existing event publication](../skillbridge-backend/api/change_events.py)
· [Broadcast from the database](https://supabase.com/docs/guides/realtime/broadcast#broadcasting-from-the-database)

**Identity and privacy.** Keep Django SimpleJWT for API access. Verify in staging
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

## Checkpoint and next step

- [x] Review current loading, analytics and freshness paths, prior local/hosted
  evidence and Supabase Realtime requirements. Establish frontend bundle sizes.
  Review revision `e485935`. The local production build passed with
  `npm.cmd run build -- --outDir ../work/system-optimization-build-20261106`.
- [ ] Capture a current-version baseline for all three roles. First profile
  `/api/management/analytics/` on a staff dashboard and an unrelated staff route
  with the bell closed. Reproduce the hosted long-tail reads with matched runs.
- [ ] Implement the measured first-load improvements, rerun the benchmark and
  record which remaining workstreams have evidence for a change.
- [ ] Implement and verify UI motion in component groups against the animation
  plan, including reduced motion, interrupted transitions and assessment safety.
- [ ] Run the private WebSocket pilot, verify security and recovery, and document
  the go/no-go decision with measured capacity and latency.
- [ ] Verify staged and live read-only smoke checks for each authorized release.
