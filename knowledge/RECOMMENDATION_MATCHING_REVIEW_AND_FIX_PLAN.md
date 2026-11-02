# Recommendation matching review and proposed fix plan

## Rerun feedback follow-up completed — 3 November 2026

Branch: `main`. The dashboard/settings rerun buttons now share a 120-second
request limit, same-session pending request, honest complete/partial/uncertain/
rejected feedback and authorized GET revalidation. No automatic mutation replay.
Card layouts, assessment evidence, grading, ranking/NLP/location, backend and
schema were not changed by this follow-up. No real-student rerun or deployment.

Checks actually run: 321 frontend tests (eight new focused cases), ESLint,
production build and eight intercepted browser checks passed. Delayed success
was confirmed at 31.6 seconds; timeout/network/server/partial/permission handling
and both entry points passed. Earlier incomplete synthetic fixtures were corrected
and superseded by the final browser receipt. Eight unrelated file hashes match.
Temporary preview server stopped automatically. No final failures remain.

Artifacts: `work/recommendation_rerun_20261103/`. Contract and limits are recorded
in [the assessment-led note](ASSESSMENT_LED_RECOMMENDATIONS.md).
The backend remains synchronous and the change does not prove faster computation
or job completion after an uncertain response. Original screenshot error type is
still unconfirmed without its network trace. No further action is required for
this local request-handling fix; hosted rollout and background processing remain
separate work. Do not rerun real records merely to verify this UI correction.

Date: 31 October 2026. Branch at review: `main`.
Status: review and planning complete; application changes, catalog edits,
deployment, live migrations and recommendation regeneration are not performed.

## Latest checkpoint: assessment-led suggestion experiment

### Main-source local implementation authorized — 3 November 2026

User authorized safe implementation and, after code/isolated checks, migration
for testing. Retain requirement coverage; omit the v12 listed-minimum-count UI.
Keep NLP inputs/model unchanged and no training/question-topic work. Branch main;
unrelated frontend catalog work is hashed/preserved. Audit recorded before app edits
in NLP_IMPLEMENTATION_AUDIT.md. Test artifacts and owned PostgreSQL are under
`work/assessment_led_integration_20261103/`. No live records were refreshed.

- [x] Trace current backend/frontend/schema/history/approval dependencies.
- [x] Record audit, unrelated source hashes and baseline frontend 308 tests.
- [x] Isolated PostgreSQL baseline: 71 passed; baseline frontend: 308 passed.
- [x] Integrate pure evidence/order, persistence, additive migration and freshness.
- [x] Integrate API/collections/analytics/reports and capacity/manual-choice paths.
- [x] Freeze future approval evidence in existing audit JSON; preserve old snapshots.
- [x] Integrate frontend order, coverage, details and legacy/history labels.
- [x] Verify focused/full backend, migration upgrade, frontend tests/lint/build,
  browser journeys, concurrency/history and unrelated-file preservation.
- [x] Confirm intended DB target and pending plan, then apply the authorized
  additive migration for testing only. Do not auto-rerun real-student results.

User correction during integration: preserve original card layouts for every role
and retain all category-based skill profiles. The added card explanations were
removed. Ranking staleness is now separate from numerical evidence visibility via
an API flag, not another database column; completed assessment status also stays
independent of suggestion freshness. No grading formula or assessment record changes.

Final verification: **593 backend tests passed** on a fresh dedicated owned
PostgreSQL database; **313 frontend tests passed**; ESLint/Vite build passed;
**13 production-bundle browser checks passed**, including original category cards
and skill profiles for all roles when suggestions are stale, plus partner browsing.
Migration upgrade preservation, Django check/migration drift and Git diff whitespace
checks passed. Four main card class layouts match the pre-implementation source.
Eight unrelated file hashes remain unchanged.

Configured Supabase migration **0031 is applied**: two Recommendation columns,
zero new tables. The receipt confirms unchanged protected records and **zero real
recommendation recalculations**. No deployment, push or assessment regrading.
Owned test PostgreSQL is stopped; browser processes use automatic cleanup and
artifacts remain ignored under the integration folder.

Preliminary test logs include stopped overlapping runs and an obsolete analytics
expectation; these are superseded by backend-final-clean.txt and browser-receipt.json.
No final verification failures remain. External map/routing, hosted performance
and independent NLP/suitability effectiveness are not established by these checks.

Exact next step for local workflow testing: use an isolated database or ensure the
backend serving shared results runs this policy before deliberately rerunning
recommendations. The new fingerprint is incompatible with an old hosted backend.
Students do not retake assessments. Do not automatically deploy or rerun results.
See [the implemented contract](ASSESSMENT_LED_RECOMMENDATIONS.md).

### Three-model Colab comparison v13 prepared and locally verified, 2 November 2026

Before main integration, the user identified that the original model-selection
notebooks used the old ranking and authorized a new separate Colab comparison.
The ignored `colab_comparison_v13/` contains the self-contained notebook, frozen
protocol, current pure-helper snapshots, an extracted unmodified v9 coverage/demand
function, scored-input engine, synthetic development data, independent-data template,
paper guidance and local verification artifacts. Main integration and real-record
reruns are not performed. Branch remains `main`; unrelated UI work is untouched.
The later UI preference excludes the v12 minimum-count section while retaining
coverage; no main UI was changed. Question-topic/NLP feature improvement stays paused;
this authorization is for evaluation of existing preprocessing under the two policies.

The original hybrid notebook reports 89.33% Top-1/100% Hit Rate@3 and the separate
NLP-only notebook 93%/99.67%, on their synthetic 300-case studies. Both first infer
a role numerically and insert its title/tags into student text. Those saved results
do not validate Option 3 or independent NLP value. Originals remain unchanged.
The new legacy control uses the same current neutral text, data and per-student
TF-IDF as the candidate; it is not a reproduction of historical notebook percentages.

New comparison: both 60/25/15 and assessment-led personal ordering, NLP-disabled
and regex controls, spaCy Small/Medium and Stanza, plus NLP-only diagnostics. Model
loads are excluded from timing; document-result cache is cleared each trial, with
warmup and seeded randomized trial order. Delivered default: five measured repeats.
No coefficient, label, named outcome or input pipeline was tuned after the results.
The 60 bundled familiar synthetic cases are development-only and have neutral
missing-location scores. Complete scored vectors/resolved identities are required;
grading, aggregation, aliases, workflow, capacity and approval are outside this study.

Checks: 19 pure tests passed; all seven executable notebook cells ran locally,
including all three real pretrained pipelines, figures and export. Local smoke
uses one measured repeat, separately labeled from a future Colab run. Fourteen
method/policy rows and eight contribution comparisons exported; optional independent
final evaluation is not run. Plot label/legend layout was repaired and that cell
rerun from unchanged saved results; charts were inspected. Delivered outputs are empty.
Missing local plotting dependencies and Stanza resources were provisioned separately
in the disposable QA/model folders, without changing backend dependencies. Source
hashes preserve 13 main/previous-artifact/original-notebook files. No DB was accessed.

Negative/no-gain findings retained: assessment-led Top-1 is 80% and Hit Rate@3 100%
for all models and the no-NLP control; no first suggestion changes from NLP under
that policy on these fixtures. Legacy numerical/location-only is 90% Top-1, versus
80% with either spaCy model and 81.67% with regex/Stanza. These familiar synthetic
labels do not establish the better real-world policy; no NLP benefit or improved
accuracy claim follows. Most fixture first suggestions fail at least one listed
minimum, so first-choice agreement and minimum attainment must remain separate.

Exact next step: upload `SkillBridge_Assessment_Led_Three_Model_Comparison.ipynb`
to Colab, run its five-repeat development comparison and retain the downloaded ZIP.
Review negative/helped/hurt cases and decide the relevance rubric before gathering
untouched reviewer-labeled cases for frozen final evaluation. Do not rename known
synthetic cases as independent validation, choose a final-test winner and reuse its
score as untouched evidence, or move to main merely because the notebook executes.
See `PAPER_UPDATE_GUIDE.md` and `LOCAL_VERIFICATION.md`. No Google Colab session was
run by the agent and no paper numbers were automatically replaced.

### Minimum-count presentation preview v12 completed, 2 November 2026

The user requested a clearer preview while explicitly retaining requirement
coverage. The separate ignored `minimums_preview_v12/` contains a source-based
React copy and self-contained `preview.html`. Each card now leads with "Listed
assessment minimums: X of Y met", with below-minimum/unassessed counts. Coverage
remains visible in its existing row with the same raw NLP/location values and
distance. A visible note distinguishes 100% coverage from confidence or approval.
Scores, ranking, provisional allocation, details and controls are unchanged.
No scoring/backend/schema/live changes or NLP improvement were made.

Verification: targeted isolated ESLint and Vite production build passed. The npm
launcher references a missing npm-cli.js; invoking the same installed Vite build
directly through Node succeeded without dependency/configuration changes in main.
The offline demo retains the known large-chunk warning from bundling all profiles.
Headless local-file QA passed 44 desktop and 44 mobile views, 294 personal cards,
22 proposal cards and 632 count/retained-coverage checks. Four nearest and four
company-view checks passed; keyboard controls and widths 320/390/768/1440/1920
were checked with no page errors or remote requests. Screenshots were inspected.
All 468 snapshotted main source files and 13 original v9 files are preserved;
the copied anonymous results are byte-identical. No server/database was started.

Branch remains `main`; unrelated UI work is untouched and NLP improvement remains
paused. Exact next step: review `minimums_preview_v12/preview.html`; the original
v9 preview remains available for comparison. This is a presentation preview only,
not authorization to integrate the candidate into main or activate live results.

### Current focus: suggestion workflow; NLP improvement paused, 2 November 2026

The user explicitly paused further NLP improvement and requested a recap of the
agreed suggestion changes. Pause applies to NLP development only; the user has
redirected this conversation to recommendation-workflow review. Do not resume
question-topic extraction, representation/model experiments or training without
a later explicit instruction. Preserve the completed v10/v11 artifacts.

Branch: `main`. Completed disposable work remains v9 assessment-led ordering,
requirement explanations and capacity-aware draft allocation; v10/v11 are separate
question-evidence experiments, not activated ranking inputs. Previously recorded
checks remain the evidence: v9 58 Python/six frontend utility checks and isolated
API/browser journeys; v11 52 checks plus report/preservation verification. No tests
were rerun for this documentation-only recap. Main scorer still implements
60/25/15. Unrelated frontend position-dialog work remains untouched. No task-owned
test servers/helpers remain from these completed experiments.

