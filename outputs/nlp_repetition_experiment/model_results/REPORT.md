# Three-model offline comparison

Same 60 synthetic cases, six positions, curated tags, labels and production text generators as the previous run. TF-IDF is fitted per student. Hybrid weights stay 60/25/15; location is neutral 50%. No system changes.

Structured control Top-1: **90.0%**.

| Model | Input | Matcher | NLP Top-1 | NLP Top-3 | Hybrid Top-1 | Hybrid Top-3 |
|---|---|---|---:|---:|---:|---:|
| spacy_sm | current | tfidf | 65.0% | 100.0% | 80.0% | 100.0% |
| spacy_sm | current | contextual feature average (exploratory) | 63.3% | 95.0% | 88.3% | 100.0% |
| spacy_sm | readable_position | tfidf | 63.3% | 98.3% | 91.7% | 100.0% |
| spacy_sm | readable_position | contextual feature average (exploratory) | 26.7% | 80.0% | 91.7% | 100.0% |
| spacy_sm | readable_both | tfidf | 63.3% | 96.7% | 85.0% | 100.0% |
| spacy_sm | readable_both | contextual feature average (exploratory) | 31.7% | 58.3% | 93.3% | 100.0% |
| spacy_md | current | tfidf | 65.0% | 100.0% | 80.0% | 100.0% |
| spacy_md | current | static word-vector average | 81.7% | 100.0% | 88.3% | 100.0% |
| spacy_md | readable_position | tfidf | 63.3% | 98.3% | 90.0% | 100.0% |
| spacy_md | readable_position | static word-vector average | 38.3% | 76.7% | 90.0% | 100.0% |
| spacy_md | readable_both | tfidf | 61.7% | 96.7% | 86.7% | 100.0% |
| spacy_md | readable_both | static word-vector average | 33.3% | 80.0% | 90.0% | 100.0% |
| stanza_en | current | tfidf | 68.3% | 100.0% | 81.7% | 100.0% |
| stanza_en | readable_position | tfidf | 66.7% | 98.3% | 91.7% | 100.0% |
| stanza_en | readable_both | tfidf | 70.0% | 96.7% | 88.3% | 100.0% |
| stanza_en | all | native vectors unsupported by configured pipeline | — | — | — | — |

## Interpretation

Current = exact original repeated text. Readable position = remove only position evidence tail. Readable both = remove both evidence tails, retaining the original narrative, categories, percentages and vocabulary.

spaCy Small has no static word-vector table. Its exploratory Doc.vector averages contextual tok2vec features; these features are not trained as sentence similarity embeddings. It must not be described as equivalent to Medium word vectors. Medium averages static word vectors. Stanza tokenize/lemma supplies linguistic annotations, not an equivalent document vector; native matching is unsupported with the existing pipeline.

Native matching processes the exact raw descriptions, with no artificial extra preprocessing; default document averaging includes narrative boilerplate. Inspect similarity dispersion and coverage in results.json. Native cosine can be negative: NLP-only preserves signed cosine; hybrid clips negatives to zero to retain the existing nonnegative component scale. No parameters were tuned after inspecting outcomes.

A higher hybrid result can come from the category component dominating weakly discriminating text scores. It does not automatically establish added value over the 90% structured control. These familiar synthetic labels cannot establish real placement accuracy or a universal best model. Models with missing resources are unavailable, not zero-accuracy results. Elapsed timings are not controlled performance benchmarks.

Detailed per-role metrics, predictions, input hashes, coverage, similarity dispersion and integrity checks are in results.json. Every candidate score/rank is in rankings.csv.

Sources: [spaCy document vectors](https://spacy.io/api/doc#vector), [spaCy Small limitations](https://spacy.io/usage/linguistic-features#vectors-similarity), [Stanza pipeline](https://stanfordnlp.github.io/stanza/pipeline.html).
