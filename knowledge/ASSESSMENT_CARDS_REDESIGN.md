# Assessment cards and six-item staff pages

30 October 2026: the approved
[staff](../outputs/design-concepts/staff-assessment-cards.png) and
[student](../outputs/design-concepts/student-assessment-cards.png) imagegen concepts
are implemented as native React/CSS presentation. The images are design references,
not application assets. Existing shared icons and dependencies are reused.

## Instructor and admin

Both assessment collections show six assessments per page in cards and list view.
Desktop cards use three columns from 1280px, two from 768px and one below that.
A full desktop page therefore has two rows; pagination begins at seven matching
assessments. View switching preserves the ordered page, filters reset it and
refreshed results clamp it. List footers and loading placeholders use the same
six-item count. The existing list layout and phone card fallback remain.

The shared
[AssessmentCollection](../skillbridge-frontend/src/components/assessment/AssessmentCollection.jsx)
groups opening/due dates in paired columns, duration beside batch identity,
requirement/competency text and availability/order in compact rows, and instructor
identity beside expandable category pills. Questions and submissions use inline
metrics. Admin additionally retains assigned-student counts, the API completion
percentage and completed count, distinct from submissions. The card footer retains
stopped/flagged evidence and detail activation. Missing schedules remain explicit.

Cards use natural content height with tighter grouping rather than a fixed height
or clipped details. Long titles/categories wrap and disclosures can grow the card.
Hover/focus, independent category controls and existing detail dialogs remain.

## Student

[StudentAssessments](../skillbridge-frontend/src/pages/student/StudentAssessments.jsx)
uses anonymous numbered headings, requirement and status at opposite ends,
paired duration/question facts, due/opening and inclusion rows, and aligned full-width
actions. New card styles have a separate `sac-` prefix so loading result-page CSS
does not restyle the collection when navigating back.

Student assessment order, titles from the API, status/action decisions, disabled
rules, route destinations, optional-work notices, stopped reasons, retake notices
and request actions remain unchanged. The student collection still displays all
assigned records; staff pagination is not added to it. The existing progress
summary and final-results gate remain. See the
[student numbering contract](STUDENT_ASSESSMENT_RANDOMIZATION.md).

## Scope and verification

This change touches frontend presentation, its browser checks, design references
and documentation. It requires no backend/API/database change or migration.
Unrelated backend/cycle-history work already in the checkout is outside this scope.

Checks actually run:

- Frontend lint and production build pass.
- All 243 frontend JavaScript tests pass in the final combined checkout.
- All four focused
  [layout acceptance groups](../skillbridge-frontend/tests/assessment_cards_layout_playwright.py)
  pass with zero page errors: 42 light/dark layouts across three roles and seven
  widths from 320 to 1920px; three/two/one-column geometry; six/seven-record paging
  boundaries; list/card page preservation; search reset and live result clamping;
  long unbroken titles/categories and independent category disclosure; distinct
  completion/submission evidence; student hover/focus and every action state;
  and six-card desktop loading placeholders. Desktop and narrow dark screenshots
  were visually reviewed, including mixed student states. Evidence:
  `skillbridge-frontend/tests/artifacts/assessment-cards-layout/`.
- All 11 existing instructor library/editor browser groups pass, including card
  activation, categories, list navigation, reports, filters, schedule controls,
  dirty drafts and responsive dialogs. Evidence: `work/assessment_cards/instructor.log`.
- All four student result-navigation browser groups pass at 320, 375, 768 and
  1440px. Checks cover View Score, answer-review loading/retry, final profile,
  stopped-state gates and returning to the collection after result CSS has loaded.
  Evidence: `work/assessment_cards/student.log` and
  `skillbridge-frontend/tests/artifacts/student-assessment-result-navigation/`.
- All nine admin browser groups pass in the final verification. The earlier
  roster-retry failure was an outdated fixture: its synthetic roster omitted the
  batch object required by the current response validator. Adding that object
  restored retry, roster pagination and assessment-specific retake coverage
  without changing application retry behavior. Final evidence: `work/final_push/admin.log`.
- The final production-build browser run also passes the seven previous-batch
  groups and six publication-dialog groups alongside the four layout, 11 instructor,
  nine admin and four student-navigation groups: 41 passing groups in total.
  Logs are under ignored `work/final_push/`.
- A separate disposable-API cycle journey passes all 14 groups, including the
  returning student's Profile history, assessment submission and saved results.
  Together the final browser runs have 55 passing groups and zero page errors.
  This broader journey uses a local Vite server and synthetic SQLite API; its
  coverage is separate from the 41 production-build groups above.
- `git diff --check` passes. Existing student date/status functions and action/date
  decisions were compared with HEAD and are unchanged.

All browser coverage above uses synthetic API responses and blocks external traffic;
no production record is read or written. No live-service integration or physical
device acceptance is claimed. Git publication was separately authorized after
verification; hosted acceptance remains separate. The preview runner stops its
own process tree after each run.
