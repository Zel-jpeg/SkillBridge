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
- [x] Commit reviewed work as `4036e6e`, fast-forward into local main and verify
  both branches clean. No remote push performed.

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

Phase 1 was merged and clean before creating `codex/position-specific-nlp-20261109`.

- [x] Trace scoring callers, category identity, explanations, previews and
  freshness/version checks using current code.
- [x] Keep the full visible combined profile and all numeric assessment evidence.
  Create position-specific text internally from relevant assessed categories.
- [x] Use one shared fitted TF-IDF space for a student's compatible candidate
  corpus; transform the filtered profiles into that space.
- [x] Retain exact program/framework IDs. Reuse the existing canonical category
  map only on the established unscoped compatibility path.
- [x] Guard lack of positive relevant evidence and preserve missing versus zero
  numerical evidence, numeric coverage/alignment priorities and location inputs.
- [x] Explain overlap using actual per-position student vectors; version input
  freshness so existing suggestions require an explicit authorized refresh.
- [x] Verify backend regressions, generic program fixtures, legacy aliases,
  rejected cross-program evidence, history/freshness and unchanged grading.
- [x] Repeat the researched six-student simulation against the integrated code
  on disposable data. Inspect changes rather than tuning to larger percentages.
  Passed 169 checks; repeatable verifier and fictional fixture are now in the
  backend. No live records changed.
- [x] Record tests, remaining limitations and the feature branch status.

## Current checkpoint

The reviewed baseline was merged at `4036e6e`. Local main is now `0fb2c1d`,
including the independently tested shared-partner visibility fix (`4ad1e63`)
assigned-coordinator editing/cards (`f77baa1`), and icon-only actions with reviewed
unused-record deletion. Main was merged into `codex/position-specific-nlp-20261109`
as `b706676`, preserving
the existing NLP feature in the active development checkout. The NLP implementation
itself remains unmerged into main. Its changes remain confined to matching,
truthful preview wording, tests, the fictional fixture/verifier and documentation.

Completed verification: all 857 backend tests on disposable PostgreSQL (276.301s),
38 focused matching/ordering/runtime tests on disposable SQLite, all 337 frontend
helper tests, frontend lint and production build, scoped real-API desktop/phone
browser checks, and the integrated six-student simulation with 169 checks. No
failures remain. The full-suite receipt is
`work/branch-review-postgres-h3tj83_h/tests.txt`; the integrated receipt is
`work/position-specific-nlp-integrated/report.json`.

No live database migration, real recommendation refresh, deployment or remote
push has occurred. When using this branch with configured records, the matching
version makes old suggestions stale until an explicit authorized maintenance
refresh. Valid grades and historical placement evidence remain intact.

The implementation contract and repeatable verification command are in
[position-specific matching](POSITION_SPECIFIC_NLP_MATCHING.md). The next user
walkthrough should inspect program-specific results and explanations before
choosing when to merge this feature into main or refresh real recommendations.

The follow-up [shared partner visibility review](SHARED_PARTNER_VISIBILITY_REVIEW.md)
records 97 PostgreSQL tests, 340 frontend tests, lint/build and nine real-API
browser check groups. It restores original shared IC partners in both program
management views, shared numerical requirement display and the reports shared-
roster disclosure. No edit permissions, placement eligibility or score formulas
changed. The separate proposed assessment-average "% Match" remains a read-only
calculation preview and has not been implemented or used to rerank live records.

After merging the visibility fix into the active NLP branch, 18 focused
visibility/matching tests passed together on disposable in-memory SQLite with
dotenv disabled. The working checkout retains both features; no live refresh
or remote push was performed.

The subsequent [coordinator editing update](COORDINATOR_SHARED_EDITING.md)
supersedes creator-only editing, preserves original shared IC requirement format,
and reuses the administrator partner/position cards with role-appropriate actions.
Its checks passed: 102 PostgreSQL tests, 342 frontend tests, lint/build, nine
shared-visibility and thirteen coordinator browser check groups. Main contains
the update; the NLP feature itself and the proposed assessment-average headline
remain separate from main's implemented recommendation policy. No remote push,
live data edit or migration was performed.

After the merge, 23 focused coordinator-editing, shared-visibility and NLP-matching
tests also passed together on disposable in-memory SQLite. The development
checkout retains both completed catalog updates and the separate NLP feature.

10 November card-action continuation: [receipt](COORDINATOR_CARD_ACTIONS.md).
The feature branch `codex/coordinator-card-actions-20261109` was tested and merged
locally into main at `0fb2c1d`. It adds accessible edit/archive/delete icons,
current-program archive authority, fresh capabilities, deletion confirmation,
and backend refusal to delete any recommendation/placement evidence. Final
verification passed 61 PostgreSQL tests, 342 frontend tests, lint/build, fourteen
coordinator browser groups and nine shared/admin browser groups. Thirty focused
action/visibility/NLP tests passed together after merging main into the active
NLP branch. Owned helpers stopped. No live data operation, migration or remote
push occurred. The separate NLP feature remains unmerged into main, and the
assessment-average "% Match" proposal remains unimplemented.

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
