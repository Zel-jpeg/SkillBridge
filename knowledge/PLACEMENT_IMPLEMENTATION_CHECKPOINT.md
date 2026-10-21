# Placement implementation checkpoint

Updated 21 October 2026. Branch `update-placement-ui-ux`; changes uncommitted.
Status: automatic suggestion refresh and panel removal complete and locally verified.
Earlier simplified-version checks are retained below; latest verification is at the end.

## Current implementation

The user chose the simpler design after reviewing the original three-table version.
This version adds **zero new tables**, one Boolean column `is_active_suggestion`
to `OJTPlacement`, and two constraints (one active suggestion per student; flagged
rows must have Suggested status). Existing records default false with their old
statuses, scores, remarks and IDs preserved.

`Recommendation` keeps ranked matches. `OJTPlacement` holds the current Suggested
record, converted to Approved only by a human decision. `ManagementAction` keeps
revision, input signature and change/audit metadata in its existing columns. No
`PlacementDraftState`, `PlacementDraftProposal`, `PlacementDraftRevision` or pinning
controls remain. Migration is now `0022_placement_active_suggestion`.

Company-first UI, top-three/all available alternatives, low-score review, shared
capacity, scoped instructor identities, preview/apply and explicit approvals remain.
Automatic updates preserve valid coordinator choices; invalid choices require
review without an invalid seat reservation. Existing approvals stay fixed. Pending rows stay out of placement history,
reports and student/dashboard placement status. Catalog deletion cleans pending
rows only, with rollback if actual decision history prevents deletion.

PostgreSQL transaction-scoped advisory locking replaces the singleton lock table.
It serializes allocations, placement decisions and admin company/position edits
before existing row locks. Official capacity still counts approved records only.
The existing draft API URL remains internal; UI wording is Suggested placements.

## Verification of the simplified version

- Frontend lint/build and 11 API invalidation/envelope tests passed. Final
  lint/build rerun also passed after the disabled-button presentation correction.
- Broad SQLite regression: 199 tests ran, six PostgreSQL-only skips, otherwise
  passed. Includes placement, scoring/combined competency, freshness, permissions,
  official capacity, analytics, reports, management, catalog and company images.
- Separate multiple-assessment/NLP evaluation regression: all 22 passed.
- Disposable PostgreSQL: all 73 passed, no skips. Includes migration preservation,
  suggestion/approval races, preview replay, last-seat choices, catalog deletion
  versus apply, previous approval idempotency/capacity and change-event transport.
  Evidence: ignored `work/placement-draft-postgres-ncovfzby/tests.txt`; cluster stopped.
  The additional catalog-race test was added after the broad SQLite run and was
  exercised in this PostgreSQL run.
- Migration-preservation test migrates a populated disposable database from 0021
  to 0022: table names stay identical and legacy Suggested/Approved/Removed/Rejected
  records keep their data with false flags. New constraints and pending-to-approved
  conversion, pending report/status isolation and catalog-cleanup rollback pass.
- Django check and makemigrations --check --dry-run passed.
- Real local React/Django browser workflow passed: preview/apply without approvals,
  low-score/alternative conflicts, approval conversion, manual placement removal by
  ID, correct company/position search and server history search. Both instructor
  scopes checked at 1440/768/375/320px, including dark mode; eight layouts, zero
  page errors and no horizontal overflow. Final visual rerun passed; stale approval
  is visibly disabled. Test servers stopped.
- Ignored evidence: `skillbridge-frontend/tests/artifacts/placement-draft/`, with
  `simplified-backend.log`, `simplified-assessment-nlp.log`, `simplified-postgres.log`,
  `simplified-build.log`, `simplified-browser.log`, `results.json` and screenshots.

## Pause and resume agreement

When the user says **PAUSE**, stop initiating work, safely conclude/stop active
checks, preserve edits and record outstanding issues and the exact next step here.
Do not reset changes or commit automatically. Wait for **CONTINUE**.

## Handoff

Apply the replacement 0022 migration through the normal
reviewed migration procedure before using this code with the normal database.
The removed three-table migration was applied only to old disposable fixtures.
No normal/live migration, production suggestion generation, deployment, commit or
push was performed. Previous authoring work is already in base commit `84deab0`.
See [the implementation contract](PLACEMENT_DRAFT_IMPLEMENTATION.md).

