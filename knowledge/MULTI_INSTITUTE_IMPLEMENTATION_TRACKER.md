# Multi-institute implementation checklist and checkpoint

Authorized 4 November 2026. This is the active execution tracker. Read it with the
[design guide](MULTI_INSTITUTE_GENERALIZATION_GUIDE.md) and
[research](DNSC_PROGRAM_AND_COMPETENCY_RESEARCH.md). Current code/tests take
precedence over old notes. Checkboxes describe completed work only.

## Authorization and delivery contract

- [x] User authorizes implementation of the agreed multi-institute update.
- [x] User authorizes required database migrations after working behavior and
  migration preservation have been verified first on an isolated database.
- [x] Each feature is implemented on its own `codex/` branch.
- [x] Finish, test and fix the current feature before starting the next feature.
- [x] Commit and merge a completed feature into local `main` after its gates pass.
- [x] Do not push any branch/tag to GitHub unless the user explicitly instructs it.
- [x] No deployment is authorized by this workflow. Never auto-rerun real student
  recommendations or regrade answers merely to test a feature.

Authorization persists across features; do not repeatedly ask for migration or
merge permission already granted. Technical failures must be resolved or recorded
truthfully; permission does not waive validation. A backup/restore and safe target
check precede configured-database migration. Keep secrets and personal records
out of tracked files, logs and fixtures.

## Fixed scope

- [x] One configurable DNSC application; no institute/program-specific code paths.
- [x] IBPA is the current name. Entrepreneurship/Tourism are synthetic testing
  examples, not hardcoded product behavior or mandatory preloaded content.
- [x] Existing IC data stays in the normal IC section with original IDs/statuses.
  No special history-only mode, automatic archive, deletion or account disabling.
- [x] Admin configures institutes/programs and instructor assignments.
- [x] Instructors create category names, descriptions and tags in assigned programs;
  instructors in that same program can reuse them without sharing private batches.
- [x] One program per newly created batch; existing mixed IT/IS batches retain
  memberships/evidence through a compatibility path.
- [x] Keep manual authoring, spreadsheet import and SkillBridge structured text;
  add AIKEN as default text selection with explicit competency mapping.
- [x] Preserve scoring/retakes/completion/history and assessment-led ordering;
  generalize scope/text inputs without claiming new accuracy or practical mastery.
- [x] No internship progress/completion tracking, co-teaching, multi-school SaaS,
  essay/practical grading, LMS synchronization or new NLP training in this scope.

## Definition of done for every feature

Use these gates for each feature; record actual evidence in its receipt.

1. Branch from current local `main`; reconcile existing edits and applicable docs/skills.
2. Implement the complete defined feature, including UI/API where applicable.
3. Verify validation, denied access, save/cancel/failure recovery and relevant
   regressions using synthetic records on an isolated local database.
4. For frontend changes, run frontend tests, lint/build and responsive browser
   journeys, including keyboard use, loading/error/empty states and pagination.
5. For schema/data changes, verify drift, fresh migration and upgrade preservation
   from the actual previous migration; inspect planned operations and rehearsal.
6. Review the diff and update documentation, receipt, tests and known limits.
7. For configured-database changes, verify target and backup/restore readiness,
   apply only tested pending migrations, then reconcile preserved data without
   exposing records. Defer an unsafe cutover until its prerequisite feature passes.
8. Commit, merge into local `main`, verify the merge, update this checkpoint.
9. Only then start the next feature. Never check off a failed or unrun check.

For backend-only or documentation features, UI gates may be explicitly N/A, not
claimed as passed. An unresolved failure keeps the feature open. Broad rollout
remains a separate milestone even after features are locally merged.

## Feature order and acceptance checks

### P00 — Plan and execution tracker

Branch: `codex/multi-institute-plan`.

- [x] Record agreed scope, research and user corrections.
- [x] Create this checkbox tracker with sequential feature gates and no-push rule.
- [x] Validate links/whitespace and commit/merge the planning branch locally (`1fa6e1d`).

### F01 — Institute/program administration

Branch: `codex/institute-program-admin`. No dependencies beyond P00.

