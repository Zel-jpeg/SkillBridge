# Hosted workflow test — 30 October 2026

**Result: workflow completed after recovery; hosted readiness is not fully passed.**
The initial concurrency run and its first continuation each encountered a real
Railway 502. A later test-only keepalive diagnostic completed the workflow, but
latency targets and browser/provider coverage remain open. Do not summarize this
as a clean end-to-end pass or a proven maximum student capacity.

## Environment and scope

The owner authorized a short hosted test and cleanup, using only their included
Hobby usage. Testing ran in separate private Railway project
`SkillBridge-Test-20261030`, environment `isolated-test`, starting around 11:30
Manila. Production database, credentials, records and service configuration were
not changed. The production service remained SUCCESS with no staged changes when
checked after testing.

The API used Gunicorn 25.3.0, two gevent workers, one `us-west2` replica, a 2 vCPU /
2 GB runtime cap and actual spaCy Medium. PostgreSQL 17.11 had its own private
TLS connection, volume and 0.5 vCPU / 0.5 GB cap; the temporary Caddy frontend had
a 0.5 vCPU / 0.5 GB cap. Test storage/provider credentials were blank and no mail
worker was started. A guarded private pre-deploy fixture created only the initial
administrator and issued encrypted short-lived synthetic application sessions.
These preserve real API authentication and revocation checks, but do not verify
Google sign-in. No public database proxy or token-entry browser page was deployed.

Application code matched main `3511906`. Temporary branch
`codex/hosted-workflow-test` at `8216e0de4e7c5c817a666252af1f01fe05f91cef`
omits only repository-root `railway.toml` relative to that main commit. This was
needed because the initial temporary frontend build inherited backend Python
commands. New legacy config paths were rejected as deprecated, so native settings
controlled the test services. Main was not merged or pushed during the test.
After owner-approved cleanup on 30 October, the clean temporary worktree and
`codex/hosted-workflow-test` branch were removed locally and on GitHub without
merging. The two branch commits are preserved in a verified local Git bundle at
`work/hosted-test-2026-10-30/branch-archive.bundle` (requires base commit `3511906`).
The report and redacted test evidence remain available; runtime credentials were
removed separately during hosted cleanup.

## Completed API workflow

1. Real synthetic administrator password login; add two instructors through the
   normal admin endpoint. Welcome notices queue without external delivery.
2. Instructors create two independently owned batches; cross-owner access is
   denied. Create skill categories and ten published required assessments, each
   with ten MCQ/true-false/identification questions.
3. Administrator creates two partners and three positions with five total seats.
4. Instructor previews and commits ten synthetic student enrollments, verifies
   idempotent replay, and holds enrollment notices. Profiles save deliberate
   synthetic map pins through the normal API.
5. Ten concurrent student sessions save answer drafts and submit up to 100
   questions each. Known wrong/omitted answers produce exact per-category and
   assessment scores, required progress and 70/100 or 80/100 combined totals.
   Duplicate finalized submissions return 409; students cannot call admin actions.
6. Real saved recommendations use spaCy Medium; public category/NLP/location
   components reproduce the 60/25/15 total within their documented rounding.
7. Instructor grants a specific retake. Starting it relocks final results;
   completion changes only its contribution, producing expected 82/100.
8. Shared suggestions allocate five provisional seats. Student approval is denied;
   explicit staff approval succeeds. Instructor roster agrees with all ten
   completed students. Placement-report JSON contains the synthetic approval.

This was one ten-student hosted cohort, **not** 25 or 100 concurrent students.
The runner paced launches at ten requests/second and used submission barriers.
It is an HTTP session test, not ten full browser sessions. There was no automatic
retry of failed writes or disabling of normal throttles.

## Failures, reconciliation and diagnostic

| Stage | Observed result |
| --- | --- |
| Instructor creation | Pass: 3 HTTP requests |
| Batch/assessment/catalog/enrollment setup | Pass: 35 HTTP requests |
| Initial concurrency run | Fail: 502 on Assessment 8 submit at 11:40:58 Manila; 280 requests recorded |
| First recovery/continuation | Saved draft recovered correctly, then fail: 502 on Assessment 9 submit at 11:44:21; 32 requests recorded |
| Test-only keepalive continuation | Pass: 52 requests; complete final assessment, ranking, retake and placement |
| SSE transport | Three role-scoped streams received connected and heartbeat events, then closed; health 200 |
| Final connection diagnostic | 100 result reads, ten sessions and three-second idle gaps; zero HTTP errors |

