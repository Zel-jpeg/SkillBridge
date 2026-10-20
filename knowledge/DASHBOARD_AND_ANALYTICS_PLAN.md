# Dashboard and analytics proposal

20 October 2026. **Approved and implemented for current-state analytics and recorded
submission activity.** See [implementation and verification](ANALYTICS_IMPLEMENTATION.md)
for the delivered behavior. Historical completion/capacity snapshots remain outside
the implemented scope because they are not retained. The sections below preserve
the accepted design and its data requirements.

## Product structure

Keep Dashboard for current work and follow-up. Use **Reports & Analytics** for
analysis, comparisons and exports. Improve the existing admin Reports & Analytics
page rather than adding a competing Statistics destination. Add an instructor
Reports & Analytics entry with shared visual components and backend-enforced
ownership scopes. The two roles need consistent navigation and terminology, but
different questions, datasets and default sections.

Use three main tabs: **Assessments**, **Skills**, **Placements**. Keep export
controls within the relevant tab. Display only two or three charts in the active
tab, followed by the records supporting them. Put existing admin NLP configuration
and model comparison in a clearly separated admin-only Advanced section; preserve
their functionality and permissions.

## Dashboard priorities

### Admin: institution-wide coordination

Recommend five primary cards, based on distinct decisions rather than a fixed
four-card layout:

| Card | Definition and supporting text | Selection opens |
|---|---|---|
| Students in active batches | Distinct active students in the current operational cohort; active accounts without a batch are not silently included | Cohort roster, with batch/instructor context |
| Required assessments complete | Count and rate using the same selected cohort denominator; a batch with no required assessments is not complete | Incomplete/complete required-work records |
| Awaiting placement review | Unplaced students with current unlocked final evidence and at least one current recommendation | Placement candidates requiring a coordinator decision |
| Placement progress | Approved students / cohort students, with unplaced count as supporting text | Approved and unplaced records |
| Remaining OJT slots | Current configured capacity minus approved assignments, grouped by position | Capacity by company and position |

The placement-review count is not approval eligibility: capacity, current evidence,
location requirements and other approval protections still apply. Current capacity
is shared across batches and must be labeled **system-wide capacity**, even when
student cards have a batch filter. Do not present free seats as automatically
suitable seats or placements guaranteed for every unplaced student.

Below the cards, add a compact conditional **Needs attention** list. Show only
actionable nonzero items: pending instructor approvals, students with stopped or
flagged current work, complete students with stale/unavailable final results,
students with no usable current recommendations, and incomplete assessments past
their actual configured deadline. Use distinct students for student actions;
assessment-attempt totals belong in the detail list. Do not call work overdue
when no deadline is set. Label stale/unavailable results honestly when the API
cannot provide a more specific cause.

Retain current top matches, skill rankings and student details. Keep account,
company, assessment-publication and retake totals in their relevant management or
analytics sections rather than giving every count a primary dashboard card.

### Instructor: current batch progress and intervention

Recommend four primary cards:

| Card | Purpose | Selection opens |
|---|---|---|
| Enrolled students | Size and identity of the selected owned batch | Batch roster |
| Required assessments complete | Count/rate and number still completing required work, separate from finalization | Required-progress records |
| Students needing follow-up | Distinct students with an actionable issue; union of stopped/flagged current work, actual overdue required work, or completed required work with unavailable final evidence | Students grouped by follow-up reason |
| Placement progress | Approved count/rate and students still without an approved decision in the selected cohort | Owned-batch placement records |

A student with multiple issues counts once in the follow-up card and can have
several reason labels in the details. An approved retake alone is not a new
violation; archived attempt history must not create a current flag. Ordinary
in-progress work that is not due is shown in progress records rather than
automatically labeled urgent. Students with no assigned required assessments
remain explicitly identified as an assignment/setup issue.

Keep the instructor attention list and links to student results, retake management
and placement review close to these cards. Preserve the same card styling as the
admin, with colors explaining completion or needed action rather than decoration.
No primary average-score or recommendation-volume card: these figures do not
directly identify the next student or decision needing attention.

## Reports & Analytics content

### Admin

| Tab | Useful content | Chart and reason |
|---|---|---|
| Assessments | Required completion by batch/course/instructor, assessment attempt status, unresolved integrity issues and retake activity | Horizontal completion bars with numerator/denominator for cohort comparison; stacked status bars for mutually exclusive current attempt states |
| Skills | Distribution of final combined category results, evidence coverage and categories needing support | Horizontal stacked bars for existing score bands per category, labeled sample count; sortable category/student detail tables |
| Placements | Approved/unplaced students, unplaced students with current recommendations, occupied/remaining seats by company/position, approved deployments by company area | Placed/unplaced bar or single donut for one cohort; occupied/free capacity bars; horizontal bars for company/area counts |

Batch/instructor comparisons should reveal where support is needed, not create
teacher rankings from different assessments, course mixes or cohort sizes.
Comparison views must expose those differences. Do not describe configured
capacity as employer skill demand: there is no separate employer demand target.

### Instructor

| Tab | Useful content | Chart and reason |
|---|---|---|
| Assessments | Completion by assigned assessment; not started, in progress, submitted-valid and stopped/flagged current attempts; outstanding required work; current and prior retakes kept separate | Horizontal completion bars and stacked attempt-status bars to identify bottlenecks, with a student follow-up table |
| Skills | Final combined category distribution, eligible sample count and the students needing practice; optional assessment-specific analysis in a separate view | Horizontal category bars with existing score bands; selectable category opens the relevant student list |
| Placements | Approved/unplaced students, current candidates needing review, approved companies/positions and no-current-match cases | One placed/unplaced bar or donut; horizontal approved-placement counts by company, with student/decision details |

