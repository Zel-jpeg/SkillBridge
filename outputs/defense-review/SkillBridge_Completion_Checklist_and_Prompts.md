# SkillBridge system completion checklist and prompts

> **Planning reference only.** The active task checkboxes, structured prompts and execution state are now in [SkillBridge Continuous Development](SkillBridge_Continuous_Development.md). Update completion there only; this older plan is not a second progress tracker.

Updated: 18 October 2026.

## Agreed goal

**Complete and test 100% of the agreed system features locally, including correct data, access control and error handling. Then host the completed system and verify it before the predeployment defense in the first week of November.** The exact defense date remains to be confirmed.

100% means every agreed feature and its required acceptance cases pass. It does not mean 100% NLP accuracy, a guarantee of zero future defects, every suggested enhancement, or every prompt merely being marked done.

The October 19 progress report deadline is a separate document deadline. Manuscript editing, defense-minute wording, independent model research/ablations and formal survey analysis are **not counted as system implementation tasks here**. Their earlier prompts are retained in the [separate research and documentation backlog](SkillBridge_Research_and_Documentation_Backlog.md). User task walkthroughs and actual functional correctness remain part of system testing.

## What this file does and does not claim

The main modules already have implementation evidence. The work below includes confirmed corrections and verification of existing features; it does not say every task is a missing module. Recheck current code before fixing an old finding. The source audit was dated October 17 at commit `227f794`; this document update does not rerun its tests or implement its fixes.

Use [AGENTS.md](../../AGENTS.md), [the project overview](../../knowledge/PROJECT_OVERVIEW.md), applicable skills and current code at the start of each task. Respect existing user changes. Use isolated synthetic data for tests, keep secrets/student information out of artifacts, preserve role/batch boundaries and record checks actually run. Backend SQLite checks cannot prove PostgreSQL locking.

The prompts authorize the described implementation only when the user submits them as tasks. This file alone does not authorize deployment, production migrations, real-score repair, live placements, provider permission changes or messages to real users. Prepare concrete work and use the authorization available in that implementation chat. Routine local fixes and isolated checks should proceed without repeated permission questions; ask only for genuinely missing material decisions or access.

## Work order

1. **Agree the acceptance matrix:** S00, plus material policy/sample decisions for A02/A07/P01/P03.
2. **Correct local behavior:** A01/A03 first, then the other local application, NLP-runtime, panel-format and error-handling tasks.
3. **Verify complete local workflows:** local V tasks and S01. Treat required unavailable samples/tests as unresolved, not passed.
4. **Host before the defense:** A04, V05, V09 and V10, then final system acceptance S02.

Work on one focused task at a time. Existing feature implementation is only changed when the agreed behavior is missing or a reproducible defect is found. Preserve established scope; do not add a new architecture or rebuild completed modules.

## Feature scope to cover

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

## Error handling required across existing modules

- Validate in the backend as well as the browser. Show useful field-level or operation-level messages for invalid data.
- Handle relevant unauthenticated/expired, forbidden, missing, conflict, oversized, rate-limited and temporary service/server responses without exposing secrets.
- Clear loading indicators, avoid duplicate submissions/records, retain recoverable drafts/answers, and offer a safe retry where appropriate.
- Keep multi-record changes atomic or provide an explicit consistent recovery state. Never claim success for an operation that failed or delivery for a message merely queued.
- Treat network timeouts and failed follow-up reads carefully: a write may already have committed. Do not blindly replay uncertain mutations.
- Reconcile stale/deleted or newly inaccessible records, preserve historical scores/placement snapshots, and prevent one role/account from seeing another account's cached data.
- Handle empty data and unavailable optional services/models/images gracefully without fabricating results or concealing which model was actually used.
- Verify failure cases using synthetic fixtures/mocked outages. The checklist is a test contract, not an assertion that each failure is currently present.

## Historical scope register

This is retained scope information. Use the continuous-development file for actual completion status.

