# Dynamic program profiles and onboarding — F04

Feature branch: `codex/dynamic-program-profiles`, based on F03 receipt `e1afb99`.
See the [active tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for final
migration and local merge status.

## Delivered behavior

Student setup and My profile display the program assigned through enrollment,
including its configured institute/name when structured context is available.
The program is read-only. The backend also rejects self-transfer requests for
unmapped existing students, rather than letting a student switch between IT/IS.
An unchanged legacy program label remains valid for ordinary contact/location
updates. Students without any recorded program must have enrollment corrected
by authorized staff before setup; the UI does not invent a program for them.

An administrator adding an instructor can optionally select a configured active
program. The account, grant and grant audit save together; an invalid/archived
selection or grant-audit failure creates neither account nor assignment. Institute
and program labels come from the selected record. Leaving this optional selection
empty creates an approved account with no implicit program access and blank
descriptive department/course fields. Additional grants use Institutes & Programs.

Existing descriptive instructor fields remain editable account information.
They do not confer access, even if their text names a program. The instructor
detail panel separately lists actual program assignments and links to their
management screen. Blank descriptive fields are allowed, so an unassigned
account can still be edited. Pending accounts no longer display invented IC/IT/IS
defaults. Existing saved IC descriptions are not removed.

Authenticated identity responses include the instructor's current assigned
programs. Instructor headings and account-menu labels prefer those grants;
revocation/organization invalidations revalidate the current identity on the
existing JWT. Students' identity labels prefer their structured program code.

Admin program-code filter options come from the entire student collection,
including records beyond the visible page. Instructor roster options use actual
batch data. These text-code filters are collection controls, not access grants;
program identity and batch authority use database IDs. Detailed institute/report
filter scope remains F13.

Login footers, new-assessment title hints, welcome emails and creation forms use
DNSC-wide wording. The remaining IT/IS enrollment buttons are confined to the
explicit existing-mixed-batch compatibility path. New program batches use their
configured program without a global two-course whitelist.

The existing reviewed membership-transfer flow is retained. This feature does
not silently move a student's program or evidence; a different-program transfer
remains blocked until staff resolve the program context through reviewed data
management. Existing IC mapping is F14, not part of this default change.

## Migration and preservation

`0035_neutral_user_department` changes the Django default for newly created
`User.department` from IC to blank. It has no data update, new table or column,
and preserves existing labels, program relationships, enrollments and evidence.
An upgrade test compares every old field and verifies the new-account default.

The existing operator additionally supports this reviewed default-only migration.
Before configured application it verifies target/pending plan, private backup,
local restore, actual Django migration rehearsal and preserved values/counts.
The rehearsal on an owned synthetic source passed at
`work/program-migration-operator-k4b5b32x/results.json`; all 38 pre-existing public
data tables were preserved. Configured application is recorded below only after
the remaining gates pass. No migration grants instructors access or assigns
existing students to a program.

## Verification receipt

- Full disposable PostgreSQL regression: **655 passed**,
  `work/organization-postgres-o5vlnucr/tests.txt`. Includes new-account/grant
  atomicity, role/type/archive validation, same-JWT identity freshness, immutable
  legacy/structured student programs, full-collection filter options and the
  historical-model migration preservation test.
- Frontend Node regression: **269 passed**, `work/dynamic-profile-node.txt`.
  Lint, production build, Django system check, migration drift and whitespace
  checks passed. No dependency changes.
- Real-API browser journey: **11 groups passed**,
  `work/organization-browser-frw28pon/results.json`, with no page errors. Retains
  F03 batch/enrollment/setup/privacy checks and adds program profile contact save,
  configured instructor creation, stale-program rejection/draft retention/retry,
  dynamic filters and phone/dark unassigned instructor creation.
- Existing profile layout workflow: **five groups passed**,
  `work/organization-browser-334or_ac/browser.txt`, including both addresses,
  single/zero/removed pins, validation disclosure and light/dark layouts from
  320 to 1440 pixels. Its old course-edit assertion now checks the explicitly
  required read-only program. Desktop profile and instructor creation images
  from the real API journey were visually reviewed.
- Existing draft recovery: **three groups passed**,
  `work/organization-browser-0py4f8el/browser.txt`. External-provider recovery:
  **three groups passed**, `work/organization-browser-of8szln3/browser.txt`.
  Test-only selectors/fixed preview addresses were updated; the external image
  fixture runs on Vite dev because it imports source modules. Primary real-API
  acceptance, profile layout and draft recovery use the production bundle.
- Configured migration 0035 applied after verified isolated backup/restore and
  actual rehearsal: all 42 existing public data tables retain their previous
  values/counts; no new tables or columns, no reclassification/regrading/rerun.
  Receipt `work/organization-configured-migration-j2licsf6/receipt.json`.
  The owned restore cluster is stopped. Local merge is recorded in the tracker.

Google identity, real email delivery, hosted deployment and live external-provider
availability are not claimed tested. Real-API setup uses cached real Leaflet with
synthetic addresses/tiles; older recovery tests use explicit provider fixtures.
No GitHub push or deployment is part of this feature.

Implementation `4241a66` was fast-forward merged into local `main` after all
verification and configured migration gates passed. No GitHub push or deployment.
