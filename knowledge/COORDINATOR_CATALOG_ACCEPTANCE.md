# Coordinator catalog and system acceptance

F19 combines the coordinator extension with the multi-institute workflow.
The verification uses synthetic data for Tourism, Social Work and an arbitrary
program. The fixtures use the same configuration and authorization paths for
all three. The separate browser journey covers Tourism, Entrepreneurship,
Field Documentation and a retained mixed IC cohort.

## Workflow and regression evidence

| Area | Evidence and observed result |
| --- | --- |
| Program setup and roles | The integrated API fixture creates institutes, programs, grants and frameworks. The program-batches browser suite exercises assigned program selection, enrollment and onboarding. Coordinator catalog checks deny guessed IDs and revoked grants, and preserve the distinction between shared program definitions and private batches. |
| Partners and openings | The real API and browser checks create and edit entries before enrollment, reuse an organization, preserve creator authority, isolate sibling program openings and verify images, location and archive recovery. The administrator eligibility suite exercises a single shared opening and slot count across programs. |
| Authoring and files | Framework authoring, AIKEN import and questionnaire export browser suites pass. They exercise draft review, stale-digest rejection, publication, explicit category mapping, mixed questions, numerical zero and False keys, and protected exports. The original DNSC sample's 20 keys were verified in F15. |
| Student attempts and retakes | The phone journey starts the assessment, saves an answer, reloads, recovers the same timed attempt, reviews and submits. PostgreSQL covers omitted and foreign answers, duplicate IDs, stopped attempts, retake review, preserved earlier attempts, timeouts and competing writes. |
| Grading and recommendations | In each integrated API program, the expected combined totals are 3/3 for Records knowledge and 0/1 for Service knowledge, giving 3/4 or 75%. The stored values agree. The first required assessment leaves recommendations locked. The second unlocks the eligible opening. An edit stales its program's ranking while the independent program retains its ranking. |
| Placement and capacity | Coordinator approval uses saved recommendation evidence. Lowering slots below current approvals or archiving an occupied opening conflicts. The real browser verifies scoped manual approval, and PostgreSQL exercises two independent writers competing for the last slot and preserves the issued approval snapshot. |
| Reports and privacy | The downloaded F19 institute CSV contains both IBPA assessments, one valid submission each, and excludes Field Documentation. The scoped report browser test verifies program/batch choices and revocation of both the view and former CSV link. Prior placement PDF/XLSX evidence includes actual files with matching records, filters, counts and literal spreadsheet strings. See [report reconciliation](REPORT_RECONCILIATION.md). |
| Recovery and live updates | Chrome covers draft discard, stale revision review, a saved POST whose response was lost, removal of an editor after grant revocation and phone light/dark layouts. Frontend unit checks cover late responses, account switching and cache eviction. PostgreSQL covers batch reassignment and current server authority. |
| IC and migrations | The ordinary IC section retains its mixed cohort and both memberships in the browser. The F19 API scenario verifies the legacy batch row is preserved and the PostgreSQL suite verifies retained evidence, migration upgrades and rollback. The configured 0039 backup and restore receipt remains the authoritative record of the applied schema change. See [IC reconciliation](EXISTING_IC_RECONCILIATION.md) and [migration 0039](COORDINATOR_CATALOG_AUTHORITY.md). |
| Resource use | PostgreSQL tests exercise competing assessment and catalog mutations and shared capacity. Browser catalog checks cover 11 partner records and server-side pagination, while the admin editor checks 80 categories and the supplied sample contains 20 questions. The eight neighboring browser suites completed individually in 17.01–28.27 seconds, including setup and teardown. These workloads provide functional coverage. Large catalogs and deployment latency remain separate measurements. |

The source review followed the coordinator and admin routes through scoped
queries, validation, transaction locks, serialization and cache invalidation.
It also checked assessment attempt identity and stored category totals,
recommendation freshness and placement checks as distinct steps. The grading
and recommendation audits used the project assessment review and recommendation
audit skills. Browser and collection checks used their respective project skills.

