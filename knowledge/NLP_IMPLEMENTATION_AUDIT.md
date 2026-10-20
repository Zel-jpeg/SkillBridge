# NLP rollback audit

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
