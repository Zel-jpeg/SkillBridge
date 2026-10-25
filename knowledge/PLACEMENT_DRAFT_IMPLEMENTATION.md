# Company-first placement and shared suggestions

25 October UI follow-up: the approved three-tab visual concepts are implemented
for both staff roles. See [placement collection redesign](PLACEMENT_COLLECTION_UI.md)
for card/table/details behavior and verification. The placement, capacity and
authorization contract below remains unchanged.

Implemented on `update-placement-ui-ux`, simplified at the user's request on
21 October 2026. This version adds **zero tables** and **one column** to the existing
`OJTPlacement` table. Only explicit authorized approval finalizes placement.

## Storage and migration

- `Recommendation` continues storing every ranked student-position match and its
  scores. Its schema and ranking calculations are unchanged.
- `OJTPlacement` reuses the existing `suggested` status for the single current
  unapproved allocation. New Boolean `is_active_suggestion` distinguishes that
  replaceable working suggestion from legacy placement records and human decisions.
- `ManagementAction` reuses its existing actor/action/metadata fields for generation,
  choice and decision revisions. The latest `placement.suggestions.update` entry
  contains the revision and input signature; no new state table is needed. Audit
  snapshots contain student/recommendation IDs, not student names or answers.
  The same metadata now records coordinator-selected position/batch IDs; no new
  columns or tables are required for automatic refresh. Choices saved with the
  preceding audit format are recovered from its snapshots and normalized once.

`0022_placement_active_suggestion` adds the Boolean with default false and two
constraints: at most one active suggestion per student; an active suggestion must
have Suggested status. All existing records retain their statuses, scores, remarks
and identity. The migration creates no suggestions and approves nobody.

The earlier uncommitted three-table migration was replaced before any normal/live
migration was run. `PlacementDraftState`, `PlacementDraftProposal` and
`PlacementDraftRevision` are not part of this version. Pinning was removed.

## Staff workflow

Both roles use Companies → Position → Suggested / Other ranked candidates /
Approved → Candidate review. The review shows component scores, role tags, the
student's top three distinct available position matches and all other matches.
Two alternatives can belong to the same company. Company and position cards stay
separate from student match ranking; there is no single staff company match score.

The placement workspace automatically reconciles suggestions on entry and when
visible live reads report changed inputs. Both admin and instructor pages can
request this deterministic server reconciliation; the server still scopes every
returned student identity and manual action. Capacity remains global. A coordinator
can choose another available position without approving it, and valid coordinator
choices are preserved during subsequent automatic updates. Unavailable choices
leave the student awaiting coordinator review, without reserving an invalid seat.
There is no pin/release UI, generation panel or required preview/apply step.

A small status line says suggestions update automatically and await coordinator
approval. The secondary Refresh suggestions action retries a failed update. One
attempt per input key prevents automatic failure loops; unchanged sync requests
create no revision, new pending IDs or change-event notification. Sync is a POST;
GET remains read-only. No background worker runs when the page is closed. Existing
visible-page polling, return-to-tab reads and SSE invalidations drive reconciliation;
these update saved matching evidence, without generating recommendation scores.

Allocation maximizes number of students allocated, then summed match score, using
residual minimum-cost flow across all current available matches. Six-decimal score
comparisons and stable sorted IDs give deterministic equal-cost traversal. This is
not a separate fairness objective or a guarantee of every student's highest match.
A suggestion may differ from that highest match to accommodate seats and other
students' alternatives. Scores below the existing 60% band, including zero, remain
available and are flagged for human review rather than automatically excluded.

Students with no seat stay available for future opportunities. No generated
suggestions, awaiting available capacity, awaiting an update, incomplete/stale
results, no current matches and declined available suggestions are distinct states.
Ranking/assessment calculations, completion gates and recommendation generation
remain unchanged. Removed/declined student-position decisions remain respected.

## Official data and provisional capacity

Display total, approved, suggested and available-for-suggestion seats. Official
remaining capacity is `max(total - approved, 0)`. Provisional headroom subtracts
active suggestions as well. Top-three alternatives reserve no seats.

Approval converts the existing active Suggested record to Approved and clears the
flag, preserving its ID and saving the current recommendation snapshot. Manual
assignment follows the existing approved-placement path and releases any pending
suggestion for that student. Decline/removal clears the active flag and keeps the
human decision in history. Reasons remain required for decline and removal.

