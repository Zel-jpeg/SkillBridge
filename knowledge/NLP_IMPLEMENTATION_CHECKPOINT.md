# NLP implementation checkpoint

## Current task complete: three branch-review findings fixed

20 October2026. User authorized fixing the review findings. Implemented input
fingerprints for combined ranking visibility/approval, strict shared-category
validation, and separate enrollment/dashboard synthetic fixture accounts.
Ranking formula, assessment grading and placement snapshots remain unchanged.
Added0020_combined_ranking_input_fingerprint (one additive profile field); no
production migration or live regeneration authorized/performed.

- Current boundary:implementation and verification complete. Exact next action:
  owner applies0020 in the intended environment before starting this code,then
  explicitly uses Admin Dashboard → Re-run Recommendations when ready. Legacy
  rankings without provenance stay locked; no retakes needed. No live action
  was performed. Details:[freshness fix](RECOMMENDATION_FRESHNESS.md).
- New targeted tests reproduce original failures (red:16 failed assertions across
  two tests). After fixes,new freshness/validation cases pass;one legacy report
  fixture needed the provenance of its manually constructed current ranking.
  Existing assertions retained. Final319/319 PostgreSQL,179 frontend,lint/build,
  Django check/no migration drift pass. Original enrollment11/dashboard2 browser
  checks pass without workaround;recommendation6/catalog4/recovery2 and3 real
  API/browser groups pass,zero page errors. Actual committed event payloads feed
  the cache handler; SSE transport is intercepted in this browser fixture.
- Migration0019→0020 verified on a new disposable local PostgreSQL database:
  original table hashes identical,legacy fingerprint empty,no scoring. Temporary
  database removed. Migration not applied to configured Supabase.
- Touched backend models/combined_competency/views;new recommendation_freshness.py,
  test_recommendation_freshness.py and0020 migration;change_events invalidates
  matching views for model/implicit taxonomy changes. Three existing test modules
  now stamp manually constructed fresh fixtures. Frontend results/dashboard explain
  refresh locks;assessment action helper/test and browser fixture updated.
- Preserve all prior workspace updates and independent review outputs. Logs/runners
  under ignored work/defense_audit/review-fixes-*. No application deployment,
  Supabase access,live recommendation operation,commit or bulk data backfill.
- All task-owned API/Vite servers and PostgreSQL cluster are stopped. No unfinished
  commands. Stale/refreshed mobile screenshots inspected; first browser attempt's
  intercepted-stream/cache timing issue and final successful event delivery are
  documented. Application fixes and documentation remain uncommitted.

## Latest milestone: working branch review completed

20 October2026. User requested a review of all branch updates. Branch
`codex/nlp-phased-improvements` has zero commits ahead of local main at effb2a8;
review covered its uncommitted tracked/untracked changes. Expanded existing-file
catalog remains active and the general compatibility proposal remains unimplemented.
No phases were restarted and no application or tracked test source was edited.

- Findings and scope: [branch review](BRANCH_REVIEW_2026_10_20.md). New enrollment
  browser fixture collides with the spreadsheet's identity. Two existing defects
  were reproduced: stale saved recommendations remain approvable after requirement
  edits, and malformed shared-category names return500. Relevant application
  functions are unchanged from HEAD; do not attribute these defects to this diff.
- Fresh checks:308/308 PostgreSQL,178 frontend,lint/build,Django check,no migration
  drift; real synthetic tag/browser regressions pass. Original enrollment fixture
  fails; separating synthetic accounts in a review-only wrapper makes all11
  enrollment and2 dashboard checks pass without altering tracked assertions.
  Davao grouping/no autoselection and address recovery verified in Chrome.
- Cleanup migration verified on a new disposable PostgreSQL database:only the4
  experiment tables/6 Position columns removed; other table content hashes match.
  Temporary database removed. No Supabase operation or live recommendation refresh.
- Added review report and this milestone; ignored runners/logs are under
  work/defense_audit/branch-review-* and branch_review_*.py. Preserve all prior
  workspace changes,including independent defense-review outputs and migrations.
- Exact next action:no running work. Findings are recorded for follow-up fixes;
  current request was review only. All task-owned API/Vite servers and PostgreSQL
  test cluster are stopped; no unfinished commands,commit or deployment.

## Earlier implementation milestone (historical)

## Latest task: expanded catalog restored with relevance safeguards