Use the selected owned batch by default, with an explicit selector for other owned
batches and an explicit archived/history option. Instructors cannot request another
instructor's records or admin-only analytics by changing URL parameters. Shared
company capacity may be shown where useful, labeled as shared capacity rather
than seats reserved for that instructor.

## Chart and interaction rules

- Bars are the default for comparisons and categorical counts. Show counts with
  percentages and sample sizes; expose exact data through a matching table.
- A donut/pie is optional for one simple, non-overlapping whole, such as current
  approved versus unplaced students. Do not add pie charts for skills, dozens of
  companies, or overlapping readiness/completion/placement states.
- Lines are only for verified events over time, such as recorded valid submission
  activity per week. They do not belong in phase one unless current and archived
  retake timestamps can be reconciled without double counting. A current-state
  aggregate cannot produce an honest historical trend.
- Historical completion/readiness/capacity trends require durable snapshots or a
  sufficiently complete immutable event history. Do not invent backfilled daily
  values from current rows. If this requires new persistence, plan the migration
  separately and show history only from the supported coverage start.
- Use the same colors and score-band meanings as existing SkillBridge screens;
  score bands are descriptive, not certification of professional competence.
- Selecting a card, chart category or table row must lead to the scoped records.
  Provide equivalent keyboard-accessible controls and a table alternative.
- Keep charts responsive, avoid horizontal page overflow, and distinguish no
  results, missing evidence, failed requests and genuine numeric zero.

## Data definitions and filters

Before building new cards/charts, establish one shared backend metric contract:

1. Declare scope, denominator, unit, included batch states and generated timestamp
   for every metric. System current-cohort totals use one current active enrollment
   per student, following the existing admin current-enrollment rule. Historical
   per-batch comparisons can count student/batch enrollments, but must label that
   unit and must not sum them as distinct system-wide students.
2. Keep required completion, finalized/current evidence, recommendation availability
   and approval as separate facts. Not every completed student has usable current
   recommendations, and a recommendation never consumes capacity.
3. For a **student match distribution**, use one best current recommendation per
   student in scope. The existing admin report's recommendation totals count
   recommendation records, so they cannot be relabeled as a student pie chart.
   Keep unmatched/locked students visible in separate categories or explicit
   excluded counts, rather than silently losing them from the denominator.
4. Show skill distributions using eligible final combined scores for the selected
   student/batch. Missing scores remain missing. Assessment-specific results remain
   a distinct analysis, never an average of unequal assessment percentages.
5. Placement cohort reports use the saved placement evidence batch. Preserve
   historical assignment snapshots and separate current approved counts from
   approval/removal activity. Capacity consumption remains global.
6. Filters: admin gets batch, instructor and course; instructor gets owned batch,
   course and assessment where relevant. Add company/position and company-area
   filters on placements. Separate residence area from deployed company area.
7. Date ranges apply to named events (submission date or decision date). Current
   cohort totals must not change meaning because an unrelated activity date filter
   was selected. Historical cohort states require snapshot/event support.
8. Reuse existing reporting exports, with identical filter definitions and counts
   to the on-screen tables. Show Philippine time, generation time and stale snapshot
   notices. Generated exports should remain deliberate snapshots.

## Implementation sequence and acceptance

1. **Metric contract and authorization:** reconcile current admin stats, report
   populations, current-enrollment selection, attempt units and capacity scope.
   Add shared filtered backend aggregation and instructor access checks. No grading
   or recommendation weight changes, and no recalculation during analytics reads.
2. **Dashboard navigation:** implement the role-specific cards and attention queues,
   with useful filtered destinations rather than display-only totals. Preserve the
   current highlight/student interactions.
3. **Reports & Analytics:** reorganize the existing admin destination, add the
   instructor destination, and reuse existing assessment/placement export modules.
   Ship bars, detailed records and at most one simple donut per active tab first.
4. **Verified history:** review event coverage, define supported line charts and
   add durable history only if needed and agreed. Do not promise migration-free
   historical trends before that review.
5. **Verification:** synthetic fixtures covering overlapping memberships, archived
   cohorts, complete-but-locked evidence, zero/missing scores, multi-issue students,
   retakes, placement removal and shared capacity. Test direct API denials as well
   as frontend controls, chart/table/export reconciliation, filter behavior,
   mobile/dark layouts and existing click/focus interactions.

This larger proposal requires backend work for consistent scoped aggregates and
instructor analytics access. Phase-one current-state metrics need no new historical
data collection in principle; exact migration needs follow the endpoint/schema
design. Existing local dashboard edits remain frontend-only.

## Inspected sources

- [Current dashboard implementation](DASHBOARD_HIGHLIGHTS.md)
- [Admin report page](../skillbridge-frontend/src/pages/admin/AdminReports.jsx)
- [Stats, reports and analytics endpoints](../skillbridge-backend/api/views.py)
- [Responses, history and placement models](../skillbridge-backend/api/models.py)
- [Assessment export panel](../skillbridge-frontend/src/components/AssessmentReportPanel.jsx)
- [Report scope and reconciliation](REPORT_RECONCILIATION.md)
- [Capacity and geographic definitions](CAPACITY_AND_AREAS.md)
- [Recommendation freshness and current-evidence gates](RECOMMENDATION_FRESHNESS.md)
