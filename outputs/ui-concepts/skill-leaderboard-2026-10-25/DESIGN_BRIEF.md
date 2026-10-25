# Skill leaderboard modal concept

Created 25 October 2026 with the built-in imagegen tool. The initial concept left application code unchanged. The approved modal has since been implemented on UI-update-instructor-admin, with the user's original vertical student-card style: larger gold first place and smaller silver/bronze second and third places. The dashboard layout remains unchanged.

## Deliverables

- [Populated leaderboard concept](leaderboard-populated.png)
- [Implemented desktop](implemented-vertical-cards-desktop.png)
- [Implemented mobile](implemented-vertical-cards-mobile.png)
- The design-only sample-data.json was deleted at the user's request. The implemented modal uses the existing scoped student records; the preview image remains available.

The example has 24 students: 20 ranked and 4 not yet assessed. It shows the top three in a restrained podium, ranks 4–8 in the first page of the remaining rankings, and four distinct pending student buttons. The 17 students outside the podium have four pages at five records per page. Names, IDs and results are synthetic.

Search and pagination are design proposals to support larger cohorts. Search is labeled for the remaining-student list, while the podium represents the global top three. Any future implementation should preserve keyboard access, responsive layouts and the existing student-detail navigation. Rank is based on the supplied combined category score; it does not represent recommendation fit or placement approval. Missing evidence remains unranked and has no numeric score.

The original raster concept was visually reviewed. The subsequent implementation passes lint, build, 34 leaderboard browser groups and 12 mocked dashboard groups. See [implementation notes](../../../knowledge/DASHBOARD_HIGHLIGHTS.md) for behavior, validation and limits. The original generation prompt below is retained as design history; the user's later vertical-card instruction takes precedence over it.

## Submitted generation prompt

Use case: ui-mockup.
Asset type: high-fidelity desktop redesign concept for the SkillBridge "Top performers by skill" leaderboard MODAL.
Primary request: Reimagine the modal in the supplied screenshot, populated with many synthetic students so the user can judge a realistic busy batch. The underlying dashboard must remain unchanged. Output ONE beautiful crisp front-facing desktop interface screenshot, roughly 1536x1152. No device frame, browser chrome, perspective or outside design annotations.
Reference image: the supplied white modal with a single gold winner card. Retain its recognizable top-three podium idea, white academic-app styling, close button, ranked students and separate unassessed section. Improve hierarchy, readability, use of space and scalability. Keep the underlying SkillBridge dashboard only faintly visible through a gray overlay.
Visual system: clean white modal, thin cool-gray dividers, 14px corners, dark slate neutral sans-serif typography, muted slate secondary text, green interactive controls and score bars, restrained amber/gold for the winner medal. No giant decorative trophies, gradients, confetti, neon, photos or fake analytics charts. Ordinary text readable and compact, headings clearly stronger. Show a plausible implementable application, not an infographic.
MODAL SHELL: centered with about 90% viewport width and 92% height, fully visible. Persistent header and footer; content designed for independent scrolling if more records appear. No oversized empty lower half.
HEADER: small green layers/category icon on a pale-green square. Title exactly "Database Management leaderboard". Subtitle "OJT Batch 2026 · BSIT / BSIS". At right small neutral badge "Sample data" and a close X with a clear large hit target. Below title, one quiet summary line with three clear counts "24 students", "20 ranked", "4 not yet assessed". Small supporting note "Ranked by combined category score, highest first." This is an academic category score, not a hybrid recommendation match or placement approval.
TOP PERFORMERS: section label "Top performers". Three centered tasteful podium CARDS in the order second, first, third. Balanced compact heights, first center slightly elevated and with pale amber surface/gold border; second and third mostly white with understated silver and bronze medals. Each card is clickable to student details, with initials avatar, full name, ID/course, prominent category percentage and proportional green bar.
Exact podium data:
Left "#2" — "Noah Reyes", initials NR, "2023-00102 · BSIT", "93.33%".
Center "#1" — "Amelia Cruz", initials AC, "2023-00101 · BSIT", "96.67%".
Right "#3" — "Isabel Santos", initials IS, "2023-00103 · BSIS", "90%".
Names must remain readable in full. Winner slightly more prominent but not a huge trophy or extreme gamification. Percentages all green because these scores exceed 80; no implication of job approval.
REMAINING RANKINGS: below podium, heading "Remaining rankings" and small count "17 students". A search input aligned right labeled "Search remaining students…". This search scopes this list; the top-three podium remains the global top three. Clean table with headers "Rank", "Student", "Course", "Category score", and an unlabeled chevron navigation column. Score column combines precise bold percentage with a slim proportional bar. Rows comfortably spaced; light-gray header and subtle green row-hover treatment on just one row.
Exactly five visible rows:
"#4" initials LG, "Luke Garcia", secondary "2023-00104", course "BSIT", score "86.67%".
"#5" initials MF, "Maya Flores", secondary "2023-00105", course "BSIS", score "83.33%".
"#6" initials ET, "Ethan Tan", secondary "2023-00106", course "BSIT", score "80%".
"#7" initials SL, "Sofia Lopez", secondary "2023-00107", course "BSIS", score "76.67%".
"#8" initials DL, "Daniel Lim", secondary "2023-00108", course "BSIT", score "73.33%".
Green score bars for the first three rows, subdued amber for the last two, always accompanied by exact numeric text. Bar lengths approximately reflect percentages. Every row ends with a small chevron indicating student details.
Below the table, quiet footer left "Showing ranks 4–8 of 20"; right pagination "Previous" disabled, "1" selected green, "2", "3", "4", "Next". The 17 remaining ranked students use four pages of five, after the three podium students.
NOT YET ASSESSED: a separate neutral bordered area below table, heading "Not yet assessed" and count "4". Supporting text "These students have no assessed score yet and are not ranked." Four compact student buttons/chips in two columns or one row with initials and full name: "Ava Mendoza" (AM), "Ben Castro" (BC), "Chloe Navarro" (CN), "Owen Dela Cruz" (OD). Small neutral "Pending" label for each. Do not give any of them a rank, score, zero, low-performance label or medal. Pending section must be legible, not washed out.
PERSISTENT MODAL FOOTER: small student/profile icon and "Select any student to view full assessment details." Dark enough to read. No export, approval, editing, assessment management or deployment actions.
Constraints: 24 is total enrolled; 20 ranked includes the 3 podium students plus 17 others; 4 pending separate. Only the first 8 ranked students are visible in this screenshot, with pagination for the remainder. Do not invent extra visible rows beyond the five specified or mismatch ranks and names. All data explicitly synthetic via Sample data badge. Do not reproduce the real student face/name from the reference. Preserve the dashboard behind the modal; redesign only this modal. All wording clear, correctly spelled, layout aligns, text doesn't clip. Output only the UI screenshot.
