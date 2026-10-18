# SkillBridge NLP improvement and evaluation plan

Saved: October 18, 2026.

For the current design contract and copyable paper wording, start with the
[NLP design decision](NLP_DESIGN_DECISION.md) and its linked comparison review.
Those documents clarify that numeric evidence is separate from text similarity
and that semantic embeddings remain an unmeasured optional challenger.

This document consolidates the recommendations discussed in this chat. It is a
planning and research record, not a statement that the proposed features have
been implemented. The user prefers automatically generated position descriptions
and minimal manual typing. Saving this plan does not implement it or authorize
production data changes.

## 1. Intended contribution

Investigate whether detailed assessed skill evidence and meaningful position
requirements improve OJT matching beyond category-score and location matching.
NLP should assist a measurable placement task and produce understandable evidence.
The presence of an NLP library alone does not establish a useful contribution.
Broader attendance/monitoring functionality in another system does not answer
this matching research question; the final capstone scope remains for the team
and adviser to agree.

The current limitation is that generated student text largely restates the same
category evidence already used by structured similarity. More words do not
necessarily add new information or improve matching.

## 2. What is already present

- Category-score cosine similarity, TF-IDF text similarity and location similarity.
- A 60% category / 25% NLP / 15% location hybrid formula.
- Neutral student competency text generated from assessment scores and category tags.
- Automatically generated position text from title, company, tags and percentage requirements.
- Selectable spaCy small/medium and Stanza preprocessing, with production fallback behavior.
- An admin evaluation feature, macro metrics, ranking diagnostics and text previews.
- Stored recommendation component scores and actual model identifiers.
- A separate Colab-ready offline evaluation notebook and independent-data template.

The position model currently has a title, company, available slots and tags;
category percentage requirements are separate records. It does not currently
store the proposed structured task/duty selections. Questions currently have
a category, text, type and order, without the proposed specific skill annotations.

Keep backend role boundaries: authorized admins manage position/catalog data;
instructors manage assessments within their existing permissions. The proposal
does not grant instructors new company-management permissions.

## 3. Observed development results and their limits

The new notebook was executed locally on 60 familiar synthetic development cases:

| Configuration | Structured/hybrid Top-1 | Text-only Top-1 | Structured/hybrid Hit Rate@3 |
| --- | ---: | ---: | ---: |
| Assessment/location, NLP removed | 90.00% | Not applicable | 100% |
| Regex + TF-IDF hybrid | 81.67% | 68.33% | 100% |
| spaCy small + TF-IDF hybrid | 80.00% | 65.00% | 100% |
| spaCy medium + TF-IDF hybrid | 80.00% | 65.00% | 100% |

This run does not demonstrate an improvement in first-place accuracy from NLP.
It does not establish that NLP is incapable of helping on independently assessed
realistic evidence. The dataset lacks coordinates, so location scores are neutral
0.5 and the run cannot validate geographic discrimination.

The old notebook results (93% NLP-only and 89.33% hybrid on 300 synthetic cases)
belong to different configurations. They are not verified accuracy of the current
application. Differences include generated text, role-specific repetition, dataset
size, preprocessing details and TF-IDF corpus construction. The old student text
inserts a position inferred from category scores and related role terms; the current
system's neutral text avoids inserting an exact target position. This inference
is not a direct copy of the expected label, but it supplies an additional structured
matching signal inside the supposedly NLP-only input.

Clarify the three TF-IDF scopes:

- Old notebooks: all 300 student profiles plus candidate descriptions together.
- Existing prepared admin evaluation: all 60 prepared profiles plus candidates together.
- Live ranking and the new contribution notebook: one student profile plus all candidates.

These differences plausibly affect scores, but a controlled comparison is needed
to attribute the decrease to particular changes. There is no known universal
70%, 85% or 90% passing threshold. An individual student's NLP-fit similarity
percentage is also not model accuracy.