- [x] Institute/program models with stable IDs, typed fields, case-insensitive
  code uniqueness, protected relationships and ordinary active/archive status.
- [x] Admin-only list/create/edit/archive/restore APIs with bounded pagination,
  search/status filters, transaction/audit behavior and explicit validation.
- [x] Admin Institutes & Programs screen: lists, forms, program scope, search,
  status filters, pagination, cancel/retry and accessible responsive interactions.
- [x] No mandatory program seed, IC restriction or mutation of existing records.
- [x] PostgreSQL API tests for roles, malformed data, duplicates, archive/restore,
  hierarchy conflicts and audit/rollback behavior.
- [x] Upgrade/fresh-migration preservation, drift and system checks.
- [x] Frontend tests/lint/build and real-API admin browser journey.
- [x] Configured migration readiness/application receipt: 0032 applied after
  verified isolated restore; 39 pre-existing public data tables unchanged.
- [x] Commit and merge locally: implementation `920afe8` fast-forward merged to
  `main`; [receipt](INSTITUTE_PROGRAM_ADMINISTRATION.md) complete.

### F02 — Instructor assignments

- [x] Branch `codex/instructor-program-assignments` from completed F01 (`02e20f0`).
- [x] Admin assigns/revokes approved instructors to institutes/programs; UI/API
  reject self-assignment, foreign program IDs and inactive contexts.
- [x] Authorized program options and current assignment checks; private batch
  ownership remains distinct from shared program taxonomy.
- [x] Test multi-program assignments, revocation during a session, malformed IDs,
  rollback, admin flows and required migrations; 629 backend/267 frontend tests,
  nine new and 11 retained browser groups pass. 0033 applied after backup restore;
  [receipt](INSTRUCTOR_PROGRAM_ASSIGNMENTS.md) records preservation.
- [x] Commit and merge F02 locally before starting F03: `1b237b0` merged into `main`.

### F03 — Batch and enrollment context

- [x] Branch `codex/program-batches-enrollment` after F02.
- [x] New batch selects one assigned program; enrollments validate that context.
- [x] Replace BSIT/BSIS-only backend enrollment rules with configured program
  aliases; preserve signed preview/confirm, identity checks and notification rules.
- [x] Existing mixed batches keep memberships and evidence without forced split.
- [x] Test direct foreign-context requests, import aliases, duplicate/concurrent
  enrollment, existing mixed-batch compatibility and staff UI;
  [receipt](PROGRAM_BATCHES_AND_ENROLLMENT.md): 644 PostgreSQL/268 frontend tests,
  lint/build/check/drift and 26 browser groups passed; configured 0034 preserved
  all 42 old data tables/columns with three null context additions.
- [x] Commit and merge F03 locally before F04: implementation `54303ec`
  fast-forward merged into local `main` after all gates passed. No push.

### F04 — Profiles, onboarding and dynamic program controls

- [x] Branch `codex/dynamic-program-profiles` after F03 (`e1afb99`).
- [x] Dynamic program options in setup/profile/enrollment/admin instructor forms,
  rosters and filters; remove IC defaults from product copy/templates as appropriate.
- [x] Prevent student self-transfer; retain reviewed administrative transfer and
  earlier context. Update serializers/cache/navigation callers consistently.
- [x] Test all roles, phone/desktop, validation, stale selections and current
  profile/returning-student recovery; [receipt](DYNAMIC_PROGRAM_PROFILES.md):
  655 PostgreSQL/269 frontend tests, lint/build/check/drift and 22 browser groups
  passed. Configured 0035 preserved all 42 old data tables and fields.
- [x] Commit and merge F04 locally before F05: implementation `4241a66`
  fast-forward merged into local main. No push.

### F05 — Program competency frameworks

- [x] Branch `codex/program-competency-frameworks` after F04 (`f30c03e`).
- [x] Program-scoped categories and framework/version identities; same names in
  different programs do not collide or establish equivalence.
- [x] Instructor category creation/reuse with definitions/tags, creator/admin
  unused-edit rules, used-definition versioning and protected references.
