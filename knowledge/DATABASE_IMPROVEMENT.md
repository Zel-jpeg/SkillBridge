# Database improvement

Branch: `db-improvement`. Authorized 29 October 2026: implement the database
audit's repeated-query fixes, bounded collection reads/details and safe hosted
verification preparation before Railway reactivation.

## Plan and checkpoint

- [x] Create the requested branch from clean `main`; inspect current callers,
  result gates, collection contracts and previous audit measurements.
- [x] Remove missing-profile fallback reads and batch inactive historical evidence.
- [x] Add paginated admin-user and instructor-roster reads, server filters/counts,
  and on-demand detailed evidence; preserve existing consumers and role scopes.
- [x] Verify response equivalence, query growth, payload bounds, permissions,
  filter previews, pagination, mutations, live invalidations and detail loading.
- [x] Prepare read-only database diagnostics and hosted connection/retention steps.
- [x] Run applicable PostgreSQL/frontend/browser checks and record actual results.
- [x] Finish final documentation/diff review and deliver the implementation summary.

Initial audit artifacts are under ignored `work/DATABASE_PERFORMANCE_AUDIT.md`
and `work/database_performance_audit_results.json`. They used a disposable local
PostgreSQL database; they do not verify hosted migrations or query plans.

Safety boundary: preserve grading, recommendation weights/freshness/eligibility,
placement history and authorization. On 29 October, after reviewing the passing
checks, the owner authorized committing/pushing `db-improvement`, merging into
`main` and pushing GitHub `main`. Publishing main can trigger connected hosts'
automatic deployments. Manual deployment, live data maintenance and paid-service
changes remain outside this work. Hosted checks that require Railway remain
explicit follow-up work after reactivation.

## Publication preparation

Fetched GitHub before publication: local `main`, `origin/main` and the feature
branch's starting commit all match `9c7cefe`; the remote feature branch did not
yet exist. The approved source matches the locally tested implementation. Only
the intended application files, regression/browser test sources and knowledge
documentation are included; ignored local runtimes, fixture databases, auth
artifacts and logs are excluded. Existing passing suites are reused because
there is no intervening main change or application edit requiring a rerun.

### Resumed review — 29 October 2026

The user said CONTINUE and asked to continue reviewing/fixing the pagination/cache
issue referenced in their screenshot. Branch and working-tree files match the
pause checkpoint below; there were no intervening application changes.

A new browser regression reproduced a confirmed error: after archiving the only
row on page 3, its successful response reports page 2/count 20, but setting page
2 immediately selects that URL's older cached count 21. A failed follow-up GET
then leaves the incorrect total visible. Evidence:
`work/db-improvement-resume-browser-red.txt`.

The fix seeds the returned page URL with the successful response before changing
the requested page. It preserves all filter/sort parameters and existing cache
version protection; stale, failed, in-flight or superseded sources are not promoted.
A newer canonical-page entry causes one recheck rather than being overwritten.
Five new cache regressions pass. Browser verification also covers the equivalent
instructor-roster clamp and a failed-preview/cached-filter recovery case.

A second browser regression reproduced a failed filter-preview error remaining
active after switching to another successfully cached filter. API hook errors
are now bound to their request URL, and a successful cached read clears that
URL's error/status. Evidence before the fix:
`work/db-improvement-preview-red.txt`. This also prevents an old URL's access-error
status from being applied to a newly selected scope.

Final resumed checks: **238 frontend tests passed**, zero skips; frontend lint
and production build passed. **Eleven real-local-API/production-build browser
groups passed**, no page errors, including both reproduced failures, admin and
instructor clamps during simulated canonical-page outages, cached-filter recovery,
and all prior paging/detail/retake/archive/restore checks. The instructor test
uses real synthetic membership removals and a simulated legacy invalidation event;
it does not claim to test the hosted SSE transport. Logs:
`work/db-improvement-resume-frontend-tests.txt`, `db-improvement-resume-lint.txt`,
`db-improvement-resume-build.txt`, `db-improvement-resume-browser-final.txt`, and
`skillbridge-frontend/tests/artifacts/database-collections/results.json`.

Backend source has not changed since the passing **557-test PostgreSQL run**;
that suite was reused rather than repeated for frontend-only fixes. Documentation
links, browser helper syntax and diff whitespace were checked. The final browser
runner completed with exit code 0 and stopped its helpers.
Final process/listener inspection confirmed no remaining resumed collection-browser
helpers or listeners on their test ports. All nine local report links resolve,
and `git diff --check` passes.

The implementation/review is complete on `db-improvement`. At review completion,
all changes were local and uncommitted; the owner subsequently authorized Git
publication as recorded above. No outstanding local application/test failure is
known. Hosted verification below remains pending Railway reactivation; no live
access, migration or maintenance was performed. The previous pause record below
is retained as history and is not an active pause.

