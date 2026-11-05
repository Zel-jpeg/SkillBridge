# Assessment-led recommendations

For program-scoped cohorts, opening eligibility and positive requirements from
the recorded framework determine the candidate set. Scoped evidence and role
requirements use exact category IDs. The older virtual-equivalence rule
described below applies to the legacy path. [Current scoped matching contract](SCOPED_RECOMMENDATION_INPUTS.md)

## Admin rerun feedback correction — 3 November 2026

Both existing admin rerun buttons now use the same frontend helper and a
120-second limit. The previous dashboard request inherited the Axios 30-second
default; it could display failure while the synchronous backend continued saving
results. This was a confirmed code-path mismatch, but the original screenshot did
not include a network trace proving the individual request's failure type.

Confirmed completion, partial processing errors, authorization rejection and
uncertain completion have distinct messages. Timeout, lost response, malformed
completion data and server errors do not claim that all processing failed. The
uncertainty warning stays inline after the brief toast expires. Current authorized
GET views revalidate after complete, partial or uncertain outcomes; existing
SSE/visible polling can display later server changes. A GET refresh cannot prove
the entire rerun finished, so it does not convert the warning to success.

The helper shares one pending POST between entry points in the same authenticated
session. Timeouts and network/server errors never automatically replay that POST.
This is frontend request coordination, not a backend job lock across browsers.
The backend remains synchronous; a two-minute wait does not improve computation
speed or guarantee completion at arbitrary scale. Durable background job/status
tracking remains a separate proposed improvement.

This correction changes no backend, database schema, recommendation calculation,
NLP model, grading or card layout. Tests use mocked clients and fully intercepted
synthetic browser API calls; no real recommendation rerun is performed.

Verification: **321 frontend tests passed**, including eight focused cases for
request sharing, partial errors, uncertain completion, authentication boundaries,
no automatic replay and valid zero/malformed result handling. ESLint and Vite
production build passed. **Eight browser checks passed** against the production
bundle with intercepted API responses; a response held for **31.6 seconds** now
completes successfully past the former dashboard limit. Both entry points display
the appropriate warning/success, retain recovery guidance and revalidate GET data.
No real backend/DB was contacted. Temporary preview was stopped. These checks
verify request/feedback behavior, not live rerun duration or backend throughput.

Local source implementation, 3 November 2026. This changes suggestion ordering,
not assessment grading, category-score calculations, authoring inputs or the NLP
model. Deployment and real-student recalculation are separate actions.

## Scope and presentation

Preserve the existing student, instructor and admin card layouts and category-based
skill profiles. The user explicitly rejected the added explanation sections and
minimum-count presentation. Those sections were removed. Necessary recommendation
values, labels and tooltips use the existing layouts; no application CSS or UI
dependency is added by this change.

Valid finalized category scores remain visible when only the recommendation
inputs/policy are stale. The existing completion, integrity, source-evidence,
active-batch and profile-review gates still protect assessment evidence. The
additional `competency_locked` response flag distinguishes evidence visibility
from `recommendations_locked`. This adds no database field. Stale suggestions
remain hidden and cannot support approval until explicitly refreshed.

## Personal position ordering

`api/recommendation_policy.py` defines version `assessment-led-20261103-v1`:

1. Average capped attainment of each positive numerical minimum, descending:
   `100 × mean(min(assessed_percentage / minimum_percentage, 1))`.
   Missing evidence contributes zero attainment but is separately marked unassessed.
   An assessed zero has raw/max evidence and is distinct from missing evidence.
2. Requirement-demand alignment, descending:
   `100 × sum(min(positive student score, role target)) / sum(positive student scores)`.
   This is an explicit, experimental preference rule. Minimum percentages are not
   independently measured job importance. This ratio is never used to compare
   competence across students.
3. Supporting score, descending: `(25 × NLP% + 15 × location%)/40`.
4. Stable position ID for exact ties.

Coverage and demand alignment precede support; they are not blended into a new
60/25/15 suitability percentage. Rounding at display time does not change grades
or whether each minimum is met. Sub-100 coverage cannot display as 100.0%.
100% coverage means the listed numerical minimums are met, not perfect grades,
model confidence or guaranteed job suitability. The main value is a personal
recommendation order such as `#1`, with coverage/NLP/location in existing details.

All existing categories participate. Virtual equivalence requires both the same
canonical category name and the same normalized saved tag vocabulary; original
category IDs/history are not merged. Equivalent raw/max evidence is pooled.
Different vocabularies stay distinct. Conflicting equivalent targets raise a
catalog-review error instead of silently picking one.

