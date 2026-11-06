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
- [ ] Merge the scoped workspace into local main.

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

- [ ] Group related admin and instructor navigation links.
- [ ] Add consistent card and list controls to the new collections, with
  hover and keyboard focus styles.
- [ ] Check the active page in the sidebar, phone navigation, collection view
  switches, and the institute and program journeys.
- [ ] Merge the verified UI work into local main.

## Current checkpoint

F20 branch `codex/staff-organization-scope` holds the scope changes.
The full isolated PostgreSQL run passed **755 tests** in
`work/organization-postgres-cikx06ep/`. The focused run passed **66 tests** in
`work/organization-postgres-cow1shud/`. Django checks and migration drift
passed. Frontend lint, build and **287 unit tests** passed. The real API browser
run passed **six checks** in `work/organization-browser-lohbedqk/`, including
an actual filtered XLSX download. **Four** retained opportunity checks passed in
`work/organization-browser-jed4h755/`. The initial browser run exposed an
ambiguous accessible filter label. The corrected controls passed the rerun.
