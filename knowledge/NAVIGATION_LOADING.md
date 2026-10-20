# Authentication, route loading and background preparation

20 October admin management follow-up: `/admin/batches` prepares the batch list
and loads eligible instructor choices in the foreground. Selected rosters and
explicitly requested action history load separately. `/admin/assessment/create`
reuses creator reference reads. Question authoring is lazy-loaded on explicit
entry; keys remain outside automatic navigation preparation. See
[implementation](ADMIN_MANAGEMENT_IMPLEMENTATION.md).

Implemented and checked locally on 17 October 2026. Measurements below distinguish
synthetic browser delays, local backend execution and production build sizes.
They do not establish deployment login durations.

## Audit and decisions

The original Google and password login handlers awaited `prefetchForRole()` before
navigating. It launched eight GETs for staff and four for students through
`Promise.allSettled`. Failure was swallowed, but navigation still waited for the
slowest request. Pending/setup destinations were selected after that wait.

Staff preparation included unrelated company lists, placement suggestions and
500-row placement history. Admin preparation also included placement analytics
and users. The student preparation URLs `/api/assessments/active/` and
`/api/student/results/` were valid backend endpoints but did not match the current
pages' `/api/assessments/` and `/api/student/results/combined/` keys. The unselected
review URL fetched answer-review data unnecessarily. These endpoints have not
been removed from the API; they have been removed from speculative preparation.

The route tree eagerly imported every role's pages, including enrollment/XLSX
code. The baseline production entry was 1,388.22 kB, 388.39 kB gzip. This supported
splitting page modules. A first implementation also demonstrated the cost of
loading a new page module after warming only its data in Vite development mode.
Preparation now includes likely page modules, even when their GET data is fresh.
The browser's existing ESM loader deduplicates code; no second data cache is used.

Missing API values were sometimes rendered as zero counts or empty lists.
Reports coupled independent summary/placement requests behind one spinner;
placement content similarly coupled suggestions and history. The changed pages
use section skeletons and retryable errors, and retain cached content during
transient refresh failures. Editors keep their draft state outside these read
boundaries. Restricted question loading has its own retry and selection-race
guard; a failed question read cannot enable saving an empty question draft.
Optimistic user/company lists and selected batch rosters keep their initial
placeholder until the first normalized response is applied. Later refreshes keep
the prior list, including a previously empty list, instead of flashing skeletons.

The existing cache already handled in-flight deduplication, persistence,
invalidation versions and identity epochs. Those protections remain. Store
observers expose status to loading sections without adding request effects,
refresh timers or SSE connections. Shared-store imports use one explicit module
path. Browser probes use the existing hook utilities, avoiding duplicate module
instances caused by importing a different URL during Vite HMR.

Google userinfo calls lacked connect/read timeouts. They now use `(3.05, 10)`
seconds and return a retryable 503 on transport failure. This is not a promise of
a fixed overall authentication deadline. Password authentication has not changed.
Google authentication still enforces DNSC email, instructor approval, and student
approval/enrollment before issuing tokens. Backend endpoint authorization and
object scoping have not changed. Login does not dispatch email. Google login's
existing change-notification audience queries/publication remain synchronous;
there is no deployment evidence justifying a notification/query rewrite.

## Runtime sequence

1. Successful authentication resets old session work, stores the session and
   immediately selects the existing role/approval/setup destination. Page-data
   failures execute outside the authentication handler.
2. `PrivateRoute` checks token/role and known pending approval before mounting
   protected content. The shell stays available while the page module loads.
   Current-route essential GETs start concurrently with that module download.
   The mounted hooks share those in-flight requests and normal cache entries.
3. Each initial section renders a layout-specific skeleton until its own data is
   available. A successful empty response is distinct from missing data. Errors
   have explicit retry controls. Transient background failures retain content;
   definitive 403/404 responses remove inaccessible data.
4. After the page has mounted and outstanding shared reads have settled, the
   queue prepares one likely destination at a time. Code and a needed GET can
   load together in that slot; fresh GET data is reused without another request.
   Hover/focus promotes queued destinations, and foreground navigation never
   waits for the optional queue. A mounted page adopts a matching in-flight GET.