20 October2026. User requests latest improved existing-file catalog restored and a
GENERAL solution proposal,not merely a Network Specialist patch. Restored35 category
lists/33 role profiles and suggestion-only aliases from archived update; merged
Network Specialist/Engineer aliases into expanded ROLE_ALIASES and kept Tools
exclusion before requirement fallback. No schema,table,annotation or pilot restored.

- Current logic verified:recognized title returns hard-coded role vocabulary;
  otherwise strongest2 specific categories prefer nonempty DB tags and use Python
  category defaults only if empty. Suggest replaces draft until explicit save.
- General proposal in POSITION_SUGGESTION_DESIGN.md:unified candidate sources,
  category/role metadata compatibility,broad-category/product distinction,origin
  labels and explicit Add/Remove without refresh overwrites. Proposal only,not
  implemented. Do not imply general compatibility/product filtering already exists.
- COMPLETE:focused46 and full PostgreSQL308/308 pass,zero skips; both real synthetic
  browser suites pass(7 workflow groups),zero page errors. Django check/no migration
  drift pass. Frontend application unchanged; prior178/lint/build pass still apply
  and were not rerun. Matching/grading/rendering/preprocessing AST unchanged.
- Exact next action:user restarts existing backend if needed and refreshes. General
  proposal awaits a future implementation request; do not silently activate it.
  No code or migration pending. Browser-owned Vite5178/API8018 stopped; task-owned
  PostgreSQL55438 is stopped. No unfinished commands or Supabase operation.
- Source backup/hash manifest:work/defense_audit/catalog-restored-with-relevance/.
  Preserve48 unrelated tracked/untracked files,including targeted fix regression.
  No live DB access,backfill,recommendation refresh,deployment or model switch.

## Previous narrow fix/comparison records (historical)

## Current task: position-tag relevance correction

20 October2026. Original catalog remains active after final comparison rollback.
User reported irrelevant Postman/Figma for Networking75+Tools75. Reproduced exact
eight-tag output. Broader vocabulary update did not change this generic fallback.

- Implemented narrow authoring-only network role aliases/whole-word title matching
  and Tools category exclusion before selecting fallback requirements. Original
  category tag suggestions/lists,matching aliases/rendering/model/scoring remain.
- Changed skill_taxonomy.py,recommendation_nlp.py; new test_position_tag_relevance.py
  and position_tag_relevance_playwright.py. No frontend app edit,table,migration,
  live data access/regeneration,or restored media catalog/pilot/annotations.
- COMPLETE:focused38,full PostgreSQL300/300 zero skips,frontend178,lint/build,Django
  check/no migration drift pass. Four real admin/instructor local API/browser groups
  pass,zero page errors. Desktop/mobile inspected.47 unrelated file hashes preserved;
  grading/ranking/rendering/preprocessing functions AST-identical to HEAD.
- Exact next action:user restarts their existing backend if needed,refreshes and
  clicks Suggest/Refresh Tags or Suggest Tags. Existing saved tags are not repaired
  automatically; review draft before explicit save. No code/migration pending.
- All tests/browser commands finished; Vite5178/API8018 and task-owned PostgreSQL
  55438 are stopped. No unfinished command or Supabase operation.
- Unrelated tracked/untracked hash baseline and bad screenshot case captured in
  work/defense_audit/position-tag-relevance-before.json. Preserve intervening work.

## Earlier comparison records (historical)

## Current state: vocabulary expansion rolled back

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

## Current state: vocabulary expansion rolled back

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

## Current task: existing-file vocabulary expansion

20 October. New bounded user authorization after rollback: expand hard-coded
suggestions for video/photo editing and other missing OJT roles. Do not resume the
cancelled phases or restore their database/catalog/annotation/pilot components.

- Implemented expanded SKILL_TAGS/ROLE_TAGS and separate suggestion-only aliases in
  skill_taxonomy.py; phrase boundaries in recommendation_nlp.suggest_position_tags;
  added vocabulary fallback only in scoring.suggest_category. Original keyword sets,
  matching ALIASES, rendering templates/model/formula and persisted data unchanged.
- New api/test_suggestion_vocabulary.py and real browser script
  tests/suggestion_vocabulary_playwright.py. No frontend application edits, migration,
  live DB access, deployment or recommendation refresh.
- Baseline31 and focused39 tests passed.96 synthetic saved-input description/insight
  examples identical before/after; unrelated source hashes preserved. No accuracy claim.