| Reference | ID | Task | Phase | Kind / priority |
|---|---|---|---|---|
| Scope | S00 | Confirm the agreed feature scope and acceptance rules | Local | Scope and policy; Start here |
| Scope | A01 | Correct assessment scoring and answer validation | Local | Confirmed defect; First fixes |
| Scope | A02 | Enforce attempt duration and handle expired submissions | Local | Confirmed defect / policy; After expiry rule |
| Scope | A03 | Validate catalog input and prevent partial saves | Local | Confirmed defect; First fixes |
| Scope | A07 | Complete the agreed login and account onboarding methods | Local | Requirement alignment; Decide early |
| Scope | A05 | Complete a truthful and usable account recovery flow | Local | Confirmed unfinished behavior; After login contract |
| Scope | A06 | Complete the agreed session renewal and expiry behavior | Local | Incomplete promised behavior; Before local acceptance |
| Scope | N01 | Make the selected NLP preprocessor work reliably | Local | Runtime verification / correction; Before result acceptance |
| Scope | N02 | Verify complete recommendation and eligibility behavior | Local | Feature verification / correction; After A01 and A03 |
| Scope | N04 | Verify question suggestions and generated competency text | Local | Implemented feature verification; Before workflow acceptance |
| Scope | P01 | Verify official LMS exam-format support | Local | Panel feature verification / conditional addition; Sample or scope decision |
| Scope | P02 | Verify official IAMS enrollment compatibility | Local | Panel feature verification / conditional addition; Sample or scope decision |
| Scope | P03 | Clarify agency demand and area analytics | Local | Panel feature verification / conditional addition; Sample or scope decision |
| Scope | E01 | Complete consistent validation and error recovery across screens | Local | Cross-system verification / correction; Alongside feature fixes |
| Scope | E02 | Handle unavailable external services without breaking local workflows | Local | Integration failure handling; Before local acceptance |
| Scope | V01 | Complete local end-to-end workflows for all three roles | Local | Whole-system verification; After relevant corrections |
| Scope | V02 | Reconcile reports, dashboards and placement records | Local | System verification / correction; Before final local acceptance |
| Scope | V04 | Verify concurrency and data freshness on PostgreSQL | Local | System verification / correction; Before final local acceptance |
| Scope | V07 | Complete browser/device and failure-recovery checks | Local | System verification / correction; Before final local acceptance |
| Scope | V11 | Verify reproducible setup and maintenance instructions | Local | System verification / correction; Before final local acceptance |
| Scope | V03 | Verify local backend access controls and sensitive-data handling | Local | Security verification; Before local acceptance |
| Scope | V06 | Verify acceptable local performance for the agreed workload | Local | Performance verification; Stable local build |
| Scope | S01 | Sign off complete and correct local system behavior | Local | Local acceptance gate; After required local tasks |
| Scope | A04 | Correct production browser policy for maps and images | Hosting | Configuration correction; Prepare after local completion; test before defense |
| Scope | V05 | Host the completed release and verify real integrations | Hosting | Release preparation / verification; After S01 and A04 |
| Scope | V09 | Verify a usable backup restore and release rollback path | Hosting | Basic operational reliability; Before hosted acceptance |
| Scope | V10 | Verify startup recovery and basic hosting health checks | Hosting | Operational reliability; Before hosted acceptance |
| Scope | S02 | Accept the hosted system for the predeployment defense | Hosting | Final system acceptance; Last system task |


## Local system work


### S00 Confirm the agreed feature scope and acceptance rules

**Type:** Scope and policy. **Order:** Start here.

All five objectives have implementation evidence. This task defines what must work; it does not label all modules missing. Use the 13 functional and eight non-functional requirements and the software-related panel requests as the source checklist.

**Completion criteria:**

- Create a feature-by-feature matrix covering the scope map below, with an expected successful result, invalid/error cases, role boundaries and evidence for each feature.
- Resolve material choices about late submissions, staff login/recovery, seven-day renewal, LMS format and agency demand. Preserve an explicitly recorded decision; ask only when a choice cannot be inferred safely.
- Do not reduce agreed requirements merely to declare completion, expand scope into unrelated features, or substitute NLP accuracy for completion. Record proposed changes for the user/adviser to accept.
- Distinguish local feature completion from final hosted verification. Independent research labels, thesis edits and formal survey statistics are tracked separately.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read S00 and the scope map in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Build a concrete acceptance matrix for every agreed system feature, role workflow and error case using current code and the project requirements. Identify actual missing/broken behavior separately from implemented features needing tests. Preserve recorded decisions and request only unresolved material policy choices. Do not weaken requirements, add unrelated features or use NLP accuracy as project completion. Prepare the matrix for the remaining system tasks.
```


### A01 Correct assessment scoring and answer validation

**Type:** Confirmed defect. **Order:** First fixes.

Reproduced in the prior isolated audit: one correct response from a two-question assessment scored 100%; repeating a correct question four times plus one wrong question scored 80%; malformed entries caused HTTP 500. Recheck before fixing.

**Completion criteria:**

- Use the authoritative assessment question set for category denominators: one correct of two is 50%, and seven correct with three omitted is 70%.
- Validate answer entry shapes and IDs; reject duplicates and foreign questions/choices with clear errors and no partial persistence. Define accepted empty submissions consistently.
- Preserve MCQ, true/false, exact normalized identification, retake resets, stopped-attempt evidence rules, completion gates and score history.
- Cover omitted, empty, duplicate, malformed and foreign answers and verify downstream combined competency/recommendations. Do not silently recalculate historical real records.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and use the assessment-review and recommendation-audit skills. Read A01 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Reproduce and fix omitted-question and duplicate-answer score inflation and malformed/foreign answer handling. Grade each authoritative question once, preserve attempt/retake/stopped-evidence rules, and prevent partial writes. Trace the frontend payload and downstream combined competency. Add meaningful isolated regression checks, document historical-data impact, and do not rewrite real scores or placements.
```


### A02 Enforce attempt duration and handle expired submissions

**Type:** Confirmed defect / policy. **Order:** After expiry rule.

The earlier audit accepted a one-minute attempt started two hours earlier. The server calculates elapsed time but does nothing when it exceeds the duration. Availability due dates and attempt duration are separate checks.

**Completion criteria:**

