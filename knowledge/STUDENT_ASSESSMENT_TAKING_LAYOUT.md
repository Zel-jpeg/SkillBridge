# Student assessment taking layout

Implemented on 30 October 2026, retaining the existing layout shown in the user's
[reference screenshot](../outputs/design-concepts/student-assessment-taking-reference.png).
The user replaced the earlier mobile redesign with focused choice-alignment,
timer-centering and red integrity-icon changes. This applies to the taking screen,
separate from the assessment collection cards.

## Responsive presentation

- Below 1024 CSS pixels: retain the original title/header, red integrity badge,
  reminder/countdown/answered-count row, centered Manila cutoff, question spacing,
  choice-card styling and autosave text. The badge uses a shield/check icon in
  place of its dot; the text remains “Integrity monitoring active”.
- Equal-width side columns center the timer precisely in the viewport, independent
  of the reminder and answered-count widths. The reminder can wrap on very narrow
  phones. Existing gray/amber/red timer presentations remain in place.
- Phones and narrow tablets receive these alignment fixes. The existing tablet
  content width is preserved. At 1024px and wider, including wide iPad orientations,
  the original desktop layout, badge dot and question sidebar remain in place.
- Narrow-screen choices have a fixed letter column and a separate wrapping text
  column. Each A/B/C/D marker is vertically centered beside its full answer.
  Card height follows its text; long words can wrap without horizontal overflow.
- Existing selection, disabled states and hover behavior remain. Keyboard focus,
  reduced motion, light/dark themes and floating navigator safe-area clearance
  are covered. Extra bottom space keeps the navigator below the page controls.
- The existing autosave message remains; no cloud-sync icon or saving state is added.

Implementation: [StudentAssessment.jsx](../skillbridge-frontend/src/pages/student/StudentAssessment.jsx)
and [scoped styles](../skillbridge-frontend/src/pages/student/studentAssessmentTaking.css).
There are no new dependencies, timer calculations, API calls, server changes,
submission permissions or assessment-state changes.

## Existing unanswered-question behavior

This layout update preserves the current behavior:

- Next/Review answers stays disabled while the current question has no selected
  choice or has an empty/whitespace-only identification answer.
- The question navigator can jump past a blank question. Answering the last
  question then permits review with skipped questions marked “Not answered”.
  A blank last question still prevents that manual entry into review.
- Review shows the unanswered count. Submission confirmation shows how many
  questions were answered; it does not require every question to be answered.
- At expiry the existing automatic submission sends the recorded answers.
- The server accepts missing/blank answers, gives them zero credit and retains
  the full question denominator. Empty submissions are also accepted by the
  server. This is distinct from the frontend's manual navigation guards.

The server contract and existing regression coverage are documented in
[submission integrity](ASSESSMENT_SUBMISSION_INTEGRITY.md). Timing/grace,
interruption and recovery rules remain in
[assessment lifecycle and timing](ASSESSMENT_LIFECYCLE_AND_TIMING.md).

## Verification

- `npm run lint` and `npm run build` passed.
- New [taking-layout browser checks](../skillbridge-frontend/tests/assessment_taking_layout_playwright.py)
  passed at 320, 375, 390, 600, 768, 820, 1023, 1024, 1180, 1280 and 1440px,
  each in light and dark themes. Checks cover header containment, the exactly
  centered timer, red integrity badge, centered markers, wrapping text columns,
  keyboard focus, navigator clearance, selection and disabled progression state.
- Both 10-minute/5-minute warning presentations passed at 320px. Phone, tablet
  and desktop partial-submission checks preserved blank identification guards,
  skipped-question review, answer IDs and exact attempt identity.
- Existing `assessment_timer_recovery_playwright.py` (2 cases) and
  `assessment_inactivity_playwright.py` (2 layouts) passed, with no page errors.
- Six before/after desktop screenshots (selected and unselected at 1024, 1280
  and 1440px) matched pixel-for-pixel. Mobile and tablet screenshots were also
  visually inspected. `git diff --check` passed.

Browser checks used local headless Chrome with intercepted synthetic responses;
no real student attempt or backend/database was changed. Artifacts are under
ignored `skillbridge-frontend/tests/artifacts/assessment-taking-layout/` and
`work/mobile_assessment_preview/`. Physical iPad/Safari behavior and hosted
deployment were not verified.