5. SSE invalidation, the existing 30-second visible-query fallback and tab-return
   reconciliation continue. Preparation never makes an entry permanently fresh.
   Forbidden optional requests are not repeatedly retried. Explicit user retry
   and relevant server changes can request fresh data again.

The safe next-page sets are student assessments/results/profile; instructor
batches/assessments/companies; and admin assessments/skills/companies. Admin users
are loaded on their own route because the current payload contains substantial
student evidence. No rosters, answer keys, placement analytics, reports, exports
or NLP diagnostics are speculatively fetched.

The queue includes role, user ID and session token in its in-memory identity. It
pauses when hidden and on route cleanup, resets on logout/expiry/account change,
and aborts obsolete unobserved Axios requests. Requests adopted by a mounted
consumer survive ordinary navigation. Cache clearing aborts outstanding GETs and
increments its epoch; older completions cannot populate the next session.
Cross-tab identity changes clear old work and replace the role destination.
Already-started browser module imports cannot be aborted; they contain public
application code and cannot publish user data.

Only speculative list GETs receive a 15-second Axios deadline. There is no new
global timeout for assessment actions, uploads, snapshots, diagnostics or SSE.
The queue is absent on setup, pending and assessment-taking routes. Assessment
start/submit/stop, answers, ordering, timers, fullscreen and integrity state retain
their existing lifecycle.

## Complete route and panel coverage

URLs below have the `/api/` prefix. `me` means `students/me/` for students and
`auth/me/` for staff. Staff identity is available from the authenticated session
while its existing header query reconciles. Only initial essential reads are
started during page-code loading; dependent reads still use the page hooks.

| Route | Essential / dependent reads | Deferred / explicit work |
| --- | --- | --- |
| `/student/dashboard` | `students/me/`, `assessments/`, `student/results/combined/`; tiles independent | Map component after its source; no company catalogue GET |
| `/student/setup` | Cached login identity and local form | Address hierarchy, geocoding/map by step; profile PATCH on save; no queue |
| `/student/assessment` | Redirect to assessment list | No separate requests |
| `/student/assessments` | `assessments/`; progress and cards guarded | Navigate to consent/result; no attempt operations in preparation |
| `/student/assessments/:id/take` | Existing `assessments/` check and consent/start flow | Start/submit/stop only through existing actions; no optional queue; initial skeleton/retry only |
| `/student/assessments/:id/results` | `student/results/?assessment_id=:id` | `student/results/review/?assessment_id=:id` only after authorized result; independent review skeleton/error |
| `/student/results` | Combined results and student location; lock/error state guarded | `student/companies/` only when its tab is opened and results are unlocked; maps/previews separate |
| `/student/profile` | `students/me/`; profile skeleton, existing one-time draft seeding | Address lookups/map, save action; refresh does not reseed edits |
| `/instructor/dashboard` | Scoped `instructor/students/recommendations/` and assessment list; independent cards/list | Student and skill dialogs on selection |
| `/instructor/students` | `instructor/batches/`, then selected `batches/:id/students/` | Other rosters only on selection; enrollment preview/commit and retakes on action |
| `/instructor/assessments` | `instructor/assessments/`, batch filters | Selected questions and categories on explicit edit; retry does not reset metadata; upload dialog on demand |
| `/instructor/assessment/create` | Batches, existing assessment order references, categories; independent field placeholders | Suggestions, parsing, upload and publish actions; draft state preserved |
| `/instructor/companies` | Scoped company list | Maps/edit dialogs/NLP previews when opened |
| `/instructor/placements` | Suggestions with `include_history=true&include_placed=true`; history `?limit=500`; independent sections | Reports, detail and decision dialogs, manual assignment on action |
| `/instructor/pending` | Local routing state | No protected reads or queue |
| `/admin/dashboard` | `admin/stats/` and admin student recommendations; independent statistics/list | Recommendation rerun only on action |
| `/admin/users` | `admin/users/` | User/approval/enrollment dialogs on action; enrollment batch list shares cache |
| `/admin/assessments` | Authorized shared staff assessment list | Selected roster and explicitly toggled authorized question key; independent loading/error |
| `/admin/skills` | `admin/skills/` | Saved-taxonomy diagnostics and tag suggestions on action |
| `/admin/companies` | `admin/companies/` | Categories only when a position editor opens; maps/details on demand |
| `/admin/placements` | Same parameterized placement keys as instructor, system-wide server scope | Reports and decision dialogs on action |
| `/admin/reports` | `admin/reports/`, placement analytics and NLP configuration as independent sections | Report filter references after panel mount; generated reports, exports, comparison and taxonomy diagnostics remain explicit snapshots |
| Configuration panel | `admin/nlp-configuration/`, inside reports; no separate route | Save/rerun actions unchanged; local selection not reseeded by refresh |
| Shared shell/profile | Existing deduplicated `me` query, cached identity fallback | Hover/focus queue promotion; menu and sidebar remain usable |
| Detail panels | Existing selected student/evidence data; selected roster where required | NLP text only when expanded; report snapshots are never automatically regenerated |
| Login, unknown paths | Authentication only, or existing login redirect | No protected preparation before success |

