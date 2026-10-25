# Instructor dashboard concepts

Created 25 October 2026 with the built-in imagegen tool, based on the user's dashboard screenshot. These are visual concepts only; application code was not changed.

## Deliverables

- [Desktop dashboard](desktop.png)
- [Mobile dashboard](mobile.png)

## Design decisions

- Use the available desktop width to bring one top match alongside a compact four-row skill leaderboard, rather than reserving empty grid columns.
- Keep four distinct operational metrics: enrollment, required completion, actionable follow-up and approved placement progress.
- Give the student roster readable labels, a clear search/filter toolbar and one primary page action.
- Retain green branding with restrained status colors. Distinguish category percentages, the existing overall category average and recommendation fit.
- On mobile, show metrics in a 2x2 grid, replace roster rows with labeled cards, and move highlights into expandable sections beneath the roster.
- Use synthetic students, initials, IDs and company names instead of personal information from the screenshot.

## Review and limits

Both generated outputs were visually inspected for hierarchy, legibility and content consistency. The counts and score meanings follow the reference scenario. These static images do not verify implementation, live data, interactive states, responsive CSS or keyboard behavior. No application build or database tests were needed.

## Submitted generation prompts

### Desktop

Use case: ui-mockup.
Asset type: high-fidelity desktop instructor dashboard redesign for SkillBridge, an academic OJT placement decision-support application.
Primary request: Reimagine the attached existing instructor dashboard with markedly better UI hierarchy, space use and scannability. Generate ONE finished, crisp front-facing UI screenshot, approximately 1800x1200, not a device photograph or design board. The supplied reference image is the current dashboard and supplies workflow/content. Use the established clean white surfaces, neutral sans-serif typography and forest-green visual language described below.
Style: polished implementable academic operations software. White sidebar and content cards on very pale cool-gray background; forest green #08783F primary action and selection; deep slate headings, readable secondary text; amber for pending/unplaced states. Thin gray borders, 12–14px corner radius, restrained shadows, generous but purposeful spacing, modern neutral sans-serif, consistent small outline icons. Compact readable body text with stronger headings; avoid tiny low-contrast text. No gradient, glass, decorative charts, photos, orange/pink/purple score rainbow, giant welcome banner or misleading growth trends.
Layout: 210px left sidebar; small unobtrusive horizontal top bar; full available-width main content with about 32px margins, no excessive centered gutters. Everything through the two-row roster is visible in the screenshot. Exclude browser chrome, desktop taskbar and address bar.
Sidebar: SkillBridge brand and small "Instructor" label at top. Navigation exactly "Dashboard" selected with pale green fill and green icon, "Students", "Assessments", "New Assessment", "Companies", "Placements", "Reports & Analytics". Bottom "Collapse sidebar". Top bar left "Instructor workspace", right small initials avatar "JC" and name "Jamie Cruz".
Main header: small breadcrumb "Workspace / Dashboard", title "Student performance", subtitle "BSIT / BSIS · OJT Batch 2026". Right actions a white outline "Enroll students" and solid forest green "+ New assessment". Keep one obvious primary action.
First row: four equal restrained metric cards, each with a small outline icon, large readable number and muted explanation; small right chevron indicates a link to supporting records. Exact metrics: "Enrolled students" = "2", subtitle "Students in the active batch"; "Required complete" = "1", subtitle "50% of students in scope", slim 50% green completion bar; "Students needing follow-up" = "0", subtitle "No actionable issues in this scope"; "Placement progress" = "0 / 2", subtitle "2 students unplaced", neutral empty progress track. Do not invent metrics, assume pending is an issue, or equate completion with placement approval.
Next row: balanced two-column section, left about 38%, right 62%; both panels similar height. This fixes the empty space beside the original lone Top match card.
LEFT panel: title "Top matches", small count "1 student"; a neatly laid-out single recommendation. Circular initials avatar AR, student "Alex Rivera", small "BSIT · 2023-00124". Position "Frontend Web Developer Intern"; company "Sample Tech". Prominent right-aligned "73.45%" with label "Hybrid match" and small information icon; horizontal forest-green fit bar 73.45% of neutral track. Subtle footer link "View student recommendations →". Quiet note "Match scores support review; placement needs approval." No trophy, approval badge or success probability.
RIGHT panel: title "Top performers by skill", supporting "Select a category to view its ranking." A clean compact four-row leaderboard, NOT four oversized separate cards. Table headings "Skill category", "Leading student", "Score". Rows: "Web Development" / "Alex Rivera" / "100%"; "Database Management" / "Alex Rivera" / "66.67%"; "Networking" / "Alex Rivera" / "50%"; "Programming" / "Alex Rivera" / "50%". Each row has a subtle proportionate green bar behind or next to the score, plus right chevron for viewing the full skill ranking. Category percentages and hybrid matches are different measures; no categorical pass/fail labels.
Bottom prominent full-width white roster surface: heading "All students" with neutral "2 students" count. Properly spaced toolbar: search input "Search by name or ID…", labeled status segmented filters "All" selected green, "Completed", "Pending"; quiet icon switch for Cards and List with List selected. Controls align and do not crowd the heading.
Readable table headers: "Student", "Assessment status", "Placement", "Strongest category", "Top recommendation", "Overall" with info icon. Row 1: initials AR, "Alex Rivera" / "2023-00124 · BSIT"; green pill "Completed"; amber pill "Unplaced"; "Web Development" / "100%"; "Frontend Web Developer Intern" / "Sample Tech · 73.45% match"; overall "67%". Row 2: initials ML, "Morgan Lee" / "2023-00125 · BSIT"; amber pill "Pending"; amber pill "Unplaced"; muted "Not assessed"; em dash top recommendation and em dash overall. Rows have generous vertical padding and right-side subtle view chevron, no more duplicate badges or crammed tag lists. Quiet footer "Showing 2 of 2 students" with no unnecessary pagination controls. Small explanatory note below table "Overall: mean of assessed category percentages. Match: recommendation fit." Do not label overall score as combined raw/max score.
Constraints: use only these synthetic names/IDs/company and initials instead of real student faces. Preserve the existing instructor navigation and workflows. No new notifications, unverified timestamps, live indicator, slot counts, fake graphs, percentage-change trends or other invented operational data. All content sharp, well-spelled and aligned. Output just the finished UI screenshot.

