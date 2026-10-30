# Student assessment card states and display order

30 October 2026: the approved
[state preview](../outputs/design-concepts/student-assessment-states.png) is
implemented on the student assessment collection. This is frontend presentation
only. Backend states, routes, eligibility, grading, saved numbering, required
completion and retake transitions are unchanged; no migration is required.

## Existing inputs and actions

The API already supplies `attempt_status`, `submitted_at`, `is_flagged`,
`availability_status`, `retake_allowed`, `retake_request`, `can_request_retake`
and `action`. The new
[presentation helper](../skillbridge-frontend/src/pages/student/assessmentCardPresentation.js)
derives labels, styling and display priority from them. It delegates actions to
the existing `assessmentAction` helper, which is unchanged.

| Existing evidence | Card presentation | Action behavior retained |
| --- | --- | --- |
| Available start action | White card, Ready to start and dot | Start Assessment |
| Available continuation | Blue surface/accent and clock | Continue Assessment |
| Available approved retake | Violet surface/accent and repeat icon | Retake Assessment; existing request link if present |
| Stopped attempt | Amber surface/accent and warning | Existing recorded-attempt/result action; request button only under its existing visibility condition |
| Pending or declined request on a stopped attempt | Stopped appearance plus precise request status | View retake request instead of requesting again |
| Flagged response without a currently available retake | Amber Needs review | Existing result/action remains; never styled Completed |
| Submitted, timestamped and unflagged | Mint surface/green top accent and check | View Score, including after deadline/closure |
| Upcoming unfinished work | Cool-gray surface and dashed border/calendar | Existing unavailable action |
| Overdue unfinished work | Pale rose surface/accent and clock | Existing unavailable action |
| Closed unfinished work, if supplied | Gray surface/accent and lock | Existing unavailable action |
| Missing/unknown availability or incomplete submission metadata | Neutral Unavailable or Submitted fallback | Existing action helper remains authoritative |

An available approved retake takes precedence over the previous recorded attempt's
appearance. When a retake is no longer available, an unflagged finalized attempt
can still display Completed and offer View Score. Stopped/flagged records remain
distinct even when a result can be viewed. Request metadata does not grant a
retake; the existing permission/action fields continue to control it.

The current backend normally omits closed assessments without a finalized attempt;
the preview's closed/unsubmitted example is a defensive presentation fallback,
not a change to the API's assignment or visibility policy. Optional and
competency-excluded work retains its separate badges/notices. The progress panel
continues using the server's aggregate counts and final-results gate; it does
not recount visible card styles or treat a completion label as a passing score.

## Display order

Cards are grouped by in-progress work, available start/retake work, stopped/flagged
work, remaining unavailable work, and finally completed work. The API's order is
preserved inside each group. The array is copied before sorting, and IDs, titles,
saved enrollment mappings and question order are untouched. For example, a completed
Assessment 1 can appear after unfinished Assessments 2–6 while retaining its name.
Refreshed response data updates the visual grouping; keyed cards retain their
identity. No sort order is saved or sent to the server.

This supersedes the older statement that the student collection always displays
the API array in its original order; the
[saved-number contract](STUDENT_ASSESSMENT_RANDOMIZATION.md) itself remains intact.

## Presentation and verification

The approved top accents, restrained surfaces, labels/icons and action variants
are scoped to `sac-` styles. Light/dark themes, reduced motion, forced colors,
keyboard focus, enabled/disabled controls and small-screen action wrapping are
covered. A pending/declined request is a state detail, not a new assessment enum.
The top accent stays inside the card's clipped rounded frame, with no negative
inset. Approved-retake effects use a keyboard-accessible disclosure; its summary
states that the retake replaces the current score and the full explanation retains
the earlier-attempt history wording. Duplicate approved-request wording is omitted
when the existing Retake approved badge already conveys it.

Checks actually run:

- Frontend lint and production build pass; all 250 frontend JavaScript tests pass.
  The seven new state/order tests cover stable immutable grouping, available and
  unavailable retakes, result access after timing/publication changes, flagged
  records, request metadata, optional/excluded work, refresh and preserved IDs/titles.
- Three focused
  [state browser groups](../skillbridge-frontend/tests/student_assessment_states_playwright.py)
  pass with zero page errors and zero API writes. They cover all shown states,
  pending/declined requests, closed submitted results, unchanged server counters,
  live completion/reload grouping, flagged submissions, keyboard retake disclosure,
  every enabled button's hover/focus and 12 responsive light/dark layouts from
  320 to 1920px. The rounded-frame correction is also checked at every size/theme:
  all accent bars have non-negative insets and are clipped by their card's radius.
  Desktop and phone light/dark screenshots were visually reviewed, including
  isolated completed-card captures after the top-accent correction.
- All four existing card-layout/browser groups pass, including both staff roles,
  six-item paging, student action states, loading placeholders and 42 responsive
  layouts. All four student result-navigation groups pass, including result CSS
  isolation, answer-review retry and final-results/stopped gates. There are 11
  passing browser groups across these suites. Evidence:
  `work/student_assessment_states/` and ignored
  `skillbridge-frontend/tests/artifacts/student-assessment-states/`.
- `git diff --check`, updated Markdown links and browser-script syntax pass.
  The existing action helper was compared with HEAD and is unchanged; no backend
  files were changed. Backend/database tests are unnecessary for this presentation
  change and were not run. Git publication was separately authorized after final
  verification. No deployment or migration was performed by this work.

Browser fixtures intercept API responses with synthetic data and block external
traffic. They establish local presentation/navigation behavior, not hosted or
physical-device acceptance. The preview runner stopped its own process tree.
