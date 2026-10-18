# SkillBridge NLP phased implementation handoff

Updated October 18, 2026. Status: implementation instructions, not completed work.
The current request updates documentation only. A future instruction to implement
a phase authorizes that phase's ordinary repository edits and verification;
reading this document alone does not authorize implementation or production writes.

## How an agent should use this handoff

Read AGENTS.md, the project overview, [design decision](NLP_DESIGN_DECISION.md),
and [improvement plan](NLP_IMPROVEMENT_PLAN.md). Inspect current code and relevant
Markdown references before editing: the repository may have changed since the
notebook snapshot. Follow the recommendation-audit skill for ranking/evidence work;
use assessment-review for grading/retake boundaries and the applicable UI/testing
skills for frontend work. Preserve unrelated workspace edits.

Implement only the phase explicitly requested. Complete its verification and
report the result before moving to a later phase. Do not interpret one phase's
completion as a request to implement all later phases. Within the requested
phase, make routine implementation decisions and proceed without repeatedly
asking for confirmation. No deployment or production migration/backfill is
included unless separately requested.

## Mandatory system audit before implementation

Before editing application code for the first requested phase, audit how the
current system works as a whole. Establish broad architectural coverage first,
then trace every affected path in detail. Do not assume that the notebooks,
design documents or an earlier chat describe the latest application correctly.
This audit is part of the requested phase, not a reason to stop at a plan or
request repeated permission for ordinary implementation work.

Record a concise audit in `knowledge/NLP_IMPLEMENTATION_AUDIT.md` before making
application changes. Include verified file/function references, baseline checks,
known failures, unverified areas, dependency impact and the intended change boundary.
Do not claim an exhaustive review or a passing baseline if access/dependencies
prevented verification. Do not query personal records or production databases
merely to complete this audit; use code, tests and synthetic/local fixtures.

### Coverage required

1. **Workspace and architecture:** inspect Git status, existing changes, nested
   instructions, project documentation, routes, dependency manifests and migration
   state. Map frontend callers through serializers/views/helpers to persistence.
2. **Roles and user journeys:** map student, instructor and admin authentication,
   onboarding, authorization, dashboards and the affected navigation/UI workflows.
   Confirm backend enforcement rather than relying on hidden controls.
3. **Catalog:** trace company/position editing, tags, taxonomy, requirements,
   validation, capacity, deletion/history protection and all description consumers.
4. **Assessments and evidence:** trace question creation/import, submission,
   grading, omissions/denominators, retakes, stopped/flagged attempts, score history,
   combined evidence, batch inclusion, required progress and finalization.
5. **NLP and ranking:** trace actual generated inputs, configured versus actual
   models, fallback behavior, TF-IDF scope, component scales/weights, ranking ties,
   stored fields and visibility. Locate every caller before changing a helper.
6. **Placement and reporting:** trace approval/capacity checks, placement snapshots,
   student/staff displays, exports and any report affected by the same data.
7. **Freshness and operations:** trace cache/mutation behavior, invalidation/SSE,
   stale recommendations, saved-profile versions, settings and model availability.
   Identify schema compatibility and deployment needs without performing deployment.
8. **Baseline verification:** run appropriate existing local checks and focused
   synthetic workflows before changes. Establish representative reference outputs
   for behavior that the phase must preserve. Record failures that already exist
   separately from failures introduced by the change.

### Preservation and implementation rules

- Extend existing models, services, editors and conventions where practical.
  Avoid replacing working subsystems or creating duplicate scoring/catalog paths.
- Treat phase boundaries as invariants. In Phases 1 and 2, existing grading,
  ranking inputs/weights, access gates, stored scores and placement behavior must
  retain their established behavior. New fields need safe defaults for old records.
- Prefer small additive changes and reversible local migrations. Do not reset
  the database, drop history, bulk-overwrite tags, clear user changes, regenerate
  all recommendations or silently migrate existing facts to inferred ones.
- Verify the intended feature and relevant existing workflows after edits.
  Compare against baseline outputs; investigate changed behavior rather than
  updating expected results simply to make tests pass.
- Document any unavoidable contract change before implementing it. If it falls
  outside the requested phase, defer it rather than expanding scope silently.
  Complete unaffected authorized work and state the specific blocker.
- Improve usability/performance within scope, but do not promise higher NLP
  accuracy or zero regression merely because the design is more elaborate.
  Report the evidence and remaining risks honestly.

For each later phase, refresh this audit for intervening changes and the new
affected paths. Reuse unchanged findings; do not mechanically rerun every check
when no change or unresolved concern justifies it.

