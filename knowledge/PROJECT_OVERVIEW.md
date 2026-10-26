# SkillBridge Project Overview

SkillBridge is a web-based On-the-Job Training placement decision support system
for Davao del Norte State College (DNSC). Students complete skill assessments;
instructors manage assessments and batches; admins manage companies, positions,
users and placement workflows. Recommendations support placement decisions.

## Architecture

| Area | Implementation | Entry points |
| --- | --- | --- |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Axios | [App.jsx](../skillbridge-frontend/src/App.jsx), [Axios client](../skillbridge-frontend/src/api/axios.js) |
| API and authentication | Django 6, DRF, JWT, Google authentication integration | [Routes](../skillbridge-backend/api/urls.py), [views](../skillbridge-backend/api/views.py) |
| Persistence | PostgreSQL; Django models and migrations | [Models](../skillbridge-backend/api/models.py), [settings](../skillbridge-backend/core/settings.py) |
| Assessment scoring | MCQ, true/false and identification; per-category raw, maximum and percentage scores | [Scoring](../skillbridge-backend/api/scoring.py) |
| Combined competency | Batch-scoped totals from eligible assessment evidence and required completion gates | [Combined competency](../skillbridge-backend/api/combined_competency.py), [progress rules](../skillbridge-backend/api/assessment_progress.py) |
| Recommendations | Category cosine similarity, NLP TF-IDF similarity and location similarity | [Ranking](../skillbridge-backend/api/scoring.py), [NLP helpers](../skillbridge-backend/api/recommendation_nlp.py) |

Dependency manifests are [package.json](../skillbridge-frontend/package.json),
[requirements.txt](../skillbridge-backend/requirements.txt) and
[optional NLP requirements](../skillbridge-backend/requirements-nlp.txt).

## Main data flow

1. An instructor creates batch assessments, questions, answer choices and skill categories.
2. An enrolled student starts and submits an assessment; backend access and attempt-state checks control submission.
3. The backend grades answers and stores assessment-level `SkillScore` rows.
4. Combined competency aggregates eligible category raw and maximum totals across assessments; it does not simply average percentages.
5. Required completion and active-batch gates control finalization and recommendation visibility.
6. Ranking combines category, NLP and location similarity. The current implementation uses weights of 60%, 25% and 15%; inspect current code when auditing rather than assuming these remain fixed.
7. Placement approval applies additional rules and saves snapshots. A high recommendation score alone does not establish approval eligibility.

## Frontend data freshness

Authenticated GET views use the shared `useApi` cache, which keeps last-good
data in memory and session storage for immediate repeat navigation. Mounted
queries revalidate about every 30 seconds while the tab is visible and when
the user returns to it. Admin, approved instructor and enrolled/approved student
SSE streams consume recipient-scoped database invalidations published after
complete successful operations commit. Streams check the event log about once
per second; reconnection resynchronizes active live queries. The visible-page
fallback also handles availability changes caused by time passing. Mutation
responses or local state update the acting user's view, then
the affected GETs reconcile with the server. Cache and prefetch state are reset
at login and logout. Generated reports/comparisons remain explicit snapshots and
show possible staleness rather than automatically rerunning. The server still
decides assessment and placement access. See [live data freshness](LIVE_DATA_FRESHNESS.md)
for the coverage map, transport/configuration, verification and deployment limits.

Sign-in stores the authenticated session and prepares essential dashboard code/data
in parallel for up to 1.5 seconds before handoff. Pending/setup routes bypass this
step; slow reads continue in the same cache behind section skeletons. A two-slot
background queue then prepares likely next destinations without gating foreground
navigation. See [dashboard-first loading](DASHBOARD_FIRST_LOADING.md).
See [navigation and loading](NAVIGATION_LOADING.md) for every route's request
coverage, lifecycle protections, local measurements and verification limits.

NLP models are optional and loaded lazily. The implementation has deterministic
regex preprocessing when optional models are unavailable; record the actual model
and fallback when explaining results.

## Existing knowledge

- [Dashboard-first loading](DASHBOARD_FIRST_LOADING.md): Bounded dashboard
  preparation after authentication, two-slot background warming, foreground
  priority, session-safe cancellation and synthetic verification.

