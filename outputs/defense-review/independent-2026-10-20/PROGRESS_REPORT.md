# SkillBridge Progress Report

**Project title:** SKILLBRIDGE: A WEB-BASED OJT PLACEMENT DECISION SUPPORT SYSTEM WITH NLP-ASSISTED SKILLS ASSESSMENT AND COMPANY-POSITION RECOMMENDATION

**Student names:** David Rey P. Bali-os, Lemuel P. Brion and Azel M. Villanueva

**Status date:** 20 October 2026

**Reporting basis:** Development since the outline defense held on 2 June 2026

**Pre-deployment defense:** 9–10 November 2026

## Introduction

SkillBridge supports On-the-Job Training placement decisions at Davao del Norte State College through student competency assessments, company and position records, and system-generated recommendations. Since the outline defense, we have implemented the main student, instructor and administrator workflows and added local verification for assessment integrity, access control, enrollment, placement and reporting.

The project is currently in final validation and deployment preparation. Its major modules are implemented, while the latest review identified recommendation freshness and category-input issues that still require correction. We plan to present the system to our adviser this week or next week, complete the remaining acceptance work, and prepare for the November 9–10 pre-deployment defense.

### Gantt Chart

The chart shows proposed remaining work. X indicates a planned work window. These dates are targets for adviser discussion, not completed activities or confirmed appointments.

| Activity | Oct 21–25 | Oct 26–30 | Oct 31–Nov 3 | Nov 4–6 | Nov 7–8 |
| --- | --- | --- | --- | --- | --- |
| Adviser review and panel-action confirmation | X | X |  |  |  |
| Correct review findings and retest | X | X |  |  |  |
| Align manuscript and minutes | X | X | X | X |  |
| Hosted integration and recovery verification |  | X | X |  |  |
| User acceptance tasks and feedback |  |  | X | X |  |
| Final readiness review and rehearsal |  |  |  | X | X |

## Project Status

### Current Stage

The application has working implementations for the five revised study objectives: project data management, competency assessment, comparison of NLP preprocessors, hybrid recommendation generation, and analytics/reporting. Current work focuses on confirming that the implemented system, research claims and deployment evidence agree.

The latest formal panel record available is the June 2 outline-defense minutes. We have not yet completed another formal adviser check. We will bring the current system and an updated response to the 17 panel comments to the next adviser meeting.

### Accomplishments Since the Outline Defense

**Objective 1 Manage project information.** We developed the web application for storing and managing student profiles, company information, position requirements, competency scores, recommendations and placement records. Student, instructor and administrator accounts have separate access to these records. Batch management and IAMS-format enrollment support the preparation of student records for assessment and placement.

**Objective 2 Provide competency assessments.** We implemented assessment authoring and deployment, Multiple Choice, True/False and Identification questions, bulk question import and category assistance. The system delivers randomized questions and choices, grades responses and presents scores by skill category. It also supports timed attempts, instructor-authorized retakes and combined competency profiles based on eligible assessment evidence.

**Objective 3 Compare NLP preprocessors.** We developed the comparison workflow and retained experiments for spaCy Small, spaCy Medium and Stanza English. The comparison records recommendation metrics and processing time, while distinguishing unavailable models from successful runs. The final model-selection explanation and timing records remain subject to reconciliation with the manuscript.

**Objective 4 Generate hybrid recommendations.** We implemented a recommendation engine that combines category-score similarity, NLP-assisted text similarity and location similarity using the current 60%, 25% and 15% weights. Students can view ranked company-position matches, and staff can review ranked student suggestions for each position. Completion gates and placement capacity are checked separately from the match score. Recommendation freshness after changes to position requirements remains under correction.

**Objective 5 Provide analytics and reports.** We implemented role-specific dashboards and reporting for competency results, recommendation outcomes and OJT placements. The system presents company and position capacity, approved placements, remaining slots and area summaries, and generates placement reports by company and by student.

### Challenges and Responses

Earlier issues with omitted-answer scoring, duplicate submissions, attempt duration, catalog validation and browser session renewal have implementation and regression-test evidence of correction. The latest independent review identified two further issues: saved recommendations can remain current after a position's requirements change, and malformed category names can return a server error. We will correct these paths and add direct regression checks before final acceptance.

Running the entire backend suite also exposed shared rate-limit cache state between tests. A separate verification runner isolated the cache between tests while retaining rate-limit assertions, and the full PostgreSQL suite passed. The supported test setup still needs this isolation so that the ordinary documented command is reliable.

The manuscript selects spaCy Small, while the current configuration defaults to Medium. We need to reconcile the selected-model explanation, experiment run and timing scope with our adviser. Exact compatibility with the institution's existing LMS export, genuine user acceptance results and hosted operational behavior also need confirmation.

### Actual Progress Against the Timeline

The original development sequence has reached implementation and integration testing. Local features and verification have advanced beyond several items still described as planned in the outline minutes. However, hosted acceptance, adviser validation and formal user evaluation remain unfinished. We cannot calculate an exact schedule variance without a confirmed dated baseline and actual milestone completion dates. The proposed Gantt chart gives closure targets before November 9–10.

## Work Completed

### Evidence of Work

