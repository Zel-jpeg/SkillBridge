# Proposal: show assessment scores before background recommendations

Date: 20 October 2026, Asia/Manila.
Status: proposed; background processing is not implemented by this document.
Hosting assumption: Railway Hobby for the backend and worker, with the existing
Vercel frontend and Supabase/PostgreSQL database retained.

## Intended student experience

Yes: after an accepted submission, show **Assessment saved** and open **View
Score** without waiting for recommendation generation. Students can inspect
their score and submitted answers, leave the page, or return later. Final Results
shows the server's recommendation state and updates when processing finishes.
Here, completion means an accepted submission; this proposal adds no passing-score
threshold. Stopped, flagged and expired-review attempts keep their existing rules.

| Server state | What the student sees on Final Results |
| --- | --- |
| Required assessments remaining | “Complete your remaining required assessments to unlock final results.” Show the remaining count. |
| Eligible, job queued | “Preparing your recommendations. Your assessment and score are saved.” |
| Job running | “Calculating your recommendations. You can leave this page and return later.” |
| Current result ready | Existing final profile and ranked recommendations. |
| Calculation completed with no candidates | “No matching positions are available.” This is a completed result, not a loading state. |
| Worker delayed or retrying | “Recommendations are taking longer than usual. Your assessment and score are saved.” |
| Job failed after bounded retries | “Recommendations could not be calculated. Your score is saved.” Provide authorized recovery. |
| Ranking stale after catalog/model changes | Existing refresh guidance; preserve the explicit admin refresh policy. |

Display a spinner only for queued/running work. Do not invent a percentage or a
completion-time promise. A network failure while checking status is a separate
“Could not check status” message, not proof that calculation failed.

## Why the current flow needs more than a longer timeout

[assessment_submit](../skillbridge-backend/api/views.py) currently saves answers,
scores and the finalized attempt in a locked transaction, then calls
`update_assessment_profile` and `recalculate_combined` before returning success.
[recalculate_combined](../skillbridge-backend/api/combined_competency.py) can
generate the combined profile and recommendations synchronously. This permits
the database save to succeed before the browser receives its acknowledgement.

The current [submission recovery fix](ASSESSMENT_SUBMISSION_INTEGRITY.md) gives
submission 120 seconds and checks saved attempt status after failure. That is a
recovery measure, not a two-minute usability target or a performance improvement.

Changing only the submit endpoint is insufficient: individual score reads,
combined results and student company reads currently call `ensure_combined`,
which can perform synchronous backfill/recalculation. Opening View Score must not
move the same slow work into its first GET request. Audit all helper callers,
staff views, admin reruns, profile changes and catalog-triggered generation.

## Proposed processing boundary

1. Authenticate and validate the current attempt and complete answer payload.
   Keep the existing submit-versus-stop lock, timing policy and retake identity.
2. In one database transaction, grade and persist answers/category scores,
   finalize the attempt, invalidate affected combined-result readiness, advance
   its evidence revision and persist any required calculation job intent.
   Coordinate these changes per student/batch so simultaneous assessment
   completions cannot lose the final eligible calculation request.
3. Commit and return success with the saved score/result link, required progress
   and recommendation state. Do not return an assessment error merely because
   the recommendation worker is unavailable.
4. A separate persistent worker claims committed jobs, reads a consistent input
   snapshot and computes the profile/ranking. Keep expensive computation outside
   long database transactions and attempt locks.
5. In a short final transaction, verify the job lease, evidence revision,
   enrollment/eligibility and ranking-input fingerprint. Publish the complete
   profile and recommendation rows atomically only if those inputs are still
   current. An obsolete worker must not overwrite a newer retake or result.
6. Publish the existing recipient-scoped change event after commit. The student
   page refetches saved status/results through the shared query cache.

Use success HTTP 200 for a saved assessment, with a proposed field such as
`recommendation_status: "queued"`. The assessment is complete even though its
recommendations are pending. Derive required progress from saved attempts;
keep ranking readiness separate. A duplicate finalized submission should permit
reading the existing result without another grading or generation operation.

