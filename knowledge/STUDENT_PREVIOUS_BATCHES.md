# Student previous-batch records

## Visibility correction and presentation — 30 October 2026

The shared `StudentCycleNotice` previously always offered batch history on the
dashboard, assessment library and profile. The history API included the current
enrollment, so a first-time student could expand their active batch and see
unstarted assessments under a technical closeout warning. This was misleading
history presentation; it did not indicate an assessment or grading failure.

The authenticated student profile now returns `has_previous_batches`, computed
with one existence query against student-owned enrollments, attempts, placement
records and removal audits. The current active enrollment is excluded. Archived
memberships and transferred-from batches remain available, even without attempts.
Other students' records cannot make the flag true.

`GET /api/students/me/history/?previous=1` uses the same ownership sources and
excludes the current active batch before serializing records. The original URL
without that parameter retains its full-history contract for existing callers.
Saved archived snapshots, score precision, anonymous assessment labels and private
staff-field exclusions are preserved. No model, migration, grading, membership or
placement decision changes are required.

## Student experience

- First active batch, no earlier records: no history panel or history request.
  The normal dashboard and current assessments remain available.
- Previous records: the full **Previous batches** section lives beneath the saved
  profile form, initially collapsed. The active dashboard offers only a small
  **View previous records** link to `/student/profile#previous-batches`; following
  it opens and scrolls to the Profile section. The active Assessments page has no
  history section or history request. Details load only when opened. Five batches
  appear per page, with keyboard
  expandable summaries, submission counts, readable attempt statuses, category
  scores and recorded placement decisions. Former active batches are labeled
  **Previous batch**, so their administrative status does not imply current membership.
- No active batch: keep the enrollment notice and automatically open any previous
  records on the records dashboard. Accounts without history receive no empty toggle.
- Returning profile confirmation is independent of history availability and keeps
  its existing save/confirm flow. Network errors offer retry; loading and genuinely
  empty results have separate messages. Cached current-batch rows are filtered out
  defensively. No student-facing closeout/snapshot warning is shown.

## Approved Profile design — 30 October 2026

The owner approved an ImageGen concept, saved as
[`previous-batches-profile.png`](../outputs/design-concepts/previous-batches-profile.png).
The subsequent approved placement preview is
[`previous-batches-profile-placement.png`](../outputs/design-concepts/previous-batches-profile-placement.png):
keep the existing identity/contact/travel/location form, then put history below
the form's Save changes row. The history frame now uses the form's exact 1160px
maximum-width/padding rules, separated by a 24px gap. No Profile inputs, map
controls or save behavior are replaced by the mockup.
For students with previous records, the existing save row stays in normal document
flow immediately before history rather than sticking over the form/records. The
existing sticky save row remains the default for profiles without history. Both
variants use the same validation, save handler and success/error messages.
The implementation adopts its expandable batch summaries, aligned assessment
results and a separate recorded-placement column. On phones those columns stack.
On desktop each assessment/category row aligns the label, attempt badge, score
bar and exact numeric score horizontally. Multiple category scores stay separate;
unscored rows show a neutral empty track and a dash, with accessible missing-score
text. The header's neutral View records/Hide records action, clock/check status
icons and read-only decision notice follow the approved visual hierarchy.
Each available category score retains its exact percentage with a quiet visual
bar; missing scores have no fabricated zero. Submitted/other attempt states remain
distinct, and recorded decisions are explicitly read-only. Existing Profile
editing fields and navigation are preserved rather than replacing them with the
concept's illustrative shell. Profile-review and no-active-batch notices remain
independent from the historical-results section, with no duplicated prompts.

The full section and dashboard link require records from another batch, including
transferred-from or archived memberships. Completing current assessments alone
does not qualify. When the current batch is archived and there is no active
enrollment, its retained records become available through the records dashboard.
This placement/design refinement is frontend-only and adds no further schema or
API changes beyond the history availability/filtering correction above.

The frontend and backend should be released together: the frontend relies on the
new availability flag to avoid loading full history on every dashboard visit.
No configured database or live student account was used for verification.

## Verification

- Frontend lint and production build: pass.
- `python skillbridge-frontend/tests/run_student_assessment_order_postgres.py`:
  171 tests pass on a disposable PostgreSQL cluster, including five new previous-
  batch tests. Coverage includes first-time students, foreign data exclusion,
  removed memberships, detached attempt/decision evidence, no-active enrollment,
  reactivation and the one-query summary. Existing alias, score, cycle and privacy
  regressions also pass. Evidence: ignored
  `work/student-assessment-order-postgres-w4a5toup/tests.txt`.
- `student_previous_batches_playwright.py` against the production build:
  seven groups pass, zero page errors after the approved Profile placement and
  two-column redesign. Checks cover dashboard/assessment/profile
  visibility, zero history calls for first-time students, lazy expansion, defensive
  current-batch filtering, scores/decisions, pagination, explicit failure/retry,
  delayed loading, no-active enrollment, profile confirmation with and without
  historical records, an empty response and the dashboard-to-Profile anchor link.
  Current-batch notices and previous records have separate accessible region labels.
  The final layout fixture checks matching profile/history frame widths, DOM
  placement after Save changes, desktop status/score alignment and submitted versus
  unstarted rows with real 70%/80% scores and an absent score. The complete desktop
  profile is captured as `profile-with-previous-batches-desktop.png` alongside the
  isolated section and phone captures in the same artifact directory.
  Full-page captures use synthetic contact/address/geocoding responses and
  synthetic map tiles; a cached local Leaflet runtime is used when available,
  otherwise its unavailable state remains supported. No external provider traffic
  is allowed. The full desktop capture starts at the top of the document so fixed
  application chrome is not captured in the middle of the page.
  Desktop light and 375px dark screenshots were visually reviewed. All API traffic
  was intercepted with synthetic data. Evidence: ignored
  `skillbridge-frontend/tests/artifacts/student-previous-batches/` and
  `work/student_previous_batches/`.
- The final real-API cycle browser journey passes all 14 groups with zero page
  errors, using a disposable synthetic SQLite API and local frontend. It covers
  closeout/report exports, partner reuse, returning enrollment/profile confirmation,
  Profile history, new assessment submission/results/placement and transfer history.
  Assertions use the current anonymous assessment title and new history markup.
  Evidence: `work/final_push/cycles.log` and ignored
  `skillbridge-frontend/tests/artifacts/cycle-lifecycle/`. Task-owned servers stopped.
- Initial browser attempts exposed fixture-only issues: the shared request cache
  adds a timestamp query, identical scores occur in several collapsed records, and
  a deliberately held loading response cannot reach network idle before release.
  Those fixtures were corrected before the successful run. Task-owned preview and
  database helpers stopped after testing.

Concurrent staff/student assessment-card styling changes were left intact and
are outside this history correction. The owner subsequently authorized committing
and pushing both completed updates after final combined verification. The final
171-test PostgreSQL run also passes at
`work/student-assessment-order-postgres-ycn_754n/tests.txt`; all 243 frontend tests
and 41 production-build browser groups pass. The latter include all seven history
groups. Final browser logs are under `work/final_push/`. Django system checks and
the migration dry-run pass with no schema changes detected. Hosted acceptance
remains separate.
