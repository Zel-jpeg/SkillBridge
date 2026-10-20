# Shared notification toasts

Updated 2026-10-20. The frontend uses `ToastProvider` and `useToast` from
[`ToastContext.jsx`](../skillbridge-frontend/src/context/ToastContext.jsx), mounted
once above the route tree in `main.jsx`. Card styles are in `src/index.css`.

## Behavior

- Compact cards appear at the top right, with a status icon, close button and
  a colored bar showing the remaining time. On narrow screens they fit the
  available width with safe-area spacing; long words wrap and tall messages scroll.
- Success, warning and information messages default to five seconds. Errors
  default to eight seconds; assessment submission failures allow twelve seconds.
  Callers can pass a positive duration in milliseconds as the third argument.
- Hover pauses the countdown; leaving resumes the remaining time. Keyboard focus,
  a touch-and-hold on the message, and a hidden document also pause it. All active
  pause reasons must clear before it resumes. The message itself does not dismiss
  the card; the close button does.
- Up to three cards display at once. Further messages wait without consuming their
  lifetime. Repeated identical active/queued messages of the same type coalesce.
- A Web Animation drives both the bar and dismissal. Its playhead survives moving
  the persistent portal into/out of native dialogs and fullscreen. Animation
  cleanup cancels the clock; there are no detached page-level timeout callbacks.
- The host is a manual popover in the top layer, placed inside the active native
  dialog so inertness does not block its controls. When no dialog is open it uses
  the fullscreen element or document body. The DOM observer runs only while there
  are notifications. Browsers without Popover support use the fixed host fallback.
- Light and `.dark` surfaces use type-specific icon/bar colors. Reduced motion
  removes the entrance movement while preserving the requested countdown display.
  Toasts announce their type and message with status/alert semantics, do not steal
  focus, and have an accessible close label and visible keyboard focus. Coarse
  pointers receive a 44px close target.

## Call-site audit and coverage

The former independent timers/markup in admin companies, users and skills;
instructor assessments, companies and enrolled students; and enrollment dialogs
now use the shared provider. The unused instructor dashboard toaster was removed.
Existing `useApi` and placement/report toasts use the same card automatically.

| Area | Success feedback | Error feedback |
| --- | --- | --- |
| Authentication | Confirmed sign-in | Existing persistent sign-in guidance |
| Student profile/setup | Confirmed save/setup completion | Request failures; field guidance remains inline |
| Student assessment | Confirmed submission, including reconciliation after an uncertain response | Safe submission failure message with retained-answer guidance; replaces the browser alert |
| Assessments/questions | Draft save, publication, settings/authoring save, direct persisted question append, retake updates | Save/upload/retake request failures; drafts and existing inline errors remain |
| Student enrollment | Confirmed enrollment and validated review updates | Preview/confirmation request failures; review errors remain inline |
| Instructor batches | Create/archive/unarchive, retake approval/revocation, selected-batch unenrollment | Batch/retake/unenrollment request failures |
| Admin batches | Create/edit and confirmed management mutations | Request failures with retained form/confirmation guidance |
| Admin catalog/accounts/skills | Existing confirmed create/edit/archive/restore/approval/removal actions | Shared API errors and direct skill-save/delete failures |
| Placements | Existing successful placement actions and report downloads | Existing mutation/refresh/report errors |
| Reports/recommendations | Assessment report generation, CSV/PDF download initiation, active model save and recommendation refresh | Explicit report/export/configuration/refresh failures |

A successful API response is required before success feedback for a server write.
In-memory question edits, routine navigation, background refreshes and per-field
validation do not create success toasts. Background failures with last-good data
retain the existing quiet behavior; this does not add global Axios notifications
that would duplicate feedback or falsely report optional suggestions as saves.
Downloading feedback means the browser accepted the download request, not that
the operating system confirmed a file was saved. Existing authorization,
assessment integrity, grading and ranking behavior is unchanged by this work.

## Verification

- `npm run lint` and `npm run build` passed.
- [`tests/toast_playwright.py`](../skillbridge-frontend/tests/toast_playwright.py)
  uses the real provider under React StrictMode with synthetic controls. Chrome
  and Microsoft Edge each passed nine grouped checks: hover and remaining lifetime, keyboard focus,
  independent queued lifetime/deduplication/manual close, nested-dialog movement,
  320/375/768/1024/1440px in both themes with long unbroken messages, visibility
  events, fullscreen, reduced motion, and touch hold/release/close. No page errors.
- Existing synthetic profile/draft recovery and taxonomy/report recovery scripts
  passed five grouped workflow checks. These also assert successful profile and
  skill saves and error toasts alongside retained drafts/recovery guidance.
- Screenshots and machine-readable results are under the ignored
  `skillbridge-frontend/tests/artifacts/toast/` directory. The fixture is
  [`tests/toast/index.html`](../skillbridge-frontend/tests/toast/index.html).
  `TOAST_TEST_BASE` selects a running Vite origin; the toast suite defaults to
  `http://127.0.0.1:5194`, and `TOAST_BROWSER` selects the installed browser channel.
- These are local synthetic checks. No live account, production database or
  external notification service was used. Physical iOS/Android and Safari were
  not tested. The fixed fallback in browsers without Popover support has not
  received the native-dialog verification performed in modern Chromium.
