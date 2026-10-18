# SkillBridge paper revisions: copyable draft and editing notes

Prepared October 18, 2026. Use the numbered prose sections as draft text. This
does not edit the original manuscript. Proposed features must remain in future
or conditional tense until actually implemented and evaluated. Match citation
numbering/style to the final thesis bibliography.

## 1. Replace an ambiguous description of the NLP method

SkillBridge uses NLP-assisted text matching as one component of a hybrid OJT
recommendation process. The current text pipeline applies a selected pretrained
preprocessing configuration to generated student competency profiles and position
descriptions, represents the processed text through TF-IDF, and calculates cosine
similarity. The evaluated spaCy and Stanza configurations therefore perform
preprocessing; they are not three distinct recommendation algorithms. In this
TF-IDF pipeline, spaCy medium's pretrained word vectors are not used for matching.

The current hybrid score combines category-score similarity, text similarity,
and location similarity with weights of 0.60, 0.25, and 0.15, respectively. These
weights describe the implemented reference configuration and should not be
interpreted as experimentally established optimal weights. A recommendation
score expresses the implemented matching rule rather than a calibrated
probability of successful placement. Placement approval remains a separate
decision subject to the application's eligibility and capacity rules.

## 2. Add as proposed refinement or future-work subsection

An evidence-based refinement is proposed to reduce dependence on generic
category vocabulary. For position requirements, the system would suggest
role-related tasks and technologies for confirmation by an authorized editor,
then automatically generate a description from the accepted selections. This
approach would reduce the need to manually compose long descriptions while
distinguishing typical role suggestions from actual employer requirements.
Description generation would use deterministic templates and would not itself
constitute evidence that NLP improves matching.

For student profiles, the proposed refinement would associate assessment items
with the specific skills they assess and summarize eligible graded outcomes.
The resulting evidence would retain correct counts, assessed counts and source
provenance. Skill annotations would require review, and generated profiles would
not include expected placement labels or insert an inferred target role merely
to strengthen textual overlap. Outcomes on assessed items would not be described
as proof of mastery of all technologies associated with a category.

Numerical assessment evidence would remain explicit. A statement such as four
correct responses from five items is informative to a reviewer, but TF-IDF does
not necessarily interpret that statement as a quantitative competence level.
Accordingly, text matching would be evaluated alongside structured matching using
the same detailed skill evidence. This comparison would distinguish improvement
from richer inputs from improvement attributable specifically to NLP.

Skill-based job matching is methodologically related to Kara et al. (2023), who
compare skill representations and similarity methods and include a TF-IDF/cosine
baseline. Their study supports investigating textual representations but does
not establish that the proposed SkillBridge refinement will improve placements.

## 3. Replace or clarify the evaluation-method section

Recommendation evaluation should distinguish first-choice classification,
shortlist retrieval, per-role errors and computational cost. Following the
task-aligned evaluation principle discussed by Gunawardana and Shani (2009),
Top-1 accuracy measures agreement between the first-ranked position and the
expected first choice. Hit Rate@3 measures whether that expected position occurs
among the first three suggestions. Macro precision, macro recall and macro F1
describe the first-ranked predictions while giving evaluated classes equal
weight. A confusion matrix and per-role support identify errors hidden by
aggregate averages. The classification-metric selection is also consistent
with related person-job evaluation by Qin et al. (2018), although that study's
binary application-outcome task differs from SkillBridge's position ranking.

Hit Rate@3 does not indicate that all three suggestions are suitable. Where
independent evaluators identify all suitable candidate positions, Precision@3,
Recall@3 and NDCG@3 can additionally assess shortlist relevance. Such judgments
must be distinguished from a single synthetic expected-role label and from an
approved placement that may have been influenced by the recommender.

Computational evaluation should state hardware, software/model versions,
workload, warm-up, repeated measurements and timer boundaries. Preprocessing,
feature construction and scoring should be distinguished from complete
application response time. Qi et al. (2020) provide relevant context for NLP
pipeline quality and efficiency, but their linguistic benchmarks do not establish
OJT recommendation accuracy or an equivalent runtime on different hardware.

## 4. Add as completed offline prototype work, not deployed system results

An isolated prototype compared four input configurations: current generated
text, task-based position descriptions only, item-level student evidence only,
and both proposed inputs together. Each configuration used the same candidate
catalog, category vectors, location rule, TF-IDF scope and hybrid weights.
Regex preprocessing and spaCy small were compared. Controls included
category/location matching without NLP and structured skill coverage using the
same added item evidence and task selections.

