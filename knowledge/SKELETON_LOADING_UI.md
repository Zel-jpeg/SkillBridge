# Section loading presentation

26 October 2026. Loading presentation follows the visible content structure across
student, instructor and administrator screens. Query ownership, refresh intervals,
authorization, assessment evidence and placement rules are unchanged.

## Loading states

- A page-code download immediately shows a destination-specific skeleton inside
  the existing shell. Forms, profiles, dashboards, report tabs, assessment pages
  and collections use their corresponding layouts. There is no separate visible
  `Loading page…` indicator. Loading labels remain available to screen readers.
- The first data read replaces only dependent content. Keep page headings,
  navigation, search, collection view controls and form labels mounted. Reference
  choices can remain disabled until authorized options arrive.
- Collection placeholders follow the selected cards/list view and its phone card
  fallback, column breakpoints and approximate card/row structure. Unknown result
  counts use a bounded representative page; placeholder count is not a result count.
- Known structures, such as three placement metrics or five admin assessment
  totals, have that exact number of placeholders and the corresponding grid.
- Normal background revalidation keeps last-good content, input state and controls.
  Do not bring skeletons back for SSE/polling or cached reads. Existing explicit
  report-scope feedback remains separate from silent automatic refresh.
- Errors have retry actions; successful empty results have the existing empty
  explanation. Neither state remains disguised as loading. Definitive access loss
  still clears inaccessible content through the shared cache.

## Components and coverage

[DataSection](../skillbridge-frontend/src/components/DataSection.jsx) still observes
the existing query store and starts no independent fetch, timer or event stream.
Its `skeleton` override supports a composed section; `layout`, `count` and `columns`
support simple sections. Existing imports of `ContentSkeleton` remain compatible.

[Skeletons](../skillbridge-frontend/src/components/loading/Skeletons.jsx) and its
[styles](../skillbridge-frontend/src/components/loading/skeletons.css) provide:

- staff dashboard highlights, student collections and role-specific metric grids;
- instructor/admin users, batch collections, rosters and action timelines;
- assessment libraries, question editors, answer review and student assessment flow;
- reports completion/attempt panels, skills matrices, placement/slot panels and
  submission line-chart areas;
- company collections, position review, allocation rows and detail dialogs;
- student dashboard tiles, profile details and initial result summaries;
- compact field/text placeholders and reference category pills.

The existing tailored admin company map/card loader is retained. Login, save,
download, notification and map progress messages remain local to their actions;
they do not need page skeletons. A position dialog keeps its existing frame,
heading and close button while its reference-dependent form loads. Its existing
initial requirement values are still initialized after the category read.

Skeleton geometry is neutral and does not imply a score, status or placement.
Decorative shapes are hidden from assistive technology, the affected section has
a named loading status, and pulse/spin animation respects reduced motion. Both
themes use the same responsive layout.

## Verification

[Browser fixture](../skillbridge-frontend/tests/loading/index.html) imports the real
components and cache. [Browser checks](../skillbridge-frontend/tests/loading_playwright.py)
use synthetic intercepted responses and reserve no database records. They cover
initial reads, retained search/draft state, silent refresh, background failure and
retry, loader semantics, responsive card fallbacks, themes and reduced motion,
plus delayed initial reads in the three roles' actual routes.

Run from `skillbridge-frontend/` with Python Playwright and local Chrome available:

```powershell
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5196 --strictPort" --port 5196 -- ../skillbridge-backend/venv/Scripts/python.exe tests/loading_playwright.py
npm run lint
npm run build
```

Browser artifacts are ignored under `tests/artifacts/loading/`. Synthetic delays
verify UI states, not deployment response times. These checks do not replace
hosted-device or production-network testing.

Verified locally on 26 October: frontend lint/build and all 173 utility tests
passed. The loading suite passed its lifecycle/recovery checks, all 20 layouts at
360/768/1440px in both themes (120 layout/theme/width combinations), and delayed
reads on 16 actual routes across the three roles. The existing Companies suite
also passed all seven groups, including position add/edit validation and saving,
retained company drafts during refresh, initial failure/retry and responsive layouts.
No database fixtures or production data changes were required.

Cold-code follow-up: `RouteSkeleton` uses the pathname and selected report tab
without fetching data or mounting destination controls. The focused
[navigation-code checks](../skillbridge-frontend/tests/navigation_code_playwright.py)
held lazy page modules for two seconds and verified direct skeletons, no overflow,
no separate indicator and successful handoff on four destinations at 360/1440px.
Navigation-link hover/focus now prepares code independently of outstanding API
reads. A controlled probe verified preparation before clicking and while a
four-second synthetic API read was pending, with one shared analytics GET and
no extra GET from hovering. It does not measure the user's live database latency.
