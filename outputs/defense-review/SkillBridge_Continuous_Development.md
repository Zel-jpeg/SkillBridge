# SkillBridge continuous development checklist and task prompts

Created: 18 October 2026.

## Purpose and completion target

This is the **single execution checklist and prompt source** for continuous SkillBridge system development. Implement and verify all agreed features locally, including correct scoring, access control, data consistency and error recovery; then host the completed system and verify it before the predeployment defense in the first week of November.

100% means all agreed feature acceptance criteria pass. It does not mean 100% NLP accuracy or a guarantee of no future defects. Research experiments, paper rewriting, defense-minute wording, formal questionnaire analysis and the October 19 progress report are in the [separate backlog](SkillBridge_Research_and_Documentation_Backlog.md), not counted as system tasks here.

The 28 tasks start **unchecked** because creating this file does not perform or verify them. Existing audit evidence can inform work, but it does not automatically close a task against current code. The [earlier plan](SkillBridge_Completion_Checklist_and_Prompts.md) is a scope reference only; update progress in this file, not in both places.

## Start or resume the complete work

Copy this prompt into a SkillBridge project chat when you want implementation to begin or resume:

```text
Context:
We are developing SkillBridge locally using React/Vite and Django/DRF with PostgreSQL. The goal is 100% of the agreed system features functioning correctly, including validation and error recovery. We will host before the defense. This does not mean 100% NLP accuracy.

Objective:
Use outputs/defense-review/SkillBridge_Continuous_Development.md as the single task checklist and prompt source. Start or resume continuous development from its saved execution state and proceed through every actionable task, without asking me whether to continue after each completed task.

Requirements:
Read AGENTS.md, knowledge/PROJECT_OVERVIEW.md, applicable skills and current code. Follow the execution protocol and dependency rules in the checklist. For each task, implement missing agreed behavior or fix confirmed defects, run meaningful relevant checks, and record evidence. Update its criterion checkboxes, status, work log and the master checkbox only when completion is verified. Save the checkpoint, then move directly to the next actionable task. If a material decision, sample or environment is missing, ask a concise specific question once, record the condition, and continue independent tasks while awaiting the answer. Keep unresolved dependent tasks unchecked.

Constraints:
Local-first development; preserve existing functionality, role/batch boundaries, score and placement history, current UI conventions and user changes. Use synthetic fixtures and isolated databases. Do not reduce agreed scope or invent passing results. No NLP accuracy target, unrelated redesign, framework replacement or unrequested enterprise infrastructure. This prompt authorizes scoped local implementation and tests; it does not authorize production deployment/migrations, real-data repair, live placements/messages, provider permission changes or purchases. Prepare hosting work, and obtain any missing authorization at the exact consequential action. Keep secrets and personal student data out of outputs.

Expected output:
Continue implementation and verification during the active session, updating the checklist after every verified task. Provide brief progress updates, not a final completion message after just one task. If all remaining work is blocked, an interruption occurs or the session must end, save a precise checkpoint with next task, unfinished changes, checks and blockers. Report completion only when every required criterion actually passes, distinguishing local completion from hosted acceptance. The Markdown file preserves progress; it is not a background scheduler.
```

## Execution protocol

1. **Resume safely.** Read the saved state, task records, recent work log, current code and working-tree changes. Preserve user changes. Reconcile existing progress; never reset checked tasks automatically or trust an old pass when affected behavior has changed.
2. **Choose one task.** Pick the first unchecked, unblocked task whose hard dependencies are passed in the current phase. Suggested order is the master checklist order. A dependency can be satisfied by verified existing implementation, not necessarily new code.
3. **Set In progress and save.** Identify the task ID, current step and intended checks in the execution state before editing application behavior.
4. **Use its full prompt and criteria.** The structured prompt supplies Context, Objective, Requirements, Constraints and Expected output. Read relevant skills and trace affected callers, validation and persistence. Implement only missing agreed behavior and confirmed defects.
5. **Verify outcomes.** Run relevant tests/checks using isolated synthetic data; inspect the UI when the behavior needs browser verification. Preserve meaningful assertions. A skipped check, missing sample or unperformed browser/device check is not a pass. Broaden testing when affected integrations or failures justify it.
6. **Handle existing correct behavior.** Do not rewrite it. Verify it against the criteria, record evidence, and close the task as Verified existing behavior if every criterion passes.
7. **Handle a blocker without guessing.** Keep the task unchecked, set Needs decision or Blocked, and record the exact missing policy/sample/access/tool/environment. Ask only the material question needed, avoid repeated requests, and continue independent work. Do not forge evidence, silently reduce scope or claim the system is complete while required blocked items remain.
8. **Check only on verified completion.** Mark the task's criterion checkboxes `[x]`, set its record to Done, then change the corresponding master task checkbox from `[ ]` to `[x]`. Record completion date, tested code/build identifier, check results and evidence paths. Do not invent a Git commit for uncommitted work; describe that working-tree snapshot accurately.
9. **Checkpoint and continue immediately.** Update completed count, next actionable task, blockers and work log, then start that task without a routine permission question. Do not stop simply because one task passed.
10. **Protect phase boundaries.** Finish required local work and S01 before treating the system as locally complete. Hosting preparation follows; actual publication/external writes require the authorization available in the active chat. Missing hosting authorization is a checkpoint condition, not permission to mark hosting done.
11. **Reopen regressions explicitly.** If later work invalidates an earlier pass, uncheck that task, record why and which evidence is stale, and schedule the affected checks again. Do not erase the old history.
12. **Finish honestly.** Declare local completion at S01 and hosted defense readiness only at S02 with the corresponding evidence. Stop and save a precise handoff if no remaining task can proceed. Continuing after an ended/interrupted session requires the user to submit the resume prompt; do not imply background work is running.

Do not spawn additional agents unless the user separately authorizes delegation or applicable instructions require it. If another chat works on this plan, share task IDs explicitly and coordinate ownership; do not concurrently overwrite the checklist or edit the same task area without coordination.

## Execution state

Update this block after each task transition. These initial values describe plan creation, not a fresh application audit.

- Current phase: Hosting preparation after local acceptance
- Run status: User manual test preparation;read-only Supabase preflight completed
- Current task: Manual local frontend/backend test against user-configured Supabase
- Next task: User-operated release→V05/V09/V10 live verification→S02
- Completed tasks: 24 / 28
- Last completed task: A04
- Active changes: Tested application source unchanged from local-final manifest. Addedroot.gitignore protections forwork/tmp/caches/private.envvariants;publish candidates checked without exposingsecrets. Nothing staged/committed/pushed. User manualmigration/testingandGitpublishing remain owner-operated.
- Checks in this execution: Final291PG/116frontend(no skips),lint/build/check/drift;P01format10groups;A04built sign-in+11required/3deniedorigin checks;realSQL+brandingisolatedrestore;realHTTPhealth200→503→200;prior localrole/matrix/performance evidence retained.
- Current blockers: Only four hosted tasks remain:actual user-operated release/integrations,provider backup/rollback,host restart/recovery capability andfinal hosted acceptance. Railway subscription paused;no live mutation boundary or deployauthorization. Manual recovery recommended;automatic failover notverified.
- Next exact action: User backs up intended DB,applies reviewed0015_user_department via normal core.settings,starts local API8000/frontendlocalhost5173,andtests sign-in. Agent has applied no migration;four hosted tasks remain unchecked.
- Last checkpoint date: 18 October 2026;24/28;Gitpushpreflight checked

## Master task checklist

**This is the authoritative task completion list.** Per-task criterion boxes record evidence toward it. Task records and the execution state must agree with these boxes.

### Phase 1 Local system completion