Agreed direction: use eligible combined numerical evidence and all positive
position requirements; separate minimum coverage from assessed-strength alignment;
use existing NLP/location only as supporting priorities; keep personal ranking
distinct from shared-slot proposals and coordinator approval. Show actual score,
minimum, gap/unknown state, rank and raw NLP/location percentages rather than
representing the old hybrid percentage as a probability of suitability. Retain
outside-area positions, manual choices, approved occupancy and original histories.
The disposable persistence design adds two columns on Recommendation, no new table;
main adoption would still require coordinated code/labels and an additive migration.

Known limitations: the strength-demand tie-break is a declared experimental
heuristic that can favor broad requirement lists, not a validated measure of job
importance. Qualified-only automatic proposals may leave more slots unfilled;
unknown/below-target pairs remain available for explicit coordinator review.
No independent placement-effectiveness, fairness or NLP-benefit claim is established.
No failed check is pending in the completed runs; production concurrency and full
historical-cycle integration remain unverified for this candidate.

Exact next step: review the v9 suggestion contract and its demand-priority and
automatic-proposal trade-offs, with NLP inputs/model frozen. Any next implementation
remains disposable unless the user separately authorizes main integration. This
recap does not authorize production changes or resume paused NLP improvement.

### Future-input refinement v11 completed, 2 November 2026

The user authorized refining the question-evidence experiment for future banks,
learners, categories and catalogs, rather than tailoring it to the two observed
learners. Branch remains `main`. The ignored
`work/recommendation_sandbox_20261031/generalization_v11/` contains the frozen
protocol/fixtures, refined mapper, tests, read-only runner, anonymous report,
preservation/browser receipts and `FUTURE_VALIDATION.md`. Main application sources,
the previous v9/v10 experiments and unrelated UI work remain unchanged. No live
writes, migrations, tables/columns, new forms, training or ranking changes occurred.

Vocabulary and bank length are dynamic. Question mapping excludes outcomes,
answer keys, choices, student identity and position/company inputs. Each learner's
existing graded responses produce their own conserved counts afterward. Typed
category references preserve distinct identities even when names coincide. Model,
framework, policy and vocabulary fingerprints identify the annotation snapshot;
question fingerprints bind it to the actual item input. Bound
`TopicMapper.aggregate(...)` rejects stale configuration/content, mixed versions,
duplicate IDs and foreign responses. A future persisted consumer must call these
guards explicitly; no production annotation consumer is activated here.

The first synthetic run exposed context-dependent loss of an exact phrase under
lemma-only matching and an invalid identification response in the fixture adapter.
A generic literal-plus-lemma union and response-shape correction fixed these
without student/domain-specific exceptions or changed expected labels. Pure
literal/lemma controls remain. Repairs are recorded in `REPAIRS.md`; development
fixtures are not relabeled as held-out evidence.

Checks passed: 52 regression/property tests, including nine new synthetic subject
areas with 63 stems, variable bank lengths and 100 simulated answer patterns.
Literal satisfies 54/63 frozen contracts, lemma 61/63 and combined matching 63/63.
These totals include expected abstention/review states; they are not accuracy on
63 skills or independent real questionnaires. Separate allocator controls check
unknown/new requirements, all listed minimums, identity invariance, limited slots
and fallback. They do not establish real allocation fairness or suitability.

Current-bank regression is unchanged: 17 single-topic candidates, three review
cases and 40 unresolved among 60 items, with zero topic/status changes from v10.
All 22 grade profiles and 132 category reconciliations remain conserved, and the
twelve saved baseline recommendation rows reproduce. Source access is READ ONLY
with rollback/close and private item/answer data retained in memory only. Saved
output checks cover 1,320 item partitions and main/previous-artifact hashes.
Headless report QA passed 22 desktop and 22 mobile profiles, 180 mapping rows,
72 filter combinations and 242 topic rows with no page errors or remote requests.
Desktop/mobile screenshots were inspected; no test server was started.

Supported scope is extracted English text with configured tags and the current
MCQ, true/false and exact-identification grading contract. Explicit unsupported
language, format and invalid-text states abstain or reject safely. Missing tags,
implicit topics, OCR/file import quality, essay grading and other languages are
not guaranteed. Dynamic inputs and invariance checks do not prove zero bias,
topic correctness, equal assessment difficulty or downstream NLP benefit.

Exact next step: review `generalization_v11/results.html` and
`generalization_v11/FUTURE_VALIDATION.md`, then obtain genuinely new real banks
and topic judgments recorded before predictions are shown. Keep template families
together, freeze code/vocabulary/criteria before untouched evaluation and report
wrong confident labels, abstentions and per-domain results. Evaluate accepted
topic evidence and NLP placement benefit separately from structured numerical
matching. Do not activate provisional topics or tune them to a preferred learner
outcome. The authorized disposable refinement is complete.

### Question-level feasibility v10 completed

The user authorized a disposable test of topic extraction from existing questions
and existing grading results, without new student/instructor forms. The ignored
`work/recommendation_sandbox_20261031/question_evidence_v10/` contains a protocol
frozen before reading the current bank, an answer-blind mapper, synthetic contracts,
read-only source runner, anonymous results, standalone report and blind-review CSV.
Branch remains `main`; unrelated UI work and v9 source/results remain untouched.
This experiment is an offline memory-only process: no local database server,
Django setup, migration, new table/column, grading mutation or recommendation refresh.

The frozen mapper uses assigned-category saved tags as allowed topic vocabulary.
It compares whole-phrase literal matches with strict spaCy Medium lemmatization,
uses longest overlapping phrases and marks negative/multiple/outside-category
wording for review. No answer key, choice/distractor, student response/identity,
position requirement or desired role enters topic selection. Terminology cues
are separated from other selected-response wording; no practical mastery is inferred.

Real-bank result: 17 single-topic candidates, 3 review cases, 40 unresolved among 60
eligible questions. Programming has 9 candidates, Database Management 4, Web 4 plus 1
review; Networking and Technical Support have 10 unresolved each; Cybersecurity has 2
review and 8 unresolved. All 17 remain unvalidated. Only broad explicit topic mentions
such as Python, SQL, HTML, CSS and JavaScript were proposed. This is insufficient
for a reliable automatic fine-grained assessed-skill extractor. Existing vocabulary
coverage and stem-only interpretation are clear limits, not a reason to force labels.

Literal and lemmatized runs have identical candidate-topic/status assignments:
zero changes in all 60 items. Lemmatization changes some nonblocking action/outside
context flags but adds no topic coverage in this bank. This demonstrates no observed
benefit of Medium over the literal control for these assignments; it is not proof
that either annotation is correct or that NLP cannot help another method. Timing
fields are exploratory single warm batches, not model-performance benchmarks.

Existing answer semantics reproduce both observed raw/max profiles and the twenty
previous fixed-seed synthetic controls, with 132 category reconciliations. All 60
eligible items stay in each denominator. Single-topic candidates get conditional
correct/assessed counts; the other 43 items remain a category/review bucket and
are not duplicated across inferred skills. The two observed cases total 52/60 and
39/60; the 17 tentative-topic items contain 12 and 4 correct respectively. The SQL
candidate group has 3/4 and 2/4, Python 5/9 and 1/9; these describe item performance
only if the proposed labels are accepted. No inference of mastery from one item.

Checks passed: 20 synthetic boundary contracts including key/outcome blindness,
literal-versus-lemma behavior, Java/JavaScript word boundaries, terminology/action
limits, ambiguity, dynamic category support, exact identification normalization,
wrong/missing/blank denominators and input preservation. The twelve earlier saved
recommendation rows reproduced before inference. Saved-output checks verify 1,320
item partitions, source/main/v9 hash preservation and private-field absence.
Headless report QA passed 22 desktop/mobile profiles, 120 mapping rows, 48 category/
status filter combinations and 242 topic rows, including empty search and no page
errors/remote requests. Screenshots were inspected. All source transactions are
explicit READ ONLY with rollback/close; no source question, choice, key, answer,
contact, coordinate or original source identifier is exported.

Exact next step: review the anonymous report and inspect originals through the
existing instructor assessment screen using category/item-order references.
`blind-topic-review.csv` has blank human-label fields and excludes predictions and
outcomes. It supports an initial review before viewing suggestions, not a claim
that a reviewer who already saw them is independent/blinded. Establish accepted
question topics and whether stems alone suffice before changing vocabulary,
adding choice context or testing question-derived descriptions in ranking.
Do not use these tentative labels to replace v9 grades/NLP/ranks, treat 17/60 as
accuracy, or tune the frozen mapper toward either observed student's desired role.
The authorized feasibility experiment is complete; no test server remains running.

### Post-v9 NLP contribution clarification

The user raised differentiation from their instructor's InternLink assessment/
tracking system. Its instructor-side capabilities were not verified from the
public internlink.info site; unrelated systems with the same name must not be
used as comparative evidence. The current v9 prototype demonstrates explainable
numerical-first decision support, not superiority over that unreviewed system.

A separate read-only saved-row diagnostic removes only NLP support while retaining
coverage, demand alignment, location, candidates and stable IDs. Among21 positive
profiles in the real six-role catalog, no first suggestion changes and two full
orders change. In the fictional eight-role catalog, three first suggestions and14
full orders change, with four profiles tied on the top numerical priorities.
The diagnostic is `clarity_integration_v9/check_nlp_ranking_effect.py`, with an
anonymous `nlp-ranking-effect.json` receipt. No model was refitted, result changed,
database accessed or frozen v9 protocol rewritten. Changed order measures influence,
not correctness; these familiar fixtures are not independent suitability labels.

Current spaCy preprocessing supplies lemmatization/filtering; actual text ranking
uses TF-IDF cosine. Generated descriptions repeat structured category evidence and
contextual vocabulary, so loading a pretrained model or displaying matched words
does not by itself demonstrate added placement value. A defensible next evaluation
compares numerical/location baseline with and without NLP against judgments recorded
before outputs are shown. Reviewed question-level skill evidence using existing
questions/tags is a bounded possible input experiment, not a selected implemented
replacement, permission for new forms, or a claim of inferred subskill mastery.
Question-category assistance can be evaluated separately for reviewer agreement,
correction burden and authoring time. No independent NLP benefit or comparative
system novelty claim is established by the existing workflow tests.

