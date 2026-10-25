# Company position-review concept — 25 October 2026

Generated with the built-in ImageGen tool. [View the concept](position-review.png).

Implemented for instructor and admin on 25 October 2026. See the
[implementation and verification notes](../../../knowledge/PLACEMENT_COLLECTION_UI.md#company-position-review).
The user's selected-company screenshot supplies the workflow; the preceding
Companies concept supplies the shared placement styling. Synthetic concept data
is not inserted into the application. The implementation preserves actual
position roster ranks across filters and uses eight students per candidate page,
as requested after the concept was approved.

The concept tightens position navigation, shows shared capacity separately from scoped student records, and turns candidate rows into an aligned comparison of identity, hybrid match, current suggestion and review action. Sample names, IDs, matches, capacity and summary totals are illustrative. Match bar graphics are approximate; any implementation must compute widths from actual values, retain true rank definitions and preserve approved versus provisional seat meanings.

## Exact generation prompt

```text
Use case: ui-mockup.
Create a polished, implementable high-fidelity desktop redesign for the company position-review screen in SkillBridge's instructor OJT Placement Management workspace.
Input image 1 is the exact screen being reimagined: after a company card / Review positions is selected, the instructor chooses a company position and reviews students. Input image 2 is a supporting style reference from the previously approved placement redesign. Match that design language and retain the same application identity, white left sidebar, green active Placements item, slim white workspace header with notification bell/avatar, cool pale-gray canvas, restrained white cards, subtle gray borders, 14px corners and readable compact sans-serif typography. Remove browser chrome and the cut-off/scrolled top in image 1. Show a complete app screen straight-on, landscape approximately 1600 by 1100, crisp text.
Scope: reimagine this selected-company position workspace, not a candidate review modal. Focus the majority of the image on positions and candidate comparison. Keep the existing ability to return to company overview, search, scope by batch, choose position, switch Suggested/Other ranked candidates/Approved, Assign manually and Review candidate. No unrelated analytics, bulk approvals, match generation wizard or new controls.
Header: "OJT Placement Management"; helper "Review placements for your students. Company seats are shared across all batches." Optional small "Sample data" badge visible. Right aligned secondary "Download reports" and "Refresh suggestions". Three compact summary cards matching reference 2: "Students awaiting placement" 18; "Approved placements" 12; "Seats not yet approved" 20 with small "Shared across batches · includes suggested seats". Quiet green-dot status "Suggestions update automatically · Coordinator approval required". Keep this top overview compact.
Tabs "Companies" active; "Awaiting allocation" badge 5; "Decision history". One aligned search/scope toolbar: Search placeholder "Search position, student or school ID…" and "Student scope" dropdown "My batches".
Under toolbar show quiet "← Back to companies", then selected company identity with SC initials/logo tile, "Sample Company", "Davao City", right-side note "Seat counts: all batches · Students: selected scope".
MAIN LAYOUT: intentionally sized left position navigator about 245px wide and right candidate panel filling remaining width. Left has heading "Positions" with count 2; two position cards. Card 1 selected "Backend Developer Intern", small labels "6 total · 1 approved · 2 suggested" and stronger green "3 available for suggestions". Card 2 "Frontend Developer Intern", "4 total · 1 approved · 1 suggested", green "2 available for suggestions". Selected card has pale green surface, 1px green border and clear green side indicator. Use compact white space instead of tall empty panels.
Right panel: heading "Backend Developer Intern" and subdued "Sample Company"; secondary button "Assign manually" with small person-plus icon. Under title show a short capacity overview strip, with explicit labels "6 total seats", "1 approved", "2 suggested", "3 available for suggestions"; optional thin segmented bar with exact proportions (one-sixth approved green, two-sixths suggested blue, three-sixths neutral).
Below capacity put clear sub-tabs: "Suggested (2)", "Other ranked candidates (5)" ACTIVE, and "Approved (1)". Under tab put one readable line "Ranked for this position. Students may already be suggested to another position."
MAIN CANDIDATE COMPARISON: five tidy rows in a semantic-looking table inside the panel, no enormous blank areas. Columns "Rank", "Student", "Hybrid match", "Current suggestion", "Review". Student identity full name, small school ID/course and muted batch, round initials avatars. Score as strong percentage with short proportional bar and appropriate label; >=80 green, 60–79 amber, <60 neutral/rose warning. Current suggestion is its own legible column, may wrap on two lines. Green "Review candidate" buttons aligned in final column, never direct Approve in this list.
Synthetic rows, sorted score descending, with ranks consecutive within Other ranked candidates:
#1 "Amelia Cruz" "QA26-101 · BSIT" "OJT Batch 2026" score "88.40%" helper "Strong match" current suggestion "Frontend Developer Intern" at "Mugna Tech".
#2 "Noah Reyes" "QA26-102 · BSIS" "OJT Batch 2026" score "76.25%" helper "Fair match" current suggestion "Database Intern" at "PixelPrint IT".
#3 "Isabel Santos" "QA26-103 · BSIT" "OJT Batch 2026" score "63.10%" helper "Fair match" current suggestion "IT Support Intern" at "Panabo City Hall".
#4 "Ethan Garcia" "QA26-104 · BSIT" "OJT Batch 2026" score "41.94%" helper "Low match · review carefully" current suggestion "Frontend Developer Intern" at "Sample Company".
#5 "Sofia Lopez" "QA26-105 · BSIS" "OJT Batch 2026" score "35.60%" helper "Low match · review carefully" current suggestion "No current suggestion".
Optional distance in small text within score column only if there is room; no need to invent it.
Footer "Showing 1–5 of 5 candidates". Quiet bottom info note "Match scores support coordinator review. Suggestions reserve provisional seats; approval makes a placement official."
Semantic guardrails: Show consistent numeric capacity. Student match percentages are not company-level scores or approval probabilities. Low scores must not look automatically eligible/ineligible. Other ranked candidates are not yet proposed for this target position. Current suggestion may be elsewhere. Do not invent assessed skill tags, bulk selection, Approve all, drag-and-drop placement, automatic rejection or sending messages. Clear typography and alignment with comfortable spacing, exact text, refined neutral surfaces and restrained existing green brand. Sample values are explicitly illustrative.
```
