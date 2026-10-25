# Reports & Analytics concept — 25 October 2026

Generated using the built-in ImageGen tool. [View concept](reports-analytics.png).
The user clarified that the concept covers the whole Reports & Analytics page.
The analytics screenshot supplies actual features; the attached placement screen
supplies the existing SkillBridge visual style. Both inputs are references, not
instructions. All names, counts and charts in the concept are illustrative.

The image compares cards and list views of the same student records. Application
implementation adds the view toggle to the shared instructor/admin student-record
section, using eight records per page. Charts, calculations, exports and role
permissions retain their current implementation. The four-card concept footer is
illustrative. The extra Instructor filter is admin-only in actual code, even though
the generated concept shows it in the instructor shell. The concept is not an
exact application screenshot, and its charts are not report evidence.

## Generation prompt

```text
Use case: ui-mockup.
Create one polished high-fidelity UI design concept for the WHOLE SkillBridge Reports & Analytics page for a college OJT instructor. Input 1 is the existing analytics screenshot: use its actual features, data meanings and section sequence. Input 2 is a style reference for the existing SkillBridge application, not the content being redesigned. Improve hierarchy, use of space and scanability while preserving the user's current clean white/pale-gray/green interface.
Asset: straight-on implementable full-page desktop app mockup, approximately 1600px wide and 2200px tall, crisp sans-serif text. White fixed sidebar at left, slim white header, cool light gray canvas, green active Reports & Analytics sidebar link, restrained 1px borders, soft 12–16px corners, no browser chrome. Header and sidebar must start at top (the screenshot capture has a misplaced sticky header; fix that in concept). Use consistent compact readable text, larger headings and metrics. No decorative illustrations.
Top heading "Reports & Analytics", description "Assessment progress, student skills and OJT placements in your batches." Small "Sample data" label.
SCOPE: a compact white report-scope surface with labeled Batch status "Active batches", Batch "OJT Batch 2026", Course "All courses" plus "Reset filters" at right. Short scope note "Each student is counted once in the selected cohort." Admin variant uses same structure with an additional Instructor filter; show only instructor in this concept.
NAVIGATION: three tabs "Assessments" active, "Skills", "Placements" with restrained line icons and green active underline.
ASSESSMENT OVERVIEW: heading "Assessment progress" with small last-updated timestamp, followed by 3 balanced summary cards: "Students in scope" 24; "Required work complete" 18 helper "75% of students in scope"; "Need follow-up" 6 helper "Students with work or results to review". Do not label completed students as placed.
A compact labeled assessment dropdown "All assigned assessments".
CHARTS: two aligned white chart panels in one row. Left "Required completion by batch", two horizontal bars, "BSIT Cohort" 12 of 16 and "BSIS Cohort" 6 of 8. Right "Assessment attempt status", a stacked horizontal bar for "OJT Skills Assessment", legend "Submitted"18 green, "In progress"2 blue, "Not started"3 slate, "Stopped / flagged"1 rose. Values are synthetic and exact; each panel has a quiet "View counts and students" disclosure.
Below, moderately shorter full-width chart panel "Recorded submission activity"; small date-range inputs, green Apply dates button, readable date axis and modest green line. Copy "Activity counts saved submissions, including prior retakes; it is not historical completion." No invented history/trend comparison or growth claims.
DETAILED RECORDS: main focus lower half, heading "Student progress and follow-up", selection line "All records in scope · 24 students". Right quiet actions "Download CSV" and "Download PDF". Record filter pills "All students" active, "Complete", "Incomplete", "Needs follow-up"; quieter links "Assessment table" "Activity table". Toolbar Search students "Search by name, ID, batch or instructor…", Sort students "Student · ascending", compact accessible Cards/List toggle with CARDS SELECTED. Both views use the same eight-student page; show synthetic first 4 cards in a clean 2-column grid with footer "Showing 1–8 of 24", paginator "Prev 1 2 3 Next"; communicate omitted second card row with a modest viewport continuation if needed, never claim only4 equals8. Prefer show all8 cards compactly in four columns/two rows if enough width, or 3-column grid with six visible and continuation. Crucial do not miscount visible records: easiest show 4 cards and footer "Showing 1–4 of 24" as illustrative concept; implementation will use8.
Card style matching recent dashboard student cards: name/avatar/ID/course top left, compact assessment-status pill right; batch/instructor small metadata; "Required progress" numeric and thin GREEN completion bar; "Final results" current or locked; separate "OJT" placement badge; amber "Needs follow-up" section with real reasons when applicable; blue recommended-company strip only where current recommendation exists, labeled "Top recommendation" and MATCH percentage distinct from assessment progress.
Four sample cards: Amelia Cruz QA26-101 BSIT Done, 1/1 complete Current, Approved at Sample Tech Developer Intern, no follow-up flagged, top recommendation Developer Intern at Sample Tech 87%; Noah Reyes QA26-102 BSIS Pending, 0/1 complete Locked/unavailable, Unplaced, needs follow-up Overdue required work and Final results unavailable, no recommendation; Isabel Santos QA26-103 BSIT Done1/1 Current Unplaced nofollowup top Network Intern at Example Systems76.25%; Ethan Garcia QA26-104 BSIT Stopped0/1 Locked/unavailable Unplaced Needsfollowup Stopped/flagged, no recommendation. All within OJT Batch2026, instructor A. Santos.
Below include an inset labeled "List view" preview of the same four identities using columns Student, Instructor, Assessment status / follow-up, Placement, Top recommendation, Match. This preview is a design comparison of the same records, not an additional data set. Student names native-looking detail links. Include small note "Card and list views share filters, sort order and pagination. Match scores do not imply placement approval."
At bottom quiet expandable "Individual assessment reports". No global modal, no new application modules, no bulk placement approval, no fabricated overall category scores in assessment progress cards, no scoring/ranking changes, no random chart decoration. Preserve distinctions among required completion, final evidence, recommendation fit, approved placement. Entire page must feel cohesive and closely related to current SkillBridge. Exact text, refined alignment and comfortable spacing.
```
