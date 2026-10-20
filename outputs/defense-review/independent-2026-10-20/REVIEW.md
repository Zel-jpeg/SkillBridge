# SkillBridge independent code and defense readiness review

Reviewed 20 October 2026, Asia/Manila. Pre-deployment defense: **9–10 November 2026**, confirmed by the team in this conversation. Last supplied formal panel review: **outline defense on 2 June 2026**. The team reports no subsequent formal adviser check; a visit is planned this week or next week.

## Assessment

**The main modules are implemented and substantial local verification passes. Full defense or deployment readiness is not established.** This review reproduced a high-impact stale-recommendation defect and a malformed-category validation defect. The ordinary backend suite also needs better cache isolation. Adviser review, manuscript reconciliation, independent evaluation/UAT, and verification of the intended hosted release remain necessary.

The October 17 review is useful history, but its open scoring, timer, catalog-validation, recovery and session findings are no longer an accurate description of all current behavior. Conversely, the later checklist's checked local acceptance tasks are not sufficient to dismiss the newly reproduced findings.

This is a new review, separate from the earlier reviews and execution checklist. No application source, original PDF, previous report, acceptance checkbox or production record was changed. The supplied PDFs were used as requirements and evidence, not as authorization to execute their proposed actions. Only synthetic disposable databases were used for new verification. No hosting, live Google/email/Storage operation, production migration, recommendation repair, commit or push was performed.

## Scope and source identity

Base Git revision: `effb2a8`, with substantial existing modified and untracked application files. A commit hash alone does not identify the tested working tree. [source-inventory.json](source-inventory.json) records file hashes, counts and top-level Python definitions for the inspected source snapshot.

Four files changed externally during this review: `api/suggestion_catalog.py`, `api/test_suggestion_catalog.py`, `components/admin/SuggestionCatalogDialog.jsx` and `tests/nlp_previews_playwright.py`. The initial inventory is retained rather than silently overwritten. [source-inventory-final.json](source-inventory-final.json) records the closing observation. The 316-test full-suite result belongs to the earlier working-tree run, not an immutable final release. Late catalog changes received focused follow-up checks; a release must run its own complete checks after source is frozen.

Late follow-up: catalog module **11 discovered, 9 passed, 2 PostgreSQL-only skips** under isolated SQLite; fresh lint/build passed; all **10 catalog/preview browser groups passed again with zero page errors**. The update generates permanent internal catalog IDs for authors rather than requiring typed IDs/source notes. Existing/reference ID semantics remain covered. This targeted rerun does not establish another complete PostgreSQL acceptance run for the late snapshot. Closing inventory: 311 files, 45,448 lines.

The repository-wide inventory and pattern/AST scan covers **311 files and 45,417 lines**: 193 application/configuration files, 19 migration files including the initializer, and 99 test/browser-fixture files. Dependencies, local runtimes, generated artifacts, populated environment files and archived experiment copies are excluded. Python source was parsed; frontend lint/build cover frontend syntax and bundling. Inventory does not mean every line received equal manual scrutiny.

Manual tracing concentrated on the following boundaries:

| Area | Code and behavior examined | Evidence and limits |
| --- | --- | --- |
| Authentication and roles | `views.py` login/Google/register/refresh; `authentication.py`, `backends.py`, `admin_accounts.py`; frontend session, Axios and route guards | Backend role/account rechecks; verified institutional Google identity; admin password; renewal and account isolation. Real Google origins/provider login not exercised. |
| Enrollment and profiles | Batch endpoints, `enrollment_import.py`, identity constraints, profile validation, enrollment modal/parser | Preview/token revalidation, row outcomes, duplicate identities, archive gates and post-commit notifications. Actual provider delivery not tested. |
| Assessment authoring and imports | Creation/edit/add/delete callers, parsing, `assessment_authoring.py`, question layout and publication checks | Parent assessment locks, classified valid questions, edits blocked after attempts; accepted local question format. Unseen official LMS export parity remains separate. |
| Attempts and scoring | Start/submit/stop/retake, `scoring.py`, `attempt_timing.py`, student assessment page | Unique owned answer IDs, authoritative denominators, exact normalized identification, grace/stop state, retained drafts and history. Browser monitoring is not proof against OS-level cheating. |
| Combined evidence | `assessment_progress.py`, `combined_competency.py`, management serializers | Eligible submitted/nonflagged evidence, summed raw/max, active batch and required completion; historical evidence distinct from final profile. |
| Ranking and NLP | Runtime ranking/text helpers/configuration/evaluation, candidate corpus, component serialization | 60/25/15, TF-IDF cosine, actual-model/fallback handling, no-evidence abstention, location handling. New confirmed-input/evidence previews remain outside production ranking. |
| Catalog and placement | Company/position mutations, validation, branding, placement approval/manual assignment/status, constraints | Transactional validation, parent/position/student locks, one approved placement, capacity and snapshots. Catalog freshness defect confirmed below. |
| Dashboards and reporting | Management/placement report queries, analytics, capacity/area separation, frontend report helpers | Role/batch scope, Philippine dates, snapshot fields and formula escaping have regression coverage. No new visual review of every exported report. |
| Frontend infrastructure | Route lazy imports, hooks, query store/cache, renewal, invalidation and SSE clients | Request deduplication, identity isolation, visible revalidation and error/retry. Fifteen selected browser groups rerun; not a new complete three-role or physical-device acceptance campaign. |
| Operations and schema | Models, migrations, settings, requirements, Procfile, CSP, health, email queue and event transport | Migration drift clean; disposable PostgreSQL races pass. Provider policies, live migration state, Linux image, actual headers, recovery and uptime not independently inspected. |