- Implement the recorded expiry/grace policy using server time; obtain a material missing rule before implementing its consequences.
- Refreshing or changing browser time cannot extend an attempt. Handle on-time, late and connection-delayed submissions with truthful messages and the agreed answer-saving behavior.
- Normal submit, timer completion and integrity stop cannot finalize twice. Prevent stale requests from finalizing a different retake.
- Test expiry, resume, due-date boundaries, repeated requests and concurrent finalization; preserve recoverable local answers on retryable failures.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the assessment-review skill. Read A02 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Implement the agreed server-authoritative attempt-duration rule across start/resume/submit/stop and the frontend countdown. If the late/grace policy is genuinely unresolved, prepare a concrete proposal and obtain that decision first. Preserve answer recovery, retake identity and single finalization. Verify on-time, expired, refreshed, delayed and concurrent requests with isolated fixtures, including clear user-facing outcomes.
```


### A03 Validate catalog input and prevent partial saves

**Type:** Confirmed defect. **Order:** First fixes.

The prior audit reproduced invalid slots causing 500, a 150% requirement being accepted, and malformed requirements causing 500 after a position was created.

**Completion criteria:**

- Validate company/position fields, requirement object structure, known categories, finite 0-100 percentages and the agreed integer slot bounds before related writes.
- Reject invalid requests without leaving partial records; use transaction boundaries and safe external-resource cleanup where applicable.
- Keep capacity at or above approved placements and protect referenced placement/history records from destructive catalog actions.
- Verify admin/instructor permissions, create/edit/delete paths, repeated clicks and error recovery; preserve unsaved form values on failure.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read A03 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Reproduce and fix catalog input validation and partial saves across affected company/position APIs and forms. Validate slots, finite 0-100 requirements, category references and payload shapes on the backend, and make related writes atomic. Preserve approved capacity, historical records and role permissions. Return actionable errors and preserve drafts. Add isolated regression checks for invalid input, rollback and retries without reranking live students.
```


### A07 Complete the agreed login and account onboarding methods

**Type:** Requirement alignment. **Order:** Decide early.

The paper specifies staff password login, while newly created instructors have unusable passwords and can use Google. Implement the agreed role contract; rewriting the paper alone is not an application fix.

**Completion criteria:**

- Record supported methods for students, instructors and administrators; implement any missing agreed onboarding/login path.
- Enforce approval, active-account, enrollment and role restrictions in the backend. Prevent users from choosing an elevated role through a client-only check.
- Show clear pending, unenrolled, invalid-credential, denied-OAuth and temporarily unavailable states without revealing sensitive details.
- Use no shared/default passwords; test account setup and login with synthetic users and mocked provider responses. Coordinate with A05.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read A07 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Trace actual student, instructor and admin onboarding/login and complete the agreed authentication methods. Preserve Google identity verification and backend role/approval/activity/enrollment checks. If staff login methods are unresolved, present concrete options for the user rather than silently changing scope. Handle rejected or unavailable sign-in clearly, use no shared passwords, and verify with isolated users and mocked external services. Coordinate password recovery with A05.
```


### A05 Complete a truthful and usable account recovery flow

**Type:** Confirmed unfinished behavior. **Order:** After login contract.

Forgot password currently changes local state and claims a link was sent without a reset request. It is visible behavior even though it is not a separately numbered requirement.

**Completion criteria:**

- Provide the agreed self-service or administrator-assisted recovery path for password accounts, and appropriate Google-account guidance for Google-only accounts.
- Never show false delivery success. Handle unavailable mail delivery, invalid input and rate limits clearly without account enumeration.
- If self-service is required, use expiring single-use tokens, password validation and invalid/expired/reused-token handling.
- Test delivery and recovery with mocks; do not send live reset messages or modify real credentials. An adviser-approved assisted process may satisfy recovery without inventing an email-reset module.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read A05 and the A07 login contract in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Replace the false Forgot password success with the agreed functioning recovery flow. Implement secure token-based reset if required, or truthful usable assisted-recovery/Google guidance if that is the accepted scope. Handle validation, expiry, rate limits and delivery failure without enumerating accounts. Verify using mocks and synthetic accounts; do not send real messages or change real passwords.
```


### A06 Complete the agreed session renewal and expiry behavior

**Type:** Incomplete promised behavior. **Order:** Before local acceptance.

Eight-hour access tokens and seven-day refresh tokens are configured, but the frontend stores refresh without exchanging it when access expires. The agreed seven-day session requirement needs working behavior, not just a token lifetime setting.

**Completion criteria:**

- Implement the recorded renewal contract through the shared client; coordinate concurrent refresh requests and stop refresh loops.
- Handle expired/revoked refresh, inactive accounts, logout, identity change and SSE reconnection safely. Preserve answer/draft state across appropriate session recovery.
- Never replay uncertain mutations after network failures. Verify which rejected requests can be safely retried after successful authentication.
- Use short-lived synthetic tokens to test expiry and renewal. A change to the requirement needs explicit user/adviser acceptance, not an automatic documentation workaround.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read A06 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Complete the agreed session-renewal behavior using the shared Axios client, SessionContext, identity/cache lifecycle and SSE. For the current seven-day renewal requirement, implement coordinated refresh with bounded retries, safe identity checks and correct logout/expired-refresh outcomes. Preserve active assessment answers and never replay uncertain mutations. Test concurrent expiry, refresh failure, account change and stream reconnection with short-lived synthetic tokens. Do not declare the feature complete merely by changing paper wording.
```


### N01 Make the selected NLP preprocessor work reliably

**Type:** Runtime verification / correction. **Order:** Before result acceptance.

Model comparison already exists. This system task concerns the supported selected model, availability and runtime error behavior; notebook timing reconciliation and research model selection are outside this file.

**Completion criteria:**

- Verify the agreed selected model can load in the intended local runtime and record requested versus actual model.
- Keep supported fallback behavior explicit; unavailable resources must not produce fabricated model-comparison scores or misleading model identity.
- Handle missing resources, failed initialization, empty vocabulary, no positions and no usable student evidence gracefully.
- Do not require every comparison model in the deployed runtime unless agreed. Do not add startup downloads or change the active model arbitrarily.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read N01 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify and complete local runtime support for the agreed selected NLP preprocessor. Trace loading, requested/actual model reporting, fallback, empty text/vocabulary and model diagnostics. Fix confirmed runtime/error-handling gaps without fabricating comparison metrics, changing ranking weights or downloading resources at request time. Use isolated data and mocks for failure scenarios. Treat research timing/model-selection decisions as separate follow-up work.
```


