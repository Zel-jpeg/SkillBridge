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

## Student skill-category cards (20 October 2026)

The dashboard, final combined results and individual assessment results use a
shared [SkillCategoryList](../skillbridge-frontend/src/components/SkillCategoryList.jsx).
Categories stack in one column at every viewport width. Adding categories does
not increase card height: the category region scrolls independently, supports
keyboard focus/scrolling and wraps long names. Percentage precision, qualitative
tags, bar colors and individual assessment raw/max scores are preserved.

The dashboard skill card fills its existing two-row desktop grid area without
contributing category-list height to the grid's row sizing. Below 1024px it uses
a 28rem card, as do the final-results and individual-results category cards at
all widths. Headings stay outside the scrolling list. Highest-score summaries
are separately bounded/scrollable so a large tie list also cannot enlarge a card;
all tied names remain accessible. Staff details and exports retain their existing
layouts and scoring/interpretation logic.

[Synthetic browser checks](../skillbridge-frontend/tests/student_skill_profile_playwright.py)
compare four categories with 30 categories and 30 tied leaders on all three
student views at 1440, 1024, 768, 375 and 320px. The checks cover stable card
height, one-column geometry, keyboard scrolling to the last category, long names
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
