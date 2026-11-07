# Admin dashboard, partner map and reports proposal

Status: all three implementation gates completed, 7 November 2026. This proposal follows the completed
[admin scope navigation feature](ADMIN_SCOPE_NAVIGATION_PLAN.md). The partner-map feature was verified on `codex/admin-partner-map`. Preserve unrelated working-tree changes.

The admin needs a clear school overview and a reliable path into institute and
program records. The dashboard and partner map can show explicitly labeled
school-wide summaries before choosing a program. Management collections retain
the institute/program selection implemented in the previous feature.

## Dashboard

- [x] Default to School-wide overview / active batches, with institute and
  program scope shown beside the title. Disable program selection until an
  institute is selected. Preserve scope in links to records and reports.
- [x] Keep five distinct operational metrics: students in active batches,
  required assessments complete, awaiting coordinator review, approved placements,
  and remaining shared slots. Show units and denominators. Approval does not
  establish OJT completion. Shared slots remain globally occupied per position.
- [x] Show institute banner cards with program count, scoped student count,
  required completion and approved-placement counts. Open the institute's program
  overview, then its records. Programs and institutes come from saved configuration.
- [x] Add concise actionable Needs attention rows for pending retakes, pending
  instructor approval, batches without required assessments, and unavailable/stale
  final results. Counts and links must agree with their destination scope.
- [x] Move detailed student and skill highlights behind program selection so
  unrelated program definitions are not presented as one competitive leaderboard.
- [x] Keep global recommendation reruns in a secondary maintenance area with
  their existing explicit scope, authorization and confirmation behavior.

An Imagegen dashboard concept was produced using illustrative counts and
institute cards. It is a preview, not evidence of configured school data. The
current brand, banners, 12px ordinary text, light/dark styling and responsive
layout should guide implementation rather than hardcoding the generated pixels.

## OJT partner map

- [x] Show an all-active-partner map immediately, independently of the gated
  management list. A map search/filter must not assign program eligibility.
- [x] Use valid saved coordinates only. Show total matching partners, mapped
  partners and partners needing a pin separately. Archived partners are optional
  through an explicit status filter.
- [x] Give institutes stable map colors and a readable legend with codes/names;
  identify them by text as well as color. Banner presets can remain independent.
- [x] Use cascading Institute → Program selectors for map filtering and the
  management collection. Selecting a new institute clears the selected program.
- [x] Confirmed by the user: All institutes shows all active partners with saved
  valid coordinates. Selecting an institute shows only its matching partner pins;
  selecting a program shows only partners matching that program. Hide other pins
  completely. All programs restores the chosen institute's map; All institutes
  restores the school-wide map. A shared partner remains visible when it matches
  the selected scope. Zero matches shows an explicit empty state without falling
  back to other institutes' pins.
- [x] Keep one pin per partner. Shared partners show a Shared marker plus their
  actual institute/program labels; a selected scope highlights the matching
  eligible openings. Do not count the same partner or slot once per institute.
- [x] Derive relationships from saved partner ownership and position eligibility,
  retaining the original shared IC catalog under IC. An unassigned relationship
  needs an explicit neutral label; location does not establish institute scope.
- [x] Popups show name, address, institute/program labels, relevant openings and
  shared remaining capacity. Provide an explicit Fit matching partners control.
  Preserve the map instance and user navigation during background refreshes.
- [x] Handle overlapping coordinates, zero matches, missing coordinates, tile
  failures, long institute names, keyboard access and phone-sized legends.

The prior read-only audit found five existing partners and six original openings,
with no explicit cross-program links. This proposal does not change those records
or automatically share them with another institute.

## Reports & Analytics

- [x] Keep one labeled scope bar: Institute → Program → Batch, active/archive
  scope and optional instructor. Retain compatible existing report filters and
  clear dependent selections when the parent changes.
- [x] At school level, show institute summaries using counts and completion/
  approved-decision rates with consistent cohorts and explicit denominators.
  Selecting an institute exposes its programs; detailed records retain context.
- [x] Preserve Assessments, Skills and Placements as the main analysis sections.
  Keep the dashboard focused on follow-up rather than duplicating all charts.
- [x] Assessments: assigned/required completion, incomplete work and actual
  submission activity, with linked supporting batch/assessment records.
- [x] Skills: use program/framework/category identity and missing-evidence
  labels. Do not merge same-named categories across unrelated programs or use
  incompatible assessments as a school-wide skill ranking.
- [x] Placements: suggested, approved and unplaced students remain distinct;
  partner eligibility and global shared occupancy remain explicit.
- [x] Every report/export states institute/program/batch scope, current/archive
  selection, cohort unit and generated time. Retain fresh-source checks before
  downloading; displayed records and exports must use the same scope and order.
