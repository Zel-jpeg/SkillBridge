# Instructor and OJT coordinator partner management

This extends the completed F01–F16 multi-institute implementation at
`7b63ed0`. The user requested adding partner and position creation to the
instructor side, where instructors can act as OJT coordinators for their assigned
programs. This document records the additional work and evaluation context.
F17's backend authority and F18's coordinator screens are verified and merged
locally. F19 records integrated acceptance and the remaining coordinator evaluation.

## Confirmed scope and access

- [x] Add partner and position creation and editing to the instructor workflow.
- [x] Use **Instructor / OJT coordinator** terminology for this workflow,
  retaining the existing internal instructor role and program grants.
- [x] The coordinator who created an entry and administrators can edit it.
  This is the recorded interpretation of the user's affirmative response to the
  creator-and-administrator proposal. Other assigned coordinators can view and
  reuse openings for their program.
- [x] Derive institute access from current program assignments. Assignment to
  another program in the same institute provides access only to that program.
- [x] Keep one actual slot count for each position shared across programs.
- [x] Keep the original IC catalog, evidence and placement decisions available
  through their existing access rules.

The same partner organization may offer different openings to several programs.
Use program context on the managed entries and explicit position eligibility.
Review potential duplicate partners before linking existing organizations.
Distinct opportunities can have different requirements and independent slots.
A single actual shared opening must retain its shared capacity.

## Code baseline before the extension

- `instructor_companies` currently lists openings eligible for the instructor's
  owned active batches and attaches only authorized student matches.
- Partner/position creation and mutations are currently admin-controlled.
  The compatibility endpoint named `instructor_company_edit` also requires an
  administrator. Adding controls alone would leave the instructor requests denied.
- `Company.added_by` records the partner creator. `Position` has no creator or
  management-program field. `eligible_programs` determines student eligibility
  and does not by itself establish catalog editing authority.
- Position requirements reference exact category IDs from one framework version
  of an eligible program. A shared opening currently has one requirements set.
  Other eligible programs can use its manual-placement path.
- Existing catalog validation, image handling, locks, archive/recovery,
  fingerprinting, audit and notification mechanisms must be traced and reused.

[Views](../skillbridge-backend/api/views.py) ·
[Models](../skillbridge-backend/api/models.py) ·
[Position validation](../skillbridge-backend/api/catalog_validation.py) ·
[Current eligibility contract](PROGRAM_OPPORTUNITY_ELIGIBILITY.md)

## F17 — Catalog authority and backend operations

Branch `codex/coordinator-partner-authority`, from the completed plan receipt.

- [x] Record stable creator and management-program authority for new partners
  and positions. Reuse the existing partner creator representation where valid.
  Existing entries with missing or admin creators retain administrator control
  until an explicit reviewed assignment.
- [x] Define and test partner sharing. A coordinator can create and manage their
  own program's entries. Editing an organization shared with other programs
  requires administrator authority over the common details. Independently owned
  positions remain individually manageable within the authorized scope.
- [x] Add staff management reads that work for assigned coordinators before a
  batch or student recommendation exists. Keep private matched-student
  information limited to the requesting coordinator's owned batches.
- [x] Add create/update operations for partner details, available image/location
  fields, positions, slots, tags and framework category requirements. Require
  a current approved coordinator and an active assigned program for each write.
- [x] Constrain coordinator-created eligibility and category IDs to their
  authorized program. Explicit sharing across programs uses administrator
  controls. The existing single-framework requirement contract remains the
  starting scope for this feature.
- [x] Enforce write authority on detail IDs, nested position IDs, image mutations,
  archive/restore and related compatibility routes. Reject ownership,
  creator/program and institute changes supplied by an unauthorized caller.
- [x] Preserve approved decisions and recorded scores. Prevent slot reduction
  below applicable occupied capacity. Recheck current assignment, catalog state
  and ownership under transaction locks during writes.
- [x] Audit successful operations and invalidate only the appropriate catalog,
  ranking, capacity and report views. Recheck event identifiers after revocation.
- [x] Verify backend role/scope tests, guessed IDs, same-program reuse, foreign
  program denial, creator loss of assignment, archive behavior, atomic rollback,
  concurrent edits and shared capacity.
