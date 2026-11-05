# Multi-institute acceptance and handoff

F16 completes the local implementation sequence after the F15 receipt
`174c3c1`. The changes on `codex/multi-institute-acceptance` add the combined
synthetic acceptance journey and extend its existing test fixtures. Production
behavior is the implementation already verified in F01–F15.

## Acceptance evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Complete API regression on disposable PostgreSQL | 734 tests passed | `work/organization-postgres-ptt8pe0b/tests.txt` |
| Frontend unit regression | 284 tests passed | `node --test` over the existing `src/**/*.test.mjs` and `src/**/*.test.js` files |
| Frontend lint and production build | Passed | `npm run lint`, `npm run build` |
| Django system and schema drift checks | Passed | `manage.py check` and `makemigrations --check --dry-run`, using `core.test_settings` |
| Combined three-role journey | Seven groups passed | `work/organization-browser-_qv5rqbz/browser.txt` |
| Dynamic program creation, enrollment and onboarding | Six groups passed, zero page errors | `work/organization-browser-82_bgyy0/browser.txt` |
| Report revocation and stale local cache | Two groups passed | `work/organization-browser-d3dg6dju/browser.txt` |
| Scoped ranking and stale input isolation | Three groups passed | `work/organization-browser-n6wbvh8h/browser.txt` |
| Category summaries, assessed zero and report downloads | Five groups passed, zero page errors | `work/organization-browser-xmnmoftv/browser.txt` |

The combined journey creates synthetic Entrepreneurship and Tourism programs
under IBPA, an arbitrary Field Documentation program in another institute, and
the retained mixed IC cohort. It starts and submits assessments through the
normal HTTP APIs. All three program cases return the expected scores and
framework-scoped recommendations, reject a foreign assessment and reject a
repeat submission.

Staff checks verify same-program category reuse while denying another
instructor's private roster and questionnaire keys. Categories with the same
name retain distinct identities. The administrator's institute filter produces
an actual CSV containing both IBPA assessments and their submission counts.
Manual approval rejects an opening belonging to the sibling program, accepts
the eligible opening and consumes its shared slot. The existing IC cohort stays
active with its original two synthetic memberships.

The first combined run stopped on a test assertion that inspected the CSV's
in-progress column. The corrected assertion resolves **Valid submitted** from
the downloaded header. The complete rerun passed. The downloaded CSV and
desktop/phone screenshots were inspected.

The full PostgreSQL result was retained from before the pause because F16 changed
only synthetic fixtures, browser checks and documentation. It includes the
existing migration preservation, rollback and concurrent capacity tests.
F14's [configured reconciliation receipt](EXISTING_IC_RECONCILIATION.md) records
the backup restore, approved catalog links and preserved data.

## Local handoff

Use the [staff workflow guide](MULTI_INSTITUTE_WORKFLOWS.md) for institute
configuration, grants, competencies, authoring, enrollment and placement review.
Use the [implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for
the feature branches, local merge receipt and configured migration history.

The supplied DNSC questionnaire imports with all 20 questions, choices and keys
preserved. The F15 Chrome runs verified both format help and actual AIKEN/native
downloads and re-imports. Importing a SkillBridge-generated AIKEN file into the
DNSC LMS still requires an authorized LMS test question bank.

Program examples and grades in these checks are synthetic. Faculty review of
new program definitions, questionnaire validity and independent recommendation
evaluation is an operational acceptance activity. The browser harness blocks
external services by default. Result screenshots exercise the map recovery
state, while the onboarding regression uses synthetic geographic responses.
External map/provider availability and hosted production behavior remain
outside this local verification.

All feature changes and merges are local. GitHub publication and deployment
remain subject to the user's separate instruction.
