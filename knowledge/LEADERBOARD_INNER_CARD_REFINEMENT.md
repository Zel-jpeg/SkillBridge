# Leaderboard inner-card refinement

10 November 2026. The user selected only the lower student-list and score-rail
portion of the generated colored podium concept.

The change is scoped to `skillLeaderboard.css`: podium student rows use a
transparent background, no nested border/rounded box, hairline list separators,
32px avatars and consistent text spacing. Initials use green circles; existing
student photos remain supported. The existing slim score rail is retained.

Rank headers, score percentages, podium geometry, outer card colors and the rest
of the modal retain their existing styles. JSX, ranking/tie calculations, score
data, pending-student lists and pagination were not changed. Podium names have
no arrow icons; existing button actions, keyboard focus and student-detail dialogs
remain available.

Frontend lint and production build passed. Visual browser verification uses
the existing synthetic skill-leaderboard fixture, with populated, tied-score,
dark-phone and long-name cases; results are saved with the design review assets
in the current Codex workspace.

All four final visual/focus cases passed with no page errors. An earlier attempt
to exercise the fixture's complete nested student-detail flow failed after the
dialog tree unmounted; that flow was not changed or certified by this CSS update.
The final checks cover visible keyboard focus rather than the full detail screen.

## Height and hover follow-up — 10 November 2026

The user subsequently authorized podium height and student hover fixes. This
supersedes the earlier statement that podium geometry was unchanged.

Podium cards now share a minimum base height (236px for single-student ranks,
286px when any displayed rank is tied), with first place 56px taller and second
place 28px taller than the base. Their bottoms and score rails remain aligned.
Minimum heights allow a single student's full text to expand its card instead
of clipping it. Tied lists have a bounded scroll area; rows do not shrink.
The existing responsive 1–2/3 phone arrangement and colored podium remain.

Hover now highlights the student button with a subtle green fill and inset edge,
without recoloring the podium card or moving/resizing content. Keyboard focus
uses a visible inset outline, dark mode has matching contrast, and reduced motion
removes the row transition. Names still have no arrows. Score and ranking logic
and student-detail actions were not changed.

Validation: frontend ESLint and production build passed. Six synthetic browser
cases passed at widths 320, 390, 768 and 1440px across light/dark themes, including
tied scores, long names and a single rank. Checks cover minimum heights, stepped
desktop layout, aligned score rails, unclipped single-student lists, scrolling
ties, stable hover geometry/card colors, keyboard focus, reduced motion and
horizontal overflow. No browser page errors were reported. This does not extend
the earlier nested student-detail fixture certification.