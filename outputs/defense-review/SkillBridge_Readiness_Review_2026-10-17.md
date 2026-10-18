# SkillBridge predeployment readiness review

Assessment date: 17 October 2026. Progress report due: 19 October 2026. Defense: first week of November 2026; exact date not supplied.

## Decision

**Do not claim 100% deployment readiness yet.** The main application modules are implemented and the existing automated suites pass, but additional isolated checks reproduced assessment-integrity and catalog-validation defects. Deployment configuration also blocks resources used by current features. Hosting, recovery, concurrency, usability and production performance remain unverified.

This is a requirements-led review of the current frontend/backend, relevant project documentation, supplied notebooks, revised paper and defense minutes. It covers architecture, routes, access gates, imports, assessments, grading, combined competency, ranking, placements, analytics, reports, authentication, data freshness and deployment configuration. It is not a line-by-line formal verification, independent penetration test or certification of every screen. No application source was changed, no production database was accessed, no migration was applied to production, and no email or live placement action was performed.

Baseline inspected: commit `227f794`; the working tree had no tracked changes at the initial check. Scratch checks and deliverables were subsequently added. Earlier project notes describe obsolete UI shells; current code and test results take precedence.

## Evidence reviewed

- Revised capstone PDF: 88 pages extracted and searched, with focus on objectives, scope, requirements, methodology, architecture/data models, model testing, implementation, UAT, security and maintenance. Relevant objective/requirement pages were rendered for inspection; this was not a visual proofreading pass of all 88 pages.
- Objectives: PDF page 8 / printed page 7. Functional requirements: PDF pages 28-30 / printed pages 27-29. Non-functional requirements: PDF pages 30-31 / printed pages 29-30.
- Testing/implementation/UAT: PDF pages 76-79. Model result tables: PDF pages 72 and 74, as previously checked in this chat.
- Defense minutes: three pages, outline defense dated 2 June 2026. These contain 17 panel comments, including document revisions and software features.
- Progress report: one-page institutional format, requiring Introduction and Gantt Chart, Project Status, Work Completed, Work in Progress, and Conclusion.
- Two supplied notebooks and five screenshots: saved outputs inspected earlier in this chat without executing notebooks.
- `AGENTS.md`, `knowledge/PROJECT_OVERVIEW.md`, relevant knowledge/reference notes, and assessment, recommendation and webapp-testing skill instructions.

## Checks actually run

| Check | Result | Interpretation |
|---|---|---|
| Existing frontend Node tests | **94 passed, 0 failed** | Existing unit/contract scenarios only |
| Frontend lint | **0 errors, 5 warnings** | Three unused suppression comments and two hook dependency warnings |
| Production frontend build | **Passed**, 387 modules transformed | Does not test hosted headers or authenticated production workflows |
| Backend `manage.py test api --settings=core.test_settings --noinput` | **157 discovered; 155 passed, 2 skipped** | Disposable in-memory SQLite; external integrations mocked where tests require them |
| Django system check with isolated settings | **No issues** | Local configuration/system check, not production approval |
| Migration consistency with isolated settings | **No changes detected** | Model/migration consistency; production migration status not checked |
| Additional assessment/catalog probes | **Eight scenarios recorded**, several defects reproduced | Details below; these are observations, not eight passing acceptance tests |
| Browser with the repository Vercel CSP applied locally | **Blocked Nominatim requests and Supabase image URL** | Confirms repository policy incompatibility; live deployment policy could differ |
| Local model resource check | spaCy small/medium present; Stanza resources unavailable | Package/resource discovery only; production availability not established |
| Public frontend/backend read-only requests | ConnectionError for both | This environment could not verify either deployment; does not prove either host is down |

The ordinary `npm` launcher failed because its user-level npm CLI path was missing. Lint/build were completed with the bundled Node executable and the project's installed ESLint/Vite entry points. This is a local tooling problem, not an application build failure.

