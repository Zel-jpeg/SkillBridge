# NLP evaluation dataset and methodology

## Current system workflow simulation (default)

`nlp_workflow_evaluation_v1.json` defines 200 fictional student scenarios: 50
each for IT, IS, Social Work and Tourism, with distinct category/framework IDs
and four eligible positions per program. Categories, tags and role descriptions
reuse the source-attributed synthetic examples in
`position_matching_synthetic_v1.json`; no school records, questions or answers
are queried. Scores/minimums/reference labels are authored test assumptions,
not official curriculum thresholds.

The Social Work (BSSW) and Tourism (BSTM) test programs are labeled **IBPA**,
matching [DNSC's current program offerings](https://dnsc.edu.ph/program-offerings/)
(checked 11 November 2026). These institute labels describe the fictional test
programs; they do not create or reassign school database records.

Each program has ten fixed evidence patterns repeated over five location
variants. Thus there are **40 independent evidence patterns**, not 200
independent proficiency samples. Patterns cover role specialization, a minimum
gate that overrides a higher mean, absent categories, assessed zero, equal
numerical scores, partial evidence and no-positive-evidence gating. IT and IS
reuse category descriptions as separate editable-copy frameworks. Expected
position IDs are fixed before inference and never enter generated student text.
The equal-score reference label is reviewable: supporting NLP/location can
legitimately prefer another tied role.

The evaluator calls the current pure production helpers for raw/max pooling,
generated category/position text, required-category student views in one common
per-student TF-IDF space, minimum checks, assessment-based Match, supporting
NLP/location and stable ordering. Evidence combines two unequal assessment
maxima (30 and 70); missing categories stay absent. Candidates are confined to
the exact program/framework; foreign-framework requirements fail closed.
No-positive-evidence cases expect no recommendations, consistent with production.

`GET /api/admin/nlp-model-comparison/` returns inspectable coverage metadata,
source/input hashes and bounded fictional text samples without loading models.
`POST` with `{"mode":"workflow_simulation","program_scope":"all"}` evaluates
all 200 scenarios; scope can also be `IT`, `IS`, `SW` or `TOURISM` (50 cases).
Omitting mode selects this workflow, replacing the old prepared-mode default.
Both methods require an authenticated administrator. Comparison reads model
configuration but creates no configuration, student profile or recommendation.

The current UI is **Reports & Analytics → Advanced tools → Model comparison**.
Use **Test data & coverage** to inspect the fixture, select a test program or
all programs, then **Run comparison**. **Metrics & case results** opens measured
per-program results, NLP-only diagnostics and searchable/paginated predictions
in a separate dialog, without inline expanding panels.

The **Model settings** tab distinguishes installed files from verified execution.
**Recheck models** strictly processes text; **Save model** verifies the selected
engine before changing configuration. This never starts a recommendation refresh.
The **Refresh saved recommendations** button opens OJT Placements' explicit
selected-batch/whole-system chooser and review confirmation. An unselected batch
does not imply the whole system. Shared institute batches retain their full scope.

Top-1 agreement/Top-3 hit rate include the 20 no-positive-evidence gate cases;
ranked-only agreement and gate agreement are also returned explicitly. Macro
precision, recall and F1 use expected/predicted position classes plus the
no-recommendation class. Separate **NLP-only** Top-1/Top-3 diagnostics exclude
the gate cases (180 cases when all programs are selected). These metrics are
synthetic reference agreement, not a student's Match percentage, real-world
accuracy or placement-success probability. All-zero/missing evidence is never
claimed as a language-model success merely because other cases ranked well.

Every model processes identical fixed inputs with fallback disabled. Missing
resources produce null metrics and `unavailable`; processing failures produce
`error`. Other models continue. Processing timing includes strict preprocessing,
per-student TF-IDF fitting and current ranking; model loading is separately
timed. Dataset reads, text generation and metrics are excluded. Cached documents,
repeated patterns, model order and hardware affect time: this is not a controlled
independent performance benchmark. No network download is attempted.

The sections below describe retained **historical reference modes** explicitly
selected with `evaluation_dataset` or `real_placement_data`. Their formulas,
timing and manual UI instructions do not describe the default current workflow.

Current input-quality changes, measured before/after results, preview permissions
and the updated manual checklist are documented in [INPUT_QUALITY_UPDATE.md](INPUT_QUALITY_UPDATE.md).
Prepared runs now use the **Production prepared dataset** variant: curated tags
are applied in memory while original JSON scores, labels and requirements remain
fixed. Dataset hashes identify source data; input hashes identify generated text.

## Prepared evaluation dataset

`nlp_evaluation.json` is versioned local data, not a stored metrics table. Every
comparison recomputes model outputs. It contains 60 synthetic students (10 per
archetype), all six positions, five skill categories, category/position tags and
position requirements from **SkillBridge_Rich_NLP_Model_Comparison (1).ipynb**.
The original has 300 students with archetype counts 52/50/50/48/50/50.

The exporter reads literal notebook tables without executing notebook cells. It
replays NumPy RandomState(42), target percentage draws and 20 Bernoulli-scored
questions per category for all 300 students, keeping the first ten of each
archetype. Labels are the archetype's expected position, assigned before model
inference. IDs preserve original synthetic student numbers. The source notebook
SHA-256 is stored in JSON; each response also includes the dataset SHA-256.

To recreate deliberately, from the backend directory:

```powershell
.\venv\Scripts\python.exe scripts/prepare_nlp_dataset.py 'C:/Users/acer/Downloads/SkillBridge_Rich_NLP_Model_Comparison (1).ipynb'
```

Runtime needs only the JSON. No Colab, pandas, notebook execution, network access,
or model downloads are involved.

### Differences from the paper experiment

- The notebook inserts a category-inferred position title and role tags into
  student profile text. Evaluation uses the current production
  `generate_competency_insights` and `build_position_description` utilities,
  keeping the student narrative neutral. Expected labels never enter the text.
- Both NLP models and token filtering use production preprocessing. In particular,
  production Stanza's stopword list differs from the notebook's spaCy stopwords.
- Prepared mode uses the rich notebook's **NLP-only** corpus-wide TF-IDF
  (`ngram_range=(1,3), min_df=1, sublinear_tf=True`) and cosine ranking.
- The corpus is a balanced representative subset, so IDF and reported results
  differ from the original 300-case experiment. This mode supports reproducible
  paper-style evaluation; it does **not** certify the paper's exact numbers or
  establish real-world accuracy. Do not replace paper results without describing
  the changed dataset and text-generation method.
- These are pretrained **preprocessing** models, not three different vector
  similarity algorithms. All use TF-IDF; spaCy Medium word vectors are not used.
  Identical rankings/metrics are legitimate outcomes.

## Real placement data

This mode follows the final hybrid notebook's unchanged 0.60 category + 0.25 NLP
+ 0.15 location formula. It uses production text utilities, category cosine,
location decay, and TF-IDF fit separately per student plus all candidate positions
(as in the production engine). It does not reuse stored Recommendation scores.

Ground truth is the exact company-position ID of a currently approved placement;
equal role titles at different companies are distinct targets. Only submitted
assessments at/before approval qualify; select the latest by submission time then
response ID. Missing approval dates, missing scores/all-zero profiles and target
positions without nonzero requirements are skipped and counted. Suggested,
rejected and removed placements never qualify. At least five eligible approvals
and three candidate positions are required. Five is a demonstration threshold,
not a claim of statistical sufficiency. Evaluate the newest 100 eligible approvals
at most; disclose skipped and unexamined counts.

Candidates include all current positions with nonzero requirements, including
full positions, matching production's candidate logic. Current tags, requirements
and locations are used. Historical inputs are not fully snapshotted; a retake can
overwrite an older assessment's scores. Results measure retrospective agreement
with approved decisions, which may themselves reflect the existing recommender.
They are not an independent or prospective real-world accuracy study. Small or
imbalanced cohorts need particular care; Top-3 is necessarily 100% with only three
candidates. This mode does not replace the prepared dataset.

## Metrics and timing

- Top-1 accuracy: fraction whose first recommended position equals the label.
- Top-3 accuracy: fraction whose label is among the first three positions.
- Precision, recall, F1: macro averages from Top-1 classifications over the union
  of true and predicted classes, with undefined values zero (notebook behavior).
  These are classification metrics, not precision@3/recall@3. Values use 0–1 in
  the API and percentages in the UI. Ties follow ascending position ID.
- Processing time: preprocessing plus TF-IDF/ranking in seconds, excluding model
  loading, database reads, profile generation and metric computation. Model loads
  are lazy and process-cached; hardware and warm caches affect timing. It is not
  total HTTP request latency.

All cases' expected IDs, expected rank, Top-3 predicted IDs/scores and confusion
diagnostics are returned for inspection. Admin-only comparison responses include
a bounded sample of actual generated input texts; no assessment answers, student
names or addresses are included.

## Endpoint and safety

`POST /api/admin/nlp-model-comparison/` with JSON
`{"mode":"evaluation_dataset"}` or `{"mode":"real_placement_data"}`.
These historical modes require an explicit mode; the default is the current
workflow above. Authentication and the `admin` role are required;
instructor/student access is denied in this first release, consistent with the
existing NLP configuration endpoint.

Each model is loaded locally, independently. Missing resources produce
`unavailable` plus a clear message and null metrics; preprocessing/ranking errors
produce `error`. Other models continue. Strict evaluation explicitly disables
production fallback. Production's fallback behavior is unchanged. An unreadable
or invalid JSON dataset returns HTTP 503 with a dataset error. Insufficient real
data returns HTTP 200 with `status: insufficient_data` and no fabricated metrics.

Evaluation never invokes recommendation generation or writes Recommendation,
StudentCompetencyProfile or configuration records. Existing admin controls use
`GET/PATCH /api/admin/nlp-configuration/`. Changing the active model does not
regenerate saved scores. Only an explicit **Re-run Recommendations** click calls
`POST /api/admin/rerun-recommendations/`. Assessment submission retains its
existing generation flow. No migration or additional dependency is needed.

## Historical acceptance notes (archived UI/reference method)

Use a development account/database for actions that submit assessments or change
configuration; comparison itself is read-only.

1. Student → Results → recommendations → **Score Details**. Confirm component
   labels read Category fit, NLP fit and Location fit, with the card layout intact.
2. Hover **Hybrid match**, then click it. Verify the 60/25/15 explanation.
3. Hover/click **Category fit**: assessment skills versus required percentages.
4. Hover/click **NLP fit**: competency profile versus position text similarity.
   It must never describe the percentage as model accuracy.
5. Hover/click **Location fit**: proximity explanation. Keyboard Tab opens each
   explanation, Escape dismisses it. Tap opens it; tap again or elsewhere closes
   it. Check a narrow/mobile viewport and dark mode for clipping.
6. Placements → a suggestion row → View details: all four scores have the same
   help. Exported placement score headings use the same labels.
7. Admin → Reports & Analytics → **NLP model comparison** (below model settings).
   Check the current active model label above. Instructors/students cannot call
   comparison or change the active model; this release is admin-only.
8. Select Prepared evaluation dataset → Run comparison. Expect 60 cases, six
   candidates, per-model availability, all six metrics and dataset fingerprint.
   Inspect individual expected and Top-3 IDs. Reruns preserve rankings for the
   same environment; times can vary. Missing model resources show no scores.
9. Select Real placement data with no approvals, fewer than five eligible
   approvals, or fewer than three candidates: expect a clear insufficient-data
   message and counts. No recommendations or profile records should change.
10. With five or more approved placements whose students have submitted scored
    assessments at/before approval and three or more valid positions, run again.
    Check exact approved position IDs against Top-3 predictions and skipped
    counts. Suggestions/rejections/removals should not count as ground truth.
11. Select a model above → Save Model. Confirm the current active label updates
    and stored Recommendation scores/timestamps remain unchanged. An unavailable
    configured model retains the existing production fallback behavior.
12. Explicitly click Re-run Recommendations. Verify saved scores refresh. Submit
    a normal test assessment and verify normal grading, profile generation and
    recommendation creation still work and weights remain 60/25/15.

Automated regression checks (offline SQLite):

```powershell
.\venv\Scripts\python.exe manage.py test api --settings=core.test_settings
```
