# Dashboard-first sign-in and cache warming

26 October 2026. Both authentication screens prepare the authorized dashboard
after the authentication response, then warm likely next pages in a two-slot
background queue. This supersedes the earlier immediate dashboard handoff and
single-slot optional queue described in historical navigation measurements.

## Sign-in handoff

1. Authenticate through the existing Axios client and establish the new session.
   Retire prior cache, preparation and event-stream state as before.
2. For an approved dashboard destination, start its page-code import and essential
   GETs together. The sign-in button says **Preparing your dashboard…**.
3. Open the dashboard as soon as preparation settles, with a maximum preparation
   window of **1,500 ms**. There is no minimum/artificial success delay.
4. If code or data takes longer, open the dashboard with its matching route/section
   skeletons. Pending GETs continue in the same cache and are adopted by page hooks;
   the deadline does not abort them or start a second GET.
5. An essential-read failure uses the existing section error/retry state after
   handoff. It does not turn successful authentication into a credential error.

| Role | Essential dashboard reads |
| --- | --- |
| Admin | `/api/management/analytics/`, `/api/admin/students/recommendations/` |
| Instructor | `/api/management/analytics/`, `/api/instructor/students/recommendations/` |
| Student | `/api/students/me/`, `/api/assessments/`, `/api/student/results/combined/` |

Pending approval and student setup destinations bypass dashboard preparation.
Backend authorization remains authoritative. No private reads start before the
new authentication succeeds. The handoff checks session/account identity; leaving
the login screen, session expiry during preparation or a newer account prevents
an older attempt from redirecting. Expiry of the retiring session during a new
authentication exchange does not cancel that successful new exchange.
Incomplete optional preparation metadata skips warming and preserves the existing
sign-in destination rather than introducing another access gate.

Implementation:
[readiness deadline](../skillbridge-frontend/src/api/dashboardReadiness.js),
[login lifecycle hook](../skillbridge-frontend/src/hooks/useLoginPreparation.js),
[preparation coordinator](../skillbridge-frontend/src/api/prefetch.js).

## Controlled warming and foreground priority

After current foreground reads settle, up to **two** optional preparation jobs
may run together. Each job prepares code and, when needed, a safe cached GET.
Fresh data skips another GET. Selected next-page sets remain:

- Student: Assessments, Results and Profile. Dashboard reads often already supply
  their data, so only page code needs warming.
- Instructor: Students/batches, Assessments and Companies.
- Admin: Assessments, Skills and Companies.

The queue recognizes its own unmounted reads when checking foreground readiness;
otherwise one slow optional request would prevent refilling the other slot.
Mounted/adopted requests retain foreground priority. A new destination starts its
own essentials immediately, preserves matching in-flight work and aborts unrelated
unobserved warming reads. Aborted optional jobs may warm again after foreground
work settles; job identities protect against stale completion callbacks.

Hidden tabs start no further optional work. Session changes/logout clear queued
work and the account cache. Hover/focus still downloads a selected page's code
immediately, independently of the GET queue. No additional report generation,
answer-review, placement decision or recalculation action endpoints are warmed.

The shared cache remains the sole data cache. Existing SSE invalidation, 30-second
visible-query fallback, access-loss clearing and snapshot boundaries remain.

## Verification and limits

[Readiness tests](../skillbridge-frontend/src/api/dashboardReadiness.test.mjs) cover
parallel startup, immediate success, deadline adoption, failures, cancellation and
account changes. [Queue tests](../skillbridge-frontend/src/api/preparationQueue.test.mjs)
cover concurrency, slot refill, foreground adoption, cancellation and visibility.

[Browser checks](../skillbridge-frontend/tests/dashboard_first_playwright.py) use
synthetic intercepted auth/API/provider responses. They exercise all three roles,
ready and slow dashboard data, slow page code, retry, pending/setup routes,
session expiry, leaving the login page, account replacement, request priority
and hidden-tab pause/resume. No database fixtures or real credentials are used.

Run from `skillbridge-frontend/`:

```powershell
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5196 --strictPort" --port 5196 -- ../skillbridge-backend/venv/Scripts/python.exe tests/dashboard_first_playwright.py
```

The readiness window is a UX deadline, not a guarantee that the database or network
finishes in 1.5 seconds. Controlled browser delays verify scheduling and handoff;
they do not establish the user's live server latency. API/database timing still
needs live measurement if first-load data remains slow.

Verified locally on 26 October: lint/build and all 183 frontend utility tests
passed. All 19 dashboard-first browser groups and the existing 12 sign-in outcome
checks passed, including password/Google failures and approval routing. These runs
used intercepted synthetic responses and made no database changes.
