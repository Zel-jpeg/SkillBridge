# Assessment result interpretation

Updated 17 October 2026. Presentation uses current category percentages, including
for previously saved profiles. No regeneration or data migration is required.

## Definitions and UI

### Individual versus combined scores

The staff student profile now labels this distinction beside the score tables:

- Assessments shows each assessment's current category raw/max points and percentage.
- Combined competency pools raw points and maximum points for each category across eligible assessments in the same batch. The percentage is `sum(raw_score) / sum(max_score) * 100`, rounded to two decimal places by the backend. It is not an average of assessment percentages.
- For example, 8/10 in one assessment and 2/5 in another combine to 10/15, or 66.67%. If only one assessment contributes to a category, its individual and combined scores match.
- Eligible evidence is included submitted, unflagged evidence from published or closed assessments. Stopped attempts, flagged attempts, excluded assessments and archived prior attempts do not contribute as current evidence. Required completion and current finalized evidence still govern combined-result visibility.

The source of truth is [combined competency](../skillbridge-backend/api/combined_competency.py), especially eligible_evidence and recalculate_combined. The frontend continues to display supplied category values without recomputing them.

### Interpretation conventions

- Highest-scoring areas are **all** assessed categories equal to the maximum API
  percentage, compared before formatting. Array order, names and IDs never decide
  the winner. Input order only controls display order.
- Display preserves API precision, trimming redundant trailing zeroes. 83.33%
  and 83.34% remain visibly different. The individual student results endpoint
  returns stored percentages instead of rounding to one decimal. Grading still
  stores its existing percentages.
- Null, missing, blank, invalid percentages and rows with a supplied maximum of
  zero have no assessed score. They are distinct from an assessed 0%. Empty
  results have no highest-scoring category. All-zero results explicitly say no
  assessed category scored above zero.
- Combined summaries describe combined results; individual summaries explicitly
  describe one assessment. Stopped/flagged attempts retain recorded scores and
  integrity notices but receive no positive interpretation.
- Guidance identifies every assessed category below 80%, following the previous
  insight threshold. This is a presentation convention, not a new grading band
  or placement rule. If all categories score at least 80%, every category receives
  continued-development guidance. Tags are not independently assessed skills.
- Neutral bordered sections use 14px body text, 24px line height and 16px headings.
  Guidance stacks on mobile and uses two columns at wider widths. Names wrap and
  tied leaders have no display limit. Staff tab keyboard focus remains available.
- Combined result interpretation starts collapsed in a native disclosure. Enter,
  Space or a click expands the full summary and development focus; every tied
  leader remains available when expanded. Individual interpretation stays open.
  PDF/CSV exports always include the full summary.
- The dashboard retains its original green summary card and circular overall
  score badge, restored at the user's request after the spacing redesign.
  Result text keeps colons instead of em-dash separators, including matching
  CSV/PDF wording. Stored NLP text is unchanged.

The documented `frontend-design` skill was unavailable in `.agents/skills/` and
the local skill/plugin locations. Design follows the collection-UI reference
and current SkillBridge components.

## Student individual-result cards (27 October 2026)

Release verification on 27 October: frontend lint/build, all 201 frontend Node
tests, two database-free taxonomy checks and 47 synthetic browser configurations
passed across assessment cards, skill lists, company browsing, real Leaflet maps
with the production CSP, and shared staff guidance. No backend source or migration
changed. These local checks do not verify live hosted APIs or external providers.

The approved score-summary and insights concepts are implemented specifically for
the student's individual assessment result page:

- [Score summary](../skillbridge-frontend/src/components/student/AssessmentResultSummary.jsx):
  an overall score ring, raw/correct/incorrect counts, recorded date, submitted or
  stopped state, required-work completion and competency-inclusion information.
  Correct/incorrect counts remain unavailable while the separate answer review
  loads or fails. No scored maximum displays an unavailable overall percentage;
  an assessed zero remains 0%. The two navigation actions have equal width/height
  and fill the content row, stacking at narrow content widths. Final-results
  navigation remains gated by the API's recommendation lock.
