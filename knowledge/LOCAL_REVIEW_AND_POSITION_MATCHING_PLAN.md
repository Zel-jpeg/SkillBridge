# Local change review and position-specific matching

User instruction, 9 November 2026: review and test the existing uncommitted work,
commit it on a branch and merge into local main. Do not push to GitHub. Only after
the baseline is clean, create a separate branch for the NLP input improvement and
test it. No live recommendation refresh or deployment is included.

## Phase 1 — existing changes

Review branch: `codex/review-analytics-map-20261109`.

- [x] Inventory existing analytics/report/map, README, design-reference and
  acceptance-wording changes; preserve their scope and source attribution.
- [x] Read-only frontend and backend reviews.
- [x] Initial frontend lint, production build and 333 helper tests pass.
- [x] Initial 38 focused analytics/activity/admin-scope tests pass on disposable
  SQLite with dotenv disabled and synthetic settings.
- [x] Fix/retest geographic partner-list filtering after company/position/area
  selection and empty-program catalog selection.
- [x] Align suggested-placement card values with allocated list/export values.
- [x] Run final affected checks and responsive analytics browser verification:
  337 frontend tests, 41 backend tests, frontend lint/build, and both-role,
  three-tab browser checks at 1440/768/390px with dark phone layouts, actual
  Leaflet/heat rendering, tile-free national outlines and allocated card/list parity.
- [ ] Commit reviewed work, merge into local main and verify clean status.

Initial sandboxed browser runners could start their local helpers but could not
connect to the loopback readiness ports. They cleaned up and did not reach browser
assertions. Rerun with the required local-network permission; do not report those
attempts as passing browser checks. The subsequent permitted loopback runs
completed successfully and cleaned up their task-owned helper servers.

The existing second worktree at `work/position-descriptions` is clean; its commit
is already an ancestor of main. Eighteen design asset checksums and all README
local links were verified. No credentials, live records or temporary test-server
databases are staged with this baseline.

## Phase 2 — position-specific matching

Start only after Phase 1 is merged and clean. Create a separate local branch.

- [ ] Trace scoring callers, category identity, explanations, previews and
  freshness/version checks using current code.
- [ ] Keep the full visible combined profile and all numeric assessment evidence.
  Create position-specific text internally from relevant assessed categories.
- [ ] Use one shared fitted TF-IDF space for a student's compatible candidate
  corpus; transform the filtered profiles into that space.
- [ ] Retain exact program/framework IDs. Reuse the existing canonical category
  map only on the established unscoped compatibility path.
- [ ] Guard lack of positive relevant evidence and preserve missing versus zero
  numerical evidence, numeric coverage/alignment priorities and location inputs.
- [ ] Explain overlap using actual per-position student vectors; version input
  freshness so existing suggestions require an explicit authorized refresh.
- [ ] Verify backend regressions, generic program fixtures, legacy aliases,
  rejected cross-program evidence, history/freshness and unchanged grading.
- [ ] Repeat the researched six-student simulation against the integrated code
  on disposable data. Inspect changes rather than tuning to larger percentages.
- [ ] Record tests, remaining limitations and the feature branch status.

Do not push remotely, migrate live data, regenerate real recommendations or alter
historical placement snapshots. Grade-band/tag-count artifacts remain a distinct
limitation; this input correction does not promise real-world ranking accuracy.

## Offline evidence

Local ignored work receipts from this conversation:

- `work/nlp-input-audit-2026-11-09/report.md`: exact saved-score reproduction and
  text dilution diagnostics.
- `work/position-specific-nlp-validation-2026-11-09/report.md`: 120 synthetic
  development cases, 58 invariant checks and 14 focused existing backend tests.
- `work/four-student-nlp-review-2026-11-09/report.md`: anonymous answer/score/rank
  reconciliation, 167 audit checks; no raw personal records in this plan.
- `work/researched-six-student-simulation-2026-11-09/report.md`: source-informed
  fictional catalogs, 180 graded answers and 145 checks on in-memory SQLite.

These receipts support software review; they are not independent expert labels,
deployment receipts or a claim that all future catalogs are academically valid.
