# Research support aligned with the approved outline

Reviewed October 21, 2026. This is a research/wording note, not a change to the
signed form, application, model configuration or weights.

## What the acceptance form actually specifies

The six scanned pages of the supplied Outline_Acceptance_Form.pdf were visually
reviewed. Relevant commitments are:

- Objective 3: compare spaCy en_core_web_sm, spaCy en_core_web_md and Stanford
  Stanza English for suitability and computational efficiency in profile/description processing.
- Objective 4 and FR11: combine category-score, NLP-assisted text and location similarity.
- FR9: generate profile and position text using scores, requirements and tags.
- FR10: selected-model preprocessing followed by TF-IDF and text similarity.
- Scope: internal structured assessment data; no external job/HR integration or
  advanced generative AI; final placement remains a human decision.

The form does not prescribe the exact 60/25/15 coefficients and does not certify
that a particular one of the three models is best. Preserve the three-model
comparison and TF-IDF commitments in the paper. Treat replacing TF-IDF with
semantic embeddings as a separate scope discussion with the adviser/panel rather
than silently replacing the accepted method.

## Primary sources and the claims they support

### 1. NLP-assisted skill/job matching

Kara, A., Daniş, F. S., Orman, G. K., Turhan, S. N., & Özlü, Ö. A. (2023;
first online 2022). Job recommendation based on extracted skill embeddings.
In K. Arai (Ed.), *Intelligent Systems and Applications*, LNNS 544, 497-507.
[DOI](https://doi.org/10.1007/978-3-031-16075-2_35).

The publisher's abstract confirms skill-phrase matching from CVs/job descriptions
and a TF-IDF/cosine baseline, compared with embedding methods. This is a close
methodological reference for the text-matching component. It does not establish
that TF-IDF is best, that spaCy small/medium is best, or that 25% is the correct
text component weight in SkillBridge.

### 2. Preprocessing quality/efficiency comparison

Qi, P., Zhang, Y., Zhang, Y., Bolton, J., & Manning, C. D. (2020). Stanza:
A Python natural language processing toolkit for many human languages.
*Proceedings of ACL: System Demonstrations*, 101-108.
[DOI](https://doi.org/10.18653/v1/2020.acl-demos.14).
[Open full paper](https://aclanthology.org/2020.acl-demos.14.pdf).

This paper evaluates linguistic annotation quality and speed, including comparisons
with spaCy. It supports comparing preprocessing quality and computation cost.
The versions, enabled processors and tasks differ from current SkillBridge.
It does not validate SkillBridge matching accuracy or decide between current
en_core_web_sm and en_core_web_md. Their selection requires the team's own
comparable, identified runs, including missing-model handling and repeat timings.

Use [official English pipeline documentation](https://spacy.io/models/en) for
model identity and capabilities, distinguishing documentation from research.
Medium includes vectors, but SkillBridge's TF-IDF path does not use those vectors
merely because the medium pipeline is loaded.

### 3. Weighted hybrid architecture

Burke, R. (2002). Hybrid recommender systems: Survey and experiments.
*User Modeling and User-Adapted Interaction, 12*, 331-370.
[DOI](https://doi.org/10.1023/A:1021240730564).
[Author-uploaded manuscript mirror](https://pzs.dstu.dp.ua/DataMining/recom/bibl/Hybrid_Recommender_Systems_Survey_and_Experiments.pdf).

Burke's weighted hybrid category combines component scores into a single result.
This supports the architectural choice of numerical score combination. The
paper's systems and experiments do not prescribe SkillBridge's assessment/text/
location components or the exact 0.60/0.25/0.15 values. Cite it for the method,
not as if SkillBridge copied a validated OJT-specific coefficient set.

### 4. Metric and experimental-design justification

Gunawardana, A., & Shani, G. (2009). A survey of accuracy evaluation metrics of
recommendation tasks. *Journal of Machine Learning Research, 10*, 2935-2962.
[Publication](https://jmlr.org/papers/v10/gunawardana09a.html).

Supports matching evaluation to the recommendation task and designing appropriate
offline comparisons. It does not supply a universal acceptable accuracy or
validate the chosen model/weights from another dataset's percentages.

## Copyable method rationale

SkillBridge uses NLP preprocessing followed by TF-IDF feature extraction and
cosine similarity to compare generated competency profiles with position
descriptions. Skill-based job recommendation research provides methodological
support for this approach: Kara et al. (2023) include TF-IDF with cosine similarity
as a baseline for skill-oriented matching. The comparison of spaCy small, spaCy
medium and Stanza examines their downstream recommendation performance and
computational cost under the same workload. Qi et al. (2020) provide relevant
context for linguistic preprocessing and efficiency evaluation, but the selected
SkillBridge configuration must be justified by its own recorded experiments.

## Copyable weight rationale, if the coefficients were design choices

SkillBridge employs a weighted hybrid score that combines category-score
similarity, NLP-assisted text similarity and location similarity. This numerical
combination is consistent with the weighted hybrid approach described by Burke
(2002). The implemented coefficients are 0.60, 0.25 and 0.15, respectively. They
represent the project's design choice to emphasize assessed competency, retain
textual alignment as a supplementary matching signal, and include geographic
proximity as a practical consideration. These coefficients were not derived
from Burke's experiments and are not claimed to be an optimal weight set.

Use this paragraph only if that priority ordering actually describes the team's
decision. Do not claim expert elicitation, adviser approval, optimization or
sensitivity validation unless it was performed and recorded. Present the
priority ordering as the team's intended rationale, not an external fact that
these exact magnitudes are correct. Equal component ranges do not imply equal
distributions or equal practical influence on rankings.

## What is still needed to strengthen each selection claim

| Claim | Evidence needed from SkillBridge |
| --- | --- |
| A specific preprocessor was selected | Actual dataset/candidate counts, all three configurations or truthful availability limits, downstream metrics, versions, enabled processors and repeated timing under identical conditions |
| 60/25/15 is a reasonable design configuration | Honest priority rationale plus a common-dataset sensitivity comparison with alternatives and component-removal baselines |
| 60/25/15 is best among tested choices | A clearly defined development selection procedure, identical inputs, all tested alternatives reported, and uncertainty/held-out limitations |
| Real-world effectiveness | Suitable independent placement judgments and sufficient task-specific evaluation, not only synthetic archetype agreement |

For weight sensitivity, compare alternatives chosen before looking at the results,
including changes to both text and location weights. Use identical component
scores, candidate sets and labels; report rank changes, Top-1, Hit Rate@3 and
macro F1, with locations that actually vary if testing the location coefficient.
Use development data for selection. Do not tune to obtain a favorable score or
describe a simulation-based optimum as independently established effectiveness.

The earlier 60-case proposal data has neutral locations, so it cannot validate
the value of a 15% geographic component. Model-loading success and a local UI
acceptance check also do not constitute research model-selection evidence.

Current code inspected on October 21 retains 60/25/15 and defaults the configuration
to spaCy medium. A default is not proof of the active database selection or the
actual model used for an individual result. Reconcile that with any manuscript
statement selecting spaCy small before finalizing model-selection wording.

No verified source in this review was found that prescribes the exact 60/25/15
split for SkillBridge's three components. This is a bounded search finding, not
a claim that no such paper can exist. The sound support is methodological citation
plus an honest account of the project's coefficient selection and its limits.
