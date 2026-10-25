# Dashboard highlights and student details

Updated 25 October 2026. Initial highlight/student-dialog work was frontend only.
The later approved [analytics implementation](ANALYTICS_IMPLEMENTATION.md) adds a
shared backend read endpoint, role-specific linked summary cards and Reports &
Analytics for both staff roles. No schema/migration or ranking-formula change.

Both admin and instructor dashboards use the shared
[DashboardHighlights](../skillbridge-frontend/src/components/dashboard/DashboardHighlights.jsx)
component, matching the instructor's compact skill-card style: colored badges,
score bars, thin rounded surfaces, green hover feedback and visible keyboard focus.
Both pages show Top matches and Top performers by skill.

## Summary cards

The later [analytics implementation](ANALYTICS_IMPLEMENTATION.md) supersedes the
initial four-card simplification. Admin now has five linked cards: students in
active batches, required complete, awaiting placement review, placement progress
and shared remaining OJT slots. Instructor has four: enrolled students, required
complete, students needing follow-up and placement progress. Both use
[DashboardSummary](../skillbridge-frontend/src/components/dashboard/DashboardSummary.jsx)
with the instructor-style white/dark surfaces and selective color on numbers.
Counts come from one backend-authorized analytics metric contract. Every dashboard
summary link opens its supporting report records. Follow-up queues and admin
pending-approval links are now available through the shared header notification
bell; see [staff notifications](STAFF_NOTIFICATIONS.md).

Required completion stays separate from final evidence and approval. Archived
attempt history does not create a current flag. Shared capacity is never described
as reserved for one batch. See the analytics implementation for scopes, historical
views, filter behavior and verification.

### Instructor summary and leaderboard return — 25 October 2026

The four instructor summary cards implement the user-approved ImageGen concept:
larger metrics, soft icon tiles, subtle full-card report links, and proportional
completion/placement bars. Admin summary cards retain their existing design.
The cards use one column below 560px, two columns below 1280px, then four columns;
light/dark contrast, hover/focus feedback and reduced motion are supported.
Existing backend completion and placement rates remain separate. An earned 0%
renders an empty bar; an unavailable rate does not invent a zero percentage.
The header action group also wraps within a 320px viewport.

Selecting a podium, ranked or pending student now retains the skill leaderboard
underneath the read-only student dialog on both staff dashboards. Closing details
with its close button, Escape or backdrop returns to the same leaderboard search,
page and scroll position and focuses the selected student control. Closing the
leaderboard subsequently returns focus to its dashboard skill card. The existing
native dialog stack and shared body-scroll lock handle modality; no scoring,
ranking, retake, placement or authorization behavior changed.

## Highlights and student details

- Top matches displays up to four students, ordered by their current top position
  match. Selecting one opens the shared read-only student detail dialog, including
  its Recommendations tab.
- A skill card opens the existing full skill leaderboard. Podium cards, ranked
  students and pending students can be selected with a mouse or keyboard to open
  student details. Closing details returns focus to the original skill card.
- Admin student cards and table rows now open the same detail dialog as the
  instructor dashboard. Assessment results, combined evidence, recommendations
  and retake history remain separate tabs. Dashboard dialogs do not grant retakes.
- Highlight rankings use the whole role-scoped dashboard collection, independently
  of the student table's search, status filter and current page. Existing admin-wide
  and instructor active-batch API scopes and cache/SSE refresh remain in use.
- Rankings use server-provided unlocked combined category percentages and current
  recommendations. Locked/missing evidence is excluded; earned zero remains zero.
  No category aggregation or recommendation recalculation runs in the browser.
  Equal scores use name and ID to keep card and leaderboard ordering consistent.

The existing admin dashboard API omits batch names and placement decisions. Its
student dialog points to Batches/Placements for those details rather than inferring
an enrollment or an unplaced status. Existing instructor placement data is retained.
Skill leaderboards and admin student details load on demand. Mobile header actions
wrap within the viewport.

## Verification

### Summary cards, nested profiles and notification bell — 25 October 2026

Final checks pass: frontend lint, production build, all 217 Node tests, 15
dashboard browser groups and 34 dedicated leaderboard groups. The dashboard
matrix covers both staff roles at 320, 375, 768, 1024, 1366 and 1920px in
light/dark mode. It verifies the 1/2/4-column instructor summary, exact supplied
rates, empty denominators, zero placement progress, and actual navigation from
all four summary cards. Nested-profile checks cover podium/ranked/pending entry,
close-button/Escape/backdrop dismissal, retained search/page/scroll, focus return
and the parent scroll lock. Notification checks cover shared request deduplication,
scoped reminder links, group-count badges, profile-menu coordination, keyboard
closure, popup bounds, empty data and failed-request retry recovery.

The revised dedicated leaderboard fixture also keeps its parent mounted during
all three student selection paths. No live API writes occurred; fixture records
are synthetic. Backend/database tests, production services and physical devices
were not exercised for these frontend changes. Reviewed previews are in
`work/dashboard-ui/` (`instructor-summary-desktop.png`,
`instructor-cards-375-dark.png`, `instructor-notifications-375-light.png`).

Commands from `skillbridge-frontend`:

