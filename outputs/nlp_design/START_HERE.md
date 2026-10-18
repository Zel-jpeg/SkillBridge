# SkillBridge NLP design and paper update pack

This pack settles the next design step without changing the live application.
It does not request a new student-data collection exercise now.

To hand this work to an implementation agent, start with
[phased implementation instructions](../../knowledge/NLP_PHASED_IMPLEMENTATION.md).
That document includes a copyable **Phase 1 only** prompt, acceptance checks and
boundaries for each later phase. The present edit changes documentation only.
The handoff now explicitly requires a system audit and baseline before application
edits, an audit record with file references, and regression checks afterward.
The implementation should extend current working features and preserve existing
data, permissions, scoring, placement rules and unrelated workspace changes.

## Read these in order

1. [Recommended design](../../knowledge/NLP_DESIGN_DECISION.md): responsibilities,
   input contracts, automatic descriptions, numeric evidence and matching limits.
2. [Notebook comparison review](NOTEBOOK_COMPARISON_REVIEW.md): what is already
   compared, actual saved results, missing semantic comparison and interpretation.
3. [Copyable paper sections](PAPER_REVISION_DRAFT.md): method clarification,
   proposed refinement, evaluation, completed simulation and supporting references.
4. [Colab notebook](../colab_proposal/SkillBridge_Proposed_Features_Comparison.ipynb):
   upload this self-contained file to Colab and run cells in order to inspect the
   current proposal comparisons. The [guide](../colab_proposal/README.md) explains setup.

The ZIP preserves the `knowledge/` and `outputs/` paths so these relative links
work after extraction. The original earlier notebooks and reports remain intact.

## Recommended design in plain language

- Suggest position tasks; the authorized editor confirms applicable selections.
  Generate the description automatically from those selections.
- Associate assessment items with the skills they actually test. Use eligible
  graded outcomes to describe specific assessed evidence without guessing a role.
- Keep numeric counts separate from text: a language similarity score is not a
  numeric skill assessment or a probability of placement success.
- Use TF-IDF/cosine as the transparent reference, with regex and spaCy comparisons.
- Compare against structured matching using the same evidence. Better inputs
  are not automatically proof of an NLP advantage.
- Test semantic embeddings only as a separate challenger if lexical mismatch
  remains a problem. No embedding accuracy result is claimed in this pack.

## What the current findings allow

The isolated simulation demonstrates feasible automatic generation and a comparison
workflow. It identifies representation choices worth investigating. It does not
identify a universally best implementation. The combined proposal did not beat
all simpler options. Its default synthetic-data mode cannot produce independent
validation, even if its reported percentages are high.

Use the proposed-work paragraphs as proposed work in the paper. Use the completed
simulation paragraphs as prototype results with their dataset limitations.
Do not describe proposed features as already integrated into SkillBridge.

## Verification performed in this step

- Checked current project context and recommendation skill guidance.
- Reopened primary research pages and official semantic-model documentation.
- Reviewed notebook scenarios and controls against the intended research questions.
- Checked all ten saved configurations have identical case/expected-label alignment.
- Recomputed paired diagnostic differences from saved predictions, without rerunning
  models or selecting favorable seeds.
- Checked notebook syntax, embedded source manifest, local links and ZIP integrity.

The existing notebook's nine code cells and ten tests passed in the earlier local
verification. No new model execution or Google Colab-hosted execution occurred
in this documentation/review step. No application tests were needed because no
application code changed. No real student records were accessed.
