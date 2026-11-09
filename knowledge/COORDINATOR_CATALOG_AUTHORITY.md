# Coordinator catalog authority

F17 adds program-scoped management APIs for approved instructors acting as OJT
coordinators. Management reads use current program grants, including before a
batch exists. The existing partner browsing, student matches and administrator
catalog APIs keep their established contracts.

## Ownership and sharing

New coordinator-created partners record their creator through `Company.added_by`
and their management program through `Company.management_program`. New positions
record `created_by` and `management_program`. Eligibility determines which
program can use an opening. Editing checks current program assignment; creator
fields retain audit provenance. The user's 9 November clarification supersedes
creator-only editing. [Current coordinator editing policy](COORDINATOR_SHARED_EDITING.md).

Same-program coordinators can read the program's partners and reuse them for
their own openings. An organization lookup returns only ID, name and address for
explicit reuse. Adding a position at an organization outside the current program
requires `reuse_existing: true`. Its new opening belongs to the requesting
program and coordinator. Foreign openings and student matches are excluded from
that program's management response.

Assigned coordinators can edit common partner details and openings visible in
their programs, including shared and admin-created entries. Shared edits appear
in the other program views without changing ownership. Original IC requirements
retain their shared format. Framework minimums are edited through their own
program context; another eligible program can update details while preserving
that rubric. Eligibility changes remain administrative. Archive/restore keeps
the earlier creator/admin authority rather than inheriting editing rights.
Original shared IC entries appear under both IC programs; configured program
sharing works in every institute. [Visibility review](SHARED_PARTNER_VISIBILITY_REVIEW.md).

## Requests and integrity

| Route under `management/programs/{program}/` | Operations |
| --- | --- |
| `partner-options/` | GET bounded organization identity lookup for reuse |
| `partners/` | GET paginated program catalog, POST partner |
| `partners/{partner}/` | GET partner, PATCH reviewed details and image |
| `partners/{partner}/positions/` | POST a coordinator-owned program opening |
| `positions/{position}/` | GET opening, PATCH reviewed position details and requirements |
| `partners/{partner}/archive/` | POST archive or restore after ownership and revision checks |
| `positions/{position}/archive/` | POST archive or restore after ownership and revision checks |

Detail payloads include `can_edit`, `can_archive`, `can_edit_requirements` for
openings, and `revision`. PATCH and archive/restore
require that revision. A stale review returns 409. Repeated names are flagged
for review before creating another partner or an identically named opening in
the same program. The UI must reconcile an uncertain create outcome through
authorized reads before offering a new submission.

Writes acquire the shared placement/catalog lock, then validate the current
program grant under the institute lock and recheck staff status. Slots respect
current approvals, and archiving refuses unresolved current approvals.
Requirements use exact IDs from a saved program framework version and freeze
consumed definitions. Existing recommendation freshness checks detect changed
requirements and descriptive text. Recorded assessment scores and placement
snapshots remain their original evidence.

Image changes reuse the existing decoded WebP pipeline and storage compensation.
The company transaction finishes or rolls back inside the image-change context.
Access, revision and ordinary field validation precede external uploads.
Successful catalog changes publish metadata invalidations after commit and add
an actor/program audit entry. Management GET responses use `no-store`.

## Migration and verification

Migration `0039_coordinator_catalog_authority` adds three nullable foreign-key
columns to the existing company and position tables. Existing creator
`added_by`, program eligibility, requirements, capacity and evidence are
preserved. The migration introduces no data backfill.

See the [active tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for actual
test results, migration rehearsal, configured application and local merge status.
The coordinator screens follow in F18, and the
[full workflow audit](INSTRUCTOR_PARTNER_POSITION_PLAN.md#system-flow-and-bug-review-checklist)
follows in F19.

The full isolated PostgreSQL regression passed 746 tests
(`work/organization-postgres-ayobxlao/`). Additional focused runs passed
16 tests for image compensation, archived-program reads and pagination
(`work/organization-postgres-lkzk6yaq/`), then 23 tests after the final duplicate
guard for existing administrator openings (`work/organization-postgres-56cfn383/`).
Django system and drift checks passed. The operator rehearsal restored the
synthetic source backup and applied the actual migration with all earlier fields
preserved (`work/program-migration-operator-nrlnkhvc/`).

The first configured attempt rolled back at the preservation comparison.
The operator now compares preserved fields within a consistent current
transaction, while retaining exact backup-restore verification. An isolated
writer regression confirmed that updates made during backup verification
survive the migration (`work/program-migration-operator-e4dpldq1/`). The
synthetic writer initially held an unintended long transaction, which triggered
the lock timeout. Its corrected autocommit run passed.

The configured retry applied only 0039 after its verified backup restore.
The receipt at `work/organization-configured-migration-yyl9jtw5/receipt.json`
confirms preservation of existing fields in 44 public tables, null new authority
links on existing records, and no pending migrations. It records an intervening
update to `api_emaildispatchcontrol` as preserved background activity. The final
23-test focused run also passed after capability flags were aligned with
archived-program write restrictions (`work/organization-postgres-svgt0tj_/`).

Implementation `f0f30f5` was fast-forwarded into local `main` after the F17
gates passed. Coordinator UI integration follows on its own F18 branch.
