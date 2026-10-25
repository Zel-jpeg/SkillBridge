# Placement terminology and area-filter refinement

Created using the built-in ImageGen tool on 26 October 2026.
[Selected image](placement-overview-v2.png). Application code is unchanged.

```text
Refine the attached SkillBridge placement analytics concept to use the user's simpler terminology and demonstrate a selected company-area filter. Preserve the clean white/green interface, typography, panel structure and controls. This is a visual proposal, not a coded interface.
Required terminology: remove EVERY occurrence of "cohort" and use the actual batch name or "selected students" as appropriate. Replace every "seat"/"seats" with "slot"/"slots". Keep "batch" for an actual student batch. Do not alter approval/capacity meanings.
Demonstrate the filter: in Company & capacity filters set Company area to "Davao City". Company remains "All companies", Position remains "All positions". The filter note reads "Filters company approvals and shared slots. Student progress uses the selected batches."
The student progress example still has2 students,0 approved,0 approved in another batch,2 unplaced. Replace the old Selected cohort chip with "Test Batch · 2 students". Main summary remains0 of2, label "approved in this batch",0%. Its status rows read "Approved in this batch"0, "Approved in another batch"0, "Unplaced"2. All source arrows stay, Unplaced remains selected. Company location filtering does not shrink the selected student count.
The right card remains an honest zero-approval empty state titled "Approved placements by company", with Company / Company area comparison switch. Its scope note becomes "Company area: Davao City". Text "No approved placements in this view". Keep company location distinct from student residence.
Capacity section heading "Shared position slots"; scope badge "All batches · Davao City". Subtitle "Company slots are shared across all batches." Add a visible small active-filter chip "Company area: Davao City" beside the table heading or above the rows, optionally with a small clear-x affordance. This filter controls the company/position table, not the students' home addresses.
The capacity table must now contain ONLY FOUR Davao City rows, not all six original rows:
Example Systems / Database Support Intern / Davao City / total2 / occupied0 / remaining2.
Sample Tech / Frontend Web Developer Intern / Davao City / total3 / occupied0 / remaining3.
Sample Company / Backend Intern / Davao City / total1 / occupied0 / remaining1.
Sample Company / Frontend Developer Intern / Davao City / total1 / occupied0 / remaining1.
REMOVE City Services Office / Panabo City and Northstar IT / Tagum City entirely because they do not match Davao City.
Update header totals to "Total slots"7, "Occupied"0, "Remaining"7. All numbers must agree with the four visible rows. Table headers: "Company / position", "Company area", "Total slots", "Occupied", "Remaining". Keep capacity cells read-only with no per-row arrows.
Footer existing action "View capacity records" unchanged. Notes "Occupied = approved placements across all batches." and "Remaining slots may not match every student's skills or location."
Top subtitle uses "shared company slots" instead of seats. Preserve the Example data badge. Remove the very bottom Student placement records preview so this version focuses on the company-area-filtered company/position table and avoids implying that student home areas are being filtered. Rebalance vertical spacing without adding new sections. No other data changes, no fabricated approvals, no new student identities, no "cohort" or "seat" text anywhere. Crisp straight-on polished implementable desktop concept.
```
