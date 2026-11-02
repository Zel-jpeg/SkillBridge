# Position editor layout

31 October 2026. The admin Add/Edit Position dialog follows the approved design
with one continuous skill list that adapts to a changing category catalog.

## Behavior and scope

- Three sections group position details, skill requirements and optional tags.
  Title and capacity share a desktop row and stack on phones.
- Each category has one native level selector: Not required, Beginner 25%,
  Competent 50%, Proficient 75%, Expert 90%, or a custom percentage from 0–100.
  Existing fractional custom values are preserved.
- Case-insensitive search and All/Selected filters operate on the full list.
  Counts describe the filtered results and total configured requirements.
  Changing either control resets list scroll without discarding selections.
- Short lists shrink to their content. Longer lists scroll within a maximum
  height, with sticky desktop column headings. Category names wrap. Phone rows
  stack the category label above its selector. Empty catalog, no selection and
  no search results have separate messages.
- New categories appear from the existing category query without resetting drafts.
  Removed untouched categories disappear; saved or edited requirements remain
  visible so a catalog refresh cannot silently erase position requirements.
- The shared native dialog supplies background isolation, focus containment,
  Escape and focus restoration. Footer actions remain outside the scrolling body.
  Clearing a row in Selected moves focus to search. Existing custom fields do
  not steal focus when opening the editor.
- Zero capacity, editable comma-separated tags, explicit tag refresh, add/edit
  payloads and failure recovery retain the existing contracts. Refresh explains
  that it replaces draft tags. Pending saves prevent repeated submission and
  closing; saving waits for tag suggestions to finish.

Implementation: [PositionDialog.jsx](../skillbridge-frontend/src/components/admin/PositionDialog.jsx),
[scoped styles](../skillbridge-frontend/src/components/admin/positionDialog.css),
and the existing [admin page](../skillbridge-frontend/src/pages/admin/AdminCompanies.jsx).
This is a frontend-only change: no backend, schema, authorization, ranking or
placement-rule changes and no new dependencies.

## Verification

Frontend lint and production build pass. The synthetic
[position-dialog browser checks](../skillbridge-frontend/tests/position_dialog_playwright.py)
cover preset/custom values, search/filter retention, empty states, category
growth to 80 and shrinkage to zero during an open draft, saved categories absent
from the catalog, exact create/edit/suggestion payloads, zero slots, failed-save
and tag-error recovery, duplicate submission, category-query retry and keyboard
focus. Responsive geometry is checked at desktop, tablet, 320/390px phone and
short-landscape sizes in light/dark themes. Desktop and phone screenshots were
visually reviewed. Artifacts are under ignored `work/position-dialog/`.

The existing catalog-validation browser regression also passes. Its position
dialog locator now uses the accessible dialog name, and the confirmation-error
locator excludes global notification alerts.
The surrounding partner-collection browser regression passes too, including
position add/edit, saved tags, collection refresh, map and responsive behavior.

Browser checks use installed Chrome and intercepted synthetic APIs; no backend
server or database is required. Unsupported browser engines and physical devices
were not verified. Local loopback/browser access requires the execution sandbox
override in this environment; the supplied server helper is used with that access.
