# SkillBridge NLP design decision

Date: October 18, 2026. Status: proposed implementation contract and reviewed
notebook comparison plan. No live application changes are authorized or made by
this document. No winning NLP model or real-world accuracy is established.

Implementation handoff: follow [phased implementation](NLP_PHASED_IMPLEMENTATION.md).
Before application edits, perform that handoff's mandatory whole-system context
audit, record a verified baseline and trace all affected dependencies. Extend
working features, preserve data/history and check for regressions after changes.
Phase 1 delivers confirmed task selections and generated-description previews;
Phase 2 delivers reviewed assessed-evidence previews; Phase 3 evaluates parity
and alternatives offline; Phase 4 deliberately activates one selected change;
Phase 5 reconciles the manuscript. New inputs do not enter production ranking
automatically when preview features are built. Implement only a requested phase.

## Decision and scope

Proceed with an evidence-based matching design: generate position descriptions
from selected duties, derive student evidence from eligible graded items, compare
textual evidence with requirements, and keep numeric assessment evidence explicit.
Use the existing TF-IDF/cosine pipeline as the reference implementation. Evaluate
each change independently before replacing the current pipeline.

This is the recommended architecture to investigate, not a claim that the
combined proposal is the best-performing configuration. The prototype's combined
variant did not outperform its simpler alternatives or the category baseline.
Existing notebooks support implementation exploration; they do not establish
final effectiveness. Only one actual completed student has been reported by the
user, without a database audit in this task; no population-level claims follow.

Current scope: settle design, review notebook comparisons, and draft accurate
paper revisions. Real-data collection and live integration are later phases.

## 1. Keep the stages distinct

| Stage | Responsibility | What it does not establish |
| --- | --- | --- |
| Annotation | Associate an item with a skill it assesses; record reviewed duties | No student ability is inferred from a category name or job title alone |
| Evidence aggregation | Count correct/assessed eligible items and preserve provenance | A few correct items do not establish complete technology mastery |
| Description generation | Render accepted facts with deterministic templates | Template generation is not semantic understanding or evidence collection |
| Preprocessing | Tokenization, stopword filtering, lemmatization where appropriate | spaCy/Stanza preprocessing is not a different recommendation algorithm |
| Representation | TF-IDF reference; optional semantic embeddings in a later experiment | Neither representation guarantees placement suitability |
| Matching | Compute evidence/requirement similarity and component scores | Text similarity is not a probability of success |
| Ranking and approval | Rank candidates; separately enforce placement access/capacity | A high rank does not grant placement eligibility |

The defensible NLP contribution is interpreting/matching textual skill evidence
and work requirements. Automatic templated descriptions improve input consistency
but are not, by themselves, proof that NLP improves placement matching.

## 2. Position input and generation contract

The authorized catalog editor supplies title and category requirements as today.
The system suggests typical task/technology selections using a curated vocabulary.
The editor accepts, removes or edits selections; long prose is optional. Generate
the NLP description from accepted selections, not every possible task for a role.
Instructors do not acquire new catalog permissions through this feature.

Suggested data contract, not a database migration yet:

```json
{
  "position_id": "catalog identifier",
  "selected_duties": [{"task_id": "api_endpoints", "text": "Develop and test API endpoints"}],
  "required_skill_ids": ["api_development", "sql_queries"],
  "requirements_review_status": "confirmed",
  "requirements_source": "authorized editor confirmation",
  "text_generation_version": "proposed version identifier"
}
```

Known role: suggest a small relevant task list. Unknown role: use reviewed custom
tasks or retain only known requirements, without inventing company-specific work.
Preserve suggestions separately from confirmed facts. Confirmation can be checkboxes
or selections; it need not require writing a paragraph. Keep an auditable version
of the actual input used to generate a recommendation.

Do not add an external generative service for this first version. Templates are
enough to test the proposed workflow without costs, fabricated duties or a new
service dependency. A later language-model drafting feature would be a separate
proposal and still require fact confirmation.

## 3. Student evidence contract

Use question-level annotations reviewed for what the question actually tests.
Automatic annotation suggestions may reduce typing but remain suggestions until
reviewed. Do not infer target positions, read expected-role labels, or borrow
role vocabulary solely to make a profile resemble its desired output.

Aggregate only evidence selected under existing batch/assessment rules, including
submission state, inclusion, finalization, retake and integrity constraints.
Preserve assessed counts, correct counts, source item/attempt IDs, annotation
version and evidence timestamp. Wrong and unanswered eligible questions remain
in denominators. Distinguish unassessed skills from assessed zero scores.

Example description from actual eligible counts, if present:

> Assessment evidence includes 4 correct responses from 5 SQL-query items and
> 2 correct responses from 5 interface-development items. These results describe
> the assessed items and do not independently establish mastery of either skill.

No names, institutional IDs, answer keys or unnecessary response text belong in
NLP inputs. Recommendation explanations should cite safe skill evidence rather
than expose test answers. Retain current access boundaries and grading rules.

## 4. Numeric evidence must remain numeric

For an assessed skill s, retain the illustrative ratio e(s) = correct(s)/assessed(s),
plus the denominator and source provenance. Decide how many items and what item
coverage justify a skill statement with the assessment owner; no universal item
minimum or mastery cutoff is assumed here.

