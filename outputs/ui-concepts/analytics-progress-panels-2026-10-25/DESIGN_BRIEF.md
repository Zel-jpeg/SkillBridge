# Analytics progress panels — 25 October 2026

Visual proposal generated with the built-in ImageGen tool.
[View the concept](progress-panels.png).
Implemented on 25 October 2026 for both staff roles. See the
[implementation and verification notes](../../../knowledge/ANALYTICS_IMPLEMENTATION.md#required-completion-and-attempt-panels--25-october-2026).
The image remains an illustrative concept; application panels use authorized
API data and compact 12px ordinary text, with four-row panel pagination and
responsive light/dark layouts. No scoring or API calculations changed.

The reference supplies the two chart panels and example counts. The concept
replaces oversized single-row chart axes and duplicated disclosure containers
with explicit counts, proportional tracks and direct drill-down controls.
Required completion remains distinct from current per-assessment attempt states.
The example has two students: one complete, one remaining; the assessment has
one valid submission, one not started and zero in progress/stopped. All four
attempt states retain explicit counts and selectable student filters.

This example shows one batch and one assessment. An implementation must retain
every authorized batch/assessment in scope, use actual per-row denominators and
provide bounded lists/pagination for larger scopes, as the implementation does. An aggregate attempt summary
across multiple assessments must count student-assessment assignments, not claim
to count distinct students. Empty scopes have unavailable rates rather than a
fabricated zero completion rate. Stacking on mobile and keyboard/focus behavior
remain implementation requirements, not functionality established by this image.

## Exact generation prompt

```text
Use case: ui-mockup.
Asset: high-fidelity, implementable UI/UX redesign concept of ONLY the TWO chart panels shown in the reference image, from SkillBridge Reports & Analytics. Reference image 1 supplies the original section, brand styling, features and exact example counts. It is a visual reference, not an edit target.
Generate a crisp front-on landscape UI mockup, approximately 1500 by 850 pixels. Show only this analytics section on a very pale cool-gray canvas, with two balanced white cards side by side, 24px gap, subtle neutral borders, 16px corners. No app sidebar, browser chrome, full dashboard, unrelated summaries, or decorative illustration. Keep SkillBridge's restrained green brand, compact readable sans-serif type, dark navy headings, muted slate secondary text, refined spacing. Improve information hierarchy and eliminate the tall empty chart space and repeated count-list containers in the original. Show finished real product UI, no annotations, arrows between screens or explanatory presentation labels.
Small top context line "ASSESSMENT PROGRESS", with "Example scope · 2 students" quietly aligned right. Below use the two cards as the main content.
LEFT CARD:
Header exact title "Required completion by batch" with a restrained green line-icon tile. Description "Students who completed all required assessments in each batch."
A clear summary row: large "50%" with label "required work complete"; right small neutral badge "1 batch". This is the example scope's actual required completion, not a grade.
One integrated batch row on a lightly tinted neutral inset surface:
"BSIT · Batch 2026" at left, "1 of 2 complete" at right.
Below a horizontal progress track filled exactly 50% in green, remaining 50% pale neutral, modest 10px height, rounded ends. Do not show a chart axis with 0,1,2 or lots of dotted grid lines; the denominator and proportion are explicit.
Below track compact text "50% complete" and "1 student remaining". Do not use score-band red/yellow colors on required completion.
Below use two quiet count cells: "Completed" 1 with green dot, "Remaining" 1 with slate dot. They summarize required completion, not attempt status.
At the bottom a full-width quiet green-outline native-looking action "View batch students" with right chevron. Short helper "Opens the students in this batch." This batch action shows all batch students, not an invented pending-only approval action.
RIGHT CARD:
Header exact title "Assessment attempt status" with restrained document/check line-icon tile. Description "Current attempt states for each assigned assessment."
A clear summary row: large "1 of 2" with label "valid submitted"; right small neutral badge "1 assessment". Do NOT claim1of2 submitted is a cohort placement rate or final-evidence availability.
Assessment identity "OJT Skills Assessment" and muted "2 students assigned".
A 100% stacked bar with exactly equal halves: green 50% representing1 valid submitted and slate50% representing1 not started. No blue or rose segment because those counts arezero; no gradients that distort proportions.
Below a tidy2 by2 grid of four native-looking clickable status tiles, each with colored dot, clear label, bold numeric count and small right chevron:
"Valid submitted" 1 green
"In progress" 0 blue
"Not started" 1 slate
"Stopped / flagged" 0 rose
Show zeros as explicit0, never hide zero categories and never imply they are errors. Keep all four tiles appearing interactive includingzeros, since they open filtered student records. The status labels/numbers provide meaning alongside color.
Bottom quiet helper "Select a status to view its students." No separate accordion duplicating the entire chart, no long paragraphs, no extra View All that changes meaning. This is a reorganization of existing count/drill-down access.
Alignment: both cards have equal top/bottom edges and comfortable internal grouping. Comparison should be easy at a glance: left tells who finished ALL required work, right tells CURRENT per-assessment attempts. Do not conflate these metrics, final combined results, recommendations or approved placements. Keep percentages, counts and bars numerically consistent. Text must be legible and exact, with clear hover/focus-ready button affordances that could stack naturally on a phone. Green used for brand actions and valid/completed states; blue/slate/rose only for their matching attempt states. Avoid oversized donut charts, excessive shadows, neon borders, glassmorphism, fake growth statistics, confetti and sample student personal information.
```
