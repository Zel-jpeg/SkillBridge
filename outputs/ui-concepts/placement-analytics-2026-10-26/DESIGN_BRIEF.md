# Placement analytics concept — 26 October 2026

Created using the built-in ImageGen tool.
[View the concept](placement-overview.png).
[View the simpler-terminology, Davao City version](placement-overview-v2.png).
Version 2 implemented after approval on 26 October 2026. See the
[implementation notes](../../../knowledge/ANALYTICS_IMPLEMENTATION.md#placement-analysis-and-simpler-terminology--26-october-2026).
The images remain illustrative; application panels use authorized API data.

## Terminology and area-filter refinement

The latest concept uses **selected students** for the report population, **batch**
for a specific enrollment group, and **slots** for position capacity. A future
system-wide copy update should apply these meanings to visible UI and exports,
without renaming API keys or database fields just to change displayed wording.
That application-wide visible-copy replacement was made after approval; stored
batch names and API keys remain unchanged.

Version 2 demonstrates Company area = Davao City. Only four matching position
rows remain, with seven total slots, zero occupied and seven remaining. Panabo
City and Tagum City rows are excluded. The two selected students and their
placement-progress counts remain unchanged. Example totals are illustrative.
Use the project's briefcase/position icons in implementation rather than the
raster image's literal chair symbols beside capacity totals.

The existing analytics API already supports an exact company-area filter and
applies it to company approval comparisons, placement records and shared position
capacity; the frontend already exposes a Company area select. This is verified
by source inspection, not a new application change or live-data test. The design
makes its selected value and effect explicit. Company location is separate from
student residence. Existing selected-student authorization remains in force.

The original no-coding constraint applied during concept creation. The user later
approved implementation of version 2, terminology and the visible area-filter scope.

The two screenshots are references for one placement-analysis section at different
scroll positions. The concept keeps the current SkillBridge visual language while
separating three tasks: selected-cohort student progress, company-filtered approved
placement comparisons, and shared capacity across all batches. Example companies
are synthetic and the numbers are illustrative.

## Meaning and interaction

- Student progress has two selected students: zero approved in this cohort, zero
  approved in another batch, two unplaced. The three status arrows represent
  filtered student-record views, including empty zero-count views. No approve,
  assign or remove action is introduced in analytics.
- Company/position/company-area filters apply to company approval comparisons and
  official shared capacity. They do not change the cohort progress summary.
  Company area remains distinct from student residence. Zero company approvals
  get an explicit empty state instead of fabricated chart bars.
- A single capacity matrix replaces the long chart plus duplicated accordion.
  Six positions at five synthetic companies total 11 configured seats, zero
  occupied, 11 remaining. Occupancy means approved placements across all batches;
  provisional suggestions are not approved occupancy. Remaining report seats are
  not cohort reservations or guarantees of placement suitability.
- Per-row capacity counts are static; they have no misleading drill-down arrows.
  View capacity records opens the existing capacity-record collection. The bottom
  preview shows the active Unplaced student filter and a clear action.

## Future implementation checks

Use actual authorized API counts, retain genuine zeros, support legacy capacity
overruns, provide pagination for longer company/position collections, and preserve
readable mobile layouts, both themes and keyboard/focus behavior. This image does
not establish functioning filters or responsiveness.

Current code keeps `data.students` for cohort totals and a separate
`data.placement_students` collection for company-filtered placement records.
A future implementation must explicitly reconcile cohort-status drill-downs with
company filters: the destination's source, active scope and count must agree.
Do not silently label a company-filtered empty result as all cohort students or
change backend authorization to make counts match. No such behavior was changed
for this visual proposal.

## Exact generation prompt

```text
Use case: ui-mockup.
Create one polished, clear high-fidelity UI/UX redesign concept for the PLACEMENTS analysis section in SkillBridge Reports & Analytics. The two supplied screenshots are the same section at different scroll positions: one shows filters/cohort progress/company approvals and the other shows repeated shared-capacity details. Both are content and brand references, not edit targets. Keep this a visual proposal.
Format: straight-on implementable desktop UI section, approximately1600px wide by1250px tall. Show the entire redesigned section without browser chrome or app sidebar. Pale cool-gray canvas, clean white cards, restrained thin neutral borders,16px corners, dark navy readable compact sans-serif typography and SkillBridge green accents. Refined alignment, balanced whitespace, comfortable controls. No dark theme, glassmorphism, perspective, decorative illustrations, oversized empty charts or new branding.
Top: small breadcrumb "Reports & Analytics / Placements", heading "Placement overview", helper "Track your students and compare shared company seats." Small quiet "Example data" badge. The example uses exactly2 students in the selected cohort, zero approved in this cohort, zero approved in another batch,2 unplaced. Shared company capacity is11 seats, zero occupied,11 remaining across5 companies and6 positions. Student counts and seat counts must stay visibly distinct.
FILTER SURFACE: compact full-width white card titled "Company & capacity filters". Three aligned labeled dropdowns: "Company" "All companies"; "Position" "All positions"; "Company area" "All company areas". Below a concise note "Applies to company approvals and shared seats. Cohort progress stays unchanged." This is critical: these filters do not shrink the cohort placement summary. Company area is not student home address.
NEXT ROW: two balanced panels.
LEFT card titled "Student placement progress", small scope badge "Selected cohort ·2 students". Clear main summary "0 of2" and label "approved in this cohort", small0% badge. Use a slim horizontal distribution strip, all amber for2 unplaced students; omit a large donut or count axis. Three aligned native-looking selectable status rows, each with text, count and right chevron:
"Approved in this cohort" 0, green dot and neutral zero-count surface;
"Approved in another batch" 0, blue dot and neutral zero-count surface;
"Unplaced" 2, amber dot, subtle amber count tile.
Show all zeros explicitly and keep those rows interactive. Short helper "Select a status to filter student records." The rows open students, not seat records. No placement approval or assignment action here.
RIGHT card titled "Approved placements by company". A compact segmented switch "Company" selected and "Company area" unselected reflects the existing comparison toggle. Small scope note "Uses company filters". Because the correct example has zero approvals, show an intentional quiet empty state with a small neutral building/check line icon, heading "No approved placements in this view", text "Company comparisons will appear when placements are approved." Bottom neutral note "Areas refer to company locations, not student residences." Do not fabricate company bars, positive approvals or growth percentages to fill the empty chart. Balance this panel with the cohort card without a giant meaningless plotting area.
LOWER FULL-WIDTH CARD titled "Shared position capacity", badge "All batches · Uses company filters". Short description "Seats are shared across all batches; these totals are not reserved for this cohort."
Header-side three compact clearly labeled totals: "Total seats"11, "Occupied"0, "Remaining"11. Occupied means approved placements. Do not count suggestions as approved occupancy or show remaining seats as assigned students.
A single tidy capacity comparison table replacing the original long horizontal chart PLUS duplicate accordion. No repeated list underneath. Columns "Company / position", "Company area", "Total seats", "Occupied", "Remaining". Group company name bold and position muted beneath, optional small neutral initials tile. Read-only numeric cells: DO NOT put arrows on per-row seat counts, since the existing workflow does not filter student lists by remaining seats.
Use these six entirely synthetic rows:
"Example Systems" / "Database Support Intern" / "Davao City" /2 /0 /2.
"Sample Tech" / "Frontend Web Developer Intern" / "Davao City" /3 /0 /3.
"City Services Office" / "Database Encoder Intern" / "Panabo City" /2 /0 /2.
"Northstar IT" / "Network Specialist Intern" / "Tagum City" /2 /0 /2.
"Sample Company" / "Backend Intern" / "Davao City" /1 /0 /1.
"Sample Company" / "Frontend Developer Intern" / "Davao City" /1 /0 /1.
Numbers align neatly and sum correctly:11configured,0approved/occupied,11remaining. Remaining can use subtle slate/blue tint, not a green success treatment that implies these students have placements. Keep missing/empty values distinct from genuinezero.
Capacity footer: quiet secondary action "View capacity records" with right arrow. This single existing action opens the capacity record table, not a filtered student list or a placement editor. Opposite concise help "Occupied = approved placements across all batches." Small bottom note "Remaining seats may not match every student’s skills or location." Keep the distinction between official report capacity and placement eligibility explicit without a wall of text.
BOTTOM small preview of the existing destination: heading "Student placement records", then a pale-green active-filter banner "Active record filter" / "Unplaced" / "2 matching students", with "Clear record selection". Show the Unplaced2 source status selected with a restrained brand-green outline to connect source and destination. This is a preview of student filtering, not extra sample rows or new analytics modules. No need to render the full student table.
Guardrails: Cohort status buttons, company comparison and capacity are three different tasks with explicit units and scope. Only existing student drill-down rows and the single capacity-record action have arrows. Zero-count drill-downs are still selectable and open empty filtered lists. Company/capacity filters do not reserve seats or change the cohort progress total. Recommendations and provisional suggestions are not approved placements. No invented approval probability, unplaced rejection label, bulk approve, new notifications or fake history/trends. Use concise exact text, clear hierarchy and actual counts. Layout should be easy to stack on mobile when implemented, but this deliverable is a polished desktop concept only.
```
