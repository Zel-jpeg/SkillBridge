# Progress Report

**SKILLBRIDGE: A WEB-BASED OJT PLACEMENT DECISION SUPPORT SYSTEM WITH NLP-ASSISTED SKILLS ASSESSMENT AND COMPANY-POSITION RECOMMENDATION**

**Researchers:** David Rey P. Bali-os, Lemuel P. Brion and Azel M. Villanueva

**As of:** October 20, 2026 | **Pre-deployment defense:** November 9-10, 2026

## Introduction

SkillBridge is a web-based decision support system for OJT placement at Davao del Norte State College. It brings together student information, competency assessments, company-position requirements, NLP-assisted matching, and placement analytics to help students and staff review suitable OJT opportunities.

This report covers development since the June 2, 2026 outline defense. The main workflows are implemented locally. Current work focuses on selected UI improvements, final validation, manuscript alignment and preparation for adviser review and the pre-deployment defense.

### Gantt Chart of Remaining Activities

The schedule below proposes work before the November 9-10 defense. X marks a planned work window. Adviser meeting dates and completion targets remain subject to confirmation.

| Activity | Oct 21-25 | Oct 26-30 | Oct 31-Nov 3 | Nov 4-6 | Nov 7-8 |
| --- | --- | --- | --- | --- | --- |
| Adviser review and panel-action checking | X | X |  |  |  |
| UI refinement and regression checks | X | X |  |  |  |
| Manuscript and NLP evaluation alignment | X | X | X | X |  |
| Hosted integration and recovery checks |  | X | X |  |  |
| User acceptance tasks and feedback |  |  | X | X |  |
| Final review and defense rehearsal |  |  |  | X | X |

The latest formal panel record is the June 2 outline-defense minutes. Another formal adviser check has not yet taken place; the team plans to request a check this week or next week.

<!-- pagebreak -->

## Project Status

SkillBridge is a working prototype undergoing refinement, local verification and deployment preparation. Implemented features address the five study objectives. Final hosted acceptance and formal user evaluation remain to be completed.

### Recent Accomplishments

- **Objective 1 - Manage project information.** Implemented student profiles, company and position records, skill requirements, competency results, recommendations and placement records, with separate student, instructor and administrator access. Batch management and IAMS-format enrollment support student-record preparation.
- **Objective 2 - Provide competency assessments.** Implemented assessment authoring and deployment, Multiple Choice, True/False and Identification questions, question import, randomized delivery, automatic scoring and category results. Timed attempts, authorized retakes and combined competency profiles support the assessment workflow.
- **Objective 3 - Compare NLP preprocessors.** Developed a comparison workflow for spaCy Small, spaCy Medium and Stanza English, with recommendation metrics, processing-time records and explicit reporting of unavailable models. Final interpretation and manuscript alignment remain under review.
- **Objective 4 - Generate hybrid recommendations.** Implemented company-position ranking using category, NLP-assisted text and location similarity with 60%, 25% and 15% weights. Staff review suggestions before approval; assessment completion and capacity are checked separately. Recent safeguards detect outdated matching inputs and require refreshed recommendations.
- **Objective 5 - Provide analytics and reports.** Implemented role-specific dashboards and reports for assessment completion, competency results, recommendations, placements and remaining slots. Recent local improvements include clearer student tables, chart drill-downs and scoped exports.

### Challenges and Solutions

- **Keeping recommendations current.** Changes to requirements or matching inputs can make saved rankings outdated. Recent local changes record matching-input provenance, lock stale results and provide an explicit administrator refresh while preserving placement history.
- **Handling invalid input.** Malformed category data previously caused server errors. Shared validation now rejects invalid values before saving. Regression checks remain part of release preparation.
- **Keeping the interface clear.** Dense tables and inconsistent presentation can make results harder to interpret. We are refining selected pages for consistent layout, readable information, navigation and responsive behavior, including dashboards and Reports & Analytics.
- **Aligning research and deployment evidence.** The manuscript's model-selection explanation must agree with the evaluated model and actual runtime. We will reconcile these records and complete hosted integration, recovery and user acceptance checks before final readiness assessment.

<!-- pagebreak -->

### Comparison of Actual Progress to the Planned Timeline

The table compares current progress with proposed remaining milestones. A confirmed dated baseline for the earlier development phases was not supplied, so an exact schedule variance is not claimed.

| Milestone | Proposed target | Progress as of October 20, 2026 |
| --- | --- | --- |
| Adviser and panel-action review | Oct 21-30 | June 2 minutes available; follow-up adviser check planned. |
| Feature refinement and local regression checks | Oct 30 | Core workflows implemented; UI refinement and release verification continue. |
| Manuscript and NLP evaluation alignment | Nov 6 | Comparison workflow and records available; final explanation needs reconciliation. |
| Hosted integration and recovery verification | Nov 3 | Local evidence and release handoff available; live checks pending. |
| User acceptance and defense preparation | Nov 6-8 | Actual participant feedback and final rehearsal still to be completed. |

## Work Completed

