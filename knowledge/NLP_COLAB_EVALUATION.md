# Colab evaluation of NLP contribution

The [standalone notebook](../outputs/colab_nlp/SkillBridge_NLP_Contribution_Evaluation.ipynb)
and [usage guide](../outputs/colab_nlp/README.md) provide a new offline study of
current SkillBridge preprocessing and ranking. They do not change application
behavior or certify the older manuscript's 300-case results.

The notebook embeds snapshots of `recommendation_nlp.py`, `skill_taxonomy.py`,
and a development dataset derived from `api/data/nlp_evaluation.json`, with the
current prepared-mode curated tags applied in memory. It uses per-student
TF-IDF scope from live ranking rather than prepared evaluation's corpus-wide
scope. All 60 familiar synthetic cases remain development cases. Missing
coordinates yield neutral location scores and cannot validate location effects.

Comparisons include structured category/location without NLP, regex + TF-IDF,
spaCy small/medium, optional Stanza, NLP-only and hybrid metrics. Trained
preprocessing contribution and text-matching contribution are distinct claims.
The study exports helped/hurt cases, per-role diagnostics, component vectors,
model/runtime versions, repeated partial warm batch timings and source hashes.

Independent test data and pre-agreed criteria must be supplied before an
acceptance claim. Group separation, label-independent input generation, frozen
selection, paired bootstrap gains and a single saved final receipt support that
workflow; they do not verify researcher declarations or prevent resetting Colab.
The notebook never connects to the database or recalculates saved recommendations.

Do not restore inferred target titles merely to increase accuracy. Generated
category text may add no new evidence beyond structured scores. Further NLP
experiments should consider independently collected task/project evidence,
question-level validated skill evidence, and position requirements, followed by
new independent evaluation. Existing score history and placement gates remain
outside this benchmark.
