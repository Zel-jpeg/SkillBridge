# Program batches and enrollment — F03

Feature branch: `codex/program-batches-enrollment`, based on `26edb37`.
See the [active tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for final
verification, configured migration and local merge status. Nothing is pushed or
deployed by this feature.

## Behavior

Every new batch belongs to one configured program. An instructor selects one of
their active assignments; an administrator selects an active program and an
active, approved instructor assigned to it. The institute comes from that
program, rather than from a second editable selector. Instructors can start
additional batches while another batch is active. A student still cannot be
enrolled in two active batches through the enrollment workflow.

Batch names and responsible instructors remain editable by administrators.
Reassignment of a program-bound batch requires an instructor assigned to that
same program. Its program cannot be changed by the batch update endpoint.
Sharing a program never grants access to another instructor's private batches.

Program selection uses server search and pagination, including institute names
and codes. New manual enrollments use the chosen batch's program; spreadsheet
rows retain their supplied labels for explicit review. The backend accepts the
selected program's code, name or configured aliases and rejects other programs.
Codes that happen to match in different institutes do not establish equivalence.
Existing student identity, active membership, duplicate and saved-allocation
checks still apply. An enrolled student's structured program comes from the
confirmed batch, never from a student profile edit.

Signed enrollment previews bind the current batch owner and program definition
as well as actor and reviewed rows. Changed labels/aliases or ownership require
a fresh review. Confirmation locks the institute used by catalog and assignment
writes, so revocation cannot bypass a confirmed operation in progress. A later
request observes the new assignment state. Completed requests retain their
existing request-ID recovery behavior under current batch authorization.

New program enrollees can complete the existing four-step student setup with
their assigned program, address, required map pin and phone. The profile API
rejects self-transfer. Enrollment email copy uses DNSC wording; the existing
durable send-now/send-later flow remains. Tests do not contact delivery providers.

Transfers validate the target's current program context before removing the
source membership. Different-program requests require a separate administrator
review of the student's program; this feature does not silently change it.
An old signed transfer review becomes invalid if its program context changes.

Revoking an instructor/program assignment removes their access to program-bound
batch records, assessment authoring, rosters, email controls, retake management,
placement management and their derived staff views on the next request, even
with the same JWT. Catalog archival stops new batches/enrollment without
automatically archiving existing batches or hiding their retained records from
the still-assigned owner. Frontend invalidations request current scope again;
they do not regrade assessments or regenerate issued reports.

## Existing IC records and migration

`0034_program_batch_context` adds three nullable protected foreign keys:
`api_user.program_id`, `api_batch.program_id`, and `api_batch.institute_id`.
Django creates their foreign-key indexes. It creates no new table and has no
data backfill. Existing mixed IT/IS memberships, statuses, scores, attempts,
notifications, allocations and report snapshots remain in place.

Unmapped existing batches retain their previous access and enrollment behavior;
their mixed IT/IS compatibility is tested. They are ordinary batches, with no
new historical/read-only state. Reviewed IC mapping is F14; this migration does
not guess that mapping, create catalog entries or infer instructor grants.

The migration operator supports only the selected pending migration, verifies
the inspected target fingerprint, takes a private public-schema backup, restores
it into an owned local PostgreSQL cluster and runs the actual Django migration
there before applying it to the configured target. It compares all previous
column values/counts and verifies that every new context value is null. Backups
stay under ignored `work/`; receipts contain no personal records or credentials.

Do not reverse this schema migration after program context is in use without a
separate reviewed recovery plan: dropping its columns would discard those new
relationships. The backup is recovery evidence, not authorization to reset data.

## Verification and remaining scope

API coverage includes required/type validation, scoped owner selection,
same-program privacy, revocation on an existing JWT, catalog archival, dynamic
aliases, signed reviews, duplicate/conflicting identities, request-ID replay,
profile self-transfer denial, transfer preservation and PostgreSQL grant versus
enrollment locking. A historical-model migration test compares every existing
field and confirms null additions.

The browser workflow uses a synthetic arbitrary institute/program, real Django
HTTP writes and a production frontend bundle. Student setup uses cached real
Leaflet assets with synthetic address and tile responses; external geocoding,
Google identity and email delivery remain unverified integrations. Browser SSE
transport is disabled in the fixture; backend recipients and frontend query
invalidation are checked separately.

Broader dynamic profiles/forms/filter copy remains F04. Program competency
frameworks, category reuse, opportunity eligibility, recommendation input
isolation, AIKEN, existing-record mapping and comprehensive report scope remain
their subsequent feature gates. Completing F03 does not complete the rollout.

Verification receipt, 5 November 2026:

- Full disposable PostgreSQL regression: 644 passed,
  `work/organization-postgres-u9eihfls/tests.txt`; includes the grant-revocation
  versus confirmed enrollment race and upgrade preservation.
- Frontend Node regression: 268 passed, `work/program-batches-node.txt`.
  Lint, production build, Django system check, migration drift and diff whitespace
  checks passed. Installed package entry points were used for lint/build.
- Final program browser workflow: six groups,
  `work/organization-browser-370oziqd/results.json`, with no page errors.
  Assignment regression: nine groups, `work/organization-browser-0c3km7k8/`;
  catalog regression: eleven groups, `work/organization-browser-p9lnfb49/`.
  Desktop and phone images were visually reviewed, including refreshed roster
  counts and the completed setup review.
- Migration operator rehearsal passed on a synthetic PostgreSQL source,
  `work/program-migration-operator-ucwit4i2/results.json`: 38 pre-existing public
  data tables preserved after actual backup/restore and Django rehearsal.
- Fixes found during verification: old test fixtures now provide explicit
  programs/grants; the old migration test uses historical model state; the new
  picker belongs to creation rather than archive confirmation; native dialog
  tags/scrolling are correct; new-batch creation is available with active batches;
  fixed validation errors clear when corrected; roster screenshots await current
  records. Earlier failed runs are superseded by the passing runs above.
- Configured migration 0034 applied after verified backup/restore and actual
  rehearsal: all 42 pre-existing public data tables retain their previous column
  values/counts; no new table, all three new context fields null. No regrading,
  reclassification or recommendation rerun. Receipt:
  `work/organization-configured-migration-46agfz8m/receipt.json`.
  The owned restore cluster is stopped. Local merge is recorded in the tracker.

Implementation `54303ec` was fast-forward merged into local `main` after all
verification and configured migration gates passed. No GitHub push or deployment.
