# Staff workspace scope and navigation

The staff follow-up has two local delivery gates. Each gate gets its own feature
branch, focused tests and a local merge before work starts on the next gate.

## F20 · Institute and program scope

- [x] Show the skill library by institute and program on the administrator
  taxonomy page. Keep the original IC taxonomy reachable from that page.
- [x] Filter admin partners and the openings within them, assessment oversight
  and archives, batches, placement candidates, history and report downloads.
- [x] Keep shared positions and their total occupancy intact. Use the saved
  batch for historical decisions and the framework for a program draft.
- [x] Verify scope and shared capacity with synthetic API and browser fixtures.
- [x] Merge the scoped workspace into local main (`40709cf`).

The All views show records from every authorized institute. Existing mixed IC
batches, their assessments and their decisions appear in the IC institute view.
The five configured legacy partners and six openings use the original catalog
rules and appear under IC with All programs selected. A specific program filter
requires explicit program scope. New program openings have explicit eligibility,
and a shared opening uses a single slot count across eligible programs.

The administrator filters the authorized collection before pagination. Placement
history and report filters are applied on the server. Shared placement capacity
continues to use total occupancy across programs. Instructor grants restrict
their program libraries. Private batches also depend on instructor ownership.

A read-only configured check found one matching instructor account and no
effective grants. After the user confirmed the intended existing assignment, the
operator added and verified exactly two effective IC program grants in one
transaction. It used the existing account approval check, audit records and
scoped invalidation. No migration is needed for this follow-up.

## F21 · Collection and sidebar consistency

- [x] Group related admin and instructor navigation links.
- [x] Add consistent card and list controls to the new collections, with
  hover and keyboard focus styles.
- [x] Check the active page in the sidebar, phone navigation, collection view
  switches, and the institute and program journeys.
- [x] Merge the verified UI work into local main.

## Current checkpoint

F21 was verified on `codex/staff-collection-navigation` and merged into local
main. Staff sidebars use Learning & assessment and OJT groups.
Admins also have a People & programs group. Assessment creation is available
from the Assessments workspace. The current group opens automatically.

Frontend lint, production build and **288 unit tests** passed. The final staff
browser run passed **nine checks** in `work/organization-browser-wiqjd5rg/`,
including the desktop sidebar and icon rail, keyboard and hover styles, the
dark phone drawer and catalog, list/card switching, and the scoped XLSX
download. The retained coordinator catalog suite passed **11 checks** in
`work/organization-browser-cw11ded0/`. The retained admin partner and map
suite passed **seven checks** in `work/organization-browser-cx6qfzqc/`.
The final dark-mode screenshot was visually checked. Both feature gates are
complete and the commits are local pending the user's push instruction.

F20 was verified and merged locally at `40709cf`.
The full isolated PostgreSQL run passed **755 tests** in
`work/organization-postgres-cikx06ep/`. The focused run passed **66 tests** in
`work/organization-postgres-cow1shud/`. Django checks and migration drift
passed. Frontend lint, build and **287 unit tests** passed. The real API browser
run passed **six checks** in `work/organization-browser-lohbedqk/`, including
an actual filtered XLSX download. **Four** retained opportunity checks passed in
`work/organization-browser-jed4h755/`. The initial browser run exposed an
ambiguous accessible filter label. The corrected controls passed the rerun.

## IC shared skill taxonomy follow-up

The administrator's taxonomy page opens the **IC shared skill taxonomy** for
the shared categories and tags used by IC assessments and position requirements.
Select BSIT or BSIS in the program picker to see that program's framework
versions. The shared library is part of the current IC workflow.

The user requested working examples. The configured catalog now has
**BSIT Starter Skills** v1 with Networking and **BSIS Starter Skills** v1 with
Database Management. Each has one example description and the tags copied from
the corresponding existing IC category. The starter versions are unused and
editable by admins. The catalog endpoints were verified read-only for admin
and assigned instructor access, and all 12 shared IC categories remain present.

The label and navigation were checked on `codex/ic-shared-skill-taxonomy`.
Frontend lint, production build, **288 unit tests** and **nine** staff browser
checks passed. The browser verified the IC selection, shared taxonomy heading,
category and Add Skill control, and the return link to the program picker.
Evidence is in `work/organization-browser-h7zohx2m/`.

## Simplified skill taxonomy

- [x] Fill the blank descriptions on the 12 shared IC skills using their saved
  categories and tags. A read-only check confirmed all 12 descriptions and tags
  and the same six assessments and six openings linked to the shared categories.
