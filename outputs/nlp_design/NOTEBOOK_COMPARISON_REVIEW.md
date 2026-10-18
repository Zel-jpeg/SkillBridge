# Notebook comparison review

Reviewed October 18, 2026. No model comparisons were rerun. This reviews the existing saved simulation report and the prototype code.

## What is compared

| Question | Comparison already present | Status |
| --- | --- | --- |
| Do task descriptions help? | Duties-only versus current text, same preprocessor | Present |
| Does detailed student evidence help? | Evidence-only versus current text, same preprocessor | Present |
| Do both inputs help together? | Both versus current, duties-only and evidence-only | Present |
| Is there value beyond aggregate scores? | Every text variant versus structured-only | Present |
| Is it the extra evidence rather than NLP? | Proposed variants versus same-evidence structured coverage | Present; one simple control is not all structured methods |
| Does trained preprocessing help? | spaCy small versus regex, same input variant | Present |
| Does a semantic encoder improve matching? | Sentence Transformer versus the TF-IDF reference on identical inputs | Not implemented/measured; optional next experiment |
| Does the proposed evidence aggregation match production? | Full batch/retake adapter versus production eligible evidence | Not implemented; prototype assumes one complete equal-weight evidence set |
| Are placements more suitable in practice? | Independently judged real cases | Not established |

## Recorded results

| Variant | Correct first choices | Top-1 | Gain over no NLP (percentage points) |
| --- | ---: | ---: | ---: |
| structured_only | 54/60 | 90.00% | +0.00 |
| structured_skill_coverage | 42/60 | 70.00% | -20.00 |
| current_text__tfidf_regex | 49/60 | 81.67% | -8.33 |
| current_text__spacy_sm | 48/60 | 80.00% | -10.00 |
| duties_only__tfidf_regex | 55/60 | 91.67% | +1.67 |
| duties_only__spacy_sm | 52/60 | 86.67% | -3.33 |
| evidence_only__tfidf_regex | 55/60 | 91.67% | +1.67 |
| evidence_only__spacy_sm | 55/60 | 91.67% | +1.67 |
| duties_and_evidence__tfidf_regex | 53/60 | 88.33% | -1.67 |
| duties_and_evidence__spacy_sm | 53/60 | 88.33% | -1.67 |

All eight text variants and both structured controls use the same ordered cases and expected labels; this was checked from case-level predictions. The controls and text variants share the candidate catalog. The code holds category/location values and 60/25/15 weights fixed. Missing coordinates make location neutral.

## Decision from the review

Keep the input comparisons and same-evidence control. Do not select the combined proposal merely because it has more features. Item-evidence-only scored 55/60 with spaCy small, versus 54/60 for aggregate category/location matching and 48/60 for current text. Both proposed inputs together scored 53/60. These differences describe this simulation; they do not establish a reliable model ranking.

The saved generated student text includes item counts, but TF-IDF is not a quantitative skill estimator. Preserve counts and denominators as structured data when designing a future implementation. The non-NLP control is useful, but its average coverage formula is only one structured alternative; beating it does not prove superiority over all structured approaches.

## Scope and timing limits

- Simulated item outcomes are not recovered answers from actual students. No expected label is used to allocate outcomes.
- Role-duty templates are suggestions rather than confirmed employer facts.
- The same familiar archetypes supply labels and category structure; the study is development-only.
- The current helper snapshots are frozen artifacts, not a guarantee that later application edits are represented.
- Partial batch timing excludes profile/evidence generation and application work. Coverage timing has a different scope. Do not claim matched end-to-end speed comparisons.
- Default candidate selection is a user-editable demonstration setting, not a programmatically established winner. The simulation final test remains not_run.

## Reproducibility

See [source report](../colab_proposal/verified_local_run/study_report.json), [machine-readable comparison audit](comparison_audit.json), [local verification](../colab_proposal/LOCAL_VERIFICATION.md), and the [notebook](../colab_proposal/SkillBridge_Proposed_Features_Comparison.ipynb). The audit includes paired bootstrap differences for diagnosis, with simulation limitations.

No new accuracy result was produced by this review. No database was accessed.