```powershell
npm run lint
npm run build
node --test
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5197 --strictPort" --port 5197 -- python -u tests/dashboard_highlights_playwright.py
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5197 --strictPort" --port 5197 -- python -u tests/skill_leaderboard_playwright.py
```

### Skill leaderboard update — 25 October 2026

Implemented the approved [populated modal concept](../outputs/ui-concepts/skill-leaderboard-2026-10-25/leaderboard-populated.png) on UI-update-instructor-admin. The dashboard layout and existing API scopes are unchanged. The modal uses the existing normalized student records, not generated design data. The design-only sample-data.json was deleted at the user's explicit request and its link removed from the concept brief.

- Header: category, honest dashboard/batch context, total/ranked/pending counts and a separate count when other scoped students lack a current unlocked category score.
- Top three: the user's original vertical student-card style is retained, with an avatar/photo, full name, course, precise category score and score bar. First place has a larger gold card, larger avatar/score and stronger border; second/third have slightly smaller silver/bronze cards. Desktop keeps the 2/1/3 arrangement; phones center first place above a row containing second and third. IDs remain available to assistive technology and in student details; remaining ranking rows display IDs visibly.
- Remaining rankings: original global rank numbers, name/ID/course search and five records per page using the shared Pagination component. Filtering resets the page; live count reductions clamp it without returning to an obsolete page after regrowth. The global podium stays unchanged by this explicitly scoped search.
- Pending: readable separate student buttons with no numeric score or rank. Groups over five records gain independent search and pagination. Pending students stay available even when no assessed results exist.
- Interaction: podium, ranked rows and pending entries open existing read-only student details. Native dialog focus trapping, Escape/backdrop handling, body-scroll locking and focus restoration are retained. Header and footer stay outside the independently scrolling body; keyboard focus and hover feedback are visible in light/dark mode.
- Shared pagination adds an optional summary override for original-rank ranges and aria-current for the selected page. Default rendering and page behavior remain unchanged elsewhere.

Ranking eligibility, deterministic name/ID tie ordering and score precision are preserved. No browser-side score aggregation, new backend request, role action, dependency, migration or placement/ranking rule was added. The production modal has no sample-data badge or synthetic records.

Verification for this update: all 208 frontend Node tests passed. The final vertical-card pass passes lint, production build, all 34 dedicated leaderboard browser groups and all 12 mocked dashboard groups, with no page errors. The dedicated synthetic fixture covers 24 students without depending on the deleted JSON. Its browser matrix covers 320–1920px widths, 812x375 landscape, light/dark layouts, fixed controls/body scrolling, search/paging, live shrinking/regrowth, pending-only/empty/one/two/zero/tied/locked/missing/long-name states, three student-selection paths, hover, keyboard focus and Escape. It also checks distinct medal surfaces, vertical card layout and larger first-place geometry at every viewport. The existing dashboard groups cover both staff roles, including read-only details and return focus. Visually reviewed implementation previews: [desktop](../outputs/ui-concepts/skill-leaderboard-2026-10-25/implemented-vertical-cards-desktop.png) and [mobile](../outputs/ui-concepts/skill-leaderboard-2026-10-25/implemented-vertical-cards-mobile.png). Live services, physical devices and screen readers were not tested; backend/database tests were not run for this frontend-only change.

Commands from skillbridge-frontend:

```powershell
& 'C:/Program Files/nodejs/npm.cmd' run lint
& 'C:/Program Files/nodejs/npm.cmd' run build
node --test
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5197 --strictPort" --port 5197 -- python -u -c "import runpy; runpy.run_path('tests/skill_leaderboard_playwright.py', run_name='__main__'); runpy.run_path('tests/dashboard_highlights_playwright.py', run_name='__main__')"
```

Browser checks use installed headless Chrome and local socket access outside the restricted sandbox. Detailed results and synthetic screenshots are in tests/artifacts/skill-leaderboard/ and work/dashboard-ui/. The following verification describes the earlier dashboard implementation.

- Frontend lint and production build passed; all 135 frontend unit tests passed.
- [Dashboard data tests](../skillbridge-frontend/src/utils/dashboardStudents.test.mjs)
  cover shared response normalization, locked/stale evidence, missing versus zero
  scores, stable ordering and preservation of individual assessment history.
- [Synthetic browser checks](../skillbridge-frontend/tests/dashboard_highlights_playwright.py)
  intercept every API request and block external traffic. Twelve passing check
  groups cover both roles' linked summary cards, completion/placement/review units,
  match/skill/student interactions, keyboard focus, read-only details, empty/failure
  states and light/dark layouts at 375, 768 and 1366 pixels. Completed required work
  with locked recommendations and summary API failure are checked explicitly.
  Screenshots and check results are local ignored artifacts in `work/dashboard-ui/`.

Run the browser script using the backend's existing Python environment with
Playwright and Chrome installed, while Vite listens on `127.0.0.1:5197`:

```powershell
.\skillbridge-backend\venv\Scripts\python.exe skillbridge-frontend/tests/dashboard_highlights_playwright.py
```

An alternative local Vite origin can be supplied through `DASHBOARD_TEST_URL`.
These are synthetic frontend checks; no application database is accessed and no
live deployment is verified.
