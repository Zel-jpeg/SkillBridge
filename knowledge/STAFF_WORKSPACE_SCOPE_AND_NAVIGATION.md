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