- COMPLETE: full PostgreSQL301/301,zero skips; frontend178/178; lint/build; Django
  check and no migration drift. Real synthetic React/Django Chrome3 workflow groups
  passed,zero page errors; desktop/mobile screenshots inspected.96 description/
  insight snapshots identical; AST comparison confirms grading/ranking/rendering/
  preprocessing functions and original matching aliases/lists unchanged.
- Exact next action: user restarts an already-running backend if needed, refreshes
  the app and uses existing Suggest/Refresh Tags. New assessment categories must
  still be added in existing Skill Taxonomy; no category/position data auto-created.
  No coding/migration/rollout action remains. This adds suggestion coverage, not a
  proven ranking improvement. No new service/model/table or live DB operation.
- Aggregate SQLite suite hit shared throttle buckets(50 failures,10 errors,12 skips);
  unchanged throttles retained, complete PostgreSQL suite passed. Browser fixture
  scoped Add Skill submit to modal; enrolled synthetic student to reach403 instead
  of earlier401 account gate. Original expected permission/save checks retained.
- Browser/Vite/API verification and disposable PostgreSQL55438 are stopped.
  No unfinished test or implementation command remains.
  Preserve prior unrelated edits and cleanup migration/history. Logs/work:
  work/defense_audit/vocabulary-*; new guide NLP_SUGGESTION_VOCABULARY.md.

## Completed rollback (historical)

Updated 20 October 2026. **Rollback COMPLETE. Original phased work cancelled.**
The user requested undoing the NLP work, then explicitly selected deleting all
four experiment tables and six added Position fields from configured Supabase.
Do not resume the original phases on CONTINUE. Branch codex/nlp-phased-improvements.

## Rollback completion record

No implementation or migration remains pending. User may restart an already-running
local backend and refresh the frontend. Original matching remains60/25/15.
No deployment, staging, commit, push or live recommendation regeneration performed.

- Restored 19 NLP-only tracked files and original models.py from HEAD. Removed
  only NLP hunks from views.py, preserving unrelated Google-profile/name updates.
- Removed experimental catalog, duties/tools UI/previews, question annotations,
  assessed-evidence panels and matching comparison endpoints/components/hooks.
  Original tags, category requirements and original NLP diagnostics remain.
- Archived 30 new source/doc/offline entries outside active application source.
  Paper/design files restored to earlier proposal state. Historical0016/17/18
  migrations retained; new0019 provides coherent forward schema cleanup.
- Supabase0019 applied and fresh-connection verified. Exactly four target tables
  and six Position columns removed. No implicit CASCADE permitted. Original API
  table contents were compared by hashes inside the same locked transaction;
  every original business record and all other schema columns were identical.
  No real student/answer content was exported. Counts only in ignored result log.
- Disposable PostgreSQL0018 ->0019 preservation exercise passed with synthetic
  accounts, responses/answers, scores, combined evidence, requirements, recommendation
  and placement. All original table/retained-position hashes equal before/after.
- Full backend PostgreSQL293/293 passed, zero skips. Frontend node --test178/178,
  lint/build passed. Django check and migration drift check passed locally.
- Browser suites: catalog validation/recovery, instructor complete-save recovery,
  admin assessment management and student recommendation contract passed. Synthetic
  intercepted APIs only; no Supabase browser mutation. Mobile screenshot inspected.
- Browser fixture correction: existing read-only POST /api/categories/suggest/ is
  answered before the assessment mutation counter; original two-save/failure-recovery
  assertions retained. No application behavior or grading expectation changed.
- Test setup issues corrected: local HTTP needed DEBUG=True rather than inherited
  HTTPS redirects; independent reader subprocess needed backend working directory.
  A fixture helper argument collision was corrected before successful migration test.
  These were isolated setup issues. No unresolved test failure remains.
- Unrelated16 tracked edit hashes preserved; unrelated untracked formatter/name/
  student-dashboard and independent defense-review work untouched. No global reset,
  checkout, clean or stash. Source archive: work/defense_audit/nlp-rollback-2026-10-20/.
- All verification/apply commands finished. Browser-owned Vite5178/5175 stopped.
  Disposable PostgreSQL55438 stopped successfully; no unfinished command remains.
  No live application service was started or stopped by this task.

Logs: work/defense_audit/nlp-rollback-*. Supabase commit result:
nlp-rollback-supabase-result.json. See [rollback scope](NLP_ROLLBACK.md).