### Mobile

Use case: ui-mockup.
Create ONE polished mobile adaptation of the supplied redesigned SkillBridge instructor dashboard. Output a sharp tall portrait full-page mobile UI screenshot, roughly 1024x2048. This is a vertically scrollable page captured in full, with a layout designed for approximately 390–430 CSS pixels wide and enlarged for viewing. No phone device frame, browser chrome, screenshot annotations or surrounding desktop layout.
Match the reference precisely in visual style: forest green #08783F, pale cool-gray page background, white surfaces, near-black sans-serif headings, slate supporting text, thin gray borders, 12px corners, compact consistent outline icons, initials avatars, amber pending/unplaced badges. Prioritize readable type and at least 44px touch controls. Preserve the same synthetic data and same meaning of every score/count. Do not shrink desktop tables onto the phone.
Mobile composition and hierarchy:
1. Compact white top bar, hamburger menu at left beside SkillBridge wordmark, circular JC avatar right. No permanent sidebar.
2. Heading "Student performance", small context "BSIT / BSIS · OJT Batch 2026". Two equal clearly tappable actions on the next row: outlined "Enroll students" and solid-green "+ New assessment".
3. Four summary cards in a 2x2 grid, not a horizontal carousel. Exact labels/numbers: "Enrolled students" "2" / "Active batch"; "Required complete" "1" / "50% of students" with small 50% green bar; "Students needing follow-up" "0" / "No actionable issues"; "Placement progress" "0 / 2" / "2 unplaced" with neutral 0% track. Use restrained outline icons and small chevrons. Don't suggest pending automatically means an actionable issue or completed means placed.
4. Prioritize the roster next. Header "All students" with small count "2 students". Full-width search "Search by name or ID…". Status filter row "All" selected green, "Completed", "Pending". Use single-column student cards instead of a horizontally overflowing table.
First student card: circular AR initials and "Alex Rivera", secondary "2023-00124 · BSIT", small right chevron opening profile. Separate labeled pairs: "Assessment" with green "Completed" badge; "Placement" with amber "Unplaced" badge. A quiet divider. "Strongest category" → "Web Development · 100%". "Top recommendation" → "Frontend Web Developer Intern", then "Sample Tech · 73.45% match". "Overall" → "67%". Keep short labels muted and actual values strong; clear spacing, no nested grid of mini cards.
Second student card: circular ML initials and "Morgan Lee", secondary "2023-00125 · BSIT", right chevron. "Assessment" with amber "Pending"; "Placement" with amber "Unplaced". Supporting "Not assessed yet" and "No recommendation available". Do not show a zero score for missing evidence.
5. Below roster, heading "Highlights", then two compact collapsed disclosure rows with chevrons: "Top matches" with count "1 student"; "Top performers by skill" with count "4 categories". These retain access to the desktop highlight content through progressive disclosure without pushing the roster far down the mobile page. Do not show expanded highlight tables on this mobile concept.
6. Quiet footer text "Showing 2 of 2 students". Small note "Overall: category average. Match: recommendation fit." No unnecessary pagination or bottom navigation.
Constraints: same dataset as the desktop reference, all names synthetic. No real faces, new metrics, fake trend charts, notifications, capacity, dates, approval controls or success-probability claims. Clear tap targets and no sideways scrolling. Balance whitespace for a usable operational dashboard. Output the UI screenshot only.
