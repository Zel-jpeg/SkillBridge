# Evidence-based Match — approved 10 November 2026

Branch: `codex/assessment-percent-match-20261110`. Main remains `0fb2c1d`.
The user approved replacing the two incomparable full/partial percentages with
one evidence-based calculation. Preserve the separate uncommitted leaderboard
JSX/CSS refinements and `LEADERBOARD_INNER_CARD_REFINEMENT.md` found at start.

## Contract

Match = sum of assessed positive-required-category percentages / count of all
positive required categories. For 90% across two of three categories, this is
60%, not 90% partial. For 90% across three of five it is 54%. Complete evidence
keeps its existing average. Grades can yield 77%, 86% and decimal values.

Unassessed categories contribute no demonstrated match credit; their grades,
raw/max points and requirement states remain unassessed/null. Actual assessed
zeros remain measured zeros. No unrelated category, threshold weight, NLP or
location enters this percentage. This is not hiring probability or a claim of
unmeasured ability. No positive requirements means no available percentage.

Personal rank: all category minimums met first; all other options next. Within
each group use evidence-based Match, then existing NLP/location support, then
stable position ID. Unmet and unassessed minimums remain explicit. Shared-slot
automatic allocation still excludes both; its complete-grade utility is intact.
Cross-student candidate ordering must use the same new metric within minimum
status groups. Do not use the legacy hybrid reference to break new-policy ties.

New saved policy `assessment-evidence-match-v2`, version
`assessment-evidence-match-20261110-v2`. Preserve both previous average-policy
and assessment-led history/snapshots. Do not reinterpret old saved scores. The
version makes old suggestions stale for explicit scoped refresh, not regrading.
No schema migration, live rerun, data deletion, merge or remote push is included.

## Checklist

- [x] Confirm approved definition and inspect scoring/display/ranking callers.
- [x] Preserve existing unrelated leaderboard edits.
- [x] Add new policy/version, server Match calculation and history compatibility.
- [x] Align all percentage consumers, incomplete-state styling and explanations.
- [x] Test complete/missing/zero evidence, precision, unrelated categories,
      rank/eligibility consistency and saved snapshot compatibility.
- [x] Run relevant backend and frontend checks and production-browser journeys.
- [x] Review generic program isolation and report units.
- [x] Record receipts and prepare only this feature's files for its local branch commit.

Current checkpoint: implementation and verification are complete. Commit only
this feature's files; preserve the pre-existing leaderboard changes. Next local
operator step is an explicit scoped recommendation refresh to generate the new
policy. Existing live recommendations have not been recalculated. No assessment
answers or grades need to be reset. Main and GitHub must remain unchanged.

## Verification receipts

- Focused backend: **47 tests passed**, one PostgreSQL-specific test skipped in
  the SQLite run. Includes calculation, API/report fields, candidate ordering,
  saved-policy compatibility, grade preservation and allocation gates.
  `work/evidence-match-focused.txt`.
- Frontend: **354 tests passed**. ESLint and production build pass.
  `work/evidence-match-frontend.txt`, `work/evidence-match-lint.txt`,
  `work/evidence-match-build.txt`.
- Production-browser synthetic card checks pass at 390 and 1440 pixels:
  one assessed score of 80% across two requirements is 40% Match; no observed
  required evidence is 0% demonstrated match credit, with grades still shown as
  unassessed. Grey styling, counts and no-overflow checks pass.
  `work/organization-browser-76ya433o/browser.txt`.
- Real-API synthetic program journeys pass on desktop/phone: grade-derived
  percentages agree across cards, details and dashboard; independent program
  scoping, catalog staleness, explicit test refresh and earned-zero behavior
  remain intact. `work/organization-browser-ehxu_xdy/browser.txt`.
- Full isolated PostgreSQL suite: **885 tests passed**, 450.303 s,
  `work/branch-review-postgres-lbka802p/tests.txt`. Its owned server was stopped.
- Additional end-to-end missing-category regression added after suite startup:
  **1 passed** on both SQLite and isolated PostgreSQL. A real generated
  recommendation and CSV export show 40% from 80 assessed points across two
  categories, without inserting a zero-grade row or changing existing marks.
  `work/evidence-match-api.txt` and
  `work/branch-review-postgres-ynv3fjxe/tests.txt`.

Browser fixtures block external map/CDN requests; these checks do not certify
live Supabase connectivity or job-success accuracy. No emails or live records
were written. The existing legacy NLP benchmark retains its own labeled units.

No schema migration is required. Switching policy invalidates older current
suggestions for an explicit refresh while leaving source grade evidence and
approved snapshots intact. Backward compatibility is covered for both prior
assessment-led and average-policy saved values. No live refresh was performed.
