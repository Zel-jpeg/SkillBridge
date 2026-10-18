# Local validation and recovery audit

Status: E01 local validation/recovery criteria passed. This map records evidence
and the boundaries of later verification; it is not a second task checklist. The continuous development file is
the only execution tracker.

## Action and persistence boundaries

| Flow | UI → backend boundary | Local evidence / remaining checks |
|---|---|---|
| Login/onboarding/recovery | Login/AdminLogin → role-specific verified Google/admin password routes | A07/A05/A06 tests cover domain/role/active/approval/enrollment gates, provider rejection/outage and assisted recovery. No live provider action. |
| Profile/setup | StudentProfile/Setup → own-profile PATCH → validation + locked atomic save and combined recalculation | New malformed/duplicate ID, course/contact/address/pin, partial PATCH preservation and downstream rollback tests; profile browser retains fields after 400/network/invalid response, blocks double writes and confirms explicit retry. |
| Enrollment | StudentEnrollmentModal → preview/token → transactional per-row enrollment and truthful notification queue results | Existing synthetic import tests pass. Re-preview protects uncertain confirmations. Official IAMS compatibility blocked on sample; 11 synthetic enrollment browser cases passed; official compatibility remains unverified. |
| Batches | Staff batch screens → instructor-owned/admin batch endpoints | Existing ownership/archive and management tests pass; typed names, atomic archive/recalculation and two browser recovery cases verified. Selected-batch unenrollment preserves other memberships and score history; two browser cases verify failed-confirmation retention and explicit selected-batch retry/reload. |
| Authoring | InstructorUpload and question editors → create/add/PATCH → whole-payload type validation + atomic nested writes | Invalid later questions create nothing. Failure replacing choices preserves old question/key; failures creating/appending roll back new rows. Published question edits/additions require usable classification/key. Composite metadata/question saves are atomic and return canonical IDs; two browser recovery cases passed. Parent-row locks coordinate edits with attempt starts; dedicated race coverage remains V04. |
| Authoring drafts | Builder → account/role-scoped local key | Own draft restores; another account/legacy unowned draft is ignored. Invalid saved draft shapes are ignored. Old unowned keys are retained without being displayed. |
| Assessment attempts | StudentAssessment → start/submit/stop/retake | A01/A02 authoritative denominators, attempt identity and server expiry; A06 preserves draft/timer through renewal. PostgreSQL races and synthetic browser evidence retained. |
| Catalog | Company/position forms → shared input validation → atomic company/requirement changes | A03 validation/capacity/permissions/history protection; failed drafts/delete confirmations retained. |
| Recommendations | Student results → batch-scoped combined API → exact deterministic ranking | N01/N02 fallback/gates/empty/locked tested. Malformed result envelope is rejected before cache/React and retry recovers. |
| Admin accounts | AdminUsers → account PATCH / soft-archive DELETE / restore PATCH | Browser-only fake success removed. Backend role/reference/duplicate validation; archive is idempotent, keeps batches/enrollments/history; department is stored by migration 0015. Failed edit/archive stays open; confirmed writes update cached collections even if follow-up read fails. |
| Placements | Action/manual dialogs → locked capacity/evidence checks and snapshots → refresh | Existing API tests pass. Hook separates confirmed mutation from failed refresh; two browser cases verify retained remarks, one pending write, safe errors and explicit refresh after a committed write followed by failed GET. |
| Reports | Generate/download → scoped snapshot endpoints → PDF/XLSX/CSV | Existing report filters/authorization tests pass; P03 capacity and company-area labels verified. Two combined taxonomy/report browser cases verify retained state, safe failures and retry/download. Report data reconciliation remains V02. |
| External address/map services | AddressDropdowns/geocoder/Leaflet loaders | External failure work is E02; corrupt address cache/provider row shapes verified in the profile browser fixture. Broader provider failure coverage remains E02. |

## Changes verified so far

Own-profile PATCH validates supplied fields before writing: YYYY-NNNNN student ID,
BSIT/BSIS course, 11-digit `09…` phone, bounded text, supported preference values
and complete finite coordinate pairs. Omitted fields/address parts survive PATCH.
Coordinates at zero are valid; explicit null/null clears a pin. Role/email cannot
be changed through a student profile. Recalculation failure rolls back the profile.
Identity races return a safe conflict. Existing real profiles are not repaired.

Authoring validates text/type/category/choice/key types across the full payload
before any create/add, and question/choice writes share an atomic transaction.
Draft questions may remain incomplete; publication and published edits require
valid keys. JSON API request envelopes must be objects, retaining list-valued
fields and multipart uploads. Notification scope recovery now propagates parse
errors to DRF's 400 path rather than swallowing them as an empty request.

Shared Axios requests have a 30-second timeout; explicit bulk recommendation/model
comparison requests allow 120 seconds. Only authentication 401 can trigger the
existing single coordinated replay. Uncertain writes are never automatically
replayed. Successful responses from a previous authenticated session are rejected
before local state/cache updates. Blob/download responses retain their contract.
Critical collection/profile/results/account envelopes are checked before use;
malformed success responses do not create fake IDs, report false success or poison
the cache. Messages distinguish unconfirmed saves and advise checking current
records. Error objects/arrays/HTML and internal 500 details are not React children.

Setup token/form debug logs were removed. Notification scope logs record exception
type without raw error details; the render boundary records a fixed diagnostic
message. No raw real identities or credentials are used in these fixtures.

## Evidence and limits

- Before fixes: `e01-profile-before.txt` (6 failed subcases/9 errors) and
  `e01-authoring-before.txt` (10 failed subcases/4 errors) reproduced unchecked
  values, partial writes and lost address data. Initial admin account tests hit
  missing endpoints/browser-only behavior (`e01-admin-before.txt`).
- Latest full isolated PostgreSQL API run: **245/245 passed**, no skips,
  `e01-postgres-final.txt`. Migration 0015 ran only in disposable test setup.
- Latest frontend: **110/110 passed**, lint zero errors/five baseline warnings,
  build passed after the final E01 UI edits (`e01-{unit,lint,build}-resumed.txt`).
- Browser evidence: profile/draft/cache 3, results 5, admin accounts 2, batches 2,
  composite authoring 2, taxonomy/reports 2, placements 2, real-token sessions 6,
  isolated enrollment 11 and selected-unenrollment 2 cases passed. These are
  focused synthetic checks, not broad V01/V07 acceptance. The resumed profile
  fixture also checks truthful notification availability. Initial resumed browser
  runs timed out against a sandbox-started Vite server; restarting the fixture
  server resolved this. Failed harness runs remain in the evidence directory.
- The profile notification checkbox was a documented shell with no persistence
  or delivery path (refs/Security_Assessment_Report.md). The agreed profile
  fields do not include a result-email feature. Its inert control was replaced
  with truthful unavailable guidance; no notification service was invented.
- Source/acceptance reconciliation complete for E01. External provider failures
  continue under E02; official importer compatibility, report data reconciliation,
  PostgreSQL races, security, broad role/device workflows and performance retain
  their separate unchecked tasks. No E01 evidence substitutes for these gates.

All evidence is under `work/defense_audit/e01-*` and the corresponding frontend
`tests/artifacts/` folders. Migration 0015 was applied only by test database setup;
the configured Supabase database was not migrated or accessed. Formal security,
performance, compatibility, workflow and hosting tasks remain separate acceptance
requirements. See the continuous checklist for the next actionable task.