Both 502s reported `connection closed unexpectedly` from the upstream in about
1 ms. No associated Django exception, worker crash or memory exhaustion was
observed. The first harness reported a secondary broken-barrier exception after
the first HTTP failure; raw samples identify the 502. Its failure remains retained.
Read-only review showed nine finalized attempts and one unfinished in each affected
assessment. Only the unfinished attempt was resumed. Its exact saved draft and
revision survived, and normal submission graded it once; finalized work was not
replayed.

The test-only diagnostic added `--keep-alive 65` and access/error logging. Gunicorn
defaults to two seconds and suggests higher keepalive behind load balancers in
its [official configuration source](https://github.com/benoitc/gunicorn/blob/master/gunicorn/config.py).
The later continuation and 100 reads had no 502s. That is a small observational
comparison, **not proof of root cause or a production fix**. Production retains
its original start command. Higher concurrency was not attempted.

## Client-observed timings

| Flow | n | p50 seconds | p95 seconds | Max seconds |
| --- | --- | --- | --- | --- |
| Initial submit attempts, including one 502 | 80 | 2.006 | 2.720 | 2.827 |
| Diagnostic first-use final submissions | 10 | 5.029 | 6.209 | 6.209 |
| Diagnostic combined-result reads | 10 | 0.898 | 0.996 | 0.996 |
| Diagnostic retake operations | 3 | 0.961 | 1.044 | 1.044 |
| Final 100-read check | 100 | 0.672 | 2.803 | 12.472 |

These include client/network/proxy time. First-use final scoring is below the
proposed 15-second model-load comparison target, but is not a warm-submit sample.
The 100-read p95 exceeds the proposed two-second normal-read target. Its high
maximum also needs investigation; do not mask it with the median. Small samples,
separate staging database/region and changing worker/model warmth limit any
production-capacity inference.

## Unverified and next work

- Browser automation remained disabled in Work settings even after the owner said
  they would enable it. No alternate controller or authentication bypass was used.
  Hosted click-by-click instructor/student/admin screens, physical devices,
  Google sign-in and PDF/XLSX browser downloads therefore remain unverified.
- SSE connected/heartbeat transport passed; this run did not certify the complete
  change-event recipient/reconnect/browser-cache matrix.
- Actual Brevo delivery/webhook, partner images and retake evidence storage were
  intentionally not connected to production providers. Their success is not claimed.
- A concurrent approval race, complete cycle/archive/rollover workflow and larger
  cohorts remain outside this run's completed coverage.
- Investigate the 502/keepalive hypothesis and long-tail reads, then repeat a
  complete fresh ten-student hosted cohort before increasing load or calling the
  hosted release fully verified. Any production config change needs its own
  review/authorization; none was applied during this test.

## Cleanup and evidence

The owner authorized deletion of all temporary services, database and its volume
after the test. Frontend and API deletion succeeded. PostgreSQL deletion succeeded
and detached its volume; explicit volume deletion then succeeded. Final async
verification confirmed **zero services, zero volumes and no pending patch**.
Local temporary credentials, decrypted sessions and private key were removed.
The empty test project contains no running resources. Railway's normal volume
[deletion recovery window](https://docs.railway.com/volumes/reference) can retain
deleted data up to 48 hours. Provider audit/billing history is not erased, and
[consumed usage remains billed](https://docs.railway.com/projects/project-usage).

Exact final charges were not retrieved; resource telemetry is not an invoice.
The planned two-hour window was not exhausted. No Railway cloud agent, automatic
recurring job, workspace spending-limit change or extra subscription was created.

Ignored evidence directory: `work/hosted-test-2026-10-30/`.
Keep `hosted-{staff,setup,run,recovered,keepalive-diagnostic}-results.json`,
`hosted-submission-reconciliation.json`, `hosted-assessment9-reconciliation.json`,
`hosted-sse-results.json`, `hosted-connection-check.json`, placement-report JSON
and redacted infrastructure/cleanup metadata. Remove local runtime credentials,
decrypted sessions, admin state and the ephemeral private key after verification.