## Phase overview

| Phase | Deliverable | Effect on live ranking | Completion evidence |
| --- | --- | --- | --- |
| 1 | Editable task suggestions and generated position-description preview | None; retain existing ranking text path | Role-safe persistence, preview and compatibility checks |
| 2 | Reviewed question-skill annotations and traceable evidence preview | None; retain existing scoring/ranking | Eligible counts reconcile with grading and history |
| 3 | Notebook/evaluation parity for proposed inputs and controls | Offline only | Paired component fixtures, honest results and configuration hashes |
| 4 | Integrate one specifically selected matching change | Deliberate, versioned input/ranking change | Authorization, stale-state handling, parity and workflow regression checks |
| 5 | Update manuscript and verification record to actual implemented state | None | Claims match implementation and actual test results |

Phases 1 and 2 make inputs available and reviewable; they do not silently start
feeding new text/evidence into recommendations. This separation lets the team
test a proposal before activating it. Phase 5 documentation maintenance also
happens within every earlier phase; the final phase reconciles the manuscript.

## Phase 1: automatic duties and description preview

### Scope

- Inspect the current Position model, serializers, endpoint callers, admin
  company/position editing UI, existing tags and catalog validation.
- Use a small curated role/task vocabulary to suggest relevant duties and
  technologies. Reuse existing taxonomy where suitable; avoid competing aliases.
- Let authorized catalog editors accept, remove and adjust selections. Long prose
  remains optional. Keep suggested defaults distinct from accepted requirements.
- Generate a deterministic readable preview from accepted selections and saved
  known requirements. Store the structured inputs and appropriate provenance/version
  fields using an additive, backward-compatible design chosen from current code.
- For unknown roles, allow reviewed custom tasks or a factual description of known
  requirements. Do not invent company duties. Validate lengths and allowed values.
- Preserve existing records that have no accepted tasks. Opening an editor must
  not auto-confirm suggestions or overwrite tags. Cancel must not persist drafts.
- Keep the current production description/ranking caller unchanged. New generated
  text is a preview until the selected integration in Phase 4.

### Outside scope

No question annotations, student evidence changes, new NLP model, changed hybrid
weights, recommendation regeneration, bulk task confirmation, deployment, or
production migration/backfill. Create migration files if needed and verify them
against a local/dedicated test database; do not run them against production.

### Acceptance and verification

- Authorized editors can save and reopen accepted selections and see a consistent
  preview. Other roles cannot mutate catalog requirements through the backend.
- Existing catalog fields and records remain compatible; unknown roles, empty
  selections, invalid input and canceled drafts behave predictably.
- Student text, category scores, 60/25/15 ranking and placement gates retain their
  current behavior. Verify the old ranking text path remains in use.
- Run focused backend tests for validation/access and relevant existing catalog
  regressions, Django check, frontend lint/build and a focused browser workflow.
  Use synthetic data and a local test configuration; report actual results/limits.
- Update design/status documentation with files, migration requirements, preview
  behavior, tests and any unresolved issue. Do not mark later phases complete.

## Phase 2: assessed skill annotations and evidence preview

Proceed only after a separate Phase 2 instruction and inspection of Phase 1 state.

- Add reviewed question-to-skill annotations beside the existing category.
  Automatic suggestions must not silently become confirmed annotations.
- Build a read-only evidence preview from eligible, graded question outcomes.
  Trace all selected source assessments/items/attempts and annotation versions.
- Follow current inclusion, batch, required-completion, stopped/flagged, retake,
  denominator and score-history rules. Do not change grading to produce a higher
  NLP result or flatten batch totals into averages of assessment percentages.
- Preserve numeric correct/assessed counts and distinguish unassessed from zero.
  Describe evidence on assessed items rather than claiming technology mastery.
- Avoid target-role injection and expected labels. Keep answer keys and private
  responses out of student-facing explanations and exported research fixtures.
- Keep ranking unchanged. No automatic rewrite of historical profile narratives.

Verify raw/max reconciliation, missing/incorrect/omitted items, unequal assessment
sizes, retakes, excluded evidence, source provenance and role authorization. Run
the relevant assessment/combined-competency tests and UI checks. Document any
limitation in reconstructing historical evidence rather than inventing it.

## Phase 3: offline parity and proposal evaluation

Proceed only after a Phase 3 instruction. Real-student collection is not a
prerequisite for testing code with synthetic fixtures; it is a prerequisite for
claiming independently evaluated real-world effectiveness.

- Adapt proposed production helpers into a new versioned notebook snapshot,
  rather than using synthetic annotations as if they were actual responses.
