# Instructor/program assignments — F02

Subsequent integration: [F03 program batches and enrollment](PROGRAM_BATCHES_AND_ENROLLMENT.md)
now applies these current grants to program-bound cohorts. The F02 receipt below
describes its original feature boundary and verification.

Implemented on `codex/instructor-program-assignments`, based on completed F01 at
`02e20f0`. See the [active tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md).
Configured migration and local merge receipts are recorded below when completed.

## Behavior

From **Institutes & Programs**, open an institute and choose **Manage instructors**
on one program. An admin can assign existing active, approved instructors, revoke
one program assignment, or restore it. Lists have server search, eight-record
pagination and assignment-status filters. The instructor picker shows existing
active assignments and does not create or email accounts. Account creation stays
in Users.

Each `InstructorAssignment` links an instructor to one program; its institute is
derived from that program. The same instructor can have multiple programs, even
in different institutes. Revoke/restore preserves the assignment's ID and creator,
and records the updating admin. Duplicate grant requests return the same active
assignment without another audit row or invalidation. No endpoint physically
deletes an assignment.

Only admins manage/view membership lists or candidate accounts. Instructors can
read their own currently authorized program options, not another instructor's
assignments. Program membership does not confer a colleague's private batches.
Effective access requires an active assignment, active approved instructor, and
active program/institute. Revoke takes effect on the next server request with the
same JWT; tokens do not contain a durable copy of assignments. Archived contexts
can retain assignments, but cannot receive new/restored grants until restored.

This stage supplies the assignment contract and authorized options. Program-bound
batch/enrollment enforcement is F03; shared program categories are F05. Existing
unlinked cohorts remain unchanged rather than being locked out by a new empty
assignment table. No IC-specific rule, mandatory seed or existing-data rewrite
is introduced.

## API

| URL | Methods | Access |
| --- | --- | --- |
| `/api/admin/institutes/{i}/programs/{p}/instructors/` | GET, POST | Admin membership list or idempotent grant |
| `/api/admin/institutes/{i}/programs/{p}/instructors/{assignment}/` | PATCH | Admin revoke/restore using typed `is_active` |
| `/api/admin/institutes/{i}/programs/{p}/instructor-options/` | GET | Admin active/approved account picker |
| `/api/management/programs/` | GET | Admin active catalog or instructor's effective assignments |
| `/api/management/programs/{p}/` | GET | Same current-scope check for a selected program |

Mutation payloads reject extra fields, invalid IDs and self-assignment by
non-admins. Parent paths must agree; assignment IDs cannot be moved to another
program. Institute row locks serialize program grants and parent archive/restore;
instructor row locks recheck eligibility at grant/restore. Audit failure rolls
back the complete write. The unique instructor/program constraint prevents
duplicate rows.

Assignment events target admins and the affected instructor only. Organization
changes also invalidate options for assigned instructors. These event payloads
contain topics, not private student IDs. Current authorization always comes from
database state; notification transport is not the authorization mechanism.
Frontend response/cache contracts validate list envelopes, parent IDs and explicit
access flags. Account changes invalidate candidate/grant queries too.

## Verification

- **629 backend tests passed** on fresh disposable PostgreSQL, including 14
  assignment API/permission/rollback/event tests and a new 0032-to-0033 preservation
  test. Final evidence: `work/organization-postgres-d56ir3zd/tests.txt` (629 passed).
- **267 frontend Node tests passed**; ESLint and Vite build passed. Evidence:
  `work/assignments-node.txt`, `work/assignments-build.txt`.
- Django system check and migration drift check passed.
- **Nine new real-API browser groups passed** against the production bundle:
  grant/current-JWT access, nested-dialog Escape/focus, duplicate grant identity,
  revoke/restore and multiple-program independence, both paginated searches,
  503/no-replay and explicit-retry recovery, role/foreign-path denials and private cohort
  ownership, desktop and phone light/dark modal scrolling/footer access.
  Evidence: `work/organization-browser-opz5mn0j/results.json` and screenshots.
- **All 11 F01 browser groups still pass** after integration:
  `work/organization-browser-8y8t8etv/results.json`.
- Desktop assignment and phone dark-mode picker screenshots were visually
  inspected. No page JavaScript errors occurred in either browser suite.

The first assignment browser replay stopped at an Escape assertion because a
native search input can consume Escape to clear its query. The corrected check
focuses a regular control before testing modal dismissal; no application access
rule or assertion about save behavior was weakened. Synthetic server fixtures
provide eligible accounts and block external network/provider traffic.

The browser fixture disables live SSE transport, so recipient/privacy checks are
backend tests and frontend invalidation tests, while HTTP revoke-without-relogin
is exercised against the real local API. Hosted delivery and complete future
multi-institute workflows are not claimed by these checks.

## Migration and local merge

Migration `0033_instructor_program_assignment` adds one empty table with protected
instructor/program relationships, actor references and uniqueness. It does not
infer assignments from free-text department/course fields or modify users,
enrollments, assessments, scores or decisions.

The operator helper now explicitly supports reviewed 0032/0033 selections and
still rejects an unexpected target or a plan containing more than the one
selected forward migration. A public-schema backup must restore and hash-match
in an owned local cluster before it applies the configured migration. Backups
remain private under ignored `work/`; no credentials or records are in this note.

Configured 0033 result: applied after a verified isolated public-schema backup
restore on 4 November 2026. All **41 pre-existing public data tables** retained
their hashes/counts, and the new assignment table is empty. Receipt:
`work/organization-configured-migration-w3op0r26/receipt.json`. No assignments,
emails, scores or user changes were generated. The owned restore cluster stopped.
Implementation `1b237b0` was committed and fast-forward merged into local `main`
after its final regression and migration gates passed. F02 is complete. F03 may
proceed on its own branch under the continuous sequential workflow.
The final full regression passed after preserving explicit collection ordering
when reusing the pagination helper for assignment rows.
No GitHub push or deployment is authorized or performed.
