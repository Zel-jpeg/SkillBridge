# Skills analytics concept — 26 October 2026

Created and refined using the built-in ImageGen tool.
[View the selected concept](skills-insights.png).
Implemented after approval on 26 October 2026 for both staff roles. See the
[implementation notes](../../../knowledge/ANALYTICS_IMPLEMENTATION.md#skills-count-matrix-and-company-match-filters--26-october-2026).
The image remains an illustrative concept. Application panels use authorized
API counts, compact text, responsive layouts and eight-category pagination;
arrow actions open the existing filtered list on the same page. No scoring or
ranking calculations changed.

The two screenshots show the same existing Skills section at different scroll
positions. They provide context and visual references, not additional instructions.
The concept retains SkillBridge's green/white styling while separating category
score evidence from per-student recommendation fit. Its two-student example is
illustrative and contains no personal student identities.

## Design decisions

- One category count matrix replaces the duplicated chart and expanded count list.
  Strong/Fair/Needs work retain the existing 80/60 thresholds. Numbers are student
  counts, not mean category percentages. A student can appear in multiple skill
  rows; each row totals the selected cohort when unavailable results are included.
- Unavailable means missing or locked category evidence, never a zero score. It
  remains a neutral static count because the current UI has no dedicated per-skill
  unavailable-student filter. The three scored-band counts preserve their existing
  drill-down meaning, including zero-count selections.
- Company recommendation fit is a separate panel. Each student appears once using
  their best current match. No current recommendation and Final results locked
  remain separate neutral states. Their display labels map to the existing
  `No current match` and `Locked` groups, rather than changing backend semantics.
- The active-filter preview shows the selected category and score band, plus a
  truthful filtered count and clear action, now implemented through the existing
  records collection. Recommendation fit does not establish placement approval.
- Future implementation should use actual API counts, preserve all categories
  with bounded pagination as needed, retain keyboard/focus access and both themes,
  and provide readable narrow-screen matrix rows/cards. Empty/missing data must
  remain explicit. The raster proposal does not establish responsive behavior.

## Initial generation prompt

```text
Use case: ui-mockup.
Create a polished, implementable high-fidelity redesign concept for the SKILLS analysis section of SkillBridge Reports & Analytics. The two reference screenshots show the SAME section at two scroll positions, not two different screens. Use them as content/workflow and existing-brand references. This is a visual proposal only.
Composition: front-on desktop UI section, landscape approximately 1600x1100, pale cool-gray canvas, two white cards with subtle borders and 16px corners, generous but disciplined spacing, compact readable sans-serif type, dark navy headings, restrained green SkillBridge accents. Remove browser chrome and sidebar to focus on these panels. No perspective, ornamental illustration, glass effects, heavy shadows or new branding.
Top small breadcrumb "Reports & Analytics / Skills"; heading "Skills & recommendation insights"; right small scope chip "2 students in scope". Below a short line "Skill scores and company matches measure different things." The main panels fill the composition, left about 60% width, right40%. Include complete panels, no cutoff content.
The goal is to replace confusing huge bar axes and duplicated accordion lists with a single clear display per metric. Keep actual count meanings, current filters and zero values.
LEFT panel title "Skill results by category"; subtitle "Final skill scores. Numbers below count students, not average scores." Small icon tile and quiet badge "4 categories".
Use a refined compact comparison matrix with skill names in rows and four columns. Header: "Skill category", "Strong", "Fair", "Needs work", "Unavailable". Under each band header a secondary guide: Strong "80% and above"; Fair "60% to below80%"; Needs work "Below60%"; Unavailable "Missing or locked". Use green, amber, rose and neutral gray dots respectively. Put a subtle vertical divider before Unavailable to separate absence of evidence from scored bands. Do not show percentages as if they are student counts.
Exactly four rows with these exact student counts:
Database Management: Strong0, Fair1, Needs work0, Unavailable1.
Networking: Strong0, Fair0, Needs work1, Unavailable1.
Programming: Strong0, Fair0, Needs work1, Unavailable1.
Web Development: Strong1, Fair0, Needs work0, Unavailable1.
Each Strong/Fair/Needs work count is a neat native-looking small button with a restrained colored tint, visible numeral and small right-chevron affordance. Zero counts remain visible and selectable. Use pale neutral understated tint for zero buttons, keeping header dots as the band key. Nonzero Fair1 amber, Needs work1 rose, Strong1 green. Database Management Fair1 is SELECTED with a clear thin brand-green focus/selection border; do not highlight another count. Unavailable counts are neutral static badges, without chevrons, because the current application does not provide a per-skill unavailable-student drill-down. No fake controls.
Rows have soft separators and comfortable spacing. No separate bar chart above and no repeated accordion below; the matrix is the single source of category counts.
Below matrix quiet note "Each row totals2 students. A student may appear in several skill categories." Footer secondary action "View category table" (existing category record view) and short helper "Select a score-band count to view its students." Explicit note "Unavailable is not a zero score." No fabricated overall average, improvement trend, skill ranking, placement eligibility or new scoring rule.
RIGHT panel title "Current company matches"; subtitle "Each student counts once, using their highest current recommendation match." Small line icon tile.
Group1 heading "With a current match" with count badge "1 student".
Three compact horizontal native-looking button rows:
"Strong fit" guide"80% and above" count0;
"Fair fit" guide"60% to below80%" count1;
"Low fit" guide"Below60%" count0.
Use matching green/amber/rose dots, clear numbers and right chevrons. Fair fit1 uses restrained amber tint, NOT a green success bar. No oversized chart axes. All rows selectable, including zero counts.
A divider then group2 heading "Results unavailable" with count badge "1 student". Two neutral clickable button rows:
"No current match" count0 with muted document/search icon and chevron;
"Results locked" count1 with gray lock icon and chevron.
Use neutral gray/soft slate surfaces and text for both rows. Locked must never have a green success bar or appear as a low skill/match score. The two groups together count exactly2 students. Keep the unavailable-group heading plain enough to include either no current recommendation or locked final evidence.
A subtle neutral explanation at bottom: "A company match supports review. Placement still needs approval." No auto-approval buttons and no invented company names/student personal data.
Below BOTH panels show a slim preview of the existing destination, titled "Student competency records". A pale green active-filter banner reads "Active record filter" then "Database Management · Fair" and "1 matching student", with quiet "Clear record selection" button. This previews what clicking the selected count does, not a third analytics panel or extra records. No need to render the full student table/cards.
Design hierarchy should be immediately understandable: left = score evidence by category, right = recommendation fit per student, gray = unavailable evidence. Use visible text and numbers alongside color. Dense enough to avoid excessive scrolling, with buttons/focus-ready affordances and a layout that can stack on mobile. Keep the established SkillBridge visual language and precise numeric consistency. Typography must be crisp and exact.
```

## Targeted refinement prompt

```text
Edit this SkillBridge Skills analytics concept with ONLY three targeted refinements. Preserve all layout, spacing, typography, card sizes, data counts, other text and styling.
1. In the right panel, replace the lower gray group heading "Results unavailable" with "Without a current match". Its badge remains "1 student". This group includes two different situations, so its title must not imply both have missing assessment results.
2. Within that lower group rename "No current match" to "No current recommendation" (count0 unchanged), and rename "Results locked" to "Final results locked" (count1 unchanged). Keep both as neutral gray rows with the current icons and chevrons.
3. In the left matrix, Database Management's "Needs work"0 count button should use the same pale neutral gray surface as the other zero-count buttons, rather than pink. Keep nonzero Needs work1 buttons rose and all numeric counts exactly as shown.
Do not change any other section. Keep the selected Database Management Fair1 button, current-match groups, all existing score thresholds, counts, active record-filter preview and exact numeric consistency. Crisp implementable UI concept, same composition and resolution.
```