- [x] If a migration is required, rehearse fresh and upgraded schemas on an
  isolated PostgreSQL database. Verify private backup restore and preservation
  before applying the already-authorized configured migration.
- [x] Record the results, then commit and merge locally before F18 (`f0f30f5`).

## F18 — Coordinator partner and position screens

Branch `codex/coordinator-partner-editor`, after F17 passes its gates.

- [x] Add **Add partner**, **Add position** and authorized edit actions to the
  existing instructor partner area. Reuse compatible administrator form and
  validation components.
- [x] Show the selected program, partner relationship, position eligibility,
  numerical requirements, tags and actual shared capacity clearly.
- [x] Support choosing a program when a coordinator has several assignments,
  and display newly created partners even before they have an opening or batch.
- [x] Offer authorized partner reuse with duplicate review. Keep shared metadata
  authority visible when another coordinator can add an opening but cannot edit
  the common organization details.
- [x] Provide ordinary search, program filters, pagination, readable phone/desktop
  layouts and keyboard actions, following the collection UI skill.
- [x] Retain unsaved input on validation/network failure, confirm discard,
  prevent duplicate submission and handle uncertain save outcomes.
- [x] Revalidate available actions after assignment revocation and scope changes.
  Show the API's access error and clear restricted cached records.
- [x] Verify real local create/edit flows, save/cancel/retry, empty and loading
  states, image/location behavior, shared reuse, keyboard focus, pagination and
  phone/light/dark layouts.
- [x] Pass frontend tests, lint/build and relevant backend regression. Commit
  and merge locally before F19.

## F19 — Full workflow audit, integrated acceptance and handoff

Branch `codex/coordinator-catalog-acceptance`, after F18 passes.

- [x] Demonstrate Tourism and Social Work examples using synthetic configuration,
  plus an unrelated arbitrary program. Creating an example requires no
  institute-specific code or mandatory seeded categories.
- [x] Have a coordinator create a partner and program opening, set requirements,
  obtain a recommendation from valid test evidence and review a placement.
- [x] Verify same-program reuse, other-program denial, revoked authority, retained
  IC access, independent ranking freshness and shared slot consumption.
- [x] Complete the full workflow and regression matrix below, covering both
  the coordinator extension and its interactions with F01–F16.
- [x] Perform exploratory bug review beyond the scripted successful flows.
  Record every finding, fix confirmed in-scope defects, and repeat the affected
  flow and neighboring regression checks.
- [x] Update the staff role table, workflow guide, ERD/data-flow references,
  deployment/migration receipts and evaluator demonstration checklist.
- [x] Run relevant PostgreSQL and frontend regression, lint/build, drift and
  responsive Chrome checks. Inspect generated reports and stop owned helpers.
- [ ] Commit and merge locally after the checks pass. Publication and deployment
  follow the user's existing separate-instruction requirement.

## System flow and bug review checklist

The user requested checking the system for missed steps, overlooked bugs and
other problems. Apply relevant checks during F17 and F18 before their merges.
F19 then verifies the combined current system, including existing features.
The local results, findings and verification limits are in the
[F19 acceptance receipt](COORDINATOR_CATALOG_ACCEPTANCE.md).

### Complete user journeys

- [x] **New program setup.** An admin creates an institute and program, assigns
  an approved coordinator, and the coordinator defines categories, descriptions
  and tags in a reviewed framework.
- [x] **Catalog preparation before enrollment.** An assigned coordinator creates
  a partner and opening before any batch exists. Review name/location/image,
  eligibility, category requirements and slots, then find and edit the saved entry.
- [x] **Existing partner reuse.** Another authorized coordinator finds the partner
  and creates or reuses an appropriate opening. Verify common-detail ownership,
  program visibility, independent requirements and the shared capacity rules.
- [x] **Assessment creation.** Create a program batch, import and manually add
  MCQ, true/false and identification items, review categories and keys, save
  a draft, then publish after the required checks pass.
- [x] **Student access and assessment.** Enroll a synthetic student, sign in,
  complete the profile, start, save answers, reload/resume and submit. Compare
  recorded answers and raw/max category totals with hand-calculated expectations.
- [x] **Required completion and retake.** Complete multiple required assessments,
  verify final competency and recommendation gates, request/review a retake,
  retain the earlier attempt and complete the new attempt.