The existing profile-image browser workflow initially passed two grouped scenarios, then stopped at a stale selector expecting a `div` where the current company card is an `article`. A scratch runner adapted the company-card selector and then the redesigned assessment button's accessible label, without editing tracked tests or application code. The final rerun passed **six grouped scenarios** (company/photo fallbacks, upload failure/retry, cross-role replacement through SSE, retained drafts, provider-photo recovery, and role dashboard/roster/assessment-header photos). It stopped at the assessment identity image assertion because the redesigned management dialog opens on Overview and the fixture does not select Students & attempts. This is an identified test-navigation mismatch, not evidence that the roster image is defective. Remaining placement-history/remove/mobile scenarios in that script were not reached in the completed rerun. **The full browser workflow did not pass.**

Raw synthetic outputs and reproduction scripts are under `work/defense_audit/`. They contain no real student fixtures or production credentials.

## Confirmed issues that prevent a clean readiness sign-off

### 1 Assessment scores can be inflated by omitted or duplicate questions

Priority: **high**. Relevant code: [scoring.py](../../skillbridge-backend/api/scoring.py), `score_submission`, especially lines 100-117 and 165; [views.py](../../skillbridge-backend/api/views.py), `assessment_submit`, lines 2227-2255.

The grader builds each category's maximum from submitted answer entries, rather than the assessment's complete question set. The endpoint checks that `answers` is a list but does not enforce unique question IDs or complete the authoritative question set.

| Synthetic case | Observed | Expected acceptance rule to agree and enforce |
|---|---|---|
| Two-question assessment; send only one correct question | HTTP 200; **1/1 = 100%** | For full-assessment scoring, **1/2 = 50%**, with omission counted incorrect |
| One correct and one wrong question; repeat the correct answer four times | HTTP 200; **4/5 = 80%** | Reject duplicate IDs, or score each question once: **1/2 = 50%** |
| Submit empty list | HTTP 200, marked submitted, no SkillScore rows | Explicit policy needed; if accepted, record zero against the full denominator and preserve meaningful evidence |
| `answers: ["invalid-item"]` | HTTP 500 | HTTP 400 validation response; no partial finalization |

These API cases bypass client convenience checks. Existing tests passing does not close them. The frontend's `StudentAssessment.jsx` `answersArrayFrom` at lines 331-337 serializes saved answer entries rather than the full question set, and `handleSubmit` sends that array. This makes partial/time-expired submissions an important normal-flow case to verify as well as crafted payloads. Incorrect assessment scores can feed combined competency and recommendations, so this affects objectives 2 and 4 as well as functional requirements 7-8.

Completion evidence: endpoint validates entry shapes, owned questions and choice IDs; rejects duplicates; grades the authoritative question set; tests cover omissions, empty submissions, malformed entries and partial integrity stops, without changing the documented inclusion policy for stopped attempts.

### 2 Attempt duration is not enforced by the backend

Priority: **high**. `views.py` lines 2248-2253 calculates elapsed time, then explicitly does nothing when the allowed duration is exceeded.

A synthetic one-minute attempt with `started_at` moved two hours into the past was accepted with HTTP 200 and marked submitted. This concerns attempt duration; separate assessment `due_at` availability gates exist and are not the same timer.

Completion evidence: adviser-approved late-submission/grace rule, authoritative server enforcement, consistent normal-submit/integrity-stop handling and tests for elapsed duration, refresh, overdue assessments and simultaneous finalization. A browser countdown alone is insufficient.

### 3 Position creation can return errors after saving invalid or partial records

Priority: **high**. `views.py` `admin_company_positions`, lines 3383-3407.

| Synthetic input | Observed |
|---|---|
| `slots: "not-a-number"` | HTTP 500 |
| Requirement percentage 150 | HTTP 201; out-of-range requirement accepted |
| `requirements: []` | HTTP 500 **after one Position row had been created** |

Validation is performed incompletely, and position creation precedes iteration over an unchecked requirements object. Other create/edit catalog paths should be audited for the same contract.

Completion evidence: validate finite percentages 0-100, slot integer bounds and requirement/category structure before writes; use an atomic operation; malformed input returns 400 and leaves no partial position; validate API behavior independently of browser form limits.

### 4 Repository production CSP blocks geocoding and company branding

Priority: **medium**. [vercel.json](../../skillbridge-frontend/vercel.json), lines 15-16.