- [Section loading presentation](SKELETON_LOADING_UI.md): Initial placeholders
  matched to metrics, cards, lists, charts, assessment questions and dialogs;
  persistent controls, responsive geometry and retained background content.

- [Shared dropdown presentation](SHARED_DROPDOWNS.md): System-wide native select
  audit, modern field/picker styling, accessible labels, light/dark and touch
  presentation, native browser fallback and focused interaction verification.

- [Assessment editing and timing](ASSESSMENT_LIFECYCLE_AND_TIMING.md): Used-content
  locks, deadline-capped attempt snapshots, audited extra time, safe draft copies
  and migration 0024.

- [Assessment archives](ASSESSMENT_ARCHIVES.md): Shared instructor/admin archive
  pages, reversible read-only lifecycle, preserved history and staged question imports.

- [Shared placement suggestions](PLACEMENT_DRAFT_IMPLEMENTATION.md): Company-first
  staff workflow, shared provisional allocation using existing tables, capacity,
  permissions and rollout.

- [Placement collection redesign](PLACEMENT_COLLECTION_UI.md): Approved company,
  allocation and decision-history concepts implemented for both staff roles,
  responsive details/collections, company position review with eight-student
  candidate pages and preserved workflow verification.

- [Staff analytics implementation](ANALYTICS_IMPLEMENTATION.md): Role-specific
  linked dashboard cards, scoped Reports & Analytics, chart drill-downs, snapshot
  exports, student card/list views with shared eight-student pages, completion
  and attempt panels with direct drill-downs, a Skills count matrix and separate
  company-match filters, area-filtered placement/slot panels, simpler batch/slot
  terminology, monthly-default submission activity with daily/weekly/yearly/all-time
  presets, recorded activity/history limits and local verification.
- [Approved dashboard and analytics plan](DASHBOARD_AND_ANALYTICS_PLAN.md): Design
  rationale, metric definitions and historical-snapshot boundary.

- [Dashboard highlights](DASHBOARD_HIGHLIGHTS.md): Shared clickable top matches,
  skill leaderboards and student details for admin/instructor dashboards; frontend
  evidence presentation, role scopes and synthetic responsive checks.

- [Student profile details](STUDENT_DETAIL_MODAL_REDESIGN.md): Shared five-tab
  instructor/admin modal, approved visual concepts, responsive phone/tablet layouts,
  preserved result/placement meanings and synthetic interaction checks; matching
  admin instructor account cards and responsive editing.

- [Student collection cards](STUDENT_CARD_COLLECTIONS.md): Shared dashboard-inspired
  instructor/admin student cards, combined evidence guards, preserved actions,
  corrected admin pagination and synthetic responsive checks.

- [Shared notification toasts](NOTIFICATION_TOASTS.md): App-wide countdown cards,
  hover/focus/touch pause, modal/fullscreen support, role/action coverage and local
  responsive/dark-mode browser verification.

- [Staff notification reminders](STAFF_NOTIFICATIONS.md): Header bell and grouped
  current action cards, scoped follow-up/placement/approval links, live-query reuse
  and distinct loading/error/empty states.

- [Student notification reminders](STUDENT_NOTIFICATIONS.md): Manila deadline
  windows, current retake/result/approved-placement notices, private staff history
  boundary, shared refresh and reviewed placement/capacity workflow.

- [Release and recovery handoff](RELEASE_AND_RECOVERY_HANDOFF.md): Owner-run
  Vercel/Railway release, safe readiness probe, isolated restore and pending live checks.

- [Accepted question format](QUESTION_IMPORT_FORMAT.md): User-designated current
  Excel/CSV/text contract, verified validation and later official-file follow-up.
- [Production browser policy](PRODUCTION_BROWSER_POLICY.md): Narrow CSP changes
  verified on the local production build; live hosting remains separate.

- [Local performance verification](PERFORMANCE_VERIFICATION.md): Accepted synthetic
  workload, measured bottlenecks, preserved ranking and local timing limits.

- [Browser matrix verification](BROWSER_MATRIX_VERIFICATION.md): Accepted local
  Chrome/Edge and tablet/phone emulation, fullscreen and failure recovery.

- [Local workflow verification](LOCAL_WORKFLOW_ACCEPTANCE.md): Linked real
  three-role API/browser lifecycle and current-format scope limits.