- **Data and account management:** Built role-based workflows for student records, batches, companies, positions, requirements and OJT placement records.
- **Assessment workflow:** Built question authoring and import, assessment deployment, timed answering, scoring, category results and instructor-controlled retakes.
- **Combined competency evidence:** Added batch-scoped competency profiles and required-assessment completion checks for recommendation access.
- **NLP comparison tools:** Added model comparison and diagnostics that identify the actual model used and distinguish failed or unavailable models from completed runs.
- **Recommendations and placement review:** Built ranked matches, separate score components, staff approval controls, capacity checks and saved placement snapshots.
- **Analytics and report generation:** Built scoped dashboards, assessment and placement summaries, student detail views and downloadable reports. Recent local work improves table consistency and interactive charts.
- **Verification and readiness records:** Prepared local automated and browser checks, an independent code review, a response matrix for the 17 panel comments, and release/recovery guidance.

The following pages show selected UI screens, a source-code excerpt and a generated report. These provide direct evidence of implemented work alongside the separate technical verification records.

UI and report examples were captured locally on October 17-18 using synthetic records; the code excerpt was prepared on October 20. The figures show implementation, rather than hosted acceptance or actual placement outcomes.

<!-- pagebreak -->

### Evidence of Work: Code, Interfaces and Generated Output

- **Company and position management - Objective 1:** The interface shows a position, available slots and required skill levels for placement preparation.

![Figure 1 Company and position record](evidence/figure-1-company-position.png)

**Figure 1.** Companies and Positions interface with a synthetic company record, position, slots and requirements. Local UI fixture, October 17.

- **Assessment authoring - Objective 2:** The editor provides question types, answer fields and skill-category controls.

![Figure 2 Assessment authoring controls](evidence/figure-2-assessment-authoring.png)

**Figure 2.** Assessment authoring controls from the local prototype, October 18. Scoring verification is recorded separately.

<!-- pagebreak -->

### Evidence of Work: NLP Comparison and Recommendations

- **NLP comparison - Objective 3:** The model registry and evaluation loop configure three preprocessors and check the actual model used during strict comparison. Source filenames appear in the excerpt.

![Figure 3 NLP comparison code excerpt](evidence/figure-3-nlp-comparison-code.png)

**Figure 3.** Labeled source-code excerpts prepared October 20. This shows comparison implementation; experiment results and final model selection require separate explanation.

- **Ranked suggestions - Objective 4:** Staff can inspect a student's suggested position, total match, category/NLP/location components, distance and available capacity before making a placement decision.

![Figure 4 Ranked company position student suggestion](evidence/figure-4-ranked-suggestion.png)

**Figure 4.** Synthetic company-position suggestion from a local React/API demonstration, October 18. Match values are illustrative; approval remains a separate staff action.

<!-- pagebreak -->

### Evidence of Work: Analytics and Report Generation

- **Placement reporting - Objective 5:** The company placement workflow produces a PDF containing placement history, match components and remaining capacity.

![Figure 5 Generated company placement report](evidence/figure-5-generated-report.png)

**Figure 5.** Detail of a report downloaded from the local workflow on October 18. Synthetic Removed and Approved entries illustrate retained history and capacity reporting. Blank signature fields do not represent approval or endorsement.

### Supporting Verification

Local checks cover assessment handling, access boundaries, recommendations, placement rules, reports and selected browser workflows. The independent review and subsequent project records retain the exact commands, observations and limitations. Later project records document fixes to recommendation freshness and category validation, as well as additional dashboard and analytics checks.

These records support the implementation evidence shown above. They do not replace genuine participant evaluation or verification of the intended hosted release.

The original screenshots and figure provenance are retained with the editable report. The earlier captures do not show every subsequent UI refinement or every implemented feature.

<!-- pagebreak -->

## Work in Progress

We are currently improving the UI of selected pages to make layouts, information presentation and navigation more consistent. Work includes dashboard and Reports & Analytics refinements, regression checks, manuscript/model alignment, and preparation for adviser review. Hosted integration, recovery verification and genuine user acceptance activities remain part of the completion plan.

### Anticipated Completion Dates

| Task | Proposed completion date |
| --- | --- |
| Conduct adviser check and confirm responses to panel comments | October 21-30, 2026 |
| Refine selected page layouts and verify responsive behavior | October 30, 2026 |
| Complete local release regression checks | October 30, 2026 |
| Verify hosted role workflows, exports and recovery | November 3, 2026 |
| Reconcile manuscript, model selection and evaluation descriptions | November 6, 2026 |
| Complete user acceptance tasks and address material feedback | November 6, 2026 |
| Finalize evidence, demonstration and defense rehearsal | November 8, 2026 |

These are proposed targets. An adviser appointment, adviser approval and successful acceptance are not assumed.

## Conclusion

### Key Findings and Achievements

SkillBridge now supports the main assessment-to-placement workflow through managed project records, competency assessments, NLP comparison tools, hybrid recommendations and analytics/reporting. The selected figures demonstrate concrete implementation progress since the outline defense.

### Assessment of Project Progress Against Goals

The working prototype addresses the five study objectives. Selected UI refinements, research-document alignment and final validation continue. Readiness for actual use still depends on confirming the intended hosted release and completing genuine user evaluation and adviser review.

### Plans and Next Steps

- **October 21-30:** Seek adviser review, check panel-action responses, refine selected pages and complete local regression checks.
- **October 31-November 6:** Complete hosted and recovery checks, reconcile the manuscript and analyze actual user feedback.
- **November 7-8:** Finalize the report and evidence, rehearse the demonstration and record any remaining limitations before the November 9-10 pre-deployment defense.