### Disposable v9 meaning and reliability implementation completed

The user authorized columns on the existing Recommendation table, explicitly in
the disposable environment, then resumed with CONTINUE. Branch remains `main`;
existing unrelated company/position UI edits were not changed. The new ignored
`work/recommendation_sandbox_20261031/clarity_integration_v9/` contains its frozen
protocol, source-only backend copy, actual API/migration runner, anonymous evidence,
React result-card prototype, standalone preview and verification receipts.

Implemented in the copy: persisted actual assessed percentage/raw/max, minimum,
shortfall, evidence status/counts and factual requirement reasons. Missing evidence
remains distinct from an assessed zero; 100% coverage means minima met, not 100%
grades. Recommendation order has an API alias without an extra database field.
The existing two candidate columns remain assessment_rank and assessment_details;
schema tests show no new tables or further columns. NLP explanations read the
same already-fitted TF-IDF vectors that produced each raw similarity. Template
words are filtered and default matched terms are contextual unigrams, avoiding
claims of separately tested subskills. Numerical ranking/text inputs/model and
targets are unchanged. API components retain saved precision for one final display
rounding. Demand alignment is labeled as the declared preference policy, with its
job-importance and cross-student limitations visible.

Verification passed: 58 pure Python checks; six frontend utility checks; actual
local additive upgrade with synthetic preexisting grades/recommendation/approved
snapshot values preserved and exactly two columns added. The two observed cases
plus 20 unchanged synthetic profiles completed 132 start/submit flows with 110
partial locks; six additional late-arrival flows passed. Inherited result/staff/
batch/report/CSV/analytics order and authorization/freshness/capacity/manual/
rejected/approval probes passed. All 294 saved explanations and 1,218 requirement
rows were checked; 168 current API rows match persistence and raw precision. V8
personal order and component values were preserved. Copied company grouping passed
44 learner/catalog combinations and 231 company representatives.

Actual-capacity allocation is unchanged from v8: 9 original and 13 extended automatic
proposals versus legacy 11/15. Student 1 receives frontend in both 22-learner catalogs;
Student 2 requires review originally and receives fictional support when extended.
No method or parameter was tuned to either observed result. Separate observed-only
controls remain in the receipt. These are simulations, not live decisions.

The isolated actual React prototype builds using installed dependencies without
package changes. Headless production-build QA passed 44 desktop and 44 mobile views,
294 personal cards and 22 provisional cards, all requirement values and contextual
terms, nearest-mode retention and company grouping, with zero page errors or
remote requests. The self-contained preview.html passed 44 additional offline views
without a server. Screenshots were inspected. Build warns about the 1.9MB chunk
because it bundles anonymous evidence for every test learner; production should
use the existing scoped API. This is not full authenticated production React or
concurrency/archived-cycle integration, independent suitability or NLP-benefit proof.

Cleanup/preservation passed: owned PostgreSQL stopped/deleted, test HTTP listener
stopped, no copied .env, main backend/utility and previous-copy hashes unchanged,
frozen protocol unchanged. The generic server helper stopped its parent but left
its Python HTTP child; the task-owned command/port were verified before explicitly
stopping only that child. The cleanup adapter's one-second refusal timeout was
corrected to four seconds for Windows' observed two-second refusal response.
No source/live write, production migration, deployment or main activation occurred.

Exact next step: review the disposable [standalone preview](../work/recommendation_sandbox_20261031/clarity_integration_v9/preview.html)
and its [report](../work/recommendation_sandbox_20261031/clarity_integration_v9/REPORT.md).
The authorized disposable implementation is complete; no task test server remains.
Catalog facts/alias semantics and demand-priority trade-offs remain owner-review
items before a separately authorized main/live integration. Existing production
forms and records were not changed. Preserve this boundary on any continuation.

### Historical resume checkpoint preceding v9 completion

User CONTINUE received after PAUSE. Branch remains `main`; Git status matches the
pre-pause state. The pause turn was interrupted before its final checkpoint write;
the saved v9 source files and tool receipts were reconciled before resuming.
Only the ignored `clarity_integration_v9/` copy and this plan belong to the active
implementation. Existing company/position frontend edits remain unrelated and
untouched. No owned PostgreSQL cluster or task test server was started before
the pause; the previous v8 clusters were already stopped/deleted.

Completed before pause: frozen v9 protocol; source copy from v8; two-column
existing-Recommendation migration retained with no new tables; factual score/
target/raw/max explanations, contextual same-vector NLP terms, API rank alias and
component precision changes in the copied backend; local migration-preservation
probe and full workflow runner; isolated React/Vite result-card prototype.
Checks actually run:58 Python pure properties passed; six frontend utility checks
passed; Python syntax passed. The frontend build reached compilation but could
not complete because the not-yet-run workflow had not produced results.json.
An initial copy-preparation anchor expected one serializer occurrence but found
two; the adapter was corrected for both before its successful run. No candidate
policy, model, targets or desired-student outcome was changed.

Remaining: run the owned local PostgreSQL workflow and additive-schema preservation
probe; resolve genuine implementation/test-adapter failures if found; verify
stored facts and API precision against v8 and no numerical/rank changes; build and
browser-check the React prototype with the actual anonymous results; verify main/
prior-copy preservation and owned-process cleanup; publish review links and limits.
Exact next step: run `clarity_integration_v9/run_workflow.py` using the already
authorized two-case selectors through stdin. Source connections must stay READ ONLY,
and all migrations/assessment submissions must target only the owned localhost
test database. Nothing authorizes main/live activation.

### Actual-catalog and NLP review v8 completed, 2 November 2026

The user authorized the four bounded follow-ups: replay actual capacity, audit
existing requirements/tags, retain NLP as supporting evidence with explanations,
and review the strength proxy. The new ignored `catalog_review_v8/` experiment
freezes its protocol, clones the v7 backend unchanged and preserves v6/v7 receipts.
Main/live source, schemas, inputs and records remain unchanged. Read-only source
transactions close before local assessment/ranking mutations. No model training,
replacement NLP method, catalog correction or production policy was selected.

The current source snapshot has five companies/six roles and 11 configured slots:
Sample Company 1+1, Mugna 3, ActiveSystems 2, PixelPrint 2, Panabo 2. Current approvals
are zero. Two active draft holds belong to the two observed cases, with no explicit
manual choices or outside-replay holds. Their existing unapproved suggestions
seed the local copy and are not counted twice. Valid manual choices would stay
fixed; approved occupancy/outside-replay holds are explicit external reservations.
The hypothetical added support/security roles retain two fixture slots each and
remain clearly distinguished from the real catalog.

With the unchanged 22 learner profiles, legacy fills 11 of 11 real slots and 15 of 15
extended slots; the qualified-only candidate fills 9 and 13 respectively. Student 1
receives a frontend proposal in both full-cohort scenarios using Mugna's actual
three slots; Student 2 remains coordinator-review originally and receives support
only in the extended catalog. In separate two-observed-only controls, Student 1
receives frontend originally, Student 2 has no fully met original option, and both
receive support in the fictional extended catalog. These are point-in-time
simulations with declared rules, not live decisions or independently correct labels.
The earlier v7 awaiting-capacity result was specific to its two-slot fixture.

The source-only audit lists all targets/tags, strict-ID and trial-alias evidence,
contextual tag provenance, text budgets and an owner-review checklist using existing
forms. Both Sample roles have nine positive requirements and five unassessed
categories under the provisional Database/Database Management equivalence: Cloud,
DevOps, Operating Systems, Tools, Version Control. Strict IDs additionally expose
the distinct Database entry; identical vocabulary is not proof of equivalence.
No duties were inferred as fact, tags removed, minimums lowered or categories merged.

Strict spaCy Medium plus existing TF-IDF reproduced all 12 saved NLP pairs.
Thirty-six text interventions hold the student text fixed and edit one position
document at a time. Omitting unassessed requirement text changes Student 1 Sample
frontend 20.22->30.61 and Backend 23.11->39.17; Student 2 frontend 6.43->8.35 and
Backend 16.77->27.75. These are diagnostic values including corpus IDF response,
not replacement scores. Saved role tags remain in this intervention.
Panabo has no missing required category: removing unassessed text leaves 15.30/
12.36 unchanged, while the separate role-tags omission yields 20.69/17.50.
Deleting tags also decreases some other similarities. Missing assessments explain
part of some low similarities, not every low percentage, and deletion is no general
fix. Generated proficiency phrasing/n-grams are visible influences to investigate;
their isolated causal contribution was not tested. No unassessed student claims
were added. Shared/position-only processed features are labeled contextual terms,
not individually assessed subskills or model confidence.

The proxy review compares frozen option 3, coverage->support and coverage->actual
required-category mean->support on identical evidence. Removing the proxy changes
six original and four extended first suggestions; the required-mean comparator
changes four in each catalog. All methods retain 12/21 and 14/21 target-meeting first
roles among positive profiles (11/19 and 12/19 for synthetic cases alone).
For Student 1 originally, both alternatives favor networking while the frozen
proxy favors frontend; both roles meet targets. No desired individual outcome
selects the method. For one fixed student and fully met roles, the proxy numerator
reduces to the sum of listed minima and its denominator is common. It therefore
prioritizes total listed demand, not independently established duty importance or
actual utilization of a highest category. Added unrelated unrequired scores can
change its magnitude without changing within-student order. This can be an explicit
owner policy with accepted trade-offs; it remains unsuitable as a cross-student
competence metric. No comparator was declared better or bias-free.

Verification passed: 31 pure checks; 132 assessment start/submit flows plus six for
the late-arrival probe; inherited staff/result/export/analytics parity; actual
capacity, read-only preview, stale signatures, manual-choice/rejection and approved
snapshot probes. Copied grouping passed 44 learner/catalog combinations and 231
company representatives. Local card QA passed 44 desktop+44 mobile views, 294
personal cards and 22 proposals. New review QA passed 44 desktop+44 mobile views,
132 comparison-order lists, 12 NLP role tables, exact capacity/evidence values,
zero page errors/remote requests and no invented synthetic diagnostics. All12
NLP baselines and 36 intervention arithmetic checks passed. Main/v7 source hashes,
frozen protocol, privacy and owned-cluster cleanup passed. Full production React,
concurrency, real placement benefit and independent suitability remain unverified.

