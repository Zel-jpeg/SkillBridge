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

If any required category is unassessed, display **Incomplete evidence**, with no
headline percentage. A category actually assessed at zero counts as zero.
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