- [x] Verify and merge the shared-skill description validation and list display.
- [x] Show shared IC and program skills from one taxonomy page. Keep version
  maintenance available for revisions to definitions that are already in use.
- [x] Select the applicable skill set for new assessments and position
  requirements when there is one safe choice. Keep the recorded set for existing
  batches and verify requirement compatibility before switching new work to a
  revised set.

The configured IC update wrote description fields in one transaction and used
the existing taxonomy change notification. Skill definitions are part of the NLP
matching inputs. Saved recommendations follow the ordinary freshness checks.
On `codex/require-ic-skill-descriptions`, the shared list now shows
descriptions and the taxonomy form/API require a description on save. The
category API still returns an existing skill when asked to reuse it by name.
The existing IC assessment-authoring path continues to resolve recorded names.
The focused PostgreSQL run passed 52 tests
(`work/organization-postgres-ps384l8k/`). Lint, build and 288 frontend tests
passed. All nine staff browser checks passed
(`work/organization-browser-4r4znkkz/`), including the required description.

On `codex/unify-skill-taxonomy`, admins can switch between shared IC skills and
program skills from the same picker. Assigned instructors use **Skill taxonomy**.
A single active version opens its skills directly. Saving the first skill in a
new program creates its initial version in the same transaction. Version
management remains available under **Skill set versions**.
The PostgreSQL regression passed 38 tests (`work/organization-postgres-azeixv5j/`).
Lint, build and 288 frontend tests passed. Browser checks passed for staff scope
(`work/organization-browser-ny9gr9n4/`), versioning and permissions
(`work/organization-browser-ths1jovu/`) and scoped NLP assistance
(`work/organization-browser-mqystyp6/`).

On `codex/default-program-skill-set`, assessment and position editors choose
the saved skill set automatically when the program has exactly one version and
it is active and contains skills. Existing selections and recorded batch
bindings take precedence. Programs with revision history retain explicit
selection so staff can review position requirements before choosing a different
version for new work.

Lint, build and 288 frontend tests passed. Browser checks passed for automatic
selection during AIKEN and native assessment authoring
(`work/organization-browser-5y5sar8u/`), explicit selection and draft recovery
(`work/organization-browser-9q4kz9_3/`), coordinator position management
(`work/organization-browser-avz0cqma/`), and admin program-eligible openings
(`work/organization-browser-0ctcr3zl/`).

A proposed position description would capture the intern's actual duties in
both position editors and provide supporting NLP context alongside the current
title, tags and skill requirements.

## Taxonomy cards and images

- [x] Admin institute cards open a distinct URL listing that institute’s
  libraries. Instructor cards go directly to assigned libraries.
- [x] Allow admins to edit institute and program names from the cards.
- [x] Display the existing IC shared taxonomy for approved instructors with an
  active IC program assignment, with admin-only writes.
- [x] Add institute and program images using WebP conversion before upload.
- [x] Test image display, replacement, removal, storage failure and the additive
  schema migration before applying it to the configured database.

`codex/taxonomy-library-cards` passed 43 isolated PostgreSQL tests
(`work/organization-postgres-azg0knuo/`), lint, build, and 288 frontend tests.
Staff navigation and card-name updates, program skills and scoped NLP assistance
passed browser checks in `work/organization-browser-hr2mi_uk/`,
`work/organization-browser-es_8pgch/`, and `work/organization-browser-1olmtyd0/`.

On `codex/taxonomy-card-images`, both card types use the existing image
converter and bucket. The object paths use separate institute and program
prefixes. Administrators can replace or remove images from the card editor.
The image feature passed 86 isolated PostgreSQL tests
(`work/organization-postgres-r1ahjuxh/`), lint, build, 288 frontend tests,
Django checks and migration drift verification. Browser tests verified WebP
uploads and instructor visibility using isolated object transport
(`work/organization-browser-3fsclv0s/`). The existing coordinator uploader
also passed its regression suite (`work/organization-browser-ebw9atg3/`).
Configured migration `0040_organization_card_images` passed backup/restore
rehearsal and applied two nullable fields. The operator verified preserved
data in 44 existing tables. Its receipt is in
`work/organization-configured-migration-pynkah9u/`.

## Consistent skill library tables

