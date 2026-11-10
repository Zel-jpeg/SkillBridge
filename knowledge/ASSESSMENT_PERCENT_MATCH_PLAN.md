# Assessment percentage match — isolated feature branch

User instruction: implement on a branch; **do not merge to main or push**.
Branch: `codex/assessment-percent-match-20261110`, based on `ee3d84a` (the
position-specific NLP branch). Main remains `0fb2c1d`. No migration is needed.

## Contract

`Match = sum(required category assessment percentages) / required category count`.
Only positive position requirements count. Each category has equal weight;
assessment raw/max points are pooled within each category first. Minimums are
thresholds, not weights. Unrelated categories, tags, location and NLP do not
enter this percentage. The result is not a hiring probability.

If any required category is unassessed, the final Match remains unavailable.
Show a supplemental **partial** percentage averaging only assessed required
categories, with the assessed/required count. If none are assessed, show the
count (for example `0/3 assessed`), not an invented percentage. A category
actually assessed at zero counts as zero. Partial display values do not become
final ranking, filtering, eligibility or stored Match values.
Positions without positive requirements remain unavailable as before.

Personal ranking groups all-minimums-met options first, fully assessed but
below-minimum options next, and incomplete options last. Complete options are
ordered by this average, then existing NLP/location support, then stable position
ID. Incomplete options use coverage then support without publishing a percentage.
NLP/location support retains its existing 25:15 weighting and distance behavior;
it only breaks equal assessment averages. This does not add a location-preference
filter. Shared-slot allocation and coordinator approval remain separate.

Each company card represents its highest-ranked individual position. A high
average cannot cancel a failed minimum. Category evidence and minimum status are
shown in the match breakdown.

New saved policy: `assessment-average-match-v1`; version:
`assessment-average-match-20261110-v1`. APIs add `match_percentage` and
`top_match_percentage`; `requirement_coverage` retains its original units.
The old `match_score` database field remains the legacy hybrid reference;
consumers choose the displayed value by saved policy. No schema change.

Old `assessment-led-option3` suggestions retain rank/coverage labels. Existing
legacy hybrid values and placement approval snapshots retain their original
meaning. New approvals freeze the saved policy and assessment evidence.
The policy version invalidates old recommendations for explicit refresh without
regrading answers. No live refresh or other live record changes are part of this
implementation. Switching back to main restores its code; if live suggestions
are refreshed on either branch, the other policy will require its own refresh.

## Checklist / checkpoint

- [x] Create isolated branch; leave main unchanged.
- [x] Implement calculation, policy version and rank ordering.
- [x] Add percentage API fields with old-policy compatibility.
- [x] Update student/coordinator/admin displays and saved report units.
- [x] Add accessible category breakdown and incomplete-evidence messaging.
- [x] Verify formula, raw/max pooling, zero/missing evidence and minimum precedence.
- [x] Verify old snapshots/exports and policy-version staleness.
- [x] Run frontend tests, lint and production build.
- [x] Run isolated backend regression suite.
- [x] Verify production UI on desktop and phone using synthetic program evidence.
- [x] Prepare verified changes for local feature-branch commit; record results and limitations.

Implementation and verification are complete. Save this checkpoint with the
feature-branch commit; its Git history records the commit ID. Next operator step:
review locally, then explicitly refresh recommendations for the intended scope
to generate new-policy suggestions. No live refresh has been performed. Do not
merge or push without the user's instruction.

## Verification receipts

- Full backend suite: **881 passed** on isolated local PostgreSQL, 534.896 s.
  `work/branch-review-postgres-f711751l/tests.txt`; its owned database was stopped.
  Includes actual grading, scoping, concurrent submissions/approvals, shared-slot
  competition, reports, snapshots and migrations in the test database only.
- Final focused API/policy suite after extra percentage assertions: **24 passed**,
  SQLite (`core.test_settings`), `work/percent-match-final-focused.txt`.
- Frontend: **346 passed**, `work/percent-match-frontend-tests.txt`.
  ESLint and production build pass; receipts `work/percent-match-lint.txt` and
  `work/percent-match-build.txt`.
- The initial production-browser pass verified scoped 80% Match, breakdowns,
  desktop/phone layouts, program-specific staleness and explicit test refresh.
  Extended dashboard/detail-dialog pass also passed, with no unexpected server
  responses or browser errors: `work/organization-browser-cviyxju_/browser.txt`.
  Both program APIs, result cards, detail dialogs and dashboard highlights agree
  on 80% Match; desktop and 390-pixel dark-mode layouts have no page overflow.
  A temporary SQLite
  lock during concurrent first-load finalization led to serial prewarming in the
  browser fixture. Cold model initialization has a bounded 120-second warmup
  request; UI reads still use normal app behavior. Production concurrency is
  covered by the isolated PostgreSQL suite, not SQLite.

Browser fixtures block external map/CDN requests and send no emails. They do not
establish live Supabase availability, field assessment validity or hiring-success
accuracy. The 60/25/15 model-comparison benchmark remains an explicitly labelled
legacy reference; its accuracy is not the new Match percentage.

