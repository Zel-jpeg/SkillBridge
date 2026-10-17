# Admin Companies and Positions presentation

## Scope and audit

The page uses the current SkillBridge collection conventions: white/dark surfaces,
thin borders, compact typography, green actionable controls and visible focus.
The whole company card remains a neutral container because its individual controls
have different actions. This intentionally differs from the collection skill's
whole-card hover treatment. The toolbar, application shell, existing company and
position editors, API contracts and backend rules are unchanged. No new Companies
screenshot was available in the request; current code and the supplied hierarchy
brief were the visual baseline.

The audit traced `AdminCompanies`, `useAdminCompanies`, `CompanyImage`, image
upload/replacement/removal, `CompanyEditDialog`, position editing/tag suggestions,
`NlpTextPreview`, `DataSection`, shared icons, local Leaflet maps, the branding guide
and company/position endpoint fields and authorization. The company endpoint's
`slots` is configured capacity, not remaining capacity. The existing page has no
pagination; this change does not introduce it.

## Presentation and state

- Company identity retains the image/initials fallback, full company name,
  position count and total configured slots. City/province is a compact native
  address disclosure; opening it exposes the complete stored display address.
  Legacy string addresses remain available without guessing their field structure.
- Position panels initially show the title, configured-slot badge, requirement
  and keyword counts, explicit edit/delete controls and Details. Expanded panels
  show requirements as aligned category/percentage rows in their supplied order.
  Full names and exact percentages are retained. Every keyword is shown; missing
  requirements and keywords have explicit messages.
- NLP preview remains the existing component and loads only after its preview
  action. Merely expanding details starts no NLP request. Collapsing position
  details unmounts the preview; reopening details does not reopen the preview.
- Expansion is keyed by company and position IDs. Search does not discard it;
  background refresh retains surviving IDs and prunes removed records. Existing
  editor drafts remain separate from collection updates.
- Cards use `items-start`/`self-start` so one expanded card does not stretch its
  neighbor. Long names wrap, controls stay separate, and details use natural page
  scrolling. All positions remain present, including companies with many roles.
- The Partner Locations map starts expanded on each fresh page mount. Its native
  button exposes `aria-expanded`/`aria-controls` and an explicit Collapse/Expand
  label. The pinned-company summary stays visible when closed. Local open/closed
  state survives search and background refresh without a stored preference.
- One Leaflet instance remains mounted while hidden. A cleaned-up ResizeObserver
  invalidates its dimensions after reopening or resizing. Marker fitting is
  deferred while hidden and uses the latest company data when visible. Reopening
  without changed data preserves the existing viewport. The map is 256px tall on
  phones and 320px from the small breakpoint.
- Initial loading uses a matching map-and-company-card skeleton through an
  optional `DataSection.skeleton` prop. Other callers keep the default skeleton.
  Existing section errors/retry and last-good background content are preserved.

## Changed files and reasons

| File | Reason |
| --- | --- |
| `skillbridge-frontend/src/pages/admin/AdminCompanies.jsx` | Wire compact cards/disclosures; default-open map, accessible toggle, resize and hidden-marker handling; label the existing search input. |
| `skillbridge-frontend/src/components/admin/CompanyCollectionCard.jsx` | Company/position hierarchy, full address and position disclosures, shared images/icons/NLP preview, accessible existing actions, matching skeleton. |
| `skillbridge-frontend/src/utils/companyCollection.js` | Stable disclosure keys, immutable toggle/pruning and structured location summary. |
| `skillbridge-frontend/src/utils/companyCollection.test.mjs` | Focused tests for disclosure identity, reconciliation and legacy/structured locations. |
| `skillbridge-frontend/src/components/DataSection.jsx` | Optional custom initial skeleton; default and background behavior stay the same. |
| `skillbridge-frontend/tests/company_collection_playwright.py` | Synthetic browser regressions and representative screenshots using real Leaflet with mocked tiles/API/address services. |
| `knowledge/COMPANY_COLLECTION_UI.md` | This audit, behavior, file list, verification procedure and limits. |

Other existing worktree changes were preserved. No application dependency,
backend, production record, deployment or stored-data migration was changed.

## Verification

The frontend unit suite passed **79 tests**, including three new focused tests.
Full ESLint completed with **zero errors and five existing warnings**. The Vite
production build passed. The local npm launcher referenced a missing global npm
installation, so the equivalent project tools were invoked directly:

```powershell
# From skillbridge-frontend
node --test "src/**/*.test.mjs"
node node_modules/eslint/bin/eslint.js .
node node_modules/vite/bin/vite.js build
```

Browser verification used the webapp-testing server helper (after its `--help`),
Python Playwright and installed headless Chrome:

```powershell
# From skillbridge-frontend, with Python Playwright installed or in tests/.runtime-win
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176 --strictPort" --port 5176 -- python tests/company_collection_playwright.py
```

The test caches the existing Leaflet 1.9.4 CDN assets in ignored artifacts and uses
the actual library. Every API request, map tile, image and address/geocoder service
is synthetic. No real credentials, production records or API writes are used.
The helper starts and stops its own local Vite instance.

Verified scenarios include no positions; empty requirements/keywords; nine full
requirements with fractional percentages and nine keywords; seven positions;
long company/role/address strings; successful/broken/missing company images;
address and keyboard-operated position disclosures; explicit NLP request/hide;
search and simulated SSE refresh; expansion preservation/pruning; unsaved company
drafts; image replace/remove/undo and multipart saves; position creation/validation,
editing, slots and delete/cancel; two-step company creation, address selection,
map pinning and delete/cancel; default-open map, keyboard collapse/reopen, one
instance, correct reopened dimensions, popup controls and hidden data updates;
375px/768px/1440px layouts and dark mode; independent card heights; no matches;
matching skeleton; initial error/retry; and last-good content on refresh failure.

Screenshots are under the ignored directory
`skillbridge-frontend/tests/artifacts/company-collection/`, including:

- `desktop-map-expanded-cards-collapsed.png`
- `desktop-position-expanded-map-collapsed.png`
- `desktop-map-collapsed.png`
- `expanded-375-dark.png`
- `map-375-light.png`
- `loading-map-and-cards.png`

Real SSE transport, backend persistence/deletion protection, external geocoding,
live OpenStreetMap tiles, storage uploads and production permissions were not
exercised by these mocked checks. Non-Chromium browsers and screen-reader/device
testing remain unverified. The existing company/position action handlers and
backend authorization remain the source of business behavior.