- [Local security verification](LOCAL_SECURITY_REVIEW.md): Direct API access
  boundaries, current-account JWT checks, safe snapshots/logs and hosted limits.

- [Local setup and operations](LOCAL_SETUP_AND_OPERATIONS.md): Tested clean
  runtime, safe example configuration, dependency/model installation and operator guidance.

- [PostgreSQL concurrency verification](POSTGRES_CONCURRENCY_VERIFICATION.md):
  Finalization/capacity/image/authoring locks and independent committed events.

- [Report reconciliation](REPORT_RECONCILIATION.md): Scoped history, known capacity
  totals, Philippine report dates and saved PDF/XLSX/CSV verification.

- [External-service recovery](EXTERNAL_SERVICE_RECOVERY.md): Bounded browser/provider
  calls, truthful map/geocode/photo fallbacks and isolated failure evidence.

- [Validation and recovery audit](VALIDATION_AND_RECOVERY.md): Current mutation
  boundaries, verified failure handling and explicitly unfinished E01 checks.

- [Agency capacity and areas](CAPACITY_AND_AREAS.md): Panel-confirmed slot demand,
  approved deployment counts and separate student-residence metrics.

- [NLP phased implementation](NLP_PHASED_IMPLEMENTATION.md): Phase-by-phase
  agent handoff, preview-only first changes, verification gates and a copyable
  Phase 1 prompt; later ranking activation remains a separate task.

- [NLP rollback](NLP_ROLLBACK.md): User-cancelled improvement work, restored
  original application behavior and cleanup of experiment storage; see the
  [checkpoint](NLP_IMPLEMENTATION_CHECKPOINT.md) for migration/verification status.

- [Question assistance](QUESTION_ASSISTANCE.md): Advisory suggestions, staff
  permissions, manual fallback and evidence-grounded generated text.

- [Position-tag relevance](POSITION_TAG_RELEVANCE.md): Network Specialist aliases
  and exclusion of broad Tools products from position suggestions; saved tags and
  original category/matching rules preserved.

- [General position-suggestion proposal](POSITION_SUGGESTION_DESIGN.md): Verified
  hard-coded versus database tag precedence and proposed role/category compatibility,
  provenance and explicit tool selection across roles; not yet implemented.

- [Expanded suggestion vocabulary](NLP_SUGGESTION_VOCABULARY.md): Restored35 category
  lists/33 role profiles with generic Tools exclusion retained; category/role
  suggestions require review and do not rewrite saved tags automatically.

- [NLP design decision](NLP_DESIGN_DECISION.md): Proposed evidence-based input
  contracts, matching/model boundaries, notebook comparison review and copyable
  paper revisions; separates completed simulations from future integration.

- [Recommendation contract](RECOMMENDATION_CONTRACT.md): Preserved weights,
  coordinate validation, stable ranking, eligibility boundaries and isolated tests.

- [Saved recommendation freshness](RECOMMENDATION_FRESHNESS.md): Catalog/model/pin
  provenance, stale-result locks, explicit refresh, legacy migration and preserved
  score/placement history.

- [Offline NLP feature experiment](NLP_PROPOSAL_EXPERIMENT.md): Colab comparison
  of automatic task descriptions and question-level evidence, with simulation
  limitations and same-evidence structured controls; no application changes.

- [NLP runtime verification](NLP_RUNTIME_VERIFICATION.md): Actual local selected
  model load, explicit fallback/comparison behavior and truthful empty-result
  model reporting.

- [NLP improvement plan](NLP_IMPROVEMENT_PLAN.md): Consolidated proposed automatic
  position descriptions, question-level evidence, evaluation protocol and paper
  revisions; distinguishes implemented behavior from future work.

- [Colab NLP evaluation](NLP_COLAB_EVALUATION.md): Standalone notebook using
  current text helpers, structured-only and preprocessing comparisons, error
  diagnostics, independent-test protocol and transfer-to-system limits.

- [Authentication and recovery](AUTHENTICATION_AND_RECOVERY.md): Agreed role
  sign-in methods, verified identity and active-account gates, pending onboarding
  and truthful queued notifications.

- [Catalog validation and recovery](CATALOG_VALIDATION.md): Atomic company and
  position edits, capacity and requirement bounds, protected history and retained
  drafts after failure.