Individual numeric scores and answer review remain available during background
work. Assessment narratives may have a separate pending state if deferred.
Combined scores, profile and rankings must carry consistent evidence revisions;
never expose a partly updated final result as ready. Ready status is necessary
but does not bypass existing authorization, freshness or placement-capacity gates.

## Railway Hobby deployment proposal

Start with **one web service and one separate worker service**, from the same
backend source/release. The worker has one calculation slot initially. The
existing PostgreSQL database can store a durable job table, avoiding an additional
Redis service for this first workload. This is a design recommendation, not a
claim that a queue or worker already exists in the repository.

The [current Procfile](../skillbridge-backend/Procfile) configures two Gunicorn web
processes and no background worker. Web processes/connections are not equivalent
to recommendation calculation slots. Do not start an unmanaged Python thread per
submission or one NLP process per student inside the web service.

Implement a PostgreSQL job queue with a separately supervised Django worker, or
evaluate a maintained durable task backend before implementation. Either choice
must provide the reliability controls below. Django 6's task API alone does not
supply a production worker; its immediate backend executes work synchronously.
See [Django Tasks](https://docs.djangoproject.com/en/6.0/topics/tasks/).

Keep the worker persistent during assessment availability. Railway sleeping is
traffic-driven; database polling can keep it awake, and a non-HTTP worker needs
an explicit wake/restart design before sleeping is enabled. Use worker heartbeats
and oldest-job age as health signals; a healthy web endpoint does not establish
that calculations are progressing. See [Railway services](https://docs.railway.com/services)
and [Serverless](https://docs.railway.com/deployments/serverless).

Build the selected NLP model into the worker image and load it once per worker
process before claiming jobs. Preserve truthful model/fallback metadata. Measure
peak model memory and CPU before increasing to two calculation slots. Check
database connection limits and all remaining web-process model consumers too.
Web and worker must use compatible schema, model configuration and source versions;
run reviewed migrations as a coordinated release step, not competing worker startups.

### Hobby cost assumptions

Railway currently lists a **$5 monthly minimum including $5 usage credit**, with
extra resource usage billed beyond that. Advertised CPU/RAM maxima are limits,
not resources included for $5. Web and worker both contribute to usage. At the
listed memory rate, an illustrative combined average of 1 GB running for 30 days
is about $10 for memory alone, before CPU/network/storage. This is not a measured
SkillBridge estimate. Existing externally hosted database costs are separate.
See [Railway pricing](https://railway.com/pricing), checked 20 October 2026.

Track actual memory, CPU and projected billing during the pilot. Start with one
worker slot and reuse the existing database; add concurrency only when queue
delay justifies the measured cost. A spending cap can affect service availability,
so establish an operating budget for assessment days rather than assuming the
included credit covers continuous service. No plan purchase or host change is
part of this proposal.

## Handling 50+ students per day and bursts of 5+

This architecture is suitable to evaluate for the stated workload. Daily student
count alone does not establish capacity: question count, simultaneous submissions,
candidate-position corpus, database latency, cold model loading and available
CPU/RAM determine response and queue times. Queueing controls work; it does not
make each calculation faster.

Five simultaneous eligible submissions can save independently and wait in the
queue while one worker calculates them in sequence. Their scores remain usable.
For illustration only, five equal 10-second jobs take about 50 seconds to drain
with one slot, or about 30 seconds with two independent slots, excluding startup,
overhead and contention. Actual jobs must be measured; shared CPU may prevent
that two-slot speedup. Do not launch five model copies just because five students
submit at once.

There is encouraging [local performance evidence](PERFORMANCE_VERIFICATION.md):
an earlier workload used 200 synthetic students, 8 positions, two 30-question
assessments and cohorts of 20 concurrent submissions; warm submission p95 was
3.628 seconds. That was a local threaded fixture with its own listener settings,
not Railway Hobby, a background queue or 100–150-question acceptance. It cannot
guarantee this proposed deployment's speed.

## Required reliability and integrity controls

- Persist job intent with the evidence commit. A process crash between commit and
  dispatch must not lose work. `on_commit()` may send a wake-up hint, but it must
  not run the calculation itself or be the only durable record. Django documents
  [commit callbacks](https://docs.djangoproject.com/en/6.0/topics/db/transactions/#performing-actions-after-commit)
  as actions executed after commit, not an independent worker mechanism.
- Deduplicate by student, batch and evidence revision. Reopening results or
  refreshing status never launches another calculation for the same inputs.
- Claim jobs using short transactions and leases. PostgreSQL
  [SKIP LOCKED](https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE)
  supports competing queue consumers; it does not itself provide retries,
  dead-worker recovery or exactly-once execution. Make publication idempotent.
- Store queue/run/retry/completion timestamps, lease owner/expiry, attempt count
  and sanitized failure codes. Use bounded retry/backoff and reclaim expired
  leases after worker death. Distinguish a waiting job from failed processing.
- Retakes, evidence/configuration changes and batch closure must supersede
  incompatible jobs. Include exact attempt/evidence identity and existing catalog,
  model and student-location provenance. Preserve the
  [current stale-ranking refresh policy](RECOMMENDATION_FRESHNESS.md).
- Refactor computation and persistence deliberately: current ranking helpers write
  results. Merely calling them from a worker before a final revision check can
  already publish obsolete rows. Verify revision and publish the whole result
  atomically; retain recommendation IDs referenced by placement/history.
- Preserve full question denominators, exact identification grading, weighted
  combined raw/max totals and the 60/25/15 ranking formula. Stopped/flagged evidence
  never satisfies completion. Similarity does not grant placement approval.
- Use the existing SSE invalidation plus visible-page refresh fallback. Refresh
  and reconnect read status, not regenerate rankings. Enforce student ownership
  and instructor/admin scope on status, retry and result endpoints.

## Implementation and verification plan

1. Instrument grading, commit, profile generation, ranking and response times
   separately using synthetic data. Measure model startup and peak memory.
2. Introduce durable job/revision state and worker processing with idempotent,
   atomic publication. Test restart and duplicate-delivery recovery first.
3. Split submit acknowledgement from generation; remove synchronous generation
   from individual score/status reads and ordinary result-page refresh paths.
4. Add the student states above and appropriate staff status/retry visibility.
   Keep existing stale-result and retake authorization policies.
5. Verify 100- and 150-question assessments with 1, 5, 10 and 20 simultaneous
   submissions, then a 50+ student session on an isolated dataset. Include cold
   and warm workers, realistic candidate counts, status/SSE traffic and a burst
   during admin rerun. Confirm no lost/duplicate scores or cross-student results.
6. Test interrupted responses, worker crash/redeploy, unavailable worker/database,
   expired lease, exhausted retries, zero candidates, concurrent retake, catalog
   changes mid-job and an older worker finishing after a newer result.
7. Measure submit-to-visible-score, queue wait, calculation duration and
   submit-to-ready-final-result separately, reporting p50/p95 and sample counts.
   Proposed score target: p95 under 5 seconds for the 150-question/5-submit case.
   Agree a recommendation-delay target from measured one-slot/two-slot results;
   do not use the 120-second browser timeout as the normal UX target.
8. Run a controlled Railway Hobby pilot after local correctness checks. Record
   chosen limits, actual memory/CPU, database connections, queue age, model used
   and projected monthly cost before claiming hosted capacity.

## Scope of this document

This request creates a proposal and its overview link only. No queue, worker,
migration, UI state, billing setting or deployment is implemented here. Existing
assessment records and placement snapshots are unchanged. Local file links and
the proposal's references are checked; new application/load tests are deferred
until implementation. Supporting contracts: [submission integrity](ASSESSMENT_SUBMISSION_INTEGRITY.md),
[recommendation rules](RECOMMENDATION_CONTRACT.md),
[freshness](RECOMMENDATION_FRESHNESS.md) and [live data](LIVE_DATA_FRESHNESS.md).