The shared IC catalog and every program use the same skill table for admins
and instructors. The table shows a skill’s name, description and tags. Edit
and delete actions follow the existing library and version permissions.
Program search matches names, descriptions and tags within the selected
skill set and retains server pagination. Version tools, refresh and the
question checker are under **More options**. Admins open the shared catalog’s
quality check from the same disclosure.

`codex/unify-skill-library-tables` passed 34 isolated PostgreSQL tests
(`work/organization-postgres-v7hkyyrr/`), lint, build and 288 frontend tests.
Browser checks covered the shared IC and non-IC program tables on desktop and
phone (`work/organization-browser-cvowz9qd/`), search and version permissions
(`work/organization-browser-dy88zimn/`) and the scoped question checker
(`work/organization-browser-4zisq839/`).

## Taxonomy card artwork

Resumed on `codex/taxonomy-card-artwork`, based on local `main` at `31f3d00`.
Uploaded institute and program images fill the banner, with the generated
artwork as the fallback for missing or failed uploads. The upload editor previews
the same cover crop. Cards keep their name and subtitle below the banner.
The administrator’s pencil icon has an accessible name,
tooltip and a 44px target separate from the navigation link.

The built-in imagegen tool generated the cover. The project export is
[`taxonomy-card-cover.webp`](../skillbridge-frontend/public/images/taxonomy-card-cover.webp)
at 1440 × 480 pixels and 7,414 bytes.

```text
Use case: ui-mockup. Generate a single full-bleed wide, shallow decorative cover texture for the top of SkillBridge’s institute and program cards. Use the reference screenshot’s idea of geometric course-card banners as inspiration: layered curved bands, repeating inset squares and a few subtle diagonal facets. Use deep evergreen, jade and muted teal with restrained tonal contrast and clean edges. Spread the pattern across the frame so a centered shallow crop still reads clearly at phone and desktop widths. Include no text, logos, badges, people, shadows around the perimeter, UI controls, or frames. Output the cover artwork alone.
```

Frontend lint, production build and 288 frontend tests passed. All 11 isolated
staff browser checks passed in `work/organization-browser-t7gtpdbk/`, covering
the uploaded-banner preview, replacement, removal, failure fallback, 320, 768,
1024 and 1440 pixel widths, and keyboard editing without card navigation. The
existing partner collection suite passed seven checks in
`work/organization-browser-37d9dckn/`. No schema change was needed.

The user subsequently requested 12 selectable geometric banner colors alongside
the uploaded-banner option. On `codex/taxonomy-banner-colors`, each institute
and program saves a nullable palette index. Existing cards with no saved palette
choose a stable color from the same twelve presets. The editor keeps all twelve
thumbnails available, allows switching an uploaded cover back to a preset, and
previews either choice at the card’s aspect ratio.

The twelve choices are Emerald, Teal, Blue, Indigo, Violet, Magenta, Rose,
Coral, Amber, Olive, Lime and Green. They reuse the generated geometric cover;
uploaded images retain their own colors. Removing an upload restores the saved
preset. These options apply to every institute and program, with existing
administrator editing and instructor viewing permissions preserved. The palette
uses labeled native radio controls with keyboard arrow navigation. The editor
scrolls its body while keeping its heading, close icon and Save button visible.

Final frontend lint, build and all 346 discovered Node tests passed. All eleven
isolated staff browser checks passed in `work/organization-browser-9riffmeu/`,
including twelve distinct previews, mouse and keyboard selection, save/reload,
upload replacement/removal/failure fallback, institute and program banners at
320, 768, 1024 and 1440 pixels, and the phone dialog's visible controls.
Forty isolated PostgreSQL tests passed in `work/organization-postgres-ars6suvo/`,
including all twelve stored values, invalid values and authorization. Django
checks and migration drift verification passed. The pointer hit-area and phone
heading compression found during browser testing were corrected and verified.

Migration `0041_organization_banner_colors` was applied only after the operator
restored and hash-verified its backup and rehearsed the migration. It verified
unchanged data in 44 existing tables, two new nullable palette fields and no
pending migrations. Existing palette fields remain null until edited, so no
existing card data was rewritten. The private receipt is in
`work/organization-configured-migration-b2b95zn_/`.

Delivery checkpoint: the palette feature was developed on
`codex/taxonomy-banner-colors` for local merge into `main`. There are no remaining
known failures for this feature. No GitHub push or deployment is included.
The next step is to review the institute/program pencil editor in the local app;
further feature work awaits the user's next request. Unrelated overview and
optimization-plan edits are kept outside this feature's commit.