Review artifacts: interactive `results.html`, complete `REVIEW.md`, measured
`NLP_FINDINGS.md`, `POLICY_REVIEW.md`, anonymous JSON and verification receipts.
Exact next step is owner confirmation of existing catalog facts and the declared
ranking trade-offs using these saved comparisons, followed by the already bounded
main-integration checks if separately authorized. Do not remove real requirements,
invent missing competence or select a policy by making either observed result win.

### Capacity-aware disposable integration v7 completed, 2 November 2026

The user authorized extending the disposable candidate with joint capacity-aware
allocation while retaining existing card information and data-entry features.
The ignored `work/recommendation_sandbox_20261031/capacity_integration_v7/` contains
a frozen pre-run protocol, separate v6-derived backend/frontend copies, pure
allocation properties, actual API runner, anonymous results, interpretation and
interactive report. No main application code, live records, migration, deployment
or activation changed. Existing unrelated frontend work remains untouched.

Personal option-3 order remains coverage -> strength proxy -> NLP/location support.
The new automatic draft candidate first requires every positive minimum to have
assessed evidence and be met; below-target/unknown suggestions remain visible for
explicit coordinator review. This is a conservative experimental automatic-draft
assumption, not a new hard approval gate. Approved occupancy and valid coordinator
choices are preserved. Among admissible edges, existing residual matching maximizes
assigned learners, then minimizes total available personal-preference ranks,
maximizes equal-mean actual assessment scores over required categories, then uses
NLP/location support. The personal strength proxy is never used as cross-student
competence. Means/support are rounded to hundredths for exact integer priorities;
stable IDs resolve ties. Global trade-offs and ID tie effects remain limitations.

Existing draft tables and ManagementAction JSON are sufficient: no allocation
tables/columns were added beyond the v6 copied Recommendation rank/explanation
fields. Snapshot-like local cards retain company/position, rank, requirement
coverage, raw NLP/location percentages and distance. The primary header is an
assessment rank, not a fake overall fit percentage. Legacy hybrid remains a
labeled reference. Production adoption still needs consumer labels/order,
freshness, versioning and the two v6 additive fields; it is not a data-only swap.

The two observed cases plus twenty unchanged synthetic profiles completed 132
start/submit flows and 110 partial locks again. All v6 result/staff/export/analytics
parity checks passed. New draft checks passed for read-only preview, signed apply,
stale tokens/policy revision, repeat GET/sync, role scope, full-role fallback,
manual choices including gap review, rejected pairs and approved occupancy/
snapshots/idempotency. A late synthetic learner completed six additional actual
start/submit flows; one existing unapproved proposal changed without altering
existing personal metrics. Extra mutation probes rolled back. Both owned database
runs were stopped/deleted, and main source/utility hashes remain unchanged.

With two fixture slots per role, legacy no-cutoff allocation fills 12 original
and 16 extended slots; the qualified-only candidate fills 8 and 12 respectively.
Student 1 retains frontend first originally/support first when extended, but gets
no shared slot in either full-cohort allocation because qualifying roles are full.
Student 2 gets no automatic original-catalog slot (visible Web 20/target 25 gap),
and a support slot with the fictional extended catalog. These results were not
tuned into preferred outcomes. Fewer proposals reflect the stricter assumption,
not independent evidence of better suitability or fairness.

Twenty-six pure allocation checks and five inherited personal-order checks passed.
Copied company grouping passed 44 learner/catalog combinations and 231 company
representatives. Headless local report QA passed 44 desktop and 44 mobile views,
294 personal cards and 20 proposals, raw-percentage/legacy-label/privacy checks,
with zero page errors or remote requests. Full React screens/concurrency/hosted
performance and independent suitability remain unverified. NLP inputs/model and
raw similarities were unchanged; no NLP effectiveness improvement is claimed.

Repairs were confined to disposable adapters/presentation: an unallocated status
incorrectly considered free below-target roles; qualified-only availability fixed
it without changing outcomes, and a fresh full run passed. Report expectations
were corrected for Python/JavaScript half-tie rounding; preservation checks were
corrected for normalized-text versus byte-hash receipt formats. Frozen rules were
not rewritten. See the local INTERPRETATION.md and verification receipts.

Exact next step: review the v7 anonymous report's capacity and unmet-requirement
trade-offs, especially the distinction between personal first suggestion and
provisional slot. Do not select a policy by a desired named-student winner. Before
main/live adoption, deliberately settle the automatic-proposal rule, then complete
full React, historic-cycle/legacy-band and isolated concurrency coverage. Existing
workflow evidence supports this bounded implementation review, not an accuracy,
NLP-benefit or bias-free claim. No main/live integration is authorized by this test.

### Clarification: demand alignment versus allocating students, 2 November 2026

The user describes a general, dynamic goal: compare each student's whole assessed
profile with positions' proficiency demands; where other requirements are met,
a high category score may favor a role with a higher minimum in that category.
This is not a desired role for a named student. A minimum is neither an upper
limit nor a confirmed importance/working-time weight. Exceeding a minimum is not
itself evidence of mismatch or a reason to withhold that position.

Keep per-student ranking separate from cross-student slot allocation. A new
student scoring 90 in Database versus another's 80 has stronger assessed evidence
on that category; both can meet a target of 75. Other requirements and existing
capacity/coordinator rules still apply. The new student's arrival should not
arbitrarily lower another student's personal suitability score. The v6 candidate
does not update cross-student draft allocation or establish a highest-category
student-wins rule; those remained explicitly outside its integration receipt.

Read-only synthetic calculations confirmed that coverage is capped at 100 above
a minimum. The existing strength proxy measures target demand relative to the
student's positive profile and is NOT comparable as competence across students:
with only a Database category and target 75, score 80 yields proxy 93.75, score
90 yields 83.33, and score 100 yields 75. This is a warning against using that
ratio to declare the lower-scoring student more capable or more deserving.
Within one student it can favor higher-target roles (Web100 versus targets25/90
gives proxy25/90 respectively); it is a declared utilization heuristic, not
independently validated duty importance. Do not conflate these two comparisons.
No policy/source/fixture was changed or live database queried for this clarification.

### User correction: no desired-student outcome, 2 November 2026

The user rejects choosing a policy to make the first observed student receive a
web role. This supersedes any earlier interpretation of that movement as a desired
success criterion. Saying the experiment 'corrected' that student's suggestion
overstated the evidence: the candidate changed order under a selected rule; it
did not establish that the original database role was unsuitable or the new first
role better. Multiple existing roles meet that student's targets under the trial
mapping. No expected company/position may be assigned from a highest category alone.

A read-only review found no observed-name/identity/desired-company branch in the
new ranking helper and no expected-position labels in the synthetic workflow
runner. This does not establish absence of bias. Coverage and the strength proxy
were chosen after the observed cases were known; the protocol says so explicitly.
The strength proxy interprets minimum targets as demand alignment without proving
their task importance, and broad/easy-target preferences remain. The twenty cases
were workflow fixtures, not an independent suitability sample. See the disposable
`assessment_integration_v6/BIAS_REVIEW.md` for the distinction between generic
implementation and outcome-influenced policy selection.

Keep v6 as an exploratory implementation artifact, not a selected proven method.
Any method decision must use declared rules and new judgments recorded before
viewing algorithm outputs, allow multiple suitable positions, retain baseline
comparisons and report regressions. Owner review can start this development work;
it is not independent multi-reviewer validation. No rule, threshold, frozen fixture
or existing protocol was changed in this audit. No main/live change or rerun.

### Option 3 enclosed integration v6 completed, 2 November 2026

The user authorized implementing the frozen option-3 candidate in the disposable
test and exercising the two observed cases plus twenty synthetic learners. The
new ignored folder `work/recommendation_sandbox_20261031/assessment_integration_v6/`
contains the pre-run protocol, isolated backend source copy and local migration,
copied frontend grouping utility, anonymous derived API results, reports and QA.
The scoped integration task proposed below is complete for the tested consumers;
it is not main-code implementation or production activation.

The copied Recommendation model has nullable assessment rank and JSON explanations.
Old hybrid/category/NLP/location numbers retain legacy reference semantics. The
copied scorer applies coverage -> strength proxy -> existing NLP/location support
-> position ID after the unchanged numerical/text baseline. Copied freshness
includes a policy revision. Per-student result queries and copied company/position
sort utilities use the persisted rank. No fake overall match percentage is created.
The identical-vocabulary trial category equivalence remains provisional; no live
category was merged. Existing form inputs and question grading are unchanged.

The two observed cases replayed actual question/key/answer semantics; twelve
original saved recommendations reproduced before enabling the candidate. Twenty
additional fixed-seed synthetic learners submitted actual choice/identification
payloads, not injected scores. All twenty-two completed six assessments each:
132 start/submit flows and 110 partial-completion locks. The zero-evidence synthetic
learner completes but receives no recommendation. Persisted ranks match the
independent frozen-v3 oracle for both six- and eight-position catalogs.

Original positions: Student 1 frontend first; Student 2 networking first, with its
web requirement gap visible. With fictional security/support roles: support first
for both. All observed cases preserve the earlier v3 behavior. These changes are
declared-policy results, not independent suitability/accuracy improvements.

Successful checks: 44 student result reads, 88 staff-summary rows, 44 batch-detail
rows, 44 competency JSON rows, 264 competency CSV rows and 88 analytics rows;
4 authorization probes, 2 stale-result/approval probes, 5 capacity/idempotency/
snapshot probes. Completed assessment evidence remains unchanged through reranking;
approval probes roll back. Five generic copied-policy tests passed. Copied frontend
utility checks passed 44 case/catalog combinations and 231 partner representatives;
nearest mode retained candidates. Local report browser QA passed 44 case/catalog
views, desktop/mobile overflow checks, zero remote requests/page errors and the
private-source-field guard. This is report QA, not complete React-app testing.

An initial run completed all learners then failed in the test adapter, which passed
a dict to QueryDict-based analytics. The adapter was fixed to inspect the actual API
response; a fresh whole run passed. Both owned database runs were cleaned up.
No main sources/live records changed. The temporary PostgreSQL cluster was stopped
and deleted; the isolated source copy and anonymous artifacts remain for review.