- [Assessment insights](../skillbridge-frontend/src/components/student/AssessmentInsights.jsx):
  a strongest-category strip, exact category percentages and text-only development
  rows ordered from lower to higher score, preserving ties. Arbitrary instructor
  category names need no icon mapping. The existing presentation helper handles
  ties, missing scores and all-zero evidence; stopped attempts omit positive
  insights. The full summary and methodology are available in a native disclosure.
  Existing profile-based development guidance remains wired into the rows.
  Development-focus cards separate the category/score header, the suggested
  practice activity and neutral review-topic tags. Topics sit alongside the
  activity when space permits and stack below it on narrow screens. Longer
  review/practice/instructor guidance stays available through each card's
  keyboard-accessible **View practice steps / Hide practice steps** disclosure.
  The shared advice helper exposes these existing message parts separately;
  its full message, category selection, score bands and topic evidence remain
  unchanged for other views and exports. No category-specific icon is required.
  This focus-card refinement passes lint/build, 24 summary/advice checks and the
  four responsive student-result browser cases, including keyboard practice-step
  disclosures, present/missing topic evidence and dark mode. Desktop and phone
  screenshots were inspected.
- [Submitted answers](../skillbridge-frontend/src/components/student/SubmittedAnswerReview.jsx):
  questions start collapsed, with their question/category and correct, incorrect
  or unanswered state visible. Each question uses a keyboard-accessible button
  with expanded state and its controlled answer panel. Expand all opens the
  current questions; once all are open the control becomes Collapse all. Closing
  an individual question restores Expand all. Controls reuse already loaded data;
  they do not fetch, save or change answers. MCQ/true-false selections and typed
  answers retain their existing marking, and the answer key remains omitted.

These student-specific components reuse the existing scoped GET endpoints and
do not change grading, stored evidence, shared staff insights or exports. Styles
live in [assessmentResult.css](../skillbridge-frontend/src/components/student/assessmentResult.css).
The [navigation/card browser check](../skillbridge-frontend/tests/student_assessment_result_navigation_playwright.py)
uses synthetic data at 320/375/768/1440px, including dark mode, independent review
loading/retry, bulk/mixed/per-question keyboard toggles, unanswered and stopped
states, full-width actions and repeated View Score navigation.
Verification: lint/build, 22 focused summary/development-guidance checks, all four
new result-card browser cases and the 15 existing skill-profile layout cases
pass. Desktop/mobile/dark screenshots were inspected. These checks mock API data;
they do not establish live backend or provider availability.

## Student skill-category cards (20 October 2026)

The dashboard, final combined results and individual assessment results use a
shared [SkillCategoryList](../skillbridge-frontend/src/components/SkillCategoryList.jsx).
Categories stack in one column at every viewport width. Dashboard and combined
results use an independently scrolling category region with keyboard access.
Individual assessment cards fit their content and show six categories initially;
**Show N more categories** expands all rows using page scrolling, and **Show less**
returns to six. The toggle exposes its expanded state and controlled list, and is
omitted for six or fewer categories. Long names wrap. Percentage precision, qualitative
tags, bar colors and individual assessment raw/max scores are preserved.

27 October: the dashboard and final-results skill profiles show combined skill
categories from highest to lowest percentage. Equal scores retain their API order;
unavailable percentages follow assessed scores, including zero. Sorting uses the
shared student results hook's derived array, leaving cached API records unchanged,
and updates with refreshed scores. Each category retains its assigned bar color.
Individual assessment lists and staff/export ordering keep their existing behavior.

The dashboard skill card fills its existing two-row desktop grid area without
contributing category-list height to the grid's row sizing. Below 1024px it uses
a 28rem card, as do the final-results category cards at all widths. The individual
assessment card no longer inherits that fixed height or nested scrolling.
Headings stay outside the scrolling list. Highest-score summaries
are separately bounded/scrollable so a large tie list also cannot enlarge a card;
all tied names remain accessible. Staff details and exports retain their existing
layouts and scoring/interpretation logic.