### N02 Verify complete recommendation and eligibility behavior

**Type:** Feature verification / correction. **Order:** After A01 and A03.

The category/text/location recommender is implemented. It needs complete functional checks, not a 100% accuracy target.

**Completion criteria:**

- Verify agreed weights and shared category ordering, generated text, candidate requirements, coordinates/distance and deterministic ranking presentation.
- Correctly combine raw/max evidence across assessments; preserve required-completion gates, active-batch scope, retakes, stopped-evidence exclusions and stale-result invalidation.
- Handle no assessments, no required assessments, no positions, missing requirements, zero evidence and missing/invalid coordinates with clear states.
- Keep recommendation similarity separate from capacity/approval eligibility and placement-success probability. Changes to weights or missing-location policy require a recorded scope decision.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read N02 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify and fix functional recommendation behavior end to end: combined raw/max evidence, current batch/completion gates, category/text/location components, selected model, ranking, stale evidence and placement eligibility. Cover empty/missing data, retakes and unavailable resources. Preserve agreed weights and history, show clear locked/empty/error states, and test with synthetic cases. The goal is correct agreed behavior, not 100% prediction accuracy or rewritten expected labels.
```


### N04 Verify question suggestions and generated competency text

**Type:** Implemented feature verification. **Order:** Before workflow acceptance.

TF-IDF category/tag suggestions and generated profiles exist; ensure they work with current category data and do not overstate measured skills.

**Completion criteria:**

- Suggestion failures or unavailable categories do not destroy question drafts or prevent valid manual classification.
- Support manual correction; validate category ownership/references and ambiguity/no-suggestion states.
- Generated text reflects actual category scores and required skills; it does not claim individually tested subskills solely because they occur in a category vocabulary.
- Verify clear, ambiguous and unfamiliar question examples, ties, missing categories and zero scores. Record limitations without inventing a required accuracy percentage.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the assessment-review and recommendation-audit skills. Read N04 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify question category/tag suggestions and generated competency/position text with representative synthetic inputs. Fix functional defects and unsupported profile claims, preserve instructor correction and drafts when suggestions fail, and handle missing categories/zero scores clearly. Keep score history intact and record tested cases without requiring perfect NLP classification.
```


### P01 Verify official LMS exam-format support

**Type:** Panel feature verification / conditional addition. **Order:** Sample or scope decision.

Panel request. Excel/custom text imports exist; official LMS compatibility has not been demonstrated.

**Completion criteria:**

- Obtain an anonymized official sample or specification; compare required columns/format, supported types, answer encoding and categories. Implement only the needed adapter if incompatible. Demonstrate correct question/answer import, validation errors and retained existing formats. If no official sample is available, mark pending rather than guessing that LMS means Moodle, AIKEN or another particular format.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read P01 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify the current assessment importer against the official LMS exam sample/specification supplied for this task. Trace question types, choices, answer keys and categories end to end. Add a focused compatible import path only if a mismatch is confirmed, preserving existing formats and server validation. Use anonymized samples and isolated fixtures. If the official format is unavailable, list the exact missing specification and provide a review checklist instead of inventing compatibility.
```


### P02 Verify official IAMS enrollment compatibility

**Type:** Panel feature verification / conditional addition. **Order:** Sample or scope decision.

Panel request and functional requirement 3. The implemented parser supports IAMS-style columns, preview/confirm, identity checks and generated DNSC addresses.

**Completion criteria:**

- Test an anonymized institutional export, multiple-sheet/preamble handling, IDs with preserved leading zeros, names, supported programs, duplicates/conflicts and retry behavior. Verify generated addresses with institutional conventions; do not assume all names map correctly. Confirmation must not duplicate records. Use mocked notifications.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and knowledge/IAMS_ENROLLMENT_IMPORT.md. Read P02 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify the existing IAMS import using the anonymized official sample provided, including headers, preambles, student IDs, names/programs, duplicates, identity conflicts and generated email conventions. Correct demonstrated incompatibilities without replacing the completed preview/confirm workflow. Preserve backend identity constraints and use mocked email. Do not enroll real students or send live notifications as part of this check.
```


### P03 Clarify agency demand and area analytics

**Type:** Panel feature verification / conditional addition. **Order:** Sample or scope decision.

Panel requested required students per agency/area. Current system has configured slots, approved/remaining capacity and student counts by area.

**Completion criteria:**