- [x] Test same-program reuse, foreign-program denial, used locks, legacy
  compatibility without inferred mapping (F14), and upgrade preservation;
  [receipt](PROGRAM_COMPETENCY_FRAMEWORKS.md): 674 backend/271 frontend tests,
  check/drift/lint/build and six catalog plus 11 retained browser groups passed.
  Configured 0036 preserved all 42 old data tables/columns; one empty table added.
- [x] Commit and merge F05 locally before F06: implementation `3e70772`
  fast-forward merged into local main; no push.

### F06 — Category content and tag assistance

- [x] Branch `codex/scoped-category-assistance` after F05 (`ef3f603`).
- [x] Saved program content takes precedence; manual entry and abstention remain.
  Optional researched starter content has source attribution and no live scrape
  dependency or auto-overwrite. No required Entrep/Tourism catalog.
- [x] Test unfamiliar/ambiguous text, obsolete responses, foreign scope, failure
  recovery and manual override; [receipt](SCOPED_COMPETENCY_ASSISTANCE.md):
  684 backend/274 frontend tests, check/drift/lint/build, seven assistance and six
  retained catalog browser groups passed. No schema/configured data changes.
- [x] Commit and merge F06 locally before F07: `4776e3d`, fast-forward merged
  into local main; no push.

### F07 — Framework-aware assessment authoring

- [x] Branch `codex/framework-assessment-authoring` after F06 (`782d562`).
- [x] Resolve category IDs within the batch/framework; drafts/publication,
  existing-assessment edits and copies enforce current scope and content locks.
- [x] Preserve timing, required completion, retakes and category raw/max grading.
- [x] Test mixed category payloads, draft atomicity, publication, retakes and
  required/optional evidence with real-API browser checks;
  [receipt](FRAMEWORK_ASSESSMENT_AUTHORING.md): 699 full backend tests and 54 final
  focused tests, 275 frontend tests, lint/build/check/drift and six new/six retained
  browser groups passed. Configured 0037 preserved all 43 old data tables/values.
- [x] Commit and merge F07 locally before F08: `c17ac60`, fast-forward merged
  into local main; no push.

### F08 — General result and NLP text

- [x] Branch `codex/general-competency-text` after F07 (`6087602`).
- [x] Neutral category-evidence summaries replace computing orientation assumptions.
  Evaluate bounded symmetric definitions in matching text; version actual inputs.
- [x] Contextual tags/definitions never become individual mastery claims; zero and
  missing evidence remain distinct, ties and historical snapshots stay correct.
- [x] Test raw/max regressions, descriptions on both sides, unrelated/long text,
  fallback models and result/export UI; [receipt](GENERAL_COMPETENCY_TEXT.md):
  710 backend/274 frontend tests, lint/build/check/drift and five cross-program
  plus four retained result-navigation browser groups passed. No F08 migration.
- [x] Commit and merge F08 locally before F09: `faa4c6b`, fast-forward merged
  into local main; no push.

### F09 — Program-eligible opportunities and shared capacity

- [x] Branch `codex/program-opportunity-eligibility` after F08.
- [x] Explicit eligible programs; admin-controlled shared partner/position edits;
  compatible requirements; one genuine shared capacity across institutes.
- [x] Test empty eligibility, foreign requirements, shared last-slot races,
  current approvals and retained snapshots; complete UI and local merge.
  Implementation `dda3a47`, fast-forward merged into local `main`.
  [F09 receipt](PROGRAM_OPPORTUNITY_ELIGIBILITY.md).

### F10 — Scoped recommendation inputs and freshness

- [x] Branch `codex/scoped-recommendation-inputs` after F09.
- [x] Filter candidates before NLP/corpus creation; explicit compatible category
  identity; program/framework/corpus/text/policy provenance and scoped invalidation.
- [x] Preserve assessment-led ordering, coordinator review and allocation rules;
  never compare unrelated program questionnaire percentages as universal mastery.
- [x] Test independent-catalog edits, shared eligibility changes, stale locks,
  conflicts, all-zero/no-opportunity cases and approval snapshots; receipt/merge.
  Implementation `70f5b5c`, fast-forward merged into local `main`.
  [F10 receipt](SCOPED_RECOMMENDATION_INPUTS.md).