The evidence appendix presents screenshots of the implemented interface, a source-code excerpt and a generated report. Each figure is linked to a study objective so that the completed deliverable can be seen directly.

| Objective | Evidence included | What it demonstrates |
| --- | --- | --- |
| 1 Manage project information | Figure 1 Company and position records | A company record with a position, available slots and skill requirements. |
| 2 Provide competency assessments | Figure 2 Assessment authoring interface | Controls for question types, answer choices and skill-category selection. |
| 3 Compare NLP preprocessors | Figure 3 NLP comparison source excerpt | Three configured preprocessors and a comparison path that checks the actual model without fallback. |
| 4 Generate hybrid recommendations | Figure 4 Ranked company-position suggestions | A student match with category, NLP and location components, distance and staff decision controls. |
| 5 Provide analytics and reports | Figure 5 Generated company placement report | An exported report containing placement history, match components and remaining capacity. |

UI and report examples come from archived local demonstrations on October 17–18 and use synthetic data. Detail crops improve readability. The code excerpt was read from the repository on October 20. These artifacts show implemented work; they do not establish hosted acceptance or actual placement effectiveness.

### Supporting Verification

The October 20 review recorded 122 passing frontend tests, 316 passing backend tests on disposable PostgreSQL using cache isolation, and 15 passing grouped browser scenarios. Lint, the production build, Django checks and migration consistency checks also passed. These results support the visual and implementation evidence rather than replace it.

The full-suite result describes the earlier reviewed working-tree run; later catalog edits received focused checks. Shared throttle-cache interference in the ordinary test command and the separately reproduced application defects still require correction. Saved NLP experiment percentages describe synthetic expected-role agreement, not actual OJT success or user acceptance. Full verification of the intended frozen release remains pending.

## Work in Progress

| Current task | Proposed target | Completion evidence |
| --- | --- | --- |
| Conduct adviser check and confirm panel interpretations | Oct 21–30 | Actual meeting record, decisions and reviewed action matrix. |
| Correct recommendation freshness and category validation; isolate test cache | Oct 27 | Direct API regressions, ordinary full-suite pass and preserved placement history. |
| Reconcile manuscript, active model and evaluation descriptions | Oct 30 | Consistent methods, login contract, identified experiment and honest metric claims. |
| Verify intended hosted release and recovery procedure | Nov 3 | Real integration, role-flow, model, export, backup/rollback and restart evidence. |
| Conduct user acceptance tasks and analyze actual feedback | Nov 6 | Genuine participant task results/questionnaires and material defect retests. |
| Complete readiness review, demonstration and contingency preparation | Nov 8 | Rehearsed role workflow, report samples and documented remaining limitations. |

The dates are proposed targets. The adviser check is planned for this week or next week; no appointment or approval is assumed. Existing local backup, concurrency and workflow records support preparation, while actual hosted verification and final acceptance remain separate work.

## Conclusion

SkillBridge has implemented its major functional modules and now supports the assessment-to-placement workflow with role access, competency evidence, hybrid matching, analytics and reports. Recent local verification provides evidence of progress since the outline defense, while the independent review identifies specific remaining corrections and limits.

The project should be described as undergoing final validation and deployment preparation. Our immediate priorities are adviser checking, correction of the new review findings, alignment of the manuscript with actual behavior, genuine user acceptance evaluation and verification of the intended hosted release. These activities will support a defensible readiness decision before the November 9–10 pre-deployment defense.

<!-- pagebreak -->

## Evidence Appendix

### Data Management and Assessment

![Figure 1 Company and position record](evidence/figure-1-company-position.png)

**Figure 1.** Detail of the Companies and Positions interface showing a company, position, slot count and skill requirements. Local UI fixture with synthetic records, October 17. Supports Objective 1.

![Figure 2 Assessment authoring controls](evidence/figure-2-assessment-authoring.png)

**Figure 2.** Detail of the assessment authoring interface showing the three question types, question/choice fields and category selection. Local prototype with synthetic setup, October 18. Supports Objective 2.

<!-- pagebreak -->

### NLP Comparison and Recommendations

![Figure 3 NLP comparison code excerpt](evidence/figure-3-nlp-comparison-code.png)

**Figure 3.** Source excerpts from the model registry and comparison loop, captured October 20. They show the three preprocessors and strict actual-model checking. This is implementation evidence; saved experiment results and final model selection require their separate methodological explanation. Supports Objective 3.

![Figure 4 Ranked company position student suggestion](evidence/figure-4-ranked-suggestion.png)

**Figure 4.** A company-position suggestion with a synthetic student's match score, category/NLP/location components, distance and staff controls. Local React/API demonstration, October 18. Scores are illustrative, and approval is a separate staff action. Supports Objective 4.

<!-- pagebreak -->

### Analytics and Report Generation

![Figure 5 Generated company placement report](evidence/figure-5-generated-report.png)

**Figure 5.** Detail of a PDF downloaded from the company-placement reporting workflow on October 18. The synthetic example retains Removed and Approved history, component scores and remaining capacity. It demonstrates report output rather than real deployment outcomes. Supports Objective 5.

The evidence files are retained alongside this report so that they can be opened at full size. Screenshots show selected local prototype states, not every implemented feature or a new acceptance test of the current hosted system.
