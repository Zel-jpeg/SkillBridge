# Coordinator partner and position screens

F18 adds **Manage partners & positions** to the instructor's OJT Partners page.
The management route is `/instructor/companies/manage`. It uses F17's reviewed,
program-scoped API and works before any batch or enrollment exists.

## Staff workflow

1. Select an assigned program. Program search and pagination support coordinators
   with multiple grants. The selected institute and program remain visible.
2. Search the program's partners, or create a partner with optional address,
   image and map coordinates. A latitude requires a valid longitude and vice versa.
3. Use **Reuse existing partner** to review the organization identity before
   creating an opening at it. That lookup exposes no other program's openings.
4. Add a position with its actual shared slot count, tags and optional numerical
   requirements from a saved framework version of this program. Without numerical
   requirements the opening uses the existing manual-placement path.
5. Assigned coordinators can edit entries available in their programs, including
   shared and admin-created entries. The management collection now reuses the
   admin partner/position cards with icon-only edit actions and expandable details.
   Shared IC numerical requirements retain their format. Another program's
   framework rubric is preserved unless editing through that program context.
   The server supplies capabilities and rechecks them on every write.
6. Archive or restore creator/admin-authorized entries through confirmation. Current approved
   decisions can block archiving; recorded assessment evidence remains intact.
   The catalog includes active/archived filters and bounded server pagination.

Student matches remain on the original OJT Partners page and retain their
existing batch ownership restrictions. This management catalog has no student
roster. Existing administrative controls remain available.

The [9 November editing update](COORDINATOR_SHARED_EDITING.md) supersedes the
original creator-only edit restrictions in the earlier F18 verification below.

## Recovery and freshness

Forms prevent duplicate pending submissions and confirm discard. Rejected saves
keep input. A 409 or uncertain network/server outcome blocks another save until
the coordinator checks current records. Reads never replay the mutation.
An edit can explicitly replace its draft with the saved version. For a create,
the coordinator can close and review the catalog or explicitly permit a manual
retry after reviewing the records. Duplicate names and revisions remain checked
by the backend.

Editing and archive confirmation fetch a fresh entry before opening. Mutation
events refresh catalogs, program capabilities and shared capacity. Scope changes
reset open editors; revoked reads remove unavailable cached data. The backend
remains the authority if an assignment changes during an operation.

The partner editor reuses existing image conversion, location controls and the
administrator map. Opening creation/editing reuses the position dialog with a
fixed program. Editors and map code load on demand.

## Verification receipt — 6 November 2026

Branch `codex/coordinator-partner-editor`, based on `1e9ac5a`.

- Frontend lint and production build passed; all **285** frontend unit tests
  passed, including coordinator catalog invalidation coverage.
- **22** isolated PostgreSQL tests passed for `api.test_coordinator_catalog`
  and `api.test_opportunity_scope` in `work/organization-postgres-vbz1c8uq/`.
- **10** real-API production-build Chrome check groups passed in
  `work/organization-browser-egrjhmn5/`: program search/pagination, no-batch
  creation, image validation/conversion/removal, manual coordinates, framework
  requirements/tags, discard, stale edit, successful POST with lost response,
  pagination/status, archive/restore, peer reuse, revocation and foreign-program
  isolation. Phone light/dark screenshots were visually inspected.
- **6** legacy administrator editor check groups passed in
  `work/organization-browser-x95nqmni/`, including 80-category scrolling,
  search/empty/error recovery, decimal requirements, duplicate-click protection,
  keyboard focus and 12 viewport/theme combinations.
- **4** real-API administrator eligibility/capacity browser groups passed in
  `work/organization-browser-94j0kjb3/`.

Browser verification found and fixed a stale archive-confirmation revision after
an opening changed and a Leaflet animation callback after editor teardown.
Manual coordinate changes now synchronize the marker; merely opening an editor
does not emit a pin change. All coordinator journeys passed after these fixes.

The older position dialog fixture still assumed new legacy opening creation.
It was updated to exercise retained legacy editing; current program creation is
covered by the real-API opportunity and coordinator suites. Early harness runs
also used the system Python without project dependencies, an incorrect test
module name, and imprecise selectors/transport routing; corrected runs above
passed. Those failed runs are not acceptance evidence.

No schema change or configured migration was needed. Browser assessments use
isolated synthetic SQLite records; transactional rules were checked separately
on PostgreSQL. Images pass through the real codec and database transaction with
object transport confined to the owned test directory. Address/map provider
responses are synthetic/cached. Live storage, hosted behavior and coordinator
content validation remain external checks. Owned helpers stopped after each run.

Implementation `337de9d` was committed on its feature branch and fast-forwarded
into local `main`. F19 extends this receipt with closed-opening behavior and
integrated regression results. [F19 acceptance](COORDINATOR_CATALOG_ACCEPTANCE.md)

[Backend authority](COORDINATOR_CATALOG_AUTHORITY.md) ·
[Extension and audit plan](INSTRUCTOR_PARTNER_POSITION_PLAN.md) ·
[Active tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md)