### F11 — Default AIKEN import with native-format choice

- [x] Branch `codex/aiken-question-import` after F10.
- [x] Shared AIKEN adapter for admin/instructor new/existing authoring; preserve
  manual/XLSX/CSV/SkillBridge text and their three question types.
- [x] Exact keys/options, visible errors, explicit supported-question selection,
  category bulk/individual mapping, staged save/cancel and publication validation.
- [x] Test supplied 20-question shape plus synthetic BOM/Unicode/line endings,
  malformed/duplicate keys, >4 choices, two-choice MCQ and legacy zero/false keys.
- [x] Test browser mapping/cancel/failure/role paths; receipt and local merge.
  Implementation `c7f8b6f`, fast-forward merged into local `main`.
  [F11 receipt](QUESTIONNAIRE_IMPORT.md).

### F12 — Protected questionnaire export

- [x] Branch `codex/questionnaire-export` after F11.
- [x] Export supported MCQ AIKEN with disclosed omissions/metadata limits; preserve
  native mixed-type option and correct answer order/keys under staff authorization.
- [x] Test backend key access, mixed-type choices and supported round trips.
  Actual DNSC LMS reverse import is separately verified or explicitly unverified.
- [ ] Complete responsive export UI/browser checks; receipt and local merge.

### F13 — Reports and derived-data scope

- [ ] Branch `codex/institute-report-scope` after F12.
- [ ] Audit analytics, counts, reports/exports, private evidence, notifications,
  SSE recipients, cache/query keys and rerun scopes for institute/program access.
- [ ] Test direct downloads/guessed IDs, revocation, independent scope, generated
  snapshots and live invalidation. Existing scores/history reconcile; receipt/merge.

### F14 — Existing IC mapping and final migration reconciliation

- [ ] Branch `codex/existing-institute-data-mapping` after F13.
- [ ] Reviewed mapping of existing records into normal IC/IT/IS context; ambiguous
  labels/mixed batches remain reviewable, original IDs/statuses/evidence retained.
- [ ] No data deletion, history-only state, forced split, automatic regrading,
  real recommendation rerun, account disabling or capacity release.
- [ ] Rehearse upgrade on isolated synthetic legacy data, compare preserved facts,
  verify backup/restore, then apply authorized tested configured migrations and
  save a private-data-free receipt; commit and merge locally.

### F15 — Help and project documentation

- [ ] Branch `codex/multi-institute-guidance` after F14.
- [ ] Update overview, ERD/data flow, roles, authoring/import/export help, competency
  definitions, matching contract, evaluation scope and operator migration guide.
- [ ] Verify links/examples/attribution and browser help behavior; local merge.

### F16 — Integrated acceptance and handoff

- [ ] Branch `codex/multi-institute-acceptance` after F15.
- [ ] Full relevant PostgreSQL/frontend regression, lint/build, migration drift,
  phone/desktop three-role journeys, access/rollback/concurrency/export checks.
- [ ] Synthetic IC compatibility, IBPA example programs and an arbitrary third
  institute/program work with the same code; inspect actual generated artifacts.
- [ ] Fix failures on this branch, document evidence/limits, stop only owned helpers,
  then commit/merge locally. No GitHub push or deployment without instruction.

## Receipts and checkpoint

Record per completed feature: branch, base/commit/merge, changed behavior, exact
checks/results, migration names/target class, preservation evidence, browser
artifacts, fixes, remaining limits and next step. Evidence with synthetic data
may live in ignored `work/`; credentials and personal records must not be logged.

Current checkpoint — ACTIVE on F12 (5 November 2026):

- Local `main` recorded the F11 pause as `173f42e`. Branch
  `codex/questionnaire-export` was created from that revision on CONTINUE.
- F01–F11 are verified and merged locally. Configured migrations are through
  `0038_position_program_eligibility`. The F12 working tree adds protected
  preview and download, AIKEN partial confirmation, SkillBridge text mixed-type
  export, and both staff interfaces. F12 needs no migration.
