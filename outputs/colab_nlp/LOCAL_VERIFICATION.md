# Local verification - October 18, 2026

All eight notebook code cells executed locally with the backend Python environment
and isolated display dependencies. No Colab-hosted execution was performed.
Charts, CSV exports, source verification, selection locking and study ZIP creation
completed. The synthetic final-test cell correctly returned `not_run`.
Eight offline unit tests passed, including numerical component parity, label
permutation invariance, group leakage rejection, rounded ties, multi-relevant
metrics, unavailable model behavior, selection locks and final receipt reuse.

Observed on the 60 familiar synthetic development cases:

| Method | Hybrid/structured Top-1 | Text-only Top-1 | Hybrid Hit Rate@3 |
| --- | ---: | ---: | ---: |
| Assessment + location, NLP removed | 90.00% | not applicable | 100% |
| Regex + TF-IDF hybrid | 81.67% | 68.33% | 100% |
| spaCy small + TF-IDF hybrid | 80.00% | 65.00% | 100% |
| spaCy medium + TF-IDF hybrid | 80.00% | 65.00% | 100% |

For spaCy small hybrid versus structured-only, the paired Top-1 difference was
-10 percentage points; the seeded group-bootstrap 95% interval was approximately
[-20.00, -1.67] percentage points. These synthetic cases share a small archetype
design: this interval must not be interpreted as a real-student population estimate.
Location coordinates are absent; all location values are the neutral 0.5.

This run does not demonstrate improved first-place accuracy from NLP. It does
demonstrate why an ablation is necessary: text-only accuracy, hybrid accuracy,
and contribution over no NLP answer different questions.

An additional optional Stanza availability check failed because English resources
were absent. No fallback metrics were assigned and no Stanza result is fabricated.
The default notebook execution compares the two installed spaCy models, regex
TF-IDF, and the structured baseline. Stanza setup remains optional in Colab.

The engine reuses source helper functions. Numerical checks compare component
scores against the production formula and TF-IDF scope without initializing Django.
They do not exercise the database, current combined competency aggregation,
runtime deployment, authorization, or browser UI. Application tests/builds were
not required for these isolated research artifacts; application code was unchanged.

`verified_local_run/report.json`, CSVs, and the chart contain the latest verified
default notebook results. Package versions, actual input hash and candidate order
are in that report; source hashes are in `source_manifest.json`.
