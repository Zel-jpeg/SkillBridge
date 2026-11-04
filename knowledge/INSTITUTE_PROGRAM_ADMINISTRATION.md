# Institute and program administration — F01

Implemented on `codex/institute-program-admin` from local `main` at `1fa6e1d`.
Implementation `920afe8` was fast-forward merged into local `main` after checks
and configured migration completed. This is the first feature in the
[sequential tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md). Completion and
configured-migration status are recorded below; later features remain separate.

## Delivered behavior

Administrators open **Institutes & Programs** in the existing sidebar. They can
create/edit institutes, open a selected institute's programs, and create/edit
program codes, names, descriptions and optional aliases. Search by name/code,
status filters, counts and shared eight-record pagination operate on server
results. Search/status changes reset the requested page; the server clamps a page
when the collection shrinks.

Archiving retains records and IDs. Archive active programs before their institute;
restore the institute before adding/restoring an active program. Restoring a
parent does not silently restore its children. The API exposes no DELETE route.
The program's institute is immutable through program edits.

This feature creates an empty configurable catalog. It does not seed any specific
institute, move existing students, change batch statuses or add an IC-specific
mode. Instructor assignments and links to existing users/batches belong to the
next features and final reviewed mapping. Existing workflows remain available.

## API and validation

| URL | Methods | Contract |
| --- | --- | --- |
| `/api/admin/institutes/` | GET, POST | Paginated institutes or create |
| `/api/admin/institutes/{id}/` | GET, PATCH | Read/edit one institute |
| `/api/admin/institutes/{id}/programs/` | GET, POST | Paginated programs in this institute or create |
| `/api/admin/institutes/{id}/programs/{program_id}/` | GET, PATCH | Read/edit only within the stated parent |

All routes require an active admin account; normal JWT access checks still apply.
Instructor/student direct requests are denied. Unknown payload fields, foreign
parents, malformed types and unsupported/repeated collection parameters fail
without partial writes. Names are bounded at 255 characters, codes at 30,
descriptions at 2,000, and optional aliases at 12 entries of at most 255 characters.
Codes normalize whitespace/case. Codes/names have case-insensitive database
uniqueness (program uniqueness within the institute). Codes, names and aliases
cannot ambiguously identify another program in that institute, including archived
programs. Parent row locks serialize related program writes and archive/restore.

Writes save actor/target audit records atomically and publish organization-topic
invalidation only to active admins after successful commit. No student identifiers
are included in this topic. Frontend response validation rejects malformed success
payloads before caching. Mutations refresh the institute detail as well as its
lists/program counts, preventing cached active state after an archive.

Native shared dialogs retain keyboard modality and focus restoration; save guards
prevent duplicate pending submissions. Failed saves retain the form and require
an explicit retry. GET errors expose a retry control; empty filters have Clear
filters. Production-bundle browser checks exercise the real local API with
synthetic accounts and block external providers.

## Schema and migration

Migration `0032_institute_program_catalog` creates `Institute` and `Program`.
It adds two tables with protected parent relationships and uniqueness constraints.
No existing model fields or data are rewritten. Fresh/upgrade checks begin from
0031 and compare every pre-existing API model's rows using synthetic records,
including an existing mixed cohort and saved scores.

The optional operator script
[migrate_organization_catalog.py](../skillbridge-backend/scripts/migrate_organization_catalog.py)
defaults to a read-only plan/target fingerprint. Its apply mode accepts only the
reviewed 0032-only forward plan and inspected target. It backs up the configured
public schema, restores it into an owned loopback-only PostgreSQL cluster,
compares data hashes, and only then creates the catalog tables inside a transaction.
It compares pre-existing public tables after migration and checks that both new
tables are empty. The backup covers public, not Supabase storage/auth schemas.
Private backups remain in ignored `work/`; receipts contain hashes/counts/schema
facts instead of credentials or record contents. No grading/recommendation helper
is called. No rollback drops a populated table automatically.

Configured application result: **0032 applied successfully on 4 November 2026**.
The public-schema backup was restored to isolated local PostgreSQL and matched
before migration. All **39 pre-existing public data tables** retained their row
counts/hashes, and both new catalog tables are empty. Only the Django migration
ledger gains the expected migration record. No data was seeded, reclassified,
regraded or recalculated. Receipt: ignored
`work/organization-configured-migration-t8mvo0ab/receipt.json`. The backup is private
and must not be committed or shared. The task-owned restore cluster was stopped.

## Verification and corrections

- **614 backend tests passed** on fresh disposable localhost PostgreSQL with
  dotenv disabled. Full evidence: `work/organization-postgres-vx1jwrjd/tests.txt`.
- **265 frontend Node tests passed**, plus ESLint and the Vite production build.
  Installed Node script entry points run the repository's lint/build commands;
  no dependency files changed. Evidence: `work/organization-node.txt` and
  `work/organization-build.txt`.
- Django system check passed; migration drift check found no changes.
- **11 real-API production-bundle browser groups passed**, with no page JavaScript
  errors. Evidence: `work/organization-browser-l608w_zu/results.json`, screenshots
  and viewport geometry. Covers CRUD/aliases, role denials, search/count/page
  reset, empty states, cancel/Escape/focus, hierarchy guards, duplicate validation,
  failed-save/no-replay and GET recovery, and 1440/768/390px plus phone dark mode.
- Desktop and phone viewport screenshots were visually inspected. Desktop heading
  starts beyond the sidebar; full-page screenshot capture can differ during
  browser viewport resizing, so viewport captures and actual element geometry
  are the visual reference. Forms fit the phone viewport.
- Git diff whitespace checks pass. Documentation link checks are required at merge.

Initial checks were not all passes. Corrected a serializer error shape that
caused unknown fields to raise a server error; create-dialog titles, accessible
form/filter labels and stale institute-detail invalidation were fixed during
browser verification. The old cycle migration test now verifies its original
0028 no-new-table contract, then restores the current migration leaves, instead
of incorrectly imposing that contract on every future migration.

Test-runtime corrections included localhost CORS, installed headless Chrome when
the optional bundled Chromium runtime was unavailable, a properly enrolled
synthetic student for JWT role-denial checks, and a recovery assertion scoped
separately from notification toasts. The sandbox blocked the initial loopback
database connection; the reruns used the approved isolated runtime. No live
records were used as application-test fixtures.

These checks do not verify hosted routing, actual school adoption, external
providers or all future multi-institute workflows. F01 is catalog administration;
it is not completion of the whole generalization project.

## Local Git handoff

Planning branch `codex/multi-institute-plan` was committed and fast-forward merged
to local main at `1fa6e1d`. F01 implementation `920afe8` was then committed and
fast-forward merged locally after its feature and migration gates passed.
No GitHub push or deployment was performed. Only task-owned test helpers are
started/stopped by the supplied verification runners.
