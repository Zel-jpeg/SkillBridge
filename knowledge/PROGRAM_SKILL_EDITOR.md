# Program skill editor and coordinator management

The update on `codex/program-skill-editor` implements the user's Imagegen concept
with a visible Suggest tags button. The existing shared IC editor and every
program editor use the same required name/description fields and removable tag
chips. The preview is a design reference, not a bitmap inserted into the app.
Ordinary text follows SkillBridge's 12px scale, with separate heading hierarchy,
green actions, light/dark themes, a scrolling form and visible header/footer.
The skill-dialog variant is up to 560px wide on desktop, remains inset on phones,
and does not change other detail or confirmation dialog layouts.

The tag field uses one focus border around the chips and typing row. A divider
appears when the field contains tags. Pressing Enter or comma adds the draft as
a tag chip. The remove buttons retain their own keyboard focus indicator.

## Staff workflow

- Assigned, approved instructors/OJT coordinators can add, edit and remove skills
  in their own program, including unused skills created by another coordinator
  or the admin. Tags are edited within the same skill form. Admins can manage
  all programs. Unassigned/revoked staff and students cannot use guessed IDs.
- Skill name and description are required. Enter or comma adds draft tag chips;
  the chip X removes a draft tag. Save includes text still in the tag input.
  Case-insensitive duplicates are removed while retaining the first spelling.
  Limits remain 30 tags and 80 characters per tag. Cancel/discard preserves saved
  definitions, and failed saves retain the draft.
- **Suggest tags** adds editable draft keywords after an explicit click. For
  programs, it extracts phrases from the description, trimming instructional
  wording such as “capture accurate” to retain the subject. A new program can
  get suggestions before it has any saved skills. If a different skill in the
  latest active program library is a clear text match, the button adds up to
  four of that skill's distinct saved tags within the 12-suggestion limit.
  Empty results and failures leave manual entry and saving available. Results
  for changed inputs or an unmounted editor cannot change the next draft.
  Manual chips added while a request is pending remain in the result.
- **Reuse saved tags**, collapsed by default, finds vocabulary already saved in
  that program skill-set version. **Add suggested tags** explicitly merges it.
  It remains available for reviewing the source skill explicitly, retains the existing
  definition-digest check, and cannot copy another program's private vocabulary.
- Shared institute editors use the same phrase extraction and related-skill
  lookup, with vocabulary limited to the selected institute's shared library.
  Administrators manage shared skills. The existing IC editor also offers its
  curated presets for familiar skill names. All editors preserve manual chips.

## Simplified program skill page

The admin and instructor taxonomy pages open the latest active program skill
library directly, including programs with multiple saved revisions. They show
the same skill table, description, tags and permitted editing actions.
Version browsing, manual framework creation, freezing and retirement controls
are removed from this page. Empty programs begin with Add Skill.
If all saved libraries are retired, the latest retired library remains readable.

The More options section is removed from program and shared skill pages.
The backend still preserves original definitions when a used skill is revised.
Existing assessment and batch references continue to resolve their saved IDs.

Add Skill also works when the current library is in use. It submits an atomic
addition to the library revision endpoint, copies the existing definitions and
adds the new category for future work. Request IDs make successful uncertain
retries idempotent. If another coordinator has already prepared newer skills,
an addition from the older library is rejected for review rather than replacing
their additions. Existing batch and score references retain their original IDs.

Verified with frontend lint/build and the real-API browser runs
`--competencies`, `--skill-editor` and `--competency-assistance`, using
isolated SQLite fixtures and synthetic accounts. The checks cover first-skill
creation, latest active library selection, retired-library display, revision
retries, retained definitions, shared/program editor permissions, tag suggestions,
search/pagination, and phone/dark layouts.

## Evidence preservation

An unused, unreferenced category in an editable set can be removed after explicit
confirmation. An in-use/frozen set cannot be rewritten or have a category deleted.
Its Edit or Remove action creates a new skill-set version with new category IDs,
copying other definitions and linking them to their source categories. A removed
skill is omitted from that updated copy; its original definition remains readable.
The same copy workflow handles a definition protected by another version's source
reference. Direct DELETE still rejects retained references.

Existing batches, questions, position requirements, assessment scores and combined
competency evidence retain their original set/category references. The new set is
for explicitly selected future work; it does not silently rebind existing work
or retire a set that current assessments still need. A removed skill can still
appear in an original retained version. Framework metadata/freeze/retirement
continues to require its creator or admin; shared category editing does not grant
access to colleagues' private batches or student records.

## API and concurrency

- POST `management/programs/{program}/suggest-tags/` accepts a name and
  description and returns draft tags without writing records. Reuse is scoped
  to the latest active library of the authorized program and skips ambiguous
  matches. POST `management/institutes/{institute}/skills/suggest-tags/` uses
  that institute's shared skills for related vocabulary. Neither scoped endpoint
  uses domain presets. The existing IC editor and unscoped position tools can
  still use the curated presets in
  [skill_taxonomy.py](../skillbridge-backend/api/skill_taxonomy.py).
- Category detail now supports DELETE with `expected_digest` for unused skills.
  PATCH retains its digest and duplicate-name checks with program-wide coordinator
  editing. Category collection DELETE and detail POST remain disallowed.
- POST category `revisions/` accepts update/remove, a source framework digest and
  a creation UUID. Updated content uses existing category validation. It locks
  the institute and source framework, creates the new version and audit record
  atomically, and emits program-scoped invalidations only after commit.
- Exact uncertain-response retries reuse the revision's ID. Changed payloads,
  another actor's UUID, stale digests and cross-endpoint UUID reuse are rejected.
  Rollback preserves both the original definitions and the version inventory.
  Revision-presence flags use an EXISTS annotation for paginated category reads.

No model/schema change or configured-data migration is needed. No existing
configured records are removed or reassigned as part of implementing this feature.

## Verification checkpoint

The final catalog, assistance, concurrency, authoring, recommendation-boundary
and image run passed 61 PostgreSQL tests in
`work/organization-postgres-uj3_zanq/`. All 348 Node tests, frontend lint/build,
Django checks and migration-drift verification passed. Existing catalog browser
checks passed all six groups in `work/organization-browser-crul71it/`; saved-tag
assistance passed all seven groups in `work/organization-browser-kuqtadpi/`.
These cover scoped access, stale edits, frozen evidence, retry idempotency,
manual recovery and dark-phone interactions. The final new-editor browser run
passed six groups in `work/organization-browser-oggxec9n/`, covering both editors,
suggestions during manual typing, changed-input and outage recovery, pending-tag
saves, coordinator removal/copy flows, 320/390/768/1440px widths and dark-phone
styling. Desktop and phone screenshots were visually inspected. These three
browser suites passed 19 groups in total with no page errors.

A read-only configured-runtime check verified both admin and approved-instructor
organization-options requests returning HTTP 200 from the existing localhost
worker, not only a fresh test process. No personal data or tokens were logged.

The browser checks found and resolved a pending-tag blur conversion that could
resize the dialog before a click landed. Tags now convert only on Enter/comma
or explicit Suggest; Save reads any remaining input without a prior layout change.
The protected-set test explicitly refreshes after an external fixture write,
because its synthetic event stream is disabled. These checks use synthetic
localhost data and isolated storage, not configured personal records.

Delivery checkpoint: the feature was developed and verified on
`codex/program-skill-editor` for local merge to `main`. No known failures remain.
No migration, configured-record reassignment, push or deployment is included.
The next step is to review the updated skill dialog in the local app; future
assessments and batches must explicitly select an updated skill-set version.
