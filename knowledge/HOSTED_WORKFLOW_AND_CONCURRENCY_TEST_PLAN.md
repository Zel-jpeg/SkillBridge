# Isolated hosted workflow and concurrency verification

Active preparation checkpoint: 30 October 2026. This document records planned
checks separately from executed evidence. Local instructor-first API rehearsal
has passed; no hosted workflow or load run has passed yet. Earlier
[local workflow](LOCAL_WORKFLOW_ACCEPTANCE.md) and
[performance](PERFORMANCE_VERIFICATION.md) results do not establish hosted capacity.

**Current outcome:** hosted API workflow completed after reconciled failures;
reliability/performance/browser verification is not fully passed. All three test
services and the database volume were deleted; final inventory has zero services,
zero volumes and no pending patch. See the definitive
[hosted test results](HOSTED_TEST_RESULTS_2026_10_30.md). Configuration/staged-only
descriptions below are the historical preparation snapshot, not running resources.

## Authorization and isolation

The owner requested the complete admin/instructor/student workflow, synthetic
accounts and records with cleanup afterward, and concurrent assessment answering.
The owner selected an isolated hosted test environment and an initial 10 students,
increasing only after satisfactory results. Example workload: ten required
assessments with ten questions each, or 100 questions per student in total.

Production is unsuitable for synthetic catalog testing: category/position changes
invalidate global recommendation provenance and placement draft reconciliation
affects shared capacity across eligible students. Existing finalized competency
and an active suggestion were observed by aggregate read-only inspection. No
production record is classified as disposable.

Railway preparation now exists in a **separate private project**, not a duplicate
of production. No production variables, database rows, signing key or provider
credentials were copied. No production deployment or configuration was changed.

| Resource | Prepared target |
| --- | --- |
| Project | `SkillBridge-Test-20261030` — `0dd9199b-4ce2-4d86-a5c8-b472c2be9659` |
| Environment | `isolated-test` — `db8ce536-1e93-4181-9740-e6c5e0a5f39c` |
| API | `Test-API-Capped` — `a8595b64-26ce-4ec9-ac01-24f628342baf` |
| Frontend | `Test-Frontend` — `9887fd03-34bb-4d8f-9f50-50b38215a76a` |
| Database | `Test-Postgres` — `5cd11f46-afce-4402-b539-c41e90af7f92` |
| Database volume | `postgres-volume` — `c8f58810-6a11-4fd3-a362-959dea8580fa` |
| Pending patch | `6a9f2136-4c25-4678-a73f-46c330adcddf` |
| Source | `Zel-jpeg/SkillBridge`, pinned `3511906e790ae0efd237ba28ac1041ca70d42baf` |

The project and three empty service shells are created, but their source,
configuration, variables and volume are **staged only**. They have no deployments.
The patch review reports no destructive changes.
Do not click Deploy merely to inspect this preparation: applying the patch starts
billable database and application resources. Paid deployment approval is pending.

## Staged application configuration

- Railpack, Python backend root `/skillbridge-backend`, same production requirements.
- Build: `python -m pip install -r requirements-production.txt && python manage.py collectstatic --noinput`.
- Pre-deploy: `python manage.py migrate --noinput`, timeout 300 seconds. This must
  resolve exclusively to the new database, never the production Supabase host.
- Start: `gunicorn core.wsgi:application --worker-class gevent --workers 2 --worker-connections 1000 --timeout 120 --bind 0.0.0.0:$PORT`.
- Health: `/api/health/`, timeout 120 seconds; one replica in `us-west2`;
  serverless off; failure restart maximum two.
- PostgreSQL SSL image major 17, separate data volume, new generated database
  password, `skillbridge_isolated_test` database and private service references.
  `DB_SSLMODE=require` remains in effect. Exact image digest/version must be
  recorded after deployment; a major tag is not an immutable digest.
- API signing key was freshly generated for this project and is not recorded here.
  `DEBUG=False`, port 8080, allowed hosts use the new public domain plus Railway's
  healthcheck hostname. No wildcard production allowlist is introduced.
