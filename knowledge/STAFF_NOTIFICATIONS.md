# Staff notification reminders

Implemented 25 October 2026 after the user requested replacing the dashboard
Needs attention panel with a bell and notification cards. Instructor and admin
authenticated headers now include [NotificationMenu](../skillbridge-frontend/src/components/layout/NotificationMenu.jsx).
The original inline attention panel is removed; confirmation/error toasts retain
their [existing behavior](NOTIFICATION_TOASTS.md).

## Current coverage

The menu uses the existing backend-authorized `/api/management/analytics/`
active-batch scope. Its shared `useApi` subscription deduplicates requests with
the dashboard and follows existing SSE/visible-page refresh and account-reset
rules. It introduces no separate polling loop, backend endpoint or database table.

| Reminder | Destination |
| --- | --- |
| Stopped / flagged, overdue required work, no required assessments, unavailable final results, no current recommendations | Role-scoped assessment report filtered by the supplied reason |
| Unplaced students with current recommendations | Role-scoped placement report, awaiting review |
| Instructor accounts awaiting approval | Admin Users, pending tab; admin only |

The [grouping helper](../skillbridge-frontend/src/utils/notifications.js) preserves
all supplied current reason groups and avoids repeated reasons within a student.
The badge counts **reminder groups**, not distinct students or unread messages.
Student counts can overlap. Reading a reminder does not clear the underlying
issue; the card disappears when current authorized data no longer reports it.
There are no fabricated timestamps, read receipts, notification history, browser
push requests or email dispatches. Student-role reminders are now implemented
separately using [student-owned assessment/placement data](STUDENT_NOTIFICATIONS.md).
Additional
event notifications require a defined source and lifecycle rather than inference
from a transient toast or recommendation score.

## Interaction and states

The bell and close button have 44px targets. Cards are native links. Escape and
the close button return focus to the bell; outside click, focus leaving the
control, route changes, profile-menu opening and mobile navigation close the
panel. Notification/profile/navigation popovers do not remain open together.
The popup fits narrow screens and scrolls its card list within the viewport.
Light and dark themes share the application typography and icons.

Loading, unavailable, last-good-data refresh failure and genuinely empty queues
are distinguished. API failure does not report that everything is caught up.
Retry invalidates the existing shared query. Empty queues have no numeric badge.

## Verification

Synthetic Node tests cover overlapping reasons, role-specific links, admin-only
approvals, and absent/empty data. Dashboard browser checks cover the shared
request, badge semantics, cards/links, keyboard/focus, menu coordination, narrow
screen geometry, dark/light mode, empty state and failed-request recovery.
See [dashboard verification](DASHBOARD_HIGHLIGHTS.md) for final commands/results.
These checks use intercepted local responses; live services and physical devices
are not verified by them. Backend/database tests are unnecessary for this
frontend-only presentation change and were not run.
