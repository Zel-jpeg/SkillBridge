# Working branch review — 20 October 2026

**Follow-up:**the user authorized fixes after this review. All three findings are
addressed in the working tree; see [fixes and verification](RECOMMENDATION_FRESHNESS.md).
Migration0020 and an admin rerun are required in the intended runtime; neither was
performed on Supabase. The original review observations below are historical.

Reviewed `codex/nlp-phased-improvements` against local `main` at `effb2a8`.
There are no branch commits ahead of main. The changes reviewed are uncommitted,
including untracked source, tests, migrations and documentation. Application code
and tracked test expectations were not edited during this review.

## Findings

### P1 — Existing recommendations can remain approvable after requirements change

This is **pre-existing**, not introduced by the current diff. Position updates
replace requirements in `api/views.py:3583` without invalidating saved matching
inputs. Approval later copies the saved recommendation into a placement snapshot
at `api/views.py:4230` without verifying those inputs against the current catalog.

A fresh synthetic probe reproduced: saved score 92.5; change Programming
requirements to Networking; student results remain unlocked with 92.5; approval
returns 201 and snapshots 92.5; deliberate recalculation produces 32.5. NLP is
deterministically mocked to isolate the category change. These are synthetic
behavior results, not effectiveness measurements. The position edit, approval and
combined-evidence functions are AST-identical to HEAD.

Follow-up: version/invalidate ranking-affecting inputs, reject stale approvals,
and provide a deliberate recalculation path while retaining placement history.
Refreshing frontend caches alone does not recalculate saved scores.

### P2 — Shared category endpoint returns 500 for malformed names

This is **pre-existing**. `api/views.py:834` calls `.strip()` before checking the
name's type. Fresh requests with null, list, number and object names each returned
500; none inserted a category. This endpoint is unchanged from HEAD. Reuse the
strict category validation contract and return field-level 400 responses before
performing writes. The separate admin skill endpoint already has stricter checks.

### P2 — New dashboard fixture breaks the enrollment browser regression

This is **introduced in the working changes** at
`skillbridge-frontend/tests/enrollment_server.py:39`.

The existing already-enrolled account was changed to the name/email used by
spreadsheet row 9, while retaining a different Student ID. Row 9 then correctly
becomes an identity conflict. The spreadsheet's original already-enrolled row
also conflicts. The unmodified browser test fails at line 82 because its expected
two ready enrollments become one, with two conflicts.

Keep the original enrollment fixture account and create a separate, noncolliding
dashboard account. A review-only wrapper did this without editing tracked files
or weakening any assertions: all 11 enrollment scenarios and both dashboard
checks then passed. This isolates a test-data defect rather than an application
identity-validation regression. The checked-in fixture still needs correction.

## Changes reviewed

- Expanded existing-file vocabulary: 35 category lists, 33 role profiles and
  suggestion-only aliases. Network-role aliases and broad Tools fallback exclusion
  remain. Known titles prefer role vocabulary; unknown titles use up to two
  specific positive requirements, preferring saved category tags. General
  role/category compatibility filtering is still a proposal.
- Advisory question category keyword fallback for the added vocabulary. It does
  not grade answers or add categories automatically.
- Enrollment list/card review, edit/revalidation state, confirmation guards,
  pagination, dialogs, toasts and cache refreshes.
- Shared student-name formatting, first reviewed enrollment of a provisional
  account, preservation of established names across Google sign-ins, and the
  given-name dashboard greeting.
- Davao-first student address options, clearer single-pin guidance, and setup
  branding. Province codes, address storage and pin behavior are retained.
- Historical migrations 0016–0018 plus experiment cleanup migration 0019;
  current models contain no experiment fields or tables.
- Updated project/NLP/enrollment/address documentation. The separate independent
  defense-review deliverables were preserved as earlier review artifacts.

Ranking, answer grading, generated matching-text functions, preprocessing,
60/25/15 weights, combined completion gates, capacity and placement rules were
not changed by this diff. Updated tags can affect future matching only when saved
and subsequently used to generate matching evidence; this is not a claim of
better accuracy. Suggestions remain bounded vocabulary rather than company facts.

## Fresh verification

| Check | Outcome |
| --- | --- |
| Full `api` suite on isolated PostgreSQL | 308 passed, zero skips |
| Frontend Node tests | 178 passed |
| Frontend lint and production build | Passed |
| Django system check; migration drift | Passed; no changes detected |
| Migration 0018 → 0019, new disposable PostgreSQL database | Passed; only four experiment tables and six Position columns removed; all other table content hashes identical |
| Actual local Django/Chrome vocabulary and position-tag workflows | Seven workflow groups passed; no page errors |
| Enrollment and dashboard browser tests, original fixture | Failed on the new fixture collision described above |
| Same enrollment/dashboard assertions with separate synthetic fixture accounts | 11 enrollment and two dashboard checks passed; no page errors |
| Catalog validation, assessment save/recovery, admin assessments and recommendation browser regressions | Passed |
| Offline address/map recovery plus Davao optgroups | Passed; original province codes retained, no automatic selection, outside-Davao selection and save preserved |
| Existing defect probes | Both defects above reproduced; this is confirmation of defects, not application acceptance |
| `git diff --check` | Passed; Git emitted only line-ending conversion notices |

Passing model-error-path tests intentionally log mocked missing/bad model errors.
The full PostgreSQL suite's final status was OK. One initial review probe wrapper
failed test discovery because its temporary execution namespace was not registered
as `__main__`; correcting the review wrapper allowed both probes to run. No
application change was needed for that harness issue.

Logs and review-only runners: ignored `work/defense_audit/branch-review-*` and
`work/defense_audit/branch_review_*.py`. The original enrollment failure log is
retained separately from the isolated-fixture success log.

## Boundaries and status

No confirmed application regression was found in the reviewed changes, but the
two pre-existing application defects prevent a blanket claim that everything is
safe. Automated checks do not establish coverage of all titles, concurrent races,
browser engines or real-world matching effectiveness. Live Google, email, maps,
Supabase and hosting were not validated; external browser requests were blocked
or fulfilled with synthetic fixtures.

The vocabulary, name and UI updates require no new schema of their own. Pending
0016–0019 migrations in another environment must be assessed as the historical
experiment-cleanup chain: 0019 permanently removes experiment contents. This
review ran migrations only against disposable local databases, and did not
recheck or mutate the configured Supabase database.

No live recommendations, student records, deployments or external messages were
created. The new migration database was deleted after verification. All owned
Vite/API processes and the PostgreSQL test cluster were stopped. No commands
remain running. No application fixes, commit or phase continuation was performed.