- Frontend lint/build and 283 tests passed. The 27-test focused PostgreSQL run
  passed (`work/organization-postgres-c4k_tov7/`). Two real Chrome download and
  reimport groups passed (`work/organization-browser-eog3d03_/`), as did three
  retained import groups (`work/organization-browser-8a57ldxl/`). Django check
  and migration drift passed. Next commit and merge F12 before starting F13.
- DNSC LMS-side import remains unverified. All changes have been local, with
  no deployment, IC mapping, or configured recommendation rerun.

- `codex/aiken-question-import` was created from `bcd9ec8`, the F10 receipt
  on local `main`. The supplied DNSC text export was verified locally against
  the parser for all 20 stems, 80 ordered choices and 20 keys. The question
  content stays outside tracked files.
- F11 implementation `c7f8b6f` has the shared AIKEN, native text and spreadsheet importer
  in both create and edit roles. Passed 282 frontend tests, 49 PostgreSQL
  authoring/policy tests (`work/organization-postgres-m_jj4zfc/`), and browser
  checks for numeric CSV/XLSX (8, `work/organization-browser-pi4pzxhx/`),
  framework authoring (6, `work/organization-browser-vtashqna/`), device drafts
  (14, `work/organization-browser-1tmflhr7/`) and archive/retained imports (12).
  The final real AIKEN workflow passed three groups with the original file,
  including phone dark review (`work/organization-browser-ww1znsjq/`). Disposable
  test databases that contained the supplied questions were removed after review.
- Frontend lint/build, local documentation links and Git whitespace passed.
  F11 requires no migration.

- `codex/scoped-recommendation-inputs` was created from `0922790`, the F09
  verification receipt on local `main`. F10 implementation `70f5b5c` was
  fast-forwarded into local `main`. The scoped corpus,
  fingerprints, exact category IDs and saved provenance are connected to
  ranking, result/roster/report reads and placement approval and allocation.
- Full PostgreSQL passed 721 tests (`work/organization-postgres-2336svqi/`).
  The final 89-test focused run passed after adding scoped enrollment locking
  and a two-refresh race (`work/organization-postgres-s8hilepl/`). The initial
  targeted failure from an obsolete shared draft signature reference was fixed.
- Three scoped ranking browser groups passed (`work/organization-browser-1enemi99/`),
  and five retained result/preview/report groups passed (`work/organization-browser-d0a9hiun/`).
  The isolated SQLite harness uses immediate transactions to handle overlapping
  initial results requests. Frontend unit tests passed 275. Django check and
  migration drift passed. F10 requires no migration.
- F09 was verified and locally merged before starting F10.

- On CONTINUE, verified the previous pause checkpoint, committed the F08 receipt
  as `974d53f`, fast-forwarded local `main`, and created
  `codex/program-opportunity-eligibility` from that commit.
- F09 implementation `dda3a47` was fast-forwarded into local `main`. The catalog shares one position
  and capacity across eligible programs. A position can use one eligible
  program's exact framework rubric. Scoped browsing, manual assignment,
  approval and retained placement records have been checked in the backend.
- Final focused PostgreSQL run passed 43 tests (`work/organization-postgres-qb84t4mu/`).
  Frontend unit tests passed 275, lint/build passed, and four real API browser
  groups passed (`work/organization-browser-nys7y253/`). The retained company
  browser regression passed seven groups (`work/organization-browser-e8rbrii8/`).
- All 716 tests in the final full PostgreSQL run passed
  (`work/organization-postgres-eq9mtmwz/`). Django check and migration drift,
  local documentation links, and Git whitespace passed.
- Guarded 0038 rehearsal passed on the synthetic source database
  (`work/program-migration-operator-q28v9631/`). The configured read-only check
  reported only 0038 pending. Applied only 0038 after private backup, exact
  isolated restore and migration rehearsal. All 43 prior tables retained
  their values and counts. The new column was null and the relation was empty.
  Receipt: `work/organization-configured-migration-cz9bse_n/receipt.json`.
- The first full run's instructor rollback fixture now uses the authorized
  admin role. The isolated browser harness uses a fresh instructor session for
  the post-save check because the harness suppresses live event delivery.
- No configured IC mapping, recalculation, GitHub push or deployment has occurred.

