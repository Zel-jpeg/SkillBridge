# Saved recommendation freshness

28 October cycle update: ranking candidates and catalog fingerprints exclude archived
partners/openings. Capacity stays a separate approval rule; weights and grading stay
unchanged. A previous cycle's approved/declined decision does not suppress the
same position in a new batch. Saved closeout versions never regenerate rankings. See
[cycle closeout and rollover](OJT_CYCLE_CLOSEOUT_AND_ROLLOVER_PLAN.md).

20 October2026. Fixes the three findings in the
[branch review](BRANCH_REVIEW_2026_10_20.md). Weights remain60/25/15; grading,
required-assessment gates, assessment history and placement snapshots remain.

## Ranking provenance

Each finalized combined profile stores a SHA-256 fingerprint of the matching
catalog, requested model, text-generation version and student map coordinates.
Catalog inputs include candidate positions with requirements, their titles/tags,
company names/coordinates, ordered requirements, and category IDs/names/tags.
The whole candidate corpus matters because another candidate can change TF-IDF.
Capacity, branding images and authoring-only category descriptions are excluded.
Capacity remains an independent approval constraint. This adds no duties,
mastery judgments, scores or new NLP evidence.

Existing progress, active-batch, finalized-profile and source-assessment checks
still run. A fingerprint mismatch or missing legacy fingerprint additionally
locks saved rankings in student/staff reads, reports and placement approval.
Approval returns409 rather than accepting an outdated result. Scores and existing
placement snapshots are retained. Bulk management reads share one catalog
signature per operation instead of rebuilding it per student; no cross-request
fingerprint cache can conceal an edit.

Reads do not automatically rerun a finalized stale ranking. Students see refresh
guidance. **Admin Dashboard → Re-run Recommendations** deliberately regenerates
results and stores current provenance. Existing automatic generation after
assessment completion/new-position creation and refresh after editing a previously
current student's profile remain. Catalog changes during generation leave that
result unavailable as current.

Model changes now publish result/student/placement invalidations to enrolled
students and staff. Implicit category creation also invalidates matching views,
without disclosing unrelated draft assessment IDs. Existing SSE and30-second
visible revalidation behavior remains; approval always checks server freshness.

## Migration and operations

[0020_combined_ranking_input_fingerprint](../skillbridge-backend/api/migrations/0020_combined_ranking_input_fingerprint.py)
adds one64-character field to CombinedCompetencyProfile. It creates no table and
does not rewrite scores/recommendations. Legacy fingerprints remain empty because
their historical matching inputs cannot be certified after the fact.

Apply migrations in the intended environment before starting this code, then use
the existing admin rerun when ready. Existing finalized results stay locked until
that explicit refresh; students do not need to retake completed assessments.
Review earlier pending migrations separately:0019 is historical experiment-storage
cleanup, whereas0020 only adds provenance. This task migrated isolated synthetic
databases only; no Supabase access, live migration or recommendation regeneration.

## Other fixes

Shared `/api/categories/` and admin skill creation now share strict name,
description, tags and envelope validation. Malformed requests return400 before
writes; role restrictions and duplicate-category behavior remain.

The enrollment browser fixture retains its original already-enrolled account and
uses a separate noncolliding dashboard student. Original enrollment assertions
pass without the review's temporary fixture workaround.

## Verification

- Red regression:two tests reproduced16 failed assertions before implementation.
- Final complete PostgreSQL suite:319 passed,zero skips,including existing
  independent-connection concurrency checks. Ten new API tests cover the findings,
  corpus/model changes, mid-generation changes, explicit refresh, preserved
  snapshots/history, capacity, pin updates and bulk read behavior.
- Frontend179 tests,lint/build passed. Manually assembled fresh backend fixtures
  now carry provenance; existing score/permission assertions remain. The implicit
  category event expectation intentionally adds matching invalidation topics.
- Original enrollment/dashboard browser checks:11+2 passed without workaround.
  Recommendation/catalog/assessment-recovery regressions:6+4+2 passed.
- Three new real Django/React browser groups passed:requirement edit locks results,
  approval409,explicit admin refresh restores changed synthetic score,mobile layout
  fits,and null category name400. Zero page errors. NLP is a deterministic mock
  for behavior,not effectiveness measurement. Actual committed event payloads feed
  the normal cache handler; stream transport is intercepted in this single-threaded
  fixture and separately covered by backend tests.
- Upgrade0019→0020 on a newly owned disposable PostgreSQL database:all original
  table content hashes identical; legacy fingerprint empty; no scoring. Database
  removed afterward. Django check and migration-drift checks pass.

The first new browser run reloaded with SSE intercepted and observed the existing
fresh session cache before its normal poll. The final test delivers the actual
committed event via `applyDataChange`; no cache timing or scoring expectation was
weakened. Passing backend error-path tests intentionally log mocked model failures.
Logs/runners:ignored work/defense_audit/review-fixes-* and review_fixes_migration.py.
No hosted-provider or real-world accuracy acceptance is claimed.