## Findings register

| Finding and impact | Reproduction and cause | Resolution and verification |
| --- | --- | --- |
| F19-01. Medium. An administrator-closed opening appeared active and offered coordinator editing. | Create a coordinator opening, clear its program eligibility through the admin API, then fetch it as its creator. The empty eligibility set satisfied the ownership predicate and the view considered archive status alone. PATCH validation also substituted the selected program for saved eligibility. The new API assertion reproduced the incorrect `can_edit` flag. | The creator's editable opening requires exactly their assigned program as its eligible program. PATCH validation uses saved eligibility. The browser keeps the opening visible with a closed status and hides placement actions and hints. An administrator can restore eligibility. The fix and API/Chrome regressions are on the F19 branch. |
| F18-01. Medium. A valid archive operation could report a stale revision after an opening changed. | Change a position, then archive its partner immediately. The confirmation reused the previous revision. | F18 fetches the latest entry when opening confirmation. The coordinator browser suite exercises archive and restore. Repair `337de9d`. |
| F18-02. Low. A map callback could error after the editor closed. | Change coordinates and close the partner editor while Leaflet has an animation pending. | F18 synchronizes the marker and stops map animation during teardown. The browser rerun completed with zero page errors. Repair `337de9d`. |
| Test harness. Earlier F19 checks required current test identity and explicit catalog event delivery. | The forced-authentication fixture held old user fields. The first Chrome closure assertion reloaded within the catalog cache window while the harness intercepted SSE. An early Django check also omitted its synthetic signing key. | The API fixture reloads the current user, the browser delivers catalog invalidation after the real administrator write and Django checks use an explicit synthetic key. These corrections concern the test setup. |

## Verification receipts

- Initial F19 full PostgreSQL run. **752 passed** in 271.965 seconds.
  Evidence `work/organization-postgres-2dnymiae/tests.txt`.
- Final full PostgreSQL run after F19-01. **753 passed** in 240.658 seconds.
  Evidence `work/organization-postgres-ihbbx556/tests.txt`.
- Final focused PostgreSQL run after F19-01. **24 passed**, including coordinator
  catalog, opportunity scope and integrated acceptance.
  Evidence `work/organization-postgres-43cslhcr/tests.txt`.
- Frontend lint and build passed and **285 unit tests** passed after F19-01.
  Evidence `work/f19-final-build.txt` and `work/f19-final-frontend-tests.txt`.
- **Eight** integrated browser check groups passed, including the real phone
  assessment. The review and report screenshots and the CSV were inspected.
  Evidence `work/organization-browser-do41zmlc/`.
- Eight neighboring browser suites passed with **31 check groups**.
  Evidence `work/coordinator-audit-2chy9_2s/`. Suites with JSON summaries
  report their checks in the per-suite logs.
- The earlier **20** coordinator and admin browser check groups are recorded
  in the [coordinator screens receipt](COORDINATOR_CATALOG_SCREENS.md).
- The final coordinator browser rerun passed **11** groups after F19-01,
  including administrator closure and reopening.
  Evidence `work/organization-browser-y2hjck3f/browser.txt`.
- Django system and migration drift checks passed with isolated settings.
  F19 requires no migration. Migration 0039 was applied and verified during F17.

## External evaluation

The local checks establish software behavior on the scenarios above. Tourism
participation and Social Work's actual workflow require confirmation. Use the
evaluator checklist to record usability, questionnaire validity and recommendation
relevance as separate findings. Hosted behavior, live Google and email, map and
storage availability, and importing a generated AIKEN file into the DNSC LMS
require access to their respective authorized test environments.

[Evaluator demonstration checklist](COORDINATOR_EVALUATOR_CHECKLIST.md) ·
[Staff workflow](MULTI_INSTITUTE_WORKFLOWS.md) ·
[Implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md)