- F08 branch `codex/general-competency-text`, base `6087602`, implementation
  `faa4c6b` fast-forward merged into local main. No migration/configured write.
- F08: actual highest category summaries replace computing orientation rules;
  UI advice uses course materials instead of category-name activity inference.
  `general-category-context-v4` adds one bounded 160-character/12-word definition
  symmetrically, snapshots matching context/version in existing JSON, fingerprints
  actual bounded definitions and keeps missing/zero evidence distinct.
- Framework scores outside the current legacy catalog cannot enter that corpus
  or break result reads: they retain valid final category results and no new
  recommendation rows until F09/F10 supply compatible inputs.
- Final verification: 710 full PostgreSQL tests
  (`work/organization-postgres-__wu8wku/`), 274 frontend tests, lint/build/check/drift,
  149 document links and whitespace passed. Focused 92 passed before the final
  compatibility fix, which the full run covers.
- Five real cross-program result/preview/actual CSV-download groups passed
  (`work/organization-browser-1siirutz/`), no page errors. Four retained result
  navigation/accessibility widths passed (`work/organization-browser-k9v423i8/`).
  Additional 11-group catalog regression passed (`work/organization-browser-cj19pqor/`).
  Phone/dark and zero-result screenshots visually read. Offline definition
  ablation: `work/f08-definition-ablation.json` (synthetic mechanism only).
- Known failures: none remaining in F08. Earlier fixture/contract expectations,
  scoped result failure, a compatibility import and ID-only score mock support
  were fixed and final checks passed. [F08 receipt](GENERAL_COMPETENCY_TEXT.md).
- All owned helpers stopped. No real recommendation rerun or data rewrite.
  Configured migrations remain through 0037. No GitHub push or deployment.
- F07 branch `codex/framework-assessment-authoring`, base `782d562`, implementation
  `c17ac60` fast-forward merged into local main. No GitHub push or deployment.
- F07: nullable Assessment.framework retains scoped batchless draft identity;
  the first scoped assessment binds its compatible program batch. Framework IDs
  are immutable and definitions freeze permanently. First save requires current
  digest; category IDs are resolved only in that version. Creation/edit/append/
  delete, publication, copies and later assignment enforce scope. Both staff
  authoring paths, native imports and device draft recovery are connected.
  Existing IC rows retain their normal statuses and unmapped legacy context.
- Verification: 699 full PostgreSQL tests (`work/organization-postgres-4d603fyn/`),
  final 54 API/concurrency/upgrade/timing/publication tests
  (`work/organization-postgres-4jad1xg_/`), 275 frontend tests, lint/build,
  Django check/drift, 139 document links and whitespace passed.
- Six final F07 browser groups (`work/organization-browser-qjcd3pct/`) and six
  retained catalog groups (`work/organization-browser-e86h3hpl/`) passed, no page
  errors. Phone/dark editor image visually reviewed. More details and earlier
  corrected issues: [F07 receipt](FRAMEWORK_ASSESSMENT_AUTHORING.md).
- Synthetic 0037 operator rehearsal passed
  (`work/program-migration-operator-sa1w0uau/`). Configured 0037 applied only after
  private public-schema backup, exact isolated restore and actual Django rehearsal.
  All 43 old data tables retain old values/counts; one nullable Assessment link,
  all null. Receipt: `work/organization-configured-migration-mig6aj51/receipt.json`.
  No mapping, deletion, regrading, recommendation rerun or real notification send.
- F01–F06 are complete and locally merged. F06 implementation `4776e3d`, receipt
  `782d562`; F05 implementation `3e70772`, receipt `ef3f603`; F04 implementation
  `4241a66`, receipt `f30c03e`; F03 implementation `54303ec`, receipt `e1afb99`.
  Configured migrations are now through 0037. F14 mapping remains open.
- Known failures: none remaining in F07. Earlier nullable-join publication locking,
  synthetic fixture omissions, premature global-category loading and accessible
  answer-button test locator were corrected and final checks passed.
- All owned test/browser/database/restore helpers stopped. No hosted validation,
  academic matching accuracy or framework-scoped recommendation completion is
  claimed. F09–F16 remain open.