- Outbound mail and production storage credentials are blank. Email backend is
  in-memory, SMTP fallback is off, and no email worker is created. Queue behavior
  can be checked; delivery through Brevo is outside this synthetic run.
- Google client ID is blank until a test origin and a controlled real
  sign-in are arranged. Synthetic application sessions must never be described
  as proof of Google OAuth. No Google validation bypass may enter production.
- API domain reserved: `test-api-capped-isolated-test.up.railway.app`.
  Frontend domain reserved: `test-frontend-isolated-test.up.railway.app`.
  `ALLOWED_HOSTS`, `FRONTEND_URL` and frontend `VITE_API_URL` use these test
  domains exclusively. A reserved domain is not evidence of a healthy deployment.
- The test frontend is pinned to the same commit, root `/skillbridge-frontend`,
  build `npm run build`, port 8080, `RAILPACK_SPA_OUTPUT_DIR=dist`, health `/`.
  No custom start command disables Railpack's static SPA detection. Official
  [Railpack Node documentation](https://railpack.com/languages/node/) specifies
  Caddy static serving and SPA fallback. Its runtime limit is 0.5 vCPU / 0.5 GB.
  This temporary host avoids changes to the owner's live Vercel alias. Vercel's
  `vercel.json` response headers are not applied by Caddy; separately verify live
  Vercel CSP/integrations instead of claiming this tests their exact behavior.

## Remaining environment gates

- [x] Railway connection verified and production service configuration read.
- [x] Separate private project created without duplicating production.
- [x] API source, commands, TLS, database references and provider isolation staged.
- [x] Separate PostgreSQL service and volume staged; no workload running.
- [x] Staged patch reviewed: only new-project service updates/volume creation,
  no destructive diff and no production resource IDs.
- [x] Resource caps staged and read back: API **2 vCPU / 2 GB**, database **0.5
  vCPU / 0.5 GB**, frontend **0.5 vCPU / 0.5 GB**. The connector initially returned
  `Service Instance not found` with limits on staged-only service creations. This
  was resolved by creating empty, undeployed shells first and staging source and
  limits onto them. The earlier two pending creations were cancelled before any
  deployment; they contained no data. Caps are in the pending patch, not yet live.
- [ ] Verify volume size and cost; the staged template inventory reports size as
  null, so a 1 GB assumption is not an actual provisioned limit.
- [x] Owner approved the short isolated hosted test and cleanup; no additional
  billing allowance or production change was approved.
- [ ] Provision healthily, verify server/database identity and SSL, and capture
  actual CPU, RAM, PostgreSQL version and selected/actual spaCy model.
- [x] Separate frontend source/build/health/resource limits and test API/CORS
  origins staged. Browser runtime, routing and actual headers remain unverified.
- [ ] Provision synthetic accounts through an isolated, narrowly guarded server
  setup script; mint short-lived sessions using the actual staged server key.
  Do not copy production sessions, weaken application authentication or persist
  session tokens in tracked files/reports. UI authentication bootstrap remains to
  be implemented and reviewed before browser acceptance.
- [ ] Arrange isolated Supabase-compatible storage for real image/evidence upload
  checks, or explicitly leave these external integrations unverified. Current
  blank credentials intentionally prevent production bucket access. Do not claim
  upload success from a mocked provider. New storage costs require a concrete quote.

## Workflow acceptance matrix

Owner clarification: the scenario must **start with adding the instructor**.
Only the initial administrator may be bootstrapped. The test must exercise admin
instructor creation, instructor batch creation and assessment authoring/publication
through normal application routes; do not pre-seed these operational entities and
describe that as workflow acceptance. The local rehearsal follows that order,
then prepares partner positions, enrollment, profiles, assessment answering,
combined evidence, suggestions and explicit approval. Synthetic student/instructor
JWT sessions stand in for provider sign-in and are labelled accordingly.

Use a unique run marker and exact created-record manifest. Capture expected and
observed values, endpoint/status and redacted evidence for every row.

| Flow | Required assertions |
| --- | --- |
| Admin and instructors | Create approved instructor; duplicate/normalized email handling; correct role access; no actual notification delivery |
| Batches and enrollment | Create instructor-owned batch; import/preview/commit synthetic students; idempotent retry; held notices; roster isolation |
| Student setup | Save synthetic profile and deliberate map pin; required setup/access gates; cross-student and cross-instructor denial |
| Catalog | Categories/skills/tags, two partners and at least three positions; requirements, locations and explicit slot totals |
| Assessment authoring | Ten published required assessments, ten questions each, MCQ/true-false/identification; valid choices; used-content locks |
| Attempts | Randomized order; stable repeat-start identity; answer drafts and recovery; malformed/foreign-choice rejection; duplicate finalization |
| Grading | Known mixed correct/incorrect/omitted answers; exact raw/max/percentage per category and assessment; identification trim/case rules |
| Combined evidence | Required-completion lock until all ten complete; sum raw/max across eligible evidence, not average of assessment percentages |
| Recommendations | Actual spaCy Medium versus fallback; category/NLP/location components and 60/25/15 total; stable ranking order; current provenance |
| Placement | Suggested students per position; provisional versus official remaining capacity; explicit approval; competing approval cannot overbook |
| History and lifecycle | Retake resets only intended evidence, relocks/re-unlocks correctly; prior attempts and placement snapshots retained; active batch boundaries |
| Browser and reports | Admin/instructor/student views agree with saved API data; SSE/reconnect freshness; role-scoped PDF/XLSX exports; desktop and phone layout |
| Cleanup | Revoke test sessions; delete only manifested test records/artifacts or exact dedicated resources; verify test API/DB/volume no longer bill |

Test an unassigned second instructor and second batch for access isolation.
Use a separate small capacity race scenario; suggestions are not official
approvals and alternate recommendations do not reserve additional seats.
Follow [assessment review](../.agents/skills/skillbridge-assessment-review/SKILL.md),
[recommendation review](../.agents/skills/skillbridge-recommendation-audit/SKILL.md),
[recommendation contract](RECOMMENDATION_CONTRACT.md) and
[placement rules](PLACEMENT_DRAFT_IMPLEMENTATION.md).

## Bounded concurrency workload

Start with a single smoke journey, then the owner's selected **10 simultaneous
students**. Each student completes ten ten-question assessments. Synchronize
final submissions so the combined scoring/NLP/placement-read workload is exercised,
not merely question downloads. Keep answer keys and expected scores outside client
responses. Use separate synthetic cohorts for repeat measurements; do not reset
real attempts or retry writes blindly after timeouts.

- First concurrency stage: 10 students. Next candidate: 25 only after correctness,
  health and latency pass. Higher levels require reviewing those results first.
- Per stage: at most 15 minutes and 5,000 requests, global launch pacing at most
  10 new requests/second; no unbounded retry loops. Preserve normal API throttles.
  This measures a bounded student-session workload, not arbitrary maximum RPS.
- Include one draft autosave per assessment, normal starts/submissions/results,
  small roster/staff reads and separate open-SSE checks. Do not generate a write
  for every simulated keypress or load third-party Google/map/email endpoints.
- Stop immediately on score/ownership/capacity inconsistency, three consecutive
  server failures/timeouts, failed health recovery, OOM/restart, budget/time bound
  or unexpectedly detected production target. Record 429s and stop to inspect;
  do not disable throttles to obtain a passing number.
- Report p50/p95/max, sample count, status/error counts, request rate, actual
  overlap, CPU/RAM/restarts, selected/actual model and database version. Separate
  the first model-load sample from warm samples. Small samples do not establish a
  reliable long-tail percentile.
- Proposed comparison thresholds reuse the local targets: normal read p95 under
  2 seconds, warm submit/results under 5 seconds, first NLP result under 15 seconds;
  report misses honestly. Do not call them a proven hosted SLA.

## Cost and teardown

Current official [Railway rates](https://docs.railway.com/pricing/plans) list
RAM at $10/GB-month, CPU at $20/vCPU-month, volume at $0.15/GB-month and egress at
$0.05/GB. With the **staged**, verified caps above (three services totaling 3 vCPU
and 3 GB), two hours at maximum CPU/RAM would be about $0.25 compute, plus
disk/network and any additional storage service. A 1 GB egress example adds $0.05.
This is an estimate, not an enforced invoice cap; actual volume and elapsed
time must be checked during launch. The template volume uses its plan default;
its staged size is null and attempts to replace it before provisioning were
rejected because it is not yet provisioned. The existing mount remains unchanged.
Do not report a configured 1 GB volume. The owner explicitly selected **included
$5 usage only**, with **no extra billed usage approved**, and instructed that
tests remain undeployed until the running-cost estimate is clearer. The earlier
$1 additional-usage proposal is not authorized. Start paid services only after
the owner reviews the normal-usage forecast and explicitly releases this hold;
remove task-owned compute and the exact test volume after the run, including on
failure, with the applicable deletion confirmation. Platform billing/audit logs
may remain; do not promise erasure of provider history.

Do not set a low workspace hard spending limit for this test: Railway's
[workspace cost controls](https://docs.railway.com/pricing/cost-control) can stop
production as well. A two-hour test window needs active monitoring and cleanup,
not a claim that an automatic TTL has been installed. No automation was created.

Railway PostgreSQL in the same region differs from production Supabase's network,
pooler, extensions and resource allocation. Results describe this staging setup;
they do not certify identical production performance. External Google, email and
storage integration checks must have their own evidence or remain unverified.

## Resume checkpoint

**Final cleanup checkpoint:** approximately 11:55 Manila, 30 October. All test
services and the exact database volume are removed. Final Railway inventory:
zero services, zero volumes, no pending patch. Production remains SUCCESS with
its original deployment and no staged changes. No task-owned hosted compute is
left running. The empty private test project has no resources. Normal provider
retention can keep deleted-volume data recoverable for up to 48 hours.

Latest completed diagnostic: `hosted-keepalive-diagnostic-results.json` passed
after verifying and resuming the unfinished Assessment 9 draft, then completing
all ten students' 100-question evidence, real spaCy rankings, retake and placement.
The two earlier 502s remain failures. A further 100-read test had zero errors but
p95 2.803 s and max 12.472 s; do not call the proposed read target passed or infer
the exact 502 cause from a small follow-up. Browser use stayed disabled, so UI and
real Google/provider tests remain unverified. Higher concurrency was not run.

Local test credentials, decrypted sessions and private key were removed after
final infrastructure verification. Redacted evidence and harnesses
are retained in ignored `work/hosted-test-2026-10-30/`. On 30 October, the owner
approved retirement of the test branch without merging. Its clean temporary
worktree and local/GitHub branch were removed after verifying the remote tip
`8216e0d`. A verified Git bundle preserves both test-only commits at
`work/hosted-test-2026-10-30/branch-archive.bundle`, requiring base `3511906`.
This cleanup made no application changes or commits on main and retained all
existing documentation edits and test reports.
Next work is investigation/review of the recorded connection/latency findings and
remaining browser/provider coverage. A future hosted run must create new disposable
resources and credentials; the resource IDs below are deleted historical targets.

Hosted launch began at approximately **11:30 Manila, 30 October**, using the
existing isolated project and the owner's explicit short-run authorization.
Production was not mutated. Initial API/frontend Git source was pinned at `3511906`.
Initial deployment IDs: API `83f2550d-9068-489e-b353-f2fa04bafcda`, frontend
`31418919-b81b-4ed4-bf6a-0eeb9b5e2740`, PostgreSQL
`d806bc26-f689-45a5-a654-dd0b3ee7637d`. Record completed results and teardown below;
the historical staged-only descriptions above do not mean resources are still off.

Automatic review rejected (1) a public PostgreSQL TCP proxy and (2) a temporary
token-entry browser page, then initially rejected deployment because that page
might be included. The safer configuration was explicitly reread: no TCP proxies,
frontend build exactly `npm run build`, no helper page or production source edits.
The temporary local helper HTML was removed. A subsequent reviewed deployment of
the corrected configuration succeeded. No rejection was bypassed through another
tool or indirect public exposure.

Account setup uses a guarded, one-off private API pre-deploy command, not a public
endpoint: it checks exact project/environment/service IDs, private DB hostname,
test database and run marker before creating only the initial synthetic admin.
Optional session exports use normal server `AccessToken.for_user` (45-minute
expiry), including existing revocation binding, and encrypt the payload to an
ephemeral local public key before logging. Plaintext credentials are not emitted
to deployment logs or tracked files. The API tests use these signed synthetic
sessions; browser roles still require normal Google sign-in. This preserves
application authentication and does not claim real Google provider verification.

Hosted progress: admin login and creation of two synthetic instructors passed
(3 HTTP requests). Instructor batch/assessment/categorization/catalog/enrollment
setup passed (35 HTTP requests). Ten students were enrolled with held notices;
database PostgreSQL 17.11 and TLS were verified through the private fixture.
Public test frontend/API readiness and exact test CORS origin returned 200.
Three simultaneous admin/instructor/student SSE streams delivered connected plus
heartbeat events and closed cleanly; subsequent health returned 200.

**Hosted reliability has NOT passed.** The initial ten-student run got a Railway
HTTP 502 on Assessment 8 submission at 11:40:58 Manila, with upstream connection
closed unexpectedly (1 ms). It stopped at 80 submit requests; the harness surfaced
a secondary broken barrier after the first failure. Read-only review found nine
finalized Assessment 8 attempts and one unfinished (synthetic student ID 7).
Resuming that exact saved draft preserved revision 1 and graded 7/10 once.
A bounded continuation then encountered the same 502 on Assessment 9 at 11:44:21.
Both failures remain in `hosted-run-results.json` and `hosted-recovered-results.json`
under the ignored harness folder; they are not overwritten by later passing checks.
No load increase is authorized by a passing result, because no passing hosted run
exists yet. Application logs show no associated exception/worker crash, and sampled
CPU/RAM are low; the exact cause is not established.

The frontend initially inherited the repository-root backend build command and
failed with python not found. A separate `codex/hosted-workflow-test` worktree and
branch were pushed. Its final commit `8216e0de4e7c5c817a666252af1f01fe05f91cef`
differs from main only by omitting root `railway.toml`, so native service settings
can control each test service. No application source or main was changed. An earlier
commit adding per-service JSON config files was superseded after Railway rejected
new legacy config paths. The test frontend subsequently built and served 200.

A test-only diagnostic now uses the same application tree on that test branch,
with native API start command adding `--keep-alive 65 --access-logfile -
--error-logfile -`. Gunicorn's default keepalive is two seconds and its official
[configuration source](https://github.com/benoitc/gunicorn/blob/master/gunicorn/config.py)
describes higher values behind load balancers. This is a hypothesis-driven isolated
experiment, not a production fix or proven Railway-specific recommendation. The
production start command is unchanged. Wait for the diagnostic deployment to
settle, reconcile Assessment 9 before any retry, and resume only unfinished work.

Browser automation still reports disabled in Work settings. The owner said they
would enable it; no browser auth bypass or alternate browser controller is used.
Admin/instructor/student UI, real Google login and browser exports remain unverified.

At 11:48 Manila, diagnostic API deployment
`9fe8aca6-c520-4cf4-b0cd-5405448309de` is building/deploying with longer keepalive.
Read-only Assessment 9 reconciliation found one unfinished attempt (synthetic
student ID 5), with nine finalized. The prepared continuation
`finish_keepalive_diagnostic.py` checks its saved revision/answers before retry,
then tests the final assessment, rankings, retake and placement without replaying
any finalized work. It writes a new diagnostic result file, preserving failures.
Wait for deployment SUCCESS before this continuation. Browser recheck remained
disabled; do not hold billable services open waiting for UI access.

The actual test PostgreSQL volume is 5,000 MB provisioned. Railway bills used
storage, not a falsely assumed 1 GB configured volume. Current resource IDs above
remain the exact cleanup targets; deletion must include this volume as well as
all three test services. Do not delete production or the user's other project.

Latest owner steering, 30 October: after discussing a short hosted test followed
by deletion of its services, database and volume, the owner said to proceed with
testing the plan. This releases the prior deployment hold **for that temporary
isolated test and cleanup**, not for production changes or ongoing staging
hosting. Preserve the included-$5-only constraint; no additional billed allowance
was granted. Reinspect the prepared patch before launch and start the test window
only when credentials/bootstrap/access and cleanup are ready.

At the start of this continuation, the Railway connector tools are absent and the
local CLI reports Unauthorized. No paid workload was started. Access must be
restored before applying the prepared isolated-test patch; do not request another
deployment approval for the same already-authorized short run.

Local rehearsal prepared on 30 October under ignored
`work/hosted-test-2026-10-30/{run_local.py,local_journey.py}`. It disables dotenv,
starts its own fresh PostgreSQL cluster on a generated loopback port, migrates
only `test_hosted_rehearsal`, bootstraps only the admin and calls real HTTP API
routes. No production `.env`, database, provider credentials or paid service is
used. Application authentication/permission middleware, normal throttles, scoring
and actual NLP are enabled. The local server is threaded Django WSGI with backlog
64, **not Linux Gunicorn/gevent**; Google identity is not verified by test sessions.

First complete rehearsal: **398 HTTP requests, 602 passing assertions**; instructor
creation, batch, ten published ten-question assessments, ten enrolled students,
drafts, varied 70/100 and 80/100 results, completion gates, duplicate submit 409,
actual spaCy Medium rankings, retake history/82/100 updated total, five provisional
seats, explicit approval and role boundaries passed. Evidence:
`work/workflow-rehearsal-f1vz5vis/journey-results.json` and `journey.log`.
This establishes neither hosted nor browser-visible acceptance. First concurrent
final submissions were slow: all-submit p95 **12.206 s**, max **12.559 s**. Overall
correctness passed; do not call the 5-second warm-submit performance target passed
from that combined sample.

Final local comparison: **730 HTTP requests, 1,163 passing assertions**, with
two successive cohorts of ten students (not twenty concurrent users). Each
student completed ten ten-question assessments: 200 finalized initial attempts,
2,000 offered question instances and one additional retake. Correctness checked
per-category raw/max/percentage, assessment raw/max, completion locks and combined
70/100 or 80/100 totals; the approved retake changed only the intended contribution
to 82/100. Actual saved rankings and strict model checks used `spacy_md`, without
fallback. Two instructors, separate batch ownership, two partners and three
positions with five total seats were created through HTTP. Five provisional
suggestions respected capacity; only explicit approval created an official
allocation. Cross-role/scoped denials and duplicate finalization returned expected
403/404/409 responses. Those expected negative checks are not server failures.

| Local HTTP flow | Samples | p50 seconds | p95 seconds | Max seconds |
| --- | --- | --- | --- | --- |
| First cohort, assessments 1–9 submit | 90 | 0.356 | 0.530 | 0.594 |
| First cohort, final assessment/model first use | 10 | 8.199 | 8.452 | 8.452 |
| Warm cohort, assessments 1–9 submit | 90 | 0.383 | 0.631 | 0.830 |
| Warm cohort, final assessment | 10 | 0.547 | 0.692 | 0.692 |
| Combined result GET, both cohorts | 20 | 0.146 | 0.247 | 0.255 |

Evidence: `work/workflow-rehearsal-76a_g3hc/journey-results.json`, `journey.log`,
and `postgres.log`; the latter confirms clean shutdown. First-use p95 meets the
proposed 15-second first-model target in this local run; warm samples meet the
5-second target. Small sample percentiles and the earlier 12.559-second first-use
maximum remain visible; neither is a production guarantee. The 10 sessions have
barriers before submissions and a global 10-request/second launch pace. Do not
describe this as twenty users, ten full browsers, a maximum-throughputput test or
an unpaced ten-request burst. HTTP overlap was not separately instrumented.

The final helper dropped its exact disposable database before stopping its
PostgreSQL cluster; remaining stopped cluster files were removed after checking
the path and absent postmaster PID. Synthetic records and local sessions no longer
have a running database. Redacted logs/results and the ignored harness remain.
Compilation and Git whitespace checks passed; no application files changed.
No browser/real Google sign-in, real email, image/evidence storage, PDF/XLSX export,
SSE transport, competing capacity approval race, complete archive/rollover flow,
Linux/gevent memory behavior or hosted capacity is certified by this rehearsal.
These remain explicit remaining coverage items. Concurrency was not increased.

The first sandboxed initdb stalled and was stopped using verified task-owned PIDs.
The first runnable harness assumed list-shaped scores, whereas the current API
returns a category-keyed object; that harness assumption was corrected without
application changes. Both are retained as failed preparation evidence, not passes.
The three stopped rehearsal data directories were removed after checking their
exact workspace paths and absence of postmaster PID files. Evidence logs remain.
The runner now drops its exact disposable database before stopping PostgreSQL.

Owner budget constraint, 30 October: the owner wants the existing Hobby plan to
support the live system through 30 November. Their Usage screenshot shows cycle
30 October–30 November, $0.01 used and $5 included. This is not interpreted as
approval for additional billed usage. The owner has now confirmed included usage
only and an explicit deployment hold pending a clearer running-cost estimate.
The three test services still have no deployments. Do not set a workspace compute
hard limit or change production resources merely to enforce a guessed budget.

A read-only one-hour production metrics sample at approximately 10:51 Manila
time found current RAM 0.293085184 GB, mean 0.288280509 GB, and negligible sampled
CPU/network use. Holding the current RAM for 31 days at the published per-minute
rate would cost about $3.02 in RAM alone. This is a quiet baseline, not a total
bill forecast: CPU/egress/other services and later NLP/model loads add usage.
Reassess after representative normal activity before promising $5 coverage.
Evidence: `work/hosted-test-2026-10-30/budget-baseline.json` (ignored).
The screenshot's Agent Usage Limit applies to Railway Agent LLM use, independently
of hosting Compute Usage. Included $5 resource usage is offset against the Hobby
subscription; overages can be billed. A compute hard limit instead takes workloads
offline when reached. The shown cycle boundary does not establish the exact
renewal time or guarantee availability through the end of 30 November.

Branch: `codex/railway-configuration-migration`, HEAD `3511906` at preparation.
Existing redeployment/local setup/migration documentation edits are preserved.
No application edits, hosted test-data writes, paid deployments, merges or pushes
were made for this preparation. Local synthetic data was created and cleaned up.
Three empty service shells exist; their source,
configuration and workload deployment remain pending.

Actual checks: public frontend/API reachability and new-domain CORS preflight;
aggregate production baseline; Railway production read; new-project staged source,
build/start/migration/health config and inventory; non-destructive patch review.
No hosted synthetic user, assessment, recommendation or load result exists yet.
Local rehearsal results above are distinct from hosted verification.

Next step: preserve the passing instructor-first local rehearsal and finish the
remaining browser/integration scenarios locally as access permits. Reassess normal
usage after 24–48 hours, including whether normal assessment activity has loaded
the NLP model; a quiet baseline cannot establish that cost. No periodic monitor
or wakeup is configured. Keep the test patch unapplied. Only after the owner
reviews a forecast that preserves the included $5 and explicitly releases the
deployment hold may this test project's patch be applied; verify actual volume
size, health, TLS and frontend runtime, then execute tests with active monitoring.
Never apply this patch or an imported whole-project specification to production.