[Synthetic browser checks](../skillbridge-frontend/tests/student_skill_profile_playwright.py)
compare four categories with 30 categories and 30 tied leaders on all three
student views at 1440, 1024, 768, 375 and 320px. The checks cover stable card
height for the two bento cards, content height and keyboard expand/collapse for
individual assessment categories, one-column geometry, long names
and no horizontal overflow; 320px uses dark mode. API/map responses are mocked
and other external requests are blocked. Artifacts are saved under ignored
`tests/artifacts/student-skill-profile/`. These checks do not verify live services.
All 15 view/width combinations passed with no browser page errors. Desktop and
phone screenshots were reviewed; frontend lint/build and whitespace checks passed.

The [summary helper](../skillbridge-frontend/src/utils/assessmentSummary.js) and
[insights component](../skillbridge-frontend/src/components/CompetencyInsights.jsx)
serve student final results, the dashboard highest-score summary, individual
assessment results and shared instructor/admin details. The
[PDF formatter](../skillbridge-frontend/src/utils/assessmentReportPdf.js) uses the
same helper. The backend [CSV helper](../skillbridge-backend/api/assessment_presentation.py)
implements the same contract, tested with [shared fixtures](fixtures/assessment_summaries.json).
CSV competency reports include combined guidance and a separate individual
assessment summary. Locked reports suppress combined summaries and guidance.

## Data flow and ranking boundary

Individual scores originate in `score_submission` and saved `SkillScore` rows.
Combined scores come from eligible raw/maximum totals in `combined_competency.py`
and saved `CombinedCategoryScore` rows. Scoped serializers/hooks provide those
rows to each role. Staff details share `AssessmentStudentDetail`; management
reports use the same evidence. Authorization, completion locks, aggregation and
placement access are unchanged.

`generate_competency_insights` in `recommendation_nlp.py` embeds its legacy
orientation summary in `competency_profile_text`. Ranking consumes that saved
text through `scoring.py`. Those fields, NLP inputs, text generation version and
recommendation weights are unchanged. UI/exports derive factual summaries from
score rows instead of displaying saved orientation or tag-based guidance fields.
Legacy API fields remain for compatibility and NLP diagnostics.

## Practical development advice (27 October 2026)

Student individual/combined results and instructor/admin student details now use
the display-only [development advice helper](../skillbridge-frontend/src/utils/developmentAdvice.js).
The existing summary still selects every assessed category below 80%, or every
assessed category when all scores are at least 80%. No category is dropped by the
legacy backend's two-suggestion limit.

- All 35 built-in categories in the existing
  [suggestion taxonomy](../skillbridge-backend/api/skill_taxonomy.py) receive
  concrete practice examples from the display-only
  [activity catalog](../skillbridge-frontend/src/utils/developmentActivities.json).
  The catalog also recognizes all 84 existing aliases (23 original matching-name
  aliases and 61 authoring-suggestion aliases), including Photo Editing, Microsoft
  Excel and Technical Writing. Case, whitespace and punctuation normalize for
  activity lookup; custom or compound names without a defined alias retain the
  course-material fallback. Topic evidence still matches the original category
  name and score, so alias lookup does not borrow another category's topic evidence.
  Examples are suggestions, not diagnoses of topic weaknesses. Financial, office
  and record exercises use fictional/sample data; system tasks use practice labs.
- Practice support follows the existing competency bands: below 60 uses worked
  examples; 60–69.99 uses step-by-step repetition; 70–79.99 uses independent practice;
  80–89.99 extends the activity with peer comparison; 90–100 adds complexity and
  explanation of trade-offs. These do not add grading or placement thresholds.
- Below-80 guidance asks students to review incorrect/unanswered questions and
  discuss practice results with their instructor. Individual advice refers to
  the individual assessment; combined advice refers to contributing assessments.
  Staff wording supports reviewing the work with the student.