- [x] **S00** Confirm the agreed feature scope and acceptance rules — [task prompt and criteria](#task-s00)
- [x] **A01** Correct assessment scoring and answer validation — [task prompt and criteria](#task-a01)
- [x] **A02** Enforce attempt duration and handle expired submissions — [task prompt and criteria](#task-a02)
- [x] **A03** Validate catalog input and prevent partial saves — [task prompt and criteria](#task-a03)
- [x] **A07** Complete the agreed login and account onboarding methods — [task prompt and criteria](#task-a07)
- [x] **A05** Complete a truthful and usable account recovery flow — [task prompt and criteria](#task-a05)
- [x] **A06** Complete the agreed session renewal and expiry behavior — [task prompt and criteria](#task-a06)
- [x] **N01** Make the selected NLP preprocessor work reliably — [task prompt and criteria](#task-n01)
- [x] **N02** Verify complete recommendation and eligibility behavior — [task prompt and criteria](#task-n02)
- [x] **N04** Verify question suggestions and generated competency text — [task prompt and criteria](#task-n04)
- [x] **P01** Verify accepted LMS questionnaire import format — [task prompt and criteria](#task-p01)
- [x] **P02** Verify official IAMS enrollment compatibility — [task prompt and criteria](#task-p02)
- [x] **P03** Clarify agency demand and area analytics — [task prompt and criteria](#task-p03)
- [x] **E01** Complete consistent validation and error recovery across screens — [task prompt and criteria](#task-e01)
- [x] **E02** Handle unavailable external services without breaking local workflows — [task prompt and criteria](#task-e02)
- [x] **V01** Complete local end-to-end workflows for all three roles — [task prompt and criteria](#task-v01)
- [x] **V02** Reconcile reports, dashboards and placement records — [task prompt and criteria](#task-v02)
- [x] **V04** Verify concurrency and data freshness on PostgreSQL — [task prompt and criteria](#task-v04)
- [x] **V07** Complete browser/device and failure-recovery checks — [task prompt and criteria](#task-v07)
- [x] **V11** Verify reproducible setup and maintenance instructions — [task prompt and criteria](#task-v11)
- [x] **V03** Verify local backend access controls and sensitive-data handling — [task prompt and criteria](#task-v03)
- [x] **V06** Verify acceptable local performance for the agreed workload — [task prompt and criteria](#task-v06)
- [x] **S01** Sign off complete and correct local system behavior — [task prompt and criteria](#task-s01)

### Phase 2 Hosting before the defense

- [x] **A04** Correct production browser policy for maps and images — [task prompt and criteria](#task-a04)
- [ ] **V05** Host the completed release and verify real integrations — [task prompt and criteria](#task-v05)
- [ ] **V09** Verify a usable backup restore and release rollback path — [task prompt and criteria](#task-v09)
- [ ] **V10** Verify startup recovery and basic hosting health checks — [task prompt and criteria](#task-v10)
- [ ] **S02** Accept the hosted system for the predeployment defense — [task prompt and criteria](#task-s02)

## Feature acceptance matrix

Populate and maintain the following matrix during S00 and subsequent work. Use meaningful scenarios rather than just marking modules present.

| Feature / requirement | Role and scenario | Expected result | Invalid or error case | Observed result | Evidence | Status |
|---|---|---|---|---|---|---|
| FR1 Authentication/onboarding | Student DNSC Google; approved instructor Google; admin password | Verified identity, correct role and approval/activity/enrollment gates; no shared password | Bad credential/domain/token, inactive/unapproved, role spoof; provider outage | Real local role sign-ins, verified-provider adapters, approval/enrollment/activity gates, assisted admin recovery and session cases passed | A07/A05/A06/V03;knowledge/AUTHENTICATION_AND_RECOVERY.md;v06-linked-workflow.txt;v06-session-browser.txt | Verified locally; live provider configuration remains hosting acceptance |
| FR2 Student profile | Enrolled student edits own course, school ID, contact, address and pin | Valid save survives reload; only own profile editable | Duplicate ID/email, invalid coordinates/contact, failed save retains draft | Own-profile details/address/pin persist through real API/reload; validation, forbidden access and failed-write draft recovery passed | E01/E02/V01/V07;knowledge/VALIDATION_AND_RECOVERY.md;v06-linked-workflow.txt | Verified locally |
| FR3 Batches and enrollment | Instructor owns batch; admin authorized oversight; import review/confirm | Manual/IAMS import creates or links exact identities once; truthful delivery state | Foreign batch, archived batch, duplicate/ambiguous IDs, stale preview, dispatch failure | Existing official IAMS layout confirmed by user; synthetic parser/review/confirm, identity boundaries and real browser import passed; importer preserved | P02;knowledge/IAMS_ENROLLMENT_IMPORT.md;V01/V07;v06-linked-workflow.txt | Verified against accepted official layout; live notification delivery remains hosting-only |
| FR4 Companies/positions | Admin CRUD; instructor supported company edit | Company/location/tags and finite 0–100 requirements; integer capacity respects approved seats | Malformed slots/requirements, forbidden mutations, partial save, unsafe delete | Atomic validation/capacity/protected-history checks and admin/instructor draft retry/pin cases passed | A03/E01/E02/V04;knowledge/CATALOG_VALIDATION.md;v06-postgres-final.txt | Verified locally |
| FR5 Assessment authoring/import | Instructor own batch; admin oversight | Create/edit/publish/close MCQ, true/false, identification; current Excel/text import | Bad choices/key/type/category, foreign owner, published edits, bad/oversized file | Current final accepted XLSX/CSV/text mixed types, choices/keys/categories, invalid-key rejection and recovery passed in creator and append screens; unseen official file comparison is a later follow-up | P01/E01/V01;v06-linked-workflow.txt;knowledge/LOCAL_WORKFLOW_ACCEPTANCE.md | P01 accepted final format verified; later external comparison not claimed |
| FR6 Question suggestions | Staff requests suggestions and overrides them | TF-IDF suggestion with human correction and usable no-suggestion state | Empty text/taxonomy, outage, unauthorized caller | Local synthetic API and real builder: staff gates, bad inputs, ambiguous/no result, accept/manual override and outage draft retention passed | api.test_question_assistance; n04-postgres-final.txt; n04-browser.txt | N04 verified locally; no accuracy target |
| FR7 Attempt delivery | Enrolled student starts/resumes assigned published assessment | Stable randomized question/choice order per attempt; safe refresh and correct availability | Foreign/draft/upcoming/closed assessment, changed browser clock, stale retake | Assigned visibility, stable randomized resume layout, attempt identity and availability gates passed | A02/V01/V03;v06-linked-workflow.txt;v06-timing-browser.txt | Verified locally |
| FR7 Timing and integrity stop | Student submit/timer/stop; instructor review/retake | Server duration + 30-second grace; later arrivals require instructor review; one finalization | Delayed network, repeated/concurrent stop/submit, due-date boundary, retry | Exact server deadline/grace/late review, one locked finalization, retry and retake history passed on PostgreSQL and real browsers | A02/V04/V07;knowledge/ASSESSMENT_SUBMISSION_INTEGRITY.md;v06-postgres-final.txt;v06-timing-browser.txt | Verified locally |
| FR7–8 Assessment scores | Student submits; authorized staff review | Each authoritative question once; omissions/empty score zero; 1/2=50%, 7/10=70%; normalized exact identification | Duplicate, malformed, foreign question/choice, empty/cleared inputs; no partial writes | Known raw/max, omissions/empty/cleared input, exact identification, invalid/no-write and rollback cases passed; batched writes preserve IDs | A01/V06;knowledge/ASSESSMENT_SUBMISSION_INTEGRITY.md;v06-postgres-final.txt | Verified locally |
| FR8 Combined evidence/history | Student finishes required batch work; staff grants retake | Weighted raw/max totals, stop exclusions, required gates; archived attempt and placement history preserved | Incomplete batch, stopped/flagged/draft/excluded evidence, retake, stale results | Weighted required completion, stop/exclusion gates, retake archive/relock and unchanged placement snapshots passed | N02/V01/V06;knowledge/RECOMMENDATION_CONTRACT.md;v06-linked-workflow.txt;v06-postgres-final.txt | Verified locally |
| FR9 Generated narratives | Student/staff competency and position descriptions | Text reflects actual category evidence, requirements and tags | No evidence/tags, tied categories; no invented individual subskill mastery | Zero/tied scores and contextual vocabulary verified; new text version preserves existing saved history | api.test_question_assistance; api.test_nlp_diagnostics; knowledge/QUESTION_ASSISTANCE.md | N04 verified locally |
| FR10 Selected NLP | Admin selects supported model; runtime matching | Selected resource loads or actual fallback/model metadata truthfully reported | Unavailable model/resources, blank corpus, empty vocabulary | Actual selected spaCy Medium runs; missing-resource fallback and strict failures are truthful; changed text/model cache boundaries passed | N01/V06;knowledge/NLP_RUNTIME_VERIFICATION.md;knowledge/PERFORMANCE_VERIFICATION.md | Verified locally; no NLP accuracy target |
| FR11 Hybrid ranking/eligibility | Student current combined matches; staff company-first suggestions | 60/25/15 category/text/location components; ranking separate from approval eligibility | Zero evidence, missing coordinates, no positions, obsolete results, locked batch | Exact components, invalid/missing coordinates, stable ties, evidence gates/retakes and capacity denial passed | api.test_recommendation_contract; test_combined_competency; n02-postgres.txt; n02-browser.txt | N02 verified locally |
| FR12 Results/maps | Student own ranked company/position/score/distance/map | Correct ordering and map/distance; truthful missing-coordinate and locked/empty states | Map/geocoder/image outage, forbidden result ID, loading/retry failures | Ranking/distance/empty/locked states, saved pins and map/geocode/image failure recovery passed with provider adapters | N02/E02/V01/V07;knowledge/EXTERNAL_SERVICE_RECOVERY.md;v06-linked-workflow.txt | Local behavior verified; real hosted providers/CSP remain A04/V05 |
| FR13 Placement actions | Admin system-wide; instructor own batch | Company-first ranked students; approve/reject/remove/manual assign within rules; snapshots retained | Full capacity, duplicate/concurrent approval, foreign batch, stale evidence, repeated click | Approve/remove/reassign, repeated clicks, capacity races, foreign scope/stale evidence and snapshots passed | V01/V02/V04/V03;v06-postgres-final.txt;v06-linked-workflow.txt | Verified locally |
| FR13 Dashboards/reports | Each role sees scoped counts; staff student/company exports | Accurate competency, batch, available seats, placement and agency/area totals; PDF/XLSX agree | Empty/filter results, removed placements, download failure, cross-batch leakage | Panel-confirmed slot/area meaning and known synthetic row/count/PDF/XLSX reconciliation passed | P03/V02;knowledge/CAPACITY_AND_AREAS.md;knowledge/REPORT_RECONCILIATION.md;v06-linked-workflow.txt | Verified locally |
| Data freshness and drafts | All roles/accounts; mounted lists and explicit report snapshots | Scoped SSE/revalidation, identity/cache reset, drafts retained, snapshots show staleness | Reconnect, missed event, deleted/inaccessible record, failed follow-up read, account switch | Recipient-scoped commit/rollback events, reconnection, forbidden access, cache identity and failed-write draft recovery passed | V04/E01/A06;knowledge/LIVE_DATA_FRESHNESS.md;v06-postgres-final.txt;v06-session-browser.txt | Verified locally; hosted proxy/worker behavior remains V05 |
| NFR1 Performance | Synthetic submit/results/navigation cold and warm | Scoring/recommendations in request; accepted numerical latency and workload verified | Model cold start, large catalog, timeout and recoverable error | Accepted200/8/2x30/20-user workload:324requests0errors,submitp95=3.628s,reads+20streams=1.674s,cold11.801s,loadedUI4.826s;sample/setup limits recorded | V06;knowledge/PERFORMANCE_VERIFICATION.md;v06-results-varied.json | Verified locally for accepted workload; hosting measurements remain V05 |
| NFR2 Reliability | Local outages then actual hosting operator | Bounded errors/recovery; isolated restore and rollback; verify promised failover capability | Database/service outage, restart, storage failure, interrupted deploy | Local bounded provider/database error handling, retry and truthful recovery passed; hosted restore/rollback/restart not executed | E02;knowledge/EXTERNAL_SERVICE_RECOVERY.md;V09/V10 | Local cases verified; hosted operational acceptance pending |
| NFR3 Usability | Student, instructor, admin complete routine tasks | Readable actionable screens, field errors, draft recovery, safe retries | Empty/forbidden/conflict/server/network failures; loading clears | Three roles complete real lifecycle; dialogs, field errors, empty/loading/conflict and retained-draft retry cases passed | E01/V01/V07;knowledge/LOCAL_WORKFLOW_ACCEPTANCE.md;knowledge/BROWSER_MATRIX_VERIFICATION.md | Verified locally; formal surveys remain separate backlog |
| NFR4 Security | Unauthenticated and each synthetic role directly calls APIs | JWT/domain/role/object/batch gates; no answer-key or private cache/log leakage | Spoofed identity, expired JWT, cross-role/cross-batch IDs, malformed payload | Direct role/object/batch/JWT matrix, answer-key/cache/log boundaries and legacy snapshot protection passed | V03;knowledge/LOCAL_SECURITY_REVIEW.md;v06-postgres-final.txt | Verified locally; hosted TLS/CORS/proxy/provider exposure remains V05 |
| NFR5 Compatibility | Desktop/tablet/mobile modern browsers | Imports/downloads/maps/assessment/fullscreen work on agreed browser/device matrix | Small viewport, unsupported fullscreen, offline/reload, provider blocked | Accepted Chrome/Edge desktop and Chrome tablet/phone emulation passed imports/downloads/blocked maps/fullscreen/mobile flow and recovery | V07;knowledge/BROWSER_MATRIX_VERIFICATION.md;v06-linked-workflow.txt | Accepted local matrix verified; physical devices and hosted policy not claimed |
| NFR6 Maintainability | Fresh local operator setup | Documented dependencies/env/migrations/models/checks and recovery reproduce | Missing optional model/tool, safe configuration error, stale guidance | Clean dependency/model/environment setup verified in V11; unchanged dependency set with current checks/build/tests passes | V11;knowledge/LOCAL_SETUP_AND_OPERATIONS.md;v06-system-check.txt;v06-migration-check.txt;v06-build.txt | Verified local setup; current source regressions passed |
| NFR7 Scalability/adaptability | Synthetic additions to students/catalog/categories/assessments | Correct ranking/capacity/history and accepted response times as data grows | Concurrent mutation, taxonomy edits, stale SSE, capacity race | Taxonomy/capacity/concurrent mutation cases and accepted200-student/8-position workload passed with varied score patterns | V04/N02/V06;knowledge/POSTGRES_CONCURRENCY_VERIFICATION.md;knowledge/PERFORMANCE_VERIFICATION.md | Verified locally within agreed workload |
| NFR8 Session/availability | All authorized roles across access-token expiry and logout | Seven-day refresh-based session, bounded expiry/logout; host availability separately verified | Invalid/revoked refresh, simultaneous 401, offline refresh, account switch | Fixed refresh boundary, single-flight renewal, invalid/revoked refresh, logout/account switching and owning draft isolation passed | A06/V03;knowledge/AUTHENTICATION_AND_RECOVERY.md;v06-session-browser.txt | Local session verified; host availability remains V05/V10 |


S00 can finish once the matrix and known decisions are recorded and genuinely unresolved choices are explicitly logged. It must not pretend that missing samples or pending choices have been resolved. Those choices remain dependencies of the affected implementation/verification tasks and prevent final acceptance until resolved.

### Recorded decisions and unresolved inputs (S00)

Source scope: revised paper FR1–13 and NFR1–8, PDF pages 28–31, extracted in `work/defense_audit/paper.txt`; software panel requests in `work/defense_audit/minutes.txt`. The earlier readiness review maps those requirements; current routes, models, graders and progress helpers were inspected for this matrix. These are source references, not fresh runtime passes. No objective or paper promise has been silently removed.

| Decision/input | Recorded contract or exact unresolved question | Affected tasks |
|---|---|---|
| Late submissions | User, 18 October: allow 30-second submission grace, then require instructor review. Implement server time; preserve recoverable answers and do not silently count late evidence as ordinary completion. | A02 |
| Staff login/recovery | User, 18 October: Google for instructors; password for admins with administrator-assisted recovery. Record paper FR1 staff-password mismatch as an explicitly selected workflow, not a fabricated implementation pass. Student DNSC Google remains required. | A07/A05 |
| Session | Retain the stated seven-day refresh-based session contract. Backend eight-hour access/seven-day refresh exists; implement frontend renewal and test expiry/logout. No request to reduce this requirement. | A06 |
| Official LMS sample | User18October explicitly designates the existing Excel/CSV/text questionnaire format as final for the28-task release; compare/adapt later this week when the adviser file arrives. Current accepted-format checks gate P01; external equivalence is not claimed and that later comparison no longer blocks S01. | P01 |
| Official IAMS format | User18October confirms the existing enrollment format is correct and came from official IAMS. Treat current documented headers/layout as accepted schema; preserve importer and verify with synthetic records. Previous missing-format assumption is superseded. | P02 |
| Agency demand | User clarified 18 October: agency demand is slot capacity minus assigned/approved students; area analytics sums assigned students across companies in that area (3 at company A + 3 at company B in Davao City = 6). No separate target-count module. | P03 |
| Performance | User explicitly accepted 200 synthetic students,8positions,2assessments x30questions,20concurrent users;p95 reads <2s,warm submit/results <5s,first model load <15s. V06 verified the accepted baseline;see recorded final measurements and limits. | V06 |
| Selected NLP model | Inspect stored/default configuration and actual resources in N01; no accuracy target or invented model-selection decision. | N01 |
| Hosting/reliability | Local S01 precedes hosting work. Actual host configuration, backup/failover capabilities and operator need evidence. No deployment, production migration, live email, purchase or provider permission change authorized. | A04/V05/V09/V10/S02 |

Research evaluation labels, thesis changes, formal questionnaires and the October 19 report remain in the separate backlog. Local acceptance is S01; hosted defense readiness is S02. Neither can be inferred from source presence or task counts.

### Scope reference

Map each item to current implementation and a successful case plus relevant invalid/error/recovery cases. Acceptance is by feature, not by number of task IDs.

| Agreed feature group | Required behavior to verify |
|---|---|
| Authentication and access | Agreed role-specific login/onboarding, approval/activity/enrollment gates, session renewal/expiry, logout and supported recovery |
| Student profiles | Course/ID/contact/address/location validation, saving, refresh and safe edit failure |
| Batches and enrollment | Instructor batch scope, supported IAMS/manual import, preview/confirm, duplicate/identity checks and truthful notifications |
| Company and position catalog | Profiles, locations, tags, requirements, capacity, validation, authorized changes and safe deletion/history boundaries |
| Assessments | Create/edit/import/publish/availability, supported LMS format, MCQ/true-false/identification, randomized attempts, resume, timing, submission and retakes |
| Scoring and combined evidence | Authoritative denominators, correct percentages, safe input, weighted raw/max totals, history and required-completion gates |
| Question assistance and text | Suggestions with human correction and failure fallback, generated competency/position text based on actual evidence |
| Recommendation and maps | Supported selected preprocessor, TF-IDF/category/location components, ranked/current results, distance/map, locked/empty/error states |
| Placements | Company-first student suggestions, approval/rejection/removal/manual assignment as agreed, capacity limits, scope and history snapshots |
| Dashboards and exports | Role statistics, student/agency/area and available-slot figures, accurate student/company reports, filters and downloads |
| Data freshness | Correct identity/cache reset, scoped updates, stale/deleted records, snapshot meaning and draft preservation |
| System qualities | Agreed local response time, usable supported screens, access/security, representative concurrency, browser/device behavior, setup/recovery and later hosted configuration |

These cover the five objectives, the 13 functional requirements and the applicable eight non-functional requirements. Match the precise contracts during S00; do not invent a separate agency-demand module or a particular LMS export format without the needed specification. An unsupported paper promise must be resolved explicitly, not quietly removed to obtain a completion claim.

### Error handling contract

- Validate in the backend as well as the browser. Show useful field-level or operation-level messages for invalid data.
- Handle relevant unauthenticated/expired, forbidden, missing, conflict, oversized, rate-limited and temporary service/server responses without exposing secrets.
- Clear loading indicators, avoid duplicate submissions/records, retain recoverable drafts/answers, and offer a safe retry where appropriate.
- Keep multi-record changes atomic or provide an explicit consistent recovery state. Never claim success for an operation that failed or delivery for a message merely queued.
- Treat network timeouts and failed follow-up reads carefully: a write may already have committed. Do not blindly replay uncertain mutations.
- Reconcile stale/deleted or newly inaccessible records, preserve historical scores/placement snapshots, and prevent one role/account from seeing another account's cached data.
- Handle empty data and unavailable optional services/models/images gracefully without fabricating results or concealing which model was actually used.
- Verify failure cases using synthetic fixtures/mocked outages. The checklist is a test contract, not an assertion that each failure is currently present.

## Individual task prompts and completion records


<a id="task-s00"></a>

### S00 Confirm the agreed feature scope and acceptance rules

**Type:** Scope and policy. **Order:** Start here.

All five objectives have implementation evidence. This task defines what must work; it does not label all modules missing. Use the 13 functional and eight non-functional requirements and the software-related panel requests as the source checklist.

**Phase:** Local system development. **Hard dependencies:** None.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Defined 25 feature scenarios covering FR1–13, NFR1–8, panel requirements, success/error/role cases; recorded decisions and unresolved inputs without claiming runtime acceptance
- Affected files: This checklist and work/defense_audit/{checkpoint,scope_checkpoint}.py
- Tested commit or working-tree build: Source baseline 227f794; uncommitted checklist/tooling changes; application unchanged
- Checks and outcomes: Read current auth/assessment/catalog/placement routes, frontend route map, scoring/models and combined evidence helpers; compared extracted requirements/minutes and readiness mapping; document validation recorded below
- Evidence paths: Feature matrix and decision register above; work/defense_audit/paper.txt and minutes.txt (existing extracted reference evidence)
- Blocker or material decision: S00 definition complete; unresolved LMS/IAMS samples, agency-demand meaning and performance target remain dependencies of later tasks
- Next exact action: A01: write/run isolated regression cases before replacing grading logic

**Acceptance checklist:**

- [x] Create a feature-by-feature matrix covering the scope map below, with an expected successful result, invalid/error cases, role boundaries and evidence for each feature.
- [x] Record existing decisions about late submissions, staff login/recovery, seven-day renewal, LMS format and agency demand. Identify genuinely unresolved choices with affected task IDs and exact questions; continue independent matrix work without claiming those choices are resolved.
- [x] Do not reduce agreed requirements merely to declare completion, expand scope into unrelated features, or substitute NLP accuracy for completion. Record proposed changes for the user/adviser to accept.
- [x] Distinguish local feature completion from final hosted verification. Independent research labels, thesis edits and formal survey statistics are tracked separately.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is S00; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Confirm the agreed feature scope and acceptance rules.

Requirements:
Follow SkillBridge AGENTS.md. Read S00 and the scope map in outputs/defense-review/SkillBridge_Continuous_Development.md. Build a concrete acceptance matrix for every agreed system feature, role workflow and error case using current code and the project requirements. Identify actual missing/broken behavior separately from implemented features needing tests. Preserve recorded decisions and request only unresolved material policy choices. Do not weaken requirements, add unrelated features or use NLP accuracy as project completion. Prepare the matrix for the remaining system tasks.

The acceptance outcomes for this task are:
1. Create a feature-by-feature matrix covering the scope map below, with an expected successful result, invalid/error cases, role boundaries and evidence for each feature.
2. Record existing decisions about late submissions, staff login/recovery, seven-day renewal, LMS format and agency demand. Identify genuinely unresolved choices with affected task IDs and exact questions; continue independent matrix work without claiming those choices are resolved.
3. Do not reduce agreed requirements merely to declare completion, expand scope into unrelated features, or substitute NLP accuracy for completion. Record proposed changes for the user/adviser to accept.
4. Distinguish local feature completion from final hosted verification. Independent research labels, thesis edits and formal survey statistics are tracked separately.

Constraints:
Follow the global execution protocol and relevant dependency decisions (None). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify S00, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep S00 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-a01"></a>

### A01 Correct assessment scoring and answer validation

**Type:** Confirmed defect. **Order:** First fixes.

Reproduced in the prior isolated audit: one correct response from a two-question assessment scored 100%; repeating a correct question four times plus one wrong question scored 80%; malformed entries caused HTTP 500. Recheck before fixing.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Reproduced and fixed omission/duplicate inflation; validate complete payload before writes, authoritative maxima, accepted zero-score empty submissions, exact identification and completed-only stop answer persistence; existing real history untouched
- Affected files: api/scoring.py, api/views.py, api/test_submission_integrity.py; knowledge/ASSESSMENT_SUBMISSION_INTEGRITY.md and PROJECT_OVERVIEW.md
- Tested commit or working-tree build: 227f794 plus uncommitted A01 application/test/doc changes; no deployment or migration
- Checks and outcomes: Before: 8 new tests, 35 failing subcases and 2 errors. After: 52 tests passed in 4.424s across submission_integrity/tests/multiple_assessments/combined_competency; isolated in-memory SQLite, mocked NLP only in focused cases. Includes 1/2=50%, 7/10=70%, empty categories=0, 32 invalid endpoint subcases/no writes, mixed types, stop exclusion, rollback, retake/history/completion gates. Python compilation passed. PostgreSQL concurrency remains V04.
- Evidence paths: work/defense_audit/a01-before.txt, a01-after.txt; api/test_submission_integrity.py; submission integrity knowledge note
- Blocker or material decision: None for A01. Existing historical real scores were not repaired; scoped local synthetic verification only.
- Next exact action: A02: implement user-approved server deadline + 30-second grace, review state, retake identity and browser recovery; PostgreSQL concurrency needs isolated environment

**Acceptance checklist:**

- [x] Use the authoritative assessment question set for category denominators: one correct of two is 50%, and seven correct with three omitted is 70%.
- [x] Validate answer entry shapes and IDs; reject duplicates and foreign questions/choices with clear errors and no partial persistence. Define accepted empty submissions consistently.
- [x] Preserve MCQ, true/false, exact normalized identification, retake resets, stopped-attempt evidence rules, completion gates and score history.
- [x] Cover omitted, empty, duplicate, malformed and foreign answers and verify downstream combined competency/recommendations. Do not silently recalculate historical real records.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is A01; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Correct assessment scoring and answer validation.

Requirements:
Follow SkillBridge AGENTS.md and use the assessment-review and recommendation-audit skills. Read A01 in outputs/defense-review/SkillBridge_Continuous_Development.md. Reproduce and fix omitted-question and duplicate-answer score inflation and malformed/foreign answer handling. Grade each authoritative question once, preserve attempt/retake/stopped-evidence rules, and prevent partial writes. Trace the frontend payload and downstream combined competency. Add meaningful isolated regression checks, document historical-data impact, and do not rewrite real scores or placements.

The acceptance outcomes for this task are:
1. Use the authoritative assessment question set for category denominators: one correct of two is 50%, and seven correct with three omitted is 70%.
2. Validate answer entry shapes and IDs; reject duplicates and foreign questions/choices with clear errors and no partial persistence. Define accepted empty submissions consistently.
3. Preserve MCQ, true/false, exact normalized identification, retake resets, stopped-attempt evidence rules, completion gates and score history.
4. Cover omitted, empty, duplicate, malformed and foreign answers and verify downstream combined competency/recommendations. Do not silently recalculate historical real records.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify A01, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep A01 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-a02"></a>

### A02 Enforce attempt duration and handle expired submissions

**Type:** Confirmed defect / policy. **Order:** After expiry rule.

The earlier audit accepted a one-minute attempt started two hours earlier. The server calculates elapsed time but does nothing when it exceeds the duration. Availability due dates and attempt duration are separate checks.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Server duration plus approved 30-second grace; later answers atomically saved as flagged stopped review evidence, excluded from combined completion. Start returns server remaining/deadlines; monotonic browser timer; required per-retake started_at identity for submit/stop; stale requests cannot finalize new retake. No schema migration.
- Affected files: api/attempt_timing.py, api/views.py, api/test_attempt_timing.py; existing assessment test payloads; StudentAssessment.jsx, utils/assessmentClock.js and tests/attempt_timing_{server,playwright}.py
- Tested commit or working-tree build: 227f794 plus uncommitted A01/A02 changes
- Checks and outcomes: 59 focused SQLite backend tests passed; full API at A03 snapshot 179 discovered/176 passed/3 skips. Then 22/22 timing, submission-integrity and catalog tests passed on dedicated PostgreSQL 17.11 at 127.0.0.1:55438, including actual concurrent submit/stop row-lock race (no skip). Matching retake identity, exact grace boundary, late review, resume, due gate, malformed/no-write and history checks passed. Frontend 95 tests/build passed, lint 0 errors/5 pre-existing warnings. Four grouped real local Chrome cases passed with no page errors: monotonic clock, retained failed-submit answers, explicit retry, expired resume review.
- Evidence paths: work/defense_audit/a02-a03-postgres.txt, a02-backend.txt, a02-browser.txt, a03-all-backend.txt; api/test_attempt_timing.py; tests/artifacts/attempt-timing/results.json and screenshots
- Blocker or material decision: Resolved: official portable PostgreSQL runtime downloaded and initialized in ignored workspace; only disposable test database used. No live Supabase access. Broader data-freshness/capacity concurrency remains V04.
- Next exact action: Continue A07; preserve current timer/review contracts and rerun relevant cases if later changes affect them.

**Acceptance checklist:**

- [x] Implement the recorded expiry/grace policy using server time; obtain a material missing rule before implementing its consequences.
- [x] Refreshing or changing browser time cannot extend an attempt. Handle on-time, late and connection-delayed submissions with truthful messages and the agreed answer-saving behavior.
- [x] Normal submit, timer completion and integrity stop cannot finalize twice. Prevent stale requests from finalizing a different retake.
- [x] Test expiry, resume, due-date boundaries, repeated requests and concurrent finalization; preserve recoverable local answers on retryable failures.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is A02; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Enforce attempt duration and handle expired submissions.

Requirements:
Follow SkillBridge AGENTS.md and the assessment-review skill. Read A02 in outputs/defense-review/SkillBridge_Continuous_Development.md. Implement the agreed server-authoritative attempt-duration rule across start/resume/submit/stop and the frontend countdown. If the late/grace policy is genuinely unresolved, prepare a concrete proposal and obtain that decision first. Preserve answer recovery, retake identity and single finalization. Verify on-time, expired, refreshed, delayed and concurrent requests with isolated fixtures, including clear user-facing outcomes.

The acceptance outcomes for this task are:
1. Implement the recorded expiry/grace policy using server time; obtain a material missing rule before implementing its consequences.
2. Refreshing or changing browser time cannot extend an attempt. Handle on-time, late and connection-delayed submissions with truthful messages and the agreed answer-saving behavior.
3. Normal submit, timer completion and integrity stop cannot finalize twice. Prevent stale requests from finalizing a different retake.
4. Test expiry, resume, due-date boundaries, repeated requests and concurrent finalization; preserve recoverable local answers on retryable failures.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify A02, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep A02 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-a03"></a>

### A03 Validate catalog input and prevent partial saves

**Type:** Confirmed defect. **Order:** First fixes.

The prior audit reproduced invalid slots causing 500, a 150% requirement being accepted, and malformed requirements causing 500 after a position was created.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Shared backend company/position validation; nonnegative integer slot range consistent with existing instructor zero-capacity support; finite 0–100 known-category requirements; duplicate/foreign input rejection; atomic create/edit/requirements replacement; capacity locks and protected history; retained drafts/errors, guarded clicks and confirmed-only delete UI
- Affected files: api/catalog_validation.py, api/company_images.py, api/views.py, api/test_catalog_validation.py; AdminCompanies.jsx, useAdminCompanies.js, ConfirmModal.jsx; tests/catalog_validation_playwright.py; knowledge/CATALOG_VALIDATION.md and overview
- Tested commit or working-tree build: 227f794 plus uncommitted A01/A02/A03 changes; no production data, migration or external mutation
- Checks and outcomes: Before-fix 6 tests reproduced validation exceptions and partial writes (initial history fixture used wrong field; corrected to assigned_by before passing run). Focused catalog/images/placement suite: 57 discovered, 56 passed, 1 skipped. Full API: 179 discovered, 176 passed, 3 explicit skips. Frontend 95/95 tests, lint 0 errors/5 existing warnings, build passed. Four grouped Chrome UI cases passed, no page errors: invalid decimal, retained zero-capacity draft and server error, one request per repeated activation, explicit retry, protected delete retains row/dialog, success removes only after confirmation. Image mocks verify cleanup/protected history; no live Storage.
- Evidence paths: work/defense_audit/a03-{before,after,all-backend,browser,lint,build,node-tests}.txt; tests/artifacts/catalog-validation/{results.json,mobile.png}; api/test_catalog_validation.py
- Blocker or material decision: None for A03. Broader PostgreSQL races remain A02/V04; isolated portable runtime initialization in progress.
- Next exact action: A07 verify Google instructor/student and admin-password policy with mocked provider, fix confirmed inactive/role/validation issues, then A05 assisted recovery

**Acceptance checklist:**

- [x] Validate company/position fields, requirement object structure, known categories, finite 0-100 percentages and the agreed integer slot bounds before related writes.
- [x] Reject invalid requests without leaving partial records; use transaction boundaries and safe external-resource cleanup where applicable.
- [x] Keep capacity at or above approved placements and protect referenced placement/history records from destructive catalog actions.
- [x] Verify admin/instructor permissions, create/edit/delete paths, repeated clicks and error recovery; preserve unsaved form values on failure.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is A03; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Validate catalog input and prevent partial saves.

Requirements:
Follow SkillBridge AGENTS.md. Read A03 in outputs/defense-review/SkillBridge_Continuous_Development.md. Reproduce and fix catalog input validation and partial saves across affected company/position APIs and forms. Validate slots, finite 0-100 requirements, category references and payload shapes on the backend, and make related writes atomic. Preserve approved capacity, historical records and role permissions. Return actionable errors and preserve drafts. Add isolated regression checks for invalid input, rollback and retries without reranking live students.

The acceptance outcomes for this task are:
1. Validate company/position fields, requirement object structure, known categories, finite 0-100 percentages and the agreed integer slot bounds before related writes.
2. Reject invalid requests without leaving partial records; use transaction boundaries and safe external-resource cleanup where applicable.
3. Keep capacity at or above approved placements and protect referenced placement/history records from destructive catalog actions.
4. Verify admin/instructor permissions, create/edit/delete paths, repeated clicks and error recovery; preserve unsaved form values on failure.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify A03, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep A03 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-a07"></a>

### A07 Complete the agreed login and account onboarding methods

**Type:** Requirement alignment. **Order:** Decide early.

The paper specifies staff password login, while newly created instructors have unusable passwords and can use Google. Implement the agreed role contract; rewriting the paper alone is not an application fix.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Agreed DNSC Google student/instructor and admin-password contract enforced; inactive and unverified Google accounts cannot get tokens; existing roles cannot be elevated through registration; pending/enrollment gates retained; provider/payload failures handled; admin instructor onboarding validates fields and creates no password; queued mail no longer claims delivery
- Affected files: api/views.py, api/backends.py, api/test_auth_contract.py, api/test_auth_deadlines.py; auth LoginPage/AdminLogin.jsx; useAdminUsers.js notification copy; knowledge/AUTHENTICATION_AND_RECOVERY.md and overview
- Tested commit or working-tree build: 227f794 plus uncommitted A01/A02/A03/A07 changes; all synthetic fixtures/mocked provider and mail; no live accounts/messages
- Checks and outcomes: New pre-fix 6 tests reproduced 6 failures/8 errors. Focused auth/provider/images: 40 discovered, 39 passed/1 skipped before added onboarding case. Final full API: 186 discovered, 183 passed/3 explicit skips. All 95 frontend unit tests passed, build passed, lint 0 errors/5 existing warnings. Twelve mocked-provider/API Chrome cases passed with no page errors, covering pending/unenrolled/invalid/unverified/disabled/denied/outage/admin redirect/password methods.
- Evidence paths: work/defense_audit/a07-{before,after,all-backend,browser,lint,build,node-tests}.txt; tests/artifacts/auth-contract/results.json; api/test_auth_contract.py
- Blocker or material decision: None for local A07. Hosted provider configuration remains V05; administrator-assisted recovery selected by user is implemented/verified separately in A05.
- Next exact action: A05 replace fake reset-success control with truthful assisted recovery guidance; test real Django password-change procedure using synthetic accounts

**Acceptance checklist:**

- [x] Record supported methods for students, instructors and administrators; implement any missing agreed onboarding/login path.
- [x] Enforce approval, active-account, enrollment and role restrictions in the backend. Prevent users from choosing an elevated role through a client-only check.
- [x] Show clear pending, unenrolled, invalid-credential, denied-OAuth and temporarily unavailable states without revealing sensitive details.
- [x] Use no shared/default passwords; test account setup and login with synthetic users and mocked provider responses. Coordinate with A05.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is A07; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Complete the agreed login and account onboarding methods.

Requirements:
Follow SkillBridge AGENTS.md. Read A07 in outputs/defense-review/SkillBridge_Continuous_Development.md. Trace actual student, instructor and admin onboarding/login and complete the agreed authentication methods. Preserve Google identity verification and backend role/approval/activity/enrollment checks. If staff login methods are unresolved, present concrete options for the user rather than silently changing scope. Handle rejected or unavailable sign-in clearly, use no shared passwords, and verify with isolated users and mocked external services. Coordinate password recovery with A05.

The acceptance outcomes for this task are:
1. Record supported methods for students, instructors and administrators; implement any missing agreed onboarding/login path.
2. Enforce approval, active-account, enrollment and role restrictions in the backend. Prevent users from choosing an elevated role through a client-only check.
3. Show clear pending, unenrolled, invalid-credential, denied-OAuth and temporarily unavailable states without revealing sensitive details.
4. Use no shared/default passwords; test account setup and login with synthetic users and mocked provider responses. Coordinate with A05.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify A07, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep A07 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-a05"></a>

### A05 Complete a truthful and usable account recovery flow

**Type:** Confirmed unfinished behavior. **Order:** After login contract.

Forgot password currently changes local state and claims a link was sent without a reset request. It is visible behavior even though it is not a separately numbered requirement.

**Phase:** Local system development. **Hard dependencies:** A07.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Replaced fake reset-email success with identical institutional assisted-recovery guidance for all inputs; added Google-password versus enrollment/access guidance; documented authorized interactive Django changepassword procedure. No public lookup/reset endpoint or mail claim.
- Affected files: AdminLogin.jsx, LoginPage.jsx, api/test_assisted_recovery.py; tests/recovery_help_playwright.py; knowledge/AUTHENTICATION_AND_RECOVERY.md
- Tested commit or working-tree build: 227f794 plus uncommitted A01/A02/A03/A07/A05 changes; only isolated synthetic credentials changed
- Checks and outcomes: 14/14 isolated auth/recovery/provider tests passed, including real changepassword success, old-password denial/new-password login, unchanged other user, mismatch/weak-password/unknown-account failures, no mail. Three grouped local Chrome checks passed: identical help for blank/malformed/unknown email and no recovery requests; 429 login clears loading; Google versus enrollment guidance. Frontend lint/build recorded in a05 logs. Self-service token expiry/reuse is not applicable to the explicitly selected assisted process; no criterion silently dropped.
- Evidence paths: work/defense_audit/a05-{backend,browser,lint,build}.txt; tests/artifacts/recovery-help/{results.json,admin-mobile.png,google-mobile.png}; api/test_assisted_recovery.py
- Blocker or material decision: None for the approved assisted process. No live messages or real credential changes performed.
- Next exact action: A06 implement coordinated refresh, fixed seven-day expiry, account/password revocation, logout/identity and SSE lifecycle; preserve drafts

**Acceptance checklist:**

- [x] Provide the agreed self-service or administrator-assisted recovery path for password accounts, and appropriate Google-account guidance for Google-only accounts.
- [x] Never show false delivery success. Handle unavailable mail delivery, invalid input and rate limits clearly without account enumeration.
- [x] If self-service is required, use expiring single-use tokens, password validation and invalid/expired/reused-token handling.
- [x] Test delivery and recovery with mocks; do not send live reset messages or modify real credentials. An adviser-approved assisted process may satisfy recovery without inventing an email-reset module.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is A05; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Complete a truthful and usable account recovery flow.

Requirements:
Follow SkillBridge AGENTS.md. Read A05 and the A07 login contract in outputs/defense-review/SkillBridge_Continuous_Development.md. Replace the false Forgot password success with the agreed functioning recovery flow. Implement secure token-based reset if required, or truthful usable assisted-recovery/Google guidance if that is the accepted scope. Handle validation, expiry, rate limits and delivery failure without enumerating accounts. Verify using mocks and synthetic accounts; do not send real messages or change real passwords.

The acceptance outcomes for this task are:
1. Provide the agreed self-service or administrator-assisted recovery path for password accounts, and appropriate Google-account guidance for Google-only accounts.
2. Never show false delivery success. Handle unavailable mail delivery, invalid input and rate limits clearly without account enumeration.
3. If self-service is required, use expiring single-use tokens, password validation and invalid/expired/reused-token handling.
4. Test delivery and recovery with mocks; do not send live reset messages or modify real credentials. An adviser-approved assisted process may satisfy recovery without inventing an email-reset module.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A07). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify A05, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep A05 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-a06"></a>

### A06 Complete the agreed session renewal and expiry behavior

**Type:** Incomplete promised behavior. **Order:** Before local acceptance.

Eight-hour access tokens and seven-day refresh tokens are configured, but the frontend stores refresh without exchanging it when access expires. The agreed seven-day session requirement needs working behavior, not just a token lifetime setting.

**Phase:** Local system development. **Hard dependencies:** A07.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Shared bounded single-flight refresh and one retry only for explicit authentication 401; fixed seven-day session boundary; active/approved/enrolled and password-revocation refresh checks; SSE renewal/preflight recovery; logout/new-sign-in epoch protection; protected subtree/drafts retained; student/exam-scoped answer storage; uncertain writes never replayed
- Affected files: api/views.py, api/sse.py, core/settings.py, api/test_session_renewal.py and test_change_events.py fixture/integration coverage; frontend sessionRenewal/axios/authHeaders/logout/eventStream, SessionContext/useSSE/PrivateRoute, StudentAssessment/attemptStorage; relevant unit/browser tests and auth/freshness docs
- Tested commit or working-tree build: 227f794 plus uncommitted A01/A02/A03/A07/A05/A06 changes; disposable local PostgreSQL 17.11; no production deployment or data changes
- Checks and outcomes: Focused backend 28 discovered/27 passed/1 skip before added outage case. Full SQLite API: 195 discovered/192 passed/3 skips before new PostgreSQL-only integration. Full PostgreSQL after fixture repair: 196/196 passed, no skips, including independent process and real SSE connection release/revocation. First PostgreSQL full attempt failed due to TestCase outer transaction connection release; fixed fixture isolation and added real TransactionTestCase coverage; assertions retained. Frontend 100/100 unit tests, lint 0 errors/5 existing warnings, build passed. Six real-token Chrome cases passed; A02 four grouped Chrome cases rerun and passed. First concurrency browser attempt used two HMR module instances; fresh Vite restart passed unchanged one-refresh assertion.
- Evidence paths: work/defense_audit/a06-{backend,all-backend,all-postgres,all-postgres-after,node-focused,node-tests,lint,build,browser,a02-browser-regression}.txt; tests/artifacts/session-renewal/results.json; api/test_session_renewal.py; knowledge/AUTHENTICATION_AND_RECOVERY.md
- Blocker or material decision: None for local A06. Pre-change JWTs missing password-revocation claim require fresh sign-in after this build is deployed; documented, no deployment performed. Legacy unowned unscoped drafts are not read or deleted.
- Next exact action: N01 verify existing selected/default spaCy medium resource in the actual local runtime and failure/fallback reporting; preserve research-model plan outside system scope

**Acceptance checklist:**

- [x] Implement the recorded renewal contract through the shared client; coordinate concurrent refresh requests and stop refresh loops.
- [x] Handle expired/revoked refresh, inactive accounts, logout, identity change and SSE reconnection safely. Preserve answer/draft state across appropriate session recovery.
- [x] Never replay uncertain mutations after network failures. Verify which rejected requests can be safely retried after successful authentication.
- [x] Use short-lived synthetic tokens to test expiry and renewal. A change to the requirement needs explicit user/adviser acceptance, not an automatic documentation workaround.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is A06; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Complete the agreed session renewal and expiry behavior.

Requirements:
Follow SkillBridge AGENTS.md. Read A06 in outputs/defense-review/SkillBridge_Continuous_Development.md. Complete the agreed session-renewal behavior using the shared Axios client, SessionContext, identity/cache lifecycle and SSE. For the current seven-day renewal requirement, implement coordinated refresh with bounded retries, safe identity checks and correct logout/expired-refresh outcomes. Preserve active assessment answers and never replay uncertain mutations. Test concurrent expiry, refresh failure, account change and stream reconnection with short-lived synthetic tokens. Do not declare the feature complete merely by changing paper wording.

The acceptance outcomes for this task are:
1. Implement the recorded renewal contract through the shared client; coordinate concurrent refresh requests and stop refresh loops.
2. Handle expired/revoked refresh, inactive accounts, logout, identity change and SSE reconnection safely. Preserve answer/draft state across appropriate session recovery.
3. Never replay uncertain mutations after network failures. Verify which rejected requests can be safely retried after successful authentication.
4. Use short-lived synthetic tokens to test expiry and renewal. A change to the requirement needs explicit user/adviser acceptance, not an automatic documentation workaround.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A07). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify A06, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep A06 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-n01"></a>

### N01 Make the selected NLP preprocessor work reliably

**Type:** Runtime verification / correction. **Order:** Before result acceptance.

Model comparison already exists. This system task concerns the supported selected model, availability and runtime error behavior; notebook timing reconciliation and research model selection are outside this file.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Verified existing default spacy_md loads locally with strict fallback disabled; actual package/resource versions and requested/actual model recorded. Missing/failed model fallback and strict comparison behavior verified. Fixed empty/no-candidate results falsely claiming selected model ran; UI now shows no actual model result rather than falling back to selected intent.
- Affected files: api/combined_competency.py, api/test_nlp_runtime.py; StudentResults.jsx; tests/nlp_model_reporting_playwright.py; knowledge/NLP_RUNTIME_VERIFICATION.md and overview; local probe tooling
- Tested commit or working-tree build: 227f794 plus uncommitted A01/A02/A03/A07/A05/A06/N01 changes; default model unchanged, no live config/database access
- Checks and outcomes: Actual spaCy 3.8.16/en_core_web_md 3.8.0 requested=actual spacy_md, 9.0896s one first-load/process probe, no runtime downloads. Stanza resources absent, recorded explicitly. New tests reproduced 2 empty-result metadata failures; after fix 70/70 runtime/evaluation/diagnostic/grading/combined/management tests passed. Strict comparison does not substitute missing model metrics. Empty vocabulary, zero evidence, missing requirements/positions verified; two mocked-result Chrome label cases passed with no page errors. Focused lint and frontend build passed.
- Evidence paths: work/defense_audit/n01-{runtime.json,runtime.txt,before.txt,after.txt,browser.txt,lint.txt,build.txt}; api/test_nlp_runtime.py; tests/artifacts/nlp-model-reporting/results.json
- Blocker or material decision: None for local default supported runtime. This is not a production-model configuration audit or model accuracy claim; separate user-owned NLP research documents remain unchanged.
- Next exact action: N02 verify ranking components/ties and invalid coordinates, then combined eligibility/stale/capacity boundaries; preserve 60/25/15 and neutral missing-location policy

**Acceptance checklist:**

- [x] Verify the agreed selected model can load in the intended local runtime and record requested versus actual model.
- [x] Keep supported fallback behavior explicit; unavailable resources must not produce fabricated model-comparison scores or misleading model identity.
- [x] Handle missing resources, failed initialization, empty vocabulary, no positions and no usable student evidence gracefully.
- [x] Do not require every comparison model in the deployed runtime unless agreed. Do not add startup downloads or change the active model arbitrarily.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is N01; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Make the selected NLP preprocessor work reliably.

Requirements:
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read N01 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify and complete local runtime support for the agreed selected NLP preprocessor. Trace loading, requested/actual model reporting, fallback, empty text/vocabulary and model diagnostics. Fix confirmed runtime/error-handling gaps without fabricating comparison metrics, changing ranking weights or downloading resources at request time. Use isolated data and mocks for failure scenarios. Treat research timing/model-selection decisions as separate follow-up work.

The acceptance outcomes for this task are:
1. Verify the agreed selected model can load in the intended local runtime and record requested versus actual model.
2. Keep supported fallback behavior explicit; unavailable resources must not produce fabricated model-comparison scores or misleading model identity.
3. Handle missing resources, failed initialization, empty vocabulary, no positions and no usable student evidence gracefully.
4. Do not require every comparison model in the deployed runtime unless agreed. Do not add startup downloads or change the active model arbitrarily.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify N01, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep N01 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-n02"></a>

### N02 Verify complete recommendation and eligibility behavior

**Type:** Feature verification / correction. **Order:** After A01 and A03.

The category/text/location recommender is implemented. It needs complete functional checks, not a 100% accuracy target.

**Phase:** Local system development. **Hard dependencies:** A01, A03, N01.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Fixed invalid-coordinate ranking/map inputs, legacy text-address crash and deterministic exact-score/tie presentation. Preserved 60/25/15, neutral missing-location rule, weighted combined evidence/gates/history and separate capacity approval.
- Affected files: api/{recommendation_nlp,scoring,views,test_recommendation_contract}.py; useStudentResults.js; recommendationResults.js/.test.mjs; recommendation_contract_playwright.py; knowledge/RECOMMENDATION_CONTRACT.md and overview
- Tested commit or working-tree build: 227f794 plus preserved uncommitted changes; local PostgreSQL only; no historical/live record repair
- Checks and outcomes: Before: 8 new cases reproduced 5 failures/1 error. After: focused 57/57, full PostgreSQL API 209/209, frontend 103/103, four browser states with no page errors, lint 0 errors/5 existing warnings, production build passed. Prior combined/model tests included raw/max, active batch, retakes/stops, empty/zero/missing requirements and fallback.
- Evidence paths: work/defense_audit/n02-{before,after,postgres,browser,frontend}.txt; skillbridge-frontend/tests/artifacts/recommendation-contract/results.json and screenshots; knowledge/RECOMMENDATION_CONTRACT.md
- Blocker or material decision: None for N02. Browser map uses adapter to verify marker inputs; external map availability/CSP remains E02/A04/V05. Screenshot layout overlap requires later E01/V07 review; no broad visual acceptance claimed.
- Next exact action: N04: verify suggestion authorization/validation and manual fallback; generated text, ties and zero evidence using synthetic fixtures.

**Acceptance checklist:**

- [x] Verify agreed weights and shared category ordering, generated text, candidate requirements, coordinates/distance and deterministic ranking presentation.
- [x] Correctly combine raw/max evidence across assessments; preserve required-completion gates, active-batch scope, retakes, stopped-evidence exclusions and stale-result invalidation.
- [x] Handle no assessments, no required assessments, no positions, missing requirements, zero evidence and missing/invalid coordinates with clear states.
- [x] Keep recommendation similarity separate from capacity/approval eligibility and placement-success probability. Changes to weights or missing-location policy require a recorded scope decision.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is N02; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Verify complete recommendation and eligibility behavior.

Requirements:
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read N02 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify and fix functional recommendation behavior end to end: combined raw/max evidence, current batch/completion gates, category/text/location components, selected model, ranking, stale evidence and placement eligibility. Cover empty/missing data, retakes and unavailable resources. Preserve agreed weights and history, show clear locked/empty/error states, and test with synthetic cases. The goal is correct agreed behavior, not 100% prediction accuracy or rewritten expected labels.

The acceptance outcomes for this task are:
1. Verify agreed weights and shared category ordering, generated text, candidate requirements, coordinates/distance and deterministic ranking presentation.
2. Correctly combine raw/max evidence across assessments; preserve required-completion gates, active-batch scope, retakes, stopped-evidence exclusions and stale-result invalidation.
3. Handle no assessments, no required assessments, no positions, missing requirements, zero evidence and missing/invalid coordinates with clear states.
4. Keep recommendation similarity separate from capacity/approval eligibility and placement-success probability. Changes to weights or missing-location policy require a recorded scope decision.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A01, A03, N01). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify N02, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep N02 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-n04"></a>

### N04 Verify question suggestions and generated competency text

**Type:** Implemented feature verification. **Order:** Before workflow acceptance.

TF-IDF category/tag suggestions and generated profiles exist; ensure they work with current category data and do not overstate measured skills.

**Phase:** Local system development. **Hard dependencies:** A01.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Staff-only typed advisory category/tag requests; known finite requirements; ambiguous ties abstain; manual shared-category correction respects question ownership and rejects malformed/duplicate names. Obsolete browser suggestions cannot revive after edit/dismissal/removal/unmount. New narratives retain ties, qualify vocabulary and avoid asserted orientation for zero scores; saved history unchanged.
- Affected files: api/{scoring,recommendation_nlp,views,test_question_assistance}.py; useInstructorUpload.js; question_assistance_playwright.py; knowledge/QUESTION_ASSISTANCE.md and overview
- Tested commit or working-tree build: 227f794 plus preserved uncommitted working tree; neutral-evidence-v3 for new generation; no data migration/backfill
- Checks and outcomes: Initial eight cases: 10 failed subcases/4 errors. Focused 51/51 after core fixes. Expanded full PostgreSQL 219/219 passed after correcting one new test variable scope (intermediate 218-test run retained). Browser reproduced stale chip then passed three scenarios with no page errors. Lint 0 errors/5 existing warnings; build passed. Frontend pure suite 103/103 unchanged by subsequent hook-only guard.
- Evidence paths: work/defense_audit/n04-{before,after,postgres,postgres-final,browser-before,browser,lint,build}.txt; tests/artifacts/question-assistance/results.json; knowledge/QUESTION_ASSISTANCE.md
- Blocker or material decision: None for N04. Suggestions remain heuristic; no accuracy percentage asserted. Existing profiles not auto-regenerated. Broader authoring input/atomicity and account-scoped draft audit continues in E01.
- Next exact action: P01/P02: preserve sample blockers, verify existing synthetic importer evidence; P03: test user-defined slots and company-area totals.

**Acceptance checklist:**

- [x] Suggestion failures or unavailable categories do not destroy question drafts or prevent valid manual classification.
- [x] Support manual correction; validate category ownership/references and ambiguity/no-suggestion states.
- [x] Generated text reflects actual category scores and required skills; it does not claim individually tested subskills solely because they occur in a category vocabulary.
- [x] Verify clear, ambiguous and unfamiliar question examples, ties, missing categories and zero scores. Record limitations without inventing a required accuracy percentage.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is N04; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Verify question suggestions and generated competency text.

Requirements:
Follow SkillBridge AGENTS.md and the assessment-review and recommendation-audit skills. Read N04 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify question category/tag suggestions and generated competency/position text with representative synthetic inputs. Fix functional defects and unsupported profile claims, preserve instructor correction and drafts when suggestions fail, and handle missing categories/zero scores clearly. Keep score history intact and record tested cases without requiring perfect NLP classification.

The acceptance outcomes for this task are:
1. Suggestion failures or unavailable categories do not destroy question drafts or prevent valid manual classification.
2. Support manual correction; validate category ownership/references and ambiguity/no-suggestion states.
3. Generated text reflects actual category scores and required skills; it does not claim individually tested subskills solely because they occur in a category vocabulary.
4. Verify clear, ambiguous and unfamiliar question examples, ties, missing categories and zero scores. Record limitations without inventing a required accuracy percentage.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A01). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify N04, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep N04 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-p01"></a>

### P01 Verify accepted LMS questionnaire import format

**Type:** Panel feature verification / conditional addition. **Order:** Sample or scope decision.

Scope decision18October2026: user says to assume the current questionnaire format is final for the28tasks and update later this week if needed. This supersedes the earlier official-sample prerequisite. Existing official IAMS remains unchanged.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done under explicit user final-format scope decision
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Existing Excel/CSV/text questionnaire contract accepted as final by user for28tasks. Actual XLSX mixed MCQ/true-false/identification keys/categories persist through create/publication and append. Fixed confirmed empty-keyed-choice preview validation in both spreadsheet paths/shared text parser plus manual publish validation; valid formats retained.
- Affected files: Frontend useInstructorUpload.js/useAssessmentUpload.js;knowledge/QUESTION_IMPORT_FORMAT.md;scope/checklist and relevant knowledge updates;isolated p01_current_format_browser.py. IAMS untouched.
- Tested commit or working-tree build: 227f794 plus preserved uncommitted local release;work/defense_audit/checkpoint-code-manifest-local-final.json covers174source/test/knowledge/config files;SHA256 cfd2d248d7466d9a3c8d81cb85154e6ae9dc765fc38c901f1e58d666799430d7. Final backend291/frontend116 pass;exact applicable browser/performance evidence in task record. No release commit/push or hosted action performed.
- Checks and outcomes: Before:real XLSX key C/empty C incorrectly previewed ready. After:10 real browser groups passed,0pageerrors:bad XLSX/text rejected,no writes;creator and existing upload recover with valid mixed XLSX;retained mixed CSV/text publish. Frontend116passed,no skips;lint/build passed. Earlier full linked workflow15groups and backend287remain applicable to unchanged behavior/backend.
- Evidence paths: work/defense_audit/p01-import-before.txt;p01-import-after.txt (locator issue retained);p01-import-final2.txt;p01-artifacts/;p01-frontend-unit.txt;p01-lint.txt;p01-build.txt;knowledge/QUESTION_IMPORT_FORMAT.md
- Blocker or material decision: User explicitly replaces official-file prerequisite with current-format release acceptance. Official external file has not been compared;review/adapt when supplied later this week as a follow-up. No assumed LMS vendor/standard.
- Next exact action: S01 local sign-off;when adviser file arrives later,compare to accepted format and preserve existing formats if adapter needed.

**Acceptance checklist:**

- [x] Use the existing Excel/CSV/text questionnaire contract as the accepted final format for this release, as explicitly directed by the user on18October2026. Verify MCQ/true-false/identification choices, answer keys and categories through import and persistence, validation/recovery and retained existing formats. The external official LMS comparison is a follow-up when its file arrives later this week; do not claim that an unseen file has been verified.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is P01; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Verify the accepted LMS questionnaire import format.

Requirements:
Follow SkillBridge AGENTS.md. Read P01 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify the existing Excel/CSV/text assessment importer designated as the accepted final format by the user for this task. Trace question types, choices, answer keys and categories end to end. Add a focused compatible import path only if a mismatch is confirmed, preserving existing formats and server validation. Use anonymized samples and isolated fixtures. Record the official-file comparison as a later follow-up, without inventing external compatibility or keeping it as a release gate after this explicit scope decision.

The acceptance outcomes for this task are:
1. Use the existing Excel/CSV/text questionnaire contract as the accepted final format for this release, as explicitly directed by the user on18October2026. Verify MCQ/true-false/identification choices, answer keys and categories through import and persistence, validation/recovery and retained existing formats. The external official LMS comparison is a follow-up when its file arrives later this week; do not claim that an unseen file has been verified.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify P01, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep P01 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-p02"></a>

### P02 Verify official IAMS enrollment compatibility

**Type:** Panel feature verification / conditional addition. **Order:** Sample or scope decision.

Panel request and functional requirement 3. The implemented parser supports IAMS-style columns, preview/confirm, identity checks and generated DNSC addresses.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done — verified existing behavior against user-confirmed official format
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: User confirms current implemented enrollment format is correct and originated from official IAMS. Preserved unchanged importer/parser/dialogs. Verified exact row8 five-header layout and metadata, multi-sheet parsing, leading-zero institutional IDs, names/programs, generated/provided/edited email review, duplicate/conflict handling, role/batch scope, atomic confirmation and safe repeat/recovery with synthetic records and mocked notifications.
- Affected files: Documentation/checkpoint only this turn; enrollment_import.py, studentEnrollmentImport.js/tests and enrollment dialogs unchanged. Existing test_enrollment_import.py and enrollment browser fixtures reused.
- Tested commit or working-tree build: 227f794 plus preserved current uncommitted changes through V03. Current enrollment importer/parser/dialogs have no git diff. No new raw institutional file read; user-confirmed official layout tested with synthetic student records.
- Checks and outcomes: 31/31 isolated enrollment/API tests passed;12/12 parser tests passed including real XLSX/XLS/CSV round trips, exact headers, multi-sheet metadata/ID preservation, size/corrupt-file errors.11 browser groups passed for both staff roles, upload/edit/re-preview/confirm/retry/no-repeat-notification, narrow layouts and keyboard behavior;0page errors. Browser shutdown broken-pipe diagnostics retained; all assertions passed. Final prior280 PostgreSQL suite includes these31 API tests.
- Evidence paths: work/defense_audit/p02-api-confirmed-format.txt; p02-parser-confirmed-format.txt; p02-browser-confirmed-format.txt; skillbridge-frontend/tests/artifacts/enrollment/results.json; knowledge/IAMS_ENROLLMENT_IMPORT.md; user confirmation18October
- Blocker or material decision: None for accepted current IAMS format. Earlier missing-provenance assumption superseded by explicit user confirmation. Generated emails remain reviewable predictions, not proof of inbox delivery or correctness for every possible name.
- Next exact action: Preserve accepted IAMS format. P01 official LMS comparison remains separate/provisional; downstream acceptance follows its dependency rules.

**Acceptance checklist:**

- [x] Test an anonymized institutional export, multiple-sheet/preamble handling, IDs with preserved leading zeros, names, supported programs, duplicates/conflicts and retry behavior. Verify generated addresses with institutional conventions; do not assume all names map correctly. Confirmation must not duplicate records. Use mocked notifications.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is P02; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Verify official IAMS enrollment compatibility.

Requirements:
Follow SkillBridge AGENTS.md and knowledge/IAMS_ENROLLMENT_IMPORT.md. Read P02 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify the existing IAMS import using the anonymized official sample provided, including headers, preambles, student IDs, names/programs, duplicates, identity conflicts and generated email conventions. Correct demonstrated incompatibilities without replacing the completed preview/confirm workflow. Preserve backend identity constraints and use mocked email. Do not enroll real students or send live notifications as part of this check.

The acceptance outcomes for this task are:
1. Test an anonymized institutional export, multiple-sheet/preamble handling, IDs with preserved leading zeros, names, supported programs, duplicates/conflicts and retry behavior. Verify generated addresses with institutional conventions; do not assume all names map correctly. Confirmation must not duplicate records. Use mocked notifications.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify P02, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep P02 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-p03"></a>

### P03 Clarify agency demand and area analytics

**Type:** Panel feature verification / conditional addition. **Order:** Sample or scope decision.

Panel requested required students per agency/area. Current system has configured slots, approved/remaining capacity and student counts by area.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: User confirmed this is the outline-defense panel definition: demand is configured slots minus approved assignments; area is assigned totals across company locations. Existing arithmetic passed; clarified residence/deployment/company-area labels in analytics and report/export filter wording. No separate quota added.
- Affected files: api/test_capacity_areas.py; AdminReports.jsx; PlacementReportPanel.jsx; placementReports.js; capacity_areas_playwright.py; knowledge/CAPACITY_AND_AREAS.md and overview
- Tested commit or working-tree build: 227f794 plus preserved uncommitted working tree; synthetic approvals on disposable local databases only
- Checks and outcomes: 24/24 focused API tests on PostgreSQL and SQLite. Verified 5−1=4, 3+3=6 in Davao City, distinct Tagum residences, two staff roles, report remaining seats and nonapproved history exclusion. Two browser display cases passed, no page errors. Earlier selector assumptions and Vite load stall retained in logs; final fresh-server run passed. Lint 0 errors/5 existing warnings; build passed.
- Evidence paths: work/defense_audit/p03-{before,postgres,browser,browser-final,browser-verified,browser-restart,lint,build}.txt; tests/artifacts/capacity-areas/results.json; knowledge/CAPACITY_AND_AREAS.md
- Blocker or material decision: Resolved by direct user report of panel instruction, 18 October. No independently obtained adviser endorsement claimed. Official LMS/IAMS compatibility remains blocked separately.
- Next exact action: E01: map mutation boundaries; reproduce profile validation, authoring partial-write, draft identity and safe recovery issues.

**Acceptance checklist:**

- [x] Adviser confirms whether required students means existing slot capacity or a separate demand/quota. If capacity is sufficient, verify and label it clearly. If a separate quota is explicitly required, design its scope, data entry, permissions and report meaning before adding it. Ensure counts are not conflated across home area, company area and batch membership.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is P03; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Clarify agency demand and area analytics.

Requirements:
Follow SkillBridge AGENTS.md. Read P03 in outputs/defense-review/SkillBridge_Continuous_Development.md. Map current company capacity and area analytics to the panel's required-students wording. Present a concrete explanation of whether existing slot capacity satisfies it and identify the adviser decision if a separate demand target may be intended. Do not invent a new quota module without that decision. Verify current counts first; implement only an agreed gap and keep student-residence, company-location and placement-area definitions clear in dashboards and exports.

The acceptance outcomes for this task are:
1. Adviser confirms whether required students means existing slot capacity or a separate demand/quota. If capacity is sufficient, verify and label it clearly. If a separate quota is explicitly required, design its scope, data entry, permissions and report meaning before adding it. Ensure counts are not conflated across home area, company area and batch membership.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify P03, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep P03 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-e01"></a>

### E01 Complete consistent validation and error recovery across screens

**Type:** Cross-system verification / correction. **Order:** Alongside feature fixes.

The user requires the agreed system to work properly and handle errors. These are mandatory checks across existing modules, not claims that every listed failure is already present.

**Phase:** Local system development. **Hard dependencies:** A01, A03.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Mapped action/validation/transaction boundaries; typed/field-safe errors and responses; atomic profile/assessment/batch/catalog mutations; real admin persistence; scoped drafts/pins; retained failed edits/confirmations; no uncertain write replay or false queued/delivered/save claims; malformed-response cache protection and reconciliation after confirmed writes. Unsupported notification shell now explicitly unavailable. Details in knowledge/VALIDATION_AND_RECOVERY.md.
- Affected files: Backend profile/request/parser/admin/assessment authoring helpers, views/models and migration 0015; frontend Axios/cache/response helpers and profile/setup/authoring/admin/batch/taxonomy/placement/report screens; synthetic API/unit/browser tests; knowledge/VALIDATION_AND_RECOVERY.md. Exact source hashes in paused-code-manifest-e01.json.
- Tested commit or working-tree build: 227f794 plus preserved uncommitted E01 source; paused manifest plus resumed truthful-shell change and unenrollment browser test. No production migration; migration0015 applied only by test DB setup.
- Checks and outcomes: Full isolated PostgreSQL 245/245 passed, no skips; frontend resumed 110/110, lint 0 errors/5 existing warnings, build passed. Focused browser cases: profile/cache/draft 3, results 5, admin 2, batches 2, composite authoring 2, taxonomy/reports 2, placement 2, real sessions 6, enrollment 11, selected-unenrollment 2. Resumed profile confirms truthful unavailable notification shell. Failed connection/harness runs retained and not counted.
- Evidence paths: work/defense_audit/e01-postgres-final.txt; e01-{unit,lint,build}-resumed.txt; e01-unenrollment-browser-final.txt; e01-profile-resumed-browser-final.txt; prior e01-* browser/API evidence and knowledge/VALIDATION_AND_RECOVERY.md
- Blocker or material decision: None for E01. Result-notification shell was never a persisted feature in agreed profile scope; made truthful. Broad workflow/security/device/race/report/performance acceptance remains separately unchecked. Official samples still block P01/P02.
- Next exact action: E02 external-service outage/timeouts/map/image/storage/email checks with isolated mocks.

**Acceptance checklist:**

- [x] Map frontend actions to their backend validation and mutation boundaries. Check invalid forms, malformed payloads, duplicate records, denied access, missing/deleted records, conflicts and timeouts.
- [x] Provide useful field errors and retryable/nonretryable messages for relevant 400/401/403/404/409/413/429/500/503 outcomes. Do not invent statuses for a particular endpoint.
- [x] Clear loading states on failure, prevent duplicate clicks/duplicate records, preserve unsaved fields/answers on retryable errors, and keep failed multi-record saves atomic.
- [x] Never display success before the operation succeeds; distinguish saved/queued/delivered states. Do not blindly retry non-idempotent or uncertain requests.
- [x] Prevent unhandled page errors and secret/PII disclosure; logs provide safe diagnostic context. Cover malformed server responses and reconciliation after committed writes with failed follow-up requests.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is E01; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Complete consistent validation and error recovery across screens.

Requirements:
Follow SkillBridge AGENTS.md and relevant project skills. Read E01 in outputs/defense-review/SkillBridge_Continuous_Development.md. Audit and complete validation/error recovery across existing authentication, profile, enrollment, assessment, catalog, recommendations, placements and report flows. Trace each UI action into backend validation and transaction boundaries. Fix confirmed issues with field errors, denied/missing/conflicting data, duplicate actions, timeouts and server failures. Preserve drafts/answers, clear loading states, prevent partial writes/false success, and do not blindly replay uncertain mutations. Add targeted synthetic failure tests and report actual coverage.

The acceptance outcomes for this task are:
1. Map frontend actions to their backend validation and mutation boundaries. Check invalid forms, malformed payloads, duplicate records, denied access, missing/deleted records, conflicts and timeouts.
2. Provide useful field errors and retryable/nonretryable messages for relevant 400/401/403/404/409/413/429/500/503 outcomes. Do not invent statuses for a particular endpoint.
3. Clear loading states on failure, prevent duplicate clicks/duplicate records, preserve unsaved fields/answers on retryable errors, and keep failed multi-record saves atomic.
4. Never display success before the operation succeeds; distinguish saved/queued/delivered states. Do not blindly retry non-idempotent or uncertain requests.
5. Prevent unhandled page errors and secret/PII disclosure; logs provide safe diagnostic context. Cover malformed server responses and reconciliation after committed writes with failed follow-up requests.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A01, A03). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify E01, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep E01 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-e02"></a>

### E02 Handle unavailable external services without breaking local workflows

**Type:** Integration failure handling. **Order:** Before local acceptance.

A locally running app still depends on Google, address/geocoding/map services, email, Storage and possibly model resources. Mocked failure checks are local system tests; they do not establish live provider availability.

**Phase:** Local system development. **Hard dependencies:** A07, N01.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Original provider/image/email/NLP recovery preserved. All ten Leaflet surfaces now share bounded recovery, including five legacy company maps. Both staff edits retain valid zero pins and drafts; company geocoder city fallback stays bounded/cancellable and never creates approximate pins. Catalog map markup escaped.
- Affected files: Previous E02 files plus admin/AdminCompanies.jsx, instructor/InstructorCompanies.jsx, utils/externalServices.js/tests, company_map_recovery_playwright.py, map text escaping and knowledge/EXTERNAL_SERVICE_RECOVERY.md
- Tested commit or working-tree build: 227f794 plus preserved uncommitted changes through E02. No provider data, configured database or production migration touched.
- Checks and outcomes: Resumed37 isolated PostgreSQL provider/image/auth tests passed;116 full frontend tests passed; final lint0errors/0warnings/build passed. Both company-role recovery scenarios and instructor view denial passed, plus3 general browser recovery groups, no page errors. City fallback unit checks passed. Earlier harness modal-order failure and sandbox DB denial retained, not passed.
- Evidence paths: work/defense_audit/e02-backend-resumed-approved.txt; e02-company-browser-resumed-final.txt; e02-browser-resumed-regression.txt; e02-unit-resumed-full.txt; e02-external-unit-resumed.txt; e02-lint-resumed-final.txt; e02-build-resumed-final.txt; original E02 evidence retained
- Blocker or material decision: None for local mocked acceptance; actual hosted providers remain V05. Supabase skill available/read on resume; no live actions.
- Next exact action: Continue V03: fix three reproduced placement security failures, verify complete local security criteria.

**Acceptance checklist:**

- [x] Exercise provider denial, timeouts, offline mode, invalid responses and broken images without crashing pages or misclassifying temporary errors as bad credentials.
- [x] Provide truthful fallbacks/retry guidance for maps/photos and unavailable NLP resources. Preserve meaningful coordinate/distance and actual-model states.
- [x] For image/storage saves retain the last good reference and clean up only owned orphan objects safely; failed email delivery must not be described as delivered.
- [x] Bound external calls appropriately and keep credentials server-side. Preserve successful core data writes when a nonessential notification fails according to the recorded contract.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is E02; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Handle unavailable external services without breaking local workflows.

Requirements:
Follow SkillBridge AGENTS.md. Read E02 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify and fix failure handling for Google sign-in, address/geocoding/maps, email, company Storage/images and optional NLP resources in the locally running system. Use mocks to exercise timeout/denial/invalid-response cases without sending live messages or changing provider data. Preserve drafts and last-good records, use truthful fallback/status messages, bound external calls and prevent unhandled exceptions or secret disclosure. Distinguish local integration tests from later live hosting checks.

The acceptance outcomes for this task are:
1. Exercise provider denial, timeouts, offline mode, invalid responses and broken images without crashing pages or misclassifying temporary errors as bad credentials.
2. Provide truthful fallbacks/retry guidance for maps/photos and unavailable NLP resources. Preserve meaningful coordinate/distance and actual-model states.
3. For image/storage saves retain the last good reference and clean up only owned orphan objects safely; failed email delivery must not be described as delivered.
4. Bound external calls appropriately and keep credentials server-side. Preserve successful core data writes when a nonessential notification fails according to the recorded contract.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A07, N01). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify E02, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep E02 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v01"></a>

### V01 Complete local end-to-end workflows for all three roles

**Type:** Whole-system verification. **Order:** After relevant corrections.

Existing browser fixtures contain stale selectors after UI redesigns. Tests must follow current accessible controls without weakening outcome assertions.

**Phase:** Local system development. **Hard dependencies:** A01, A02, A03, A05, A06, A07, N01, N02, N04, P02, P03, E01, E02.

User18October authorizes continuing local workflows with the current Excel/text question format while P01 official LMS comparison remains pending. P01 is deferred from this task dependency only; S01 still requires its official acceptance and affected workflow regression after any adapter change. Existing official IAMS format is verified under P02.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Real three-role React/API lifecycle on disposable PostgreSQL: sign-in/approval, API batch/IAMS enrollment/catalog setup, UI text+CSV authoring/publication, profile/address/pin setup, randomized start/resume identity, exact score/combined gates, actual retake control/history, recommended approval/removal/manual reassignment, student finalized placement and realPDF/XLSX. Recovery fixtures cover CRUD/errors/empty/loading/access loss/drafts. Current question format scope explicitly accepted; official LMS comparison retainedP01/S01.
- Affected files: work/defense_audit/v01_fixture.py, v01_workflow.py, v01_regressions.py; tests/admin_assessments_playwright.py and auth_contract_playwright.py safe503 expectation updates; knowledge/LOCAL_WORKFLOW_ACCEPTANCE.md and overview. No application behavior change.
- Tested commit or working-tree build: 227f794 plus preserved uncommitted application source through V03/P02; only browser test expectations/docs/isolated fixtures changed in V01. Dedicated local PostgreSQL17.11, Chrome desktop staff and phone-emulated student, mocked providers.
- Checks and outcomes: Passing linked workflow15 groups,0page errors; exact combined Programming3/3,Networking0/1; required/retake gates and archived attempt verified. Real approval/removal/manual placement reconciled with savedPDF/XLSX independently. Seven recovery fixtures passed; admin oversight final7groups and auth final12cases passed after stale error-text assertions corrected. Real timing4groups passed. Prior280PG/116frontend/lint0warnings/build apply to unchanged app source. Desktop fullscreen and broad matrix remainV07, performanceV06.
- Evidence paths: work/defense_audit/v01-flow-progress7.txt; v01-artifacts/; v01-export-verification.txt; v01-regressions-run.txt; v01-admin_assessments_playwright.txt; v01-auth-browser-final.txt; v01-timing-regression.txt; knowledge/LOCAL_WORKFLOW_ACCEPTANCE.md
- Blocker or material decision: None for current-format local V01 criteria. Official LMS import comparison remains deferred P01 and finalS01 requirement; actual providers/physical devices/hosting not claimed.
- Next exact action: V07 accepted Chrome/Edge desktop and Chrome tablet768x1024/phone390x844 matrix; verify fullscreen independently and remaining keyboard/network/session/device cases.

**Acceptance checklist:**

- [x] Student: approved/enrolled login, setup/profile, assigned assessment list, randomized start/resume, submit/expiry/retake, scores, combined gates, recommendations/maps and approved placement.
- [x] Instructor: own batches and enrollment, assessment/import/question management, publication/availability, retake control, competency review, company-first suggestions and reports.
- [x] Admin: users/approval, categories, company/position management, capacity, placement decisions/manual assignment/history, analytics and reports.
- [x] Exercise cross-role permissions, empty/loading/error states, repeated clicks, refresh and retained drafts. Save meaningful evidence and repair stale test-navigation assumptions.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V01; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Complete local end-to-end workflows for all three roles.

Requirements:
Follow SkillBridge AGENTS.md and the webapp-testing skill. Read V01 in outputs/defense-review/SkillBridge_Continuous_Development.md. Update stale browser selectors and complete the three-role local end-to-end acceptance flows against disposable synthetic data. Verify real React/API behavior for student assessments/results, instructor management and admin catalogs/placements/reports, including access denial, errors, retries, refresh and retained drafts. Mock external services. Fix confirmed application defects separately from test-navigation issues and report every passed, failed or unverified scenario.

The acceptance outcomes for this task are:
1. Student: approved/enrolled login, setup/profile, assigned assessment list, randomized start/resume, submit/expiry/retake, scores, combined gates, recommendations/maps and approved placement.
2. Instructor: own batches and enrollment, assessment/import/question management, publication/availability, retake control, competency review, company-first suggestions and reports.
3. Admin: users/approval, categories, company/position management, capacity, placement decisions/manual assignment/history, analytics and reports.
4. Exercise cross-role permissions, empty/loading/error states, repeated clicks, refresh and retained drafts. Save meaningful evidence and repair stale test-navigation assumptions.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A01, A02, A03, A05, A06, A07, N01, N02, N04, P02, P03, E01, E02). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V01, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V01 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v02"></a>

### V02 Reconcile reports, dashboards and placement records

**Type:** System verification / correction. **Order:** Before final local acceptance.

Objective 5, functional requirement 13 and panel reporting/analytics requests. Reports already exist.

**Phase:** Local system development. **Hard dependencies:** A01, A03, N02, P03.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026 (restored after V04 follow-up)
- Implemented or verified behavior: Known multi-batch/status dataset reconciles dashboard/area/capacity/report counts and immutable score snapshots. Report/history scope follows recorded batch owner, retaining history after unenrollment; cross-batch shared-student leak fixed. Philippine date filters/PDF/typed Excel dates and file dates align. XLSX snapshot metadata/filters/counts added with readable continuation rows; PDF long headings wrap. CSV whitespace/control formula protection; download guard.
- Affected files: api/views.py, csv_safety.py, test_report_reconciliation.py; utils/placementReports.js; PlacementReportPanel.jsx; report_exports_playwright.py; isolated export fixture/read-only verifier/render helpers; knowledge/REPORT_RECONCILIATION.md and overview
- Tested commit or working-tree build: 227f794 plus preserved uncommitted changes through V02; no real placement changes, recomputation or migration.
- Checks and outcomes: Original full252 API/114 frontend, lint/build and ten saved exports passed as recorded. V04 follow-up reproduced wrong decision batch, then 60 targeted PostgreSQL tests passed including corrected approval/rejection batch, scoped reports, concurrency and prior report tests. New rejection fixture missing required remarks corrected; intermediate failure retained.
- Evidence paths: work/defense_audit/v02-before.txt; v02-after.txt; v02-postgres-final.txt; v02-{lint,build,unit}-final.txt; v02-browser-final4.txt; v02-export-controls.json; v02-export-verification.json; v02-pdf-contact.png; v02-xlsx-*.png; frontend tests/artifacts/report-exports; knowledge/REPORT_RECONCILIATION.md
- Blocker or material decision: None. Reopened after confirmed new-decision evidence-batch defect; approval/new rejection now preserve recommendation.batch. No historical repair. Existing report date/capacity conventions stand.
- Next exact action: V04 criteria passed in same 60-test run; continue V11 reproducible setup.

**Acceptance checklist:**

- [x] Known synthetic records reconcile to student/company reports, area counts, configured versus free slots, filtered batch totals and placement status/history. PDF/XLSX/CSV downloads retain correct filters, dates, identities and snapshot meaning. Preserve historical assignment scores; exclude unauthorized batches and formula-injection risks in spreadsheet exports.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V02; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Reconcile reports, dashboards and placement records.

Requirements:
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read V02 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify dashboards and student/company placement exports against a known synthetic dataset covering multiple batches, full/empty positions and approved/rejected/removed placements. Reconcile counts, filters, capacity, score snapshots and area definitions across UI and downloaded reports. Correct confirmed inconsistencies, preserve authorization and historical assignment evidence, and inspect exported layouts. Do not regenerate or alter real placement history.

The acceptance outcomes for this task are:
1. Known synthetic records reconcile to student/company reports, area counts, configured versus free slots, filtered batch totals and placement status/history. PDF/XLSX/CSV downloads retain correct filters, dates, identities and snapshot meaning. Preserve historical assignment scores; exclude unauthorized batches and formula-injection risks in spreadsheet exports.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A01, A03, N02, P03). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V02, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V02 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v04"></a>

### V04 Verify concurrency and data freshness on PostgreSQL

**Type:** System verification / correction. **Order:** Before final local acceptance.

Integrity/reliability/scalability. Two PostgreSQL-only tests were skipped in the SQLite audit; row locking and cross-worker behavior remain unverified.

**Phase:** Local system development. **Hard dependencies:** A01, A02, A03.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Actual PostgreSQL connections verify submit/stop, duplicate submission and idempotent duplicate stop without duplicate evidence; competing last-seat and same-approval idempotence; observed parent-row edit/start blocking in both orders; image replacement/removal; independent process recipient scope/uncommitted invisibility/rollback isolation; stream revocation/connection release. Related decision-batch snapshot defect fixed and V02 reverified.
- Affected files: api/test_attempt_timing.py; test_concurrent_workflows.py; test_change_events.py; views.py recommendation-origin batch snapshots; knowledge/POSTGRES_CONCURRENCY_VERIFICATION.md and report/overview notes
- Tested commit or working-tree build: 227f794 plus preserved uncommitted work through V04; dedicated test_ PostgreSQL config on localhost55438, normal dotenv disabled.
- Checks and outcomes: Original60/60 PostgreSQL run passed; final V03 full280/280 with zero skips reverified concurrency/report/event tests and the additional inactive-target approval check. Existing lock/scoping/snapshot assertions preserved; no normal-database tests.
- Evidence paths: work/defense_audit/v04-postgres-final2.txt; v03-postgres-final.txt; knowledge/POSTGRES_CONCURRENCY_VERIFICATION.md
- Blocker or material decision: None for local PostgreSQL criteria. Hosted transport and broad browser/device acceptance remain separate tasks.
- Next exact action: V07 blocked by V01; proceed first independent V11 clean setup and maintenance verification.

**Acceptance checklist:**

- [x] Use a disposable test database through the project's dedicated test configuration. Cover submit-versus-stop, duplicate finalization, competing placement approvals/capacity, company-image replacement/removal and independently observed committed events. Verify rollback does not publish success and streams remain recipient-scoped. Never point destructive tests at the normal database.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V04; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Verify concurrency and data freshness on PostgreSQL.

Requirements:
Follow SkillBridge AGENTS.md and knowledge/LIVE_DATA_FRESHNESS.md. Read V04 in outputs/defense-review/SkillBridge_Continuous_Development.md. Run the existing PostgreSQL-specific checks and meaningful concurrency scenarios using core.sse_postgres_test_settings with a dedicated disposable test_ database. Verify attempt finalization, placement capacity, company-image lifecycle, commit/rollback publication and cross-process scoped freshness. If no suitable database exists, prepare the exact setup and test plan and mark those checks unverified. Never reuse production DB credentials or run these tests against the application database.

The acceptance outcomes for this task are:
1. Use a disposable test database through the project's dedicated test configuration. Cover submit-versus-stop, duplicate finalization, competing placement approvals/capacity, company-image replacement/removal and independently observed committed events. Verify rollback does not publish success and streams remain recipient-scoped. Never point destructive tests at the normal database.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A01, A02, A03). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V04, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V04 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v07"></a>

### V07 Complete browser/device and failure-recovery checks

**Type:** System verification / correction. **Order:** Before final local acceptance.

Compatibility, usability, reliability and maintainability. Responsive styling or a single Chrome run does not prove all supported devices.

**Phase:** Local system development. **Hard dependencies:** V01.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Accepted Chrome+Edge desktop1280x900 and Chrome tablet768x1024/phone390x844 emulation verified. Real JWT renewal, IAMS upload/review/template and report downloads, keyboard trap/Escape, no document overflow, map denial/retry, failed-save draft retention/retry/refresh, assessment timer/draft, actual desktop fullscreen entry/exit flagged stop and mobile ordinary submission. Physical devices explicitly unverified.
- Affected files: work/defense_audit/v07_matrix.py and artifacts; knowledge/BROWSER_MATRIX_VERIFICATION.md and overview. No application code edits.
- Tested commit or working-tree build: 227f794 plus preserved application source through V03; current V01 test-only updates; actual installed Chrome/Edge headless, dedicated localhostPG and provider adapters.
- Checks and outcomes: All4 accepted configurations passed4groups each;0page errors. Phone/tablet rerun additionally waited for loaded result title/category scores and geometry, both passed. Desktop stop and loaded phone result screenshots visually inspected. Six actual-token session/expiry/logout/draft regression groups passed. Initial invalid-address fixture and loading-screenshot timing corrected without weakening app validation. Earlier desktop fullscreen focus timeout did not recur sequentially.
- Evidence paths: work/defense_audit/v07-matrix-progress2.txt; v07-artifacts/results.json; v07-mobile-loaded-final.txt; v07-artifacts/mobile-results.json and screenshots; v07-session-regression.txt; knowledge/BROWSER_MATRIX_VERIFICATION.md
- Blocker or material decision: None for user-accepted local matrix. No physical-device/Safari/Firefox/hosted claim; real provider policy remains hosting acceptance.
- Next exact action: V06 measure accepted200students/8positions/2x30questions/20users baseline, cold/warm/concurrent read/submit/results/report/catalog/rerank/event costs on isolatedPG.

**Acceptance checklist:**

- [x] Use an agreed browser/device matrix. Verify assessment controls/timers/fullscreen, imports, maps, dialogs, downloads, keyboard access, narrow screens and readable errors. Test interrupted connections, refresh, session expiry and permission denial with retained answers/drafts where supported. Distinguish emulation from physical-device testing; report unavailable browsers honestly.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V07; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Complete browser/device and failure-recovery checks.

Requirements:
Follow SkillBridge AGENTS.md and the webapp-testing skill. Read V07 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify the agreed desktop/tablet/mobile and browser matrix, including maps, assessment fullscreen/timer behavior, forms, imports and report downloads. Exercise network interruption, refresh, expired sessions, keyboard navigation and clear recovery/error states using synthetic data. Fix reproducible issues within the current interface conventions. Label emulated versus physical devices and record untested environments rather than claiming universal compatibility.

The acceptance outcomes for this task are:
1. Use an agreed browser/device matrix. Verify assessment controls/timers/fullscreen, imports, maps, dialogs, downloads, keyboard access, narrow screens and readable errors. Test interrupted connections, refresh, session expiry and permission denial with retained answers/drafts where supported. Distinguish emulation from physical-device testing; report unavailable browsers honestly.

Constraints:
Follow the global execution protocol and relevant dependency decisions (V01). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V07, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V07 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v11"></a>

### V11 Verify reproducible setup and maintenance instructions

**Type:** System verification / correction. **Order:** Before final local acceptance.

Maintainability and deployment preparation. The audit's ordinary npm command failed because of a user-level launcher problem; the installed project tools still built successfully. Five lint warnings and stale browser fixtures were also recorded.

**Phase:** Local system development. **Hard dependencies:** S00.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Clean locked frontend/Python installs and safe example configuration; pinned selected spaCy Medium installation and tested runtime lock; isolated migration/bootstrap/admin login/event-pruning checks. Replaced Vite template README and stale setup reference with local operator/user guide. Fixed two map callback lifetime warnings with latest refs; removed three unused suppressions without global npm changes.
- Affected files: README.md; knowledge/LOCAL_SETUP_AND_OPERATIONS.md and overview; frontend README/.env.example/.gitignore; backend .env.example/requirements-nlp-spacy.txt/requirements-nlp.txt/requirements-local.lock.txt; StudentProfile/Setup and three unused company UI suppressions; ignored clean-source/install/bootstrap fixtures
- Tested commit or working-tree build: 227f794 plus preserved uncommitted V11 changes. Clean Python3.13.7/Node24.14.1/PostgreSQL17.11; Django6.0.4/spaCy3.8.16/Medium3.8.0; frontend Vite8.0.3/React19.2.4.
- Checks and outcomes: Fresh npm ci installed228 packages; Python base/NLP installs and pip check passed. Clean Django check/migration drift passed; full259 PostgreSQL tests passed with no skips after correcting copied fixture sibling path. Clean114 frontend tests passed after restoring shared knowledge fixtures; lint0errors/0warnings, build passed. Actual Medium loaded with no fallback; isolated admin bootstrap/login and expiry-only pruning passed. Six grouped browser map/profile cases passed. Initial harness failures retained.
- Evidence paths: work/defense_audit/v11-*; clean-setup/ source/env folders (ignored, no copied .env); requirements-local.lock.txt; knowledge/LOCAL_SETUP_AND_OPERATIONS.md
- Blocker or material decision: None for tested local Windows setup. Optional Stanza resources/Linux hosting/live OAuth, storage and email require separate verification. Official samples/final workflow/device/performance gates remain unchecked.
- Next exact action: V03 direct API role/object/batch/approval/session/rate/key/snapshot security checks with synthetic roles.

**Acceptance checklist:**

- [x] A clean setup can install the intended dependencies, configure example variables without secrets, initialize an isolated database, select/install the required NLP resources and run checks. Record Python/Node/model versions and maintenance operations. Resolve actual reproducibility problems and useful lint warnings without unrelated framework upgrades or refactors. Include operator/user guidance and honest limitations.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V11; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Verify reproducible setup and maintenance instructions.

Requirements:
Follow SkillBridge AGENTS.md. Read V11 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify reproducible frontend/backend setup, dependency manifests, example configuration, migrations, optional NLP resources, testing and operator instructions. Distinguish the local npm-launcher issue from project defects; resolve necessary setup problems without altering unrelated global settings. Review remaining lint warnings and stale instructions, making focused justified corrections. Document versions and commands, use synthetic/local configuration, and keep all secret values out of tracked files.

The acceptance outcomes for this task are:
1. A clean setup can install the intended dependencies, configure example variables without secrets, initialize an isolated database, select/install the required NLP resources and run checks. Record Python/Node/model versions and maintenance operations. Resolve actual reproducibility problems and useful lint warnings without unrelated framework upgrades or refactors. Include operator/user guidance and honest limitations.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V11, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V11 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v03"></a>

### V03 Verify local backend access controls and sensitive-data handling

**Type:** Security verification. **Order:** Before local acceptance.

Authentication controls exist. System completion includes preventing unauthorized access and safely handling invalid data; a local app still needs backend enforcement.

**Phase:** Local system development. **Hard dependencies:** A01, A03, A05, A06, A07.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Current database role/activity/approval/enrollment checked on JWT requests; fixed IP login throttle and unknown-identity hashing. Direct API role/object/batch matrix; private answer keys and placement snapshots protected. Legacy foreign snapshot removal/rejection/approval denied to instructor; inactive targets require restore for new assignment, existing history/removal preserved. Local credential logging and notification/map HTML escaped. Real session/cache renewal/logout isolation verified.
- Affected files: api/authentication.py, logging_filters.py, backends.py, views.py, test_access_security.py, test_concurrent_workflows.py; core/settings.py; frontend escapeHtml utility/tests and dynamic map components/browser fixtures; knowledge/LOCAL_SECURITY_REVIEW.md, EXTERNAL_SERVICE_RECOVERY.md and overview. LoginRateThrottle is in views.py; no api/throttles.py exists.
- Tested commit or working-tree build: 227f794 plus preserved uncommitted changes through final V03 run; isolated localhost PostgreSQL17.11 and synthetic browser fixtures only. Manifest recorded in latest checkpoint.
- Checks and outcomes: Final280/280 PostgreSQL API tests passed with zero skips, including20 security tests, role matrix and concurrency; Django check passed and final isolated model-drift check found no changes. Frontend116/116 passed; resumed final lint0errors/0warnings and build passed on unchanged frontend source. Six real-token session browser groups, one markup browser group and supplementary E02 company/general recovery checks passed. Intermediate failures retained; see security notes.
- Evidence paths: work/defense_audit/v03-postgres-final.txt; v03-role-matrix.txt; v03-session-browser.txt; v03-map-resumed.txt; v03-frontend-unit.txt; v03-check.txt; v03-model-drift-final.txt; e02-lint-resumed-final.txt; e02-build-resumed-final.txt; knowledge/LOCAL_SECURITY_REVIEW.md
- Blocker or material decision: None for local V03 criteria. Actual hosted TLS/CORS/CSP/proxy/logging/rate-store/Supabase exposure and provider policy checks remain hosting-only; no live actions performed.
- Next exact action: Local security checks also passed in the current287-test V06 regression. P02 official IAMS is verified; V01/V07/V06 now complete under provisional question format. Only P01 official LMS comparison remains before formal S01; hosting follows recorded dependency decision.

**Acceptance checklist:**

- [x] Verify student/instructor/admin role, object, batch, approval and active-account boundaries, including direct API calls bypassing hidden UI controls.
- [x] Check identity/provider handling, input limits, meaningful rate controls and safe errors/logging without secrets or unnecessary student data.
- [x] Review session/cache isolation, logout, stale requests and account changes; protect answer keys and placement snapshots.
- [x] Fix reproduced local defects and document remaining hosted configuration checks separately. Do not mandate an unrelated authentication redesign without evidence.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V03; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Verify local backend access controls and sensitive-data handling.

Requirements:
Follow SkillBridge AGENTS.md. Read V03 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify local backend authentication, role/object/batch permissions, approval/activity/enrollment gates, identity/cache isolation, answer-key protection, validation and safe errors/logging. Reproduce and fix scoped defects using isolated synthetic roles, including direct API requests that bypass the frontend. Do not expose secrets or attack hosted services. Keep production TLS/CORS/provider configuration verification for the hosting phase and report actual coverage.

The acceptance outcomes for this task are:
1. Verify student/instructor/admin role, object, batch, approval and active-account boundaries, including direct API calls bypassing hidden UI controls.
2. Check identity/provider handling, input limits, meaningful rate controls and safe errors/logging without secrets or unnecessary student data.
3. Review session/cache isolation, logout, stale requests and account changes; protect answer keys and placement snapshots.
4. Fix reproduced local defects and document remaining hosted configuration checks separately. Do not mandate an unrelated authentication redesign without evidence.

Constraints:
Follow the global execution protocol and relevant dependency decisions (A01, A03, A05, A06, A07). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V03, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V03 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v06"></a>

### V06 Verify acceptable local performance for the agreed workload

**Type:** Performance verification. **Order:** Stable local build.

Performance means the agreed flows remain usable at the expected demonstration workload. Notebook batch times are not UI/API response-time measurements.

**Phase:** Local system development. **Hard dependencies:** V01, V02.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Accepted 200 students/8 positions/2x30 questions/20 concurrent users measured locally with actual spaCy Medium. Batched validated answer persistence; bounded successful exact-text/model lemma cache; removed artificial800ms navigation pause; batched atomic recommendation upserts preserve IDs/history and nullable legacy behavior. Final varied-answer benchmark validates20 score patterns/cohort and unchanged ranking components.
- Affected files: api/scoring.py/test_submission_integrity.py; recommendation_nlp.py/test_nlp_runtime.py; StudentAssessment.jsx removal of800ms success-navigation pause; isolatedV06 fixtures/benchmarks. No migrations, score weights, TF-IDF corpus or authorization changes.
- Tested commit or working-tree build: 227f794 plus preserved uncommitted source; current manifest work/defense_audit/checkpoint-code-manifest-v06-complete.json covers167files SHA256 e6d17ffa3f9bf906af4b562f488cbd231b8d195b005fb72ef739a0626a4e9832. No configured Supabase database action.
- Checks and outcomes: 324 measured HTTP requests,0 errors: cold11.801s; normal-read p95 .225-.579s;60 concurrent varied submits p95=3.628s/max3.645s;60 post-result reads p95=.309s;60 reads+20streams p95=1.674s;3reranks max14.285s. Loaded browser submit4.826s,2warm submits1.751/1.452s,6warm final renders1.156-1.540s;0pageerrors. Actual ranking8IDs/all components exactly match reference. Full287 PostgreSQL and116 frontend tests passed,no skips;Django check/migration drift/lint/build passed;15linked real workflow+4timing+6session browser groups passed. Earlier failed timings preserved; see PERFORMANCE_VERIFICATION for setup/backlog64/small-sample/earlier20.593s cold diagnostic limitations.
- Evidence paths: knowledge/PERFORMANCE_VERIFICATION.md;work/defense_audit/v06-results-varied.json;v06-benchmark-varied-final.txt;v06-ui-after-upsert.json;v06-ui-after-upsert.txt;v06-submit-profile-before-upsert.json;v06-postgres-final.txt;v06-frontend-unit.txt;v06-lint.txt;v06-build.txt;v06-system-check.txt;v06-migration-check.txt;v06-linked-workflow.txt;v06-timing-browser.txt;v06-session-browser.txt;checkpoint-code-manifest-v06-complete.json
- Blocker or material decision: None for V06. Local fixture uses listener backlog64;host-specific concurrency/worker measurements remain V05. P01 official LMS comparison stays pending.
- Next exact action: Reconcile S01 evidence; official P01 dependency remains. Await requested sequencing decision about hosting preparation with final sign-off still unchecked.

**Acceptance checklist:**

- [x] Define realistic local students, questions, positions and concurrent users, plus user/adviser-accepted response/error targets. Do not invent universal limits.
- [x] Measure cold/warm submission, results, reports, catalogs and representative concurrent activity; include reranking and event-stream cost where relevant.
- [x] Record environment, sample sizes, repetitions, observed latency/error rate and any justified p50/p95 summary. Optimize demonstrated bottlenecks without changing agreed scoring/ranking.
- [x] Keep hosting-specific measurements for V05; do not turn this into an enterprise-scale stress project or load-test production.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V06; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Verify acceptable local performance for the agreed workload.

Requirements:
Follow SkillBridge AGENTS.md. Read V06 in outputs/defense-review/SkillBridge_Continuous_Development.md. Establish the agreed realistic local defense workload and measurable usability/performance targets, then measure key API/UI flows, cold/warm behavior and representative concurrency using synthetic data. Investigate and fix demonstrated bottlenecks without changing scoring/ranking semantics or adding unrelated infrastructure. Record actual timings, error rates and test conditions. Do not treat notebook processing time as web latency or require enterprise-scale load beyond agreed scope.

The acceptance outcomes for this task are:
1. Define realistic local students, questions, positions and concurrent users, plus user/adviser-accepted response/error targets. Do not invent universal limits.
2. Measure cold/warm submission, results, reports, catalogs and representative concurrent activity; include reranking and event-stream cost where relevant.
3. Record environment, sample sizes, repetitions, observed latency/error rate and any justified p50/p95 summary. Optimize demonstrated bottlenecks without changing agreed scoring/ranking.
4. Keep hosting-specific measurements for V05; do not turn this into an enterprise-scale stress project or load-test production.

Constraints:
Follow the global execution protocol and relevant dependency decisions (V01, V02). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V06, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V06 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-s01"></a>

### S01 Sign off complete and correct local system behavior

**Type:** Local acceptance gate. **Order:** After required local tasks.

This is the first milestone: 100% of the agreed functional scope implemented and verified locally. It is not hosted acceptance, 100% model accuracy, or a promise that no future defect can occur.

**Phase:** Local system development. **Hard dependencies:** S00, A01, A02, A03, A07, A05, A06, N01, N02, N04, P01, P02, P03, E01, E02, V01, V02, V04, V07, V11, V03, V06.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: All23local task gates including S01 passed for agreed scope;user-designated current question format is final,official comparison later. Three role lifecycle,score/history/permissions/capacity/errors/recovery,accepted browser matrix and performance verified. No known unresolved critical/high local workflow defect. Hosted providers/CSP/operations remain separate tasks.
- Affected files: Current preserved working tree across completed local tasks;latest P01 validation guards and accepted-format scope docs. Release evidence/feature matrix reconciled in this tracker.
- Tested commit or working-tree build: 227f794 plus preserved uncommitted local release;work/defense_audit/checkpoint-code-manifest-local-final.json covers174source/test/knowledge/config files;SHA256 cfd2d248d7466d9a3c8d81cb85154e6ae9dc765fc38c901f1e58d666799430d7. Final backend291/frontend116 pass;exact applicable browser/performance evidence in task record. No release commit/push or hosted action performed.
- Checks and outcomes: Current final backend291PG(no skips)pass after V10health addition;current frontend116(no skips),lint/build/check/drift pass. Existing linked15role+4timing+6session,V07acceptedmatrix,V06acceptedbenchmark unchanged;P01currentformat10groups pass. All local criteria remain passed;four actual hosted tasks stay unchecked.
- Evidence paths: knowledge/QUESTION_IMPORT_FORMAT.md;LOCAL_WORKFLOW_ACCEPTANCE.md;BROWSER_MATRIX_VERIFICATION.md;LOCAL_SECURITY_REVIEW.md;PERFORMANCE_VERIFICATION.md;work/defense_audit/v06-*final*/v06-linked-workflow.txt/v06-timing-browser.txt/v06-session-browser.txt;p01-import-final2.txt;p01-frontend-unit.txt;p01-lint.txt;p01-build.txt
- Blocker or material decision: None for local accepted release. Official LMS comparison deferred explicitly by user;unseen compatibility not claimed. User owns Vercel/Railway hosting and subscription. Actual live provider,operational and hosted acceptance still unverified.
- Next exact action: Local acceptance complete;A04alsoverified. User owns publishing;remaining V05/V09/V10/S02 require actual host/capability/synthetic-boundary evidence. Official LMS comparison is later non-gating follow-up by explicit decision.

**Acceptance checklist:**

- [x] Every agreed feature has a passed local acceptance scenario and relevant invalid/error/recovery cases. Mark missing samples/decisions as unresolved rather than passed.
- [x] No unresolved critical/high issue affecting required workflows, score integrity, access control, data loss, capacity or normal error recovery. Record any genuinely nonblocking issues.
- [x] Run relevant backend checks on isolated settings, frontend lint/build and unit/browser checks on the exact intended release. Skipped database/locking checks are not passes.
- [x] Demonstrate all role workflows with reproducible synthetic accounts/data and sample exports; record tested commit, evidence and remaining host-only tasks.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is S01; phase is Local system development. Existing features may already satisfy some criteria.

Objective:
Sign off complete and correct local system behavior.

Requirements:
Follow SkillBridge AGENTS.md. Read S01 in outputs/defense-review/SkillBridge_Continuous_Development.md. Review the exact current local release against S00 and completed system tasks. Run appropriate isolated backend, frontend build/lint/unit and browser acceptance checks, and demonstrate every agreed role workflow with synthetic data and relevant error/recovery cases. Fix remaining scoped blockers and record evidence. Report local scope complete only if all required local criteria pass; keep hosted checks explicitly pending and do not equate completion with perfect NLP accuracy.

The acceptance outcomes for this task are:
1. Every agreed feature has a passed local acceptance scenario and relevant invalid/error/recovery cases. Mark missing samples/decisions as unresolved rather than passed.
2. No unresolved critical/high issue affecting required workflows, score integrity, access control, data loss, capacity or normal error recovery. Record any genuinely nonblocking issues.
3. Run relevant backend checks on isolated settings, frontend lint/build and unit/browser checks on the exact intended release. Skipped database/locking checks are not passes.
4. Demonstrate all role workflows with reproducible synthetic accounts/data and sample exports; record tested commit, evidence and remaining host-only tasks.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S00, A01, A02, A03, A07, A05, A06, N01, N02, N04, P01, P02, P03, E01, E02, V01, V02, V04, V07, V11, V03, V06). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify S01, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep S01 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-a04"></a>

### A04 Correct production browser policy for maps and images

**Type:** Configuration correction. **Order:** Prepare after local completion; test before defense.

Objective 4, functional requirement 12, deployed compatibility/security. Local Chrome with the exact repository CSP blocked Nominatim geocoding and a synthetic Supabase branding image. The actual remote served policy was not verified.

**Phase:** Hosting after local acceptance. **Hard dependencies:** S01.

**Completion record:**

- Status: Done
- Started: 18 October 2026
- Completed: 18 October 2026
- Implemented or verified behavior: Added only Nominatim connect origin,configured exact company-branding image origin,and GIS connect/style paths;retained other CSP directives/security headers. Built app tested with exact headers and synthetic external responses;actual local backend Google-adapter sign-in passed.
- Affected files: skillbridge-frontend/vercel.json;knowledge/PRODUCTION_BROWSER_POLICY.md;overview;isolated a04_policy_browser.py. No provider/project settings or deployment changed.
- Tested commit or working-tree build: 227f794 plus preserved uncommitted local release;work/defense_audit/checkpoint-code-manifest-local-final.json covers174source/test/knowledge/config files;SHA256 cfd2d248d7466d9a3c8d81cb85154e6ae9dc765fc38c901f1e58d666799430d7. Final backend291/frontend116 pass;exact applicable browser/performance evidence in task record. No release commit/push or hosted action performed.
- Checks and outcomes: Before4required cases blocked. After11required resource cases+actual built sign-in passed;unrelated image,other Storage project and unrelated connect remain blocked;only3intentional violation events;0pageerrors. Production build passed;actualhost/provider availability remains V05.
- Evidence paths: work/defense_audit/a04-policy-before.txt;a04-policy-after.txt;a04-artifacts/before.json;a04-artifacts/after.json;a04-artifacts/policy-check.png;a04-production-build.txt;knowledge/PRODUCTION_BROWSER_POLICY.md
- Blocker or material decision: None for configured-policy criterion. Actual served headers/live Google/provider tests await user-operated hosting.
- Next exact action: V05 concrete release handoff;V09 isolated restore and V10 local health/recovery preparation while hosting paused.

**Acceptance checklist:**

- [x] Narrowly permit the configured required geocoding and image origins, retaining the rest of the security policy. Verify Google sign-in, Leaflet assets/tiles, profile photos, company images and address requests under production-equivalent headers. Separate configured-policy results from real hosted results.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is A04; phase is Hosting after local acceptance. Existing features may already satisfy some criteria.

Objective:
Correct production browser policy for maps and images.

Requirements:
Follow SkillBridge AGENTS.md. Read task A04 in outputs/defense-review/SkillBridge_Continuous_Development.md. Inspect frontend vercel.json and the origins actually used by maps, geocoding, Google sign-in and company branding. Correct the narrow CSP allowlists so required resources work without removing CSP or broadly permitting every origin. Verify a built site with production-equivalent headers and synthetic data. Record which hosted checks remain pending; prepare the change without publishing it automatically.

The acceptance outcomes for this task are:
1. Narrowly permit the configured required geocoding and image origins, retaining the rest of the security policy. Verify Google sign-in, Leaflet assets/tiles, profile photos, company images and address requests under production-equivalent headers. Separate configured-policy results from real hosted results.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S01). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify A04, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep A04 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v05"></a>

### V05 Host the completed release and verify real integrations

**Type:** Release preparation / verification. **Order:** After S01 and A04.

The user plans to host before the defense. Prepare deployment only after local features work, then verify environment-specific behavior on the intended hosted build.

**Phase:** Hosting after local acceptance. **Hard dependencies:** S01, A04.

**Completion record:**

- Status: Prepared locally;waiting for user-operated live release
- Started: 18 October 2026
- Completed: Not completed
- Implemented or verified behavior: Concrete owner-run Vercel/Railway release instructions include intended origins,public/private environment names,production build,selected model dependencies,existing Procfile,migration plan/static steps,health,rollback and synthetic live verification boundary. User owns subscription/reactivation/publishing;no agent host action.
- Affected files: knowledge/RELEASE_AND_RECOVERY_HANDOFF.md;PRODUCTION_BROWSER_POLICY.md;overview;api/health.py and route/tests prepared under V10.
- Tested commit or working-tree build: 227f794 plus preserved uncommitted local release;work/defense_audit/checkpoint-code-manifest-local-final.json covers174source/test/knowledge/config files;SHA256 cfd2d248d7466d9a3c8d81cb85154e6ae9dc765fc38c901f1e58d666799430d7. Final backend291/frontend116 pass;exact applicable browser/performance evidence in task record. No release commit/push or hosted action performed.
- Checks and outcomes: Local production build/exact CSP pass;current291PG(no skips),116frontend(no skips),lint/build/check/drift plus prior real workflow/matrix/performance and new P01 checks pass. Actual served commit,HTTPS/provider/role/SSE/hosted performance checks not run.
- Evidence paths: knowledge/RELEASE_AND_RECOVERY_HANDOFF.md;PRODUCTION_BROWSER_POLICY.md;work/defense_audit/a04-*;hosting-prep-postgres-after.txt;hosting-prep-check.txt;hosting-prep-migrations.txt;p01-frontend-unit.txt;p01-lint.txt;p01-build.txt
- Blocker or material decision: Railway subscription/release paused;user will operate Vercel/Railway. Need actual released commit/environment and authorized isolated synthetic hosted boundary before live mutations/integration tests. No account secrets requested or external writes authorized.
- Next exact action: User saves/publishes intended release and reactivates Railway when ready;then identify actual served version/URLs and authorize exact synthetic demo boundary to finish V05. Do not count local mocks as hosted passes.

**Acceptance checklist:**

- [ ] Identify release commit and intended origins/services; prepare builds, required environment names, migration/static/startup steps and rollback instructions without revealing secrets.
- [ ] Perform hosting/deployment actions only when authorized in that task. Verify served frontend routes, API connectivity, HTTPS/hosts/CORS/CSP, Google origins, selected model, email/storage, maps/images, downloads and SSE.
- [ ] Use authorized disposable staging/demo records for mutations and a documented cleanup boundary. Do not alter real grades/placements as a smoke test.
- [ ] Repeat the essential three-role and error/retry flows on the actual hosted build; compare errors/response time with accepted expectations. Network failures in the review environment do not prove a host is down.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V05; phase is Hosting after local acceptance. Existing features may already satisfy some criteria.

Objective:
Host the completed release and verify real integrations.

Requirements:
Follow SkillBridge AGENTS.md. Read V05 in outputs/defense-review/SkillBridge_Continuous_Development.md. Confirm local gate S01 passes, then prepare the completed release for the intended hosts with concrete configuration, build/startup/migration and rollback steps. Publish or apply hosted changes only within the authorization available in this task. Verify the actual hosted commit, routes/API, TLS/hosts/CORS/CSP, OAuth, model resources, email/storage, maps/images, downloads and SSE. Repeat essential role workflows and error recovery using authorized disposable data. Do not mark inaccessible hosted checks as passed.

The acceptance outcomes for this task are:
1. Identify release commit and intended origins/services; prepare builds, required environment names, migration/static/startup steps and rollback instructions without revealing secrets.
2. Perform hosting/deployment actions only when authorized in that task. Verify served frontend routes, API connectivity, HTTPS/hosts/CORS/CSP, Google origins, selected model, email/storage, maps/images, downloads and SSE.
3. Use authorized disposable staging/demo records for mutations and a documented cleanup boundary. Do not alter real grades/placements as a smoke test.
4. Repeat the essential three-role and error/retry flows on the actual hosted build; compare errors/response time with accepted expectations. Network failures in the review environment do not prove a host is down.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S01, A04). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V05, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V05 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v09"></a>

### V09 Verify a usable backup restore and release rollback path

**Type:** Basic operational reliability. **Order:** Before hosted acceptance.

Match the agreed paper/system reliability scope to actual capabilities. A database-backed deployment needs a usable recovery approach; provider backup coverage must be verified, not assumed.

**Phase:** Hosting after local acceptance. **Hard dependencies:** S01.

**Completion record:**

- Status: Isolated restore verified;actual provider backup/rollback evidence pending
- Started: 18 October 2026
- Completed: Not completed
- Implemented or verified behavior: Real PostgreSQL17.11 custom dump and distinct disposable restore recover all23application tables/counts/content hashes,known raw/max/finalized profile,placement ID/snapshot and branding DB key. Separate synthetic WebP archive restores identical bytes;source unchanged. Owner-run release rollback procedure prepared.
- Affected files: work/defense_audit/v09_restore.py/v09-artifacts;knowledge/RELEASE_AND_RECOVERY_HANDOFF.md
- Tested commit or working-tree build: 227f794 plus preserved uncommitted local release;work/defense_audit/checkpoint-code-manifest-local-final.json covers174source/test/knowledge/config files;SHA256 cfd2d248d7466d9a3c8d81cb85154e6ae9dc765fc38c901f1e58d666799430d7. Final backend291/frontend116 pass;exact applicable browser/performance evidence in task record. No release commit/push or hosted action performed.
- Checks and outcomes: Dump118453bytes in0.990s;restore1.938s;all application row hashes match;branding66bytes SHA256 matches. Both exact disposable DBs cleaned. No hosted retention/PITR/Storage backup coverage,cutover or hosted code rollback verified.
- Evidence paths: work/defense_audit/v09-local-restore.txt;v09-artifacts/results.json;synthetic.dump;synthetic-branding.zip;knowledge/RELEASE_AND_RECOVERY_HANDOFF.md
- Blocker or material decision: Actual database/branding provider backup schedule/retention and previous hosted release IDs unavailable. User-owned live hosting paused;no export/restore/rollback of real data authorized. Local rehearsal does not establish provider coverage or production recovery time.
- Next exact action: Record actual provider backup and branding coverage/retention;retain prior release IDs/commit. Rehearse provider procedure into authorized isolated target and verify owner-run hosted rollback;never restore over production as a test.

**Acceptance checklist:**

- [ ] Record actual backup scope/retention, database and branding storage coverage, responsible operator and instructions.
- [x] Demonstrate recovery with synthetic or authorized sanitized data into an isolated target, never over production.
- [ ] Prepare a working release rollback procedure and record observed recovery limits against the accepted requirements.
- [ ] Do not add paid backup tiers or enterprise disaster recovery unless explicitly agreed; unresolved required recovery behavior remains an open item.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V09; phase is Hosting after local acceptance. Existing features may already satisfy some criteria.

Objective:
Verify a usable backup restore and release rollback path.

Requirements:
Follow SkillBridge AGENTS.md. Read V09 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify a practical backup, isolated restore and release rollback procedure for the intended hosted system within the agreed scope. Confirm actual provider capabilities and database/storage coverage. Test only with synthetic or authorized sanitized data in a separate target, record results and owner instructions, and prepare missing configuration steps. Do not restore over production, export private records or purchase services without authorization.

The acceptance outcomes for this task are:
1. Record actual backup scope/retention, database and branding storage coverage, responsible operator and instructions.
2. Demonstrate recovery with synthetic or authorized sanitized data into an isolated target, never over production.
3. Prepare a working release rollback procedure and record observed recovery limits against the accepted requirements.
4. Do not add paid backup tiers or enterprise disaster recovery unless explicitly agreed; unresolved required recovery behavior remains an open item.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S01). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V09, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V09 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-v10"></a>

### V10 Verify startup recovery and basic hosting health checks

**Type:** Operational reliability. **Order:** Before hosted acceptance.

Confirm that the deployed system starts, remains observable and can be recovered. The paper references automatic failover, but no accepted/configured topology was established in the audit.

**Phase:** Hosting after local acceptance. **Hard dependencies:** S01.

**Completion record:**

- Status: Local readiness/recovery implemented and tested;hosted restart evidence pending
- Started: 18 October 2026
- Completed: Not completed
- Implemented or verified behavior: Read-only public GET/HEAD /api/health/ checks DB SELECT1,returnscoarse200/503 withno-store,no JWT or sensitive details;existing API permissions/throttles retained. Safe outage log and method contract tested. RealHTTP200/refused local DB503/recovered200 verified. Owner/recovery guidance prepared;option1manual restart/redeploy/backup restore recommended in response to user question.
- Affected files: api/health.py;api/urls.py;api/test_health.py;test_access_security.py explicitpublic probe inventory;knowledge/RELEASE_AND_RECOVERY_HANDOFF.md;isolated v10_probe_recovery.py
- Tested commit or working-tree build: 227f794 plus preserved uncommitted local release;work/defense_audit/checkpoint-code-manifest-local-final.json covers174source/test/knowledge/config files;SHA256 cfd2d248d7466d9a3c8d81cb85154e6ae9dc765fc38c901f1e58d666799430d7. Final backend291/frontend116 pass;exact applicable browser/performance evidence in task record. No release commit/push or hosted action performed.
- Checks and outcomes: Full291PG tests(no skips)pass;Django check/no model drift. Four health tests cover200/no-store,invalidJWT,503 safe logs,HEAD/405. RealHTTPoutage recovery200/.197s→503/2.052s→200/.102s. Current frontend116/lint/build unchanged andpassed;A04exactheaders pass. Initial full suite failed only old public-route inventory;failure retained and corrected by explicit health contract.
- Evidence paths: work/defense_audit/hosting-prep-postgres-final.txt (initial inventory failure);hosting-prep-postgres-after.txt;hosting-prep-check.txt;hosting-prep-migrations.txt;v10-probe-recovery.txt/json;knowledge/RELEASE_AND_RECOVERY_HANDOFF.md
- Blocker or material decision: ActualRailway startup/restart/monitor/proxy behavior unverified whilepaused. Manual recovery recommended after user asks whetheroption1fitscapstone;do not treat this as verified automatic failover or silently claim the paper promise met. Final reliability wording/capabilities need confirmation at hosted acceptance.
- Next exact action: Owner configures /api/health/ andhealthcheck.railway.app allowedhost inactualRailway settings;verifyHTTP/HTTPS/start/restart,boundedfailures,safelogs andaccepted manual-recovery scope whenlive. No infrastructure purchase or provider change done.

**Acceptance checklist:**

- [ ] Verify startup/restart, database/service unavailability messages, bounded waits, safe logs and a useful health/monitoring procedure.
- [ ] Record responsible operator and recovery steps appropriate to the actual hosting plan; verify any promised automatic failover instead of assuming it.
- [ ] If the agreed failover requirement cannot be met by the intended setup, surface the concrete capability/scope decision rather than silently dropping the promise or buying infrastructure.
- [ ] Do not make formal research surveys or enterprise alerting prerequisites for ordinary feature completion. Actual agreed reliability requirements still need evidence before hosted sign-off.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is V10; phase is Hosting after local acceptance. Existing features may already satisfy some criteria.

Objective:
Verify startup recovery and basic hosting health checks.

Requirements:
Follow SkillBridge AGENTS.md. Read V10 in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify practical hosted startup/restart, service-outage handling, safe diagnostic logs, health checks and operator recovery for the actual deployment plan. Check any agreed automatic-failover promise against real configured capabilities and surface a material mismatch for an explicit decision. Implement scoped application health/error handling where needed, but do not purchase infrastructure, weaken security, change external permissions or send alerts without authorization. Record actual observed behavior.

The acceptance outcomes for this task are:
1. Verify startup/restart, database/service unavailability messages, bounded waits, safe logs and a useful health/monitoring procedure.
2. Record responsible operator and recovery steps appropriate to the actual hosting plan; verify any promised automatic failover instead of assuming it.
3. If the agreed failover requirement cannot be met by the intended setup, surface the concrete capability/scope decision rather than silently dropping the promise or buying infrastructure.
4. Do not make formal research surveys or enterprise alerting prerequisites for ordinary feature completion. Actual agreed reliability requirements still need evidence before hosted sign-off.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S01). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify V10, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep V10 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


<a id="task-s02"></a>

### S02 Accept the hosted system for the predeployment defense

**Type:** Final system acceptance. **Order:** Last system task.

Final target: all agreed features work locally and on the build demonstrated at defense, with correct results, permissions and error handling. This does not require 100% NLP prediction accuracy.

**Phase:** Hosting after local acceptance. **Hard dependencies:** S01, A04, V05, V09, V10.

**Completion record:**

- Status: Waiting for actual hosted acceptance dependencies
- Started: Not started
- Completed: Not completed
- Implemented or verified behavior: Not yet recorded
- Affected files: Not yet recorded
- Tested commit or working-tree build: Not yet recorded
- Checks and outcomes: Not run in this execution
- Evidence paths: None yet
- Blocker or material decision: S01/A04 passed locally;V05/V09/V10 live acceptance remains incomplete whileuser-operated Railway release ispaused. No hosted system-ready claim.
- Next exact action: After user-operated release andhosted operational evidence,verify exactrelease andessentialthree-role/error/performance/report/capacity flows inauthorized synthetic hostedboundary;then accept only on actual passes.

**Acceptance checklist:**

- [ ] S01 local acceptance and required hosting tasks are complete on the same released behavior; every agreed feature has evidence and no unresolved blocking defect.
- [ ] Verify all three roles, invalid/error/recovery cases, representative performance, report outputs, saved data and placement capacity/history on the final demo release.
- [ ] Prepare stable synthetic demo records/accounts, sample exports, recovery instructions and a practical contingency demonstration.
- [ ] Report exact tested commit, known nonblocking limitations and a ready/not-ready decision based on the acceptance matrix. Do not use a count of closed prompts as proof of 100% scope completion.

**Structured task prompt:**

```text
Context:
SkillBridge is a React/Vite frontend and Django/DRF backend with PostgreSQL. We are completing all agreed features locally before hosting for the defense. Read AGENTS.md, the project overview and applicable skills, and use outputs/defense-review/SkillBridge_Continuous_Development.md as the single execution tracker. Current task is S02; phase is Hosting after local acceptance. Existing features may already satisfy some criteria.

Objective:
Accept the hosted system for the predeployment defense.

Requirements:
Follow SkillBridge AGENTS.md. Read S02 and the acceptance matrix in outputs/defense-review/SkillBridge_Continuous_Development.md. Verify that the final hosted build meets every agreed system feature and required local/hosted error-handling criterion, with all three roles and realistic synthetic demo records. Recheck critical paths, saved results, placements/capacity/history, maps, reports, session recovery and external integration failures. Resolve scoped blockers, prepare contingency/recovery guidance and record the tested release and evidence. Declare complete only on passed criteria, not model accuracy or task-count percentages. Keep thesis writing and research surveys outside this system sign-off.

The acceptance outcomes for this task are:
1. S01 local acceptance and required hosting tasks are complete on the same released behavior; every agreed feature has evidence and no unresolved blocking defect.
2. Verify all three roles, invalid/error/recovery cases, representative performance, report outputs, saved data and placement capacity/history on the final demo release.
3. Prepare stable synthetic demo records/accounts, sample exports, recovery instructions and a practical contingency demonstration.
4. Report exact tested commit, known nonblocking limitations and a ready/not-ready decision based on the acceptance matrix. Do not use a count of closed prompts as proof of 100% scope completion.

Constraints:
Follow the global execution protocol and relevant dependency decisions (S01, A04, V05, V09, V10). Preserve existing user changes, role/batch permissions, agreed scoring/ranking semantics and historical records. Use isolated synthetic tests and mocks for external failures. Do not add unrelated features, invent success, weaken assertions, rewrite real scores/placements, send live messages, change provider permissions, buy services or deploy/apply production migrations without the necessary authorization. Material unresolved choices must remain visible; routine safe local fixes should proceed.

Expected output:
Implement or verify S02, run the relevant checks, and save the files/evidence. Update its criterion checkboxes and completion record; check its master checkbox only when all required outcomes pass. Save the execution state and a work-log entry, then continue directly to the next actionable unchecked task under the protocol. If blocked, keep S02 unchecked, record the exact condition, and work on independent tasks. If the session must end, save the next exact action rather than claiming unfinished work is complete.
```


## Work log

Append an entry after each task completion, block, resumption, regression or interruption. Keep earlier entries. Evidence must be real; do not replace the example placeholders with guessed results.

| Date | Task | Transition | Change or finding | Checks / evidence | Next task or exact blocker |
|---|---|---|---|---|---|
| 18 October 2026 | Plan | Created | Checklist and structured prompts prepared; no task executed | Document structure/link validation only | S00 |
| 18 October 2026 | S00 | Done → A01 in progress | Scope matrix and policy register saved; user supplied expiry and staff decisions; pending samples/targets remain open | Current-source inspection and extracted requirements; structural validation follows | A01 isolated regression reproduction |
| 18 October 2026 | A01 | Done → A02 in progress | Authoritative grading and atomic payload rejection implemented; no historical repair | a01-before.txt: reproduced failures; a01-after.txt: 52/52 passed on isolated SQLite; document validator passed | A02 server expiry/grace/review and attempt identity |
| 18 October 2026 | A02 | Implementation saved; unchecked → independent A03 | 59 focused tests and broader local checks pass; concurrency test skipped and browser driver startup blocked; no acceptance fabricated | a02-backend/all-backend/node-tests/build/lint logs | A02 needs disposable PostgreSQL and browser run; independent A03 starts |
| 18 October 2026 | S00/A02 | Decisions updated; browser passed | User clarified slot/area analytics and fewer than 10 positions. Four real Chrome recovery/timing cases passed; portable PostgreSQL setup in progress. | a02-browser.txt and ignored attempt-timing/results.json; official archive https://www.enterprisedb.com/download-postgresql-binaries | Continue A03 UI verification and A02 PostgreSQL race |
| 18 October 2026 | A03 | Done → A07 in progress | Atomic catalog validation and truthful recovery complete; historical placements protected; no unrelated redesign | 179 API tests (176 pass, 3 skips); 95 frontend tests, build/lint, four grouped mocked-API Chrome checks | A07; A02 locking verification now has official portable PostgreSQL runtime |
| 18 October 2026 | A02 | Done (PostgreSQL blocker resolved) | Portable official PostgreSQL 17.11 initialized and bound to localhost only; actual submit/stop race passed; all A02 criteria verified | a02-a03-postgres.txt: 22/22 passed on disposable PostgreSQL; a02-browser.txt: four grouped local cases passed | Continue A07; broader PostgreSQL verification is V04 |
| 18 October 2026 | A07 | Done → A05 in progress | Verified role login/onboarding and closed inactive/unverified token issuance defects; notification copy now distinguishes queue from delivery | 186 API discovered/183 passed/3 skips; 95 frontend tests/build/lint; 12 Chrome auth cases | A05 assisted admin password recovery |
| 18 October 2026 | A05 | Done → A06 in progress | Truthful assisted recovery and Google support guidance implemented; real Django reset verified only on synthetic admins | 14/14 backend tests; three grouped Chrome checks; lint/build logs | A06 shared-client renewal, revocation and SSE |
| 18 October 2026 | A06 | Done → N01 in progress | Renewal and per-student draft isolation verified; resolved PostgreSQL fixture connection issue without weakening assertions; all full PostgreSQL API tests now pass | 196/196 PostgreSQL; 100/100 frontend; build/lint; six real-token browser cases and four A02 regression cases | N01 runtime resource/fallback verification |
| 18 October 2026 | N01 | Done → N02 in progress | Real default medium model loaded, explicit fallback verified, and false empty-result model identity fixed; research plans preserved | n01-runtime.json; 70/70 focused backend, two Chrome UI cases, lint/build | N02 ranking/eligibility and invalid-coordinate scenarios |
| 18 October 2026 | N02 | Resumed on CONTINUE | All paused source hashes unchanged; research document additions preserved. Applicable recommendation/React/PostgreSQL guidance inspected. | Manifest reconciliation and current-source discovery; no fresh runtime pass yet | N02 isolated regression reproduction |
| 18 October 2026 | N02 | Done; N04 started | Stable exact-score ranking, valid coordinates and legacy addresses; capacity remains a separate gate | 209 PostgreSQL API / 103 frontend tests; four browser states; knowledge/RECOMMENDATION_CONTRACT.md | N04 synthetic suggestion and narrative audit |
| 18 October 2026 | N04 | Done | Advisory suggestions, valid shared category references and truthful text; delayed suggestion defect fixed | 219 PostgreSQL tests; three browser checks; lint/build passed | P01/P02 wait for official samples; continue P03 |
| 18 October 2026 | P03 | Done; E01 started | Panel capacity and company-area definition confirmed by user; arithmetic already correct, labels clarified | 24 focused PostgreSQL tests; two browser display cases; lint/build | E01 profile/authoring mutation boundaries and safe recovery |
| 18 October 2026 | E01 | Partial checkpoint; remains active | Confirmed profile/authoring and fake admin success defects fixed locally; remaining coverage explicit | 236 PostgreSQL tests; 109 frontend tests; 10 E01 browser cases; knowledge/VALIDATION_AND_RECOVERY.md | Finish mapped recovery gaps, validate final source, then E02 |
| 18 October 2026 | E01 | Paused at explicit user request | 245 PostgreSQL tests passed; focused browser recovery evidence captured. E01 stays unchecked; owned Vite and disposable PostgreSQL stopped. | e01-postgres-final.txt; e01-frontend-progress7.txt; e01 browser logs; paused-code-manifest-e01.json | User CONTINUE → latest saved E01 checkpoint, source/scope reconciliation and final UI checks |
| 18 October 2026 | E01 | Resumed | All 129 saved source hashes match; preserved user changes. Unsupported notification preference confirmed as documented shell. | paused-code-manifest-e01.json; refs/Security_Assessment_Report.md shell list | Truthful shell state, selected-unenrollment browser recovery and final frontend checks |
| 18 October 2026 | E01 | Done; E02 started | All E01 criteria reconciled; truthful unavailable result-email shell and selected-batch failure/retry verified. | 245 PostgreSQL;110 frontend;lint/build; resumed browser5; knowledge/VALIDATION_AND_RECOVERY.md | E02 provider failures with isolated mocks; P01/P02 still blocked on samples |
| 18 October 2026 | E02 | Done; V02 started | Bounded truthful provider recovery verified; V01 blocked by official samples, so independent report reconciliation starts. | 248 PostgreSQL;114frontend;lint/build;external+results+profile browser evidence | V02 multi-batch/status counts and downloaded PDF/XLSX/CSV reconciliation |
| 18 October 2026 | V02 | Done; V04 started | Confirmed report cross-batch leak fixed; date/metadata/capacity and downloaded exports reconcile. | 252PostgreSQL;114frontend;lint/build;10downloads;8PDFpages; saved-file reconciliation | V04 meaningful concurrency and independent committed-event observation |
| 18 October 2026 | V02 | Reopened during V04 | New approval uses newer enrollment instead of recommendation evidence batch; reproduced, no historical repair attempted. | v04-batch-snapshot-before.txt | Correct new decision snapshot batch, then rerun report/concurrency controls |
| 18 October 2026 | V02 | Restored after follow-up | Approval/new rejection preserve recommendation evidence batch; owning report remains correct despite newer foreign enrollment. | v04-postgres-final2.txt:60passed | V04 recorded complete; proceed V11 |
| 18 October 2026 | V04 | Done; V11 started | Observed actual row locks and independent committed recipient events; no duplicate evidence or over-capacity approvals. | 60PostgreSQL tests,no skips; POSTGRES_CONCURRENCY_VERIFICATION.md | V11 reproducible clean setup; V01/V07 still blocked |
| 18 October 2026 | V11 | Done; V03 started | Fresh source/dependency setup and actual model/bootstrap/maintenance checks passed; five baseline lint warnings resolved. | 259PostgreSQL;114frontend;lint/build0warnings;v11 evidence and LOCAL_SETUP_AND_OPERATIONS.md | V03 direct API and real-token security boundaries |
| 18 October 2026 | E02 | Reopened during V03 | Company overview/view/pin map copies still have unbounded provider loads; prior evidence covered five other map surfaces. | Current AdminCompanies/InstructorCompanies source; V03 audit | Replace legacy loaders with shared bounded recovery; verify staff maps and preserve draft/pin behavior |
| 18 October 2026 | E02 / V03 | Paused at explicit user request | 15/28 done; E02 reopened and V03 unfinished. Latest three API targets and instructor company zero-pin browser assertion fail. Verified owned Vite14368 and disposable PostgreSQL55438 stopped successfully. | v03-targets-before.txt; e02-company-browser-final.txt; paused-code-manifest-v03.json | User CONTINUE resumes latest V03 checkpoint; no background work |
| 18 October 2026 | E02 | Reverified Done; V03 resumed | Legacy company maps now bounded; valid zero pins preserved for both roles; city fallback and catalog markup safe. | e02-company-browser-resumed-final.txt;37PG/116frontend;lint/build;external browser regression | V03 three known placement permission/eligibility defects |
| 18 October 2026 | V03 | Done; remaining tasks dependency-blocked | 280 PostgreSQL/116 frontend passed; legacy placement boundaries, account revocation, safe logging/HTML and session/cache verified. V06 targets accepted; official LMS/IAMS inputs still missing. Owned Vite and disposable PostgreSQL stopped. | v03-postgres-final.txt; v03-session-browser.txt; v03-map-resumed.txt; LOCAL_SECURITY_REVIEW.md | Authoritative LMS/IAMS input → P01/P02 → V01/V07/V06 → S01; hosting afterward |
| 18 October 2026 | P01 | Provisional working format accepted; official acceptance pending | User agrees current Excel/text question format can be used now and adapted later. No claim that it matches the unavailable LMS export; no checkbox/count change. | User scope clarification18October; P01 completion record | Current-format development/testing; official sample → compare,adapt if needed,reverify |
| 18 October 2026 | P02 | Official format source confirmed; verification resumed | User confirms existing enrollment format is from official IAMS. Importer/parser/dialogs remain present; previous missing-source assumption corrected. No code deletion or format replacement. | User clarification18October; knowledge/IAMS_ENROLLMENT_IMPORT.md; existing source/tests | Verify current accepted schema using synthetic data and mocked notifications |
| 18 October 2026 | P02 | Done — provenance correction and existing behavior verified | User confirms current format came from official IAMS; importer/parser/dialogs intact and unchanged.31 API/12 parser/11 browser groups pass. Earlier missing-source blocker withdrawn. | p02-api-confirmed-format.txt; p02-parser-confirmed-format.txt; p02-browser-confirmed-format.txt | Preserve IAMS importer; official LMS question comparison remains separate |
| 18 October 2026 | V01 | Started; dependency order clarified by user | Existing question format accepted provisionally; proceed V01/V07/V06 while retaining P01 official acceptance at S01. Official IAMS unchanged/verified. V07 matrix accepted. | User18October decisions;18/28 checked | Three-role real API/browser lifecycle with synthetic fixtures |
| 18 October 2026 | V01 | In progress checkpoint | Real current-format authoring/setup/assessment/combined chain partially passed; final retake/placement/export steps pending. Harness fixes do not count as application fixes. | v01_workflow.py; v01-flow-progress*.txt; v01-artifacts/ | Finish full chain then V07/V06 without waiting for official LMS sample |
| 18 October 2026 | V01 | Done; V07 started | Real current-format three-role lifecycle and saved exports passed; exact scores/gates/retake/placement/history preserved. Desktop fullscreen kept explicit for matrix. | v01-flow-progress7.txt; export verification; recovery/auth/admin/timing final evidence | V07 accepted Chrome/Edge/tablet/phone matrix |
| 18 October 2026 | V07 | Done; V06 started | Accepted Chrome/Edge desktop and Chrome tablet/phone emulation all passed. Actual fullscreen exit flags one stop; mobile loaded results and session recovery verified. | v07 matrix16groups;mobile final;session6groups;viewed screenshots | V06 measured accepted workload and targets |
| 18 October 2026 | V06 | Measurement started | Exact accepted synthetic workload seeded; cold actual result/model14.685s. Remaining read/concurrency/rerank measurements running; no performance pass yet. | v06_benchmark.py;v06-benchmark-initial.txt;v06-results.json;v06-hardware.json | Inspect measured failures before focused optimization; preserve gates and no live actions |
| 18 October 2026 | V06 | Measured bottlenecks; optimization under verification | Baseline p95submit7.617/read+SSE2.041failed. Queue64 read-tail diagnostic1.637passed; grader batching197→19SQL,70PG regressions passed. Final full benchmark running. | v06 measured baseline/diagnostic/grader/regression logs | Check final targets honestly, then full current-source regression |
| 18 October 2026 | V06 | Further measured optimization under verification | Batching alone submitp95=5.55s still failed; repeatedNLPp95≈1.77s. Bounded exact document/model cache added;37 focused fallback/ranking tests passed. No score/TF-IDF policy change. | v06 after-batching JSON;preprocessing-regression.txt;after-cache benchmark | Final accepted workload + exact component comparison, then full current-source regression |
| 18 October 2026 | V06 | HTTP targets pass; visible wait correction under verification | HTTP p95submit4.183/read+streams1.585 passed with exact ranking components. Browser-visible5.591failed; fixed800ms navigation pause removed. | v06-results-final-http.json;v06-ui-before-navigation-fix.json;v06-ui-after-navigation-fix.txt | Remeasure visible wait, then final current-source regressions |
| 18 October 2026 | V06 | Visible target remains unmet | Removing forced800ms delay alone did not meet visible5s target; latest20-user visible submit5.863s. Instrumented rerun measures response and rendering separately. | v06-ui-after-navigation-fix.txt;v06-ui-response-breakdown.txt | Inspect actual response/render split; preserve failing evidence and current scope |
| 18 October 2026 | V06 | Paused by user; exact checkpoint saved | Latest instrumented visible20-user submit6.574s fails5s (response5.003s/render1.571s); all9measurements saved with0pageerrors. Owned benchmark/API/browser/Vite ended; disposablePG stopped; no listeners5178/8018/55438. | v06-ui-response-breakdown.txt;v06-ui-artifacts/results.json;paused-code-manifest-v06.json | User CONTINUE resumes V06 diagnosis then required regressions;20/28 remain complete |
| 18 October 2026 | V06 | Measured database overhead | Real warm submit profile111SQL; concurrent4.0-4.5s requests spend2.7-3.5s in SQL. Eight recommendation upserts use17SQL plus16savepoint/release statements. | v06-submit-profile-before-upsert.json | Batch batch-scoped recommendation persistence; retain IDs/nullable legacy behavior and ranking semantics |
| 18 October 2026 | V06 | Done | Accepted workload and visible targets passed after measured fixes;287PG/116frontend(no skips),lint/build/check/drift and25browser groups passed.324measured requests0errors;exact ranking unchanged. | PERFORMANCE_VERIFICATION.md;v06 current logs/results;V06-complete manifest | P01 official sample pending;S01 retained;await explicit hosting-preparation sequencing answer |
| 18 October 2026 | S01 | Local evidence reconciled; final gate remains open | V06 completed and feature matrix updated with actual evidence. Official LMS comparison alone remains before formal local sign-off. User clarified they own existing Vercel/Railway hosting and paused subscription. | 21/28;feature matrix;V06-complete manifest;current passing logs | Save exact checkpoint;wait for official LMS input before P01/S01;no live hosting action |
| 18 October 2026 | P01 | User scope decision; resumed | User explicitly says assume current LMS questionnaire format final for28tasks and update later this week. Acceptance amended transparently; no unseen official compatibility claimed. | User18October instruction;P01 amended prompt/criterion | Verify current XLSX mixed types/invalid inputs;then S01 and A04 local prep;live hosting remains user-owned |
| 18 October 2026 | P01 | Done;accepted format verified | User-designated final format verified via real mixed XLSX/CSV/text;confirmed blank keyed choice defect fixed;creator/append validation and retry pass.10browser groups0pageerrors;116frontend/lint/build pass. | p01-import-final2.txt;p01-artifacts;QUESTION_IMPORT_FORMAT.md | S01 current local acceptance,then A04 local production-policy correction |
| 18 October 2026 | S01 | Done;local acceptance | Alllocal gates passed after explicit final-format decision and P01 delta checks. No known critical/high local defect;hosted CSP/provider/restore/health remains separate. | Feature matrix;current287PG/116frontend and browser/performance evidence | A04 local policy fix only;user owns live Vercel/Railway release |
| 18 October 2026 | A04 | Done | Exact headers on local production build:11required resources+Google adapter/real API sign-in pass;3unrelated originsblocked;0pageerrors. No publishing. | PRODUCTION_BROWSER_POLICY.md;a04 before/after logs/JSON/build | V05 operator handoff;independent V09restore/V10health preparation;24/28 complete |
| 18 October 2026 | V09 | Partial verified;host coverage remains open | Real custom SQL restore matches all application table hashes and preserved snapshot;separate WebP bytes restored;source unchanged. Providerretention/hostrollbacknotverified. | v09-local-restore.txt;v09-artifacts/results.json;release handoff | Owner records actual backup/branding coverage andhostrelease IDs;verify isolated providerrestore/rollbackwhenauthorized |
| 18 October 2026 | V10 | Local preparation complete;host tests pending | Public coarse readiness safe status/log/HEAD tests and real200→503→200 pass;final291PG/no skips. Manual recovery recommended;actualRailway restart/failovernotverified. | hosting-prep-postgres-after.txt;v10-probe-recovery.*;release handoff | User-operated hostactivation andexactliveconfiguration verification;keep V10unchecked |
| 18 October 2026 | V05 | Release handoff ready;24/28 | All local acceptance andA04passed. Current final291PG/116frontend andrequiredlocalchecks pass. User ownsVercel/Railway;no subscription/deploy/production migration/externalwrites done. | RELEASE_AND_RECOVERY_HANDOFF.md;latest source manifest/checkpoint | No further independent local task remains;awaituser-operatedrelease andauthorizedsyntheticliveboundary before closingremainingfour |
| 18 October 2026 | Manual testing | Read-only Supabase preflight | User asks to manually migrate/login locally. Normal configured Supabase reachable;only0015_user_department pending. No schema/data modification or login performed byagent. | work/defense_audit/manual-migration-preflight.json;0015_user_department.py | User runs reviewedmigration andlocalservers;then verifies sign-in andmanualflow. Retain24/28/fourhostgates. |
| 18 October 2026 | Git preflight | Ready for user-reviewed source commit | User asks whether safe to push. Foundwork/tmp unignored;appended rootignore rules for scratch folders,caches andprivate.env variants while retaining.env.example.634candidatefiles checked forconfiguredsecret literals/common private-key/token patterns;no hits;no privateenv/databasearchive entries orfiles>50MiB. Application source matches tested174-file manifest. No staging/commit/push. | work/defense_audit/github-push-preflight.json;.gitignore;finalsource manifest | User reviews/stages intendedsource anddocs. Currentbranchmain;checkconnectedautodeploy beforepushingdeploymentbranch. Fourhosttasksremainunchecked. |


## Saved resume checkpoint — explicit pause, 18 October 2026

- **Resume trigger:** user will say `CONTINUE`. Work is paused; no background execution or automation was created.
- **Current phase/task:** Local system development, N02. Last completed step was read-only source inspection. N02 is unchecked and has no implementation/test changes yet.
- **Completed:** S00, A01, A02, A03, A07, A05, A06, N01 — **8 / 28**. S01 local acceptance and every hosted task remain unchecked.
- **Snapshot:** base commit `227f794` plus uncommitted work. `work/defense_audit/paused-code-manifest.json` hashes changed tracked source and new application/test/knowledge files; manifest SHA256 `08a980580a09075a9186ed73fb73eea9e34c02412ecc9758effe7f8bf0cb3511`. No commit was invented or created.
- **Changes:** authoritative/atomic scoring; 30-second grace and review evidence with stale-retake identity protection; atomic catalog validation and truthful save/delete recovery; agreed role auth, verified/active identity gates and queued-mail truthfulness; assisted admin recovery; coordinated seven-day JWT renewal, password revocation, SSE recovery and student-scoped drafts; truthful no-result NLP model metadata. Details/evidence remain in the completed task records and work log.
- **Latest verification:** N01 70/70 focused backend tests, real default spaCy Medium load (requested=actual), two browser reporting cases, focused lint/build passed. Before N01's small metadata change, full PostgreSQL API was 196/196 with no skips and frontend 100/100; full lint had 0 errors/5 existing warnings. A06 six real-token browser cases and A02 four grouped timing/recovery regressions passed. These exact snapshot limits are preserved; the entire suite has not been rerun after N01.
- **Services stopped:** local Vite port 5178 stopped with Ctrl-C; workspace PostgreSQL port 55438 stopped successfully with `pg_ctl -m fast -w stop`. Browser fixture servers were per-test processes and ended. No production/Supabase connection, migration, deployment, live email or real credential change occurred.
- **Portable test runtime:** official EDB PostgreSQL 17.11 archive in ignored `work/defense_audit/postgres-runtime/`; archive SHA256 `4B8DB0930C38F6EF845DB919551DEDDA3B6B845AEB0927B3D79A6E8E9E4537CF`. Cluster `data/`, user `sb_test`, localhost-only port 55438; only synthetic test data. This is not a system service. Preserve it for verification.
- **Restart PostgreSQL if needed:** from repo root, run `work/defense_audit/postgres-runtime/pgsql/bin/pg_ctl.exe -D work/defense_audit/postgres-runtime/data -l work/defense_audit/postgres-runtime/server.log -o "-h 127.0.0.1 -p 55438" -w start`. Use the existing dedicated `core.sse_postgres_test_settings` with `PYTHON_DOTENV_DISABLED=1`, synthetic SECRET_KEY, `DEBUG=True`, `SB_TEST_DB_NAME=test_skillbridge_continuous`, `SB_TEST_DB_USER=sb_test`, `SB_TEST_DB_HOST=127.0.0.1`, `SB_TEST_DB_PORT=55438`. Never use normal DB credentials for tests.
- **Frontend/browser runtime:** ordinary npm launcher was broken at baseline. Commands used system `node` with installed `node_modules/eslint/bin/eslint.js`, `node_modules/vite/bin/vite.js build`, and `node --test src/**/*.test.mjs`. Python is `skillbridge-backend/venv/Scripts/python.exe`, which has Playwright and installed Chrome. Browser driver needed approved unsandboxed execution; start Vite with `VITE_API_URL=http://127.0.0.1:8018` on 127.0.0.1:5178. Fixture scripts use isolated SQLite and block nonlocal browser requests. The supplied with_server helper failed to start its child server; the tested in-process API pattern is in `attempt_timing_playwright.py --api-thread` and `session_renewal_playwright.py`. Restart Vite before tests that dynamically import Axios after HMR edits, to avoid duplicate old/new module instances.
- **N02 next exact work:** read the full N02 prompt, recommendation-audit skill and current diff. Trace `_rank_recommendations`, `extract_coordinates`, `location_similarity`, `serialize_recommendation`, shared result query ordering and `useStudentResults`. Reproduce suspected nonfinite/out-of-range/boolean coordinates, legacy string company address `.get` failures and absent explicit tie ordering. These are source observations, **not yet confirmed runtime defects**. Then fix only confirmed cases; verify the full N02 evidence/gates/history/empty/capacity separation contract. Do not change weights or infer success probability from similarity.
- **Remaining inputs:** official LMS export expected from adviser this week; keep current Excel/text importer (P01 remains pending). Official anonymized IAMS sample/schema still required for P02. P03 clarified by user: capacity minus assigned seats, and assignments summed across companies per area (3+3 in Davao City=6). V06 user wants fewer than 10 positions; use 8. The proposed 200 students/20 concurrent users/p95 reads <2s/warm submit-results <5s/cold model <15s remain assumptions needing final alignment, not approved/measured performance.
- **Other recorded decisions:** instructors use DNSC Google, admins individual passwords and administrator-assisted recovery; students retain DNSC Google/enrollment gates. Late submissions allow 30 seconds then save flagged review evidence requiring instructor review/retake. No self-service reset-email module selected. Hosting requires S01 and consequential authorization.
- **User changes to preserve:** initial `outputs/` and `work/` already existed. During execution, user-owned `knowledge/NLP_COLAB_EVALUATION.md`, `knowledge/NLP_IMPROVEMENT_PLAN.md`, `knowledge/SHARED_CHAT_NLP_EVALUATION_CONTEXT.md` and `tmp/` appeared. They were not edited by this development run. NLP plans are research/planning context, not new system task prompts. Do not delete/reset them or their artifacts.
| 18 October 2026 | N02 | Paused at explicit user request | Exact source snapshot/resume instructions saved; no N02 edits/tests claimed. Owned Vite and disposable PostgreSQL stopped; all user changes preserved. | paused-code-manifest.json; 8/28 master tasks checked; full prior evidence retained | User CONTINUE → reread current state/diff → N02 reproduction and acceptance |



## Saved resume checkpoint — latest E01 pause, 18 October 2026

This checkpoint supersedes the earlier N02 pause above. Resume only when the user says `CONTINUE`; no background work or automation is running.

- Current phase/task: local system development, **E01 in progress and unchecked**. Completed **11/28**: S00, A01, A02, A03, A07, A05, A06, N01, N02, N04, P03. Next task after verified E01 closure: E02.
- Source: base `227f794` plus preserved uncommitted changes. Manifest `work/defense_audit/paused-code-manifest-e01.json` covers 129 changed/new source, test and knowledge files; SHA256 `4850f3272eb83733dbad2bb46d2b5bc898b4edef27d05421fc9ff1efc6e39af9`. Historical manifest retained. Never reset user changes or rerun stale checkpoint updater scripts.
- Latest backend: full isolated PostgreSQL **245/245 OK**, `e01-postgres-final.txt`; includes selected-batch unenrollment validation/history preservation. Expected injected-failure diagnostics in the log are test fixtures; final result is OK. Migration **0015_user_department.py** was applied only during disposable test setup; do not migrate the configured database.
- Frontend: progress7 **110/110**, lint zero errors/five baseline warnings, build passed. Later placement/selected-unenrollment UI edits have focused placement browser evidence but still require final lint/build and relevant regression. No unrun check is counted as passed.
- Browser evidence: `e01-profile-cache-browser.txt` 3; `e01-malformed-results-browser.txt` 5; `e01-admin-browser.txt` 2; `e01-batch-browser.txt` 2; `e01-composite-browser-final.txt` 2; `e01-taxonomy-reports-browser.txt` 2; `e01-placement-browser.txt` 2; `e01-session-browser.txt` 6; `e01-enrollment-browser-local-http.txt` 11. Synthetic APIs/data, emails mocked, external browser requests blocked. Intermediate failed/stale-selector/harness logs retained; only named final runs pass. Official IAMS compatibility and broad role/device acceptance remain unverified.
- Changes since previous N02 pause: deterministic exact-score ranking and safe coordinates/legacy addresses (N02); advisory category suggestions and truthful neutral narrative (N04); panel-defined capacity/company-area analytics (P03). E01 adds atomic profile and assessment saves, strict payload/envelope validation, scoped drafts/pins, safe cache/transport errors, persistent admin management, batch/taxonomy protection, selected-batch unenrollment and recovery UI. Details are in task records, tests and `knowledge/VALIDATION_AND_RECOVERY.md`.
- Exact next work: read instructions/overview/current E01 full prompt, compare source hashes and current diff. Trace profile `emailNotifications` checkbox persistence and results-email promise against agreed scope; currently a source-review concern, not a confirmed new requirement or accepted missing feature. Verify selected-unenrollment UI failure retention; run final frontend lint/build and relevant regression; reconcile mapped E01 criteria before checking it off. Dedicated authoring/start race verification remains V04. Do not jump to hosting or claim local signoff.
- Services: verified owned Vite process on port 5178 stopped; workspace PostgreSQL stopped successfully via `pg_ctl -m fast -w stop`. Enrollment fixture API thread ended with its test process. No live Supabase/provider action, production migration, email, placement or deployment occurred.
- Restart/runtime: reuse portable PostgreSQL 17.11 cluster and exact start command/env from the earlier checkpoint. Use `core.sse_postgres_test_settings`, `PYTHON_DOTENV_DISABLED=1`, synthetic secret, localhost55438 and sb_test only. Frontend uses system node with installed ESLint/Vite CLIs; browser fixtures use Vite5178 and API8018. Restart Vite after source/HMR changes for dynamic Axios fixtures. `e01_enrollment_browser.py` uses test-only `SECURE_SSL_REDIRECT=False` for isolated HTTP; never infer production settings should change.
- Inputs/decisions: official LMS and IAMS samples still unavailable until later this week; keep existing Excel/text importer. P03 panel confirmation complete. V06 uses 8 positions; proposed 200 students/20 concurrent/p95 reads2s/warm5s/cold15s still need alignment and measurement. Existing 30-second grace and agreed role authentication/recovery decisions stand. Hosting/external writes require authorization at the consequential action.
- Preserve all existing source, outputs/work artifacts and user research files named in the earlier checkpoint. No commit created. Continue from this E01 checkpoint rather than restarting the checklist.



## Saved resume checkpoint — latest V03 pause, 18 October 2026

This checkpoint supersedes both earlier pause checkpoints. Resume only on user `CONTINUE`; no background work or automation is running.

- State: local development, **15/28 complete**: S00, A01, A02, A03, A07, A05, A06, N01, N02, N04, P03, E01, V02, V04, V11. **E02 reopened and unchecked; V03 in progress and unchecked.** Never infer completion from earlier E02 passes.
- Source: base `227f794` plus all preserved uncommitted changes. `work/defense_audit/paused-code-manifest-v03.json` covers 161 changed/new source/test/knowledge/setup files; SHA256 `487cfcae330c367db4c180b4845157b3ebc6137557ad2653f28951885afa09a8`. Tracker and ignored runtime/evidence files are excluded. Preserve historical manifests, user research files, outputs and work artifacts. Do not run stale updater/builder scripts or reset changes.
- Exact next work: Resume E02: reproduce/fix instructor company EditModal losing a saved zero-coordinate pin; complete company recovery browser tests and regressions. Then V03: deny legacy foreign-batch placement mutation via owned recommendation; deny new manual/recommendation approval for archived students while preserving removal/history; rerun focused and full security/regression checks.
- E02 failure: `e02-company-browser-final.txt` passed admin company outage/retry/draft/confirmed save with lat/lng zero and instructor ViewMap zero coordinates; instructor EditModal then lost the zero pin (`[0,0]` absent from `window.__companyPins`). Inspect its pinned/mapCenter initialization. Company maps now use shared bounded loader/retry and escaped markup; new shared geocoder city/default-view options still need final focused coverage. Latest company-map lint passed, but complete browser/unit/lint/build acceptance is pending.
- V03 unresolved API findings: `AccessSecurityTests.test_legacy_foreign_snapshot_cannot_be_mutated_via_owned_recommendation` fails because the recommendation path can mutate an existing foreign-batch placement. Recheck the fetched placement batch before transitions/idempotence and preserve history. `AccessSecurityTests.test_archived_student_requires_restore_before_new_manual_assignment` and `ConcurrentWorkflowTests.test_archived_student_cannot_receive_a_new_recommendation_approval` fail because inactive targets still receive new assignments (201 instead of409). Require restoration for new assignment/approval while retaining removal/rejection/history and existing agreed manual-placement behavior. Do not silently add a new target approval policy.
- Partial security changes: AccountJWTAuthentication validates current role/approval/student membership; refresh and login validation, IP throttle ignoring untrusted forwarded headers, case-insensitive email and dummy hashing; foreign placement/manual scope guards; Django credential-log filter; escaped notification HTML and Leaflet text. `v03-after.txt`23 focused tests passed **before** later logging/HTML/map edits. `v03-map-after.txt` one browser group passed with no executed markup. Logging and notification HTML fixes have reproduction logs but no final rerun. Latest `v03-targets-before.txt` ran3 tests and **all3 failed**; database was destroyed normally. No failures are counted as passed.
- Last broad verified snapshot: clean setup259/259 PostgreSQL tests with no skips, frontend114/114, lint0errors/0warnings and build passed (`v11-clean-*final*`). Actual spaCy Medium loaded without fallback; isolated admin bootstrap/login and event pruning passed. These precede latest E02/V03 changes and do not certify them. The ignored clean backend/frontend copies are stale; refresh selected source/fixtures before using them for regression, without copying real environment files. V04's earlier60/60 concurrency/report tests passed; its newly added archived-target test currently fails as above.
- Services stopped successfully: verified Vite PID14368 on127.0.0.1:5178 stopped; portable PostgreSQL17.11 at127.0.0.1:55438 stopped via `pg_ctl -m fast -w stop`. No pending Python test process was present. Preserve cluster/runtime, no cleanup required. No live Supabase/provider action, real email, placement, deployment or configured-database migration occurred; migration0015 was test-only.
- Restart PostgreSQL from workspace: `& ./work/defense_audit/postgres-runtime/pgsql/bin/pg_ctl.exe -D ./work/defense_audit/postgres-runtime/data -l ./work/defense_audit/postgres-runtime/server.log -o '-h 127.0.0.1 -p 55438' -w start`. Use project `skillbridge-backend/venv/Scripts/python.exe`, `PYTHON_DOTENV_DISABLED=1`, synthetic SECRET_KEY, DEBUG=True, `SB_TEST_DB_NAME=test_skillbridge_continuous`, `SB_TEST_DB_USER=sb_test`, `SB_TEST_DB_HOST=127.0.0.1`, `SB_TEST_DB_PORT=55438`, settings `core.sse_postgres_test_settings`. Never use production credentials. Inspect current test settings before running. Vite uses installed system Node and Vite CLI at port5178; explicit npm CLI is `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js` because user npm shim is broken. Browser checks may require approved local process/network access.
- Remaining inputs: official LMS/IAMS samples expected later this week (P01/P02 blocked; retain Excel/text importer). P03 definition confirmed from panel. V06 uses8 positions; remaining proposed baseline200students/20concurrent/p95 reads2s/warm5s/cold15s is not accepted or measured. V01/V07 depend on samples, S01 on all local gates. Hosting follows local completion and requires consequential authorization. Agreed30-second grace and Google instructor/admin-password assisted recovery policies persist.
- Resume instructions: read AGENTS, overview, this checklist protocol and complete E02/V03 prompts; inspect current diff and compare manifest before editing. Use applicable project skills. Fix/reverify the confirmed findings, reconcile task criteria honestly, update this single tracker, and continue first actionable dependent task. Do not start hosting or claim local completion.



## Saved resume checkpoint — V03 complete, awaiting official inputs, 18 October 2026

This is the latest checkpoint and supersedes earlier pause checkpoints. The user
resumed work and accepted the V06 baseline. No background work is running.

- **17/28 Done:** S00,A01,A02,A03,A07,A05,A06,N01,N02,N04,P03,E01,E02,V02,V04,V11,V03. E02 was explicitly reopened, fixed and reverified; V03 is now complete. All11 remaining tasks stay unchecked.
- **Next actionable input:** official LMS export/sample or authoritative format (P01), and official IAMS export/sample or authoritative column schema (P02). User said these would arrive later this week; do not repeat the same missing-sample question or substitute synthetic formats for official acceptance. Keep current Excel/text importer. Read whichever input's complete task prompt becomes actionable first, respecting dependencies.
- **Remaining dependencies:** P01/P02 → V01; V01 → V07 and V06 (V02 already passed); all remaining local criteria → S01; then A04/V05/V09/V10/S02 hosting acceptance. Do not bypass these gates or treat local17/28 as system completion. Actual deployment/production/external writes need consequential authorization.
- **V06 accepted baseline:**200 synthetic students,8positions,2assessments×30questions,20simultaneous users;95% reads <2s,warm submit/results <5s,first model load <15s. User explicitly answered “Use this baseline” during this continuation. Targets are no longer pending a decision; no measurements or performance pass claimed. Measure after V01 passes.
- **Final code/evidence:** base `227f794` plus preserved uncommitted work. Source manifest `work/defense_audit/checkpoint-code-manifest-v03-complete.json` covers 162 changed/new source/test/knowledge/setup files, SHA256 `573fa0f83f51628a098dd9293057b4788535d1df208520bf956c0320117bf8a4`. Excludes tracker, real .env and ignored runtime/evidence. Preserve all prior user/research changes and artifacts; do not rerun stale updater/build scripts or reset files. No commit created.
- **Changes in this continuation:** instructor company edit now preserves valid zero coordinates; all ten Leaflet surfaces share bounded failure/retry, retained drafts and truthful fallback; company city fallback unit verified. V03 adds current-account JWT checks, IP guessing limits, email dummy hashing, strict placement/batch privacy including legacy recommendation-linked records, active-target assignment guards, log credential redaction and escaped notification/map HTML. Archived-target removal/history and normal concurrent approval remain supported. No live historical data repair or ranking-policy change.
- **Final backend:** `v03-postgres-final.txt`280/280 tests passed in57.696s, zero skips; includes20 direct security tests, route matrix, approval/enrollment/password revocation, provider/identity/input/privacy checks, legacy snapshot denial, inactive-target restoration, score/history/report/concurrency/event tests. Django check passed. Final model drift under isolated in-memory settings: no changes. The initial PostgreSQL drift check warned its disposable normal-name database did not exist; final PostgreSQL tests applied migrations successfully.
- **Final frontend/browser:**116/116 unit tests passed; final resumed lint0errors/0warnings and build passed on unchanged frontend source. `v03-session-browser.txt`6 real-token renewal/logout groups passed; `v03-map-resumed.txt`markup group passed with zero executed markup. `e02-company-browser-resumed-final.txt`both staff recovery/save scenarios plus instructor view passed; `e02-browser-resumed-regression.txt`3 general provider recovery groups passed. No page errors. Actual provider calls/emails were blocked or mocked.
- **Retained nonpassing evidence:** previous three placement targets and adjacent suggestion reproduction failed before fixes. First resumed company fixture clicked overview behind still-open detail modal; corrected by closing via accessible button. A command named nonexistent api.test_account_recovery; the final full discovery run succeeded. Sandbox denied localhostDB access; approved test execution succeeded. A hypothetical case-collision fixture failed at the existing normalized-email unique index; it was not a confirmed login defect, no backend change made for it, test removed. Do not claim these intermediate runs passed.
- **Services:** owned Vite port5178 stopped successfully (verified command before stopping); disposable PostgreSQL55438 stopped successfully with pg_ctl fast/wait. No pending test process or automation. Preserve portable runtime/cluster. No configured Supabase connection, production migration/deployment, real email or placement occurred; migration0015 remained test-only.
- **Restart if needed:** workspace `work/defense_audit/postgres-runtime/pgsql/bin/pg_ctl.exe -D work/defense_audit/postgres-runtime/data -l work/defense_audit/postgres-runtime/server.log -o "-h 127.0.0.1 -p 55438" -w start`. Project venv Python; `PYTHON_DOTENV_DISABLED=1`, DEBUG=True, synthetic SECRET_KEY, SB_TEST_DB_NAME=test_skillbridge_continuous, SB_TEST_DB_USER=sb_test, SB_TEST_DB_HOST=127.0.0.1, SB_TEST_DB_PORT=55438, settings core.sse_postgres_test_settings. Never normal DB credentials. Vite uses system Node on5178 with VITE_API_URL=http://127.0.0.1:8018. Clean-setup copies are stale relative to latest security/map source; refresh source safely before using them, no real environment files. Explicit npm CLI workaround and prior portable archive hashes remain in earlier checkpoint.
- **Instructions on resume:** AGENTS, overview, protocol, current diff/manifest, applicable skills and the full selected task prompt first. Available Supabase skill was read; only public docs/source/mocked storage tests were used, no live project access. Hosted logs/proxies/rate stores/TLS/CORS/CSP/provider/RLS exposure checks remain future hosted acceptance. See knowledge/LOCAL_SECURITY_REVIEW.md for exact local scope and limitations.



## Latest scope clarification — provisional question format, 18 October 2026

The user accepts using the existing Excel/text question-import format provisionally
and updating it when the official LMS questionnaire/export is supplied. Develop and
test against the current contract without describing it as verified official LMS
compatibility. Preserve P01's unchecked official acceptance and compare/adapt only
when authoritative input arrives. No application changes or new test results are
claimed by this documentation update; completion stays17/28. The earlier final
V03 checkpoint still provides the tested source/runtime state. IAMS compatibility
is a separate missing input and was not changed by this question-format decision.
Existing final acceptance dependencies remain; current-format partial checks can
be prepared without marking official compatibility or dependent tasks passed.



## Latest checkpoint — official IAMS format confirmed, 18 October 2026

This correction supersedes all earlier statements that the IAMS format/source is
missing. The user confirms that the existing enrollment format is correct and
came from official IAMS. Do not ask for a replacement format or treat its source
as unknown. The backend importer, frontend parser and enrollment dialogs are
present, unchanged in git, and were not deleted or replaced.

P02 is Done:31 isolated API tests,12 parser tests and11 real frontend/API browser
groups passed with0page errors, using synthetic records in the confirmed official
layout and mocked notifications. Exact headers, row8 preamble, real XLSX/XLS/CSV
round trips, multi-sheet behavior, leading-zero IDs, programs/names, email review,
duplicates/conflicts, role scope, confirmation/retry/no duplicate notification,
keyboard and narrow-layout behavior were checked. No new raw institutional file
or real student record was read; authority for the existing format is the user's
explicit correction plus the documented implemented schema. No new application
changes or full regression run claimed this turn. Prior V03 source/runtime and
280PG/116frontend/lint/build evidence remain applicable; only documentation changed.

Completed18/28: previous17 plus P02. Official LMS question-file comparison (P01)
is separate and still pending; the existing Excel/text question format is accepted
provisionally. Preserve its current importer too. V06 targets remain accepted.
Keep remaining acceptance gates honest; no deployment or live external action.
The latest V03 source manifest excludes this newly edited IAMS knowledge document;
that documentation-only difference is intentional. Local Vite used for this
verification is stopped at checkpoint cleanup; browser/API fixture ended normally.
No background execution or automation is running. Preserve all user changes.



## Current continuation checkpoint — V06 measurement running, 18 October 2026

Latest user instruction: continue the28tasks; do not stop independent local work
for the missing official LMS questionnaire. Existing question format is accepted
provisionally. V01 now excludes P01 from its own hard dependencies by user scope
clarification; S01 still retains official P01 acceptance. Existing enrollment
format is confirmed official IAMS and verified under P02, never deleted/replaced.

Completed20/28: S00,A01,A02,A03,A07,A05,A06,N01,N02,N04,P02,P03,E01,E02,V01,V02,V04,V07,V11,V03.
P01 remains unchecked for actual official LMS comparison. V06 is active; do not
mark it complete based on accepted targets or partial readings. V07 accepted
Chrome/Edge1280x900 plus Chrome tablet768x1024/phone390x844 emulation all passed.
Physical devices/Safari/Firefox remain outside the accepted local matrix.

V01 real dedicated PostgreSQL three-role lifecycle passed15groups in
v01-flow-progress7.txt, including exact Programming3/3/Networking0/1, real UI
text/CSV authoring, setup, retake/history, approval/removal/manual reassignment and
actual savedPDF/XLSX independently reconciled in v01-export-verification.txt.
Seven recovery fixtures passed; admin oversight7/auth12/timing4groups final
passed. Only test expectations/docs/ignored test harnesses changed since V03;
no new application behavior change yet. Prior280PG/116frontend/lint/build evidence
covers that unchanged app source. Current lint rerun is clean.

V07: v07-matrix-progress2.txt plus v07-artifacts/results.json contain all4x4groups
passed,0page errors. v07-mobile-loaded-final.txt/mobile-results.json recheck actual
loaded result titles/category scores before screenshot; bothpassed. Desktop actual
fullscreen enter/exit records flagged stop. v07-session-regression.txt six real
session/expiry/logout/draft groups passed. Desktop and loadedphone screenshots
were viewed. Original bad saved-address fixture/early screenshot corrected as
harness issues; no relaxed app validation. See corresponding knowledge docs.

V06: work/defense_audit/v06_benchmark.py builds exact200students,8positions,
2assessments x30questions (mixed MCQ/truefalse/identification),20simultaneous users.
Initial20 complete,60first-exam-only,120pending; first20 have consistent20approved
placements across8positions after warmup. Actual HTTP/Django and selected spacy_md,
no NLP mocking.20observations per normal-read flow; three20-user submission rounds,
60post-submit reads;20openSSEstreams with60concurrent reads;3whole-cohort reranks.
Accepted targets:95% reads<2s,warm submit/results<5s,firstmodel<15s. Rerank30s is
only the existing frontend HTTP deadline used for diagnostic usability, not a new
user-accepted universal target. Record actual results and limitations honestly.

Active measurement command uses projectvenv and writes v06-benchmark-initial.txt;
JSON checkpoints in v06-results.json. First actual cold results including model
load was14.685s, requested=actualspacy_md; no overall performance pass yet. Latest
warm/read/concurrent evidence must be inspected before editing. Hardware recorded
in v06-hardware.json: i5-1235U,10cores/12logical,7.71GiB RAM,Windows/Python3.13.
Do not run unrelated browser/test/model processes during measured runs. Vite idle
on5178 is the owned local server; execsession3539. PortablePG17.11 runs55438,
workspacecluster/runtime preserved. Active benchmark execsession20257 currently
runs dedicated test_skillbridge_v01_<pid> DB using v01_fixture.py lifecycle; it
will drop only its own database on exit. Fixture/API8018 closes on exit. No normal
DB/.env/provider/production access. Finalized results JSON must retain acceptance
failures; do not replace with partial output or count skipped/errors as passes.

If a target fails, keep V06 unchecked, reproduce/measure the bottleneck and apply
only focused semantics-preserving optimization. Applicable assessment/recommendation,
React/browser and PostgreSQL performance skills read; no subagents authorized.
Use actual source/tests, including bulk_management_states (reports already batch
load), ensure_combined (stable reads avoid recalculation), and _load_model
(lru_cache of model instances; text preprocessing not cached). Do not assume a
bottleneck before results. Read skill references needed for a proven issue.
After V06, reconcile S01 and preserve pending P01 explicitly; prepare hosting only
after required local gate and obtain consequential authorization. No automatic
background continuation or deployment authorization has been granted.




## Latest resume checkpoint — explicit V06 pause, 18 October 2026

This supersedes prior continuation checkpoints. The user explicitly requested a safe pause; resume only on `CONTINUE`. No background implementation or automation is running.

- **Progress:**20/28 complete. V06 remains unchecked. Completed: S00,A01,A02,A03,A07,A05,A06,N01,N02,N04,P02,P03,E01,E02,V01,V02,V04,V07,V11,V03.
- **Latest measurements:** accepted200synthetic students/8positions/2assessments x30questions/20users. Final HTTP benchmark passed: cold actualspaCyMedium10.952s,60submitp95=4.183s,60postresultp95=.281s,20SSEstreams+60readsp95=1.585s;0HTTPerrors;all8ranking IDs/components exactly equal pre-cache reference. Fixture listener backlog64, not stockDjango10; no hosted-performance claim. Latest instrumented browser run FAILED visible5s:6.573698s total=5.002568s response+1.571130s rendering. Two standalone submits1.786/1.903s;6warm finalresult views1.124-2.302s;0pageerrors. Cold in this run13.029s. Keep failed evidence.
- **Source changes saved, not fully release-verified:**api/scoring.py batches answer persistence preservingexistingIDs/duplicates/validation/atomicity;api/recommendation_nlp.py bounds successful exacttext/model-instance lemma cache512entries/16384chars, preserving fresh TF-IDF, fallback and model changes;StudentAssessment.jsx removes artificial800ms navigation timeout after confirmedsubmit. Added2submission-integrity and3NLP-runtime tests.70focusedPG tests and37NLP/fallback/ranking passed. Full expected285PG API tests plus current frontend116/lint/build and affected real browser workflows still pending; no claim those prior passes cover new source.
- **Working-tree preservation:**base227f794 plus all existing user changes. Manifest`work/defense_audit/paused-code-manifest-v06.json` covers166changed/new source/test/knowledge/setup files, SHA256`6d3ddf9e18a6c5913eeabd9fb1fd74c0087b1122c361069d85a544cfa1e4b6eb`. No commit/reset/stash. Manifest excludes outputs/work/runtime and real environment files. Preserve all prior research, artifacts, importers and uncommitted changes; never rerun stale checkpoint updater scripts.
- **Exact next action:**read AGENTS,overview,tracker protocol and fullV06 prompt plus applicable assessment/recommendation/React/browser skills; compare manifest/currentdiff. Restart owned local runtime below. Profile remaining submit path and result-render delay with instrumentation from`work/defense_audit/v06_ui_measure.py`;response still~5s under20users so removal of800ms alone insufficient. Keep workload/targets unchanged; optimize only measured bottlenecks and preserve score/ranking/permission/history contracts. Consider varied-answer profiles before final performance claims (current homogeneous all-correct workload; diversity not yet tested). After targets pass run required regressions, write performance evidence docs, then closeV06 and continue next actionable task respectingdependencies.
- **Evidence/harnesses:**`work/defense_audit/v06_benchmark.py` supports`--backlog-64 --ui-only`;UI measurements now include response/render split, final`v06-ui-artifacts/results.json`. FinalHTTP preserved separately`v06-results-final-http.json`;UIsetup uses`v06-ui-setup.json`. Prior failing HTTP/batching/listener/cache/UI logs retained. `v01_fixture.py` creates/drops exact syntheticPG testDB and mocksGoogle/email;never normalSupabase credentials. V01 real15groups passed;V07 all4accepted configurationsx4groups plus loadedmobile rerun/session6groups passed. DocsLOCAL_WORKFLOW_ACCEPTANCE/BROWSER_MATRIX_VERIFICATION.
- **Safe pause cleanup verified:**benchmarksession23627 ended with visible-targetAssertionError;fixture/API/browser ended. Vitesession3539 stopped. DisposablePG55438 stopped via ownedpg_ctl. Processcheck found none of recordedownedPIDs15136/22400/17708/21340/23012;listenercheck returnednone on5178/8018/55438. Keep portablePG files/data. No liveSupabase migration/deployment/provider/email action performed.
- **Restart:**`work/defense_audit/postgres-runtime/pgsql/bin/pg_ctl.exe -D work/defense_audit/postgres-runtime/data -l work/defense_audit/postgres-runtime/server.log -o "-h 127.0.0.1 -p 55438" -w start`. UseprojectvenvPython,`PYTHON_DOTENV_DISABLED=1`,syntheticSECRET_KEY,DEBUG=True,SB_TEST_DB_NAME=test_skillbridge_continuous,USER=sb_test,HOST127.0.0.1,PORT55438,`core.sse_postgres_test_settings`. Vitefromfrontend withVITE_API_URL=http://127.0.0.1:8018,systemnode node_modules/vite/bin/vite.js --host127.0.0.1 --port5178 --strictPort (separate arguments). ExplicitnpmCLI`C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`;usernpmshim broken. API8018 supplied by fixture; do not concurrently run fixtures sharingport. Local tests require authorizedlocalhost/process sandboxescalation. Clean-setup copies are stale sinceV03/V06;refreshsource before using.
- **Persistent decisions/dependencies:**existingIAMSformat official andverified; neverdelete/replaceit orrequestanother sample. CurrentExcel/CSV/text question importer acceptedprovisionally;officialLMSfilependingP01 thisweek. V01/V07/V06 mayproceed;S01 retainsP01 officialcomparison and staysunchecked. AfterV06 reconcilelocalacceptance honestly;hostingpreparation requires recordeddependency handling;actualproduction/externalwrites require missingauthorization atconsequentialstep. Agreed30s submissiongrace thenreview,Googleinstructors/students/adminpassword assistedrecovery,panelslot/area definition andacceptedbrowsermatrix persist.



## Latest resume checkpoint - local accepted release and hosting handoff, 18 October 2026

This supersedes all earlier pause/continuation checkpoints. Work is not waiting
for an official LMS file: the user explicitly designated the current questionnaire
format as final for these28tasks, with a later update if needed. That scope decision
is recorded transparently in P01; unseen external compatibility was not fabricated.

- **Progress:**24/28 complete. All23local tasks including P01/S01 passed;A04passed.
  Remaining unchecked:V05(actual hosted release/integrations),V09(actual provider
  backup/hosted rollback coverage),V10(actual host startup/recovery/capability),S02.
  User owns existingVercel/Railway publishing andRailway subscription reactivation.
  Do not ask again to deploy for them or treat subscription reactivation as agent
  authorization. No deployment,normalSupabase migration,real-data repair,live email,
  Storage policy/write or subscription action occurred.
- **Final source:**base227f794 plus preserved uncommitted changes. Manifest
  `work/defense_audit/checkpoint-code-manifest-local-final.json` covers174changed/newsource/test/knowledge/config files;
  SHA256`cfd2d248d7466d9a3c8d81cb85154e6ae9dc765fc38c901f1e58d666799430d7`. No commit/reset/stash/push. Preserve all user changes,research,
  currentIAMS/question imports,outputs andignoredwork evidence. Do not rerun stale
  checkpoint/updater scripts. Real.env files excluded;only necessarypublic origin
  values were extracted forCSP,no keys/passwords printed orcopied.
- **Current verification:**291PostgreSQL API tests passed,no skips,after adding4
  readiness cases andexplicitpublichealth inventory. Full116frontend tests,no
  skips;lint/build/check/no modeldrift pass. CurrentP01browser10groups pass;prior
  V01real15roleworkflow,4timing/6session,V07accepted4browser/device matrix remain
  applicable. A04productionbuild/exactheaders:11required resources plusbuiltGIS
  adapter/realAPI sign-in pass;3unrelated origin casesblocked;0pageerrors.
- **Latest narrow changes after earlierV06:**question parsers reject MCQkeys
  pointing toemptychoices inboth spreadsheet paths/sharedtext;manualpublishalso
  requiresnonemptycorrectchoice. RealXLSX/CSV/text mixedtypes,invalid/recovery and
  existingassessmentappendpassed. VercelCSPadds onlyNominatimconnect,exactconfigured
  brandingimageorigin andGISstyle/connectpaths;otherheaders retained. Public
  GET/HEAD`/api/health/` performsSELECT1,returnscoarse200/503,no-store,safelog,
  ignoresJWTonlyonthisprobe;normalpermission/throttleboundaries retained.
- **V06 complete:**accepted200students/8positions/2x30questions/20users.Finalvaried
  answerbenchmark324requests0errors;cold11.801s,submitp95=3.628s/max3.645s,
  postresultp95=.309s,normalreadp95<=.579s,60reads+20streams p95=1.674s,
  rerank3runs max14.285s;exact8rankingIDs/components unchanged. LoadedUI4.826s,
  2warmsubmits1.751/1.452s,6warmrenders1.156-1.540s;0pageerrors. Sourceuses
  validatedanswerbatching,boundedexacttext/modelspacycache,atomicbatchrecommendation
  upserts preservingIDs/snapshots andremoved800msnavigationpause. Earlierfailures,
  diagnosticcold20.593s andlistenerbacklog64vsstock10 limits preserved honestly
  in`knowledge/PERFORMANCE_VERIFICATION.md`;nohostedthroughputguarantee.
- **V09 preparation:**realcustompg_dump/pg_restore ontoadistinctdisposablelocalDB
  matchesallapplicationtablecounts/contenthashes,knownraw/max/finalizedprofile,
  placementID/snapshot andimagekey;separateWebParchiverestoresidenticalbytes;
  sourceunchanged. Dump118453bytes/.990s,restore1.938s;notproductionRTO.
  SourceandrestoreDBs dropped onexit;archivecontains onlysyntheticdata.
  Actualproviderbackupretention/PITR/brandingcoverage andhostrollback remain
  unchecked. V09isolated-restore criterion alone is checked.
- **V10 preparation:**realHTTP200(.197s)->unavailablelocalhostDBport503(2.052s)
  ->recovered200(.102s)passed. NoactualDBwasstoppedforthisrecoverytest. Fourunit
  healthcontracts andfull291PGpass. Initialsuitefailedonlytheoldprivate-route
  inventorybecausehealthisintentionallypublic;explicitpublicexceptionaddedwith
  separatehealthtests,allotherprivateassertionsretained. Manualrestart/redeploy
  plusbackup/restore(option1)recommendedwhenuserasked;automaticfailovernotverified.
  Confirmacceptedpaperwording/capabilities atactualhostacceptance ratherthan
  assumingpaid/multi-serverinfrastructure. Noadditionalenterpriseprerequisite.
- **Primary evidence:**`knowledge/QUESTION_IMPORT_FORMAT.md`,
  `PRODUCTION_BROWSER_POLICY.md`,`RELEASE_AND_RECOVERY_HANDOFF.md`,
  `PERFORMANCE_VERIFICATION.md`;logs/JSONunder`work/defense_audit/`:
  `hosting-prep-postgres-after.txt`,`hosting-prep-check.txt`,
  `hosting-prep-migrations.txt`,`p01-import-final2.txt`,`p01-frontend-unit.txt`,
  `p01-lint.txt`,`p01-build.txt`,`a04-policy-before.txt`,`a04-policy-after.txt`,
  `a04-artifacts/after.json`,`a04-production-build.txt`,`v09-local-restore.txt`,
  `v09-artifacts/results.json`,`v10-probe-recovery.txt/json`,andV06finalfiles.
  Intentionalbad-case/test-locator/intermediaterunfailures retained,notpasses.
- **Cleanup:**ownedVitesession10314stopped;PGserver55438stoppedwithownedpg_ctl;
  API/static/browserfixturesended. Socketprobeconfirmsports5178/5179/8018/55438
  stopped. No backgroundimplementation,automationoragentsrunning.
- **Exact next work:**readAGENTS/overview/thistrackerandfullV05/V09/V10prompts;
  inspectdiffandmanifest. Userfirstpublishesintendedreviewedrelease/restarts
  Railwaywhenready;HEAD227f794aloneexcludesuncommittedimplementation. Recordactual
  servedcommit/URLs andauthorizedisolatedsynthetichostedboundary. Verifyactual
  TLS/hosts/CORS/CSP/Google/model/email/Storage/maps/downloads/SSE/three-roleflows;
  collectproviderbackupretention+brandingcoverage andpreviousreleaseIDs;verify
  owner-runrestart/recovery/rollback;thenS02onlywhenactualrequiredcriteriapass.
  Untilthenfourhosttasksremainunchecked;localmockspassesarenothostedacceptance.
- **Local restart only if needed:**portablePG17.11 at
  `work/defense_audit/postgres-runtime/pgsql/bin/pg_ctl.exe`,cluster`.../data`,
  `-D work/defense_audit/postgres-runtime/data -l work/defense_audit/postgres-runtime/server.log -o "-h 127.0.0.1 -p 55438" -w start`.
  ProjectvenvPython;PYTHON_DOTENV_DISABLED=1,DEBUG=True,syntheticSECRET_KEY,
  SB_TEST_DB_NAME=test_skillbridge_continuous,USER=sb_test,HOST127.0.0.1,PORT55438,
  settingscore.sse_postgres_test_settings. Nevernormalcredentials. Vite5178uses
  VITE_API_URL=http://127.0.0.1:8018;systemnode/explicitnpmCLIworkaround asprior
  checkpoint. FixtureAPI8018createdbytestharness;donotrunoverlappingfixtures.
  A04static5179needsproductiondistbuiltwithconfiguredRailwayVITE_API_URL and
  exactvercelheaders;allproviderresponsesintercepted. Clean-setupcopiesarestale;
  refreshsourcebeforeusing,noreal.env. NewSupabaseplugin/toolsarenotavailable;
  noSupabaseMCPaccesswasusedforthiscontinuation.

## Session handoff template

If work is interrupted or cannot continue, fill this in before ending the turn. Resume by rereading this file and current source, not by starting the checklist again.

```text
Current phase:
Current task and last completed step:
Completed IDs and count:
Files changed and any uncommitted work:
Checks run and actual results:
Checks still needed:
Exact blocker or unresolved question:
Independent tasks still actionable:
Next task and next exact action:
Required hosted authorization or environment, if applicable:
```

## Stop and completion rules

- A checked task means verified criteria, not just a code edit or a successful command.
- A blocked, skipped or untested required condition stays unchecked and visible. Continue independent work but never bypass hard dependencies or final acceptance gates.
- The local milestone does not require formal thesis survey analysis or 100% recommendation accuracy. It does require the agreed features and error handling to work with evidence.
- Hosting-only work must not silently be counted as locally verified, and a local pass does not prove production configuration.
- When all 28 master tasks and all required feature cases pass, reconcile the records, checkpoint and final evidence before reporting hosted system readiness.
- If every remaining task needs missing input/access or an unavailable environment, report the concrete blocker(s) and saved next action. A Markdown file cannot independently run work after the active session ends.

## Reference documents

- [Project instructions](../../AGENTS.md)
- [Project overview](../../knowledge/PROJECT_OVERVIEW.md)
- [Earlier system scope plan](SkillBridge_Completion_Checklist_and_Prompts.md)
- [Original readiness findings](SkillBridge_Readiness_Review_2026-10-17.md)
- [Separate research and documentation tasks](SkillBridge_Research_and_Documentation_Backlog.md)
- [Assessment review skill](../../.agents/skills/skillbridge-assessment-review/SKILL.md)
- [Recommendation audit skill](../../.agents/skills/skillbridge-recommendation-audit/SKILL.md)
- [Browser testing skill](../../.agents/skills/webapp-testing/SKILL.md)
- [IAMS implementation notes](../../knowledge/IAMS_ENROLLMENT_IMPORT.md)
- [Live-data and isolated PostgreSQL verification](../../knowledge/LIVE_DATA_FRESHNESS.md)

Treat the example screenshot as a prompt-format reference only. SkillBridge remains React/Vite and Django; it is not the screenshot's Next.js/Supabase-auth example.
