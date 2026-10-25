# Student notification reminders

Implemented 25 October 2026. Students now have the same notification bell/dropdown
interaction as staff, using their own authorized records. This extends the
[staff notification implementation](STAFF_NOTIFICATIONS.md); action confirmation
and error toasts keep their existing behavior.

## Current student notices

- Deadline reminder for each unfinished published assessment within 72 hours of
  its due date. Remaining time uses successive 3-, 2- and 1-day windows; a deadline
  on the current Manila date says Due today. At the cutoff it becomes Deadline
  passed and directs the student to the assessment list/coordinator. Exact due
  dates explicitly use `Asia/Manila`. Optional work is labeled optional.
- Retake approved for each assessment with current `retake_allowed`. The start
  link is offered only when the existing availability state is available. An
  upcoming/closed/overdue assessment explains that approval does not bypass its
  schedule. A prior flagged/stopped attempt does not block a currently approved
  retake; no attempt or score is changed by the notification itself.
- Stopped/flagged assessment needing coordinator review when no retake is
  approved. It does not incorrectly urge the student to start blocked work.
- Current approved company/institution and position, linked to student Results.
  Recommendations and suggested placements never become approval notices.
- Final results ready when required work is complete and current final evidence
  is unlocked. Recommendation visibility and placement approval stay separate.

There is one stable deadline item per assessment, updated as time passes rather
than three accumulating daily messages. Submitted work clears its deadline unless
a new retake is approved. Missing/invalid/no deadline, archived/draft work, and
closed-work deadlines do not invent a countdown. Due-today/overdue entries have
stronger icon color; exact wording does not depend on color alone.

## Sources, privacy and refresh

[StudentNotificationMenu](../skillbridge-frontend/src/components/layout/StudentNotificationMenu.jsx)
subscribes to existing `/api/students/me/` and `/api/assessments/` through `useApi`.
It shares requests/cache/SSE with the page and profile controls. Assessment reads
from the bell wait for an active enrollment; students never request staff analytics.
A visibility-aware 30-second display clock updates day windows while the app is
open; it does not add network polling. Returning to the tab updates the clock.
The taking route remains outside the authenticated shell and has no bell.

The [pure presentation helper](../skillbridge-frontend/src/utils/studentNotifications.js)
does not grade, start attempts, approve retakes, assign placements, or change
backend access. The existing backend still checks the exact assessment and student.
No new endpoint, schema, migration, worker, external message or storage operation
is introduced. These are current in-app notices, with no unread/history tracking,
email dispatch or browser push while the app is closed.

The current student API exposes finalized approved placement only. Removal clears
the obsolete approval notice, and a replacement displays its new approved company.
It does **not** produce a stored "placement removed" event or disclose staff
removal/rejection remarks. A durable removal notification would need an explicitly
student-facing event contract; it must not infer a staff action from missing data
or expose internal placement history.

## Existing placement and capacity workflow reviewed

This task leaves staff placement mutations unchanged. Current APIs already let
authorized admins/instructors remove a placement with a required reason, retain
the audit history, and assign another position after removal. An instructor must
have access to the student's batch; one approved placement per student remains
enforced. Removing an approval frees its occupied slot. Company capacity is the
sum of configured position capacity; approved placements consume slots.

Staff can increase position capacity through Companies without removing current
students. For example, five slots with five approvals becomes two available slots
after raising capacity to seven. Capacity cannot be reduced below existing
approved occupancy, and assignments cannot exceed available slots. Increasing
capacity does not itself approve extra students or move existing placements.
See [capacity meanings](CAPACITY_AND_AREAS.md) and
[placement workflow](PLACEMENT_DRAFT_IMPLEMENTATION.md).

## Verification

- Seven pure student-notification tests cover 72/48/24-hour boundaries, Manila
  date rollover, exact cutoff, completed/retake/stopped/flagged states, missing
  dates/enrollment, closed/upcoming availability, approval-only placement, source
  immutability and final-result locks.
- All 224 frontend Node tests, frontend lint and production build pass.
- [Student browser checks](../skillbridge-frontend/tests/student_notifications_playwright.py):
  17 groups pass using synthetic intercepted responses at 320x568, 375x812,
  768x1024, 1024x768, 1366x1000 and 812x375 in both themes. They cover bounded
  scrolling, links, Escape/focus, 3-to-2-day clock movement, submission clearing,
  revoked retakes, removed/replaced approvals, real Results navigation, shared
  GET deduplication, unavailable/empty/unenrolled states, retry and no bell/start
  on the assessment-taking route. No API writes occur.
- Shared dropdown regression uses the existing admin/instructor dashboard browser
  matrix. Live services and physical devices are not exercised. Staff placement
  mutation behavior was reviewed in current code; it was not changed or rerun
  against a database for this frontend-only notification work.

Commands from `skillbridge-frontend`:

```powershell
npm run lint
npm run build
node --test
python ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5199 --strictPort" --port 5199 -- python -u tests/student_notifications_playwright.py
```
