# Student company browsing

28 October terminology update: current interface labels now say **partners**,
including **All Partners**, **Top partners for you** and **View partner details**.
Company IDs, API names and the grouping/scoring behavior described below remain
unchanged. See [verification and compatibility](PARTNER_TERMINOLOGY.md).

The Final Skill Profile shows one recommendation card per company, ranked by its
highest individual position match. Each card shows that **Top suggested position**,
its **Best position match**, up to three neutral skill tags, a count of additional
requirements, the number of suggested positions, location/distance and the top
role's listed slots. Company scores are not averaged. The collection count
distinguishes companies from suggested positions. All Companies retains all listed
positions with concise summaries instead of repeating tags for every position.

The dashboard Top companies for you, Nearest to you and both student maps also
use one entry per company. Nearest sorts those company entries by distance while
retaining the highest-scoring position as each company's representative.

The dashboard's two company highlights use compact, aligned rows within the
existing bento grid. Top companies shows a separate rank, company logo/initials,
position, match percentage and a slim score bar beside the score. Nearest shows
blue approximate distance as the main metric and match as secondary information;
its first row has a blue tint rather than the top-match card's green tint. Matches
at 80%+ use green, 60–<80% amber and below 60% rose in these two cards. Ranking and
score values are unchanged. Single-line company/position previews have native
title text, full accessible button names and the existing full company dialog.
Footer actions open Skill Profile and Matches; no extra footer captions stretch
the compact cards. A completed profile with no located recommendations has an
explicit nearest-companies empty state.

27 October distance labels distinguish **straight-line distance** in the nearest
card, map pin popups and results company cards from **km by road** and estimated
driving time in the selected route panel. Student distances consistently show one
decimal place, including values above 10km. The map's Closest summary uses the
nearest located company rather than the highest-scoring company; marker top-match
highlighting continues to follow match/sort order. Ranking and distance formulas
are unchanged. Map popup distance occupies its own line to fit narrow screens.

26 October dashboard refresh: lint/build and the six recommendation grouping
tests pass. The [compact-card browser check](../skillbridge-frontend/tests/student_dashboard_company_cards_playwright.py)
passes at 320/375/768/1024/1440px, including dark mode, three-company ranking and
distance order, row heights below 60px, empty/locked states, both footer actions,
company dialogs and keyboard focus. The existing four-viewport company-details
regression passes again with no page errors. These checks use synthetic API/map
data and do not change recommendation or placement logic.

## Dashboard saved-location and road routes

The dashboard and student results page share [NearbyMap](../skillbridge-frontend/src/components/student/NearbyMap.jsx). It
has a **Show my location** control that centers/zooms to the existing saved profile
pin, opens its popup and briefly highlights it. It never requests device GPS or
updates the profile. Company markers remain clickable and keyboard-activatable
with Enter/Space. Selecting a company draws an estimated driving route along mapped
roads, with road distance, approximate driving time, Clear route and explicit retry
after an unavailable/no-route result. No fabricated straight-line route is drawn.

The saved student pin uses a 26×34px blue marker, matching ordinary company pins,
with a white person symbol and a separate 10px **You** label above it. A white outline and shadow keep it distinct
from map detail, green companies and amber top matches. Its anchor remains at the
pin tip; accessible saved-location text, popup, focus and highlight are retained.

