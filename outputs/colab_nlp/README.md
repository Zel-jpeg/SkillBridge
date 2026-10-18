# SkillBridge Colab evaluation

Open **SkillBridge_NLP_Contribution_Evaluation.ipynb** in Google Colab using
File -> Upload notebook. The notebook is self-contained: you do not need to
clone the repository, connect a database, upload the old notebooks, or supply
API keys. CPU execution is sufficient.

## First run

1. Run setup. It installs spaCy small and medium by default. Stanza is optional.
2. Run the remaining cells in order. Keep the default dataset for the first run.
3. Read the development comparison and inspect helped/hurt cases and per-role errors.
4. Compare the selected hybrid with **structured_only**, then compare its trained
   preprocessing with **tfidf_regex**. These answer different research questions.
5. The final-test cell reports **not_run** with the bundled data. This is expected.
6. Enable DOWNLOAD_RESULTS to download the study ZIP after examining the outputs.

The included 60 synthetic cases are already familiar development data, not an
independent test. Coordinates were not available in that source, so the location
component is neutral and this demonstration cannot validate geographic matching.
This notebook does not reproduce the older notebook's 300-case results. It uses
current neutral production text and production per-student TF-IDF scope.

## Interpreting the comparisons

- Hybrid improves over structured-only: possible evidence for the contribution
  of text matching under the chosen labels. A development gain still requires
  confirmation on independent data.
- spaCy improves over regex + TF-IDF: possible additional benefit from trained
  linguistic preprocessing. A text-matching benefit alone does not prove this.
- No improvement or a decrease: inspect category overlap, requirements, near-ties,
  expected-label ambiguity and whether the text adds any new information.
- High Hit Rate@3 and lower Top-1: the expected role is often on the shortlist but
  not first. That does not establish the relevance of every suggested role.

Generated category narratives are derived from assessment scores. They do not
create independent evidence of student skills. A strong future NLP study could
use verified question-level skill evidence, independently written student project
descriptions, and richer position descriptions. Collect those inputs and labels
before testing; do not invent text that encodes the expected role.

## Independent final study

Fill `independent_dataset_template.json` with de-identified inputs and instructor
judgments. The template deliberately contains invalid placeholders so it cannot
be mistaken for collected data. Copy/edit its categories and positions to match
the actual study catalog. Each case needs:

- a unique pseudonymous `id` and student-level `group_id`;
- `split`: dev or test, fixed before selection (a student cannot cross splits);
- all category `scores`, percentages from 0 to 100;
- `expected_position_id`: the independently chosen first-choice position;
- optionally `relevant_position_ids`: all positions judged suitable, not just
  the one eventually approved; complete judgments enable Precision@3/NDCG@3;
- optional address coordinates and candidate lat/lng, from pre-recommendation inputs.

Have assessors label without seeing the rankings, document their rubric and
resolve disagreements. Existing approvals can be influenced by the recommender
and are not automatically independent. Set protocol thresholds with the adviser,
including a practical improvement over no NLP, before evaluating the final test.
No universal accuracy threshold is supplied or implied. Sample-size sufficiency
needs study-specific justification; having any particular case count is not a pass.

For your independent study, upload the JSON manually using Colab's file sidebar
and set CUSTOM_DATASET_PATH. Use institution-approved de-identified information;
Colab is an external service. No upload is performed automatically by the notebook.

The selected method/code/data/protocol are locked, then only that method and the
structured baseline run on test. Download the lock and receipt. These are workflow
safeguards, not tamper-proof preregistration: resetting Colab can erase them.
After looking at final errors, improvements require a new untouched final cohort.

## Applying a finding to the application

The `sb_snapshot` helper files are copied from current production Python sources;
hashes identify their versions. `evaluation_engine.py` reproduces neutral text,
strict model loading, per-student TF-IDF, category cosine, location decay, 60/25/15,
and percentage rounding. Stable ties follow the dataset's candidate order; database
query ordering must be controlled separately for an exact ranking comparison.

Exported prediction CSVs include every candidate's category/NLP/location/final
scores. Use them as parity fixtures when transferring a validated change.
The benchmark is not a full backend integration: it does not exercise enrollment,
batch completion, score aggregation, stored-profile freshness, authorization,
capacity, or placement approval. No application files or live records are changed.

Timing covers repeated warm preprocessing and TF-IDF/scoring/ranking work. It
excludes model load, profile generation, category/location construction, data reads,
metrics, database and network. Measure website response latency separately.

## Files and local verification

- The `.ipynb` embeds all runtime files. Other files are provided for inspection.
- `development_dataset.json`: development demo, all cases marked dev.
- `independent_dataset_template.json`: unfilled collection template.
- `source_manifest.json`: source hashes, including the current production scoring file.
- `test_evaluation_engine.py`: offline correctness and leakage-boundary checks.
- `verified_local_run/`: observed local results, separate from Colab results.
- `build_notebook.py`: regenerate the notebook from this repository after a
  deliberate versioned update; it does not edit application sources.

From the project root with existing backend dependencies:

```powershell
& skillbridge-backend/venv/Scripts/python.exe outputs/colab_nlp/build_notebook.py
& skillbridge-backend/venv/Scripts/python.exe outputs/colab_nlp/test_evaluation_engine.py
```

Research references and operational explanations appear inside the notebook.
