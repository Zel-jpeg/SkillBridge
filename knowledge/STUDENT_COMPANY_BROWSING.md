# Student company browsing

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