TF-IDF does not reliably interpret counts as ordered competence. Its default
tokenizer excludes single-character tokens, and text repetition can dominate
similarity. Descriptions containing counts are useful for transparency but are
not a substitute for a numerical evidence representation.

The prototype's structured skill-coverage control makes this distinction visible.
It uses the same reviewed duty-skill IDs and item counts without NLP. That control
is necessary: better item evidence could help a simple structured system too.
Do not interpret gains over category totals alone as an isolated NLP advantage.

For a future scoring revision, explicitly choose and test how category totals,
specific skill counts and semantic relevance interact. Avoid silently double
counting the same item evidence in several components. This choice is not settled
by the present simulation and must not be smuggled into the 25% text component.

## 5. Matching and model choice

Reference: retain per-student TF-IDF fit over that student's generated profile and
the common candidate descriptions, using the frozen preprocessing and n-gram
configuration. Hold weights at 60% category, 25% text and 15% location for the
input-comparison experiment. Existing weights are a reference condition, not
evidence of optimality. Preserve rounding and explicit deterministic tie policy.

Compare trained preprocessing with regex + TF-IDF before claiming that spaCy or
Stanza improves quality. Medium word vectors are not used by TF-IDF. An unavailable
model must be reported unavailable in evaluation rather than inherit fallback scores.

Optional later challenger: a compact Sentence Transformer such as all-MiniLM-L6-v2
for raw task/evidence phrases, with normalized embeddings and cosine similarity.
Use natural text rather than lemmatized keyword bags or repeated tags. Record model
revision, maximum sequence length, truncation/chunking, device and batch size;
reuse the same inputs across models. Do not compare a truncated narrative with
an untruncated baseline without disclosing that change.

Embedding cosine can be negative. Any clipping/rescaling for hybrid scoring must
be explicitly fixed on development data and reported; scores are not calibrated
probabilities. A model upgrade may require weight calibration on development data,
so a semantic challenger is a separate versioned experiment. Neither SBERT research
nor a general model card establishes that it is best for SkillBridge.

No embedding challenger is implemented or measured by the delivered proposal
notebook. Do not describe that notebook as a semantic-embedding comparison.

## 6. Notebook comparisons and interpretation

The existing [proposal notebook](../outputs/colab_proposal/SkillBridge_Proposed_Features_Comparison.ipynb)
already tests current text, duty descriptions only, specific-item evidence only,
and both together, with regex and spaCy small. It also includes category/location
without NLP and same-evidence structured skill coverage. See the
[comparison review](../outputs/nlp_design/NOTEBOOK_COMPARISON_REVIEW.md).

Its 60 familiar synthetic cases contain artificial item outcomes allocated without
expected-role input. Duty templates are illustrative. Locations are missing and
neutral. It is a useful behavior demonstration, not a reliable way to choose the
best real-world model. It assumes one complete equal-weight assessment evidence
set, not production multi-assessment/retake aggregation.

An observed score of 91.67% means 55/60 correct; 90% means 54/60. The one-case
difference does not justify declaring a winner. More words, more components, or
more complex models are not automatic improvements.

## 7. Transfer into the system later

Before integration, select a specific proposal using appropriate evaluation.
Then version the evidence schema and helpers, implement role-safe selection UI,
adapt eligible evidence without changing score history, and test component parity
with notebook fixtures. Snapshot relevant inputs and actual model identifiers.
Mark recommendations stale when inputs change using the existing invalidation
workflow. Preserve assessment history, batch combined evidence and placement
snapshots as distinct records.

Required checks: unauthorized edits; unknown and unreviewed duties; no evidence;
assessed zero versus missing skills; unequal assessment sizes; excluded/flagged
attempts; retakes; unavailable models; empty text; missing coordinates; ties;
stale saved profiles; and capacity/approval gates. Measure browser/API latency
separately from offline partial batch timings. No live change is made at this stage.

## 8. Paper action

Use the [paper revision draft](../outputs/nlp_design/PAPER_REVISION_DRAFT.md),
which labels proposed work as proposed and completed prototype work as simulation.
Do not overwrite old experimental tables with new numbers from another dataset.
Reconcile timing/model-selection discrepancies separately. Choose sources to
support design and metrics, not a predetermined passing percentage.

## Sources and claim boundaries

- Gunawardana & Shani (2009), task-aligned recommender evaluation:
  [JMLR](https://jmlr.org/papers/v10/gunawardana09a.html).
- Kara et al. (2023; online 2022), skill/job matching and TF-IDF/cosine baseline:
  [publication](https://doi.org/10.1007/978-3-031-16075-2_35).
- Qin et al. (2018), related person-job classification evaluation:
  [publication](https://doi.org/10.1145/3209978.3210025).
- Qi et al. (2020), preprocessing and efficiency context:
  [ACL](https://aclanthology.org/2020.acl-demos.14/).
- Reimers & Gurevych (2019), sentence embeddings compared by cosine:
  [ACL](https://aclanthology.org/D19-1410/).
- Sentence Transformers [similarity documentation](https://www.sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html)
  and [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
  support setup/usage constraints, not SkillBridge accuracy claims.

Primary source pages were checked on October 18, 2026. This design and its
implementation choices are project proposals, not endorsements by those papers.