The prototype used 60 familiar synthetic development cases. Artificial item
outcomes were allocated within existing category totals without consulting
expected roles; they were not observed student responses. Position tasks were
illustrative role templates rather than confirmed employer duties. Coordinates
were absent, so location scores were neutral. Consequently, the experiment
evaluated behavior under the simulation assumptions rather than effectiveness
on actual OJT placements.

| Configuration | Hybrid/structured Top-1 |
| --- | ---: |
| Category/location without NLP | 90.00% |
| Same-evidence structured skill coverage | 70.00% |
| Current text with regex / spaCy small | 81.67% / 80.00% |
| Position duties only with regex / spaCy small | 91.67% / 86.67% |
| Item evidence only with regex / spaCy small | 91.67% / 91.67% |
| Both inputs with regex / spaCy small | 88.33% / 88.33% |

The highest observed score corresponds to 55 correct first choices out of 60,
compared with 54 out of 60 for category/location matching without NLP. This
one-case difference does not establish a reliable advantage or a preferred
production configuration. Combining both inputs did not yield the best result
in this experiment. These findings support further investigation of evidence
representation without demonstrating that NLP improves actual placement quality.

## 5. Add as an optional research direction only

If lexical mismatch limits the TF-IDF reference pipeline, semantic sentence
embeddings could be evaluated as a separate challenger. Reimers and Gurevych
(2019) describe sentence representations that can be compared through cosine
similarity. Such a method would need evaluation on the same task-specific inputs,
with model version, text truncation and score transformation reported explicitly.
The existing prototype does not implement or evaluate this embedding approach,
and its suitability for SkillBridge remains unestablished.

## 6. Closing limitation statement

The current findings distinguish implementation feasibility from independent
validation. Synthetic expected-role agreement and descriptive similarity scores
do not establish real-world placement effectiveness. Nor do scores from other
datasets define a universal acceptable percentage. Acceptance criteria should
reflect the intended use and be established before a final independent test.

## References

Gunawardana, A., & Shani, G. (2009). A survey of accuracy evaluation metrics of
recommendation tasks. *Journal of Machine Learning Research, 10*, 2935-2962.
[Publication](https://jmlr.org/papers/v10/gunawardana09a.html).

Kara, A., Daniş, F. S., Orman, G. K., Turhan, S. N., & Özlü, Ö. A. (2023).
Job recommendation based on extracted skill embeddings. In K. Arai (Ed.),
*Intelligent Systems and Applications* (Vol. 544, pp. 497-507). Springer.
[DOI](https://doi.org/10.1007/978-3-031-16075-2_35). First online in 2022;
use the volume's bibliographic year consistently in the final references.

Qin, C., Zhu, H., Xu, T., Zhu, C., Jiang, L., Chen, E., & Xiong, H. (2018).
Enhancing person-job fit for talent recruitment: An ability-aware neural network
approach. *Proceedings of SIGIR '18*, 25-34.
[DOI](https://doi.org/10.1145/3209978.3210025).

Qi, P., Zhang, Y., Zhang, Y., Bolton, J., & Manning, C. D. (2020). Stanza:
A Python natural language processing toolkit for many human languages.
*Proceedings of ACL: System Demonstrations*, 101-108.
[DOI](https://doi.org/10.18653/v1/2020.acl-demos.14).

Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence embeddings using
siamese BERT-networks. *Proceedings of EMNLP-IJCNLP*, 3982-3992.
[DOI](https://doi.org/10.18653/v1/D19-1410).

## Editing notes (not manuscript prose)

- Keep older 300-case experiments separate from this 60-case prototype. Do not
  overwrite one table with the other's results or imply a common held-out test.
- The old notebook's target-role text, corpus scope and timings differ from the
  application. Reconcile those descriptions and identify the actual saved run.
- Replace claims that the fastest model is universally best with run-specific
  findings. Old manuscript and notebook timings disagree; this draft does not
  resolve that discrepancy by selecting the most favorable table.
- Keep macro metrics distinct from Precision@k. Report expected-label support
  and candidate counts with the corresponding experiment.
- Do not write the proposed duties/annotations as deployed features. No database
  schema or application scoring implementation was changed for this prototype.
- A template generator, preprocessor and semantic encoder are different components;
  do not use their names interchangeably or claim a semantic model was tested here.
- Sources support the stated methodological connections, not SkillBridge's
  performance, the chosen hybrid weights, or a universal acceptance threshold.
