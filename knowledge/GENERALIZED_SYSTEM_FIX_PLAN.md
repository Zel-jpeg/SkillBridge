# Generalized system fixes

Authorized 8 November 2026 after the [readiness review](SYSTEM_READINESS_REVIEW_2026_11_08.md).
Each implementation change was tested on its own branch before merging locally.
Use the [staff workflow guide](MULTI_INSTITUTE_WORKFLOWS.md) for setup and
operation.

## Implementation checklist

- [x] G01. Restore the shared institute-batch disclosure in dashboard overview responses. Merged as `f6edec7`. Verified 21 PostgreSQL tests and the shared-visibility browser journey for IT, IS and a separate institute.
- [x] G02. Keep Add Skill available after a skill set is used. Saving creates an updated set and preserves the original evidence. Merged as `940bd1c`. Verified 43 PostgreSQL tests, including concurrent saves and retries, plus skill-editor and competency browser tests.
- [x] G03. Add position descriptions to staff forms, position details and recommendation text and freshness checks. Merged as `59dacfd`. Verified 51 PostgreSQL tests and the admin and coordinator position flows. Migration `0042` populated editable descriptions for the six existing IC openings.
- [x] G04. Add institute-wide shared skills with scoped access and editable program copies. Merged as `eb1fb58`. Verified 63 PostgreSQL tests and the competency browser flow, including an arbitrary non-IC institute. Migration `0043` added the shared catalog and verification confirmed all 12 existing IC shared skills.
- [x] G05. Distinguish current and earlier definitions in assessment and position forms. Explain saved batch selections, requirement compatibility and manual placement. Merged as `2ff57a0`. Verified lint/build and the assessment authoring and coordinator catalog browser suites.
- [x] G06. Update the workflow guide, run integrated regressions and record remaining hosted release gates.

## Data and operating decisions

- Existing IC cohorts, assessments, skills, positions and placement decisions
  stay in their regular institute scope. The shared batch view includes the
  original mixed roster. New batches belong to one program.
- Administrators maintain institute-wide skills. Coordinators can reuse those
  definitions and edit the program copies. A copy's later changes apply only
  within that program's library and follow the saved evidence rules.
- The six IC position descriptions were drafted from the saved titles, tags
  and requirements. Where their matching inputs became stale, administrators
  can refresh the affected scope from Placements. No configured refresh was
  run as part of these changes.
- A shared opening uses one set of numerical requirements and one seat count.
  An eligible batch that uses a different skill set can use manual placement.
- Tourism's empty catalog is intentional. The automated acceptance journey
  uses synthetic programs and students. Faculty content review and manual
  evaluation can continue later.

## Configured database checkpoint

Migrations `0042` and `0043` were rehearsed on verified disposable restores
before applying to the configured database. Verification compared existing
data across 44 tables, allowing the six planned description additions for
`0042`. The new shared catalog starts empty, with row-level security enabled.
The backup contents and receipts are private. The changes are local in Git.

## Local verification

The production-bundle browser journey exercised Entrepreneurship, Tourism
Management and a separate institute's Field Documentation program. It covered
real assessment submissions against the synthetic API, attempt recovery,
recommendations, a capacity-checked approval, and scoped reports. The shared
visibility journey confirmed that IC's mixed cohort appears through both
programs, with the full-roster disclosure. The import journey verified all 20
answer keys and the option order in the supplied DNSC export, plus mixed
SkillBridge question types. The export journey verified confirmed AIKEN
subsets and re-imported mixed SkillBridge questions. Scoped admin navigation,
reports and partner map checks passed at desktop and phone widths. All 821
PostgreSQL API tests and 322 frontend unit tests passed, along with frontend
lint and the production build.

The first local integrated submission timed out while suites ran together.
The rerun passed. A separate cold-load check of the NLP pipeline took about
22 seconds on the development machine. Hosted startup and concurrent submission
latency still need measurement on the intended service.

Local test receipts are in `work/position-descriptions/work/`. The full API
run is `organization-postgres-_765y9jg`, the integrated browser rerun is
`organization-browser-s25dkxiw`, and the shared visibility run is
`organization-browser-v0bbt5sx`.

## Remaining hosted release gates

- [ ] Settle the separate shell, modal and Realtime work and select one release revision. Rebuild and test that exact revision.
- [ ] Verify target settings, migrations and recovery for the hosted database and Storage, including public branding and private retake evidence.
- [ ] Run the authorized hosted journey with two institutes and multiple programs. Verify Google sign-in, real email delivery and worker processing, uploads, private evidence, map behavior, assessment recovery, placement and exports.
- [ ] Measure first-submission latency after a cold service start and test the expected concurrent cohort on the hosted runtime. Review errors, database connections and background jobs.
- [ ] If DNSC LMS exchange is part of acceptance, import the generated AIKEN file into an authorized LMS test bank and compare questions and answer keys.
- [ ] Have each participating coordinator review their skills, questions, role requirements and workflow. Record the intended release revision, hosted results and evaluator acceptance before school-wide use.
