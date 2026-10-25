# Current dashboard UI refinement

Created 25 October 2026 with the built-in imagegen tool.

The user clarified that the existing dashboard UI should be retained. This concept supersedes the earlier structural redesign as the current visual direction. It preserves the sidebar, blue/green header actions, four summary cards, separate Top matches and Top performers by skill sections, individual colored skill cards and the existing student table/toolbar. Improvements are limited to typography, contrast, alignment, spacing, consistent surfaces and hover affordances. Synthetic identities replace personal data.

[Refined concept](current-ui-refined.png)

Visually reviewed against the original screenshot. This is a static visual concept; application code and interactive behavior were not changed or tested.

## Submitted prompt

Use case: ui-mockup.
Primary request: Make a restrained visual refinement of the CURRENT SkillBridge instructor dashboard in the supplied screenshot. The user explicitly wants to KEEP THE CURRENT UI. This is polish of the same screen, not a new layout or new product visual system. Output ONE crisp, high-fidelity desktop UI screenshot, approximately 1600x1200, straight-on with no device frame or browser chrome.
Reference: the attached screenshot is the source of truth for layout, navigation, components, section order and colors. Preserve its recognizable appearance. Use synthetic student identities only.
MUST PRESERVE:
- White left sidebar, approximately 220px wide, pale-gray content background, thin dividing lines, compact top bar "Instructor workspace" with a small initial avatar at right.
- SkillBridge branding and green icon, subtitle "Instructor". Sidebar nav in the same order: Dashboard selected pale green, Students, Assessments, New Assessment, Companies, Placements, Reports & Analytics. "Collapse sidebar" at bottom.
- Centered constrained main content, NOT full-bleed, with comfortable gutters. Same header "Student performance" and "BSIT / BSIS · OJT Batch 2026".
- Header actions unchanged in role and color: BLUE "Enroll Students" and GREEN "+ New assessment".
- Same four white summary cards in one row: Enrolled students / 2 / "Students in the current active batch"; Required complete / 1 / "50% of students in scope"; Students needing follow-up / 0 / "Distinct students with an actionable issue"; Placement progress / "0 / 2" / "2 unplaced". Preserve the familiar small label, large number, explanatory text design. Green on completion and placement numbers. No new icons, graphs, trends or additional metrics in these cards.
- SAME VERTICAL SECTION ORDER: summary metrics, then "Top matches", then "Top performers by skill", then "All students". Do NOT merge the two highlight sections or move them side by side.
- Top matches keeps the existing card design and four-column grid behavior: in this two-student scenario there is just ONE small card at the left, with open space to its right. Do not stretch it full width, invent additional students, convert it to a banner, or fill that area with a chart. Header right hint "Select a student to view recommendations".
- The single Top match card: blue "Top match" pill and small eye icon; initial avatar AR, "Alex Rivera"; prominent amber "73.45%"; "Frontend Web Developer Intern", "Sample Tech"; thin BLUE progress bar at 73.45%. It must remain a small white card like the reference.
- Top performers by skill keeps FOUR INDIVIDUAL WHITE CARDS side by side, not a leaderboard table. Header right hint "Select a skill to see the full ranking". Same colored category pills and bars: BLUE "Database Management", "Alex Rivera", amber "66.67%" and blue 66.67% bar; VIOLET "Networking", "Alex Rivera", rose "50%" and violet 50% bar; PINK "Programming", "Alex Rivera", rose "50%" and pink 50% bar; AMBER "Web Development", "Alex Rivera", green "100%" and amber 100% bar. Each retains the subtle eye icon.
- The All students section keeps the SAME toolbar: heading, search input "Search by name or ID…", filters "All" selected dark slate, "Completed", "Pending", Cards/List icon switch with List selected, "2 students" count.
- Keep the SAME table columns: "Student", "Status", "Placement", "Skills", "Top Match", "Overall". Same soft-gray table header and rounded white table. Two synthetic rows: Morgan Lee / 2023-00125 · BSIT / amber Pending / amber Unplaced / "Not assessed" / dash / dash. Alex Rivera / 2023-00124 · BSIT / green Completed / amber Unplaced / compact skill chips for Web Development 100%, Database 66.67%, Networking 50%, Programming 50% / "Sample Tech" with "73.45% match" / "67%". No fake approval. Footer "Showing 2 of 2 students".
ALLOWED IMPROVEMENTS ONLY:
- Better typographic hierarchy and darker readable text using the existing neutral sans-serif style. Keep ordinary labels/cells compact, approximately 12–13 CSS px; title about 22px and section headings about 15px. Do not turn this into oversized dashboard typography.
- Consistent card padding, corner radii around 14px, aligned labels, eye icons and score bars. Subtly stronger borders, white surfaces and restrained shadows.
- Tighten excessive vertical gaps to approximately 24–28px between sections, making both student rows easier to see. Keep comfortable whitespace and existing card heights, not a dense packed screen.
- Align controls neatly, improve inactive button contrast and show a quiet green border/light shadow on ONE skill card to communicate the existing hover affordance. Keep blue and green action buttons, category accent colors and the original compact feel.
Constraints: no redesign of navigation or page structure, no new color palette, no combined highlight panel, no giant hero, no list replacement for skill cards, no new tables or new invented operational features. No real student photographs, names or IDs. All copy crisp and correctly spelled. It should immediately read as the SAME SkillBridge dashboard, thoughtfully polished. Output only the finished UI screenshot.