Important remaining policy trade-off: among nineteen positive synthetic cases,
top roles meet all targets for 11/19 in the original catalog and 12/19 extended.
The others retain visible gaps. Four original-catalog and three extended-catalog
top roles do not list a tied-highest category because coverage takes priority.
Database Encoder is first for eleven original-catalog synthetic cases and eight
extended-catalog cases. Do not tune after seeing these outcomes or call every
first role fully qualified. No expected-role labels were supplied for these cases.

Exact next step: review the frozen policy's mixed/specialist and gap trade-offs
using the saved 22-learner report. Before any main/live integration, audit remaining
cross-student draft allocation, archived-cycle order and legacy-score bands, and
exercise full React screens. Sequential API workflows do not establish concurrency,
hosted latency, improved NLP contribution or broad suitability. No model switch,
training, coefficient change, deployment or main migration was authorized/performed.

### Bounded next step proposed, 2 November 2026

Historical proposal: the scoped enclosed integration above now supplies the tested
consumer evidence. Its remaining boundaries and exact next step take precedence.

Separate two decisions that have become conflated in discussion: implementing
the owner's desired assessment-first behavior, and establishing that a method
improves independent suitability/accuracy. Existing tests support proceeding with
a controlled local integration candidate; they do not justify superior-accuracy,
NLP-benefit or bias-free claims. Lack of population-level evidence need not cause
an indefinite loop of formula/model experiments before a local behavior repair.

Recommended next candidate: freeze v3 option 3 (coverage, strength proxy, current
NLP/location support, deterministic ID), retaining Medium as the model baseline.
Keep all existing data-entry workflows and all eligible candidates. Do not merge
assessments, train another model, select weighted-reference NLP, tune coefficients
to the two cases, or invent a new overall confidence/match percentage. This is a
proposal for enclosed integration, not authorization to activate it in main/live.

The next concrete engineering task is to exercise this candidate through a
disposable implementation of existing API/persistence/result consumers, including
company grouping and staff/export ordering. Current v3 is pure post-processing:
its report parity is not evidence those consumers respect the new order. Preserve
the distinction between legacy hybrid percentages and the new sequential order.
Reuse current version/freshness machinery where compatible; assess any storage
change explicitly before promising schema-free production integration.

Local engineering acceptance is finite:

1. Generic published policy is respected for mixed roles, exact ties, below-target
   requirements, unknown evidence, custom IDs/categories and remote candidates.
   No student, company or job-title-specific winner rules.
2. Assessment answers/raw/max/history and completion/permission/approval/capacity
   behavior are unchanged. Version changes mark affected results stale; historical
   snapshots retain their original metric meanings.
3. All current result consumers show the same candidate order and truthful
   requirement/strength/text explanations. No legacy hybrid sort silently reverses
   the candidate ordering; no text score is presented as model confidence.
4. Review a small, newly prepared pilot once using candidate order/scores hidden
   from the initial owner reviewer. Record acceptable alternatives and uncertainty,
   not just a forced unique target. Freeze judgments before comparison; report all
   regressions. This is owner acceptance/development evidence, not independent
   population accuracy. Resolve material contradictions before activation; do not
   keep tuning on the same pilot and then call it a final test.

Once these checks and owner policy review are complete, prepare the concrete
local change and updated method/results documentation for a separate activation
decision. Retain the negative v4 NLP findings. The honest research claim may remain
'NLP-assisted text comparison' until useful marginal benefit is demonstrated;
stronger claims require stronger evidence, rather than becoming a prerequisite
for every limited engineering repair. Production activation is not performed.

### Assessment grouping experiment v5 completed, 2 November 2026

The user requested a direct six-separate-assessments versus one-combined-assessment
test to check whether grouping caused the original fit/ranking issue. The new
ignored folder `work/recommendation_sandbox_20261031/assessment_grouping_v5/`
contains its pre-run protocol, runner, anonymous derived JSON and report.

Two read-only source transactions supplied the previously authorized evidence and
the actual eligible question/key/submitted-answer semantics. Those connections
closed before local grading. A newly owned localhost PostgreSQL test database
held paired anonymous copies in two independent batches. The unmodified actual
start/submit/combined-results paths processed six required/included assessments
versus one required/included assessment, using the same sixty logical items
(53 MCQ, four true/false, three identification), category IDs/tags, answer patterns,
model and distance-preserving location transform. No synthetic replacement answer
pattern or score injection was used. Source questions, keys, answer text, identities,
selectors and coordinates were not exported to files or fixtures.

Both cases matched exactly at summed individual raw/max totals, combined category
raw/max/percentage, overall percentage, generated competency/orientation/advice,
normalized persisted answers, all recommendation components, final scores and
order. The paired comparison passed in both original six-position and prior
hypothetical eight-position catalogs: twenty-four category comparisons and
twenty-eight recommendation comparisons; maximum component difference 0.00 points.
The separated original-catalog arm reproduced twelve saved recommendations.
Required/included counts 6 versus 1 and source IDs differed as expected.

Verification: fourteen actual start/submit flows, ten partial-completion API locks,
four pre-submission locks, twelve final API reads and three synthetic helper checks.
The temporary server/cluster was stopped/deleted in the owned harness cleanup.
Eight production source hashes and the new experiment protocol remained unchanged;
the anonymous output passed private-source-field and equality checks. No main-code
change, live database write, deployment or live recommendation refresh occurred.

Conclusion limited to these controlled replays: grouping the same eligible items
into category-specific assessments did not cause the low component scores or
original ranking. Combining the assessments did not improve those results. Continue
investigating metric/text/catalog behavior rather than changing assessment layout
as a scoring fix. This does not evaluate fatigue, changed real student answers,
concurrency, timers, retakes, flags or alternative publication/inclusion settings.
The v4 suitability/NLP contribution limitations below remain unresolved.

### Contribution experiment v4 completed

The user authorized a further disposable experiment using the conversation's
existing-input scope. Results are in ignored
`work/recommendation_sandbox_20261031/contribution_v4/`: frozen `PROTOCOL.md`,
`results.json`, `REPORT.md`, `INTERPRETATION.md` and `results.html`. Nine methods
compare the two authorized cases in the original six-role and hypothetical
eight-role catalogs, plus all sixty familiar synthetic development cases with
their original saved tags. Input selectors and private source records stayed in
memory; the existing repeatable-read transaction was read-only and closed before
matching. Twelve original saved results reproduced; eight production source
hashes remained unchanged. No live writes or application integration occurred.

Observed original catalog: every assessment-led method puts frontend first for
the first anonymous case and networking first for the second; neither case has
a top assessment tie. With the hypothetical roles added, both cases have top
assessment ties. Current-text support puts support first for both, while weighted
reference support puts frontend first for the first and support first for the
second. These are behavior differences, not independently judged improvements.

Unfavorable evidence is preserved: the legacy category/location ablation gets
54/60 Top-1 versus current hybrid 48/60; adding current NLP fixes one first-place
prediction and harms seven against the synthetic archetype labels. Every
assessment-led variant gets 48/60 Top-1 and 60/60 Hit Rate@3. There are no top
assessment ties in those sixty cases, so NLP cannot affect first place under
that policy. Larger reference-cosine values do not establish improved ranking.
This run does not validate the proposed assessment-led policy as more accurate
than the legacy ablation, or establish a useful marginal NLP contribution.

Twelve synthetic experiment checks passed (custom category/ID behavior, missing
evidence, unchanged candidates/tiers, expected-label exclusion, representation
limits and paired regressions). Three timing repetitions per representation/model
on sixty cases put Small slightly ahead of Medium in both representations; these
are local warm-model/cold-document-cache batch times, not hosted latency or a
universal model winner. Regex, Small and Medium ran; Stanza resources were absent
and no substitute metrics/download were used. Prior Stanza outputs were not mixed
into the new comparison. Report-browser verification passed all 36 method/case/
catalog views, desktop/mobile overflow checks and private-field guards, with zero
remote requests or page errors. The first sandboxed browser check stalled and was
stopped; the task-owned headless retry passed with browser access. Receipts and
screenshots are in the disposable folder. This is report QA, not application UI
or API integration verification.

Next decision: keep the explanation prototype, review realistic assessment-tied
candidates before comparing model rankings, and obtain new suitability judgments
before claiming effectiveness. Do not tune numeric ties or inject role vocabulary
to manufacture NLP influence. A different approximate-tie or trade-off policy
would require a separately declared comparison; v4 does not select one. Existing
forms, assessment history, all-position visibility and live activation boundaries
remain unchanged.

User clarification, 31 October 2026: the goal is useful, evidence-grounded
recommendations and a measurable NLP contribution, not a desired similarity
percentage. The user endorsed explaining each recommendation through requirements
met, assessed strengths used and matching skill vocabulary. Preserve that meaning
without implying that all requirements are met, tags prove individually assessed
technology mastery, or text similarity estimates placement success. Record gaps
and unknown evidence alongside positive explanations. The disposable
`work/recommendation_sandbox_20261031/assessment_led_v3/EXPLANATION_CONTRACT.md`
captures this review contract; it does not activate application changes.

The two supplied original 300-case notebooks remain historical synthetic
development benchmarks. Their saved NLP-only results are 93% Top-1 and 99.67%
Hit Rate@3; hybrid results are 89.33% and 100%, identical across preprocessors.
Both insert a category-inferred role title and its vocabulary into student text,
so the NLP-only result does not isolate an independent NLP contribution. Medium
was fastest in the saved hybrid run; Small was fastest in the NLP-only run.
These single-run timings and labels do not establish a universal model winner or
live recommendation accuracy. The notebooks were inspected, not rerun or edited.

Research clarification: the user reports that pretrained or newly trained models
are both acceptable; training is not an explicit requirement. Keep pretrained
comparison as the current path. The user wants measurable NLP contribution within
existing features, rather than additional OJT monitoring or duties/annotation UI.
Evaluate whether it helps; do not manufacture a positive outcome to justify the
project title or differences from another system whose capabilities are unverified.

For the next contribution evaluation, distinguish (a) existing question-category
suggestion quality/work saved from (b) marginal placement-ranking value. For the
assessment-led policy, hold coverage/strength/category mapping/candidates fixed:
compare location-only support against text+location support, then compare regex,
spaCy Small, spaCy Medium and Stanza under identical conditions. Report how many
cases actually reach the support tie-breaker, because NLP cannot affect higher
assessment tiers in this policy. Use fresh judgments rather than deriving expected
roles from the same score rules. A current category/tag narrative mostly reuses
numeric evidence and may provide no independent ranking gain. Do not treat larger
similarity numbers, training, or a more complex model as proof of innovation.