Replacing generated suggestions deletes only flagged, unapproved working rows;
it never deletes legacy Suggested records or human decisions. Revision metadata
is retained in ManagementAction. Pending rows are excluded from decision history,
placement reports and the shared student/dashboard placement-status helper.
Approved-only counts, analytics and evaluation keep their original definitions.
Report filters remain independent of the workspace and explicitly labeled.

Deleting a position/company releases only its pending suggestions. Actual placement
history still protects deletion. If deletion fails, pending cleanup rolls back in
the same transaction. Assessment/user archival makes saved suggestions stale;
automatic reconciliation releases invalid system suggestions without requiring a
pin action. An invalid coordinator choice is shown for review.

## Transactions and freshness

Draft writes and all placement decision writes acquire one PostgreSQL
transaction-scoped advisory lock (`21314, 1`) before existing row locks. Catalog
company/position edits use the same order so deletion and capacity changes cannot
race allocation writes. The lock releases on commit/rollback and needs no lock row
or extra table. Production uses PostgreSQL; SQLite is for serial disposable checks.

The existing `/api/placements/draft/` API URL is retained internally. Read/preview
operations do not save proposals, update scores or publish mutation notifications.
`action: sync` rechecks inputs under the existing allocation lock, saves only when
inputs changed, and returns a scoped response. Simultaneous requests produce one
update, with later requests becoming no-ops. The older admin preview/apply actions
remain compatible internal API paths, but are no longer exposed or required in
the UI. They preserve coordinator choices too; stale/replayed previews receive 409. Inputs
include current catalog/configuration, memberships, eligibility, recommendations,
official capacity and human decisions. Active suggestion rows are excluded from
human-decision fingerprints so saving them does not make itself stale.

Approval checks shared pending commitments and existing eligibility/authorization
on the server. Approved records are idempotent; releasing capacity or approving a
different role marks suggestions for review/update. Reads and live invalidations
refresh the view; a visible placement workspace then sends an idempotent sync POST
when reconciliation is needed. They never approve assignments.
External assessment changes still use existing evidence checks and can make an
allocation stale. Student-facing pages retain their existing recommendations and
approved placement status; provisional staff suggestions are not published there.

## Verification and rollout

The migration-preservation test migrates a disposable database from 0021 containing
legacy Suggested/Approved/Removed/Rejected records to 0022, verifies the table set
is identical and checks statuses, scores and remarks are preserved with false
flags. Additional tests cover duplicate flags, conversion, reports/status isolation,
unchanged rankings, archived cohorts and catalog cleanup/rollback, plus PostgreSQL
races. Final check counts and browser evidence are in the
[implementation checkpoint](PLACEMENT_IMPLEMENTATION_CHECKPOINT.md).

Apply the replacement migration through the normal reviewed migration procedure
before using this code with the normal database. No normal/live database changes,
production suggestion generation, deployment, commit or push were performed.

## Automatic-refresh verification

Targeted checks cover initial/no-op sync, instructor scope, no automatic approvals,
unchanged pending IDs, no no-op events, concurrent sync, valid/invalid coordinator
choices, previous-format choice recovery and fixed approved placements. Browser
checks inject a temporary sync outage to verify visible error/manual retry, then
trigger a real capacity invalidation to verify automatic update without a preview
panel. See the checkpoint for final run counts. No additional migration is needed
when `0022_placement_active_suggestion` is already applied.

## Placement action presentation

Back navigation and alternative selection use bordered buttons. Company cards
remain one accessible button each with a visually distinct Review positions
indicator, avoiding nested interactive controls. Tabs, positions and awaiting
alternative cards have visible hover/selected/focus feedback. Native detail
summaries use bordered disclosure styling and retain Enter/Space interaction.
In both staff views, hovering a company card highlights its border without changing
the Review positions indicator. That indicator changes only when the pointer is
over its own area; clicking either area opens the same company workspace. Keyboard
focus stays visible on the whole card, with Enter/Space activation preserved.
Approval uses a green primary button; decline/removal have secondary danger
styling, with destructive confirmation using a solid danger button. Confirmations,
manual assignment and report downloads share the same button treatment. The
currently suggested option is a status label rather than a disabled action.
Enabled and disabled states, reduced motion, light/dark themes and narrow layouts
are preserved. This presentation follow-up changes no allocation or database rules.

The October 25 hover refinement passed frontend lint/build and eight synthetic
browser checks: admin/instructor, light/dark and 1440px/390px widths. Checks covered
independent card/action hover, pointer clicks in both areas, Enter/Space activation,
visible card focus and no horizontal overflow, with zero page errors. API responses
were intercepted with synthetic data; no live backend workflow was exercised.