## Automatic refresh follow-up — complete

The large generation panel and preview/apply dialog are removed. A short automatic
status line and secondary Refresh suggestions recovery action remain. A visible
placement workspace reconciles on entry and after live/periodic reads report
changed inputs. No background worker runs while the page is closed. Final approval
remains explicit and manual.

POST sync uses the existing advisory lock and input signature. Unchanged syncs
write no revision/event and keep pending IDs stable. Simultaneous syncs write once.
Valid coordinator choices survive updates; invalid choices appear in Awaiting
allocation as Coordinator choice needs review. Choice metadata uses the existing
ManagementAction JSON; preceding-version choice snapshots are recovered and
normalized once. No new columns, tables or migration are needed beyond 0022.

Latest verification:

- Frontend lint/build and 11 API invalidation/envelope checks passed.
- Targeted SQLite: 50 tests ran successfully with seven PostgreSQL-only skips,
  before the additional preceding-audit-format recovery test was added.
- Disposable PostgreSQL: all 77 passed, no skips, including that recovery test,
  simultaneous automatic updates, existing decision/capacity races, migration
  preservation, no no-op events and coordinator-choice preservation/review.
  Evidence: ignored `work/placement-draft-postgres-8yb_w3co/tests.txt`; cluster stopped.
- Real local React/Django browser checks: seven workflow groups, eight scoped
  instructor layouts at 1440/768/375/320px including dark mode, zero page errors.
  Automatic first update, temporary outage/error and manual retry, live capacity
  invalidation, stable records, no preview panel, no automatic approvals, low-score
  conflict, explicit approval/removal and search flows passed. Screenshot inspected.
  Local test servers stopped.
- makemigrations --check --dry-run reports no changes; git diff --check passed.
- Latest ignored logs: `automatic-backend.log`, `automatic-postgres.log`,
  `automatic-browser.log`, `automatic-build.log` and `results.json` under
  `skillbridge-frontend/tests/artifacts/placement-draft/`.

No normal/live database writes, deployment, commit or push were performed. If 0022
is already applied, restart/reload the local app to test automatic suggestions.

## Placement button follow-up — complete

User requested proper visible buttons and hover feedback. Converted back/alternative
actions, card affordances, confirmations and download controls to shared button
styles; current suggestion is a status label. Added tab/card/position/disclosure
hover, focus and dark/disabled states. Frontend lint/build passed. The synthetic
React/Django browser workflow passed with explicit computed-style checks for hover,
keyboard focus and pointer cursors on company cards, tabs, alternative actions,
approval and back navigation. Current suggestion is verified as a non-button.
Eight scoped responsive layouts passed, including dark mode; zero page errors.
Screenshots were inspected for overview, desktop candidate review and 320px dark
review. Evidence: ignored `button-build.log`, `button-browser.log`, `results.json`
and `admin-button-review.png` in the placement-draft artifacts directory. Local
servers stopped. No backend/schema changes or migration for this follow-up.

## Final pre-merge verification — October 21, 2026

- Frontend lint and production build passed; all 143 JavaScript tests passed.
- Django system check and migration consistency check passed (no missing changes).
- Broad isolated SQLite regression: 237 tests ran, eight skipped, no failures.
- Disposable PostgreSQL regression: all 77 tests passed, no skips, including
  placement concurrency and migration preservation. Evidence:
  ignored `work/placement-draft-postgres-w0edn7ng/tests.txt`; cluster stopped.
- Synthetic local browser regression: seven workflow groups and eight responsive
  layouts passed, zero page errors. Local servers stopped.
- Evidence: ignored `final-node.log`, `final-backend.log`, `final-postgres.log`,
  `final-browser.log` and `results.json` in the placement-draft artifacts directory.

Branch remains `update-placement-ui-ux`; changes are uncommitted. No normal/live
database writes, commit, push or merge were performed. Unrelated untracked research
files under `outputs/` are excluded from the suggested staging commands. These
checks verify the current local branch; rerun checks if merging newer main changes
alters the tested code.