Frontend endpoint keys were checked against `api/urls.py`, view permissions and
response construction. Student result/review views select the current user's
eligible evidence. Instructor batch/student/company/recommendation views retain
their ownership scoping. The shared staff assessment list permits admins and
instructors and returns metadata/category names, not answer keys. Admin endpoints
retain admin checks. Placement queries retain instructor batch scope and admin
system scope. No scoring, ranking, eligibility or placement snapshot code changed.

## Measurements and verification

| Role | Auth success → navigation, before → after | Essential content usable after auth, before → after | Landing GETs, before → after | Peak GET concurrency, before → after |
| --- | --- | --- | --- | --- |
| Admin | 1553 → 23 ms | 1693 → 447 ms | 9 → 6 | 8 → 3 |
| Instructor | 1532 → 17 ms | 1610 → 440 ms | 8 → 5 | 8 → 3 |
| Student | 1531 → 11 ms | 1915 → 463 ms | 6 → 3 | 4 → 3 |

| Role | Cold-data assessment visit, before → after | Warm assessment revisit, before → after | All landing GETs completed after auth, before → after |
| --- | --- | --- | --- |
| Admin | 357 → 424 ms | 144 → 196 ms | 1897 → 2374 ms |
| Instructor | 410 → 525 ms | 168 → 190 ms | 1518 → 2345 ms |
| Student | 298 → 416 ms | 112 → 134 ms | 1882 → 319 ms |

| Role | Original login-blocking API batch | New optional API preparation |
| --- | --- | --- |
| Admin | 1509 ms | 1929 ms |
| Instructor | 1507 ms | 1906 ms |
| Student | 1507 ms | No additional GETs; code-only duration not isolated |

These batches contain different endpoint sets; their durations are not a same-work speed comparison.

The final initial production JS graph (entry plus HTML-declared shared module
preloads) totals 338.73 kB, approximately 110.47 kB gzip with standard level-6 compression of
those files locally. The original initial entry was 1,388.22 kB / 388.39 kB gzip.
No hosting/CDN transfer measurement was made. Cold-data page visits did **not**
improve in every sample: chunk/Suspense and local development overhead remain.
Warmed revisits and prompt shell navigation are separate from first-content
readiness; no uniform navigation speedup is claimed.

Optional API concurrency was one in the browser fixture. Admin optional
preparation lasted 1929 ms and instructor preparation
lasted 1906 ms; student landing data already covered the
safe next-page keys and needed no additional optional GETs. Code-only preparation
still ran for useful student destinations. The broader before/after completion
times above include all landing reads; preparation no longer delays navigation.

Isolated backend measurements were **after-only**, five samples each, using a
local SQLite database and PBKDF2 password hashing. Password authentication's median
was 618.48 ms (one query); Google authentication with userinfo fully
mocked had a 7.53 ms median (nine queries, including notification
work). These measurements cannot isolate deployment database, hosting, Google or
network delay, and do not claim faster backend authentication.

Final checks: frontend Node tests **71 passed**; lint **passed with five existing
warnings**; production build **passed**; Django system check **passed**;
`api.tests`, `api.test_auth_deadlines`, `api.test_change_events`: **38 tests,
37 passed and one PostgreSQL-specific test skipped**. Twelve synthetic authentication
cases passed, including setup and pending/error redirects, an obsolete password-session read, and expiry while Google OAuth was in progress. The browser state/route
suite passed 37 checks covering every authenticated page plus ordering, cache, retry, offline,
visibility, drafts, account switching, expiry and restricted-question retry. The
existing live SSE browser suite passed **18 checks with no browser errors** on
synthetic SQLite data. Final `git diff --check` passed.


