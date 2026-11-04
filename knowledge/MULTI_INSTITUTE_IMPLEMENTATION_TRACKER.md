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
- [ ] Commit and merge F02 locally before starting F03.

### F03 — Batch and enrollment context

- [ ] Branch `codex/program-batches-enrollment` after F02.
- [ ] New batch selects one assigned program; enrollments validate that context.
- [ ] Replace BSIT/BSIS-only backend enrollment rules with configured program
  aliases; preserve signed preview/confirm, identity checks and notification rules.
- [ ] Existing mixed batches keep memberships and evidence without forced split.
- [ ] Test direct foreign-context requests, import aliases, duplicate/concurrent
  enrollment, existing mixed-batch compatibility and staff UI; receipt/merge.

### F04 — Profiles, onboarding and dynamic program controls

- [ ] Branch `codex/dynamic-program-profiles` after F03.
- [ ] Dynamic program options in setup/profile/enrollment/admin instructor forms,
  rosters and filters; remove IC defaults from product copy/templates as appropriate.
- [ ] Prevent student self-transfer; retain reviewed administrative transfer and
  earlier context. Update serializers/cache/navigation callers consistently.
- [ ] Test all roles, phone/desktop, validation, stale selections and current
  profile/returning-student recovery; receipt and local merge.

### F05 — Program competency frameworks

- [ ] Branch `codex/program-competency-frameworks` after F04.
- [ ] Program-scoped categories and framework/version identities; same names in
  different programs do not collide or establish equivalence.
- [ ] Instructor category creation/reuse with definitions/tags, creator/admin
  unused-edit rules, used-definition versioning and protected references.
- [ ] Test same-program reuse, foreign-program denial, used locks, legacy mapping
  and upgrade preservation; complete UI/browser journey and local merge.

### F06 — Category content and tag assistance

- [ ] Branch `codex/scoped-category-assistance` after F05.
- [ ] Saved program content takes precedence; manual entry and abstention remain.
  Optional researched starter content has source attribution and no live scrape
  dependency or auto-overwrite. No required Entrep/Tourism catalog.
- [ ] Test unfamiliar/ambiguous text, obsolete responses, foreign scope, failure
  recovery and manual override; receipt and local merge.

### F07 — Framework-aware assessment authoring

- [ ] Branch `codex/framework-assessment-authoring` after F06.
- [ ] Resolve category IDs within the batch/framework; drafts/publication,
  existing-assessment edits and copies enforce current scope and content locks.
- [ ] Preserve timing, required completion, retakes and category raw/max grading.
- [ ] Test mixed category payloads, draft atomicity, publication, retakes and
  required/optional evidence with real-API browser checks; receipt/local merge.

### F08 — General result and NLP text

- [ ] Branch `codex/general-competency-text` after F07.
- [ ] Neutral category-evidence summaries replace computing orientation assumptions.
  Evaluate bounded symmetric definitions in matching text; version actual inputs.
- [ ] Contextual tags/definitions never become individual mastery claims; zero and
  missing evidence remain distinct, ties and historical snapshots stay correct.
- [ ] Test raw/max regressions, descriptions on both sides, unrelated/long text,
  fallback models and result/export UI; receipt and local merge.

### F09 — Program-eligible opportunities and shared capacity

- [ ] Branch `codex/program-opportunity-eligibility` after F08.
- [ ] Explicit eligible programs; admin-controlled shared partner/position edits;
  compatible requirements; one genuine shared capacity across institutes.
- [ ] Test empty eligibility, foreign requirements, shared last-slot races,
  current approvals and retained snapshots; complete UI and local merge.

### F10 — Scoped recommendation inputs and freshness

- [ ] Branch `codex/scoped-recommendation-inputs` after F09.
- [ ] Filter candidates before NLP/corpus creation; explicit compatible category
  identity; program/framework/corpus/text/policy provenance and scoped invalidation.
- [ ] Preserve assessment-led ordering, coordinator review and allocation rules;
  never compare unrelated program questionnaire percentages as universal mastery.
- [ ] Test independent-catalog edits, shared eligibility changes, stale locks,
  conflicts, all-zero/no-opportunity cases and approval snapshots; receipt/merge.

### F11 — Default AIKEN import with native-format choice

- [ ] Branch `codex/aiken-question-import` after F10.
- [ ] Shared AIKEN adapter for admin/instructor new/existing authoring; preserve
  manual/XLSX/CSV/SkillBridge text and their three question types.
- [ ] Exact keys/options, visible errors, explicit supported-question selection,
  category bulk/individual mapping, staged save/cancel and publication validation.
- [ ] Test supplied 20-question shape plus synthetic BOM/Unicode/line endings,
  malformed/duplicate keys, >4 choices, two-choice MCQ and legacy zero/false keys.
- [ ] Test browser mapping/cancel/failure/role paths; receipt and local merge.

### F12 — Protected questionnaire export

- [ ] Branch `codex/questionnaire-export` after F11.
- [ ] Export supported MCQ AIKEN with disclosed omissions/metadata limits; preserve
  native mixed-type option and correct answer order/keys under staff authorization.
- [ ] Test backend key access, mixed-type choices and supported round trips.
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

Current checkpoint:

- Branch: `codex/instructor-program-assignments`, base `02e20f0`.
- Completed: F01 catalog models/API/UI, configured migration and local merge; see
  [feature receipt](INSTITUTE_PROGRAM_ADMINISTRATION.md).
- Checks: 614 PostgreSQL backend tests, 265 frontend tests, lint/build, Django
  check/drift and 11 real-API browser groups passed. Desktop/phone images reviewed.
- Current milestone: F02 implementation in progress. Assignment models, protected
  API, current program options and admin dialogs are implemented; final regression,
  browser, migration and local merge gates remain open. Development is continuous:
  proceed to F03 automatically only after all F02 gates pass.
- Configured database: 0032 applied after verified isolated backup restore; 39
  pre-existing public data tables unchanged, two empty tables added. Initial
  Windows pipe issue was fixed before the successful attempt; both owned restore
  helpers were stopped. No existing records reclassified or recalculated.
- F02 configured migration: 0033 applied after verified isolated restore; 41
  pre-existing public data tables unchanged, one empty assignment table added.
  Receipt: `work/organization-configured-migration-w3op0r26/receipt.json`.
- GitHub: no push performed or authorized.
- Known failures: no remaining application failure. Final 629-test PostgreSQL run,
  267 frontend tests, lint/build, nine assignment browser groups and all 11 F01
  browser groups passed, including the replay after retaining explicit ordering
  in shared pagination (`work/organization-postgres-d56ir3zd/`).
- Exact next step: commit/merge F02 locally; then
  start F03 on a fresh feature branch without stopping for another permission.
