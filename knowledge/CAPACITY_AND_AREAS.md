# Agency capacity and company-area placement counts

28 October scope correction: current Approved allocations consume shared slots
only in active batches where the student remains enrolled. Detached legacy approvals
stay reserved for staff review. Archive/transfer releases the allocation while
preserving the decision; no internship completion is tracked. Reactivation checks
capacity and retired openings. See [the corrected policy](OJT_CYCLE_SCOPE_REVIEW.md).

Terminology update, 26 October 2026: application labels, report exports and current
API messages now use **slots** for position capacity and **batch / selected
students** instead of cohort. Earlier references below retain their original
wording. Capacity meanings and API field names are unchanged. The analytics
placement section now has a paginated shared-slots table and a clear Company area
filter chip; see [implementation notes](ANALYTICS_IMPLEMENTATION.md).

The user confirmed on 18 October 2026 that the outline-defense panel meant:

- Agency demand is configured position capacity. Five seats minus one approved
  assignment leaves four seats. Sum positions for company capacity.
- Deployed students in an area are approved assignments at companies in that
  area. Three approved at company A and three at company B in Davao City mean
  six deployed students in Davao City.
- Resident students and unplaced residents use student addresses. Company,
  deployment and capacity counts use company addresses. They are separate metrics.
  Analytics groups by city, then province, then `Unknown Area`.

There is no separate quota or demand target. Suggested, rejected and removed
placement history consumes no seats. Capacity is shared across batches; a report
filter does not reserve separate seats. Placement management already shows total,
approved and remaining capacity for both company and position. Report records
show each position's current remaining capacity. Admin analytics is system-wide;
instructor placement management/reports retain their student/batch permissions.

Admin analytics now labels resident, deployed and unplaced-resident columns
explicitly. Placement report filters and export filter descriptions say company
area. Empty/legacy addresses remain `Unknown Area`; this change does not invent
geographic coordinates or repair real data.

## Verification

`api.test_capacity_areas` uses six synthetic students whose home city is Tagum,
two companies in Davao City and five seats per company. Real approval APIs verify
5−1=4; 3+3=6 deployed in Davao City; 10 total seats−6 approvals=4 free; Tagum
retains six residents and zero deployed there. Both staff roles see the correct
remaining seats. Removed/rejected/suggested history consumes none, reports agree,
and students are denied staff reports. These three tests and `api.tests` passed
24/24 on disposable localhost PostgreSQL and separately on SQLite.

`tests/capacity_areas_playwright.py` verifies the actual company badges, report
filter and area table with synthetic API responses. Two cases passed with no
page errors after restarting the local Vite test server following a load stall.
No live placements, imports, messages or Supabase records were changed.

Evidence: `work/defense_audit/p03-{before,postgres,browser-restart,lint,build}.txt`
and `skillbridge-frontend/tests/artifacts/capacity-areas/`.

## Shared suggested placements

Staff placement pages also show active suggested seats and provisional availability.
Only flagged active suggestions reduce provisional headroom; official remaining
capacity and report totals still subtract approved placements only. Alternatives
reserve nothing. These suggestions reuse `OJTPlacement`; no separate draft tables
are added. See [the implementation contract](PLACEMENT_DRAFT_IMPLEMENTATION.md).