NLP profile generation, position text, preprocessing/model selection, TF-IDF fit
and raw similarity calculation remain unchanged. Saved raw NLP similarity is
still a percentage, not its weighted contribution, accuracy or confidence.
Contextual text-overlap metadata uses the same fitted vectors and does not claim
separate mastery of individual tags. No question-level extraction is activated.
Locations outside a preference area remain available; nearest sorting is retained.

## Shared slots and coordinator decisions

Personal recommendations and shared provisional allocation are separate.
`api/assessment_allocation.py` automatically considers pairs with all positive
minimums assessed and met, using remaining capacity after existing approvals and
valid coordinator choices. It maximizes number placed, then minimizes total
available personal preference rank, then maximizes actual assessed mean across
the role's required categories, then supporting NLP/location. Stable IDs resolve
remaining ties. The personal demand ratio does not compare students.

Below-target and unassessed alternatives remain available for coordinator review.
The numerical policy does not add a hard approval cutoff. Existing authorization,
freshness, enrollment and capacity rules continue to govern approval. Refreshing
suggestions does not approve placements or move existing approved students.

## Persistence and compatibility

Django migration `0031_recommendation_assessment_order` adds two columns to the
existing `Recommendation`: nullable `assessment_rank` and JSON `assessment_details`
with an empty-object default. It adds no table or data migration.

Legacy `match_score` and category/NLP/location components retain their old meanings;
coverage never overwrites the hybrid field. New payloads expose explicit rank,
policy, details and coverage fields. Personal lists select saved rank; position
candidate lists compare required-category evidence. Company grouping uses its best
position rather than averaging roles. Existing recommendation IDs survive reruns.

Future approvals freeze rank/details in existing `ManagementAction.metadata` under
`placement.recommendation.snapshot`, in the same transaction as the approval save.
Old placements without this event retain their original component snapshots and
are labelled as legacy references. History never reconstructs a past rank from a
mutable recommendation. Cycle closeout JSON includes available versioned evidence;
previously saved archives are not rewritten.

## Verification and activation

Verification artifacts are ignored under
`work/assessment_led_integration_20261103/`. Tests disable dotenv and use owned,
loopback PostgreSQL databases with synthetic records. Browser checks use a
production bundle and real local API for all roles. Controlled preprocessing is
used for deterministic ranking fixtures; these are regression checks, not model
effectiveness measurements or independent suitability judgments.

The 0030 → 0031 upgrade check confirms two columns, no new table, unchanged grades,
legacy recommendation values, placement snapshots and audit records. A configured
database migration must first show only 0031 pending. Its receipt records schema
facts and hashes, without credentials or personal records.

After the authorized migration, restart the local backend/frontend as necessary.
Use the existing admin recommendation rerun deliberately to refresh active results.
Students do not retake assessments. Do not auto-rerun real records during migration.
The new ranking policy deliberately makes old recommendation fingerprints stale.
If a local and hosted backend share one database, do not recalculate shared real
results until the backend serving those results runs the matching policy version.
The added columns alone are compatible with the old app, but the new fingerprint
written by a rerun is not accepted by the old backend. Use an isolated database
for further local workflow tests while the hosted application remains on old code.

Final verification, 3 November 2026:

- Fresh owned PostgreSQL: **593 backend tests passed**, including concurrency,
  permissions, freshness, history, grading, policy and profile-preservation checks.
- Frontend: **313 Node tests passed**; ESLint and Vite production build passed.
  The machine's npm launcher is broken; installed Node entry points ran the same
  lint/build scripts without changing dependencies.
- Production-bundle browser checks: **13 passed** against a synthetic local API,
  including all three roles, mobile results, old/new decision history, stale
  suggestions with retained category profiles and partner browsing. No JavaScript
  or API errors were observed. External map services were blocked in this fixture;
  this does not validate hosted routing, email or external integrations.
- Original card class layouts for four main card/dashboard consumers match their
  pre-implementation source. Eight unrelated file hashes remain unchanged.
- Django system check passed; migration drift check found no changes; Git diff
  whitespace check passed.
- Configured Supabase: only migration 0031 was applied. Receipt confirms **two
  columns, zero new tables**, unchanged hashes of grades, existing recommendation
  components, placements and audit records, and **zero recalculated rows**.
- No deployment, push, real-student recommendation rerun or assessment regrading.

For code rollback, the additive columns can remain while the old application runs;
do not drop columns containing new evidence or rewrite historical decisions.
Review fingerprint compatibility and explicitly regenerate recommendations under
the restored policy if rollback becomes necessary. No deployment, push or schema
rollback is included in this implementation.

Correctness and deterministic invariants do not establish that the new policy is
unbiased or improves placement outcomes. No student-specific exceptions exist.
Independent suitability review and the revised model comparison remain separate
research validation work; the existing NLP model is not claimed to be newly proven
effective by these application checks.
