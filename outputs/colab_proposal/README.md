# Compare proposed SkillBridge features without implementing them

Upload **SkillBridge_Proposed_Features_Comparison.ipynb** into Google Colab and
run its cells in order. It is self-contained. No repository clone, database
connection, API key, or application deployment is required.

This is a separate notebook from the earlier baseline/contribution experiment.
It prototypes the proposed input changes in isolated Python:

| Variant | Student text | Position text |
| --- | --- | --- |
| Current text | Existing neutral category narrative | Existing generated requirements/tags |
| Duties only | Existing neutral category narrative | Suggested/selected tasks, generated automatically |
| Evidence only | Specific assessed-item evidence | Existing generated requirements/tags |
| Both | Specific assessed-item evidence | Suggested/selected tasks, generated automatically |

Two additional controls compare category/location without NLP and structured
skill coverage using the same additional evidence. The latter distinguishes
better inputs from a benefit attributable specifically to NLP. Regex and spaCy
small are enabled by default; medium and Stanza are optional. All use the same
60/25/15 formula, candidate order and per-student TF-IDF scope. No weights are tuned.

## What the simulation can and cannot establish

The included 60 familiar synthetic cases retain their category totals. A seeded
allocator assigns artificial correct outcomes to 20 equally weighted items per
category, without consulting expected roles. These outcomes are **not observed
student responses**. Task templates are illustrative role suggestions, not verified
facts about actual company positions. Expected labels remain the old synthetic
archetype labels. Coordinates are absent and the location component is neutral.

Results demonstrate pipeline behavior and potential trade-offs under those
assumptions. A high score cannot prove actual improvement, appropriate duties,
student mastery, or final capstone acceptability. A low score cannot rule out
benefits from independently collected, properly annotated evidence. Do not
generate better evidence from expected labels or keep changing seeds to pick
a favorable result. The seed is recorded and held fixed.

## Automatic descriptions

The notebook shows the role's suggested tasks and automatically generated
description. No long description is manually typed. A real pilot requires the
authorized editor to confirm actual applicable duties using task selections.
Unrecognized roles produce no invented company duties; extend/review the catalog
on development data before evaluating them.

The generated student narrative reports item-level correct/assessed counts. It
does not claim mastery from one correct answer. The notebook uses a frozen
20-skill catalog for the five demonstration categories, with synthetic item
annotations. This is not an automatic tagger trained/validated on real questions.

## Using actual evidence later

Fill `independent_proposal_template.json`:

1. Replace sample question descriptions with actual reviewed question annotations;
   keep skill IDs within the catalog or deliberately version/extend it before testing.
2. Supply complete observed graded outcomes, including wrong/unanswered items,
   with a truthful evidence source. No answer keys are needed.
3. Reconcile category scores with those outcomes. This prototype assumes equal
   item weights and one complete assessment evidence set. Multi-assessment batch
   aggregation, retakes and evidence eligibility require an explicit export adapter.
4. Record selected, reviewed task IDs for each position and preserve actual requirements.
5. Have instructors label expected and all suitable positions without seeing
   predictions. Document the rubric, date, assessors and adjudication.
6. Split by student into development and untouched test cohorts before choosing
   a variant. Record adviser-agreed quality, practical-gain and timing criteria.

Use de-identified institution-approved data. Colab uploads are manual and external.
Set `CUSTOM_DATASET_PATH` to the uploaded JSON. The deliberate null placeholders
must be filled before the template can run. Simulated provenance cannot be made
independent simply by changing the dataset metadata.

The default notebook compares development only. The independent test returns
`not_run` for the simulation. With real evidence, freeze one selected variant;
the test compares only it, its current-text counterpart and the two structured
controls. Download the selection and saved receipt. These are workflow safeguards,
not tamper-proof preregistration or external verification of independence.

## Read the output

- Compare every proposal with current text using the same preprocessor.
- Compare it with category/location without NLP.
- Compare it with the structured skill-coverage control using the same evidence.
- Compare regex and spaCy separately to assess trained preprocessing contribution.
- Inspect per-role performance, helped/hurt cases and expected rank, not only averages.
- Precision@3/NDCG@3 require complete multi-position relevance labels.

Partial warm computation timings exclude model loading, evidence/text generation,
category/location precomputation, database and network. Structured coverage timing
includes coverage construction; scopes differ. These are not website response times.

Exports contain the actual study data, code/hash manifest, previews, case predictions,
component vectors for text variants, diagnostics, timings and a chart. Default data
is synthetic; review exports before sharing if you supplied real pilot information.

## Next implementation decision

Choose a proposal using development diagnostics, then confirm its contribution on
independent data. If structured skill coverage does as well as NLP, report that
the evidence is useful without claiming NLP uniquely produced the benefit.
Automatic task suggestions are template generation, separate from matching NLP.

Application schemas, role access, grading, profile generation, recommendations,
freshness/invalidation and placements are not changed by this experiment.
The matching research question and the final capstone scope should be agreed
with the adviser before claiming success.