Evidence: [local verification](../outputs/colab_nlp/LOCAL_VERIFICATION.md) and
[machine-readable results](../outputs/colab_nlp/verified_local_run/report.json).

## 4. Priority: automatic position duties and description generation

### Proposed flow

1. The authorized catalog editor enters/selects the position title and category requirements.
2. The system suggests a small, relevant set of typical tasks and technologies
   from a curated role/task vocabulary.
3. The editor accepts, removes or adjusts suggestions using editable selections.
4. The system generates a readable description from the accepted structured data.
5. NLP matching consumes the accepted duties/requirements and generated description.

Long manual descriptions should be optional. This can use templates and the
existing Python stack without requiring an external generative AI service.
Typical role suggestions are drafts; the system cannot know a company's actual
work from the title alone. Keep suggestions distinguishable from confirmed duties.
For an unknown title, use known requirements conservatively or request task
selections instead of inventing company-specific work.

Example draft, only if supported by selected tasks and requirements:

> This internship involves developing backend services, working with relational
> databases, and testing API endpoints. Relevant skills include Python, SQL,
> debugging, and version control.

Potential structured fields: selected task IDs, required technology/skill IDs,
optional supplemental description and the source/version of generated text.
Reuse existing tags where appropriate; do not create duplicate parallel taxonomies.
Regenerate descriptions consistently when their saved inputs change, and mark
affected recommendations stale through the established invalidation workflow.

Generating longer text alone is not an improvement criterion. The value comes
from more accurate and discriminating requirements.

## 5. Priority: question-level assessed skill evidence

- Associate assessment questions with specific skills they actually assess,
  alongside the existing category. Start with a small instructor-reviewed pilot.
- Offer automatic tag suggestions from question content and existing vocabulary
  to reduce typing, but treat suggestions as annotations to validate, not measured
  student skills. Never expose answer keys through student-facing explanations.
- Derive student evidence from eligible graded responses. Preserve submitted,
  stopped/flagged, retake, batch, inclusion and completion rules.
- Record enough provenance to trace an evidence statement to the question,
  eligible attempt and scoring rule. Distinguish unassessed skills from failed items.
- Do not equate one correct answer with mastery of an entire technology. Define
  how many items and what coverage support a claim with instructors.
- Keep assessment score history, batch combined competency evidence and placement
  snapshots distinct. Do not silently change existing scoring or historical totals.

Example research case: two students can both score 80% in Programming while
demonstrating different assessed subskills. Specific evidence may distinguish
database-query work from frontend work when aggregate scores cannot.

## 6. Other candidate evidence and model experiments

Independently written student project/task descriptions, reviewed portfolio
evidence, and richer company requirements may provide information absent from
category totals. Their collection, provenance and use require an explicit scope
decision and an updated evaluation design. Self-reported text is not automatically
verified competency and should be distinguished from assessed evidence.

Semantic embeddings such as Sentence-BERT/MiniLM are a possible later experiment,
not a required upgrade or guaranteed improvement. The current spaCy medium
pipeline does not use its word vectors for TF-IDF ranking. More complex models
and different weights should be selected on development data only.

## 7. Matching, explanations and system safeguards

- Match specific assessed evidence to confirmed tasks and requirements, not
  merely overlapping generic category words.
- Show supporting evidence, matching requirements and missing/unassessed areas
  in understandable recommendation explanations. Distinguish evidence gaps from
  confirmed inability. Avoid presenting similarity as probability of placement success.
- Record the actual model used; evaluation must not silently substitute fallback
  metrics for an unavailable requested model.
- Preserve the current weights until a common, independent protocol justifies a change.
  Do not adjust keywords, labels or weights merely to reach a desired percentage.
- Make input changes invalidate stale recommendations and preserve snapshot/history
  semantics. Authorize these operations on the backend.
- Keep eligibility, capacity and instructor placement approval separate from ranking.

## 8. Evaluation protocol

Compare the following using the same cases, candidate catalog and labels:

1. Assessment/location matching with NLP removed, retaining their relative weights.
2. Regex preprocessing + TF-IDF, to establish a text-matching baseline.
3. spaCy small/medium and optional Stanza + the same TF-IDF configuration.
4. Text-only and complete hybrid performance, reported separately.

This separates the value of text matching from the additional value of trained
linguistic preprocessing. If spaCy does not improve over regex + TF-IDF, do not
claim that the trained preprocessor improved quality.

For causal diagnosis, keep cases fixed and change one component at a time:
neutral versus inferred-role text, tags/repetition, preprocessing, and TF-IDF scope.
A separately labeled notebook-reproduction mode could explain discrepancies;
it must not be mislabeled as production evaluation.

### Metrics

| Metric | Use |
| --- | --- |
| Top-1 accuracy | Whether the first suggestion matches the independently assigned expected first choice. |
| Hit Rate@3 | Whether that expected choice occurs in the top three; does not establish that all three are suitable. |
| Macro precision, recall and F1 | Classification of first-ranked role/position labels; explicitly state the averaging convention. |
| Per-role results and confusion matrix | Diagnose weak roles, recurring confusion and class support. |
| Precision@3, Recall@3 and NDCG@3 | Add when assessors provide complete relevance judgments for multiple suitable positions. |
| MRR / expected rank | Supporting diagnostics of where the expected position appears. |
| Separate computation stages | Compare preprocessing and feature/scoring cost under stated conditions. |
| End-to-end response latency | Measure actual application wait separately from notebook batch computation. |

Record candidate counts, class support, software/model versions, CPU/RAM/GPU if
used, batch sizes, warm-up, repeated measurements and exact timer boundaries.
Do not compare a batch total to another paper's per-instance inference time.

### Independent labels and acceptance

- Have OJT evaluators judge cases using an explicit suitability rubric without
  seeing system rankings first. Record disagreement and adjudication procedures.
- A historical approved placement can reflect the existing recommender and is
  not automatically independent ground truth or the only suitable placement.
- Separate development and final test cohorts before selection. Keep all records
  of one student in one split; account for related templates/cohorts.
- Agree on practical criteria with the adviser before viewing the final test,
  including relevance, improvement over no NLP and acceptable operational cost.
- Freeze method, data and protocol, then evaluate the selected method and baseline
  on the untouched test. Use paired uncertainty estimates and disclose limitations.
- Treat the bundled synthetic dataset as development evidence. Reusing it cannot
  establish independent validation, regardless of a high score.

## 9. Paper revisions

- Separate NLP-preprocessing comparison from full hybrid evaluation.
- Label the current precision/recall/F1 as macro averages and rename notebook
  Top-3 accuracy to Hit Rate@3, explaining its single-label meaning.
- Disclose synthetic construction, expected-label assignment, candidate count,
  role-related generated terms and the absence of independent validation.
- Reconcile manuscript versus notebook timing tables. They identify different
  fastest configurations; do not select one without run-specific evidence.
- Describe computation time according to what was timed, not as website latency.
- Present old notebook results as preliminary experiments and report new system
  results separately with their actual configuration and dataset.
- Do not claim that hybridization improved Top-1 accuracy based on the old
  93% text-only versus 89.33% hybrid results.
- Support metric/method choices with research, without turning other papers'
  scores into passing grades or claiming cross-dataset superiority.
- Retain functional correctness and usability/user-satisfaction evaluation as
  separate aspects of the overall capstone.

## 10. Supporting papers

