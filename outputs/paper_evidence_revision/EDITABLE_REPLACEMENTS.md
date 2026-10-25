# Editable replacement sections

Replacements applied to the supplied rev3 PDF. Physical PDF pages are listed first; printed page numbers are one less. Objectives, requirements and unrelated pages were preserved. Existing experiment values were retained with timing/selection qualifications. This is a research-evidence revision, not a completed model or weight sensitivity study.

## PDF page 55 printed page 54

in the study: spaCy en_core_web_sm, spaCy en_core_web_md, and Stanford Stanza English. These pretrained configurations process generated competency profiles and position descriptions before TF-IDF vectorization and cosine similarity. They are preprocessing configurations, not three different recommendation algorithms. No additional model training was performed.

Tokenization separates text into tokens; lemmatization reduces inflected forms; and stopword filtering removes selected common terms. Qi et al. [32, Sec. 4, Tables 2 and 4] provide a research basis for considering preprocessing quality and speed together. Their linguistic tasks and toolkit versions differ from SkillBridge, so their results cannot directly select the best configuration for this system. Official pipeline capabilities are documented separately in [18].

Selection must follow the identified SkillBridge comparison run. The reported downstream accuracy is equal across configurations, while manuscript and saved-notebook timing values differ. The fastest-model conclusion therefore remains provisional until the run conditions and repeated timing measurements are reconciled.

### TF-IDF for Skill Category Suggestion and Text Vectorization

Term Frequency-Inverse Document Frequency represents term importance relative to a document collection. Salton and Buckley discuss term weighting for text retrieval [17]. SkillBridge uses TF-IDF for skill-category suggestion and text matching. Kara et al. [31, Abstract and Sec. 4] also use a TF-IDF/cosine baseline in job recommendation; this supports its relevance without establishing that it is universally best.

## PDF page 70 printed page 69

### SYSTEM TESTING AND IMPLEMENTATION

Testing examines whether SkillBridge integrates authentication, profile management, assessment creation and submission, automated scoring, competency profiling, text preprocessing, recommendation generation, location matching, dashboards, and reports. Application functionality and usability are evaluated separately from recommendation quality. Deployment preparation includes configuration, database setup, account provisioning, and user orientation.

### Results of Testing NLP Models and Evaluation Metrics

The notebook experiments compared spaCy en_core_web_sm, spaCy en_core_web_md, and Stanford Stanza English as pretrained preprocessing configurations. The resulting text was represented through TF-IDF and ranked by cosine similarity. This follows the approved comparison scope; it does not evaluate three separately trained placement classifiers.

Qi et al. [32, Sec. 4] compare linguistic annotation quality and runtime across NLP toolkits. This supports considering efficiency alongside quality, while differences in task, version, and hardware limit numerical transfer. Kara et al. [31, Abstract and Secs. 2.1 and 4] provide a related skill-based matching framework and a TF-IDF/cosine baseline. Neither study establishes SkillBridge accuracy or a preferred preprocessing configuration.

## PDF page 71 printed page 70

### Evaluation Design and Metric Definitions

The notebook evaluation uses 300 synthetic student profiles, six candidate positions, and one expected role assigned through each synthetic archetype. Its labels represent the simulation design, not independent judgments or observed placement outcomes. Role-related terms inferred from assessment scores also enter notebook student text, and the evaluated cohort participates in TF-IDF corpus construction. No independent final cohort reserved from design selection is documented.

Top-1 accuracy measures whether the first-ranked position matches the expected role. Hit Rate@3, called Top-3 accuracy in the original notebooks, measures whether that role appears among three suggestions. Precision, recall, and F1 are macro averages of first-ranked role predictions; they are not Precision@3, Recall@3, or proof that every suggested role is suitable. The confusion matrix identifies recurring errors.

Gunawardana and Shani [33, Secs. 4.2, 5.2 and 5.4] relate experimental design and evaluation measures to the recommendation task. Their shortlist discussion supports evaluating the displayed candidates; it does not prescribe SkillBridge macro averaging or a passing percentage. Complete suitability judgments would be needed to assess Precision@3 beyond the current single expected-role labels.

## PDF page 72 printed page 71

### Table 4 Comparative Analysis of NLP Configurations

| NLP configuration | Top-1 | Hit Rate@3 | Macro precision | Macro recall | Macro F1 | Reported batch s |
| --- | --- | --- | --- | --- | --- | --- |
| spaCy small | 93.00% | 99.67% | 0.9316 | 0.9302 | 0.9304 | 5.923 |
| spaCy medium | 93.00% | 99.67% | 0.9316 | 0.9302 | 0.9304 | 6.115 |
| Stanza English | 93.00% | 99.67% | 0.9316 | 0.9302 | 0.9304 | 154.567 |

Times are retained from the supplied manuscript and describe reported batch computation, not measured website latency. Macro metrics are fractions. The dataset has 300 synthetic cases and six candidates.

All configurations produced the same recorded Top-1 accuracy and Hit Rate@3 in this experiment. This is agreement with synthetic expected-role labels, rather than evidence of actual placement suitability or statistical equivalence across all possible data.

Qi et al. [32, Sec. 4, Speed comparison and Table 4] support examining runtime trade-offs. Their study does not choose between current spaCy small and medium for SkillBridge. The manuscript timings above differ from the attached rich-text notebook outputs; consequently, a final model-selection claim requires an identified run, stated hardware and versions, and repeated measurements.

### Outcome of Evaluating the Final Recommendation Model

