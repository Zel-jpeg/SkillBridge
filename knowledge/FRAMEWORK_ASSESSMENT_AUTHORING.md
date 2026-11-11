# Framework-aware assessment authoring

F07 connects [program competency frameworks](PROGRAM_COMPETENCY_FRAMEWORKS.md)
to new assessments and their question categories. It retains the original
MCQ/true-false/identification grading, attempts, retakes, timing, required/optional
completion and combined raw/max evidence. Recommendation text, eligible positions
and scoped ranking inputs remain F08–F10; this staged feature does not claim that
new program recommendations are complete.

## Choosing definitions

- In Program competencies, create and review at least one category in an active
  framework. Empty frameworks cannot be bound by assessment creation.
- In New assessment, choose a program batch. If its framework is already bound,
  that version is fixed. Otherwise choose a reviewed version from that program.
  An unassigned program draft can instead select its program and framework first.
- **Program and skills** shows the selected program, skill set, and available
  categories. Use **Choose program** or **Change program** to open the searchable
  picker for an unassigned draft. The skill set shows version numbers when
  multiple sets are available to distinguish.
- With no batch or program selected, the creator keeps questions editable and
  prompts for a selection before showing skill categories. Imports staged at
  that point remain uncategorized. Selecting an existing shared IC batch opens
  its shared skills. Selecting a program opens only the chosen program skill set.
- Categories come only from that saved version. Manage names/descriptions/tags
  in the program catalog. Review category definitions before assigning questions.
  Optional saved-definition suggestions use [F06](SCOPED_COMPETENCY_ASSISTANCE.md)
  and require explicit acceptance; scoped question/import paths do not call the
  global IC suggestion helper.
- Saving a scoped draft fixes its framework permanently, even if batchless or
  still empty of questions. Its framework definitions freeze permanently at
  first use. Deleting a reference does not make that version editable again.
  A later definition revision requires a new version; a batch keeps its version.
- The first scoped assessment binds its program batch to that same version.
  All subsequent assessments in the batch must agree. Existing unmapped batch
  assessments require reviewed mapping rather than implicit conversion.
- Switching unsaved batch/program/framework choices preserves question text and
  keys but clears category assignments for review. A first save requires the
  current definition digest; a concurrent catalog edit rejects it without binding
  or saving partial data. Use **Reload skill categories** when the editor reports
  a definition change or load failure, then review and retry.
- Local device draft recovery retains program/framework identity along with
  category IDs. A revoked or unavailable context cannot be saved merely because
  an old draft is still stored on that device.

## Editing, imports, publication and copies

Both instructor editing and the admin authoring dialog load the authorized
version's categories. Requests use `category_id`, resolved inside that framework.
Names alone cannot assign a scoped question; conflicting names/IDs, categories
from another version/program and scoped IDs without a framework are rejected.
Same-program colleagues share definitions, not private assessments or answer keys.

Manual/native Excel/CSV/SkillBridge-text authoring still supports all three
question types. A native import's exact case-insensitive category name can map to
this version's ID. An unknown name remains uncategorized for explicit assignment;
it never creates a global category. Imported questions stay local until save and
publication still requires a valid category/key for every question. AIKEN import
and its dedicated mapping review remain F11.

Atomic authoring validates the complete settings/question plan before applying
changes. Append, individual question edit/delete, single publication and grouped
publication enforce framework scope and existing attempt locks. A bad question
or incompatible assignment leaves settings, questions, batch binding and grading
history intact. Framework and institute locks serialize first binding with
definition edits, catalog changes and assignment revocation; the existing
lifecycle lock serializes competing batch versions and attempt/publication writes.

Duplicate as draft retains the original framework/category IDs and copies only
questions/keys into Draft, Optional, Excluded state with no schedule, attempts,
scores or placements. A batchless copy retains its program scope. Target-batch
choices and later assignment permit only the same program/version (or an unbound
compatible program batch). Different versions need a new assessment and reviewed
category mapping; matching labels do not establish equivalence. Assignment to a
new batch requires an active version/program and an assigned responsible owner.