### Previous pause checkpoint — 29 October 2026

Branch verified: `db-improvement`. All edits remain local and uncommitted. Git
status shows the expected backend/frontend modifications, this document and its
overview link, and the new collection/diagnostics/test files. Nothing was reset,
discarded, merged, committed, pushed, deployed or migrated against hosted data.

Completed: repeated-query fixes; batched inactive historical evidence; opt-in
paginated admin/roster APIs with global filtering/count previews; lazy full student
history; frontend pagination/detail/mutation handling; the read-only diagnostic
command; regression and browser fixtures. Final review also preserved category
fallbacks when completed students lack saved scores.

Latest checks actually run:

- **557 PostgreSQL API tests passed, zero skips**, in 350.093 seconds against the
  final backend source. `work/redeployment-postgres-134lnf2p/tests.txt` supersedes
  the earlier 556-test run. Runner session completed with exit code 0 and ran its
  owned database cleanup.
- **233 frontend tests passed**, zero skips; final frontend lint/build passed.
  Logs are `work/db-improvement-frontend-tests.txt`, `db-improvement-lint.txt`
  and `db-improvement-build.txt`.
- **Eight production-build browser groups passed**, no page errors. They cover
  admin/instructor desktop light and phone dark, global counts, later pages,
  search/filter resets/previews, cards/list preservation, lazy history,
  real synthetic retake approval/revocation, Retry, foreign staff denial, and
  archiving/restoring the last-page account with page clamping. The real local
  browser API uses disposable SQLite; PostgreSQL behavior is separately covered
  by the full suite and query audit. Browser/preview runners completed cleanup.
- Desktop/mobile screenshots were inspected. Evidence is
  `skillbridge-frontend/tests/artifacts/database-collections/results.json` and
  the adjacent screenshots/browser/server logs.
- The repeat PostgreSQL audit passed 42 GET checks with no captured data writes;
  query/payload results below were recorded and its cluster was stopped.
- Django system/migration-drift checks passed in the audit. Six local links in
  this document, all six new Python files' syntax, and `git diff --check` passed
  before the pause checkpoint update.

Known failures: no outstanding application/test failure. Earlier setup failures
and verification limitations are recorded below. Hosted query plans, actual
pooler/connection capacity, migration/index state and cleanup scheduling remain
unverified until Railway reactivation; no hosted action was attempted.

Exact next step on **CONTINUE**: read this checkpoint and Git status, reconcile
any intervening edits, then finish the final documentation/diff review and
Markdown-link/whitespace check. If needed, independently confirm the completed
runners left no task-owned listeners. Do not repeat the passing suites unless
new changes or unresolved evidence justify it. Deliver the branch summary and
explicit hosted follow-ups. Wait for CONTINUE; do not resume automatically.

## Implemented behavior

- An explicitly loaded missing combined profile remains locked without a second
  lookup. Omitted profile arguments still load the profile for single-student
  callers. Scoring, weights, eligibility, snapshots and stored records are unchanged.
- Roster reads reuse bulk-loaded combined scores/profiles for inactive students'
  preserved evidence, with recommendations locked as before.
- Admin Users and instructor Students use `?page=1` mode on their existing APIs.
  Default page size is 10, bounded to 1–50. Invalid/repeated filters are rejected;
  empty or shrinking collections clamp the page to a valid value.
- Filtering, sorting and totals apply to the full authorized collection before
  selecting a page. Lightweight saved-state reads use the existing completion
  and freshness gates. Heavy serialization is restricted to selected student IDs.
  Rows use stable name/ID ordering; admin sorting supports name, course and match.
- `counts_only=1` returns filter-preview counts with no student detail rows.
  Batch statistics/categories remain independent of the selected page and filters.
- Collection pages omit archived attempt history. A returned `detail_url` fetches
  one student's full existing detail when their dialog opens, with the same staff
  scope. Retake controls operate on the targeted assessment. Existing archived
  account history retains its separate read-only endpoint.
- Parameter-free collection APIs remain available for existing dashboards,
  analytics, reports and management dialogs. This avoids treating a collection
  page as a complete report or truncating another screen's totals.
- All parameter variants reuse the existing Axios/cache, recipient-scoped
  invalidations and visible-tab refresh. No dependency or schema migration is added.

Source: [collection reads](../skillbridge-backend/api/collection_queries.py),
[shared views](../skillbridge-backend/api/views.py),
[query builders](../skillbridge-frontend/src/utils/collectionQueries.js),
[student dialog](../skillbridge-frontend/src/components/StudentDetailModal.jsx),
[clamped-page cache adoption](../skillbridge-frontend/src/api/collectionPage.js),
[shared page hook](../skillbridge-frontend/src/hooks/useCollectionPage.js),
[URL-scoped API errors](../skillbridge-frontend/src/hooks/useApi.js).

