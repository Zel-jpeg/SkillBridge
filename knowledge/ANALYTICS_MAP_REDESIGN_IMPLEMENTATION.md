# Analytics chart and placement-map implementation

Updated 9 November 2026 after the user's layout and nationwide-map feedback.
The [review plan](ANALYTICS_CHARTS_AND_PLACEMENT_MAP_PLAN.md) and
[generated previews](../output/design/analytics-preview-2026-11-09/README.md)
record the visual direction. This receipt describes current behavior.

## Report layout

- Main report sections stay visible. Scope, activity dates, organization
  comparison and attempt states are not accordion sections.
- Scope filters and a More filters button share an aligned toolbar. Optional
  filters open a dialog. Individual assessment exports and advanced tools also
  use dialogs rather than folding whole sections into the page.
- Four summary cards, green report tabs, activity/completion panels, horizontal
  score-band and batch bars follow the preview's hierarchy and theme. Current
  attempt states use a compact summary and count table.
- Shared capacity is a compact total/occupied/remaining strip. Its full table
  remains accessible through View capacity records and the records selector.
  Counts, search, sorting, card/list views and CSV/PDF remain available.
- Instructor OJT Placement Management retains its existing layout/styles. Its
  only visual addition remains View placement map with the current scope.

## Maps and measures

The shared report map supports Approved / Suggested independently of Heatmap /
Area boundaries. The selected measure, style, level, parent and area are URL
presentation state, excluded from backend scope-filter requests.

Area boundaries uses a plain background with no road/terrain/raster map tiles.
The whole Philippines is outlined at city/municipality or province/independent
city level. Show Philippines restores the national extent; Explore cities can
focus a province while keeping national geometry loaded. Empty areas remain
outlines on the map. The side list contains only areas with partners in the
selected catalog/report scope, including zero-placement partners and eligible
new partners without openings. Unmatched locations remain explicit.

Selecting a populated area highlights it and offers View students. Approved and
suggested selections use their own record collections and export labels. The
suggestion table shows the allocated partner/position and that recommendation's
value, which may differ from the student's highest alternative.

Heatmap retains the optional OpenStreetMap basemap and weights saved partner
pins by selected students. Switching to outlines removes the tile layer. Failed
external loading leaves exact lists/records usable. Geometry is cached per level
and retries after failure. The React wrapper keeps Leaflet's own host classes
intact across style changes and responsive resizing.

## Backend and access

`GET /api/management/analytics/` adds `placement_map`,
`suggested_placement_map` and `suggested_students`. The map contract uses
`student_count`, per-level matched/unresolved coverage, valid/missing/invalid-pin
counts, weighted partner points and partner-only area rows with `partner_count`.

Approved weights use authorized selected-batch approvals. Suggested weights use
saved `OJTPlacement` rows flagged as active suggestions, with a current eligible
recommendation for the same student/batch/position, current unlocked evidence
and an active selected batch. Approved students, another-batch approvals,
inactive/legacy suggestions and stale recommendations do not enter suggestion
weights. Official placement states and slot occupancy are unchanged. GET does
not generate rankings, reconcile proposals or write allocation revisions.

Existing institute/program/batch validation, newest selected enrollment and
managed-batch authorization apply before geographic aggregation. Instructors
receive only their accessible student records. Empty partners respect catalog
management-program scope. `batch_scope=matching` expands only the caller's
already-authorized batch set; current/latest defaults remain unchanged.

## Nationwide source and identity

Bundled geometry/code names use revision
`680e32e62baeccbcd8845d3b1387bc67c1baf78a` of
[James Faeldon's Philippine JSON maps](https://github.com/faeldon/philippines-json-maps).
The MIT license, source paths/checksums and coverage metadata are retained in
`skillbridge-frontend/public/maps/`. The build recipe is
`skillbridge-backend/scripts/build_analytics_boundaries.py`; Shapely is a
build-only dependency. Existing Leaflet 1.9.4 and vendored Leaflet.heat 0.2.0
remain the renderers, with their licenses retained.

The source supplies 1,642 city/municipality features. Derived overview geometry
has 123 units: 82 provinces, 38 independent cities, Pateros and two special
geographic areas. Independent component cities follow the
[PSA ICC list](https://psa.gov.ph/classification/psgc/iccs), alongside
[HUC classification](https://psa.gov.ph/classification/psgc/hucs). Their polygons
are excluded from parent-province unions. Catalog/geometry IDs agree; all
features are nonempty and valid. Davao City/Davao del Sur and Naga/Camarines Sur
nonoverlap were checked. These are simplified versioned reference boundaries.

Normalized province-qualified names resolve to the bundled IDs. Unique
unqualified city names can resolve; ambiguous names remain unmatched. Metro
Manila and supported legacy names have explicit handling. A province-only
address can count at overview level while remaining city-unresolved. Existing
application records are not rewritten, and reports do not geocode on reads.
No database migration, live backfill or PostGIS installation was performed.

## Verification

- Frontend lint and production build pass.
- 41 backend tests pass on disposable SQLite: geography, analytics, activity,
  admin scope and reconciliation, including saved/stale/inactive suggestions,
  ownership, independent cities and partners without openings.
- All 337 frontend helper tests pass, including suggested record qualification,
  canonical selection, the allocated recommendation value and presentation URL
  isolation.
- Browser checks pass for both roles and all three open report tabs at
  1440/768/390px, including dark phone layouts, real heat rendering, all national
  polygons, tile-free outlines, partner-only lists, approved/suggested student
  drilldowns and the unchanged placement workspace's map-entry button.
  Evidence is in `skillbridge-frontend/tests/artifacts/analytics/redesign-*.png`.
  The runner uses `--analytics --analytics-redesign`, synthetic localhost data
  and the real pinned Leaflet runtime; raster tile traffic is blocked. Temporary
  servers stop automatically. No browser page errors occurred in the final run.

The local pre-merge review also corrected three consistency issues: filtered
approved-map partners no longer reappear as zero-count areas; explicit admin
organization scope includes configured partners before a batch exists; and
suggested-placement cards use the same allocated recommendation as tables and
exports. Missing allocated evidence no longer borrows another position's score.
Focused regressions cover each case and preserve instructor/batch restrictions.

Production deployment, live address completeness and provider availability are
separate operational checks. No production records changed.
