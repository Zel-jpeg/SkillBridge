# Student collection cards

Updated October 25, 2026. The instructor Students page and admin Users student
cards share the dashboard-inspired [StudentPerformanceCard](../skillbridge-frontend/src/components/StudentPerformanceCard.jsx).
The dashboard layout is unchanged. Cards show identity and status, OJT placement,
an overall bar, compact category scores, highest-scoring categories and a current
company match. Pending cards use a quiet waiting state. Email and detailed
assessment progress remain available in the existing detail modal and list view.
Suggested-company strips use the existing `CompanyImage` component and the
recommendation's `company_image_url`, including on instructor dashboard student
cards. Logos fit inside a 24px frame without cropping; missing or failed images
fall back to company initials. This reuses existing API fields without extra
company lookups or changes to branding storage.

## Evidence and actions

- Cards read normalized combined category evidence. The displayed overall value
  is the rounded arithmetic mean of available category percentages, matching the
  dashboard presentation; it is not a pooled raw/max score or recommendation input.
- Locked, stopped, flagged and archived records do not display positive result or
  recommendation summaries. Missing results remain unavailable; actual zeroes
  remain zeroes. Stale recommendations are excluded from the match strip.
- Up to four category chips are shown, with an overflow label leading readers to
  student details. All highest-score ties are retained in the accessible text.
  Company match percentages remain separate from assessment percentages.
- The card opens the existing student dialog using a native button, with hover
  and keyboard-focus feedback. Instructor removal remains a separate button and
  is unavailable in archived batches. Existing admin instructor cards and role
  access boundaries are preserved. Unknown placement is not labeled unplaced.
- Search, filters, sorting and card/list switching keep the existing collection
  behavior. Admin pagination now counts the full filtered collection rather than
  the current page slice, allowing later pages to appear.

## Verification

- `npm run lint` and `npm run build` pass.
- `node --test`: 214 tests pass, including six card evidence cases covering
  completion locks, invalid/missing values, zeroes, stale matches and ties.
- [Synthetic browser checks](../skillbridge-frontend/tests/student_cards_playwright.py):
  26 groups pass for both roles, using 13 synthetic students at 320, 375, 768,
  1024 and 1366 CSS pixels in light and dark mode. Checks include card content,
  overflow, detail opening and focus restoration, separate removal confirmation,
  archived behavior, page changes, view switching and search resets. No API writes
  occur during the checks. Desktop and phone card screenshots were reviewed.
- Logo follow-up: lint/build, all 26 collection browser groups (including loaded,
  absent and broken logos), and 12 dashboard regression groups pass. These checks
  use synthetic branding rather than live company images.

Browser checks use local headless Chrome with mocked API responses. They do not
establish live-service integration or physical-device coverage. No backend or
database behavior changed.

## Instructor roster filter placement — 28 October 2026

The instructor Students toolbar groups labelled Search students, Course,
Enrollment and Account status controls on one row when its content width reaches
1,000px. Progress/placement pills occupy the next row, with the compact view
switch and filtered count at the right. Narrower layouts wrap by available
content width: paired enrollment/account dropdowns from 420px, and single-column
fields below that. Student cards and the admin roster layout are unchanged.

The shared enrollment filter component accepts an optional presentation class;
its options and other callers retain their existing behavior. Course/status/view
buttons expose their selected state and keyboard focus. Enrollment changes reset
the enrolled roster page and progress filter; existing course/account/search
combination rules and the previously unenrolled collection are preserved. Counts
now distinguish “1 student” from multiple students.

Verification: frontend lint/build pass. The synthetic
[roster toolbar browser check](../skillbridge-frontend/tests/student_roster_toolbar_playwright.py)
covers 320, 375, 768, 1024 and 1440px in light/dark mode, including toolbar geometry,
account/course/progress filters, later-page resets, card/list switching, enrollment
switching, keyboard search and empty-state recovery. It blocks API writes and
external services; no live database is used.

### Complete roster filter audit

Expanded the same browser check to 216 enrolled-roster combinations (all eight
status options × three course options × three account states, in mobile cards,
desktop cards and desktop lists), checking exact student identities as well as
counts. Another 27 combinations cover previously unenrolled course/account
filters in those views. Name, school-ID and email search, mixed case, surrounding
spaces, batch isolation, pagination resets and empty-state recovery are included.

The audit found and fixed untrimmed enrolled-roster searches: pasted values with
surrounding spaces now match consistently with the previously unenrolled view.
Switching enrollment views also exposed a duplicate React sibling key shared
by email progress and the unenrolled collection; email progress now uses a
distinct key prefix. Browser verification checks for that warning and uncaught
page errors. These fixes do not change access, assessment or placement rules.