`connect-src` omits `https://nominatim.openstreetmap.org`, which company/student address workflows fetch. `img-src` omits the Supabase Storage origin from which company images are served. A local Chrome page served with this exact policy emitted `connect-src` and `img-src` violations for synthetic requests to those origins. No real address or personal image was transmitted.

Completion evidence: narrowly allow the actual required origins; verify the served Vercel headers and built-site map/geocoding/branding behavior. Do not remove CSP wholesale. This is confirmed for repository configuration, not a claim that today's remote deployment serves the identical policy.

### 5 Forgot password displays a success message without sending a reset request

Priority: **medium**. [AdminLogin.jsx](../../skillbridge-frontend/src/pages/auth/AdminLogin.jsx), `handleForgotPassword`, lines 67-74; success copy at line 117.

The handler changes local UI state. The source contains a TODO for the missing reset endpoint, yet the screen says a reset link has been sent. No corresponding reset route exists in the API route map.

Completion evidence: either implement and verify password recovery with an approved delivery setup, or remove/replace the misleading control with the actual supported recovery procedure. Password recovery is not separately listed in the 13 requirements, but a visible false-success feature should not be demonstrated as completed.

### 6 The paper's seven-day session claim does not match the frontend flow

Priority: **medium**, requirement/documentation alignment. Paper non-functional requirement 8 promises an active session using seven-day refresh tokens. Backend settings provide eight-hour access tokens and seven-day refresh tokens, and a refresh endpoint exists. However, current frontend code stores the refresh token and reacts to 401 with a session-expired prompt; no frontend refresh-token exchange was found.

Evidence: [SessionContext.jsx](../../skillbridge-frontend/src/context/SessionContext.jsx), lines 24-44; [axios.js](../../skillbridge-frontend/src/api/axios.js), lines 22-26; [settings.py](../../skillbridge-backend/core/settings.py), `SIMPLE_JWT`.

Completion evidence: implement/test the intended renewal behavior, or revise the requirement to describe actual reauthentication. Merely issuing a refresh token does not prove a seven-day active browser session.

## Objectives mapped to current implementation

| Objective from revised paper | Current evidence | Status for report |
|---|---|---|
| 1 Web tool storing profiles, companies, positions, scores and recommendations | Models/migrations, role routes, profile/company/user management and stored recommendation/placement records | Implemented; hosted end-to-end acceptance pending |
| 2 Skills test creation, deployment, answer analysis and classification by skill area | Assessment management, three question types, imports, randomized layouts, grading and category scores | Implemented **with confirmed grading/timer gaps** |
| 3 Select efficient preprocessing model among three | Notebook comparisons, admin NLP diagnostics/configuration and runtime model metadata | Experimental evidence exists; model-selection/timing reconciliation and runtime resources pending |
| 4 Category/text/location matching | `scoring.py`, `recommendation_nlp.py`, combined competency and student/staff result views | Implemented 60/25/15; downstream validity depends on input scores and agreed evaluation |
| 5 Analytics and reporting | `placement_analytics`, management assessment reports, placement reports and frontend PDF/XLSX tools | Implemented; live output reconciliation and user acceptance pending |

All five objectives have implementation evidence. This is not the same as five fully accepted objectives or a 100% deployment score.

## Functional requirements matrix

Status terms: **implemented** means source evidence and relevant existing checks; **partial** means a confirmed issue or required alignment; **unverified** means runtime acceptance evidence is missing. No status below is a production certification.

