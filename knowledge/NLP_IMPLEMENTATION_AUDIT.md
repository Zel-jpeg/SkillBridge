# NLP and recommendation implementation audit

## Rerun request handling audit — 3 November 2026

The dashboard rerun uses the shared Axios 30-second default while the model
settings page allows 120 seconds for the same synchronous endpoint. The dashboard
catch unconditionally reports failure even when completion is uncertain. The API
loops active enrollments, commits results and publishes normal invalidations;
client timeout does not establish that this processing was cancelled. No original
network trace was available to prove the screenshot's individual error cause.

Authorized follow-up is a focused frontend request/status fix: share a 120-second
limit, distinguish uncertain completion from confirmed rejection, expose partial
errors instead of unconditional success, revalidate existing GET data after an
outcome, and never automatically replay a rerun after a timeout. Preserve all card
layouts, grading, ranking/NLP/location rules, role checks and schema. Test with
controlled clients and intercepted browser requests; do not rerun real students
or modify the configured database. Use the recommendation audit, React guidance
and webapp-testing workflows. The existing source changes and unrelated catalog
work remain preserved. Verification will be recorded in the assessment-led note.

Completed verification: 321 frontend tests passed, including eight focused rerun
cases; ESLint and Vite production build passed. Eight intercepted browser checks
passed across both admin entry points, including confirmed success after 31.6
seconds, timeout, lost connection, HTTP 500, HTTP 403 and partial processing.
The fixture confirms a single POST and authorized GET revalidation without a real
backend/database. Initial browser fixture failures were corrected missing mock
analytics fields and selectors, superseded by the complete final receipt under
`work/recommendation_rerun_20261103/`. Temporary preview stopped automatically.
No backend tests were needed because backend code was unchanged. No migration,
real-student rerun or deployment was performed for this correction. Eight unrelated
catalog/UI file hashes remain unchanged. See the implemented rerun section in
[the assessment-led note](ASSESSMENT_LED_RECOMMENDATIONS.md).

## Completed local integration — 3 November 2026

See [the implemented contract](ASSESSMENT_LED_RECOMMENDATIONS.md) for ordering,
compatibility, activation and final verification. User correction: preserve the
original cards and category-based profiles across every role. Added explanation
sections were removed. Numerical evidence visibility and completed status are now
separate from recommendation freshness; grading is unchanged.

Final checks: 593 backend tests on a fresh owned PostgreSQL database; 313 frontend
tests; lint/build; 13 real-local-API browser checks, including stale recommendations
with retained category scores for all roles; migration upgrade preservation;
system/drift/diff checks; original card classes and eight unrelated file hashes.
All final checks passed. Preliminary overlapping test runs were stopped and replaced
by the clean final run; do not use their logs as final evidence.

Authorized configured Supabase migration 0031 is applied: two Recommendation columns,
no table. Protected record hashes match before/after; zero real recommendations
were recalculated. No deployment occurred. The active plan records the final state.
Existing NLP inputs, model, preprocessing, raw similarity and grading remain unchanged.
This is application regression evidence, not independent NLP effectiveness or
population-level suitability/fairness validation.

## Active assessment-led integration audit — 3 November 2026

The user authorizes local main-source integration of the tested assessment-led
workflow, followed by an additive migration for testing after implementation and
isolated verification. No deployment or automatic real-student recommendation
refresh is authorized by this implementation. Question-topic extraction, NLP input
redesign, model changes and training remain outside scope. Keep coverage visible;
exclude the recently previewed minimum-count UI block.

Branch is `main`. Unrelated company/position-dialog work was identified by Git
status and eight files were hashed in ignored
`work/assessment_led_integration_20261103/unrelated-hashes.json`. Preserve them.
There are no nested application AGENTS.md files. React/Vite/DRF/JWT role guards
and shared Axios/response contracts are the current architecture; no new endpoint,
authoring form or dependency is needed. Student/instructor/admin access stays
server-scoped through existing managed-batch/current-enrollment checks.