The mock browser uses a 100 ms authentication response, 180 ms ordinary GETs and
a 1,500 ms unrelated failing endpoint. Google UI is stubbed: human interaction,
Google network time, hosting and PostgreSQL latency are not measured. The baseline
is an ignored copy of tracked frontend sources from commit `5389f09`, served separately with its
own Vite cache; working files were never reverted. The role samples are individual
local observations, not statistically controlled deployment benchmarks.

Cold-data navigation clears the shared cache after preparation finishes, then
navigates through the shell. Warm navigation revisits the same page. The local
Vite code cache is warm for those visits; this is distinct from an uncached
production chunk download. Background preparation can finish later overall
because it intentionally uses a smaller concurrency and fewer endpoints.

Actual API payload transfer volumes and deployment resource compression were not
measured. Build gzip sizes are estimates, not observed network transfer totals.
Local development startup includes Vite transforms and dependency optimization;
its DOMContentLoaded timings are recorded in ignored artifacts and should not be
treated as hosting measurements.

Verification commands use existing dependencies. Frontend tests are selected with
`rg --files -g '*.test.mjs' src` and passed to `node --test`. Browser probes are
`tests/navigation_playwright.py` and `tests/navigation_states_playwright.py` against
local Vite. `tests/freshness_playwright.py` uses the existing synthetic local Django
fixture and checks live SSE, forms, maps and attempts. Tests never contact Google,
send email, use production credentials or write production data.

The final lint rerun used `node node_modules/eslint/bin/eslint.js .`, equivalent
to the package's lint script. The machine's `npm run lint` launcher failed before
running ESLint because its configured `npm-cli.js` was missing; the direct command
passed with the five existing warnings above.

Django checks/tests use `PYTHON_DOTENV_DISABLED=1`, synthetic settings values and
`core.test_settings` (in-memory SQLite). Google transport is mocked. The browser
fixture uses a separate synthetic SQLite file. PostgreSQL cross-worker streaming,
real account sign-in and deployment network behavior remain unverified. Existing
large recommendation, users and placement payloads remain candidates for measured
server-side work; their cost has not been attributed to a particular database or
query without deployment evidence.
Map checks instrument Leaflet state rather than contacting tile/geocoding services.
The active assessment browser check uses a mobile context; native desktop
fullscreen behavior was not exercised. Its fullscreen and attempt logic was not
modified.

## Changed files and purpose

All frontend paths below are relative to `skillbridge-frontend/`.