Existing legacy IC assessments/batches remain on the framework-null compatibility
path, with current statuses and normal access. No automatic reassignment, archive,
deletion, splitting, regrading or recommendation rerun occurs. F14 will review
their mapping explicitly. A legacy assessment cannot be silently moved into a
program framework through a copied title or category name.

## Persistence and freshness

Migration `0037_assessment_framework` adds one indexed nullable PROTECT foreign
key on Assessment. It introduces no tables or data mapping; all old links start
null. `Batch.framework` and category identities from 0036 remain unchanged.
Framework usage detection now includes empty scoped assessment drafts.

Staff authoring definitions are read at
`management/programs/{program}/frameworks/{version}/authoring/`; current grants
are checked server-side. The response includes the saved framework digest and
category IDs/definitions/tags, never questions/keys. Frontend contracts validate
program/version identity and category ownership before use. First-use freeze
publishes program-scoped catalog invalidations to current same-program staff and
admins without private assessment IDs. Batch binding invalidates only its owner
and admins. Creator prefetch waits for context rather than fetching global IC
categories before a program batch loads.

## Verification receipt

- Branch `codex/framework-assessment-authoring`, base `782d562`; implementation
  `c17ac60` was fast-forward merged into local main after the checks below.
- Full isolated PostgreSQL regression: **699 passed**,
  `work/organization-postgres-4d603fyn/tests.txt`. Additional final focused scope,
  concurrency, upgrade, authoring/timing and grouped-publication checks:
  **54 passed**, `work/organization-postgres-4jad1xg_/tests.txt`. This final run
  includes the empty-framework, active-assignment and recipient-scope fixes.
- Synthetic 0037 operator rehearsal passed,
  `work/program-migration-operator-sa1w0uau/results.json`: 39 existing synthetic
  data tables preserved through actual backup, restore and Django migration.
  Historical-model upgrade tests compare every pre-existing model field and keep
  all old assessment framework links null.
- Frontend: **275 tests passed**; lint/build, Django check and migration drift
  passed. Scoped cache invalidation and authoring response contracts are covered.
- Final real-API production-bundle browser acceptance: **six groups passed**,
  `work/organization-browser-qjcd3pct/results.json`, no page errors. Creation,
  version changes, stale first-save recovery, original category IDs on editing,
  compatible duplication/assignment, optional publication, phone/dark admin native
  import/manual mapping, atomic save and batchless local draft recovery passed.
  The phone editor image was visually inspected.
- Retained F05 catalog acceptance: **six groups passed**,
  `work/organization-browser-e86h3hpl/results.json`, no page errors.
- Earlier full-run failures were two synthetic presentation fixtures missing the
  new nullable field; fixtures were updated. An actual grouped-publication lock
  failed on a nullable join and now locks only assessment rows. First browser
  checks also caught premature global-category loading and an inaccessible
  answer-button test locator; loading is scoped and answer controls now have
  explicit labels/pressed state. Final runs passed.

- Configured 0037 applied after target fingerprint verification, private
  public-schema backup, exact isolated restore and actual Django rehearsal.
  All **43 existing data tables** retain previous column values/counts, no new
  tables, one nullable link per existing assessment, all null. Receipt:
  `work/organization-configured-migration-mig6aj51/receipt.json`.
  No mapping, regrading, recalculation or real notification send. Owned restore
  cluster stopped. Local documentation links (139) and whitespace checks passed.

Local commit/merge is recorded in the [tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md).
No GitHub push or deployment. Live hosting, external identity/email and matching
validity remain separate. Browser SSE is disabled in these fixtures; recipient
scope/cache invalidation have backend/frontend tests. New recommendation generation
for program frameworks is deliberately not claimed complete before F09/F10.
