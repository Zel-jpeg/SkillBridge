# Institute-shared visibility review

7 November 2026. Branch: `codex/institute-shared-visibility`, based on sidebar
accordion delivery `0b862be`. Preserve unrelated working-tree edits. Local merges
only after verification; no GitHub push or configured-data migration.

## Confirmed cause and accepted behavior

Exact `program_id` filters hide batches with an institute but no single program.
Existing mixed IC batches deliberately retain that shape to preserve assessments,
scores and placements. The user confirmed that opening a shared record from IT
or IS should show the **full shared batch**, with an explicit label.

All programs is an aggregate view: program-specific plus institute-shared records.
A specific program view should also expose the institute's shared batch records,
while identifying the shared scope and full roster. A missing institute is not
evidence of sharing with every institute. No record is copied or reassigned.

## Review and implementation checklist

- [x] Batches, assessment oversight and assessment archives: include same-institute
  shared batches in program views; retain one record/ID and full roster.
- [x] Retake current/history queues: apply the same recorded batch predicate before
  pagination, preserving instructor ownership and evidence access checks.
- [x] Placement workspace/history and exports: align visible batches and saved
  decisions. Keep actual recommendation and placement eligibility unchanged.
- [x] Partner catalog/map: show original shared IC catalog within IC program views
  as shared catalog records. Do not add eligible-program links or infer eligibility
  for a new program batch. Other institutes retain their saved ownership/links.
- [x] Dashboard and analytics: include full shared batches in program read scopes,
  disclose overlapping program views, keep institute totals distinct, and retain
  shared comparison rows rather than counting them once per program.
- [x] Clarify scope labels and navigation. Program skill frameworks stay separate
  from the shared skill library; viewing a shared assessment does not copy skills.
- [x] Keep recommendation reruns limited to their original program-owned mutation
  scope; explain this separately from expanded read visibility.
- [x] Verify IC IT/IS and synthetic non-IC shared batches, foreign institute and
  sibling-program exclusion, full rosters, archives, queues, exports, capacity,
  role boundaries, responsive layouts and existing regressions.

Sidebar is a separate completed gate: `0b862be`, five browser groups and lint/build
passed. Shared visibility is delivered on this feature branch and merged locally after
verification. No configured records were migrated or changed.

## Verification receipt

- Frontend lint and production build passed after the final label/editor changes.
- All 306 source Node tests passed (`work/shared-visibility-node.txt`).
- Thirty-four focused PostgreSQL tests passed in
  `work/organization-postgres-dr7hz658/` (shared visibility, navigation, derived
  scope, dashboard, saved report options and analytics). Four shared-scope tests
  passed again after export-note changes in `work/organization-postgres-wpvkw6vb/`.
- Seven shared-visibility browser groups passed on the production bundle in
  `work/organization-browser-20w65md2/`: both IC programs, full mixed rosters,
  unchanged shared editor state, assessment archives, current/history retakes,
  catalogs, saved placements, dashboard, CSV, actual placement PDF/XLSX disclosure,
  non-IC shared records, foreign/sibling exclusion and four responsive widths.
  Desktop and dark phone screenshots were visually reviewed.
- Six real Leaflet map groups passed in `work/organization-browser-att4h8jf/`:
  original IC pins stay visible in IT, other institutes remain separate, and
  a genuinely unrelated program still has zero matches. Shared capacity is counted
  once and map refresh, recovery, keyboard controls and narrow layouts remain.
- Twelve broader staff workflow groups passed in
  `work/organization-browser-wmx6qg5c/`, covering navigation, cards/banners,
  taxonomy separation, assessments, batches, placement history/exports and
  instructor ownership/navigation. Its obsolete duplicate heading assertion now
  targets the existing Institutes & Programs page title.

Earlier failed attempts were fixture/selector issues (published archived fixture,
card/table name ambiguity, test response key and obsolete page heading); each was
corrected before the passing checks. They are not counted as successful runs.

## Findings that remain intentionally distinct

- Shared batch records have an institute and no single program. A batch without an
  institute stays unassigned and is not made visible in every program.
- Program read views include the full shared roster, not a filtered projection of
  today's profile program. The same batch/assessment/attempt/decision IDs remain.
- School/institute summaries still use distinct students. Program read views can
  overlap; comparison tables retain a separate shared row. Dashboard program-card
  counts describe program-owned batches, with shared context explained nearby.
- Program skill libraries keep their framework/category identity. Shared IC skills
  remain in the ordinary shared library and are not copied into each framework.
- Catalog visibility grants no eligibility. The original IC catalog is displayed
  through IC program views, with saved requirements and eligible-program links
  unchanged; generic new program catalogs retain their actual saved links.
- Recommendation maintenance still targets its original program-owned active
  batches. The button is disabled for a program with shared batches only; the
  institute-wide action can maintain shared batches. No ranking or scoring rule
  was changed to implement visibility.
- The shared batch editor now keeps its actual unset program instead of inheriting
  the viewed program for instructor-option loading. Name/ownership edits do not
  silently convert it into a single-program batch.

## Checkpoint

Both authorized gates are complete: sidebar accordion (`0b862be`) and shared
institute visibility (`codex/institute-shared-visibility`). Feature branches are
retained for exact commit references; local main contains both after delivery.
No push, configured-data migration or deployment. Task-owned test helpers stopped
through their harnesses. Unrelated working-tree changes are preserved and excluded
from these commits. Next: refresh and manually review the configured IC views;
actual hosted/evaluator acceptance is not established by synthetic local checks.
