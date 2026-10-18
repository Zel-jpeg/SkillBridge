# SkillBridge Progress Report

A WEB BASED OJT PLACEMENT DECISION SUPPORT SYSTEM WITH NLP ASSISTED SKILLS ASSESSMENT AND COMPANY POSITION RECOMMENDATION

David Rey P. Bali-os   |   Lemuel P. Brion   |   Azel M. Villanueva

Status as of 17 October 2026   |   Submission due 19 October 2026

## Introduction

SkillBridge supports OJT placement decisions at Davao del Norte State College through competency assessments, student profiles, company and position records, and ranked recommendations. This report presents the implemented modules, current verification results, outstanding issues, and proposed work before the defense scheduled for the first week of November 2026.

The project is in integration testing and deployment preparation. The major functional modules are implemented, but full deployment readiness has not yet been established. Assessment integrity, input validation, production configuration, user acceptance and operational verification remain part of the completion work.

### Gantt Chart

The schedule below is a proposed completion plan. X identifies the planned work window; future dates are targets subject to team and adviser confirmation.

| Activity | Oct
17-19 | Oct
20-23 | Oct
24-26 | Oct
27-29 | Oct
30-31 |
| --- | --- | --- | --- | --- | --- |
| Report and requirements review | X |  |  |  |  |
| Assessment and catalog corrections |  | X |  |  |  |
| Hosted integration and configuration |  |  | X |  |  |
| User acceptance and quality checks |  |  |  | X |  |
| Paper alignment and defect retesting |  | X | X | X | X |
| Readiness review and rehearsal |  |  |  |  | X |

### Current Milestones

The progress report is due on 19 October. The proposed release-readiness review is on 30 October, with 31 October reserved for rehearsal and contingency work. The exact November defense date remains to be confirmed.

## Project Status

### Current Stage

The system has working implementations for student, instructor and administrator workflows. Current work focuses on validating these implementations against the revised study objectives, the functional and non-functional requirements, and the recommendations recorded during the 2 June 2026 outline defense.

### Accomplishments

Current implementation evidence covers IAMS-compatible enrollment with preview and validation; assessment creation and bulk question import; Multiple Choice, True/False and Identification questions; randomized question delivery; category-based scoring; combined competency profiles; company and position management; and hybrid recommendations using assessment, text and location components.

The placement workflow supports company-position groups with ranked student suggestions, staff approval and placement history. Dashboards and reports include competency summaries, OJT capacity, placement outcomes and student counts by area. PDF and spreadsheet report functions are available for company and student placement reporting.

### Challenges and Responses

| Challenge | Response completed or planned |
| --- | --- |
| Assessment score integrity | The review reproduced inflated scores from omitted or duplicated question entries. Backend validation and authoritative question denominators are prioritized for correction. |
| Attempt duration and catalog validation | Expired attempts were accepted, and malformed position input could fail after a partial save. Server-side enforcement, validation and regression checks are planned. |
| Different timing and model-selection records | Notebook and manuscript results were compared. An authoritative run, hardware record and consistent model-selection explanation still need to be finalized. |
| Hosted feature configuration | The repository browser policy blocks geocoding and company Storage images. Required origins and deployed behavior need verification. |
| Acceptance and operational evidence | Existing automated checks provide internal evidence. User acceptance, deployment performance, PostgreSQL concurrency and recovery verification remain scheduled work. |

### Progress Against the Timeline

The paper describes a development sequence ending in testing and deployment. The current system has reached integration and release preparation, but remaining acceptance and deployment work prevents a claim of full completion. Exact variance from the original Gantt chart cannot be calculated without confirmed historical completion dates. The proposed October schedule provides specific closure targets before the November defense.

## Work Completed

### Implemented Deliverables

| Study objective | Current deliverables |
| --- | --- |
| 1 Store and manage project data | Role-based application, student profiles, batches, companies, positions, scores, recommendations and placement records. |
| 2 Provide competency assessments | Assessment management, question imports, three question types, randomized layouts, grading and skill-category summaries. Scoring and timer defects remain under correction planning. |
| 3 Compare three NLP preprocessors | Saved comparisons of spaCy small, spaCy medium and Stanza English; model configuration and diagnostics in the system. Final selection and runtime resources need alignment. |
| 4 Generate hybrid recommendations | 60% category-score similarity, 25% NLP text similarity and 15% location similarity, with completion gates and stored component scores. |
| 5 Provide analytics and reports | Role dashboards, competency and area summaries, slot and placement analytics, company-based suggestions and student/company report exports. |

### Verification Evidence

| Check | Observed result |
| --- | --- |
| Frontend automated tests | 94 passed; no failures |
| Backend automated tests | 157 discovered; 155 passed and 2 PostgreSQL-only tests skipped |
| Frontend production build | Passed |
| Frontend lint | 0 errors; 5 warnings |
| Django and migration consistency | System check passed; no model migration changes detected |

Backend tests used an isolated SQLite database. They do not establish production PostgreSQL locking, cross-worker behavior or actual external-service availability. Additional internal probes identified the defects listed in Project Status; successful existing tests do not imply a defect-free release.

### Saved Recommendation Results

| Metric | Final hybrid | NLP only |
| --- | --- | --- |
| Top 1 accuracy | 89.33% | 93.00% |
| Hit Rate at 3 | 100.00% | 99.67% |
| Macro precision | 89.70% | 93.16% |
| Macro recall | 89.29% | 93.02% |
| Macro F1 | 89.36% | 93.04% |

These saved results concern 300 synthetic student profiles and six candidate roles. They describe agreement with predefined expected roles, not actual OJT success or project completion. The model percentages do not establish deployment readiness or superiority over studies using other tasks and datasets.

## Work in Progress

| Task | Target | Evidence required |
| --- | --- | --- |
| Finalize report and panel-action matrix | 19 Oct | Review with adviser and submit the current status accurately. |
| Correct grading, payload validation and attempt duration | 23 Oct | Omitted, duplicate, malformed and late-submission checks pass with agreed scoring rules. |
| Correct position validation and save atomicity | 23 Oct | Invalid percentages and slots return clear errors; failed requests leave no partial records. |
| Align password recovery and session behavior | 23 Oct | Visible recovery behavior is truthful; session renewal or reauthentication matches the agreed requirement. |
| Verify hosted integration and model resources | 26 Oct | OAuth, model status, maps, images, imports, exports and served browser policy checked on the intended release. |
| Complete quality and acceptance verification | 29 Oct | Role task results, device/browser matrix, measured performance, PostgreSQL concurrency and restore/rollback evidence. |
| Reconcile paper and final readiness record | 30 Oct | One selected-model explanation, labeled timing run, updated minutes and acceptance checklist. |
| Rehearse and prepare contingency demo | 31 Oct | Complete demo, sample reports, operator notes and backup demonstration available. |

The dates are proposed targets. Actual completion should be recorded only after each task has supporting evidence. Official LMS-format compatibility and the interpretation of required students per agency/area also need adviser confirmation.

## Conclusion

SkillBridge has implementation evidence for all five revised study objectives and most panel-requested functions. Existing automated checks support continued integration work, while the additional review identified specific defects that require correction before deployment acceptance.

The project should currently be reported as having its major functional modules implemented and undergoing final integration, validation and deployment preparation. A 100 percent readiness statement will be appropriate only after the agreed functional scenarios pass, high-impact defects are closed, the intended hosted release is verified, and the remaining quality and operational evidence is accepted.

The next priorities are to submit the progress report on 19 October, complete the targeted corrections, validate the full role workflows, reconcile the manuscript with actual system behavior, and conduct the readiness review before the first-week-of-November defense.