- Adviser confirms whether required students means existing slot capacity or a separate demand/quota. If capacity is sufficient, verify and label it clearly. If a separate quota is explicitly required, design its scope, data entry, permissions and report meaning before adding it. Ensure counts are not conflated across home area, company area and batch membership.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read P03 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Map current company capacity and area analytics to the panel's required-students wording. Present a concrete explanation of whether existing slot capacity satisfies it and identify the adviser decision if a separate demand target may be intended. Do not invent a new quota module without that decision. Verify current counts first; implement only an agreed gap and keep student-residence, company-location and placement-area definitions clear in dashboards and exports.
```


### E01 Complete consistent validation and error recovery across screens

**Type:** Cross-system verification / correction. **Order:** Alongside feature fixes.

The user requires the agreed system to work properly and handle errors. These are mandatory checks across existing modules, not claims that every listed failure is already present.

**Completion criteria:**

- Map frontend actions to their backend validation and mutation boundaries. Check invalid forms, malformed payloads, duplicate records, denied access, missing/deleted records, conflicts and timeouts.
- Provide useful field errors and retryable/nonretryable messages for relevant 400/401/403/404/409/413/429/500/503 outcomes. Do not invent statuses for a particular endpoint.
- Clear loading states on failure, prevent duplicate clicks/duplicate records, preserve unsaved fields/answers on retryable errors, and keep failed multi-record saves atomic.
- Never display success before the operation succeeds; distinguish saved/queued/delivered states. Do not blindly retry non-idempotent or uncertain requests.
- Prevent unhandled page errors and secret/PII disclosure; logs provide safe diagnostic context. Cover malformed server responses and reconciliation after committed writes with failed follow-up requests.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and relevant project skills. Read E01 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Audit and complete validation/error recovery across existing authentication, profile, enrollment, assessment, catalog, recommendations, placements and report flows. Trace each UI action into backend validation and transaction boundaries. Fix confirmed issues with field errors, denied/missing/conflicting data, duplicate actions, timeouts and server failures. Preserve drafts/answers, clear loading states, prevent partial writes/false success, and do not blindly replay uncertain mutations. Add targeted synthetic failure tests and report actual coverage.
```


### E02 Handle unavailable external services without breaking local workflows

**Type:** Integration failure handling. **Order:** Before local acceptance.

A locally running app still depends on Google, address/geocoding/map services, email, Storage and possibly model resources. Mocked failure checks are local system tests; they do not establish live provider availability.

**Completion criteria:**

- Exercise provider denial, timeouts, offline mode, invalid responses and broken images without crashing pages or misclassifying temporary errors as bad credentials.
- Provide truthful fallbacks/retry guidance for maps/photos and unavailable NLP resources. Preserve meaningful coordinate/distance and actual-model states.
- For image/storage saves retain the last good reference and clean up only owned orphan objects safely; failed email delivery must not be described as delivered.
- Bound external calls appropriately and keep credentials server-side. Preserve successful core data writes when a nonessential notification fails according to the recorded contract.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read E02 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify and fix failure handling for Google sign-in, address/geocoding/maps, email, company Storage/images and optional NLP resources in the locally running system. Use mocks to exercise timeout/denial/invalid-response cases without sending live messages or changing provider data. Preserve drafts and last-good records, use truthful fallback/status messages, bound external calls and prevent unhandled exceptions or secret disclosure. Distinguish local integration tests from later live hosting checks.
```


### V01 Complete local end-to-end workflows for all three roles

**Type:** Whole-system verification. **Order:** After relevant corrections.

Existing browser fixtures contain stale selectors after UI redesigns. Tests must follow current accessible controls without weakening outcome assertions.

**Completion criteria:**

- Student: approved/enrolled login, setup/profile, assigned assessment list, randomized start/resume, submit/expiry/retake, scores, combined gates, recommendations/maps and approved placement.
- Instructor: own batches and enrollment, assessment/import/question management, publication/availability, retake control, competency review, company-first suggestions and reports.
- Admin: users/approval, categories, company/position management, capacity, placement decisions/manual assignment/history, analytics and reports.
- Exercise cross-role permissions, empty/loading/error states, repeated clicks, refresh and retained drafts. Save meaningful evidence and repair stale test-navigation assumptions.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the webapp-testing skill. Read V01 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Update stale browser selectors and complete the three-role local end-to-end acceptance flows against disposable synthetic data. Verify real React/API behavior for student assessments/results, instructor management and admin catalogs/placements/reports, including access denial, errors, retries, refresh and retained drafts. Mock external services. Fix confirmed application defects separately from test-navigation issues and report every passed, failed or unverified scenario.
```


### V02 Reconcile reports, dashboards and placement records

**Type:** System verification / correction. **Order:** Before final local acceptance.

Objective 5, functional requirement 13 and panel reporting/analytics requests. Reports already exist.

**Completion criteria:**

