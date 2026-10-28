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
| Enrollment emails waiting for allowance or requiring attention | Affected batch's Enrollment emails panel; scoped to its current instructor or admins |
| Enrollment email submission/delivery completion | Affected batch and fixed sending group; separate submission and confirmed-delivery wording |

28 October: the email groups use saved, latest-per-enrollment outbox state through
the existing analytics subscription. Worker/provider events publish scoped email
invalidations. Stable count/membership/reason values do not become unread again
on each quota check. See [email delivery](ENROLLMENT_EMAIL_DELIVERY.md).
Recent completion groups reuse command receipts and the same subscription. The
bell retains up to five recent groups per active batch within seven days; live
completion transitions produce a toast without replaying old completion toasts
on initial load. A failed/uncertain/cancelled group cannot produce an all-success
reminder. Delivery confirmation is distinct from successful submission.

The [grouping helper](../skillbridge-frontend/src/utils/notifications.js) preserves
all supplied current reason groups and avoids repeated reasons within a student.
The badge counts **unread updates**, while each reminder's count still describes
affected students. Student counts can overlap. Clicking a reminder or choosing
**Mark all as read** clears its unread state; cards remain available until current
authorized data no longer reports them. Opening the bell alone does not mark items
read. Changed counts or reason/placement-review group membership produce an unread
update, while identical polling responses preserve read state.

Read state is per account and role in this browser, retained across navigation,
reload and sign-in. Other tabs synchronize through storage events. Only opaque
presentation fingerprints and read times are stored under the versioned
`sb-notifications-read:v1:` key, bounded to 500 versions/90 days. Blocked storage
falls back to live memory. It is not a server inbox and does not synchronize across
devices or store private notification text. Backend access is unchanged.

Red indicates integrity/overdue problems; amber indicates assessment setup or
placement review; blue indicates pending instructor-account updates. The numeric
badge uses the highest severity among unread items; read items do not keep it red.
Text labels describe both severity and read status, independently of color.

There are no fabricated timestamps, server read receipts, notification history,
browser push requests or email dispatches. Student-role reminders are implemented
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

26 October read/severity update: six read-store tests and the complete 189-test
frontend suite pass. [Read-state browser checks](../skillbridge-frontend/tests/notification_reads_playwright.py)
cover student/instructor/admin click-to-read, mark-all, reload persistence,
unchanged refresh, severity colors, keyboard dismissal and 24 responsive/theme
layouts. Student coverage also checks cross-tab read synchronization and renewed
deadline alerts. Frontend lint/build pass; no backend/API write is introduced.

Synthetic Node tests cover overlapping reasons, role-specific links, admin-only
approvals, and absent/empty data. Dashboard browser checks cover the shared
request, badge semantics, cards/links, keyboard/focus, menu coordination, narrow
screen geometry, dark/light mode, empty state and failed-request recovery.
See [dashboard verification](DASHBOARD_HIGHLIGHTS.md) for final commands/results.
These checks use intercepted local responses; live services and physical devices
are not verified by them. Backend/database tests are unnecessary for this
frontend-only presentation change and were not run.