- Keep the original notebooks/results intact. Record schema, code, dataset,
  actual model and candidate-order versions.
- Compare category/location only, same-evidence structured skill coverage,
  current text, duties only, evidence only and both. Compare regex and trained
  preprocessing using identical inputs; report text-only and hybrid metrics apart.
- Keep numeric skill evidence separate from prose; TF-IDF does not reliably
  interpret correct/assessed counts quantitatively.
- Add a semantic-embedding challenger only if explicitly included in the requested
  experiment. Record model revision, chunking/truncation, score transformation,
  resource cost and development-only calibration. Do not assume it is better.
- Export helped/hurt cases, per-role support, confusion, component scores and
  comparable timing stages. Do not select favorable seeds or change expected labels.

Require numerical parity fixtures between the offline helpers and intended
production computation. Distinguish simulation behavior from independent results.
No universal acceptance percentage is defined. Report no gain and negative gain
as legitimate outcomes; a more elaborate pipeline is not automatically selected.

## Phase 4: activate a selected, versioned change

A Phase 4 request must identify the intended candidate or authorize choosing from
the documented evaluated alternatives. If evidence does not establish an accuracy
gain, describe any activation as a pilot, not a verified improvement. Do not choose
a more complex model solely because the capstone requires an NLP component.

- Wire only the selected confirmed duties/evidence representation into ranking.
- Preserve current weights unless the requested integration explicitly includes
  an evaluated weight change. Preserve enrollment, completion, inclusion,
  capacity and placement approval rules.
- Implement model/version provenance, stored-profile compatibility, explicit
  fallback reporting and stale recommendation invalidation through existing flows.
- Preserve assessment-level history, combined batch evidence and placement snapshots.
  No mass recalculation or live backfill follows merely from updating code.
- Test notebook/backend component parity and rounding/ties, missing evidence,
  empty text, unknown roles, model failures, missing coordinates, retakes, stale
  inputs and unauthorized mutation. Test the complete relevant local UI workflow.
- State rollout/migration needs and rollback options. Deployment and production
  mutation remain separately scoped actions.

## Phase 5: paper and handoff reconciliation

- Revise the [paper draft](../outputs/nlp_design/PAPER_REVISION_DRAFT.md) against
  the implementation that actually exists, using completed versus proposed tense.
- Separate old 300-case experiments, the 60-case simulation and any newer results.
- Reconcile conflicting timing tables and fastest-model statements using actual
  identified runs. Explain macro precision/recall/F1 and Hit Rate@3 precisely.
- Cite papers for methodology and related work, not proof of SkillBridge accuracy,
  optimal weights or a passing percentage. Keep functional/usability results apart.
- State what is implemented, tested, unverified and deferred. Update the project
  overview and applicable knowledge files so another agent can continue accurately.

## Copyable agent prompt: start Phase 1

> Implement Phase 1 only from knowledge/NLP_PHASED_IMPLEMENTATION.md. Read
> AGENTS.md, knowledge/PROJECT_OVERVIEW.md, knowledge/NLP_DESIGN_DECISION.md and
> knowledge/NLP_IMPROVEMENT_PLAN.md first, then inspect current code and applicable
> skills. Before editing application code, perform the mandatory system audit
> in the handoff and save knowledge/NLP_IMPLEMENTATION_AUDIT.md. Map the entire
> application architecture and user journeys, then deeply trace affected callers,
> permissions, catalog validation, evidence/scoring, recommendations, placements,
> reports and freshness flows. Establish local baseline checks and distinguish
> existing failures from regressions. Extend current components rather than
> replacing working subsystems. Add automatic position-duty/technology suggestions, editable accepted
> selections for authorized catalog editors, and deterministic generated-description
> previews. Preserve existing records, permissions and canceled drafts. Handle
> unknown roles without inventing duties. Keep the existing production ranking
> text path, weights, assessment scoring and placement rules unchanged; new text
> is preview-only in this phase. Use additive migrations if needed, verify with
> local/dedicated test data, run relevant backend checks, frontend lint/build and
> focused UI verification, and update documentation. Preserve unrelated workspace
> changes and compare existing workflow behavior against the recorded baseline.
> Do not implement later phases, deploy, mutate production data or
> regenerate live recommendations. Report implemented files, checks actually run,
> migration requirements, limitations and the next phase's prerequisites.

## Phase completion record

All phases are currently **planned** in this handoff. Check current code before
implementation in case another task has completed part of the scope. Replace
planned status only with verified implementation evidence; notebook simulations
do not count as deployed feature completion.
