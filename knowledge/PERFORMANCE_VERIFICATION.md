# Local performance verification

Verified on 18 October 2026 for V06 with the user-accepted baseline: 200 synthetic
students, 8 positions, 2 assessments with 30 questions each and 20 simultaneous users.
Accepted targets are p95 normal reads under 2 seconds, warm submit/results under
5 seconds and first model/results load under 15 seconds. These are local acceptance
targets for this workload, not universal or hosted guarantees.

## Test conditions and evidence

Hardware: Intel Core i5-1235U, 10 cores/12 logical processors, 7.71 GiB RAM, Windows;
Python 3.13.7, Django 6, PostgreSQL 17.11 and actual spaCy Medium 3.8.0. See the exact
runtime metadata in `work/defense_audit/v06-results-varied.json` and hardware in
`v06-hardware.json`. The fixture uses the project's real React/Vite/Django code,
JWT authorization, PostgreSQL writes, scoring and recommendation implementation.
Google/email/address/map providers are test adapters; no external data is read or
written. Test password hashing is the isolated settings' fast hasher; sign-in
latency is not measured here. Provider/network delays are outside these numbers.

`v01_fixture.py` disables dotenv and creates/drops its own exact
`test_skillbridge_v01_<pid>` database at localhost:55438. The API uses a threaded
Django WSGI fixture at 8018; Vite runs at 5178. The fixture listener backlog is 64.
Its stock backlog 10 produced queue-related TCP delays when 20 clients competed;
the backlog 64 diagnostic isolated that transport limit without changing Django
application or host configuration. Do not present these results as capacity of
the stock development listener or a production worker/proxy arrangement.

The dataset starts with 20 complete students, 60 having finished the first required
assessment and 120 pending, plus 20 approved placement snapshots across 8 positions.
Each category has 15 questions per assessment. Submission runs use 3 independent
cohorts of 20 students. The final run has 0 through 19 incorrect answers per cohort,
asserts each returned raw score against that student's known expected score,
and verifies final results unlock. This tests different generated profiles,
in addition to the earlier all-correct workload. Seven normal read flows have
20 observations each; 60 reads compete with 20 open recipient-scoped event streams;
full reranking runs 3 times over the 200 student dataset. Timed runs have no other
agent test/build job competing. Event delivery correctness is separately V04;
this test measures open-stream/read cost.

The cold sample is the first real combined-results request in a new process,
including model load. The OS file cache is not cleared and the machine is not
rebooted. It is not a statistical cold-start percentile. Timings use
`perf_counter` and nearest-rank p50/p95; small-sample maxima must not be mistaken
for a strong tail-latency estimate. All measured HTTP responses have explicit
expected-status checks. Current results are 324 measured requests with 0 errors.

## Final HTTP results

Seconds, from `v06-benchmark-varied-final.txt` and `v06-results-varied.json`:

| Flow | n | p50 | p95 | Maximum | Errors |
|---|---:|---:|---:|---:|---:|
| cold results with model | 1 | 11.801 | 11.801 | 11.801 | 0 |
| student profile | 20 | 0.194 | 0.299 | 0.361 | 0 |
| student results | 20 | 0.185 | 0.298 | 0.305 | 0 |
| student catalog | 20 | 0.134 | 0.241 | 0.241 | 0 |
| admin catalog | 20 | 0.118 | 0.226 | 0.235 | 0 |
| placement report | 20 | 0.129 | 0.232 | 0.232 | 0 |
| batch roster | 20 | 0.263 | 0.579 | 0.728 | 0 |
| assessment report | 20 | 0.196 | 0.225 | 0.297 | 0 |
| concurrent submit | 60 | 3.308 | 3.628 | 3.645 | 0 |
| post submit results | 60 | 0.194 | 0.309 | 0.342 | 0 |
| results with 20 streams | 60 | 1.314 | 1.674 | 1.708 | 0 |
| admin rerank | 3 | 10.720 | 14.285 | 14.285 | 0 |

All accepted read/submit/result targets passed. The rerank maximum 14.285 seconds
is also below the existing Axios 30 second request deadline; 30 seconds is an
existing technical limit, not a new user-approved rerank usability target.
The selected and actual model were spaCy Medium. Eight position IDs and every
category/NLP/location/total component match the pre-cache reference exactly for
identical evidence. TF-IDF still fits the current student/candidate corpus.

## Browser-visible results