Applied project skills: assessment review, recommendation audit, Vite-applicable React practices, webapp testing; Supabase/PostgreSQL guidance for local storage/database boundaries; PDF workflow for the supplied requirements and output report. No external product/security/version assertion is used to certify the hosted system.

## Confirmed findings

### R01 High priority stale recommendations remain approvable after requirement edits

**Impact:** staff can approve a recommendation whose saved score no longer represents the position's requirements, then preserve that obsolete value in the assignment snapshot.

Relevant code: [position edit](../../../skillbridge-backend/api/views.py#L3572), [company edit](../../../skillbridge-backend/api/views.py#L3446), [instructor company edit](../../../skillbridge-backend/api/views.py#L2683), [approval check](../../../skillbridge-backend/api/views.py#L4207), [combined validity](../../../skillbridge-backend/api/combined_competency.py#L40), [catalog event topics](../../../skillbridge-backend/api/change_events.py#L30).

The position PATCH replaces requirements but neither marks matching rows noncurrent nor recomputes them. `combined_is_unlocked` checks completion, active batch, finalization and assessment IDs; it does not compare the catalog inputs against the saved ranking. Events refresh GETs, but rereading a saved result does not repair its provenance. Company coordinates/titles/tags have analogous unversioned paths by code inspection; the independent runtime reproduction specifically changed requirements.

| Synthetic step | Observed result |
| --- | --- |
| Complete required assessment with Programming evidence; rank a Programming position | Saved match 92.50% |
| Admin changes requirement to Networking | PATCH 200; requirement persists |
| Student fetches final results again | GET 200; results unlocked; old recommendation still current and 92.50% |
| Admin approves that recommendation | POST 201; assignment snapshot stores 92.50% |
| Explicitly recalculate against the new requirement | Match changes to 32.50% |

The probe fixes NLP similarity at 100% with a deterministic mock and uses missing-location neutral similarity. It isolates the category change and does not claim these numbers are actual student results. See [issue-observations.json](issue-observations.json) and `verify_review.py probes`.

**Closure:** invalidate or version every ranking-affecting catalog mutation; reject approvals using obsolete inputs; recompute through a deliberate supported path and keep placement history immutable. Verify edit -> student/staff GET -> attempted approval -> refreshed score, including empty requirements and company coordinate changes. Do not treat SSE/cache invalidation as recomputation. Until corrected, freeze ranking inputs during a demo and explicitly rerun before reviewing/approving matches; this is a temporary operating precaution, not defect closure.

### R02 Medium priority shared category creation bypasses strict field validation

Relevant code: [categories](../../../skillbridge-backend/api/views.py#L824), especially line 835, versus the separately validated admin skill mutation path.

`request.data.get('name', '').strip()` executes before checking the value's type. A staff POST to `/api/categories/` with `name` equal to null, an array, a number or an object returns **HTTP 500**, rather than a field-level 400. Four synthetic requests reproduced this; no category was inserted. This is an input robustness issue, not a demonstrated access-control bypass.

**Closure:** share the strict skill/category input contract across both entry points, validate name length and description/tags before writes, and add direct API malformed-field tests. Verify both instructor and admin callers and retained authoring drafts. Do not describe all mutation validation as complete until this path is covered.

### R03 Medium priority documented full-suite command has throttle-cache contamination

Relevant code: [test settings](../../../skillbridge-backend/core/test_settings.py), `REST_FRAMEWORK` throttles in [settings](../../../skillbridge-backend/core/settings.py), and multiple APITestCase fixtures that reuse low user IDs after database resets without clearing the shared cache.

The ordinary full command discovered 316 tests and finished with **54 failures, 10 errors and 16 skips**. Failures included expected 200/400/409 replaced by 429; downstream errors were missing expected response fields. Running the same suite with a review-only runner that clears Django cache at each test boundary passed **300 tests with 16 SQLite-only skips**, and then **316/316 on disposable PostgreSQL with zero skips**. Throttles remain enabled within each test, including explicit login-rate-limit assertions.

**Interpretation:** the observed suite-wide failures are test isolation problems, not 64 independently demonstrated application defects. However, an unqualified statement that the ordinary documented command passes is currently false. The corrected runner is diagnostic evidence, not a committed repair to the project's test setup.

**Closure:** isolate/reset throttle state in the supported test runner or common setup, preserve real throttling tests, and rerun the unmodified documented command in CI. Do not disable production throttles to make tests pass.

## Fresh verification on 20 October

| Check actually performed | Result | Qualification |
| --- | --- | --- |
| All frontend `src/**/*.test.mjs` with bundled Node | **122 passed, 0 failed, 0 skipped** | Unit/contract tests, not UAT |
| Installed ESLint CLI over frontend | **Passed; no diagnostics** | Same underlying check as lint script; direct CLI avoids the known local npm shim issue |
| Installed Vite production build | **Passed; 402 modules** | Build emitted plugin timing advice; build success does not verify hosted headers/integrations |
| Django check, isolated SQLite settings | **Passed** | No normal dotenv/database |
| `makemigrations --check --dry-run`, isolated settings | **No changes detected** | Model/migration consistency, not production migration status |
| Ordinary backend suite | **316 discovered; 54 failures, 10 errors, 16 skips** | Shared throttle-cache contamination; retained as failed evidence |
| Full backend with cache isolated between tests, SQLite | **300 passed, 16 skipped** | PostgreSQL-only checks intentionally not certified by SQLite |
| Full backend with same isolation, PostgreSQL | **316 passed, 0 skipped** | Disposable `test_skillbridge_independent_20261020`, localhost only, created/destroyed by Django |
| Recommendation browser fixture | **5 grouped scenarios, zero page errors** | Mocked API/maps: ranked, locked, empty, failed and malformed-result recovery |
| Catalog/position preview browser fixture | **10 grouped scenarios, zero page errors** | Real local React/Django/SQLite; remote calls blocked; SSE delivery adapted by fixture |
| Additional diagnostic probes | **Two issue observations reproduced** | They assert observed defects, not successful product acceptance |
| Strict actual spaCy Medium preprocessing | **requested=actual=spacy_md; no fallback; nonempty output** | One text, 19.672 seconds including load while other work ran. Not an HTTP/performance benchmark or evidence of meeting prior latency targets |

Some initial verification attempts failed: sandboxed loopback PostgreSQL access; a server not persisting across command boundaries; an independent-reader subprocess launched outside the backend directory; and a first browser navigation timeout. The successful PostgreSQL run restored the required backend cwd and kept cluster start/test/stop together. The browser rerun exercised the local Vite server from the first helper attempt; its orphan child was identified by exact command and stopped afterward. None of these failed attempts is counted as a pass. No test assertion or application source was weakened.

Review evidence is retained in `tmp/pdfs/review_2026_10_20/`; a portable compact summary and source hashes are included alongside this report. This fresh review does **not** rerun the previous large performance benchmark, backup restore, all browser scripts or all notebook cells. Those remain historical evidence in their dated knowledge files.

## Current position against the study objectives

| Objective | Current support | What remains for defense |
| --- | --- | --- |
| 1 Manage project data | User/batch/profile/company/position/assessment/recommendation/placement models and role APIs implemented | Demonstrate intended hosted release and schema; accept operational procedure |
| 2 Skills tests and classification | Three question types, imports, category assistance, randomized layouts, scoring, retake snapshots and combined evidence | Adviser validation of intended LMS format and scoring policies; present independent task evidence |
| 3 Compare three preprocessors and select one | Comparison code and saved experiments exist; strict Medium resource loads locally | Reconcile manuscript Small selection, configured Medium default and experiment timing/corpus differences; do not infer scientific model superiority from fixture parity |
| 4 Hybrid recommendations | Runtime uses category 60%, NLP 25%, location 15%, stored components and completion gates | Correct R01; freeze/explain evaluation protocol and independent relevance criteria; demonstrate refreshed hosted results |
| 5 Dashboards and reports | Role dashboards, capacity/area analysis, company/student placement reports and PDF/XLSX/CSV helpers | Adviser validation of agency/area interpretation and report samples; genuine UAT and hosted downloads |

All five objectives have implementation evidence. This is not a finding that all five are accepted or that the system is 100% complete.

## Functional requirements from the revised paper

PDF page references below are physical PDF pages, not printed chapter numbering.

| FR | Requirement summary from PDF pages 28–30 | Current code assessment |
| --- | --- | --- |
| 1 | Authentication and roles | Implemented, but paper's instructor email/password wording conflicts with current DNSC Google login; admin uses individual password. |
| 2 | Student profiles | Implemented with own-profile validation and location. |
| 3 | Batches and enrollment | Implemented with preview/revalidation, IAMS-compatible fields and automatic approved student creation. |
| 4 | Companies, positions, slots, requirements and tags | Implemented with transactional validation/capacity checks; R01 affects ranking after edits. |
| 5 | Three question types and bulk Excel import | Implemented; accepted application format verified, exact official LMS export comparison separate. |
| 6 | TF-IDF question-category assistance | Implemented as advisory suggestion with manual confirmation/abstention, not infallible classification. |
| 7 | Answering and grading | Implemented; identification is exact after trim/lowercase, without semantic synonym grading. |
| 8 | Category percentages and structured profiles | Implemented; full-question denominator and summed eligible raw/max across assessments. |
| 9 | Generated profile/position text | Implemented from current category scores/requirements/tags. Confirmed duty/item evidence previews are newer separate work, not active production text replacement. |
| 10 | NLP preprocessing, TF-IDF and cosine | Implemented with strict comparison and explicit runtime fallback identity. Medium embeddings are not the runtime similarity method. |
| 11 | Category/text/location ranking | Implemented 60/25/15; R01 must be addressed for post-edit correctness. |
| 12 | Ranked student recommendations and map | Implemented with locked/empty/retry states and coordinate handling; live map provider not verified by local adapters. |
| 13 | Role dashboards and reports | Implemented; local regression and selected browser evidence exist; new formal acceptance outstanding. |

## Nonfunctional requirements from PDF pages 30–31

| NFR | Assessment |
| --- | --- |
| Performance | Earlier dated local workload evidence exists. This review adds no hosted latency or new load acceptance result. One cold model probe is not comparable to end-to-end warm request timing. |
| Reliability | Local transactions, recovery paths and concurrency checks exist. Paper promises automatic failover; the handoff only establishes a manual recovery plan and local rehearsals. Actual failover/host recovery is unverified. |
| Usability | Responsive screens and selected browser recovery scenarios pass. No supplied genuine participant questionnaire/task results establish user acceptance. |
| Security | Backend role/account and batch checks are present and regressions pass. This is not an independent penetration test or certification of Supabase/Data API/Storage policies or deployed TLS. |
| Compatibility | Selected local Chrome and responsive fixtures pass; prior matrix is historical evidence. No new physical-device or every-browser acceptance statement. |
| Maintainability | Helpers and tests are extensive, but `views.py` remains 4,849 lines and several screens exceed 1,000 lines. Refactor after stabilizing behavior; do not expand defense scope merely to reduce file sizes. |
| Scalability | Schema allows adding records; prior accepted local workload is bounded. Neither arbitrary growth nor unchanged recommendation accuracy is established by this review. |
| Availability/session | Eight-hour access and seven-day refresh configuration with frontend renewal exist. Token lifetime is not a guarantee of uptime; real provider/host monitoring remains pending. |

## Paper and evidence reconciliation

1. **Login methods:** revise FR1 and security-plan text to describe instructor/student DNSC Google plus administrator password, if the adviser accepts the current contract. Do not change working auth merely to match old prose.
2. **Selected model:** PDF pages 72/74–75 choose Small; current default is Medium. A default and a successful local load are implementation facts, not a resolved experimental selection. Use one adviser-reviewed selection rationale tied to an identified run and actual resources.
3. **Similarity method:** the code preprocesses text then computes TF-IDF/cosine. It does not rank using spaCy Medium's dense word vectors. Identification grading does not use model-based semantic matching.
4. **Interpret metrics correctly:** the paper lists NLP-only Top-1 93.00% and hybrid 89.33%. These tables do not establish that the hybrid is more accurate. Top-3 hit rate is not precision at three. Synthetic expected roles are not actual placement success, independent expert judgments, UAT results or completion percentages.
5. **Separate newer experiments:** reviewed-input offline v1 uses 17 fictional cases, 16 labeled designer targets and one zero-evidence diagnostic. Its controls do not justify activating the new text pipeline. `NLP_OFFLINE_REVIEWED_V1.md` explicitly defers activation; production still uses the original generated text and weights.
6. **Runtime evaluation differs:** admin evaluation uses the prepared 60-case synthetic dataset/6 positions and current text helpers; the older paper tables concern another saved experiment. Do not substitute one run's scores or processing time into another description.
7. **Operations claims:** automatic failover, actual provider backups/rollback, deployed OAuth/maps/email/branding and formal UAT require evidence outside repository feature presence. The release handoff also still references base `227f794` and migration `0015`; current source base is `effb2a8` and local migrations extend to `0018`. Reconcile the exact release commit and migration plan before following that handoff. This review did not query live migration state.
8. **Minutes:** the attached action column mixes completed revisions with future plans. [PANEL_ACTION_MATRIX.md](PANEL_ACTION_MATRIX.md) supplies updated proposed wording for all 17 entries. Blank signature/date fields are not acceptance evidence. Preserve the original minutes and seek adviser confirmation of any replacement copy.

## Priorities before 9–10 November

| Proposed window | Work | Evidence needed |
| --- | --- | --- |
| 21–25 October | Adviser walkthrough using June 2 action matrix; confirm LMS sample, agency/area interpretation, model evaluation and UAT plan | Actual meeting notes and decisions; no invented approval |
| 21–27 October | Correct R01/R02 and test runner isolation | Direct API regression tests, normal full-suite pass and refreshed decision flow; preserved history |
| 26–30 October | Reconcile paper/minutes and prepare exact release | One consistent auth/model/method explanation; release identity, migrations, operator checklist and synthetic demo fixtures |
| 31 October–3 November | Verify intended hosted release/integrations/recovery | Real origins, headers, model metadata, maps/images/email if in scope, SSE, exports, backup/rollback and restart evidence |
| 4–6 November | Conduct genuine acceptance tasks/questionnaire and close material feedback | Actual participant records/results under approved approach; defect retests |
| 7–8 November | Final readiness decision and rehearsal | Complete role demo, report samples, remaining-issue disclosure and contingency demo |

These are proposed targets, not confirmed bookings or guaranteed completion dates. Hosting remains a later owner-authorized action; this review has not deployed anything.

The pre-existing checklist records **24/28** tasks closed, with **V05, V09, V10 and S02** open. That fraction is a historical task count, not a percentage of research completion, current correctness, adviser acceptance or deployment readiness. R01/R02 require follow-up against the related local acceptance criteria. This independent review intentionally leaves the authoritative execution checklist untouched.

## Recommended report statement

“SkillBridge has implemented its major student, instructor and administrator modules and is undergoing final validation and deployment preparation. Local automated and selected browser checks support the implemented workflows. The latest independent review identified recommendation freshness and category-validation issues for correction. Adviser review, manuscript alignment, user acceptance evaluation and hosted operational verification remain scheduled before the November 9–10 pre-deployment defense.”

Use [PROGRESS_REPORT.md](PROGRESS_REPORT.md) for the institutional section structure and [PANEL_ACTION_MATRIX.md](PANEL_ACTION_MATRIX.md) for the next adviser discussion. Neither document claims that a passing suite establishes a defect-free release.

## Source documents and evidence locations

- User-supplied `C:/Users/acer/Downloads/Progress Report.docx.pdf`: one-page institutional report structure, rendered and inspected; used for the new report's letterhead and sections.
- User-supplied revised SkillBridge manuscript PDF in Downloads: 88 pages extracted/searched; objectives on PDF page 8, requirements on pages 28–31, model tables on pages 72/74, testing/implementation/UAT on pages 75–79 and security plan on page 80 reviewed. This was not visual proofreading of every manuscript page.
- User-supplied `C:/Users/acer/Downloads/1. Defense-Minutes-2026-Format-1.docx (1).pdf`: all three pages read and rendered/inspected; 17 comments mapped individually.
- Previous review/report/checklist in `outputs/defense-review/`; current project overview and task-relevant knowledge files, especially submission integrity, recommendation contract, capacity/areas, import format, setup/operations, local workflow/performance, release/recovery and NLP audit/runtime/offline decision.
- New [verification-summary.json](verification-summary.json), [issue-observations.json](issue-observations.json) and source inventories; raw local logs/renders under ignored `tmp/pdfs/review_2026_10_20/`.