| FR | Paper requirement | Evidence and qualification | Status |
|---|---|---|---|
| 1 | Secure roles; student Google and staff email/password | Auth routes, JWT, role/object gates. Newly added instructors receive unusable passwords and Google sign-in is supported for staff; reconcile paper's staff-password wording with actual intended workflow | Partial alignment |
| 2 | Student course, ID, phone, address/location profile | Profile route, setup/profile screens, serializer and identity constraints | Implemented |
| 3 | Instructor batches and enrollment/account creation | Enrollment preview/confirm, IAMS-compatible parser, signed review token, identity/duplicate checks, batch scope | Implemented |
| 4 | Companies, locations, positions, capacity, requirements, tags | Catalog CRUD, models, maps and capacity checks; creation has reproduced validation/atomicity defects | Partial |
| 5 | MCQ, true/false, identification, Excel import | Assessment management, bulk question upload and manual/text entry; official LMS sample not supplied | Implemented; institutional format acceptance pending |
| 6 | TF-IDF category suggestions | Category/tag suggestion routes and `suggest_category` | Implemented; taxonomy quality needs representative validation |
| 7 | Assessment answering and automatic grading | Attempt lifecycle, owned choices and exact normalized identification; omission/duplicate/timer/input gaps | Partial |
| 8 | Category percentages and structured profiles | SkillScore and combined raw/max aggregation; defective source denominator affects integrity | Partial |
| 9 | Generate competency/position text | `generate_competency_insights`, `build_position_description`; text reflects category evidence, not verified individual subskills | Implemented |
| 10 | Chosen model preprocessing and TF-IDF similarity | Lazy model loading, actual-model fields, deterministic fallback. Local Stanza resource check failed; production model resources not checked | Implemented mechanism; runtime selection unverified |
| 11 | Hybrid category, NLP and location recommendations | Current ranking is 0.60/0.25/0.15; missing coordinates use neutral 0.5 location score | Implemented; input/evaluation limitations apply |
| 12 | Ranked company/position/score/distance/map | Student dashboard/results, current-result gates and location maps; CSP affects hosted geocoding | Partial deployment verification |
| 13 | Role dashboards, competency/batch/slots/matching insights and reports | AdminReports, staff/student results, company-first placements, PDF/XLSX exports | Implemented; output and UAT acceptance pending |

## Non-functional requirements matrix

| NFR | Paper promise | Readiness assessment and required evidence |
|---|---|---|
| Performance efficiency | Low latency; grading/recommendation in one request | Synchronous implementation exists. Notebook batch timings are not web latency. Agree a workload and numerical target; measure cold/warm submission and results endpoints plus p50/p95 under representative concurrency |
| Reliability | Minimal downtime and automatic failover on cloud services | Cloud names and startup command do not prove failover. Confirm actual plan/topology, failure handling, rollback and restore drill; remove unsupported automatic-failover claims |
| Usability | Students/staff can use UI without specialist knowledge | Representative UI work exists, but no completed participant UAT dataset was supplied. Use task completion, observed errors and the approved questionnaire |
| Security | JWT, roles, HTTPS, throttling, DNSC Google domain | Implemented controls exist; source data integrity flaws remain. Verify production DEBUG/hosts/CORS/TLS, Google configuration, role denials, sensitive log handling and staff recovery |
| Compatibility | Desktop/tablet/mobile and modern browsers | Responsive code and local Chrome fixtures are partial evidence. Complete actual Chrome/Edge and another browser/device matrix, maps/imports/downloads/fullscreen behavior |
| Maintainability | Modular updates/debugging | Separate helpers, docs, migrations and tests support this; the large views module and stale browser selector need maintenance. Record reproducible setup and operator instructions |
| Scalability/adaptability | Add records without loss of speed/accuracy | CRUD is present. Catalog changes can synchronously rerank students. Measure realistic students × positions and SSE connection load on deployed resources; no load test result established |
| Availability/session | Authorized access at any time; seven-day session | Hosting availability not verified; browser token renewal absent from inspected flow. Confirm uptime monitoring, session behavior and outage handling |

Do not invent a model accuracy passing mark or a response-time threshold and describe it as already approved. Ask the adviser to accept measurable project-specific criteria before final acceptance testing.

## Defense minutes compliance matrix