## Score clarity follow-up — 10 November 2026

The skill-leader cards use combined category assessment grades, not position
coverage. An actual full-mark category result remains 100%. Cards now label that
metric, show earned/possible assessment points when available, and identify tied
leaders. The ranking dialog uses the same competency-evidence gate as the cards,
so stale recommendations do not hide valid category grades. Equal percentages
share a score-group rank (1, 1, 2); alphabetical names only determine list order.
The shared-score podium below supersedes the earlier competition-rank layout.
No grading, matching, eligibility or database values were changed.

Missing results are explained in plain language and the breakdown. Following
the user's request to keep a number visible, the current partial-display rule
above replaces the earlier dash. Missing grades never become zero, and a
partial average never replaces the final Match or changes eligibility. The
recommendation display helper shares this formatting across screens.

Verification: **348 frontend tests passed**, ESLint and production build passed.
The dashboard browser regression passed eight scenario groups, including cards,
raw points, tied ranks, earned zero, keyboard dialogs, recovery states and
320/375/768/1024/1366/1920-pixel layouts in both themes. The missing-Match check
passed at 390 and 1440 pixels using synthetic read-only responses. Artifacts:
`work/score-clarity-tests.txt`, `work/score-clarity-lint.txt`,
`work/score-clarity-build.txt`, `work/organization-browser-2l24iygi/browser.txt`,
and `work/organization-browser-0u58n1uu/browser.txt`.

This follow-up stays on the same feature branch. Main remains `0fb2c1d`; no
merge, push, migration or live recommendation refresh is part of this change.

## Partial numbers and tied-card layout — 10 November 2026

- `80% partial` means the equal-weight average of observed required-category
  grades, with a count such as `2 of 3 required categories assessed`. Positive
  requirements only; actual zero grades count. Unrelated categories, thresholds,
  NLP and location do not contribute. No full percentage is fabricated.
- `recommendationValue` still returns null for these incomplete positions.
  Backend rank, numerical minimum checks, allocation, saved scores and snapshots
  are unchanged. The partial result is a display calculation from saved evidence.
- When no required categories have results, the headline shows `0/N assessed`.
- The earlier equal-sized individual tied cards were replaced by the shared-score
  podium described below, following the user's clarified UI preference.

Frontend tests: **350 passed**; ESLint and production build passed. Browser
verification passed for partial/empty results at 390/1440 pixels and nine
dashboard scenario groups, including long-name ties with equal card widths,
equal heights and aligned score rows on desktop and phone. Screenshots were
visually reviewed. Synthetic read-only responses were used; no live writes.
Receipts: `work/partial-match-tests.txt`, `work/partial-match-lint.txt`,
`work/partial-match-build.txt`, `work/partial-match-browser.txt`,
`work/tied-cards-browser.txt`. Detailed browser receipts:
`work/organization-browser-vzoss2gg/browser.txt` and
`work/organization-browser-0hglnh7d/browser.txt`. Implementation is complete;
save this checkpoint with its feature-branch commit. Review locally; do not
merge or push without the user's instruction.

## Shared-score podium — 10 November 2026

The user clarified that identical scores should share one card with individual
profile pictures and clickable names in a scrollable list. Submission time is
not used to distinguish those students. Ranks now represent distinct stored
combined category percentages: 100%, 100%, 80% has student ranks 1, 1, 2 and
two podium cards. No score, answer, timestamp or recommendation is rewritten.

The three highest distinct scores appear as a large center gold card, medium
left silver card and smaller right bronze card. On narrow screens gold appears
above silver/bronze. Each card has a bounded scroll area, with all students in
that score group retained. Every avatar/name row opens the existing student
information modal. The parent dialog and list scroll/focus survive closing it.
The outer score card is an article, avoiding nested interactive buttons.

Groups below the third distinct score remain in the paginated ranking list.
Student counts and pagination offsets include every member of the podium groups.
Dashboard category previews state the total number sharing the highest score.
The logic uses scoped assessment evidence and supports any institute/program.

Checks: **351 frontend tests passed**, ESLint and production build passed.
All nine dashboard browser scenario groups passed. They verify descending
gold/silver/bronze dimensions, tied-member scrolling, separate avatar/name
buttons, keyboard selection, nested student modals, restored focus/scroll and
320/375/768/1024/1366/1920-pixel layouts in light/dark themes. Long-name shared
cards also pass at 390 and 1440 pixels. Screenshots were visually inspected.
Synthetic read-only fixtures were used; backend grading and live data were not
changed. Receipts:
`work/shared-podium-tests.txt`, `work/shared-podium-lint.txt`,
`work/shared-podium-build.txt`, `work/shared-podium-browser.txt`, and
`work/organization-browser-9vn5va_z/browser.txt`. Save this completed checkpoint
with its feature-branch commit. Main remains `0fb2c1d`; do not merge or push.