The hybrid experiment adds category-score and location similarity to text matching. Category vectors summarize assessed percentages, text similarity compares generated profiles and descriptions, and location similarity represents geographic proximity. These components address different matching considerations.

## PDF page 73 printed page 72

### Weighted Hybrid Recommendation Rationale

Burke [29, Sec. 3.1] describes weighted hybrids that numerically combine component recommendation scores. This supports the score-combination architecture. It does not prescribe SkillBridge components or coefficients. Reference [30] remains a broader hybrid-recommender review.

Final score = 0.60 C + 0.25 T + 0.15 L

C is category-score similarity; T is NLP-assisted text similarity; L is location similarity. The component scores are expressed on a 0-to-1 scale before percentage display.

The implemented coefficients express the project design priority: assessed competency receives the largest coefficient, text alignment supplements that evidence, and proximity supplies a practical geographic consideration. This is the stated design rationale, not a weight set derived from Burke or an experimentally established optimum.

Stronger coefficient justification requires a sensitivity comparison on identical inputs, candidate positions, and labels, varying both text and location weights and including component-removal controls. Such validation is not claimed by this revision. Common numeric ranges do not ensure equal score distributions or equal effects on ranking.

The hybrid is evaluated using Top-1 accuracy, Hit Rate@3, macro precision, macro recall, macro F1, and computation time. Gunawardana and Shani [33] support task-appropriate comparison design; they do not validate these exact weights. Similarity scores are not calibrated probabilities of placement success.

## PDF page 74 printed page 73

### Table 5 Final Hybrid Recommendation Testing Findings

| NLP configuration | Top-1 | Hit Rate@3 | Macro precision | Macro recall | Macro F1 | Reported batch s |
| --- | --- | --- | --- | --- | --- | --- |
| spaCy small | 89.33% | 100.00% | 0.8970 | 0.8929 | 0.8936 | 6.092 |
| spaCy medium | 89.33% | 100.00% | 0.8970 | 0.8929 | 0.8936 | 6.114 |
| Stanza English | 89.33% | 100.00% | 0.8970 | 0.8929 | 0.8936 | 159.761 |

Original manuscript values are retained. Timing reconciliation is pending; these numbers must not be mixed with timings from another run. Macro metrics use first-ranked predictions.

The hybrid achieved 89.33% Top-1 accuracy and 100% Hit Rate@3 against synthetic expected roles, with macro F1 of 0.8936. The expected role was therefore in the shortlist for every case; this does not show that all three recommendations were suitable. The NLP-only experiment recorded 93% Top-1 accuracy, so these experiments do not establish that hybridization improved first-choice accuracy.

The saved final-hybrid notebook records different batch times and a different fastest spaCy configuration from this manuscript table. Neither table alone establishes a consistently fastest model. Repeated runs, timer boundaries, actual model identifiers, hardware, and software versions must be reconciled before final selection. This is a project evidence gap, not something an external citation can resolve.

Notebook computation excludes model loading and application/database/network operations; its scoring timer also includes feature construction. Partial batch computation must be distinguished from per-instance model inference and end-to-end application response time.

## PDF page 75 printed page 74

These preliminary findings support further evaluation of the matching approach. They do not establish superior real-world placement outcomes, optimal hybrid coefficients, or a universally best preprocessor. Runtime model configuration and the final research selection should be reconciled explicitly; a configured default is not selection evidence.

### System Test Plan

In order to provide for the validation process of the SkillBridge software, a well-detailed System Test Plan is going to be prepared. This plan outlines the testing objectives, the scope of testing, the testing environment, the test cases, and the acceptance criteria ensuring that testing is carried out systematically based on the system requirements. The major objective of this phase is to validate that the integrated OJT placement decision-support platform works properly and effectively in real-world usage conditions.

The scope of testing involves validation of: user authentication for students, login for instructors and administrators, role-based access control, student profile management, assessment creation, bulk question upload, submission of student assessments, automatic scoring, skill categories computation, rich competency profiles creation, detailed company-position descriptions creation, NLP preprocessing, recommendations generation, location matching, dashboard rendering, and report generation.

## PDF page 89 printed page 88

### REFERENCES CONTINUED

[31] A. Kara, F. S. Danis, G. K. Orman, S. N. Turhan, and O. A. Ozlu, "Job recommendation based on extracted skill embeddings," in Intelligent Systems and Applications, K. Arai, Ed., Lecture Notes in Networks and Systems, vol. 544. Springer, 2023, pp. 497-507. doi: 10.1007/978-3-031-16075-2_35. First online: Sep. 1, 2022.

https://doi.org/10.1007/978-3-031-16075-2_35

[32] P. Qi, Y. Zhang, Y. Zhang, J. Bolton, and C. D. Manning, "Stanza: A Python natural language processing toolkit for many human languages," in Proc. ACL System Demonstrations, 2020, pp. 101-108. doi: 10.18653/v1/2020.acl-demos.14.

https://aclanthology.org/2020.acl-demos.14/

[33] A. Gunawardana and G. Shani, "A survey of accuracy evaluation metrics of recommendation tasks," Journal of Machine Learning Research, vol. 10, pp. 2935-2962, 2009.

https://jmlr.org/papers/v10/gunawardana09a.html

Reference numbers [1]-[30] are preserved from the supplied manuscript. Burke remains [29]. The added sources support methodological choices within their stated scope; none prescribes the exact 60/25/15 coefficients or certifies a SkillBridge model-selection result.