- Known synthetic records reconcile to student/company reports, area counts, configured versus free slots, filtered batch totals and placement status/history. PDF/XLSX/CSV downloads retain correct filters, dates, identities and snapshot meaning. Preserve historical assignment scores; exclude unauthorized batches and formula-injection risks in spreadsheet exports.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read V02 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify dashboards and student/company placement exports against a known synthetic dataset covering multiple batches, full/empty positions and approved/rejected/removed placements. Reconcile counts, filters, capacity, score snapshots and area definitions across UI and downloaded reports. Correct confirmed inconsistencies, preserve authorization and historical assignment evidence, and inspect exported layouts. Do not regenerate or alter real placement history.
```


### V04 Verify concurrency and data freshness on PostgreSQL

**Type:** System verification / correction. **Order:** Before final local acceptance.

Integrity/reliability/scalability. Two PostgreSQL-only tests were skipped in the SQLite audit; row locking and cross-worker behavior remain unverified.

**Completion criteria:**

- Use a disposable test database through the project's dedicated test configuration. Cover submit-versus-stop, duplicate finalization, competing placement approvals/capacity, company-image replacement/removal and independently observed committed events. Verify rollback does not publish success and streams remain recipient-scoped. Never point destructive tests at the normal database.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and knowledge/LIVE_DATA_FRESHNESS.md. Read V04 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Run the existing PostgreSQL-specific checks and meaningful concurrency scenarios using core.sse_postgres_test_settings with a dedicated disposable test_ database. Verify attempt finalization, placement capacity, company-image lifecycle, commit/rollback publication and cross-process scoped freshness. If no suitable database exists, prepare the exact setup and test plan and mark those checks unverified. Never reuse production DB credentials or run these tests against the application database.
```


### V07 Complete browser/device and failure-recovery checks

**Type:** System verification / correction. **Order:** Before final local acceptance.

Compatibility, usability, reliability and maintainability. Responsive styling or a single Chrome run does not prove all supported devices.

**Completion criteria:**

- Use an agreed browser/device matrix. Verify assessment controls/timers/fullscreen, imports, maps, dialogs, downloads, keyboard access, narrow screens and readable errors. Test interrupted connections, refresh, session expiry and permission denial with retained answers/drafts where supported. Distinguish emulation from physical-device testing; report unavailable browsers honestly.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the webapp-testing skill. Read V07 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify the agreed desktop/tablet/mobile and browser matrix, including maps, assessment fullscreen/timer behavior, forms, imports and report downloads. Exercise network interruption, refresh, expired sessions, keyboard navigation and clear recovery/error states using synthetic data. Fix reproducible issues within the current interface conventions. Label emulated versus physical devices and record untested environments rather than claiming universal compatibility.
```


### V11 Verify reproducible setup and maintenance instructions

**Type:** System verification / correction. **Order:** Before final local acceptance.

Maintainability and deployment preparation. The audit's ordinary npm command failed because of a user-level launcher problem; the installed project tools still built successfully. Five lint warnings and stale browser fixtures were also recorded.

**Completion criteria:**

- A clean setup can install the intended dependencies, configure example variables without secrets, initialize an isolated database, select/install the required NLP resources and run checks. Record Python/Node/model versions and maintenance operations. Resolve actual reproducibility problems and useful lint warnings without unrelated framework upgrades or refactors. Include operator/user guidance and honest limitations.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read V11 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify reproducible frontend/backend setup, dependency manifests, example configuration, migrations, optional NLP resources, testing and operator instructions. Distinguish the local npm-launcher issue from project defects; resolve necessary setup problems without altering unrelated global settings. Review remaining lint warnings and stale instructions, making focused justified corrections. Document versions and commands, use synthetic/local configuration, and keep all secret values out of tracked files.
```


### V03 Verify local backend access controls and sensitive-data handling

**Type:** Security verification. **Order:** Before local acceptance.

Authentication controls exist. System completion includes preventing unauthorized access and safely handling invalid data; a local app still needs backend enforcement.

**Completion criteria:**

- Verify student/instructor/admin role, object, batch, approval and active-account boundaries, including direct API calls bypassing hidden UI controls.
- Check identity/provider handling, input limits, meaningful rate controls and safe errors/logging without secrets or unnecessary student data.
- Review session/cache isolation, logout, stale requests and account changes; protect answer keys and placement snapshots.
- Fix reproduced local defects and document remaining hosted configuration checks separately. Do not mandate an unrelated authentication redesign without evidence.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read V03 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify local backend authentication, role/object/batch permissions, approval/activity/enrollment gates, identity/cache isolation, answer-key protection, validation and safe errors/logging. Reproduce and fix scoped defects using isolated synthetic roles, including direct API requests that bypass the frontend. Do not expose secrets or attack hosted services. Keep production TLS/CORS/provider configuration verification for the hosting phase and report actual coverage.
```


### V06 Verify acceptable local performance for the agreed workload

**Type:** Performance verification. **Order:** Stable local build.

Performance means the agreed flows remain usable at the expected demonstration workload. Notebook batch times are not UI/API response-time measurements.

**Completion criteria:**

- Define realistic local students, questions, positions and concurrent users, plus user/adviser-accepted response/error targets. Do not invent universal limits.
- Measure cold/warm submission, results, reports, catalogs and representative concurrent activity; include reranking and event-stream cost where relevant.
- Record environment, sample sizes, repetitions, observed latency/error rate and any justified p50/p95 summary. Optimize demonstrated bottlenecks without changing agreed scoring/ranking.
- Keep hosting-specific measurements for V05; do not turn this into an enterprise-scale stress project or load-test production.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read V06 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Establish the agreed realistic local defense workload and measurable usability/performance targets, then measure key API/UI flows, cold/warm behavior and representative concurrency using synthetic data. Investigate and fix demonstrated bottlenecks without changing scoring/ranking semantics or adding unrelated infrastructure. Record actual timings, error rates and test conditions. Do not treat notebook processing time as web latency or require enterprise-scale load beyond agreed scope.
```


### S01 Sign off complete and correct local system behavior

**Type:** Local acceptance gate. **Order:** After required local tasks.