| Panel comment | Current evidence | Remaining action before marking resolved |
|---|---|---|
| Integrate existing LMS exam format | Excel columns and custom QUESTION/TYPE text parser exist | Obtain an official LMS export/sample and record a successful import; generic XLSX support alone does not prove LMS compatibility |
| Follow IAMS student import format | `Student Number`, `Last Name`, `First Name`, `Program`, `YearLevel`, flexible preamble/header discovery, validation and preview | Demonstrate an anonymized official sample and preserve acceptance evidence |
| Suggest students for each company | Company-position grouped, recommendation-ranked suggestions and staff screens | Capture a synthetic completed workflow and ranking explanation |
| Generate reports by company and student | `company_placements` and `student_placements` report types with PDF/XLSX | Reconcile exports to approved placement records and show sample files |
| Objectives aligned to IPO | Five revised objectives cover stored input, processing and outputs | Add explicit objective-to-IPO mapping if adviser expects it; no old-version comparison proves full compliance |
| Test three models | Both notebooks contain small/medium/Stanza saved results | Resolve authoritative run, hardware, model choice and production resource availability |
| Add location matching | Current hybrid and maps include location | Verify real coordinates/missing-location policy and hosted geocoding; update minutes' outdated “planned implementation” wording after acceptance |
| Revise objectives | Revised objectives are present | Get adviser confirmation and update old page references |
| Improve document format | Revised paper exists | Proofread all pages and reconcile figure/table numbers; not certified by this code review |
| Improve Figure 2 | Current Figure 2 is Project Management Team Organization on PDF page 23 | Check intended original figure and legibility; prior version not supplied |
| Agency/area required student numbers in analytics | Slot totals, approved/remaining counts, company groups and area breakdown | Confirm whether “required students” means configured slots or a separate institutional demand target; code uses slot capacity |
| Replace instructor suggestions with system recommendations | System calculates rankings; staff approves/rejects/manually assigns with history | Explain system recommendation versus human placement decision; do not claim autonomous assignment |
| Randomize exam questions | Stored random per-attempt question layout; MCQ options randomized, true/false order fixed | Demonstrate resume stability, different attempts and retake behavior |
| Display student counts per area | AdminReports uses `area_breakdown.student_count` | Verify area definitions and actual approved data counts |
| Functional requirements based on objectives | 13 requirements can be mapped to the five objectives above | Address partial items and keep paper/code terminology consistent |
| Replace evaluation module with dashboard/report features | Operational dashboards/reports are present | Clarify that research model comparison/UAT remain evaluation activities, distinct from the removed operational module |
| Improve waterfall/agile discussion | Revised methodology text and figures exist | Adviser format/content review; no source history proves every requested correction |

The 17-row checklist includes overlapping comments about objectives and document alignment. Use the row-by-row evidence rather than an overall compliance percentage until the adviser confirms each item.

## Paper and experiment issues to resolve

1. **Selected model is inconsistent.** Paper selects spaCy small; the saved final-hybrid notebook selects medium, and the current configuration model defaults to medium. Read the deployed setting rather than assuming a default is the active production value.
2. **Timing differs between artifacts.** Hybrid notebook: 5.948392 / 5.350007 / 138.789032 seconds (small/medium/Stanza). Paper Table 5: 6.092 / 6.114 / 159.761. NLP-only notebook: 5.492162 / 6.250983 / 149.315088; paper Table 4: 5.923 / 6.115 / 154.567. Label the authoritative run and repeat measurements; do not combine timings from different runs.
3. **Synthetic results need explicit scope.** Hybrid Top-1 89.33%, macro precision 89.70%, recall 89.29%, F1 89.36%, Hit Rate@3 100%, on 300 generated students and six roles. These are not real placement-success rates or deployment-readiness percentages.
4. **Hybridization did not demonstrate better Top-1 agreement.** NLP-only saved accuracy is 93%, versus hybrid 89.33%. Practical assessment/location benefits need their own evidence and same-condition ablations.
5. **Notebook/system corpus differs.** Notebook fits TF-IDF on all 300 profiles plus six positions; production `_rank_recommendations` fits on one student's text plus the candidate positions. Exact notebook scores do not automatically describe production ranking.
6. **Optional model loading differs.** Notebooks load/download resources before timing; production never downloads and falls back to small or regex when unavailable. Record requested and actual model. Local resource availability does not prove deployment availability.
7. **Research UAT remains planned in the supplied text.** PDF pages 78-79 describe future user tasks and ISO/IEC 25010-based feedback. No completed responses, analysis or signed acceptance was supplied. Do not write that UAT is complete or that the system is ISO certified.
8. **Operational claims need evidence.** Automatic failover, backup coverage, recovery, monitoring, uptime and seven-day sessions cannot be inferred from cloud-brand names.
9. **Staff authentication wording differs.** The paper specifies staff email/password; admin-created instructor accounts use unusable passwords and the app supports instructor Google sign-in. Agree/document the actual supported login workflow.
10. **Claims such as eliminating evaluator bias are too strong.** System-generated matching can still inherit dataset, label, weight and assessment bias. Describe decision support without claiming unbiased outcomes.

