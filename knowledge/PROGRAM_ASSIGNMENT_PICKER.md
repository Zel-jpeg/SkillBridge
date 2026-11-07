# Program assignment picker

6 November 2026. Implemented the approved imagegen concept for the optional
program assignment in Add Instructor and the shared program selection cards.

## Presentation and behavior

- The Add Instructor dialog has a softly tinted, collapsible **Program assignment**
  section, an Optional badge, explanatory copy and a Clear selection action.
  It starts collapsed as before; collapsing does not discard the selected program.
  The collapsed heading indicates an existing selection.
- Assignment is institute-first: search the active institute cards, open one to
  view only its active programs, and use All institutes to go back. Each level
  keeps server search and eight-record pagination. Navigating between institutes
  does not grant access or clear the existing program selection. These admin-only
  reads reuse the existing institute and per-institute program endpoints.
- Each program card separates its code and institute from the full program name.
  Names wrap. The entire card selects its native radio; the selected state has
  a green border/fill, radio state and explicit Selected text. Radio group names
  are unique to each picker instance.
- Border follow-up: program cards show the additional focus outline only for
  keyboard focus (`:focus-visible`), so mouse-selected cards have one continuous
  green edge. The User Management student cards and enrollment review cards also
  avoid outer mouse-focus rings; keyboard indicators on their controls remain.
  Instructor cards explicitly use keyboard-only outlines. Institute choices,
  filter chips and profile/detail cards were checked for the same overlap.
- Shared program search still covers program/institute names and codes; within
  an institute it searches that institute's programs. Search resets to page 1
  and preserves the selected program. Pagination retains eight results per page
  and the existing range wording. Its compact mode fits narrow screens.
- When the selected program is outside the current search/page, a separate
  Selected program summary keeps its identity visible. Counts show the full
  filtered total and whether one program is selected. No-results and empty-catalog
  messages are distinct; clearing either search or selection restores search focus.
- The list shrinks for a few programs and scrolls when taller. Long names, dark
  mode and narrow layouts retain the same information. The instructor dialog has
  a stable viewport-bounded height; its form fills the available space and scrolls
  between the header/footer. The action bar does not move with disclosure or
  institute/program navigation.
- The shared picker also supplies the same card presentation to program-bound
  batch creation, assessment drafting and coordinator partner selection. Existing
  endpoint props, permission scopes and single-selection values are preserved.

Source: [ProgramSelect.jsx](../skillbridge-frontend/src/components/ProgramSelect.jsx),
[program card styles](../skillbridge-frontend/src/components/programSelect.css),
[AddInstructorModal.jsx](../skillbridge-frontend/src/components/admin/AddInstructorModal.jsx),
and [scoped dialog styles](../skillbridge-frontend/src/components/admin/addInstructor.css).
Institute navigation lives in
[InstituteProgramSelect.jsx](../skillbridge-frontend/src/components/admin/InstituteProgramSelect.jsx).
No dependency, backend, schema, authentication, grant or save-payload changes.
An omitted program remains optional; later assignments still use Institutes & Programs.

## Verification

Final checks: frontend lint and production build pass. All seven focused synthetic
browser groups and all eleven existing real-API dynamic-profile/program-batch
groups pass, with no page JavaScript errors. The real-API run uses a disposable
SQLite database and blocked external providers, not the configured live database.
Receipt: ignored `work/organization-browser-f0y0lwly/`.

The border follow-up adds light/dark mouse-versus-keyboard checks for selected
programs and exercises student/instructor cards and profile dialogs. Page-specific
student/instructor overrides are scoped in
[userManagement.css](../skillbridge-frontend/src/pages/admin/userManagement.css);
the shared enrollment review cards keep one border in both themes via
[index.css](../skillbridge-frontend/src/index.css). Enrollment, pending/profile
cards and filter-chip styles were also inspected for overlapping rings.

The focused [browser fixture](../skillbridge-frontend/tests/program_assignment_cards_playwright.py)
uses only intercepted synthetic APIs. It covers native radio keyboard selection,
collapse/search/page retention, no-match recovery, explicit clear, preventing
search Enter from submitting, exact instructor payloads with/without a program,
duplicate-save guarding, disabled pending controls, failed-save recovery, query
retry and live result-count shrinkage. It also checks institute-specific results,
back navigation, and the same footer position before/after expansion and navigation.
Layout checks cover 1366px desktop, 768px
tablet, 320/390px phone and short landscape in light/dark themes. Screenshots
under ignored `work/program-assignment-cards/` were visually inspected.

The existing dynamic-profile regression uses the updated section heading;
its account/program assignment assertions and API contracts are unchanged.
Physical devices and non-Chromium engines are not verified by these checks.