`v06-ui-after-upsert.json`, `v06-ui-after-upsert.txt` and
`v06-ui-artifacts/results.json` measure real Chrome phone emulation. One browser
submission competes with 19 real simultaneous HTTP submissions; it is not 20 full
browser sessions. Visible completion waits for the actual assessment title and
category scores. Under that load it took 4.826 seconds (response 3.281 seconds,
then 1.545 seconds until visible content). Two standalone warm submits took 1.751
and 1.452 seconds. Six warm final-profile renders took 1.156 to 1.540 seconds. All 9
visible samples met 5 seconds, with 0 page errors. No p95 claim is made from the
single loaded browser observation. Final screenshots are preserved.

The full accepted browser/device compatibility matrix belongs to V07; physical
phones are not claimed by emulation. Closing/unmounting streams can emit fixture
broken-pipe diagnostics; the HTTP checks and browser assertions distinguish those
from failed work.

## Measured bottlenecks and changes

- Initial concurrent submit p95=7.617 seconds and stream/read p95=2.041 seconds
  failed. The listener 64 diagnostic brought stream/read p95 to 1.637 seconds;
  submission still failed at 7.012 seconds. Evidence: initial/listener diagnostic
  JSON and logs, retained under `work/defense_audit/v06-*`.
- Thirty validated answer upserts used 197 SQL statements on create and 133 on
  update. Batched answer insert/update reduced these to 19/15 in the real grader
  profile, retaining saved answer IDs and legacy duplicate ambiguity. Validation,
  full question denominators, exact identification and outer attempt locking
  remain. SkillScore writes retain their rollback behavior. After this change
  alone, submit p95=5.550 seconds still failed.
- Repeated spaCy document processing under concurrency was measured around
  1.77 seconds p95. Successful exact text/model-instance lemma output now uses a
  bounded 512 entry/16384 character cache. Changed text/model misses naturally;
  caller lists remain independent; resource failures still produce truthful
  fallback/strict errors. TF-IDF, vectors, ranking weights and scores are not
  cached. A first HTTP run then passed submit p95=4.183 seconds, but the real
  browser exposed an additional delay.
- An artificial 800 ms success-navigation timeout was removed after confirmed
  server submission and fullscreen exit. It did not suffice by itself: visible
  loaded submissions still took 5.863 and 6.574 seconds (the latter 5.003 response +
  1.571 rendering). These failures are retained, not counted as passes.
- A real endpoint profile then recorded 111 SQL statements per submission,
  including 17 recommendation statements plus per-candidate savepoints. Batched
  PostgreSQL upserts now preserve the existing unique batch recommendation IDs,
  obsolete-candidate flags, placement links and snapshots. Stale flags and the
  upsert commit atomically; nullable legacy batch lookup behavior is retained.
  No before/after SQL-count claim is inferred without a new query profile.
  The current browser and varied-answer HTTP runs above pass.

An earlier diagnostic cold request took 20.593 seconds and exceeded 15 seconds.
After the final persistence change, the two current-source process-cold requests
were 14.125 and 11.801 seconds. This small local sample and the earlier variability
are preserved; they do not establish cold-start guarantees under arbitrary RAM,
thermal, provider or hosted conditions.

## Regression and release boundary

Focused evidence: 70 PostgreSQL grading/timing/retake/concurrency cases,
37 NLP/fallback/ranking cases, then 45 recommendation/combined/history cases passed.
The latter includes preserved IDs across mixed candidates/other batches and
rollback of stale flags after a failed batch write. The full current-source suite passes 287 PostgreSQL API tests and 116 frontend
tests with no skips, plus lint, production build, Django check and migration
drift check. The linked real PostgreSQL/browser three-role lifecycle passes all
15 groups with no page errors, including retake history, placement snapshots,
exports and direct role denials. Logs are `v06-postgres-final.txt`,
`v06-frontend-unit.txt`, `v06-lint.txt`, `v06-build.txt`,
`v06-system-check.txt`, `v06-migration-check.txt` and `v06-linked-workflow.txt`
in `work/defense_audit/`. Timing/session recovery browser regressions are recorded
separately in the single execution tracker; do not infer them from timings.

The user now accepts the current question format as final for this release;
the external official-file comparison is a later follow-up. Existing official
IAMS and question imports remain intact. S01 and hosted checks are separate
acceptance gates. No configured Supabase database migration or deployment occurred.