| File | Reason |
| --- | --- |
| `src/App.jsx` | Lazy routes, shell-preserving boundaries, current-route GET/code overlap and post-mount preparation |
| `src/api/authDestination.js` | Shared synchronous role/approval/setup destination |
| `src/api/cacheStore.js` | Observable status, abort controllers, preserved version/identity races and terminal permission failures |
| `src/api/cacheStore.test.mjs` | Hidden invalidation and forbidden-response regression checks |
| `src/api/queryStore.js` | One adapter for the existing Axios-backed shared store |
| `src/api/preparationQueue.js` | Bounded identity-scoped optional work and code preparation |
| `src/api/preparationQueue.test.mjs` | Role routing, priority, promotion, concurrency, identity, deduplication, invalidation and fresh-code tests |
| `src/api/prefetch.js` | Correct route keys, safe likely-page allowlist, current-page requests and queue lifecycle |
| `src/api/logout.js` | Stop queued work before clearing shared state |
| `src/hooks/useApi.js` | Reuse store adapter; share completed read failures and suppress forbidden fallback retries |
| `src/router/PrivateRoute.jsx` | Known pending approval redirect; remove obsolete prefetch documentation |
| `src/router/preloadPage.js` | Native module preparation for likely destinations |
| `src/context/SessionContext.jsx` | Establish successful sessions consistently, supersede obsolete expiry and reconcile cross-tab identities |
| `src/components/layout/AuthenticatedShell.jsx` | Promote navigation intent without blocking links |
| `src/components/DataSection.jsx` | Accessible section skeletons, retry and last-good rendering without new request loops |
| `src/index.css` | Reserved skeleton layouts, error presentation and reduced-motion support |
| `src/components/AssessmentReportPanel.jsx` | Loading/error boundaries for references; preserve generated snapshots |
| `src/components/NlpTextPreview.jsx` | Expanded preview loading/error/retry state |
| `src/components/enrollment/StudentEnrollmentModal.jsx` | Share batch query instead of a second raw GET; guard selector |
| `src/hooks/admin/useAdminCompanies.js` | Defer editor categories; seed warm company data |
| `src/hooks/admin/useAdminUsers.js` | Reuse the existing normalization for warm state and guard initial optimistic-list hydration |
| `src/hooks/instructor/useEnrolledStudents.js` | Guard first batch/roster hydration while retaining subsequent live/optimistic content |
| `src/hooks/instructor/useInstructorAssessments.js` | Shared restricted GETs, retryable question errors and obsolete-selection guard |
| `src/hooks/usePlacements.js` | Expose independent readiness for safe rendering/actions |
| `src/pages/auth/LoginPage.jsx` | Shared Axios auth request; immediate success routing; remove role-prefetch wait |
| `src/pages/auth/AdminLogin.jsx` | Immediate shared routing and distinct unavailable/credential errors |
| `src/pages/admin/AdminDashboard.jsx` | Independent statistics and recommendation states |
| `src/pages/admin/AdminUsers.jsx` | Guard list/counts while loading or failed |
| `src/pages/admin/AdminAssessments.jsx` | Guard list/counts, selected roster and authorized questions independently |
| `src/pages/admin/AdminSkills.jsx` | Initial taxonomy loading/retry/empty distinction |
| `src/pages/admin/AdminCompanies.jsx` | Company loading and independent editor-reference states |
| `src/pages/admin/AdminReports.jsx` | Remove combined spinner; separate summary, analytics and configuration |
| `src/pages/instructor/InstructorDashboard.jsx` | Independent assessment/student cards and list states |
| `src/pages/instructor/EnrolledStudents.jsx` | Batch and selected-roster loading/error boundaries |
| `src/pages/instructor/InstructorAssessments.jsx` | List/statistics and restricted editor skeleton/retry states |
| `src/pages/instructor/InstructorUpload.jsx` | Independent reference placeholders without resetting form/upload drafts |
| `src/pages/instructor/InstructorCompanies.jsx` | Guard catalogue loading/error/empty states |
| `src/pages/placements/PlacementsPage.jsx` | Independent suggestions/history/statistics and report readiness |
| `src/pages/student/StudentDashboard.jsx` | Source-specific tile skeletons and errors |
| `src/pages/student/StudentAssessments.jsx` | Guard completion progress and assessment cards |
| `src/pages/student/StudentAssessment.jsx` | Initial skeleton and retry only; attempt mechanics unchanged |
| `src/pages/student/StudentAssessmentResult.jsx` | Independent result/review loading and retry |
| `src/pages/student/StudentResults.jsx` | Guard locked/error state; catalogue only on tab intent |
| `src/pages/student/StudentProfile.jsx` | Profile section loading/retry while retaining existing draft seeding |
| `tests/navigation_playwright.py` | Synthetic login ordering, role redirects and before/after observations |
| `tests/navigation_states_playwright.py` | Direct routes, independent states, requests, tab/logout/account and draft checks |
| `skillbridge-backend/api/views.py` (repository root) | Bounded Google userinfo connect/read handling only |
| `skillbridge-backend/api/test_auth_deadlines.py` (repository root) | Mocked transport errors and unchanged role/approval/enrollment gates |
| `knowledge/PROJECT_OVERVIEW.md` (repository root) | Link this loading strategy and evidence |
| `knowledge/NAVIGATION_LOADING.md` (repository root) | Audit, complete coverage, measurements, file rationale and limitations |

Initial Git status was clean. Generated builds, baseline copies, logs, synthetic
sessions and screenshots remain ignored under test artifacts. Dependency manifests,
configuration secrets, migrations, scoring and ranking files are unchanged.