- [Assessment submission integrity](ASSESSMENT_SUBMISSION_INTEGRITY.md): Full
  question denominators, atomic answer validation, empty submissions and the
  historical-data boundary.

- [Background recommendation proposal](ASSESSMENT_BACKGROUND_RECOMMENDATIONS_PROPOSAL.md):
  Prompt score visibility, queued recommendation states, Railway Hobby worker/cost
  assumptions and 100–150-question concurrency verification; not yet implemented.

- [Assessment result presentation](ASSESSMENT_RESULT_PRESENTATION.md): Exact
  highest-score ties, shared student/staff summaries, category-based guidance,
  bounded single-column student skill cards, export consistency and the preserved
  NLP boundary.

- [Collection UI skill](../.agents/skills/skillbridge-collection-ui/SKILL.md) and
  [reference](../.agents/skills/skillbridge-collection-ui/references/COLLECTION_UI_REFERENCE.md): Instructor-inspired
  search/filter toolbars, table and card views, pagination, visual conventions
  and acceptance guidance for collection sections. Visual recipes are optional;
  prioritize readable typography, spacing and the current brief. Useful UI libraries
  are permitted. See the October 20 readability update in the reference.

- [Student company browsing](STUDENT_COMPANY_BROWSING.md): Compact recommendation
  cards grouped by company, positions ranked within company details, suggested
  position wording and prominent coordinator decision guidance.

- [Admin assessment oversight](ADMIN_ASSESSMENT_OVERSIGHT.md): Paginated card/list
  views, shared category pills and modal settings, protected management drafts,
  lazy modal sections and synthetic UI checks.
- [Instructor assessment library](ASSESSMENT_LIBRARY_UI.md): Light/dark assessment
  cards and list, dashboard-style view switch, secondary filters, shared pagination
  and labeled report controls.

- [Instructor/admin capability review and plan](ROLE_CAPABILITIES_REVIEW_AND_PLAN.md):
  Current UI/API access matrix, missing admin authoring and batch workflows,
  ownership/scope inconsistencies and a proposed implementation sequence.

- [Admin management implementation](ADMIN_MANAGEMENT_IMPLEMENTATION.md): Shared
  authoring, admin batch/instructor assignment, scoped unenrollment, audit history,
  migration 0021, local verification and resumable checkpoint.

- [Admin batch collection](ADMIN_BATCH_COLLECTION_UI.md): Approved batch cards,
  focused student roster, shared card/list toggles, full-row navigation and
  centered confirmations for management decisions.

- [Database connection troubleshooting](DATABASE_CONNECTIONS.md): Local startup
  stalls, bounded PostgreSQL connection waits and Supabase access checks.

- [Company branding and student photos](PROFILE_IMAGES.md): Optional optimized
  WebP company images, backend-only Storage setup, provider-photo coverage,
  lifecycle rules and isolated verification.

- [IAMS enrollment import](IAMS_ENROLLMENT_IMPORT.md): Shared instructor/admin
  review workflow, institutional ID mapping, identity constraints, email dispatch
  configuration, isolated verification and controlled live-test restrictions.

- [Master project context](../refs/SKILLBRIDGE_MASTER_CONTEXT.md): Broad background and historical status; some details predate the current code.
- [Entity relationship reference](../refs/SkillBridge_ERD.md): Database design reference.
- [Data flow reference](../refs/SkillBridge_DataFlowDiagram.md): System process reference.
- [Capstone defense reference](../refs/CAPSTONE_DEFENSE_REFERENCE.md): Presentation context.
- [Skill sources and demonstration prompts](SKILL_SOURCES.md): Original versus downloaded skills, provenance and examples.
- [Agent instructions](../AGENTS.md): Development conventions and verification commands.

## Assignment deliverables

The skill documentation covers original SkillBridge review workflows, the local
`skillbridge-collection-ui` design workflow and downloaded skills from Vercel Labs,
Anthropic and Leonxlnx, including `frontend-design`
for UI work and experimental `design-taste-frontend` for public landing-page work.
Taste Skill's upstream scope excludes dashboards and dense product UI.
`AGENTS.md` and the knowledge files are
supporting documentation, separate from the minimum four-skill requirement. Original workflows
were generated with Codex for the SkillBridge project; external workflows retain
their original authorship. This setup changes documentation and skill packages,
not application code.