## What may be reported complete on 19 October

The main modules and their actual code deliverables; implemented panel features with the caveats above; the saved synthetic model comparisons; 94 passing frontend tests; 155 passing backend tests and two explicitly skipped PostgreSQL cases; successful frontend build; consistent migrations; and the completed internal review identifying remaining defects.

Do not report: 100% ready, all functional requirements accepted, no defects, successful production load test, automatic failover verified, all three models installed in production, independent real-world model accuracy, completed UAT, or successful backup restore. Those claims are not established.

No numerical overall completion percentage was assigned because there is no approved weighted checklist or completed acceptance record. If the form/adviser requires a percentage, agree the checklist and weighting first, record partial/failed/unverified items, and calculate from that evidence. A model's 89.33% accuracy must never be used as the project's completion percentage.

## Proposed completion schedule

These are recommended targets as of 17 October, not promises or already-completed activities. Confirm team capacity and the defense date with the adviser.

| Target dates | Work | Required evidence |
|---|---|---|
| 17-19 October | Finalize report, requirements matrix, panel-action checklist and defect priorities | Adviser-reviewed report submitted by 19 October; current gaps disclosed |
| 20-23 October | Fix submission scoring, payload validation, timer enforcement, position validation/atomicity; address misleading recovery/session behavior | Negative-case regression checks pass; no partial writes; agreed recovery/session contract |
| 24-26 October | Hosted staging verification; CSP, OAuth, NLP resources, imports, maps, reports and PostgreSQL concurrency/SSE | Tested build identifier, real served headers, sanitized logs, supported model status and workflow evidence |
| 27-29 October | Role-based UAT, compatibility, representative performance/load, backup restore and rollback rehearsal | Approved task checklist, responses/analysis, measured timings, restore/rollback records |
| 30 October | Close critical/high defects; reconcile paper, minutes, selected model and result tables | Signed readiness checklist and coherent manuscript/results |
| 31 October | Defense rehearsal and contingency buffer | Complete demo using synthetic fixtures, sample exports, backup demo and operator guide |
| 1-7 November | Defense on scheduled date | Present only verified current outcomes; avoid changes immediately before demonstration |

## Practical acceptance checklist for 100 percent required scope

- All five objectives and 13 functional requirements have an agreed scenario, expected result and observed pass.
- All confirmed high-impact defects above are corrected and retested; remaining lower-severity issues are documented and accepted by the adviser/owner.
- All panel items have an evidence artifact or an explicit adviser-approved interpretation, including LMS and agency-demand wording.
- Student: authorized Google sign-in, enrollment/profile, assessment start/resume/submit/retake, correct scores, completion gates, current recommendations, map and approved placement visibility.
- Instructor: approved access, IAMS preview/confirm, assessments/imports/randomization, own-batch visibility, competency review, company suggestions and correct exports.
- Administrator: users/approval, taxonomy, company/position input validation, capacities, recommendations, placement decisions/history, analytics and reports.
- Concurrency on disposable PostgreSQL verifies critical attempt/placement locks and cross-worker data freshness, not just SQLite behavior.
- Actual hosted release verifies environment, TLS/headers, CORS, OAuth, email/storage configuration, static routes, NLP requested/actual model and migrations.
- Representative load/performance, network interruption/error recovery, browser/device checks and UAT have results against agreed targets.
- Backup restore, rollback, monitoring, owner responsibilities and recovery instructions are recorded; cloud-service plan capabilities are verified.
- Paper, minutes, notebooks and live demo describe the same selected model, workload, metrics, feature boundaries and operational behavior.

“100 percent” here means the agreed release scope is completed and accepted with evidence. It does not mean 100% prediction accuracy or a guarantee of zero future defects.
