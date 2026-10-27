# Assessment recovery branch integration review

Date: 27 October 2026. Branch: `codex/assessment-recovery-retake-requests`.
Reviewed base: `b13254b`, matching local main and origin/main after fetch.
Scope: all working-tree changes intended for this branch, including new files.

## Changes reviewed

- Neutral assessment interruption recovery, server-validated drafts, timer and
  attempt-identity protections, and the five-minute local inactivity reminder.
- Assessment-specific student retake requests, image preview/drop input, server
  WebP conversion, private evidence reads and instructor/admin review.
- Migrations 0025/0026: recovery/request columns on existing records and guarded
  500-character explanations. No new tables for retake storage.
- Responsive student profile layout, unchanged profile save handler and visible
  map marker removal when clearing the saved pin.
- Placement alternative choice publication, consistent dialog/approval target,
  background list reconciliation and distinct save/refresh failure feedback.
- Student archive/restore confirmations and audits, preserved read-only history,
  account filters, recorded previously unenrolled lists and verified re-enrollment.
- Shared routes/navigation, invalidation, response contracts, tests and docs.

Assessment-level score history, weighted combined evidence, ranking weights,
placement snapshots, explicit approval and capacity rules remain distinct. The
profile `handleSave` source matches the base exactly. No dependencies changed.

## Findings corrected before integration

1. Two historical migration tests restored only their own older target version,
   leaving subsequent tests without newer columns. Both now restore the graph's
   current leaf targets. The first full run's missing-column failures were test
   isolation errors; the corrected complete suite passed.
2. The new interruption flow had removed stale local-marker cleanup for attempts
   already finalized on the server. Restored cleanup for confirmed finalization
   while preserving recovery of active attempts. Slow-save/lost-acknowledgement
   tests verify no false stop or repeated finalization.
3. A confirmed retake request waited for another read and could appear unsaved
   if that read failed. The confirmed response now updates immediately; refresh
   failure has separate feedback without requiring resubmission. Synchronous
   pending refs guard duplicate student/reviewer activation. Mutation envelopes
   must confirm the saved request state before reporting success.
4. Retake timestamps explicitly use Asia/Manila. Read-only review wording covers
   archived accounts, batches or assessments without falsely identifying a cause.

Added migration regressions verify preserved attempts/scores/history, an unchanged
table set and refusal to truncate explanations longer than 500 characters. Older
browser fixtures now use policy-directed interruption review and archive labels.

## Verification

| Check | Result |
| --- | --- |
| Complete Django `api` suite on fresh disposable PostgreSQL | **451 passed, zero skipped** |
| All frontend `*.test.mjs` suites | **206 passed, zero skipped** |
| Frontend lint and production build | Passed |
| Django system check and migration dry-run | Passed; no ungenerated model changes |
| Profile save comparison against base | Handler unchanged |
| Changed-file credential/artifact scan | No private keys/token patterns, local databases or binaries |
| Markdown links and Git whitespace check | Passed |

Browser verification uses installed headless Chrome. Changed workflows cover
student/instructor/admin scopes, confirmation/cancel, image preview, private
evidence, read-only archives, duplicate activation, conflicts, delayed/failed reads,
failed saves, retries, pagination, focus and responsive light/dark layouts.

Synthetic API suites: retake recovery/review; assessment inactivity; profile layout;
profile draft recovery; external-provider recovery; placement choice; placement
collections; admin batches; timer recovery; submission timeouts; shared student
detail modal. Real local React/Django suites: placement draft workflow and student
record recovery, using disposable SQLite fixtures and mocked enrollment email.
These 13 suites passed 140 workflow groups with no page errors.

The PostgreSQL run also covers row-lock races, authorization, scoring/retakes,
combined competency, NLP diagnostics/evaluation/management, catalogs, capacity,
placements and migration preservation. It destroys the test database and stops
its temporary cluster. Normal database credentials are disabled.

Ignored execution evidence:

- `work/branch-review-postgres-3htmjii9/tests.txt`
- `work/branch-review-node.txt`, `work/branch-review-build.txt`
- `work/branch-browser-*.txt`
- `skillbridge-frontend/tests/artifacts/` suite-specific JSON/screenshots

## Limits and rollout

No remaining regression was identified in these checks. Tests cannot establish
an absolute absence of defects. Physical mobile calls/notifications, hosted
latency, production OAuth, real email delivery and a new live Storage upload were
not exercised in this integration pass. No normal database/student records were
used in these branch integration tests.

Prior authorized migrations/private-Storage verification is documented in
[assessment recovery](ASSESSMENT_RECOVERY_AND_RETAKES.md). This pass reviews the
private bucket/authenticated-download contract against the current
[Supabase Storage documentation](https://supabase.com/docs/guides/storage/serving/downloads),
but changes no live database, bucket, policy, credential or deployment.

Use migrations 0025/0026 and a configured private `retake-evidence` bucket wherever
this code is deployed; fresh migration is tested here. Previously unenrolled
lists cannot invent pre-audit removals. Account archives preserve approved
placements and do not automatically release occupied seats.

User authorization covers committing the verified branch and merging into local
main. Remote push/deployment is separate from this local integration.