Verified source map: scoring.py `_rank_recommendations`; combined_competency.py
eligible evidence/raw-max pooling/finalization; recommendation_freshness.py
catalog/model/pin fingerprints; views.py shared and manually assembled student,
staff, report and placement serializers; collection_queries.py maximum-score
collection sorting; analytics.py score bands/top selection; placement_drafts.py
revision signatures/manual choices and placement_allocator.py shared-capacity
matching; models.py Recommendation and immutable placement component snapshots;
cycle_lifecycle.py versioned closeout JSON. Frontend consumers include results,
dashboard highlights, staff student cards/details, company/position dialogs,
placement workspaces, analytics and PDF/CSV/history exporters. Current sorting
and banding repeatedly depend on match_score and must be changed consistently.

Change contract: retain legacy score components as clearly identified references,
persist assessment_rank/assessment_details on Recommendation, use new order and
coverage explicitly, retain existing NLP generation/model behavior. Fingerprint
the policy and require explicit refresh of old results. Require fully assessed,
met minima for automatic shared proposals while retaining below-target/unknown
alternatives for coordinator review and preserving valid manual choices and
approved occupancy. Use actual required-category performance for cross-student
competition, never the personal demand ratio. Preserve future approval evidence
in existing ManagementAction metadata without a new snapshot table/column.
Existing archived payloads and original grade/answer/retake evidence remain intact.

Boundary checks: dotenv is disabled for tests; a new owned loopback PostgreSQL
cluster uses core.sse_postgres_test_settings and explicit SB_TEST_DB_* values,
never normal DB credentials. No personal records were queried for this audit.
Frontend baseline: all 308 existing Node tests passed. Focused PostgreSQL baseline
is running with captured output; no backend pass is claimed before completion.
Windows CREATE_NO_WINDOW initially suppressed child output; the task-only runner
was corrected to capture it, and the baseline is rerun rather than guessed.
Baseline Django, frontend lint/build and broader regression evidence will be
recorded in the active plan. Hosted latency, independent NLP effectiveness and
real-world placement suitability remain unverified; the existing synthetic
comparison found no NLP first-choice benefit under Option 3.

Implementation tracker/checkpoint:
[recommendation review and fix plan](RECOMMENDATION_MATCHING_REVIEW_AND_FIX_PLAN.md).
Earlier entries below describe prior work and do not override this scope.

# Historical NLP rollback audit

**Latest20 October:user restored the expanded Python catalog while retaining the
relevance fix and requested a general solution proposal.**35/33 lists restored,
network aliases merged,Tools exclusion retained. Verified fallback prefers saved
database category tags over hard-coded defaults; recognized role titles instead
return role vocabulary. General solution documented in POSITION_SUGGESTION_DESIGN.md,
not implemented beyond restoring the existing expanded behavior plus targeted fix.
No database/table/model/weights/placement change. Combined46 focused and308/308
PostgreSQL tests pass,zero skips; both synthetic actual browser suites pass(7 groups),
zero page errors; Django check/no migration drift pass. Frontend app unchanged,
prior178/lint/build preserved.48 unrelated hashes verified. Current status in checkpoint.

**Latest correction:** exact screenshot Networking75+Tools75 reproduced irrelevant
Tools products in position tags. See [position tag relevance](POSITION_TAG_RELEVANCE.md).
Narrow network aliases and generic Tools fallback exclusion implemented against the
original catalog. Earlier expansion stays rolled back. No database access or
production ranking change. Final300/300 PostgreSQL,178 frontend,38 focused tests,
lint/build,Django check/no migration drift pass. Four actual local admin/instructor
browser workflow groups pass,zero page errors.47 unrelated file hashes preserved;
original grading/ranking/rendering/preprocessing AST verified unchanged. No existing
record repairs or live recommendation generation. Current status is in checkpoint.

## Latest action: vocabulary comparison rollback