- [x] Preserve existing advanced NLP tools and role access without letting their
  controls dominate the everyday report workflow.

## Delivery and verification gates

1. Partner-map exception and relationship/color logic: feature branch, focused
   API/unit/browser checks, then local merge. Verify existing IC retention,
   shared partners, slot deduplication, strict pin filtering and cascading filters.
2. Admin dashboard: its own branch and tests after the map feature is complete.
   Verify aggregate/detail reconciliation, deduplicated cohorts, attention links,
   program highlights, scoped navigation and empty institutes/programs.
3. Reports & Analytics: its own branch and tests after dashboard delivery. Verify
   scope changes, current/archive cohorts, distinct skill frameworks, invalid
   links, pagination/sorting, stale snapshots and CSV/PDF scope reconciliation.

Every feature needs keyboard, hover/focus, light/dark and 320/390/768/1440px browser
checks plus appropriate lint/build and isolated database tests. Do not run tests
against configured school data. Reuse existing metric contracts, authorization,
Axios and map infrastructure. Do not invent historical trends. No schema change
is assumed; inspect data requirements before proposing one. Merge locally only
after the individual gate passes, and never push without the user's instruction.

## Active checkpoint

Resumed on 7 November 2026. Partner map is merged locally as `ff43fb6`; dashboard
is merged locally as `176875e`. Reports is delivered by `codex/admin-scoped-reports`, based on `176875e`.
All three gates are complete and merged locally into `main`; their feature
branches are retained for exact commit references. No GitHub push.

Map verification: 356 Node tests, twelve isolated PostgreSQL tests and eighteen
browser groups. Dashboard verification: lint/build, 359 previously recorded Node
checks, forty-three isolated PostgreSQL tests, six real-API admin browser groups,
eight instructor browser groups, nineteen sign-in/warming/recovery checks, and
visual review at 320/390/768/1440px in light/dark mode. The final sign-in receipt
is `work/organization-browser-pi_fw51q/`.

Reports implementation:

- Primary Institute → Program → Batch controls with batch status alongside;
  Instructor/Course under More scope filters. Cascading changes clear dependent
  IDs. Read-only batch/placement links preserve organization context.
- Admin analytics options include saved empty and archived institutes/programs.
  Invalid/mismatched IDs return an explicit error; instructor choices remain
  restricted to owned accessible batches.
- Institute/program comparisons partition the same distinct cohort by recorded
  enrollment, with shared IC/unassigned rows and explicit denominators. Empty
  rates stay missing. Comparisons support search, pagination and sorted exports.
- Framework/category identities, assessment activity, shared global occupancy,
  placement statuses and advanced NLP tools retain their existing meanings.
- CSV/PDF snapshots carry organization names, full batch selection, status,
  generation time and cohort units. Renamed scope labels trigger the existing
  refresh/review gate. Failed scope changes retain a clearly labeled old snapshot
  and block exports. Large on-screen batch selections use a compact count while
  downloads retain every batch name.

Checks completed for reports:

- Frontend lint/build passed; all 305 current source Node tests passed in
  `work/admin-scoped-reports-node.txt`.
- Twenty isolated PostgreSQL tests passed in
  `work/organization-postgres-o1mv2qd6/`; seven framework-aware derived-scope tests
  passed in `work/organization-postgres-llkhnnuy/`.
- Nine real-API browser groups passed again against the final production bundle
  in `work/organization-browser-lsv0k1aq/`,
  including sorted CSV, empty-scope CSV/PDF, invalid scopes, ordinary shared IC
  records, renamed labels, failure/retry, all three sections at four widths,
  dark mode and instructor privacy.
- Two existing report-revocation/protected-export browser checks passed in
  `work/organization-browser-ggevf7rr/`.
- Report header screenshots were reviewed at all four widths; final compact-scope,
  comparison and placement screenshots were also visually reviewed. No schema
  migration or configured school data write. Task-owned test servers stopped
  through their harnesses.

Earlier test attempts are retained as evidence: an obsolete toast selector and
incorrect synthetic owner were corrected; a concurrent temporary server startup
missed its readiness window. Neither is counted as a final passing run. The
unsupported helper --help invocation was stopped; a subsequent process check
found no remaining child from that invocation.

Next: user review in the local application, with the configured school data.
No known failure remains in this feature's verified synthetic workflows. Actual
hosted behavior and evaluator acceptance are not established by these local
checks. Unrelated breadcrumb, instructor-picker, profile, user-page and collection
toolbar edits remain in the working tree. The pre-existing report-toolbar class
and collection-layout runner registrations are excluded from this feature commit.
No further feature or push has been started.
