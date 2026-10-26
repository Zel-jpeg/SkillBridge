# Shared dropdown presentation

Implemented 26 October 2026 on `codex/modern-dropdowns` after the user requested
a system-wide dropdown audit and a modern presentation.

## Audit and scope

There are 45 native single-choice `<select>` sites in 18 frontend source files.
Some sites render multiple controls from configuration or data. Shared components
cover student, instructor and admin routes rather than requiring separate designs
for each role.

| Area | Source sites |
| --- | ---: |
| Student address fields, including shared company/student forms | 3 |
| Assessment reports | 3 |
| Assessment authoring and duplication dialogs | 3 |
| Assessment library, admin assessments, archives and settings | 8 |
| New assessment batch/instructor choices | 2 |
| Student enrollment import/review | 2 |
| Instructor student batch selection | 1 |
| Admin batch management | 4 |
| Admin student filters | 3 |
| Admin recommendation model and evaluation mode | 2 |
| Placement filters and downloadable report controls | 12 |
| Reports & Analytics filters and student ordering | 2 |

The profile/navigation menu, notification cards, calendar overlays and existing
button-based filter disclosures already have custom presentation and retain their
existing interactions. They are not converted into form selects.

## Presentation and behavior

[Shared CSS](../skillbridge-frontend/src/styles/dropdowns.css), imported once by
[index.css](../skillbridge-frontend/src/index.css), styles the actual select and
its picker. It adds consistent compact typography, rounded fields, a single
chevron, green hover/focus/selected states, checked-option indicators and bounded
scrolling menus. Long field values are clipped without expanding the page; long
menu options wrap. Coarse-pointer controls/options have 44px minimum targets.
Light/dark themes, disabled/error states, reduced motion and forced colors are
handled centrally.

The implementation uses progressively enhanced native
[customizable selects](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select):
both the field and `::picker(select)` opt into `appearance: base-select` inside
a feature query. Supporting browsers render the styled top-layer picker, including
inside native dialogs. Browsers without support retain a styled field and their
operating-system menu. Forced-colors mode restores the native appearance. Multiple
and size-based listboxes, hidden elements and explicitly aria-hidden controls are
excluded from the main enhancement.

No JS picker, duplicate hidden control, portal, new dependency or global event
listener is introduced. Existing values, option groups, disabled options, native
typeahead, required/form behavior and React change handlers remain authoritative.
No request, filter, pagination, assessment, ranking or authorization logic changed.

The shared address fields now have associated labels and unique React-generated
IDs. Their extra SVG arrows were removed to avoid duplication. Previously unnamed
admin student filters, recommendation-model selection and instructor batch selection
now have explicit accessible names. Address loading/retry/reset behavior is retained.

## Verification

Final checks: frontend lint and production build pass; all 225 Node tests pass.
There are 91 passing browser groups: 15 focused dropdown groups, 26 student-card
collection groups, 22 isolated analytics calendar groups and 28 isolated placement
analytics groups. Screenshots of the actual open/closed fields were reviewed.

The full combined analytics stress run did not complete: a cold run hit an
advanced-panel session-context loading error, and an isolated repeat progressed
further but timed out when the calendar Apply control detached during an
overlapping date-request test. The focused calendar and placement runs pass;
this does not establish a passing full combined analytics regression. No calendar,
session, report-request or authorization implementation was changed in this task.

[The focused browser fixture](../skillbridge-frontend/tests/dropdowns_playwright.py)
checks the real picker in Chrome, long labels, grouped addresses, loading/disabled
dependencies, change/reset behavior, earned zero, error styling, Escape/focus,
native dialog layering, required validation and form values. It covers 320/375px
phones, 768px tablet, 1440px desktop and short landscape layouts in both themes,
plus coarse-pointer touch emulation and the forced-colors native fallback.

The surrounding analytics and student collection browser regressions use
synthetic responses or a disposable local test database. No normal database or
live service is needed. Physical devices and unsupported browser engines require
separate verification; emulation does not establish those results.

Run the focused check from `skillbridge-frontend`:

```powershell
../skillbridge-backend/venv/Scripts/python.exe ../.agents/skills/webapp-testing/scripts/with_server.py --server "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5201 --strictPort" --port 5201 -- ../skillbridge-backend/venv/Scripts/python.exe -u tests/dropdowns_playwright.py
```
