# Program competency frameworks — F05

Branch `codex/program-competency-frameworks`, based on F04 receipt `f30c03e`.
See the [active tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for configured
migration and local merge status. This is the category-library feature; selecting
these versions during assessment authoring is F07, and ranking integration is F10.

## Catalog workflow

Admins and approved instructors open **Program competencies**, select a program
within their current assignments, and create a named framework version. A
framework is the program's reviewed set of scored knowledge categories. Each
category has its own database identity, name, required description and manually
entered tags. Tags describe vocabulary; they do not establish separately measured
skills or student mastery. No institute-specific category set is required.

Instructors in the same program share the library. They can reuse existing
definitions and add their own categories to an editable version. An unused
category can be edited by its creator or an admin; another instructor cannot
overwrite it. Framework metadata, freeze and retirement are managed by the
framework creator or an admin. These permissions confer no access to a colleague's
private batches, student records or answer keys.

Review the definition set before **Freeze definitions**. Freezing is permanent
for that version. Questions, requirements, scores or a bound batch also lock the
definition set. Subsequent changes require **Create new version**, which copies
definitions to new category IDs with explicit source references. Same display
names in different versions or programs do not establish equivalence or pool
evidence. Original definitions and recorded references remain unchanged.

Retiring a version retains its definitions and IDs. It can be read or copied
while its program remains available, and restoration does not unfreeze it.
Archived programs remain readable by currently assigned staff, but their catalog
definitions cannot be changed. Revoked assignments are checked on the next
request using the same JWT. Students cannot access program catalog endpoints.

Search, server pagination, counts, empty states and explicit refresh are provided
for versions/categories. Dialogs retain unsaved content on failure and confirm
discard. Content digests reject stale edits and stale freeze reviews, including
when another instructor changes the category set. Framework creation uses a
program-scoped request UUID so an uncertain saved response can be retried without
creating an extra version. Repeated identical category creation reuses its ID;
it never silently replaces an existing definition with different content.

## API and integrity

- `management/competency-programs/` and its program detail list the current
  staff member's readable contexts, including retained archived contexts.
- `management/programs/{program}/frameworks/` lists/creates versions; framework
  detail reads or updates metadata, freeze and retirement state.
- Framework `categories/` lists/creates definitions; category detail reads or
  updates an authorized unused definition. There is no definition DELETE route.
- Writes serialize against the same institute lock as program/grant mutations,
  then the framework. Version numbers and request identities have database
  uniqueness constraints; category names are case-insensitively unique inside a
  framework. Input shapes, limits and parent/creator scope are checked server-side.
- Questions, position requirements, assessment-level scores and combined category
  scores protect referenced categories from ORM deletion. Their raw/max/percentage
  values and identity are not reinterpreted by a new framework version.
- Committed catalog invalidations reach admins and current same-program staff,
  with program IDs. Other program queries remain distinct; student result caches
  and legacy placement reads are not subscribed to this catalog topic.

## Existing IC compatibility and migration

`0036_program_competency_frameworks` creates one initially empty framework table
and adds nullable `Batch.framework`, `SkillCategory.framework` and
`SkillCategory.source_category` relationships. It changes category-reference
deletion behavior to PROTECT and adds scoped uniqueness constraints. Existing
categories, batches, memberships, questions, scores, statuses and IDs are not
mapped, deleted, renamed or recalculated.

Unmapped legacy categories retain their normal existing workflows. Legacy
name-based authoring, requirement validation and ranking-category reads explicitly
use framework-null rows during this staged rollout. Thus adding an unrelated
program catalog cannot collide with an existing IC category lookup or alter its
ranking input fingerprint. This temporary boundary is explicit: new-library
authoring/matching and reviewed IC mapping remain F07/F10/F14, not claimed complete
by the catalog page. No historical-only mode or IC-specific restriction is added.

The migration operator verifies every old column value/count and the column
inventory, requires the new framework table to be empty and new old-table links
to be null, and rehearses the actual Django migration against an isolated restore
before configured application. Private dumps stay in ignored work directories.
Do not reverse this migration after frameworks are used without a separately
reviewed recovery plan; dropping the new relationships would discard context.

## Verification receipt

- Full disposable PostgreSQL regression: **674 passed**,
  `work/organization-postgres-svglv_11/tests.txt`. Focused API/concurrency/upgrade
  run: **19 passed**, `work/organization-postgres-tx82y10w/tests.txt`; final
  enhanced acceptance also passed 19 tests at
  `work/organization-postgres-btz73jm0/tests.txt`.
- Coverage includes same-program reuse, foreign/student/creator denials, typed
  content, stale digests, replay, permanent freeze, new-version identity, protected
  questions/scores, retire/restore, archived context, same-JWT revoke, rollback,
  scoped event recipients, independent-program names and legacy fingerprint
  isolation. Concurrent freeze/edit cannot both commit inconsistent reviews.
- The historical-model migration test compares every existing field, including
  synthetic question and raw/max score history. No framework is inferred.
- Synthetic source backup/restore/operator rehearsal passed,
  `work/program-migration-operator-myscsk6j/results.json`: all 38 old public data
  tables preserved, one empty framework table added and three null links.
- Frontend: **271 tests**, lint/build, Django check, migration drift and whitespace
  checks passed. Response contracts reject malformed catalog data before caching;
  invalidation/navigation tests cover the new routes and program boundaries.
- Real-API production-bundle browser checks passed six groups at
  `work/organization-browser-3c9_2w5_/results.json`, including manual entry, server
  search/pagination, discard, stale edit retention, freeze, a saved-but-lost clone
  response retried once, phone/dark peer permissions, admin retirement and revoke.
  Desktop catalog and phone dialog images were visually reviewed. The final
  catalog replay also passed six groups at `work/organization-browser-onvtovak/`;
  retained batch/enrollment/profile acceptance passed eleven groups at
  `work/organization-browser-h5hx4o04/`, all with no page errors.
- Configured 0036 applied after verified private public-schema backup, isolated
  restore and actual Django rehearsal. All 42 pre-existing data tables retain
  every previous value/count; one empty framework table and three null links
  were added. No records were mapped, regraded or recalculated. Receipt:
  `work/organization-configured-migration-qxf8x0rp/receipt.json`.
  The owned restore cluster is stopped. Local merge is recorded in the tracker.

Browser SSE transport is disabled in the fixture; recipient/invalidation behavior
is separately tested. No live Google identity, email delivery, hosted deployment,
academic validity of arbitrary definitions or new matching accuracy is claimed.
No GitHub push or deployment is authorized here.

Implementation `3e70772` was fast-forward merged into local `main` after all
verification and configured migration gates passed. No GitHub push or deployment.
