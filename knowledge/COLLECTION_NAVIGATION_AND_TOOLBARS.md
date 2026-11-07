# Collection headings, navigation and toolbars

Updated 6 November 2026 from the user's Institutes & Programs screenshot.

## Presentation rules

- Keep one main page title. Show a short introduction when it helps explain the
  starting view. Avoid repeating the selected institute as another heading and
  description when the breadcrumb already identifies it.
- Keep meaningful instructions, archived/read-only notices, permission guidance,
  scope/capacity explanations and result counts. These serve different purposes.
- Use the breadcrumb parent links for returning to institutes, programs or
  authorized skill libraries. Destinations use known routes or existing catalog
  state, not browser history. The user removed the separate back control because
  it was too large. Keep visible keyboard focus and the breadcrumb touch targets.
- Place search, status/sort filters and the cards/list toggle in one toolbar on
  desktop. Fields and the toggle tray are 44px tall and align at their bottom
  edge. Keep labels visible and counts below the toolbar.
- Allow controls to wrap at narrow widths. Search gets its own line on phones;
  touch-mode toggle buttons have 44px targets. Preserve the existing mobile view
  availability and collection behavior.

## Coverage

The shared [toolbar styles](../skillbridge-frontend/src/styles/collectionToolbar.css)
apply only to marked collection toolbars, rather than resizing forms globally.

| Area | Update |
| --- | --- |
| Institutes & Programs | One page heading/action row, selected institute in the breadcrumb, aligned search/status/view |
| Admin/instructor Skill taxonomy | Remove repeated institute heading and generic nested introduction; align framework search/status/view |
| Batches and selected-batch roster | Move each view toggle beside its search and filters |
| Admin and instructor partner catalogs | Group search/status/view in the same toolbar |
| Placements | Align search/scope/availability controls and move partner view toggle beside them |
| Assessment archives | Align search with batch/instructor dropdowns |
| User Management and assessment libraries | Shared grouped-filter toolbar aligns search, filter button and view tray |
| Reports & Analytics detailed student records | Align search, sort and view controls |
| Program instructors and instructor selection dialogs | Put view controls with search/status fields |

The [shared breadcrumb](../skillbridge-frontend/src/components/OrganizationBreadcrumbs.jsx)
supplies the parent links on the existing institute/program navigation
pages. See the [navigation contract](ADMIN_SCOPE_NAVIGATION_PLAN.md) for URL scope,
batch/email parameters and access boundaries.

Search, filter reset, pagination, view selection, endpoint usage and record access
retain their existing behavior. This update has no backend or database changes.

## Verification

The focused browser runner is `run_organization_browser.py --collection-layout`.
It uses temporary localhost servers, an owned production bundle and synthetic
SQLite fixtures. The existing institute/program regression remains available via
`run_organization_browser.py` without a scenario flag.

- Frontend lint and production build passed.
- Focused layout matrix: **10** browser groups passed with zero page errors.
  It checks heading duplication, search/status/view geometry, filtering and view
  preservation, instructor dialogs, five scoped workspaces, the batch roster,
  shared user filters, taxonomy versions, instructor partners, shared report
  records and four widths (320/390/768/1440px) in light/dark touch contexts.
  Evidence: `work/organization-browser-f68t96pd/`.
- Existing institute/program regression: **11** groups passed with zero page
  errors. Evidence: `work/organization-browser-p7p_u98n/`.
- Reviewed desktop and phone/tablet screenshots. Desktop controls align at 44px;
  phone search wraps above status/view without horizontal overflow. The first
  browser pass caught the Status dropdown's accessible label changing when its
  label was regrouped; explicit labels now preserve its accessible name. A new
  test's ambiguous Clear filters locator was also scoped to the user toolbar.

Separate finding: the administrator analytics request returned HTTP 500 from
`analytics_payload`, with `Unsupported lookup 'is_archived' for ForeignKey` in
the concurrently edited pending-retake query in `api/analytics.py`. Admin
background preloading can consequently show a server-error notification on other
pages. This task did not change that backend code. The shared ReportsAnalytics
record-toolbar geometry was verified through the functioning instructor report
view; administrator report rendering remains unverified until its API recovers.
The earlier failed admin-report check is recorded in
`work/organization-browser-z5iduovv/`. Synthetic servers were cleaned up by their
runners; no configured database or live service was changed.

## Back-control visibility follow-up

Historical change, superseded by the user's request to remove the separate back
control. Navigation now uses the breadcrumb links alone; its obsolete styles,
icon and props were removed and the existing browser checks updated accordingly.
The removal passed frontend lint/build and browser-script syntax validation;
the browser matrix was not rerun for this removal.

The user requested a more obvious clickable back action. The shared breadcrumb
now renders its existing parent action as an outlined control with the shared
left-arrow icon, destination text, light/dark surfaces and hover feedback. Route
links keep their navigation semantics; the local-state institute return remains
a button. Existing keyboard focus and the 44px minimum target are retained.

Frontend lint/build passed. The existing layout matrix passed **10** groups with
zero page errors, including parent navigation and four responsive widths in both
themes. Evidence: `work/organization-browser-frwxx5g5/`. Desktop and 320px
screenshots were reviewed. The separately recorded admin analytics error is
outside this presentation change.
