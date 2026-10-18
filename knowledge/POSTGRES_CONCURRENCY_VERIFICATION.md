# Disposable PostgreSQL concurrency verification

V04 ran against the workspace's disposable PostgreSQL 17.11 cluster on localhost
55438, using `core.sse_postgres_test_settings`, `PYTHON_DOTENV_DISABLED=1` and
`SB_TEST_DB_NAME=test_skillbridge_continuous`. Normal database credentials were
not loaded. The dedicated settings reject database names without `test_`.

`v04-postgres-final2.txt` records **60 passing tests, no skips** with individual
test names. Separate connections/threads exercise:

- Submit versus stop and duplicate submits: one finalizer, the other receives
  409. Saved answers/category scores exist once. Duplicate stops intentionally
  acknowledge the existing stop with 200; exactly one response says already
  stopped, with one violation/event and one saved evidence set. The first new
  assertion incorrectly expected a conflict for the idempotent stop contract;
  that fixture error was corrected, without changing application behavior.
- Two students competing for one remaining seat: one 201, one capacity conflict;
  one approved placement. Duplicate same-recommendation approval: 201 plus
  idempotent 200 with the same placement ID.
- Assessment authoring versus first delivery, in both orders: actual blocking
  is observed with `pg_blocking_pids`, not inferred from thread timing. An edit
  committed first is delivered; an attempt created first prevents later key/
  question changes. No partially edited grading evidence is delivered.
- Company image replacement/removal serialize and clean only retired owned
  objects. Existing rollback and cleanup-failure checks remain passing.
- An independent Python process sees no uncommitted event, only committed events
  for its recipient, and no rolled-back event. Two recipients receive different
  scoped topics. Stream tests verify connection release and terminal revocation.
  Outer commit/rollback and rejected operations publish no false success.

A related new test confirmed a placement batch-integrity defect: approval and
new rejection snapshots used the latest enrollment, even when the recommendation
belonged to another batch. V02 was explicitly reopened. New recommendation-origin
decisions now retain `recommendation.batch`, including approval of an existing
suggestion. Both approval and rejection stay in the owning instructor's report
despite a newer foreign enrollment. Existing historical records were not repaired.

Evidence: `v04-postgres.txt` (initial stop-contract fixture failure),
`v04-batch-snapshot-before.txt` (confirmed batch defect),
`v04-postgres-final.txt` (new rejection fixture omitted required remarks),
`v04-postgres-final2.txt` (all 60 pass). These logs are under
`work/defense_audit/`. Earlier full V02 run had 252 passing tests; the final
60-test run additionally covers the later snapshot correction and new races.
Do not describe the earlier full run as testing that later correction.

These are local integrity and transport checks. They do not prove hosted database
permissions, proxy/SSE support, all-device convergence or production performance.
