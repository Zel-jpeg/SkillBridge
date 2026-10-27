# Admin batch collection and student roster

27 October recovery follow-up: selected rosters now include independent Enrollment
and Account status filters, an audited Previously unenrolled collection and
prefilled verified re-enrollment. Archived batch actions remain restricted.
See [student account and enrollment recovery](STUDENT_ACCOUNT_AND_ENROLLMENT_PLAN.md).

26 October 2026: implements the approved batch-overview and selected-student
concepts while retaining existing admin management APIs and access boundaries.

The overview uses labeled search/instructor/status controls, batch status pills,
responsible instructor avatars, enrollment counts and three-column batch cards.
Unknown creator attribution remains unknown. Cards collapse to two/one columns;
list view uses a contained table and falls back to cards on phones.
Batch cards and list rows show the responsible instructor's saved profile photo
through the existing Avatar component, with initials when missing or unavailable.
The shared batch payload adds `instructor_photo_url` from the current instructor;
the batch list already joins that instructor. Batch/card/count/detail/navigation
symbols use the shared group icon; individual user symbols stay separate.
`CollectionViewToggle` is reused for both batches and students. Both views share
the same filtered page of ten records; filters/search reset the page and view
switching preserves it. Counts and progress come from existing server fields.

Selecting a card or batch row focuses the selected batch heading and presents its
management header and student roster. Back to batches restores the collection's
search, filters, page, view and visible batch button focus. Student rows open the
existing details dialog, with a separate Unenroll action. Native name buttons
support Enter/Space and focus restoration; row clicks ignore independent controls
and text selection. Student cards offer the same details/progress/actions. The
selected batch name is passed into the student profile as its context.

Required assessment progress remains distinct from final evidence/placement.
Zero assigned assessments are labeled None assigned, never complete. Existing
stopped/flagged state takes priority; partial work and recorded attempts indicate
In progress. No demo records, invented creator dates, scoring or ranking logic
are introduced into application data.

## Decisions and confirmation

All confirmations use the shared native `ConfirmModal`/`DialogShell`: centered,
dimmed backdrop, keyboard focus handling and explicit Cancel/Confirm actions.
There is no corner confirmation card.

- Create/manage batch reviews show the batch and responsible instructor. A real
  reassignment identifies the previous/new instructors and explains access loss;
  renaming alone does not claim ownership is changing. Dirty drafts retain their
  discard dialog and failed saves keep the editable fields.
- Archive/reactivate names the selected batch and explains assessment/final
  recommendation access. Failed actions remain in the confirmation for retry.
- Unenrollment names both student and batch, explains preservation of the account,
  other enrollments/history and uses the existing explicit batch-scoped endpoint.
- Admin batch enrollment opts into a centered final confirmation after the existing
  row preview and email/ID verification. Cancellation preserves the reviewed rows,
  token and checked verification. Confirmation submits the same existing payload;
  a pending ref prevents duplicate submissions. Other enrollment callers retain
  their existing review flow unless they opt in.
- Assessment-specific retake decisions retain the shared student detail's existing
  centered confirmation. New assessment opens the creator; its final save flow
  owns confirmation. Search, reading, navigation and changing views do not mutate
  records and do not require confirmation.

Action history and lazy combined-skill leaderboards retain existing endpoints and
meaning. Admin-only instructor assignment and batch updates remain enforced in
the backend. The photo follow-up adds the optional instructor photo URL to the
read payload; database schema, permissions and mutation contracts are unchanged.

## Verification

The synthetic browser suite is
[admin_batches_playwright.py](../skillbridge-frontend/tests/admin_batches_playwright.py).
Run with local Vite on port 5178 and the project's Python Playwright environment.
It intercepts all APIs and uses only synthetic users, batches and student records.

Final checks passed frontend lint/build, all 167 discovered JavaScript tests and
eight browser workflow groups with zero browser page errors. The browser suite
covers batch/roster pagination, independent actions, full-row clicks, keyboard
activation and returned focus, confirmed enrollment payloads, named create/manage
reviews, canceled decisions with no writes, failed archive/unenroll retries and
action history. Twelve light/dark layouts cover 1440×1000, 1024×768, 768×1024,
375×812, 320×568 and 812×375. Confirmation geometry is checked at the viewport
center in each layout. A positioned table container also keeps visually hidden
column labels from extending page width beyond its intended scroll region.

Desktop cards/roster, narrow dark roster and narrow centered confirmation were
visually reviewed. Previews are in `outputs/ui-previews/admin-batches-2026-10-26/`;
full screenshots are under ignored `tests/artifacts/admin-batches/`. Existing
database-backed admin management browser selectors were updated and Python syntax
checked, but that full integration suite was not run. No real API writes, hosted
deployment, physical device or screen-reader verification was performed.

The instructor-photo/group-icon follow-up passed lint/build, the same 167 frontend
tests and eight browser groups, including loaded photos in cards/list plus missing
and broken-image initials fallbacks. Two database-free Django SimpleTestCase checks
verify the current instructor's photo URL and empty fallback in `batch_payload`.
