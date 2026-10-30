# Assessment publication dialog presentation

30 October 2026: instructor and admin assessment pages share the refreshed
[publication dialog](../skillbridge-frontend/src/components/assessment/PublishAssessmentDrafts.jsx).
The [imagegen concept](../outputs/design-concepts/assessment-publication.png) informed
the two-step header, selected draft surfaces, batch summary, review checklist and
separate settings/results notices. The generated image is a design reference;
the application renders native controls and text.

The publication-specific dialog size fits its content rather than reserving most
of the viewport. Its body scrolls independently while the header, progress and
footer remain available. Scoped styles cover narrow and short viewports, both
themes, hover, keyboard focus and reduced motion. Other detail dialogs keep their
existing sizing.

The final Publish button shows a spinner, `Publishing…` and `aria-busy` while
the existing request is pending. Existing disabled Back/close/publish controls and
the synchronous pending guard remain. The existing success toast reports the
published count after server confirmation; failure stays inline with the selection
preserved for retry. No second notification mechanism was added.

Draft eligibility, batch selection, initial selections, select-all/clear,
review/back/cancel, request URL/payload, server validation, cache invalidation and
success/error handling retain their existing implementation. The assessment
collection, authoring, scoring, permissions and student numbering are outside
this presentation change. See the [publication contract](STUDENT_ASSESSMENT_RANDOMIZATION.md).

## Verification

- Frontend lint and production build pass.
- The existing disposable-API student assessment order browser suite passes:
  both staff roles, grouped publication, anonymous student numbering, stable order,
  answer submission and gated final results. It uses a separate synthetic SQLite
  fixture with dotenv disabled and stops its own API/frontend processes.
- Focused synthetic presentation checks are in
  [assessment_publication_ui_playwright.py](../skillbridge-frontend/tests/assessment_publication_ui_playwright.py).
  All six acceptance groups pass with zero page errors. They cover 56 layouts
  across both roles, both steps, light/dark themes and seven screen sizes from
  320x568 to 1920x1080; all dialog buttons' hover/focus feedback; keyboard
  selection; 29-row phone scrolling; single-item dialog shrinkage; no space below
  the footer; multi-batch selection; pending controls and duplicate protection;
  exact failed/retried payloads; success notification; and cancel/focus return.
  They intercept all API requests and block external traffic. Desktop review,
  narrow dark selection, pending and success screenshots were visually reviewed.
  Evidence is saved under ignored
  `skillbridge-frontend/tests/artifacts/assessment-publication/`.
- `git diff --check` passes. No backend code or database schema changed; no
  production publication or hosted deployment was performed.

Run the focused script against a local frontend using `SKILLBRIDGE_TEST_BASE`
(default `http://127.0.0.1:5189`) with the project's Python Playwright environment.
No hosted publication or real student records are needed for these checks.
