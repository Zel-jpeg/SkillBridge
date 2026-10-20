# Dashboard highlights and student details

Updated 20 October 2026. Initial highlight/student-dialog work was frontend only.
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
summary link opens its supporting report records. Attention queues and admin
pending-approval links supplement the cards.

Required completion stays separate from final evidence and approval. Archived
attempt history does not create a current flag. Shared capacity is never described
as reserved for one batch. See the analytics implementation for scopes, historical
views, filter behavior and verification.

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