Updated 31 October 2026 after the v3 disposable test. This checkpoint supersedes
the initial-review next-step notes below; the active scope remains the existing
suggestion feature only, without new duties/annotation features or staff tasks.

The user asked to test assessments leading, all position requirements considered,
NLP/location supporting, and all active positions retained regardless of preferred
area. The tested v3 policy orders:

1. Capped positive-target requirement coverage.
2. Assessed-strength demand alignment across the complete positive profile,
   preserving tied highest categories and considering other requirements.
3. Supporting relevance from NLP/location in their existing 25:15 relative ratio.
4. Deterministic position ID for an exact remaining tie.

This is a sequential ordering, not the original overall 60/25/15 formula. Exact
definitions and limitations are frozen in the disposable
`work/recommendation_sandbox_20261031/assessment_led_v3/PROTOCOL.md`. The strength
proxy can favor broad requirement lists; strict coverage precedence can amplify
small differences. These are explicit policy trade-offs, not established accuracy.

Verified: 15 synthetic policy tests; 12 original saved baseline matches; 16
extended-catalog baseline matches against the earlier actual local backend run;
16 report combinations with desktop/mobile checks; every candidate set preserved.
No live writes or production source changes. V3 ordering is pure local processing,
not yet integrated into API order, persistence, company grouping or exports.
The earlier enclosed PostgreSQL tests verified current component/backend flows;
they are not full integration evidence for this later ranking policy.

Current-NLP support (option 3) and experimental weighted-reference NLP support
(option 4) both remain reported. Option 3 retains the current text pipeline; option
4 changes the text representation too. No final NLP replacement or production
activation has been selected or authorized. Neither lower NLP percentages nor
larger experimental values establish accuracy or require score inflation.

Remaining work is broader than raising NLP percentages: evaluate supporting
relevance and tied rankings, confirm numeric/category mapping and policy semantics,
then verify generic catalog growth and existing workflows for whichever method is
selected. Retain the original scores, history, all-position visibility and current
forms. Keep observed cases as regression/development evidence, not independent
suitability labels. The paper revision map was discussed separately; a selected
algorithm must be reflected in the methodology/results before final claims.

Exact next step: review the saved v3 comparisons and remaining tie/NLP behavior
under the existing-input scope. If the user authorizes integration later, freeze
the selected policy/representation, refresh dependency context and implement its
ordering/version/compatibility checks locally before any deployment. A low NLP
percentage alone is not an implementation acceptance or rejection criterion.

## Current scope: improve the existing suggestion feature only

User scope correction, 31 October 2026: preserve current features, screens, inputs
and workflows. Fix/improve the existing recommendation calculation using data
already collected. This section takes precedence over broader proposals below.

**No new duties fields, instructor/admin data-entry tasks, question-annotation
feature, review workflow, dashboard or new product feature is required.** Earlier
duties/evidence-preview proposals are deferred research options, not prerequisites
for this repair. Reading the older NLP phase plan does not authorize those phases.

### Existing inputs and preservation boundary

Use eligible batch-combined category raw/max percentages, existing category IDs
and tags, saved position requirements/tags/title, and the current location inputs.
Preserve question grading, assessment submission/retakes, completion/inclusion
rules, role permissions, company/position management, capacity/approval behavior,
existing history and frontend workflows. Keep current hybrid weights and tie rules
as the controlled reference; do not introduce a new strength-first policy implicitly.

### Focused implementation plan

1. Extract/test the existing ranking calculations as pure helpers alongside a
   local production-parity runner. Reuse the existing backend endpoints/contracts;
   do not create another mutable catalog or recommendation workflow.
2. Evaluate replacing category cosine with the tested requirement-attainment
   calculation, including explicit internal unknown-versus-zero evidence states.
   Resolve confirmed existing category-reference inconsistencies while preserving
   original score rows. Do not automatically merge categories from similar names.
3. Improve ranking text generation from the **existing** tags and category results.
   Test deterministic tag handling and removal of irrelevant/repeated/banded text
   as separate candidates. No duties or reviewed-item input is required. Keep the
   current NLP comparator because the short-text candidate is not established as
   superior. Do not switch models or tune coefficients simply to raise percentages.
4. Support arbitrary future category/position records through their saved data,
   including custom titles/tags. Test missing evidence, aliases, new catalog entries,
   corpus effects, ties and mixed roles rather than inserting role-specific winners.
5. Reuse existing freshness/version mechanisms where possible so a metric/text
   change invalidates current recommendations without rewriting historical scores
   or placement snapshots. Review compatibility before deciding whether metadata
   persistence needs any additive change; no new user-entered field is implied.
6. Verify the selected candidate locally through the current submission -> combined
   evidence -> ranking -> saved recommendation -> result API path. Preserve API
   shapes and current screens. A small correction to an existing score explanation
   may be needed if its metric meaning changes; it is not a new feature or flow.

The separately requested coverage/strongest-area explanations can continue in the
disposable comparison while the calculation is selected. They do not authorize a
new production screen or another weighted ranking component. Independent validation
of broad effectiveness is distinct from fixing demonstrated calculation behavior.

### What the existing data can establish

It can support better category-level target attainment, consistent category
identity, more controlled text generation and truthful handling of missing
evidence. It cannot establish individually tested React/SQL/etc. abilities merely
from broad category tags, or confirm company duties that are not saved. Keep those
claims limited; do not force new product data collection to complete this repair.

The broader feature and research sections below remain a record of options. Their
duties/annotation/confirmation-UI steps are **not in the active implementation
scope**. Application edits/deployment are still not performed by this plan update.

Follow-up: the user chose separate requirement-coverage and strongest-skill
explanations. Disposable numeric/text experiments and further NLP diagnostics
have since run without modifying application scoring or live data. See the
[validation readiness checklist](RECOMMENDATION_VALIDATION_READINESS.md) for the
current evidence inventory, single-reviewer limitation, evaluator-parity gap,
reviewer inputs and remaining integration/effectiveness gates. The original
review record below describes its initial scope; unchecked implementation steps
are not implicitly completed by the later experiments.

## Scope and interpretation

The user requested an investigation of multiple-category assessment results,
low category/text match percentages, two observed student cases and a proper
improvement plan. This document records aggregate findings without student names,
IDs, contacts, coordinates, answer content, actual student score vectors or
per-student recommendation records. Numerical examples below are synthetic.

The objective is defensible role suitability and explanations, not increasing
displayed percentages. Low text cosine is not proof of a software bug or poor
model accuracy. A first-ranked available position is not necessarily a strong
match, an assigned placement or the student's best career direction.

Read together with the [recommendation contract](RECOMMENDATION_CONTRACT.md),
[freshness rules](RECOMMENDATION_FRESHNESS.md),
[NLP design decision](NLP_DESIGN_DECISION.md),
[phased NLP handoff](NLP_PHASED_IMPLEMENTATION.md) and
[assessment interpretation](ASSESSMENT_RESULT_PRESENTATION.md).
Those documents describe current behavior and earlier proposals; this plan does
not silently activate a different method or restart every earlier NLP phase.

## Verified review evidence

Two screenshot-matched profiles were identified uniquely without retrieving names
or contacts. Direct PostgreSQL transactions used read-only, repeatable-read mode
and were rolled back. No mutation-capable result-generation/view helpers ran.
The Supabase app connector lacked required connection information; the configured
backend connection was used without printing credentials or exporting records.

| Check | Result | Boundary |
| --- | --- | --- |
| Included assessment evidence | Six submitted, unflagged, included assessments in each reviewed case | Does not audit all students or historical attempts |
| Saved individual raw/max totals versus current stored answers/keys | All reviewed category totals reconciled | Verifies the implemented marking rule, not question validity, difficulty or curriculum coverage |
| Duplicate response/question answer groups | None in the reviewed attempts | Does not establish a database uniqueness constraint |
| Combined category raw/max totals | Reconciled with included individual score rows in both cases | Existing inclusion and batch rules remain authoritative |
| Current builder versus saved competency text | Identical in both cases | Not a general freshness certification for every stored ranking |
| Category, text and hybrid reproduction | All six positions in both cases reproduced; hybrid parity within 0.01 percentage point using stored rounded location components | Twelve comparisons are regression evidence, not statistical accuracy evaluation |
| Selected/actual preprocessing | Strict local `spacy_md`; no fallback; matching saved model ID | Does not benchmark hosted latency or other models |
| Approved placement rows in the reviewed batches | None for either case | Ranked suggestions must not be described as assigned placements |

A controlled removal of the orientation-summary prefix changed the reviewed text
components by less than 0.5 percentage point. That prefix is therefore not the
main explanation for these observations. It remains an input to isolate in a
proper experiment; removing it alone is not a demonstrated solution.

## Findings and their consequences

### F1: Category cosine measures profile shape, not requirement attainment

[The ranker](../skillbridge-backend/api/scoring.py) constructs student and position
vectors in the same category ID order, fills absent entries with zero and applies
cosine similarity. Assessment splitting does not confuse category alignment.
[Combined evidence](../skillbridge-backend/api/combined_competency.py) pools
raw/max by category ID across eligible assessments.

The mathematical concerns are:

- Increasing an unrelated assessed strength can reduce a position's category fit.
- Multiplying every positive student score by the same factor leaves cosine
  unchanged. Proportional weak and strong performance can look equally aligned.
- Increasing a required skill beyond its target can decrease cosine if it moves
  the profile away from the requirement proportions.
- Meeting every listed target does not imply a high category similarity.

These properties are appropriate to an angular similarity measure, but conflict
with interpreting the UI value as attainment of the position's requirements.
Confirmed: this affects the reviewed results. Not confirmed: that every low match
or every top-ranked position is substantively wrong.

### F2: Duplicate database concepts split numeric evidence

The saved catalog has `Database` (ID 5) and `Database Management` (ID 12), with
identical tags. The [taxonomy](../skillbridge-backend/api/skill_taxonomy.py) treats
their names as aliases for generated text. Numeric matching still compares IDs.
Some positions reference ID 5 while assessed evidence references ID 12.

This is an input-consistency problem, separate from cosine. Alias normalization
in text does not repair the numeric requirement. Taxonomy diagnostics already
detect near-duplicate names and tag overlap without mutating records.

