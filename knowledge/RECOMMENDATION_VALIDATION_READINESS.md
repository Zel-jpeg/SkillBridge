# Recommendation validation readiness and evidence checklist

Date: 31 October 2026. Status: plan prepared; effectiveness validation and
application integration remain incomplete. This is a completion contract, not a
claim of 100% accuracy, no bias, or guaranteed future recommendations.

3 November follow-up: the above date/status describes the original research
checklist. Local application integration and regression checks are now complete;
the user authorized publication. See the [implemented contract](ASSESSMENT_LED_RECOMMENDATIONS.md)
and [release record](RECOMMENDATION_RELEASE_2026_11_03.md). Independent suitability
and NLP-effectiveness validation remain separate and are not established by
application regression tests. Historical options below are not new product-input
requirements or restrictions on the subsequently authorized release.

## Active scope correction

The user narrowed the work to improving the current suggestion feature using
existing data and preserving current product functions/workflows. Follow the
[active engine-fix scope](RECOMMENDATION_MATCHING_REVIEW_AND_FIX_PLAN.md#current-scope-improve-the-existing-suggestion-feature-only).
New duties entry, question-annotation features, preview screens and staff review
workflows are not required for this repair. Richer-data gates below describe an
optional broader study; they are not permission requirements or implementation
blockers for correcting demonstrated behavior with existing inputs. Validation
judgments can be collected outside the product without adding application features.

For the focused repair, validate current score/requirement/tag inputs, compare
metric/text changes locally, preserve current APIs/flows and run relevant parity,
freshness/history/authorization regressions. Do not turn the earlier blank
duties/annotation review packet into a prerequisite for this narrower task.

## Agreed direction and current reviewer situation

The user selected separate requirement-coverage and strongest-skill explanations.
No new combined weight or strongest-category-first ranking has been approved.
The user can review development cases now; no additional reviewer is available.
Use the designation **single developer/reviewer, provisional**. Do not claim
independent expert validation or inter-reviewer agreement from this arrangement.

Previously seen cases remain development/debugging cases. Fresh cases can be
judged before displaying algorithm outputs, which reduces ranking anchoring but
does not remove the reviewer's involvement in system design. An additional
qualified assessor is desirable for independent corroboration. Two reviewers are
a study-quality recommendation, not a universal legal or statistical requirement.

Continue the [matching review/fix plan](RECOMMENDATION_MATCHING_REVIEW_AND_FIX_PLAN.md)
and follow the [phased NLP handoff](NLP_PHASED_IMPLEMENTATION.md) for implementation.
Keep application/data changes local until a selected phase is authorized.

For future admin additions, the review plan's
[catalog growth contract](RECOMMENDATION_MATCHING_REVIEW_AND_FIX_PLAN.md#contract-for-future-catalog-additions)
defines generic category identity, unknown evidence, confirmed tags/duties,
NLP corpus-policy choices, versioned catalog changes and regression invariants.
It introduces no selected NLP winner or new combined ranking weight.

## What already counts as evidence

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Two authorized cases, six eligible assessments each, saved-answer and raw/max reconciliation | Observed individual and combined calculations are consistent | Assessment content validity or general recommendation quality |
| Twelve saved position matches reproduced with strict spaCy Medium | Local component parity on the observed catalog | An independent accuracy result |
| Seven-method sandbox and 84 comparisons | Behavior of proposed numeric/text changes | That larger percentages or changed winners are better |
| Eleven declared NLP diagnostics and 132 comparisons | Sensitivity to text construction and preprocessing | A selected best NLP method |
| 215 nonzero factorial synthetic profiles and 42 positive-score transitions | Representation collisions and nonmonotonic text behavior | Real-world effectiveness or independent expected-role labels |
| Synthetic metric tests and desktop/mobile report QA | Properties and usability of the disposable experiments | Full API authorization, integration, hosted latency or release readiness |
| Enclosed catalog extension using current unchanged Django code in disposable PostgreSQL | Twelve synthetic start/submit flows matching authorized totals, original-score parity, admin creation/automatic reranking, student result API checks and sensitivity to fictional requirements/sites | Correctness of the fictional employer requirements, independent suitability judgments or validation of an experimental replacement through production integration |

The local test artifacts are under
`work/recommendation_sandbox_20261031/`. They are disposable and ignored by Git.
The reviewer starter packet is in its `readiness/` subfolder. Those local paths
may disappear after cleanup; this document records aggregate findings only.
No names, contacts, individual student vectors, answer keys or private responses
belong in tracked plans, research fixtures or test logs.

## Gate 1: Freeze the task and facts

Owner: user initially; confirm role facts with a knowledgeable catalog owner or
partner before making claims about actual work suitability.

- [ ] Decide whether saved percentages are desirable target levels or hard minima.
  They are not upper limits or percentages of working time. Keep importance weights
  and essential-category rules explicit rather than inferring them from targets.
- [ ] Review Database versus Database Management equivalence and every conflicting
  target. Preserve raw/max, original category identity and historical snapshots.
- [ ] Review all six current roles' actual duties, relevant tags, target levels,
  permitted training/support and essential gaps. Mark uncertain facts provisional;
  do not invent duties from a title or expand targets to fit a particular student.
- [x] Keep requirement attainment and strength alignment separate in explanations.
- [ ] Decide how the displayed list is ordered when coverage, strength demand and
  travel preferences disagree. Displaying two outputs alone does not settle ranking.
- [ ] Confirm capstone/adviser constraints on retaining category cosine, NLP and
  weights. The current algorithm can remain a comparator even if the new contract
  changes its numerical metric.

Exit evidence: a dated, versioned policy and reviewed catalog; no unresolved
essential fact silently represented as confirmed.

## Gate 2: Make the skill evidence defensible

Owner: assessment author or a person competent to review the item content.

- [ ] Review question-to-skill annotations against what the question actually
  assesses. A lexical keyword match is a suggestion, not confirmation.
- [ ] Preserve question/category identity, annotation version, review basis and
  provenance. Keep answer keys and private response text out of reviewer exports.
- [ ] Reconcile correct/assessed counts against eligible submissions and combined
  raw/max. Include wrong/unanswered items; preserve batch, inclusion, retake,
  submitted/stopped/flagged and completion rules.
- [ ] Distinguish unassessed skills, assessed zero, a few correct items and justified
  claims of competency. Agree evidence coverage/minimums with the assessment owner;
  do not invent a universal item count or mastery threshold.

Exit evidence: an annotation review record and count-reconciliation report.
The observed direct lexical-cue coverage is incomplete; it cannot substitute for
this review or establish the skills tested by every question.

## Gate 3: Match the real computation before comparing methods

Owner: implementation agent. Build and test this path locally first.

Current [evaluation code](../skillbridge-backend/api/nlp_evaluation.py) has useful
diagnostics but cannot serve unchanged as the final multi-assessment validation:

- `real_data()` selects the latest submitted individual assessment before an
  approval and uses its `SkillScore` rows. Production uses eligible batch-combined
  evidence. Historical retakes can also overwrite source score rows.
- Prepared evaluation fits TF-IDF over multiple student profiles plus positions;
  production fits it separately for one student plus the common candidate catalog.
- The historical evaluator's candidate/evidence selection must be reconciled with
  current archive, active-batch, flag and inclusion rules.
- Existing approval agreement is a retrospective proxy and can reflect the existing
  recommender. It is not independent suitability ground truth.
- The five-case minimum is explicitly a demonstration threshold, not a sample-size
  justification or a readiness certificate.

Required parity fixtures cover raw/max aggregation, source inclusion, catalog and
candidate ordering, input text, actual preprocessing model, per-student corpus,
components, rounding, ties, stale inputs and all-zero/missing evidence. A final
study must identify which historical inputs are actually reconstructable.

Exit evidence: local production-parity adapter, deterministic parity tests and
version/hash manifest. Do not mutate live profiles to make an evaluation run.

## Gate 4: Collect judgments without showing the rankings

Owner: user now; add a qualified second reviewer when possible.

1. Calibrate the rubric on a small development pilot using reviewed catalog facts.
   This pilot is for workload/ambiguity discovery; its results are not final-test
   accuracy. Do not keep changing a rubric after seeing final algorithm results.
2. Give a reviewer de-identified evidence and role facts in randomized candidate
   order. Hide system ranks, similarity scores, expected answers and company branding
   where unnecessary. Do not lead with "this is a network student."
3. Judge every candidate on **role suitability** and **use of assessed strengths**
   separately. Allow multiple good roles, ties, none suitable and insufficient
   evidence. Record rationale, material gaps and confidence.
4. Capture labels and rubric version before running/inspecting algorithms on those
   cases. Keep reviewer judgments separate from code-produced features and text.
5. With a second reviewer, preserve original independent judgments, report agreement
   and adjudicate differences before final scoring. With one reviewer, disclose that
   limitation and do not fabricate agreement statistics.

Suggested starting rubric for reviewer confirmation:

| Grade | Role suitability | Strength use |
| --- | --- | --- |
| 0 | Clearly unsuitable on reviewed evidence/essential duties | No meaningful use of the assessed strong areas |
| 1 | Conditional fit with substantial gaps/support needs | Limited use of those areas |
| 2 | Suitable with the role's confirmed permitted training | Substantial use of a strong area |
| 3 | Strong fit on reviewed duties and evidence | Strong alignment with principal assessed strengths |
| Unknown | Cannot judge from available evidence | Duties/evidence do not support a judgment |

Grades are reviewer judgments, not direct conversions from category percentages.
Unknown is not zero. Review essential facts before using this rubric. A 100% score
from ten items alone does not establish professional mastery.

Exit evidence: complete timestamped judgments, exposure notes and rubric version.
The original two observed cases and familiar synthetic cases stay in development.

## Gate 5: Freeze the study and acceptance policy

Owner: user/adviser with implementation support. Complete this before opening the
final held-out results, not after choosing a favorable method.

- [ ] Define the deployment population and candidate catalog. Decide claims about
  one batch versus future batches, roles and question sets.
- [ ] Split by student/group before method selection; all attempts/records for a
  student stay in one split. Account for reused templates/cohorts and disclose any
  remaining dependence. Final test cases must not already have informed tuning.
- [ ] Use development/pilot variability and the required precision to justify final
  sample size and role support. No universal case count establishes validity.
  Count students as units; six position scores from one student are not six
  independent students. Report sparse/missing role support.
- [ ] Select primary metrics appropriate to the two outputs. Proposed: graded
  NDCG@3 for suitability and a separately reported strength-use NDCG@3; Top-1
  reviewer-acceptable rate and per-role errors are supporting checks. Confirm
  relevance grades/cutoffs before scoring. Do not average the two axes into a
  new objective without an explicit decision.
- [ ] Require full candidate judgments for the chosen metrics or preregister a
  missing-judgment policy. Never impute unknown as irrelevant. Handle all-zero
  relevance/no-suitable-role cases separately; do not discard them to improve scores.
- [ ] Freeze practically meaningful gain, acceptable regressions, uncertainty,
  runtime budgets and quality criteria. Values remain unset until reviewed; there
  is no externally guaranteed 80%, 90% or 100% passing grade.
- [ ] Freeze ties and score conversion. If using the scikit-learn NDCG definition,
  record its linear relevance gain and logarithmic discount; do not silently swap
  in exponential gain or a different tie policy. Use paired student/group-level
  uncertainty estimates and report inconclusive results honestly.
- [ ] Lock selected code/model/configuration, input/mapping versions, data manifest,
  candidate order and rubric before evaluating the final cohort.

Exit evidence: a completed lock file and acceptance criteria, not an empty template.

## Gate 6: Compare enough controls to identify a contribution

All methods see the same approved inputs, cases, candidate catalog and conditions.
Develop/select on development labels only; do not repeatedly optimize on final test.

| Comparator | Question answered |
| --- | --- |
| Current full 60/25/15 implementation | What changes relative to today's system? |
| Coverage/mapping candidate with current text | What is the effect of the numeric/category change? |
| Coverage + location without NLP | Does text add value beyond the revised numeric evidence? |
| Same reviewed specific evidence, structured matching without NLP | Do better inputs help a simple structured method equally? |
| Same evidence + revised TF-IDF, regex preprocessing | What does text similarity contribute? |
| Same evidence/text/TF-IDF + strict spaCy | What does trained preprocessing add? |

For the no-NLP hybrid comparator, document normalization of the retained relative
weights (60:15 becomes 80:20) or another predeclared comparison scale. Leaving a
maximum-75 score and comparing its absolute numbers with a maximum-100 score would
be misleading. Do not calibrate to make a particular student/company win.

Keep labels out of profile text, tag selection, question annotation and role
description generation. Do not introduce an embedding model as a required winner.
If desired later, it is a separately versioned candidate with the same evidence,
declared score transformation and resource cost.

Report every method, per-role support, helped/hurt cases, both outcome axes,
confidence/uncertainty, excluded/unknown/no-fit cases and timing boundaries. Numeric
increases are not proof of accuracy. No NLP gain is a legitimate finding; do not
force an NLP superiority claim. If the final comparison is inconclusive, label it
so. Further tuning needs a new untouched test cohort.

Exit evidence: a reproducible comparative report and a justified selection or
explicit no-winner decision. The "most suitable" method means the selected method
under this task, rubric and population, not the universally best NLP algorithm.

## Gate 7: Engineering and release readiness

- [ ] Refresh the mandatory dependency audit before application edits. Preserve
  current role scopes and unrelated working-tree changes.
- [ ] Version metrics, canonical mappings, reviewed inputs, models and weights;
  include them in freshness. Store explanations from the inputs used at generation.
- [ ] Preserve original assessment scores, combined raw/max, attempt history,
  archived batch records and placement snapshots. Label legacy semantics correctly.
- [ ] Test authorization, completion, inclusion, retakes, stopped/flagged evidence,
  unknown/zero evidence, unavailable models, empty text, ties, missing coordinates,
  stale reads/approval rejection, capacity and concurrent operations.
- [ ] Verify every student/staff view and export displays coverage, strength demand,
  uncertainty and gaps consistently. Review existing analytics/review bands.
- [ ] Run targeted Django tests on disposable PostgreSQL, frontend tests, lint/build,
  and real API/browser workflows. Record failures and unverified integrations.
- [ ] Check local-to-intended-runtime model availability, measured end-to-end latency,
  migration compatibility, explicit refresh, small pilot monitoring and rollback.
- [ ] Reconcile manuscript and implementation claims. Production deployment and
  database mutations need their own authorized scope; this document performs none.

Exit evidence: versioned implementation, passing relevant checks and concrete
release/rollback instructions. No scientific result alone proves these checks.

## Readiness states and next step

| State | Required evidence | Current state |
| --- | --- | --- |
| Diagnostic understanding | Reproduction plus controlled counterexamples | Achieved for the observed scope |
| Development plan prepared | Sequenced work, owners, artifacts, decision gates | Prepared in this document |
| Controlled pilot ready | Reviewed facts/rubric, local parity, fresh blinded judgments, predefined pilot criteria and engineering checks | Pending |
| Independently validated effectiveness | Independent suitable-case judgments, untouched final cohort, frozen method and comparative evidence | Pending; additional assessor/data needed for this claim |
| Integration/release ready | Selected justified behavior plus Gate 7 | Pending |

Exact next step: user completes the policy/catalog sections of the local reviewer
packet, marking uncertain duties provisional. Then prepare fresh development cases
and reviewed question-skill annotations without displaying algorithm outputs.
The implementation agent can build the local combined-evidence parity adapter in
parallel once that implementation scope is requested. Do not rerun known cases
and label them independent validation.

## Methodological sources and scope

Metric choice must match the recommendation task; a metric can favor a different
algorithm without establishing it is best for another task. See
[Gunawardana and Shani, JMLR](https://jmlr.org/papers/v10/gunawardana09a.html).
For the documented NDCG computation and tie behavior, see
[scikit-learn NDCG](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.ndcg_score.html).
These sources guide methodology; neither certifies SkillBridge, its chosen weights,
this rubric, sample size or a passing percentage. Pages checked 31 October 2026.

## Checkpoint

Latest active direction and completed disposable evidence are recorded in the
[assessment-led checkpoint](RECOMMENDATION_MATCHING_REVIEW_AND_FIX_PLAN.md#latest-checkpoint-assessment-led-suggestion-experiment).
Its existing-input scope supersedes earlier broader duties/annotation collection
next-step instructions. Option 3 and option 4 are local candidates; no production
integration or independently validated NLP replacement is complete. NLP similarity
need not be numerically high to be legitimate; assess its supporting behavior.

Branch: `main`. Application source and live data unchanged by this planning work.
Only readiness documentation, the review-plan link and disposable reviewer packet
are in this request's edit scope. Existing unrelated frontend/catalog-layout work
must be preserved. New plans and empty reviewer forms are not completed validation.