- Existing `supporting_categories` topic tags appear separately as **Suggested
  review topics**, limited to four nonempty, distinct strings. Matching uses the
  category name and current percentage, allowing the saved profile's one-decimal
  rounding. Missing, malformed or mismatched evidence omits the optional topics.
  Staff individual results do not expose per-assessment topic profiles, so those
  cards use the activity guidance without borrowing combined-profile topics.
- Advice is derived directly from current props without additional requests,
  saved-text regeneration, dependencies or database changes. Existing empty,
  locked and stopped/flagged-result guards remain in place.

This small change applies to on-screen advice. The shared factual summaries and
existing PDF/CSV export guidance retain their previous contract. Backend saved
suggestions, competency/NLP text, scoring and ranking are unchanged.

Verification for this advice change: 31 focused Node checks passed (including
seven new advice checks), frontend lint passed with no warnings and production
build passed. Synthetic Chrome checks passed at 320, 375, 768 and 1440px, including
dark mode, topic display/fallbacks, combined-result navigation and stopped-attempt
suppression. Eight shared staff/component Edge combinations passed at 375/1280px
in light/dark modes, including locked evidence and long category names. Browser
checks used intercepted synthetic responses; desktop/phone advice screenshots
were visually inspected. Live student services and export pagination were not tested.

Full-category follow-up: 33 focused Node checks passed, including every category
at all five score bands and all 84 aliases. Two database-free Python contract
checks compare the activity catalog directly against the taxonomy constants using
Python AST parsing. They fail if a category/alias is added or changed without a
corresponding advice-catalog update. Run from `skillbridge-frontend/` with
`../skillbridge-backend/venv/Scripts/python.exe -m unittest discover -s tests -p test_development_advice_coverage.py`.
Frontend lint passed with no warnings and the production build passed. This
follow-up changes activity data and lookup only; browser markup is unchanged,
and the browser suites were not rerun for this data expansion.

## Verification

- Frontend Node regression suite: 94 passed, including 15 summary checks and
  student/staff normalization/PDF contract checks.
- Lint: zero errors, five existing warnings in company/profile/setup screens.
  Build passed. The PATH npm shim is broken on this machine; use
  `& 'C:/Program Files/nodejs/npm.cmd' run lint` and the equivalent build command.
- Django system check passed. 37 tests passed across `api.test_assessment_presentation`,
  `api.test_management_step4`, `api.test_multiple_assessments` and
  `api.test_combined_competency`. The integration run overrode `DATABASES` in the
  Python process to isolated in-memory SQLite before Django setup. No configured
  remote database was contacted. PostgreSQL behavior was not tested.
  The disclosure/spacing follow-up reran the two database-free presentation tests,
  all 94 frontend checks, lint and build. Generated browser bundles under
  `test-results/` are excluded from ESLint alongside other build artifacts.
- [Synthetic browser script](../skillbridge-frontend/scripts/check_assessment_summaries.py):
  run with backend venv Python against Vite on `127.0.0.1:5173`. It generates and
  removes a temporary harness, bundles the actual components and styles into an
  ignored preview directory, intercepts APIs with synthetic data, blocks external
  requests and uses installed Edge through Playwright. Screenshots go under ignored
  `skillbridge-frontend/test-results/assessment-summaries/`.
  The bundled preview avoids the development HMR transport and does not affect
  normal application builds. `--themes`, `--widths` and `--views` select a subset.
  All 24 student/staff/shared-component/dashboard combinations passed at 375, 768
  and 1280px in light/dark modes, including keyboard expand/collapse, separate
  dashboard results, long labels, close percentages, locked evidence, keyboard
  focus, 14px minimum summary text and no horizontal overflow or page errors.
  Mobile staff and desktop dashboard screenshots were visually inspected as well.
  After restoring the original dashboard card, all six dashboard width/theme
  combinations passed again with no overflow or page errors; lint and build
  passed with the same five pre-existing lint warnings.

Live authenticated backend/browser flows and generated PDF pagination remain
outside this synthetic verification. No live student data was used.