This is the first milestone: 100% of the agreed functional scope implemented and verified locally. It is not hosted acceptance, 100% model accuracy, or a promise that no future defect can occur.

**Completion criteria:**

- Every agreed feature has a passed local acceptance scenario and relevant invalid/error/recovery cases. Mark missing samples/decisions as unresolved rather than passed.
- No unresolved critical/high issue affecting required workflows, score integrity, access control, data loss, capacity or normal error recovery. Record any genuinely nonblocking issues.
- Run relevant backend checks on isolated settings, frontend lint/build and unit/browser checks on the exact intended release. Skipped database/locking checks are not passes.
- Demonstrate all role workflows with reproducible synthetic accounts/data and sample exports; record tested commit, evidence and remaining host-only tasks.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read S01 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Review the exact current local release against S00 and completed system tasks. Run appropriate isolated backend, frontend build/lint/unit and browser acceptance checks, and demonstrate every agreed role workflow with synthetic data and relevant error/recovery cases. Fix remaining scoped blockers and record evidence. Report local scope complete only if all required local criteria pass; keep hosted checks explicitly pending and do not equate completion with perfect NLP accuracy.
```


## Hosting after local completion


### A04 Correct production browser policy for maps and images

**Type:** Configuration correction. **Order:** Prepare after local completion; test before defense.

Objective 4, functional requirement 12, deployed compatibility/security. Local Chrome with the exact repository CSP blocked Nominatim geocoding and a synthetic Supabase branding image. The actual remote served policy was not verified.

**Completion criteria:**

- Narrowly permit the configured required geocoding and image origins, retaining the rest of the security policy. Verify Google sign-in, Leaflet assets/tiles, profile photos, company images and address requests under production-equivalent headers. Separate configured-policy results from real hosted results.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read task A04 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Inspect frontend vercel.json and the origins actually used by maps, geocoding, Google sign-in and company branding. Correct the narrow CSP allowlists so required resources work without removing CSP or broadly permitting every origin. Verify a built site with production-equivalent headers and synthetic data. Record which hosted checks remain pending; prepare the change without publishing it automatically.
```


### V05 Host the completed release and verify real integrations

**Type:** Release preparation / verification. **Order:** After S01 and A04.

The user plans to host before the defense. Prepare deployment only after local features work, then verify environment-specific behavior on the intended hosted build.

**Completion criteria:**

- Identify release commit and intended origins/services; prepare builds, required environment names, migration/static/startup steps and rollback instructions without revealing secrets.
- Perform hosting/deployment actions only when authorized in that task. Verify served frontend routes, API connectivity, HTTPS/hosts/CORS/CSP, Google origins, selected model, email/storage, maps/images, downloads and SSE.
- Use authorized disposable staging/demo records for mutations and a documented cleanup boundary. Do not alter real grades/placements as a smoke test.
- Repeat the essential three-role and error/retry flows on the actual hosted build; compare errors/response time with accepted expectations. Network failures in the review environment do not prove a host is down.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read V05 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Confirm local gate S01 passes, then prepare the completed release for the intended hosts with concrete configuration, build/startup/migration and rollback steps. Publish or apply hosted changes only within the authorization available in this task. Verify the actual hosted commit, routes/API, TLS/hosts/CORS/CSP, OAuth, model resources, email/storage, maps/images, downloads and SSE. Repeat essential role workflows and error recovery using authorized disposable data. Do not mark inaccessible hosted checks as passed.
```


### V09 Verify a usable backup restore and release rollback path

**Type:** Basic operational reliability. **Order:** Before hosted acceptance.

Match the agreed paper/system reliability scope to actual capabilities. A database-backed deployment needs a usable recovery approach; provider backup coverage must be verified, not assumed.

**Completion criteria:**

- Record actual backup scope/retention, database and branding storage coverage, responsible operator and instructions.
- Demonstrate recovery with synthetic or authorized sanitized data into an isolated target, never over production.
- Prepare a working release rollback procedure and record observed recovery limits against the accepted requirements.
- Do not add paid backup tiers or enterprise disaster recovery unless explicitly agreed; unresolved required recovery behavior remains an open item.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read V09 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify a practical backup, isolated restore and release rollback procedure for the intended hosted system within the agreed scope. Confirm actual provider capabilities and database/storage coverage. Test only with synthetic or authorized sanitized data in a separate target, record results and owner instructions, and prepare missing configuration steps. Do not restore over production, export private records or purchase services without authorization.
```


### V10 Verify startup recovery and basic hosting health checks

**Type:** Operational reliability. **Order:** Before hosted acceptance.

Confirm that the deployed system starts, remains observable and can be recovered. The paper references automatic failover, but no accepted/configured topology was established in the audit.

**Completion criteria:**

