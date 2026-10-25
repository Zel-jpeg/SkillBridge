# Placement collection redesign

Implemented 25 October 2026 from the three approved
[ImageGen concepts](../outputs/ui-concepts/placements-2026-10-25/DESIGN_BRIEF.md).
Instructor and admin placement pages share the implementation. Real authorized
API records supply all counts, companies, students and history; the concept's
sample badge, names and illustrative totals are not application data.

## Three collections

- The header retains report downloads and suggestion refresh. Three summary
  cards add restrained icon tiles; labels still distinguish student scope from
  shared capacity. Suggestions remain provisional and require coordinator approval.
- Companies use compact cards with the existing image/initials fallback, location,
  position count, scoped suggested-student count, and prominent provisional
  availability. The capacity strip labels approved, suggested and available seats
  separately. Exact segment widths use the current numeric counts; legacy excess
  is visually bounded while numeric labels remain unchanged. Company opening,
  position selection, candidate review and manual assignment keep their handlers.
- Awaiting allocation uses one bounded, paginated row collection. Each student has
  a course/ID, batch, explicit status, short next-step explanation and View details.
  Incomplete/stale evidence, no matches, unavailable seats, preparing/updating
  suggestions, declined options and coordinator review remain distinct states.
  The page explains that awaiting allocation is not a rejection.
- Allocation details show only the status and match information supplied by the
  placement API. They do not invent assessment results. Existing alternatives open
  candidate review above this dialog; closing it restores the allocation details.
  A role-appropriate link opens the existing student-record page.
- Decision history is a semantic table with company branding, student identity,
  explicit approved/removed/declined/legacy-suggested labels, assignment score,
  recorded time/actor and a read-only Details dialog. Narrow containers present
  labeled cards. Genuine zero scores remain zero; unavailable snapshots remain
  Manual / no score or Not recorded. Status-specific decision timestamps are used
  when supplied, with the existing updated timestamp as fallback, in Manila time.
  Details retain remarks, historical score components and distance. They provide
  no new approve/remove/edit action on history.

## Collection behavior and boundaries

Search and filter state, server-side history query filters and full filtered totals
are preserved. Company, allocation and history collections use ten records per
page; position candidate views use eight. Shared pagination now also
shows a truthful range for a single nonempty page. Company/allocation page state
persists its downward clamp after live result shrink, avoiding an obsolete page
when the list grows again. History retains its existing server-page clamp.

Both themes have hover and keyboard focus feedback. Phone layouts stack metrics,
filters and allocation row content; the top view controls scroll within their
container. History changes to cards based on available container width. New detail
dialogs reuse native modality, shared body-scroll locking and focus restoration.
The existing loading, error/retry and last-good-data `DataSection` behavior stays
in place. Empty history distinguishes no decisions yet from no filtered matches.

This is a frontend presentation change. No API fields, database tables, ranking
weights, eligibility gates, capacity policy, approval requirements, mutation
payloads, automatic-reconciliation rules or role boundaries changed. Capacity
continues counting all batches, while visible student identities follow backend
authorization. See [the placement contract](PLACEMENT_DRAFT_IMPLEMENTATION.md)
and [capacity definitions](CAPACITY_AND_AREAS.md).

## Company position review

The approved [position-review concept](../outputs/ui-concepts/placement-position-workspace-2026-10-25/DESIGN_BRIEF.md)
is implemented through the shared `PositionReviewWorkspace` component. A company
identity row leads into position navigation and a candidate panel. Position cards
and the shared capacity strip distinguish approved, provisional and available
seats using real counts across all batches.

Suggested and Other ranked candidates show position rank, student identity, hybrid
match, distance when supplied, current suggestion and Review candidate. Rank uses
the existing actionable position roster order, before search and batch filters;
filtering, excluding current suggestions and pagination do not renumber it.
Approved shows the saved approval score, including explicit manual/no-score
values, and the existing removal action. Missing current scores remain unavailable;
genuine zero scores remain zero. No ranking or eligibility rules changed.

All three candidate views show at most **eight students per page**, including their
card layouts. Page ranges and counts reflect the full filtered list. Search and
view changes reset pagination; live shrinking clamps it without jumping back when
results grow. Other placement collections retain ten records per page.

Wide screens place positions beside the candidate table. Narrower screens stack
the position navigation, and candidate panels below 800px wide use labeled cards;
below 400px the cards use one column. Long titles wrap, tabs scroll within their
container, and phone actions have 44px minimum height. Both themes retain hover
and keyboard focus styling. Opening a company focuses its heading and brings the
workspace into view; Back restores the company trigger and previous scroll.
Candidate review, manual assignment, approval confirmation and removal still use
their existing dialogs and mutation handlers.

## Verification

- Frontend lint and production build pass; all 224 frontend Node tests pass.
- [Synthetic collection browser suite](../skillbridge-frontend/tests/placement_collections_playwright.py):
  30 groups pass for instructor/admin at 320x568, 375x812, 768x1024, 1024x768,
  1366x1000 and 812x375 in light/dark mode. Coverage includes all three collections,
  exact capacity proportions, zero/missing scores, long company names, pagination,
  live shrinking/regrowth, search/page reset, server history filters, escaped
  remarks, read-only details, keyboard focus and nested allocation/candidate
  dialog return. API traffic is intercepted, including existing sync requests;
  no real placement writes occur.
- Existing [placement workflow regression](../skillbridge-frontend/tests/placement_draft_playwright.py):
  seven groups pass against a newly created disposable local SQLite fixture.
  They cover sync failure/retry, capacity invalidation, low-score alternatives,
  conflicts, approval, removal by placement ID, history search, instructor access
  scopes and responsive layouts. No page errors are recorded.
- [Position workspace browser suite](../skillbridge-frontend/tests/position_workspace_playwright.py):
  44 groups pass for both roles across ten viewport sizes from 320 to 1920px,
  including portrait/landscape and light/dark themes. Checks cover all three views,
  eight-row pagination, exact capacity proportions, stable ranks after filtering,
  missing/zero scores, long titles, empty views, live shrink/regrowth, score help,
  existing review/approval/removal/manual dialogs, keyboard return and Back focus.
  All API records are synthetic and intercepted; no real placement writes occur.
- Reviewed synthetic screenshots are in
  `skillbridge-frontend/tests/artifacts/placement-collections/`. No production API,
  production database, physical device or hosted deployment was exercised.

Commands from `skillbridge-frontend`:

```powershell
npm run lint
npm run build
node --test
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5195 --strictPort" --port 5195 -- python -u tests/placement_collections_playwright.py
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5195 --strictPort" --port 5195 -- python -u tests/position_workspace_playwright.py
$env:PYTHONPATH='tests/.runtime'
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort" --port 5178 -- ../skillbridge-backend/venv/Scripts/python.exe -u tests/placement_draft_playwright.py
```