### F3: Catalog coverage limits the recommendations

None of the six available positions has a positive Technical Support or
Cybersecurity category requirement. Strengths in those categories cannot create
an opening that does not exist in the catalog. Do not add requirements or fictitious
positions just to make a particular student's result look better.

Sample Company's broad role requirements also include several categories not
assessed by the reviewed assessment set. The current ranker treats those unknown
dimensions numerically like assessed zero. Reports should distinguish missing
evidence from demonstrated weakness.

### F4: Text inputs are broad, partially redundant and order-sensitive

[NLP generation](../skillbridge-backend/api/recommendation_nlp.py) expands aggregate
category percentages into competency bands, repeated category/tag phrases and
an orientation summary. Position text includes requirements, category vocabulary,
title, company name and saved role tags. The [ranker](../skillbridge-backend/api/scoring.py)
fits TF-IDF over one student plus the full candidate corpus, using word/phrase
cosine. spaCy supplies lemmas; its medium word vectors are not used for matching.

Observed catalog concerns include web vocabulary in a network role, programming
vocabulary in a database-support role, and broad cross-domain tags on general
frontend/backend roles. Some may reflect actual duties and require owner review.
Panabo's combined database/encoding role contains office tasks that are not
established by the assessed category totals alone.

Current text selection uses the first 8/5/2 category tags depending on score,
and up to 12 role tags in repeated role evidence. Saved ordering and score-band
boundaries therefore change which terms are represented. Illustrative category
tags are not individually assessed student abilities. Text similarity can remain
low despite high numeric category scores; it is not a requirement-coverage ratio.

### F5: Hybrid order mixes role evidence and travel preference

Current score: `0.60 * category + 0.25 * text + 0.15 * location`.
Location can contribute 15 percentage points; small differences in role components
can be reversed by proximity. The observed nearby first-ranked role is therefore
not sufficient evidence that it is the best academic specialization match.
Whether this trade-off is desired is a product/research decision.

The shared [score labels](../skillbridge-frontend/src/components/ScoreLabel.jsx)
describe fit without a per-requirement evidence breakdown. Staff and student
screens need to show which assessed targets are met, below target or unassessed.
Existing analytics' 60/80 match bands and draft allocation's review threshold also
need reconsideration if score semantics change.

### F6: Evaluation and rollout must follow the deployed calculation

[Prepared model comparison](../skillbridge-backend/api/nlp_evaluation.py) fits a
corpus containing all prepared students plus positions; production ranking fits
one student plus positions. Comparisons must have an explicitly labeled live-parity
mode before their metrics are used to select an improvement. Historical approvals
are decisions influenced by availability and existing suggestions, not automatically
independent ground truth for skill suitability.

Current freshness hashes catalog/model/text inputs, but a new numerical metric or
weight policy must also change the ranking version/fingerprint. The existing
recommendation component fields do not themselves identify the numeric metric.
Historical placement snapshots must retain interpretable original semantics.

## Proposed category metric to evaluate

Use a separate requirement-attainment measure as the leading candidate. Keep
legacy cosine as an explicit comparator, not an unexplained replacement.
For each positive target `r_i` and assessed score `s_i`:

```text
attainment_i = min(s_i / r_i, 1)
coverage = 100 * sum(w_i * attainment_i) / sum(w_i)
assessment_coverage = 100 * sum(w_i for assessed requirements) / sum(w_i)
```

Proposed starting policy: equal positive weights across required categories. A
target percentage is a target level, not automatically an importance weight.
Any different weighting needs an explicit policy and comparison. Do not silently
add a schema field or infer essential requirements from position titles.

Rules for the candidate:

- Only positive requirements contribute. No positive requirements means no usable
  category coverage; do not return 100 or divide by zero.
- Unassessed requirements contribute no evidenced attainment in a conservative
  coverage value, but are explicitly labeled unknown. Preserve the distinction
  from an assessed zero through `assessment_coverage` and per-requirement state.
- Cap surplus at 100% per requirement; exceeding one target cannot erase a
  different gap. Show absolute percentage-point gaps alongside the aggregate.
- More evidence/skill in an unrelated category cannot lower coverage. Improving
  a required score cannot lower it. No automatic mastery or placement claim follows.
- Show `all_assessed_targets_met`, below-target and unassessed states separately.
  These are explanatory states, not new backend placement-approval gates.
- Treat requirements as saved target levels until the catalog owner confirms
  whether any are hard minimums. Critical/essential rules need their own reviewed
  contract; an average can conceal an important shortfall.

Synthetic example: targets A=80 and B=40, student A=100 and B=20 produce 75%
coverage with equal weights, with a B gap shown explicitly. An extra support
score does not change coverage. Missing B yields 50% conservative attainment and
50% assessment coverage; assessed B=0 yields the same attainment but 100%
assessment coverage. This candidate is illustrative and not activated.

This metric is not expected to identify a unique best specialization when several
roles' targets are all met. It needs comparison with relevant task evidence and
an explicit travel/tie policy. Do not reintroduce unrelated strengths merely to
force a preferred first result.

## Broader catalog/research options (apply only within the current scope)

The previous catalog-growth heading is retained below as an anchor for existing
links. Generic identity, missing-evidence, freshness and regression rules apply to
the focused repair. New duties/annotation fields or review-UI proposals are deferred.

### Contract for future catalog additions

Added 31 October after the enclosed Cybersecurity/Technical Support test. This
section consolidates the proposed implementation behavior for arbitrary future
positions, companies, categories and tags. It does not activate a metric or NLP
replacement. The user has approved separate coverage/strength explanations;
ordering policy, target semantics and final NLP selection remain decisions.

### General rules, independent of the observed students

1. **Use stable category identity.** Core matching accepts category references,
   counts and target levels, including custom categories. It must not contain
   rules such as "highest Web score means recommend this company". Existing
   role/title dictionaries remain optional authoring suggestions, not the
   authoritative source of eligible roles or student abilities. Where APIs are
   updated to accept IDs, retain an explicit compatibility path for existing
   name-keyed requirement payloads and reject ambiguous names.
2. **Keep aliases reviewed and versioned.** Equivalent category names may share
   one reviewed concept for matching; do not merge based solely on spelling,
   tag overlap or a hardcoded name list. Preserve original evidence and pool
   distinct eligible raw/max once. Conflicting targets require a recorded policy.
   A later rename must not disconnect a position from its assessed evidence.
3. **Represent evidence states explicitly.** Any new required category can be
   assessed-positive, assessed-zero or unassessed. The proposed conservative
   coverage value must travel with evidence coverage and per-requirement state.
   Unknown is not demonstrated inability. An entirely unassessed role requires
   a truthful insufficient-evidence explanation rather than a misleading mastery
   judgment. Do not silently apply a new hard approval gate.
4. **Keep the two objectives separate.** Requirement coverage describes target
   attainment, with surplus capped per requirement. Strongest-area explanations
   show the role's listed demand for all tied highest-scoring assessed categories,
   followed by other score levels. Relative highest scores are not automatically
   strong performance or professional mastery. Where no role lists a top area,
   show the catalog gap; do not invent a role or suppress an assessed strength.
5. **Use reviewed role facts.** Known and unfamiliar titles can be entered with
   manually confirmed duties/tags and category targets. Do not require a Python
   dictionary update for every new occupation. Suggestions remain editable drafts;
   refreshing them must preserve confirmed/manual choices. Category vocabulary is
   contextual and does not assert that every listed language/product was assessed
   or is required by the employer.
6. **Separate ability, work relevance and logistics.** Names, student IDs, photos,
   expected outcomes and company branding are not ability features. Actual duties
   and assessed evidence may legitimately affect relevance. Location is an explicit
   logistical component/preference; it must not silently become an academic ability
   label. Capacity and approval remain separate backend rules.

### NLP catalog policy must be explicit

Adding a candidate changes current per-student TF-IDF IDF values. Existing roles'
text components can change without a change to their own requirements. The enclosed
test reproduced this behavior; it is a declared characteristic of corpus-fitted
TF-IDF, not by itself proof of unfairness or a software error.

Before activation, compare these as versioned design alternatives using the same
reviewed evidence and development labels:

- **Current dynamic corpus:** recompute over the student's profile and complete
  active catalog. Existing text-score changes are expected; make catalog version,
  stale state and refresh provenance visible.
- **Frozen reference TF-IDF vocabulary/IDF:** fit on an approved development/reference
  corpus and transform later evidence/positions consistently. Unchanged pairs can
  retain scores across candidate additions, but new categories/tags may be outside
  the vocabulary. Record representation coverage and flag unsupported evidence;
  schedule deliberate versioned refits rather than silently treating it as inability.
- **Optional fixed semantic representation:** evaluate only if separately included
  in scope. A fixed encoder can score a pair without refitting to every candidate,
  but can have domain gaps, negative/differently scaled cosine values, truncation
  and model-update effects. It is not an automatically superior solution.

Do not promise unchanged old NLP scores while retaining dynamic-corpus fitting.
Do not choose a frozen vocabulary without an unknown-vocabulary policy. Do not
choose an embedding model merely because it is newer. The selected policy and any
score transformation must be locked before final evaluation. Repeated generic text,
company names and unreviewed terms must not be used to manufacture a high score.

### Change lifecycle and history

Extend existing validation, catalog transactions, freshness fingerprints and role
boundaries rather than building a second mutable catalog. Model the transition as
validated edit -> committed catalog version -> stale affected results -> deliberate
refresh -> results with the matching input/algorithm version. Existing automatic
refresh after creation may remain where appropriate, but must not expose a mixture
of old explanations and new scores. Concurrent edits during generation must not
certify an old ranking as current.

Version numeric metric, category mapping, confirmed input revisions, text policy,
actual model and weights. Preserve original assessment/retake evidence, archived
batch records and placement snapshots. A new category must not rewrite historical
student scores. Assess whether synchronous refresh remains acceptable at agreed
future student/catalog sizes before proposing a queue or different infrastructure.

### Required regression and sensitivity matrix