[Road route reads](../skillbridge-frontend/src/utils/roadRoutes.js) use the
[OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/#route-service), with
GeoJSON geometry and a maximum 1.5km snap radius per endpoint. The two saved pins
are sent to `router.project-osrm.org` only after company selection; names, addresses,
SkillBridge identity and credentials are omitted. Referrer is limited to the app
origin, without page paths or query strings, to identify the app to the provider.
The existing bounded
external JSON helper supplies an eight-second timeout and abort support. Request
starts are queued at least 1.1 seconds apart per tab to honor the
[public demo policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server).
There is no polling, eager route warming or automatic retry. Up to 20 successful
routes live only in that map instance and are cleared on teardown; they are not
persisted in browser storage. A late response cannot replace a newer selection.

Changing/removing the saved pin or selected destination invalidates the displayed
route; leaving the page aborts pending work and removes layers. Map/tile recovery
retains its existing controls. Missing profile pins disable centering and explain
how to enable routes. Road distance/time are display-only: company grouping,
straight-line proximity, recommendation scores and placement eligibility do not
change. Estimates connect nearby mapped roads and do not include live traffic.

The public routing demo is best-effort with no uptime/data-freshness guarantee.
For institution-scale production use, choose an appropriately operated routing
service and update the narrow CSP origin alongside it. The current policy adds
the OSRM origin to `connect-src`. The canonical tile origin is allowed in
`img-src`, alongside the existing tile-subdomain allowance used by other maps.

27 October map cleanup removes Leaflet's optional prefix and the separate
`Routes: OSRM` line from the route panel. One compact, visible attribution line
retains OpenStreetMap contributors (linked to its copyright page) and OSRM at the
map edge. Map-data credit is not hidden or placed behind a toggle, in accordance
with the [tile policy](https://operations.osmfoundation.org/policies/tiles/).
Both student maps request the canonical `https://tile.openstreetmap.org` tile
URL. Routing behavior/cache size remains unchanged; server caching and a hosted
road graph were discussed as future performance options, not implemented here.
The cleanup passes lint/build, the three routing-helper tests and the five real
Leaflet production-CSP/browser configurations. Checks confirm the optional
Leaflet prefix and route-panel link are absent while the linked OSM/OSRM credit
remains visible, and routing still omits credentials and private referrer paths.

27 October results-map update replaces the separate results map with the shared
component, including location highlight, company road routes, loading/retry/clear,
per-map route caching and compact attribution. Its responsive height remains
280–460px. Container resize invalidates Leaflet's dimensions on both pages, and
the observer disconnects on teardown. Changing results sort mode updates company
pin order/top highlighting without recreating the map, discarding cached routes
or fetching the selected route again. Locked results retain their existing gate.
Lint/build and all ten real-Leaflet browser configurations (five per page) pass,
including result-sort route preservation, saved-pin removal/change and locked
results. The existing four-viewport student company-details regression also
passes with no page errors. Provider/API/tiles remain synthetic in these checks.

Verification on 26 October: all 192 frontend tests, lint and build pass. The
[production-map browser check](../skillbridge-frontend/tests/student_map_routes_playwright.py)
uses real Leaflet 1.9.4 with synthetic tiles/API/routing data at 320/375/768/1440px
and in dark mode. It covers centering/highlight, keyboard pin activation, turned
polylines, route reuse, rapid selection and stale responses, no-route/retry/clear,
saved-pin removal/change, teardown during a pending request, narrow-layout fit,
anonymous routing headers and the exact production CSP. Six compact-card and four
existing company-dialog browser scenarios pass again with no page errors.
One live OSRM probe with public synthetic city coordinates returned `Ok` and a
38-point road geometry; this verifies that request at that time, not future uptime.
No real student pin or account data was sent to an external service during checks.

The map check requires cached CDN `leaflet.min.js`/`leaflet.min.css` as
`tests/artifacts/student-map-routes/leaflet.js` and `leaflet.css`. Build with
`VITE_API_URL` set to the existing API origin allowed by the policy, then run
`python tests/student_map_routes_playwright.py` using the backend test environment.
It serves `dist` locally, intercepts the API/provider requests and shuts down its
server after the run. The downloaded assets/screenshots remain ignored artifacts.

Recommendation cards and company cards open a read-only company dialog. Student
dashboard Top companies for you and Nearest to you entries open the same dialog. The dialog
shows the company location, all listed positions, full skill requirements, listed
slots and available match scores. A zero score is displayed as zero; an unavailable
score is explicitly identified. All scored positions appear from highest to
lowest match, with **#1 in this company**, **#2 in this company**, and so on.
The first is labeled **Top suggested position**. Unscored positions follow with
**No current match score** and have no numeric rank. This order applies from
either collection tab and the dashboard, and updates while the dialog is open.
Exact score ties retain the existing ascending position-ID ordering.

The amber placement notice appears before the results collection and in the
company dialog footer. It is omitted from the dashboard's company matches tile:

> Final placement decisions are made by your OJT coordinator.
> This list is for reference only.

Details use the existing student-only `/api/student/companies/` endpoint through
the shared query cache. This read starts when the dialog opens (or the All
Companies tab opens), and the open dialog resolves company/position IDs from
current catalog data. Missing records and retryable read failures have explicit
states. No staff endpoints or new backend permissions are involved. The shared
recommendation serializer adds `company_id` so distinct companies with the same
name are never merged. Legacy cached rows without that ID remain separate until
normal revalidation brings the current payload. Catalog match scores retain
their stored precision to agree with recommendation cards.

Grouping is a presentation change: the API still returns individual position
recommendations, and the 60/25/15 ranking formula, evidence/completion gates,
stale-result locks and placement approval rules are preserved.

The shared native `DialogShell` provides focus trapping, Escape dismissal, focus
restoration and scroll locking. Results cards use a stretched details button so
the card surface is clickable while score explanation buttons remain independent.
The green hover and keyboard focus treatments follow the collection UI skill.

Relevant sources:

- [Student results](../skillbridge-frontend/src/pages/student/StudentResults.jsx)
- [Student dashboard](../skillbridge-frontend/src/pages/student/StudentDashboard.jsx)
- [Company details](../skillbridge-frontend/src/components/StudentCompanyDetails.jsx)
- [Placement guidance](../skillbridge-frontend/src/components/placements/PlacementGuidance.jsx)
- [Grouping and position ordering](../skillbridge-frontend/src/utils/recommendationResults.js)
- [API contract checks](../skillbridge-backend/api/test_recommendation_contract.py)
- [Synthetic browser checks](../skillbridge-frontend/tests/student_company_details_playwright.py)

The browser fixture mocks all API and map data and blocks other external requests.
It requires Vite on port 5178, Python Playwright and an installed headless Chrome.
Artifacts are saved under the ignored `tests/artifacts/student-company-details/`.
It covers five scored suggestions grouped into two company cards, five listed
positions ordered within one company (including two unscored roles), zero versus
missing scores, unique dashboard/map entries, both collection tabs, keyboard
focus, the advisory notice, responsive layouts, dark mode, failed-read retry and
updates/removal while details remain open.

Verified locally on 20 October 2026: frontend lint/build and all six focused Node
grouping/ordering tests passed. Django checks and all 11 recommendation-contract
tests passed against isolated in-memory SQLite, including student-only catalog
access, distinct same-name company IDs and preserved score precision. The synthetic
Chrome checks passed at 1440, 768, 375 and 320 pixels, including dark mode at 320 pixels,
with no browser page errors. Card and dialog screenshots were reviewed. These
checks use mocked API/map data and do not establish live-service behavior.