- [x] **Placement review.** Inspect eligible recommendations and numerical
  requirements, approve or manually assign within existing policy, verify
  occupied capacity and the student-visible decision, then check retained history.
- [x] **Reports and exports.** Verify institute/program/batch filters, counts,
  actual CSV/PDF/XLSX downloads where supported, questionnaire exports and
  re-import. Compare exported values, order and scope with saved evidence.
- [x] **Lifecycle and access changes.** Revoke/restore a grant, change batch
  ownership, archive/restore applicable records and switch accounts. Verify
  access, cached data, open dialogs, protected evidence and new writes.
- [x] **Existing data.** Repeat applicable flows with synthetic existing IC
  records and mixed cohorts alongside new programs. Verify original IDs,
  memberships, statuses, scores and placement snapshots.

### Review matrix for missed problems

| Area | Cases to exercise | Evidence to record |
| --- | --- | --- |
| Roles and program boundaries | Anonymous/student/admin/coordinator requests, creator versus peer, same-institute foreign program, multiple grants, revoked approval or assignment and direct guessed IDs | HTTP status, authorized response fields and unchanged unauthorized records |
| Input and files | Required/blank fields, malformed IDs, zero/negative/oversized slots, invalid percentages, duplicate partner review, same-name categories in different frameworks, malformed question files, numeric zero/False keys and literal special characters | Validation location, preserved draft, atomic save outcome and correct stored values |
| Assessment integrity | Omitted answers, foreign choices, duplicate question IDs, repeated start/submit, attempt identity, timeout, interruption, concurrent finalization and approved retake | Known answer totals, one finalized attempt, retained history and correct completion gates |
| Ranking and eligibility | Assessed zero, missing evidence, no eligible opening, changed tags/requirements, independent-program edits, stale rankings and retained completed competency | Exact framework/category IDs, candidate set, saved model/policy context and current/stale visibility |
| Capacity and concurrent writes | Two approvals competing for the last slot, duplicate clicks, two editors, shared openings, slot reduction after approval and archive versus placement | Final occupied count, conflict handling, consistent audit trail and no duplicated decision |
| Recovery | Slow/offline response, failed upload, rejected save, refresh, back navigation, tab switching, expired session and uncertain write completion | Retained or recoverable input, clear outcome, bounded retry and no unintended repeat mutation |
| Live updates and privacy | SSE reconnect, late responses after revocation/logout, inactive accounts, account switching, cached reports, private keys/evidence and foreign roster data | Correct invalidation, discarded stale response and denial on a fresh API request |
| UI and collections | Phone/desktop, light/dark, keyboard and focus, search/filter reset, pagination clamp, empty/loading/error states, long names and confirmation/cancel | Screenshots, accessible control behavior, stable filtered counts and browser errors |
| History and database upgrade | Fresh schema and upgrade from the actual predecessor, partial failure/rollback, backup restore and reconciliation of existing rows | Allowed-change inventory, private-data-free hashes/counts, preserved evidence and migration receipt |
| External integrations | Map/geographic service failure, image storage, email queue/delivery, Google sign-in and LMS exchange as applicable | Identify mocked/local behavior, actual authorized provider results and any outstanding external check |
| Performance and resource use | Bounded concurrent assessment starts/submits and catalog reads on isolated PostgreSQL, repeated list navigation, larger permitted files and representative pagination | Workload size, response timings, errors, query/resource observations and owned-helper cleanup |

- [x] Trace affected API callers, validators, serializers, database writes and
  invalidation paths against this matrix. Look for hardcoded program assumptions,
  inconsistent role checks, missing ownership on older rows and incomplete routes.
- [x] Review routes beyond the visible buttons, including compatibility endpoints,
  nested position IDs, images, archive/recovery and protected downloads.
- [x] Compare UI, API, stored data and exported reports for the same scenario.
  Investigate contradictions even when an individual test passes.
- [x] Use the assessment-review, recommendation-audit, collection-UI and browser
  testing skills where relevant. Current implementation and its accepted policy
  resolve differences with older notes.
- [x] Review existing regression coverage first. Add targeted tests for uncovered
  behavior and each confirmed regression, then run the applicable suites.
- [x] Use isolated synthetic records for destructive, concurrency and fault
  injection checks. Record external-service checks that require later authorized
  access alongside the local evidence.