| Change | Required expected behavior |
| --- | --- |
| Add a position in a completely new field | It can be represented from saved requirements; no title-specific code branch is needed |
| Add an unused category | Existing numeric coverage values remain unchanged at fixed evidence; freshness may still require a declared catalog refresh |
| Add an unassessed required category | Explicit unknown-evidence state, not a claim that the student failed it |
| Improve an assessed required score | Proposed coverage does not decrease; separate text behavior is measured rather than assumed monotonic |
| Add an unrelated assessed strength | Proposed coverage does not decrease; strongest-area explanations update truthfully |
| Rename student/company display metadata | New scoring path must not use those names as ability evidence; exact ties follow a documented deterministic policy |
| Rename a category without changing identity | Evidence/requirement linkage remains; text changes are versioned if descriptive content changes |
| Review an alias mapping | Reconcile raw/max without double counting, invalidate current results and preserve original history |
| Reorder/deduplicate equivalent tags | Canonical confirmed-input representation is order/deduplication stable; declared truncation/priority rules are tested |
| Add genuine new tags/duties | Only confirmed facts enter candidate inputs; impact is attributed to the input version |
| Add a new candidate | Existing numeric pair components remain; NLP behavior follows the explicitly selected corpus policy |
| Clone feature-equivalent roles | Equal components, transparent ties; neither receives fabricated evidence or special weights |
| Archive/restore or edit during generation | Preserve history/capacity rules and prevent stale approval or falsely current results |
| No usable text, no requirements, all-zero or missing evidence | Explicit truthful unavailable/zero states, no fabricated perfect match |

Test synthetic catalogs spanning unrelated and mixed fields, arbitrary IDs/order,
custom vocabulary, missing evidence and catalogs beyond the current eight roles.
Use metamorphic/property checks as well as fixed examples. Both observed users
remain regression cases, not the source of expected winners or final labels.
Keep every declared method/result, including negative and no-gain outcomes.

### Implementation order recommended now

1. Refresh the dependency audit, then implement pure generic evidence/requirement
   contracts and the production-parity evaluation adapter locally.
2. Add read-only preview explanations for coverage, gaps/unknowns and strongest-area
   demand. Keep production ranking unchanged while confirming semantics and rubric.
3. Add reviewed canonical mappings and confirmed role/question input provenance
   with compatible APIs and explicit admin/assessment-author scope enforcement.
4. Evaluate numeric and NLP candidates separately, including the corpus-policy
   alternatives above, against same-evidence structured controls and fresh blinded
   judgments. Select on development data and evaluate the frozen selection once
   on a genuinely held-out cohort.
5. Integrate only the selected justified behavior with versioned refresh/history
   compatibility, current-role UI/report checks, target-load measurements and a
   concrete rollback plan. No live write/deployment follows from this document.

Engineering guards reduce student-specific and catalog-specific tailoring. They
cannot certify zero bias: evidence coverage, human requirements/judgments, sampling,
logistical preferences and representation choices remain possible sources of bias.
Use the single-reviewer disclosure and decision gates in the
[validation readiness checklist](RECOMMENDATION_VALIDATION_READINESS.md).

## Implementation sequence and decision gates

### Phase A: Confirm the matching contract and catalog boundaries

- [x] Review the two authorized observations, current source and supporting plans.
- [x] Establish component parity and mathematical counterexamples.
- [ ] Confirm whether category percentages mean minimums or desirable targets,
  and whether the capstone method requires legacy numeric cosine to remain primary.
- [ ] Review database-category equivalence, conflicting requirement targets, actual
  role duties and missing assessment coverage with the authorized catalog owner.
- [ ] Prepare a reversible canonical-category mapping/proposal. Preserve original
  `SkillScore`, attempt history and placement snapshots. Pool distinct eligible
  raw/max evidence if multiple IDs map to one concept; never duplicate evidence,
  take an arbitrary maximum, or average percentages. Conflicting position targets
  require review rather than automatic averaging.
- [ ] Do not bulk-refresh tags or add positions without confirmed business facts.

Deliverable: reviewed target semantics and mapping policy. Catalog/data changes
are separate from the present read-only investigation.

### Phase B: Build a pure offline category comparison

- [ ] Separate pure metric calculation from the mutation/persistence wrapper.
  Compare legacy cosine, required-dimensions-only cosine and capped attainment.
  Masked cosine remains scale-invariant and must not be accepted as a complete
  requirement-satisfaction fix just because its numbers are larger.
- [ ] Use synthetic fixtures with unequal assessment sizes, one/many assessments,
  aliases, missing evidence, zero targets, surplus and single-category roles.
- [ ] Initially hold text, candidates, locations and 60/25/15 weights fixed to
  isolate the category change. Report per-component changes and ranking reversals.
- [ ] Review outputs before selecting a versioned algorithm. If numeric cosine is
  a required research constraint, retain and relabel it as pattern alignment and
  introduce coverage explanations explicitly; document that the original metric's
  limitations remain. Align the manuscript with the selected method.

Deliverable: reproducible comparison and selected numeric contract, not a promise
that either observed student's first recommendation will become a particular role.

### Phase C: Evaluate focused NLP input changes

- [ ] Freeze one-student/common-candidates TF-IDF scope and include a live-parity
  evaluation path. Retain regex and current strict `spacy_md` as comparators.
- [ ] Compare short factual text against the current repeated/banded text. Isolate
  company names, orientation summaries, boilerplate, repetition and tag selection
  one at a time. Keep display narratives independent from ranking text.
- [ ] Use reviewed role tags/duties and deterministic, documented text budgets;
  do not borrow target-role terms into the student profile to boost overlap.
- [ ] If duties or specific student subskills are needed, use the existing phased
  preview/annotation design. Reviewed question annotations must reflect what each
  eligible question actually tests, with correct/assessed counts and provenance.
  This is a later evidence improvement, not a prerequisite for diagnosing cosine.
- [ ] Compare structured coverage alone, coverage+location, current text, revised
  text and full hybrid on the same independently labeled cases. Report top-k
  relevance and gap recognition, not merely average similarity. Keep low-quality
  matches available for review without presenting them as strong recommendations.
- [ ] Evaluate optional embeddings only after the inputs and baseline are sound.
  No model switch, score inflation, best-candidate normalization or weight tuning
  to reproduce a desired individual's rank is justified by these two observations.

Deliverable: measured evidence for selecting or rejecting each NLP change.
This review does not establish a new model's accuracy or the best hybrid weights.

### Phase D: Agree the ranking and explanation policy

- [ ] Compare the legacy hybrid with skill-first ranking and travel as a secondary
  preference. Consider explicit fully-assessed-targets-met, gaps and unknown-evidence
  groups. Confirm trade-offs rather than silently introducing a new eligibility gate.
- [ ] Show score/target/gap, source assessment counts, unknown requirements, actual
  preprocessing model and a readable component contribution explanation.
- [ ] Distinguish highest-ranked available, targets met and coordinator-approved.
  Show catalog gaps when no role represents a strongest assessed area. Do not
  describe missing evidence as confirmed inability or an opening as guaranteed fit.
- [ ] Use consistent component precision in API/student/staff/export explanations.
  Existing serializer rounding followed by UI rounding can differ at half-points;
  eliminate double rounding when implementing the presentation change.
- [ ] Review analytics bands, coordinator-review thresholds, company grouping,
  draft allocation, report exports and model-comparison labels for new semantics.

Deliverable: one reviewed scoring/explanation contract for every role.

### Phase E: Version, verify and deliberately activate

- [ ] Refresh the whole-system dependency audit required by the phased NLP handoff
  before application changes. Do not represent this focused review as a full audit.
- [ ] Version numeric metric, weights, mapping, evidence/text inputs and actual model.
  Extend fingerprints and decide compatible persisted explanation/version fields.
  Save explanations from the same inputs that produced a score; do not reconstruct
  a historical explanation from a later edited catalog.
- [ ] Preserve assessment and combined raw/max totals, retake history, prior batch
  archives and original placement snapshots. Mark old rankings stale under new
  scoring; use a deliberate admin refresh. Label legacy snapshot metrics correctly.
- [ ] Test backend student/staff authorization, inclusion/completion, stale approval
  rejection, capacity and concurrency. Keep unknown requirements and optional
  fit reviews separate from existing hard placement-access rules.
- [ ] Run targeted Django regressions on disposable PostgreSQL, frontend tests,
  lint/build and real API/browser journeys across student/instructor/admin views.
  Verify migrations/compatibility if metadata fields are added.
- [ ] Reconcile the chosen algorithm and evaluation conditions in project/paper
  documentation. Plan a small controlled release and rollback separately; do not
  deploy or regenerate live results as part of this review.

## Verification completed versus outstanding

Completed in this review:

- Read-only saved-answer/individual/combined reconciliation for both authorized cases.
- Twelve local numeric/text/hybrid reproductions against saved results.
- Strict local spaCy Medium preprocessing, without fallback.
- Prefix-removal diagnostic holding the candidate corpus and other text fixed.
- Twelve database-free synthetic checks using the actual aggregation loop/category
  expression and a separate illustrative coverage function. They cover scale
  invariance, unrelated strengths, above-target improvements, raw/max aggregation,
  proposed monotonicity/capping/unknown states and tag ordering.
- Command from repository root:
  `skillbridge-backend/venv/Scripts/python.exe work/recommendation_review_20261031/check_properties.py`
  Result: 12 passed. The local runner contains synthetic values only.

Not completed: application implementation; API/browser regression suites; hosted
latency; independent suitability labels; live catalog correction; numerical-metric
selection; algorithm activation; population-level effectiveness evaluation.
No application build or database test suite was needed for these document edits.

## Resume checkpoint

This initial-review checkpoint is superseded for the current next step by the
[latest assessment-led checkpoint](#latest-checkpoint-assessment-led-suggestion-experiment).
Subsequent disposable sandbox work completed 84 numeric/text comparisons,
132 follow-up NLP comparisons, 215 synthetic profile diagnostics and local
report browser checks. These are development evidence; they do not complete
application integration or independently judged effectiveness validation.

Branch: `main`. This review's edits: this plan and its overview link only; a
synthetic local diagnostic runner exists under ignored
`work/recommendation_review_20261031/`. Unrelated frontend position-dialog edits
appeared during the review in admin company components/styles and browser tests;
they were left untouched and were not verified by this task.
Known functional findings: F1-F6 above. No failed numerical property check.
All phases involving application/data changes remain unchecked.

Exact next implementation step after the user selects implementation scope:
confirm the target/importance semantics and numeric-cosine research constraint,
refresh the dependency audit, then implement the pure offline category comparison
in Phase B with synthetic cases. Keep production untouched while selecting the
metric and catalog mapping policy.
