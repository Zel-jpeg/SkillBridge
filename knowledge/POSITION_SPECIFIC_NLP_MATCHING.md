# Position-specific NLP matching

Implemented locally on `codex/position-specific-nlp-20261109`, starting from the
reviewed analytics baseline `4036e6e`. No remote push, live migration, deployment
or real-student recommendation refresh is part of this change.

## Behavior

Numerical assessment grading, raw/max aggregation, requirement coverage, demand
alignment, location calculation and the ordering policy are preserved. Full
assessment and combined competency profiles retain all assessed categories.

Only the supporting text comparison changes. For each compatible position,
`api/recommendation_matching.py` selects assessed categories whose existing
identity mapping matches its positive requirements, then generates an internal
student matching view with the existing neutral text generator. No inferred role
title, position-specific vocabulary or new skill claim is inserted into that view.

Program-scoped matching retains exact category/framework IDs. The existing
unscoped compatibility path supplies its canonical mapping so equivalent saved
IC categories keep their established evidence. The algorithm has no institute or
program-name branches. IDs outside the supplied catalog fail closed.

One TF-IDF model is fitted on the full saved profile plus all eligible position
documents using the existing `(1, 3)` n-grams, `min_df=1`, sublinear term frequency
and default L2 normalization. Position-relevant student documents are transformed
into that same vocabulary/IDF basis. Their rowwise dot products with position
vectors are cosine similarities. No separate per-role fit or dense all-pairs
candidate matrix is used. Preprocessing remains lazy, cached and governed by the
existing selected-model/fallback behavior.

If no required category has positive assessed evidence, its student text vector
is zeroed before both calculation and explanation. This prevents boilerplate or
an assessed-zero category name from creating a positive supporting fit. Numerical
missing evidence and assessed zero remain distinct in the existing policy.

## Explanation and preview contract

Saved `assessment_details.nlp_evidence` comes from the actual filtered student
vector and corresponding position vector. It includes:

- `matching_input_version`: `position-required-common-idf-v1`;
- `student_profile_scope`: `position_required_categories`;
- relevant assessed category IDs, positive-evidence flag and matching word count;
- a common-TF-IDF-space flag, the shared/role-only contextual terms and score.

Scoped `ranking_inputs` also records the matching version. No raw answer content
is added to results. Descriptions/tags remain contextual vocabulary, not proof of
individually assessed technology mastery.

Staff full-profile previews remain full profiles and now say so explicitly. Their
disclosure is labeled View full generated text rather than suggesting it is the
exact per-position scoring input. The NLP tooltip describes the required-category
comparison. No extra data-entry fields or navigation steps are introduced.

## Freshness and retained history

Both scoped and unscoped catalog fingerprints include the new matching version.
Previously generated suggestions therefore require the existing explicit
administrator refresh before being treated as current. Normal result reads do
not silently rerank stale saved suggestions. Valid category grades remain visible
while recommendations are stale; approval freshness checks still apply.

Full profile `TEXT_GENERATION_VERSION` remains `general-category-context-v4`
because its generation is unchanged. This change adds no database field or schema
migration. Historical placement snapshots and stored assessment answers/scores
are preserved. No configured data has been refreshed during development.

## Verification

The dedicated `api/test_position_specific_matching.py` covers one common fit,
cosine/vector parity, unrelated context exclusion, source immutability, zero and
missing evidence, aliases versus exact IDs, foreign IDs, empty vocabulary, actual
fallback reporting, filtered overlap explanations, full visible profiles,
versioned freshness and retained placement evidence.

The focused 38-test matching/ordering/runtime run passed on disposable SQLite.
Frontend lint/build and all 337 frontend helper tests passed. Real-API browser
checks against the production bundle passed for two independently scoped
programs at desktop and phone sizes, retained grades and stale warnings after an
edit, independent-program freshness, explicit synthetic refresh and assessed-zero
results without recommendations. Owned temporary servers were stopped.

The complete **857-test PostgreSQL suite passed** in 276.301 seconds on an owned
loopback-only disposable cluster. Its receipt is
`work/branch-review-postgres-h3tj83_h/tests.txt`; the test helper shut down the
cluster after completion. No configured database credentials were used.

## Reproducible six-student integration simulation

`api/data/position_matching_synthetic_v1.json` contains the previously reviewed
source-informed fictional categories, descriptions, tags, original question
specifications, supervised positions, test minimums and fixed answer patterns.
Its source URLs include DNSC, O*NET and TESDA. These are illustrative software-test
fixtures; their thresholds and expected roles are not official standards or
independent expert labels.

From `skillbridge-backend` with the existing virtual environment:

```powershell
.\venv\Scripts\python.exe scripts/verify_position_matching.py
```

The verifier disables dotenv and forces disposable SQLite `:memory:` before
creating data. It runs real backend grading, combined competency and current
integrated matching, then independently reconstructs both the old full-profile
comparison and the new common-IDF comparison. Student result API reads and
foreign-question rejection are exercised. The temporary database disappears when
the process exits; outputs are written under ignored `work/`.

The final integration run passed **169 checks**, with six students, 36 submissions,
180 saved answers and 24 recommendations across BSIT, BSIS, BSSW and BSTM:

| Student | Full-profile baseline NLP | Integrated NLP | Expected-role rank |
| --- | ---: | ---: | ---: |
| IC-1 | 51.34% | 59.00% | 1 |
| IC-2 | 52.62% | 61.61% | 1 |
| SW-1 | 52.29% | 57.81% | 1 |
| SW-2 | 56.78% | 61.99% | 1 |
| TOUR-1 | 54.41% | 59.09% | 1 |
| TOUR-2 | 48.21% | 60.47% | 1 |

All actual integrated scores agree with the independent transformed-vector
calculation. Evidence snapshots are unchanged by the comparison. Both methods
place the preselected scenario role first in these designed examples; this does
not demonstrate an improvement in independent recommendation accuracy.

## Limits

The matching percentage remains text similarity, not an assessment grade,
confidence or qualification probability. Common-corpus IDF retains a small
sensitivity to other compatible catalog content. Existing grade-band words,
tag-count cutoffs and weighting can still produce nonmonotonic text similarity
as grades increase. This input correction does not change those representations.

Existing admin model-comparison and Colab artifacts remain separately versioned
research benchmarks; their older NLP-only/hybrid results do not automatically
become accuracy measurements of this integrated assessment-led system. Do not
retune the generator to make those figures or every pair score larger. Real
program-appropriate effectiveness evaluation remains separate from software
regression and integration checks.