- Verify startup/restart, database/service unavailability messages, bounded waits, safe logs and a useful health/monitoring procedure.
- Record responsible operator and recovery steps appropriate to the actual hosting plan; verify any promised automatic failover instead of assuming it.
- If the agreed failover requirement cannot be met by the intended setup, surface the concrete capability/scope decision rather than silently dropping the promise or buying infrastructure.
- Do not make formal research surveys or enterprise alerting prerequisites for ordinary feature completion. Actual agreed reliability requirements still need evidence before hosted sign-off.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read V10 in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify practical hosted startup/restart, service-outage handling, safe diagnostic logs, health checks and operator recovery for the actual deployment plan. Check any agreed automatic-failover promise against real configured capabilities and surface a material mismatch for an explicit decision. Implement scoped application health/error handling where needed, but do not purchase infrastructure, weaken security, change external permissions or send alerts without authorization. Record actual observed behavior.
```


### S02 Accept the hosted system for the predeployment defense

**Type:** Final system acceptance. **Order:** Last system task.

Final target: all agreed features work locally and on the build demonstrated at defense, with correct results, permissions and error handling. This does not require 100% NLP prediction accuracy.

**Completion criteria:**

- S01 local acceptance and required hosting tasks are complete on the same released behavior; every agreed feature has evidence and no unresolved blocking defect.
- Verify all three roles, invalid/error/recovery cases, representative performance, report outputs, saved data and placement capacity/history on the final demo release.
- Prepare stable synthetic demo records/accounts, sample exports, recovery instructions and a practical contingency demonstration.
- Report exact tested commit, known nonblocking limitations and a ready/not-ready decision based on the acceptance matrix. Do not use a count of closed prompts as proof of 100% scope completion.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read S02 and the acceptance matrix in outputs/defense-review/SkillBridge_Completion_Checklist_and_Prompts.md. Verify that the final hosted build meets every agreed system feature and required local/hosted error-handling criterion, with all three roles and realistic synthetic demo records. Recheck critical paths, saved results, placements/capacity/history, maps, reports, session recovery and external integration failures. Resolve scoped blockers, prepare contingency/recovery guidance and record the tested release and evidence. Declare complete only on passed criteria, not model accuracy or task-count percentages. Keep thesis writing and research surveys outside this system sign-off.
```


## Completion evidence to record

At the end of each task, record the behavior changed or verified, affected files, exact checks and results, and unresolved conditions. Meaningful isolated regression tests are required for data-integrity, permission and error-recovery changes. Documentation-only edits do not require unrelated application builds. Broaden testing when the affected integration or a new failure justifies it.

| Task ID | Status | Date | Tested commit/build | Evidence | Remaining condition |
|---|---|---|---|---|---|
| Example only | Not started / In progress / Needs decision / Unverified / Passed | Actual date | Actual identifier | Logs/screenshots/export | Explicit condition or none |

Maintain a separate **feature acceptance matrix** from S00. A feature cannot be marked complete because a prompt ran successfully. Skipped checks, missing sample formats, uncertain policies and unverified hosted behavior remain visible.

## Final milestone checklists

### Local scope complete

- Every agreed feature has passed successful and relevant invalid/error/recovery cases in the locally running system.
- All three role workflows work end to end and backend permissions are enforced.
- Scoring, combined evidence, attempt lifecycle, placement capacity/history and report totals are correct.
- No blocking data-integrity, access-control, data-loss or normal-flow error defect remains.
- Required local unit/integration/browser/database checks passed; unsupported or unavailable checks are disclosed.
- Local setup and demonstration are reproducible with safe synthetic accounts and data.
- Remaining items are explicitly hosting-only or accepted nonblocking limitations; no required feature is silently deferred.

### Hosted system ready for defense

- The exact release that passed local acceptance is hosted with the required environment and model resources.
- Actual hosted routes, authentication, API, storage/email, maps/images, reports and data freshness work.
- Essential three-role workflows and error/session-recovery cases pass on the hosted build.
- Agreed basic operational recovery and hosting security/reliability requirements have evidence.
- Synthetic demo data, sample exports and contingency/recovery instructions are ready.
- No required acceptance condition remains unresolved; the final readiness decision identifies the tested release and evidence.

## Work kept outside this system checklist

Use the [research and documentation backlog](SkillBridge_Research_and_Documentation_Backlog.md) for thesis/manuscript editing, notebook timing reconciliation, independent placement-label studies/ablations, formal ISO-characteristic survey analysis, defense-minute wording and the October 19 progress report. Do not count those document/research tasks as missing application features. If a finding from them reveals an actual agreed feature defect, add a concrete system task with acceptance criteria here.

Do not rebuild already implemented randomized exams, IAMS preview/confirm, multiple assessments/retakes, combined competency, hybrid ranking, maps, company-first suggestions, placements/history, analytics or exports merely because they appear in this checklist. Verify and correct them. Do not add generative AI, semantic answer grading, 100% NLP accuracy targets, enterprise-scale infrastructure or all three production NLP models unless the user-approved scope requires them.

## References

- [Original readiness review and reproductions](SkillBridge_Readiness_Review_2026-10-17.md)
- [Separate research and documentation backlog](SkillBridge_Research_and_Documentation_Backlog.md)
- [Project instructions](../../AGENTS.md)
- [Project overview](../../knowledge/PROJECT_OVERVIEW.md)
- [Assessment review skill](../../.agents/skills/skillbridge-assessment-review/SKILL.md)
- [Recommendation audit skill](../../.agents/skills/skillbridge-recommendation-audit/SKILL.md)
- [Browser testing skill](../../.agents/skills/webapp-testing/SKILL.md)
- [IAMS import contract](../../knowledge/IAMS_ENROLLMENT_IMPORT.md)
- [Live-data behavior and PostgreSQL verification](../../knowledge/LIVE_DATA_FRESHNESS.md)

This is a plan for completing and verifying the agreed system. Updating the plan does not mean its tasks have been performed.
