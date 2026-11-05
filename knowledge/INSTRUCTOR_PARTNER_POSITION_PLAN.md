# Instructor and OJT coordinator partner management

This extends the completed F01–F16 multi-institute implementation at
`7b63ed0`. The user requested adding partner and position creation to the
instructor side, where instructors can act as OJT coordinators for their assigned
programs. This document records the additional work and evaluation context.
The extension is planned and has not yet been implemented.

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

## Current code baseline

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

- [ ] Record stable creator and management-program authority for new partners
  and positions. Reuse the existing partner creator representation where valid.
  Existing entries with missing or admin creators retain administrator control
  until an explicit reviewed assignment.
- [ ] Define and test partner sharing. A coordinator can create and manage their
  own program's entries. Editing an organization shared with other programs
  requires administrator authority over the common details. Independently owned
  positions remain individually manageable within the authorized scope.
- [ ] Add staff management reads that work for assigned coordinators before a
  batch or student recommendation exists. Keep private matched-student
  information limited to the requesting coordinator's owned batches.
- [ ] Add create/update operations for partner details, available image/location
  fields, positions, slots, tags and framework category requirements. Require
  a current approved coordinator and an active assigned program for each write.
- [ ] Constrain coordinator-created eligibility and category IDs to their
  authorized program. Explicit sharing across programs uses administrator
  controls. The existing single-framework requirement contract remains the
  starting scope for this feature.
- [ ] Enforce write authority on detail IDs, nested position IDs, image mutations,
  archive/restore and related compatibility routes. Reject ownership,
  creator/program and institute changes supplied by an unauthorized caller.
- [ ] Preserve approved decisions and recorded scores. Prevent slot reduction
  below applicable occupied capacity. Recheck current assignment, catalog state
  and ownership under transaction locks during writes.
- [ ] Audit successful operations and invalidate only the appropriate catalog,
  ranking, capacity and report views. Recheck event identifiers after revocation.
- [ ] Verify backend role/scope tests, guessed IDs, same-program reuse, foreign
  program denial, creator loss of assignment, archive behavior, atomic rollback,
  concurrent edits and shared capacity.
- [ ] If a migration is required, rehearse fresh and upgraded schemas on an
  isolated PostgreSQL database. Verify private backup restore and preservation
  before applying the already-authorized configured migration.
- [ ] Record the results, then commit and merge locally before F18.

## F18 — Coordinator partner and position screens

Branch `codex/coordinator-partner-editor`, after F17 passes its gates.

- [ ] Add **Add partner**, **Add position** and authorized edit actions to the
  existing instructor partner area. Reuse compatible administrator form and
  validation components.
- [ ] Show the selected program, partner relationship, position eligibility,
  numerical requirements, tags and actual shared capacity clearly.
- [ ] Support choosing a program when a coordinator has several assignments,
  and display newly created partners even before they have an opening or batch.
- [ ] Offer authorized partner reuse with duplicate review. Keep shared metadata
  authority visible when another coordinator can add an opening but cannot edit
  the common organization details.
- [ ] Provide ordinary search, program filters, pagination, readable phone/desktop
  layouts and keyboard actions, following the collection UI skill.
- [ ] Retain unsaved input on validation/network failure, confirm discard,
  prevent duplicate submission and handle uncertain save outcomes.
- [ ] Revalidate available actions after assignment revocation and scope changes.
  Show the API's access error and clear restricted cached records.
- [ ] Verify real local create/edit flows, save/cancel/retry, empty and loading
  states, image/location behavior, shared reuse, keyboard focus, pagination and
  phone/light/dark layouts.
- [ ] Pass frontend tests, lint/build and relevant backend regression. Commit
  and merge locally before F19.

## F19 — Integrated acceptance and updated handoff

Branch `codex/coordinator-catalog-acceptance`, after F18 passes.

- [ ] Demonstrate Tourism and Social Work examples using synthetic configuration,
  plus an unrelated arbitrary program. Creating an example requires no
  institute-specific code or mandatory seeded categories.
- [ ] Have a coordinator create a partner and program opening, set requirements,
  obtain a recommendation from valid test evidence and review a placement.
- [ ] Verify same-program reuse, other-program denial, revoked authority, retained
  IC access, independent ranking freshness and shared slot consumption.
- [ ] Update the staff role table, workflow guide, ERD/data-flow references,
  deployment/migration receipts and evaluator demonstration checklist.
- [ ] Run relevant PostgreSQL and frontend regression, lint/build, drift and
  responsive Chrome checks. Inspect generated reports and stop owned helpers.
- [ ] Commit and merge locally after the checks pass. Publication and deployment
  follow the user's existing separate-instruction requirement.

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

## Current planning checkpoint

The extension is recorded as F17–F19. F01–F16 remain completed. The immediate
next implementation step is F17's backend authority and sharing audit, followed
by the smallest compatible data model and API changes. The existing feature
branch, verification, migration and local-merge rules apply.