20 October 2026. User requested rollback of the recent improved hard-coded catalog
to compare earlier behavior. Restored skill_taxonomy.py,recommendation_nlp.py and
scoring.py to HEAD after reviewing their diffs. Original14 category lists/8 role
lists, matching text, models and60/25/15 remain. Expansion-only tests/browser script
archived outside app source. No DB access,migration,data changes or deployment.
All unrelated tracked/untracked changes hashed and preserved,including intervening
paper,handoff,cache and other work. Recovery copy:
work/defense_audit/vocabulary-rollback-final-check-2026-10-20/.

Final comparison rollback complete:31 focused backend tests pass; source equals
HEAD and46 unrelated file hashes are preserved. No task-owned server/unfinished
command or database operation. Next:user restarts backend,refreshes and compares.
Saved tags remain as-is. IT Network Specialist fallback is expected to still give
the same8 tags for Networking/Web Development requirements; this rollback does
not recreate an older saved16-tag list. No background process started.

Earlier records below are historical and do not describe the active expansion.

## Latest state: updated vocabulary restored

20 October2026. User explicitly requested bringing the update back after comparing
the original behavior. Restored exactly the archived vocabulary update in
skill_taxonomy.py,recommendation_nlp.py and scoring.py; restored its focused tests
and synthetic browser script.35 category lists,33 role profiles and61 suggestion
category aliases active. All unrelated intervening workspace files preserved.

Only the existing-file suggestion update is restored. Description templates,
60/25/15 weights/model configuration, assessment grading, saved tags and database
records unchanged. No database tables/migrations/pilot/annotations restored.
Complete:39 focused backend tests passed; Django check and no migration drift
passed. All5 restored source/test files match the archive exactly;46 unrelated
file hashes preserved. Earlier301 backend/178 frontend/browser/lint/build checks
apply to this exact implementation; expensive checks were not repeated.
No task-owned server/background operation started. User restarts backend and
refreshes after verification. Logs:work/defense_audit/vocabulary-restored-*.

Earlier rollback/completion entries below are historical, not the current state.

## Latest action: vocabulary comparison rollback

20 October 2026. User requested rollback of the recent improved hard-coded catalog
to compare earlier behavior. Restored skill_taxonomy.py,recommendation_nlp.py and
scoring.py to HEAD after reviewing their diffs. Original14 category lists/8 role
lists, matching text, models and60/25/15 remain. Expansion-only tests/browser script
archived outside app source. No DB access,migration,data changes or deployment.
All unrelated tracked/untracked changes hashed and preserved,including intervening
paper,handoff,cache and other work. Recovery copy:
work/defense_audit/vocabulary-rollback-2026-10-20/.

Complete:31 focused backend tests passed; Django check and no migration drift
passed. Original source equality and46 unrelated file hashes verified. No unfinished
commands or task-owned server. Next:user restarts backend,refreshes and compares.
Saved tags remain as-is. IT Network Specialist fallback is expected to still give
the same8 tags for Networking/Web Development requirements; this rollback does
not recreate an older saved16-tag list. No background process started.

Earlier records below are historical and do not describe the active expansion.

**Subsequent bounded work:** user authorized expanding existing-file suggestion
vocabulary after rollback. See [vocabulary scope/results](NLP_SUGGESTION_VOCABULARY.md).
This does not restore the cancelled experiment. The rollback record below remains
historical; the current checkpoint records the new completed suggestion-only scope.

20 October 2026. The original NLP implementation was explicitly cancelled by the
user. It is archived in ignored work/defense_audit/nlp-rollback-2026-10-20/ along
with the original implementation audit/checkpoint and before-tracked.patch.
This current record supersedes the archived completion/continuous-work status.

## Verified change boundaries

- Reviewed all tracked diffs before reverting. Restored 19 task-only tracked files
  from HEAD; selectively removed only NLP edits from views.py. Preserved unrelated
  Google-profile/name formatting, enrollment, address, responsive UI and independent
  defense-review outputs. Snapshot recorded hashes for unrelated tracked edits.
