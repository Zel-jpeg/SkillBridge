# Research support and manuscript changes

This guide accompanies `SkillBridge_Research_Supported_Revision.pdf` and `EDITABLE_REPLACEMENTS.md`. PDF page numbers below count from the first physical page; the manuscript's printed page numbers are one lower. The original supplied PDF was preserved.

## Exactly where the research supports SkillBridge

| Paper and manuscript citation | Exact supporting location | Application to SkillBridge | Limit |
| --- | --- | --- | --- |
| Burke (2002), *Hybrid Recommender Systems: Survey and Experiments*, [29] | Section 3.1, **Weighted**, internal manuscript p. 6; [author manuscript PDF, viewer p. 7](https://pzs.dstu.dp.ua/DataMining/recom/bibl/Hybrid_Recommender_Systems_Survey_and_Experiments.pdf#page=7). [Publisher/DOI](https://doi.org/10.1023/A:1021240730564). | Supports combining component recommendation scores through a weighted sum. | Does not prescribe SkillBridge's components or the 60/25/15 coefficients. |
| Kara et al. (2023; first online 2022), *Job Recommendation Based on Extracted Skill Embeddings*, [31] | **Abstract**, Section 2.1 **Job Recommendation Framework**, and Section 4 **Experiments and Results**, including **Table 2** (internal manuscript p. 9). [Author-uploaded full text](https://www.researchgate.net/publication/363190802_Job_Recommendation_Based_on_Extracted_Skill_Embeddings); [publisher/DOI](https://doi.org/10.1007/978-3-031-16075-2_35). | Supports skills-based job matching and a TF-IDF/cosine baseline. | Their CV/job data differ from generated OJT profiles. Section 3.2 concerns IDF-weighted embeddings; it must not be described as the TF-IDF baseline. |
| Qi et al. (2020), *Stanza: A Python Natural Language Processing Toolkit for Many Human Languages*, [32] | Section 2.1 **Design and Architecture**; Section 4 **Performance Evaluation**; **Table 2**, printed p. 105/viewer p. 5; **Speed comparison** and **Table 4**, printed p. 106/viewer p. 6. [ACL paper](https://aclanthology.org/2020.acl-demos.14.pdf#page=5); [DOI](https://doi.org/10.18653/v1/2020.acl-demos.14). | Supports evaluating preprocessing quality and runtime when comparing NLP toolkits. | The paper does not establish the best spaCy size or OJT recommendation configuration for SkillBridge. |
| Gunawardana and Shani (2009), *A Survey of Accuracy Evaluation Metrics of Recommendation Tasks*, [33] | Section 4.2 **Offline Experimental Setup**, printed p. 2941/viewer p. 7; Section 5.2 **Recommending Good Items**, printed pp. 2944–2946/viewer pp. 10–12; Section 5.4 **Fixed Recommendations Lists**, printed pp. 2947–2948/viewer pp. 13–14. [JMLR paper](https://jmlr.org/papers/volume10/gunawardana09a/gunawardana09a.pdf#page=10). | Supports selecting evaluation measures for the recommendation task and the displayed shortlist. | Does not prescribe a universal passing percentage or establish validity of SkillBridge's synthetic labels. |

These are methodological precedents, not studies validating the finished SkillBridge system. The manuscript also retains its existing Salton–Buckley term-weighting citation [17] and spaCy documentation [18]; no new validation result is attributed to them.

## Specific manuscript passages revised

| Physical PDF page | Printed page | Revision |
| --- | --- | --- |
| 55 | 54 | Clarifies preprocessing versus recommendation algorithms; adds support for toolkit comparison and TF-IDF/cosine; makes final model selection provisional. |
| 70 | 69 | Clarifies the experiment's purpose and separates application testing from recommendation evaluation. |
| 71 | 70 | Defines the reported evaluation measures and their interpretation. |
| 72 | 71 | Retains the NLP comparison values and qualifies the model-selection conclusion. |
| 73 | 72 | Explains the weighted hybrid formula and identifies 60/25/15 as project-selected coefficients. |
| 74 | 73 | Retains the hybrid results and corrects the interpretation of the comparison. |
| 75 | 74 | Explains remaining evidence limits and preserves the system test-plan continuation. |
| 89 (added) | 88 | Adds references [31]–[33]; Burke remains existing reference [29]. |

Objectives and functional/nonfunctional requirements were not changed. Existing reference numbering [1]–[30] was preserved. The other 81 original pages were checked for identical extracted text. All eight edited/added pages were rendered and visually inspected for clipping, overlap and readability.

## Claims the revision deliberately leaves unresolved

- **Exact weights:** Report 0.60 category similarity + 0.25 NLP similarity + 0.15 location similarity as the project's design setting. Research support for weighted fusion does not make these exact values empirically optimal. Compare alternative weights using the same evaluation cases before claiming superiority.
- **Chosen configuration:** The manuscript and saved notebooks contain different timing values. Reconcile run provenance and repeat measurements under the same conditions before naming the fastest configuration. Installation or a system default does not establish research superiority.
- **Hybrid improvement:** The reported NLP-only accuracy is 93%, while the reported hybrid accuracy is 89.33%. Those figures do not support claiming that the hybrid improved that particular accuracy measure.
- **Generalization:** Synthetic or notebook results establish behavior on those cases. They do not establish real-student placement effectiveness. No new data collection, experiment or system change was performed for this revision.

Use the revised PDF as a focused manuscript revision and the editable Markdown when transferring the passages into your editable master document. Review neighboring unchanged chapters for any repeated claims before submitting a final consolidated manuscript.