## Measured results

Same synthetic local PostgreSQL fixture as the initial audit: one batch, one
required assessment/category, eight positions and 200 students. Direct DRF calls
bypass HTTP/authentication transport. No hosted latency or capacity claim is made.

| Case | Before | After |
| --- | ---: | ---: |
| Admin Users, completed students with missing profiles, existing full API | 222 SQL statements | 22 SQL statements |
| Current analytics, same missing-profile case | 222 SQL statements | 22 SQL statements |
| Roster, inactive students with missing profiles, existing full API | 616 SQL statements | 16 SQL statements |
| Admin Users, finalized students, first page JSON | 613,671 bytes (entire collection) | 31,371 bytes (10 students) |
| Roster, finalized students, first page JSON | 558,008 bytes (entire collection) | 28,982 bytes (10 students) |

The paginated finalized reads use 39 and 35 SQL statements respectively, compared
with 26 and 20 for the full APIs. The extra lightweight selection/count reads buy
bounded heavy serialization, smaller responses and on-demand histories. Core
saved-state selection still scales with cohort/batch size; this is not a claim
that the entire operation reads only ten database rows. No new index was added
without a measured query-plan justification. All 123 existing application-table
indexes remain present in the fresh migrated database.

Evidence under ignored `work/`: `database_performance_audit_results.json` (before),
`database_performance_after_results.json`, `database_performance_after.py` and
`db-improvement-performance-after.txt`. All 42 repeated GET checks returned 200
and captured no INSERT/UPDATE/DELETE statements. Both audit databases were local,
disposable and shut down afterward.

## Verification

- Full current backend: **557 PostgreSQL tests passed, zero skips**, including
  the new collection/diagnostics tests. Evidence:
  `work/redeployment-postgres-134lnf2p/tests.txt` (350.093 seconds).
- Targeted SQLite check: 46 tests ran, 44 passed and two PostgreSQL-only concurrency
  cases skipped. These are supplementary; the full PostgreSQL run above covers
  the real PostgreSQL paths.
- **238 frontend tests passed** across the discovered source test files after
  the resumed cache fixes. Evidence: `work/db-improvement-resume-frontend-tests.txt`.
- Frontend lint and production build passed after the page-clamping adjustment.
  Final resumed logs: `work/db-improvement-resume-lint.txt` and
  `work/db-improvement-resume-build.txt`.
- Final real-local-API/production-build browser pass: desktop light and phone
  dark for Admin Users/instructor Students, search/filter resets, preview counts,
  page 2, cards/list preservation, lazy history, failed-page Retry and foreign
  staff denial passed without page errors. Real retake approval/revocation and
  archiving/restoring the last-page account with page clamping also passed.
  The resumed run expanded this to eleven groups with both cache-failure regressions.
- Django system check and API migration drift check passed during the repeat audit.

Initial test setup failures are not passes: the focused tests initially hit a
shared throttle cache (fixed by clearing only the test cache per fixture), the
first browser launch was blocked by sandbox localhost permissions, and browser
fixture runtime/button-label/log-encoding issues were corrected. Production
throttling and access rules were not relaxed. Missing collected static files in
unit/API fixtures emit an existing warning; the frontend production build is
tested separately. No physical-device or hosted runtime result is claimed.

## Hosted verification after Railway reactivation

The read-only management command
[database_performance_report](../skillbridge-backend/api/management/commands/database_performance_report.py)
is verified against disposable PostgreSQL. In the authorized hosted backend
shell, run:

```sh
python manage.py database_performance_report
```

It enforces a read-only transaction and a five-second timeout per SQL statement.
Output includes schema/index definitions, pending migrations, estimated table/dead
row counts, scan counters, maintenance timestamps, table sizes and visible
connection totals. It excludes record values, SQL activity text, credentials and
connection addresses. It does not run migrations, VACUUM, ANALYZE, index creation,
EXPLAIN workloads or deletions. Statistics are estimates/cumulative, not timings.

After reactivation, verify the actual pending migration/index inventory, inspect
autovacuum/analyze/dead-row evidence, and capture slow SELECT execution plans on
representative authorized data before choosing any additional index. Confirm the
external pooler mode/limits and measure concurrent HTTP/SSE connections under the
actual Gunicorn/psycogreen deployment. Preserve SSE's connection-release behavior
until those measurements justify a change. The existing Railway preparation and
health/login gates are in [redeployment preparation](REDEPLOYMENT_PREPARATION.md).

The existing `python manage.py prune_change_events` command removes invalidation
metadata older than one day. Confirm whether a daily authorized operations job
already exists; otherwise configure that existing command after release. This
branch does not provision a scheduler, start an email worker, delete live events,
or modify Railway services/subscriptions. Do not confuse event metadata retention
with deleting assessment, placement or management history.