- Archived 30 task additions including backend/frontend modules, focused tests,
  new feature guides and the new reviewed-v1 offline package. Existing older
  experiments/proposals remain. App imports/routes no longer reference additions.
- Production scoring.py, recommendation_nlp.py, skill_taxonomy.py, combined evidence
  and assessment gating retain the original implementation. Weights remain60/25/15.
- Restored original position editor, existing tag suggestions/requirements, question
  editor and student-detail tabs. Original collection/API protections remain.
- Four tables, not just the three catalog tables, were added by the cancelled work.
  The user was shown exact storage scope and explicitly chose deletion of all
  experiment storage. Historical migrations must remain; new0019 deletes storage.

## Verification and remaining action

- Local PostgreSQL migration exercise preserved hashes of all original tables and
  retained Position columns while deleting exactly the four target tables/six
  columns. Synthetic fixture includes responses/answers, scores, combined profile,
  requirements, recommendation and placement. No original-data exports.
- Final frontend178/178, lint/build and backend293/293 PostgreSQL tests passed.
  Django check and migration drift passed. All four browser suites passed. Browser
  fixture counts only actual assessment mutations; the existing category-suggestion
  POST is mocked separately without changing save assertions. HTTP/child-process
  test setup corrected before final passing backend run.
- Supabase0019 applied under explicit user authorization and fresh-connection
  verified. Exactly four tables/six columns removed. Original API-table row hashes
  and all other schema columns identical inside the same transaction; unexpected
  dependencies rejected and implicit cascades disabled. No original student or
  assessment contents exported, no recommendations regenerated.
- Original production helpers match HEAD after normalizing checkout line endings;
  all16 unrelated tracked edit hashes remain identical. Source archive preserves
  the cancelled experiment for recovery. No deployment, commit or push.
- Rollback is a requested cancellation, not evidence that a lower similarity score
  proves lower placement quality. Historical synthetic findings were not relabeled.

## Existing-file vocabulary expansion,20 October

- Audited suggestion endpoint callers/validation/permissions, category and position
  tag drafts/saves, question category assistance, canonical text normalization,
  generated profiles/position descriptions and ranking before editing. Baseline31
  focused tests passed;96 synthetic text/insight outputs and unrelated edit hashes
  captured. No production data or credentials read.
- Expanded original Python lists to35 category and33 role profiles;61 authoring-only
  category aliases. Broader phrase aliases are distinct from unchanged matching
  ALIASES. Whole-word title matching, explicit mixed-role support and existing
  strongest-requirements fallback preserve unknown-role abstention.
- Added question vocabulary only as fallback after original built-in keyword sets.
  Grade/combined/ranking/rendering/preprocessing functions are AST-identical to HEAD;
  original14 category/8 role list contents and matching aliases unchanged.96 saved-
  input synthetic description/insight snapshots are identical. No stale profile/
  recommendation rewrite, live generation, new model/configuration or schema.
- New8 tests validate vocabulary separation, aliases/limits, unknown/substrings,
  original saved-text contract, category suggestions, no-write real APIs and staff
  permissions. Focused39 pass. Full PostgreSQL301/301,zero skips; frontend178/178;
  lint/build,Django check and no migration drift pass.
- Three actual local React/Django Chrome groups pass,zero page errors; new editable
  suggestions feed saved tags and original descriptions, instructor acceptance is
  explicit,student403 preserved. External requests blocked; SSE mocked separately.
  Synthetic in-memory data only. Desktop/mobile screenshots inspected.
- Aggregate fast SQLite suite hit shared throttle buckets; logs retained and
  application throttles unchanged. Full PostgreSQL run passes. Initial browser
  selector/enrollment fixture mistakes corrected without weakening assertions.
- No Supabase access/migration, deployment, model download, scoring change or
  recommendation-effectiveness claim. All unrelated tracked source hashes preserved.