### Findings, fixes and completion gates

- [x] Keep a findings register with the affected role/program/flow, reproduction
  steps, expected versus actual behavior, severity, evidence path, cause,
  repair commit and retest outcome. Keep credentials and student records private.
- [x] Mark findings as confirmed, under investigation, fixed and retested, or
  externally unverified. Distinguish a product defect from a test-harness error.
- [x] Address confirmed in-scope bugs on the current feature branch, starting
  with access leakage, lost/corrupted records, incorrect grading, incorrect
  placement capacity and blocked core workflows.
- [x] After each fix, rerun the reproduction and affected neighboring flows.
  A later change to the checked behavior invalidates its earlier verification.
- [x] Keep acceptance open while required behavior fails. Record any deferred
  issue or external dependency explicitly in the handoff with its impact and
  next verification step.
- [x] Finish with PostgreSQL regression, frontend tests, lint/build, system and
  drift checks as applicable, plus Chrome checks for affected roles and screens.
  Reuse unchanged passing evidence when its source and scope still apply.
- [x] Record coverage and remaining limits, inspect artifacts and confirm owned
  helper cleanup before the local merge. Test results describe the checked
  version, workload and cases.

### Coordinator evaluation session

- [ ] Once participation is confirmed, let the Tourism coordinator complete a
  realistic task sequence using authorized sample content. Observe unclear
  steps, incorrect assumptions, workarounds and unfinished tasks.
- [ ] Apply the same evaluation structure to Social Work after its coordinator
  confirms the workflow, using its own definitions, partners and positions.
- [ ] Record usability feedback, content corrections and recommendation judgments
  with the relevant scenario. Add reproducible software problems to the findings
  register and retest the repaired workflow.
- [ ] Report actual participants, completed tasks, observed failures and remaining
  validation needs. Trace exam relevance to their placement process before
  drawing conclusions about the system's suitability.

Related references include the [previous integrated acceptance](MULTI_INSTITUTE_ACCEPTANCE.md),
[local workflow checks](LOCAL_WORKFLOW_ACCEPTANCE.md),
[local access review](LOCAL_SECURITY_REVIEW.md),
[assessment integrity](ASSESSMENT_SUBMISSION_INTEGRITY.md) and
[report reconciliation](REPORT_RECONCILIATION.md).

## Evaluation contacts and workflow discovery

The following information comes from the user's conversations. It is separate
from the official website research and the synthetic program fixtures.

| Program | Reported contact and workflow | Current status |
| --- | --- | --- |
| Tourism | The user spoke to the OJT coordinator, who described training, an interview and then an exam. The coordinator indicated they could try evaluating SkillBridge because the program also uses assessments. | Possible evaluator. Confirm participation, evaluation role and the exact place of the exam in their placement decision process. |
| Social Work | A student described partners and positions and a pen-and-paper assessment, broadly resembling the computing workflow. | Possible evaluation context. Confirm directly with an authorized instructor or OJT coordinator. |

- [ ] Confirm each participant's intended evaluator role and availability.
- [ ] Ask how partners and positions are selected, who updates them and whether
  slots are shared with other programs.
- [ ] Ask what the written assessment measures, its item types and scoring,
  how it relates to training/interviews and whether it informs placement.
- [ ] Obtain an authorized sample with answer keys and category definitions for
  content review. Use synthetic or appropriately authorized records for demos.
- [ ] Have the coordinator review category descriptions, tags and numerical
  position requirements before evaluating result relevance.
- [ ] Evaluate software usability and scope separately from questionnaire
  validity and recommendation usefulness. Record the limitations of each finding.

Training and interview stages supply evaluation context. Implementing new
training/interview tracking or automated practical grading requires a separate
request. Paper questionnaires can be authored or converted into the supported
question formats after the instructor checks their keys and category mappings.

## Current execution checkpoint

F01–F18 are merged locally. F19 completed the local audit, corrected the
closed-opening issue and passed final regression on its feature branch.
See the [acceptance receipt](COORDINATOR_CATALOG_ACCEPTANCE.md) and the
[active tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md). The evaluator
session and authorized provider checks are listed separately in the
[evaluator checklist](COORDINATOR_EVALUATOR_CHECKLIST.md).