| Source | Appropriate use |
| --- | --- |
| Gunawardana & Shani (2009), *A Survey of Accuracy Evaluation Metrics of Recommendation Tasks*, JMLR 10, 2935-2962. [Publication](https://jmlr.org/papers/v10/gunawardana09a.html) | Main methodological reference for task-appropriate evaluation and offline experiment design. |
| Qin et al. (2018), *Enhancing Person-Job Fit for Talent Recruitment: An Ability-aware Neural Network Approach*, SIGIR, 25-34. [DOI](https://doi.org/10.1145/3209978.3210025) | Related person-job classification metrics and efficiency reporting; binary application outcomes differ from OJT role ranking. |
| Kara et al. (2023; online 2022), *Job Recommendation Based on Extracted Skill Embeddings*, IntelliSys proceedings, 497-507. [DOI](https://doi.org/10.1007/978-3-031-16075-2_35) | Skill-based matching and a TF-IDF/cosine baseline; ranking precision differs from macro classification precision. |
| Qi et al. (2020), *Stanza: A Python Natural Language Processing Toolkit for Many Human Languages*, ACL System Demonstrations, 101-108. [DOI](https://doi.org/10.18653/v1/2020.acl-demos.14) | Linguistic preprocessing and computational trade-offs; not OJT recommendation accuracy thresholds. |

Additional internship and recent person-job studies from the
[imported research context](SHARED_CHAT_NLP_EVALUATION_CONTEXT.md) can provide
background. Recheck full publications before relying on their numerical results.
No study listed here independently validates SkillBridge's effectiveness.

## 11. Recommended implementation order

Use the authoritative [phased implementation handoff](NLP_PHASED_IMPLEMENTATION.md)
for scope, acceptance checks and the ready-to-copy agent prompt.
Its mandatory system audit comes first: map the current architecture and all
role journeys, trace affected callers and persistence, record baseline behavior,
and implement additive changes with regression checks. Existing functionality,
data/history and unrelated edits must be preserved; improvement is verified,
not assumed. Refresh the audit for each later phase's affected paths.

1. **Phase 1:** editable task suggestions and generated position-description
   preview, with authorized persistence. Keep current ranking text unchanged.
2. **Phase 2:** reviewed question-skill annotations and traceable evidence preview.
   Keep grading, historical profiles and ranking unchanged.
3. **Phase 3:** versioned offline notebook comparisons, same-evidence controls and
   numerical parity. Agree on evaluation criteria before any final test. Existing
   simulations guide development; independent inputs/labels are needed for an
   independent effectiveness claim, not for synthetic code verification.
4. **Phase 4:** deliberately activate one specifically selected, evaluated matching
   change, preserving gates, history, provenance and stale-state handling. If
   effectiveness is unproven, identify the activation as a pilot.
5. **Phase 5:** reconcile manuscript claims, actual implementation, result tables,
   timing definitions, research support and remaining limitations. Maintain
   relevant documentation within every earlier phase as well.

Each phase is a separate implementation task. A request for Phase 1 does not
authorize completing all later phases or production deployment/backfills.

Do not declare the NLP contribution established unless the results support it.
The pilot is intended to discover whether these additions work, not guarantee
a desired score. Application feature changes have not been made by saving this plan.

## 12. Existing artifacts and next entry point

- [Proposed-feature comparison notebook](../outputs/colab_proposal/SkillBridge_Proposed_Features_Comparison.ipynb)
- [Proposed-feature experiment guide](../outputs/colab_proposal/README.md)
- [Proposed-feature project notes](NLP_PROPOSAL_EXPERIMENT.md)
- [Colab notebook](../outputs/colab_nlp/SkillBridge_NLP_Contribution_Evaluation.ipynb)
- [Notebook guide](../outputs/colab_nlp/README.md)
- [Independent dataset template](../outputs/colab_nlp/independent_dataset_template.json)
- [Complete Colab package](../outputs/colab_nlp/SkillBridge_Colab_Package.zip)
- [Notebook verification](../outputs/colab_nlp/LOCAL_VERIFICATION.md)
- [Colab evaluation project notes](NLP_COLAB_EVALUATION.md)
- [Current evaluation methodology](../skillbridge-backend/api/data/README.md)
- [Current input-quality findings](../skillbridge-backend/api/data/INPUT_QUALITY_UPDATE.md)

Recommended first implementation target: **Phase 1 only**, an authorized position
editor with suggested, editable duty/technology selections and automatic
description preview. New generated text remains outside ranking until Phase 4.
