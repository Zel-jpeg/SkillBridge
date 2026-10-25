# Disposable offline NLP repetition experiment

This folder is separate from the application. The script imports pure text
helpers and reads the existing synthetic JSON dataset. It does not initialize
Django, read credentials, call APIs, query a database, download models, update
saved recommendations or modify application files. Only this folder's `results/`
directory is written by default. Delete this folder when finished.

From the repository root in PowerShell:

```powershell
.\skillbridge-backend\venv\Scripts\python.exe outputs/nlp_repetition_experiment/compare_repetition.py
```

Default preprocessors are the explicit regex control, spaCy Small and spaCy
Medium. Optional Stanza can be requested with `--models stanza_en`; missing local
models are reported, never downloaded or replaced by fallback results.

The comparison is fixed in advance:

| Variant | Student text | Position text |
|---|---|---|
| current | Current production generator | Current production generator |
| position_once | Unchanged | Each expanded evidence phrase once |
| both_once | Each expanded evidence phrase once | Each expanded evidence phrase once |
| readable_position | Unchanged | Narrative only; no evidence tail |
| readable_both | Narrative only; no evidence tail | Narrative only; no evidence tail |

“Once” removes artificial copies within the evidence tail. It does not globally
deduplicate words: a term can legitimately occur in both the narrative and
evidence, or in more than one category. “Readable” uses the existing readable
narrative with categories, exact percentages, competency labels and vocabulary.
It does not invent job duties or separately assessed technology skills.

Both NLP-only and hybrid rankings use the same 60 cases, six positions, tags,
labels and component weights across arms. TF-IDF is fitted per student plus all
positions, matching live ranking rather than the prepared comparison endpoint's
corpus-wide fitting. Category similarity is fixed; location is neutral 50% for
all candidates. This isolates the text change but does not validate geography.

Open `results/REPORT.md` for aggregate results, `results/rankings.csv` for all
candidate scores/ranks and `results/results.json` for full diagnostics and text
samples. `results/POSITION_EXAMPLE.md` shows a synthetic reconstruction of the
user's nine-category screenshot; the benchmark itself has five categories.

These are familiar synthetic development cases, not independent validation or
evidence that a higher agreement score will improve actual placements. No
production integration is authorized or performed by this experiment.

References: [dataset methodology](../../skillbridge-backend/api/data/README.md),
[offline evaluation boundaries](../../knowledge/NLP_COLAB_EVALUATION.md).

## Three-model vector comparison

```powershell
.\skillbridge-backend\venv\Scripts\python.exe outputs/nlp_repetition_experiment/compare_models.py
```

This separate script tests spaCy Small, spaCy Medium and Stanza on the same
data and generators, checked against the earlier hashes and baseline metrics.
It compares TF-IDF against direct spaCy `Doc.vector` cosine on current text,
readable position text and readable text on both sides. Results are written to
`model_results/`, preserving the earlier repetition results.

Small's contextual feature average is explicitly exploratory, since Small has
no static word vectors. Medium uses its static word vectors. The existing Stanza
tokenize/lemma pipeline has no equivalent document vector API, so that native
comparison is marked unsupported. Its TF-IDF comparisons run if local resources
load. No downloads, fallback substitution or application changes are performed.

If the sandbox defaults to an empty Stanza cache, point this one Python process
at the already installed resources before running it (do not download anything):

```powershell
$env:STANZA_RESOURCES_DIR = 'C:/Users/acer/AppData/Local/StanfordNLP/stanza/Cache/1.14.0/resources'
.\skillbridge-backend\venv\Scripts\python.exe outputs/nlp_repetition_experiment/compare_models.py
```

## Concise description experiment

```powershell
.\skillbridge-backend\venv\Scripts\python.exe outputs/nlp_repetition_experiment/compare_descriptions.py
```

Uses the same data with spaCy Medium fixed. Compares current input, earlier
readable input, new concise category/band/vocabulary text and concise topic text
without bands. New matching inputs omit company/title/orientation boilerplate,
numeric percentages and expanded evidence repetitions. Display descriptions keep
exact percentages. The numerical ranking component retains the original scores.

Production TF-IDF/cosine is the primary comparison; Medium document-vector cosine
is a separately labeled exploratory comparator. Vocabulary and score-dependent
tag counts remain unchanged, so this isolates rendering rather than new evidence.
It cannot evaluate question-level skills or confirmed job duties: the dataset has
neither, and the script invents neither. The fixed plan is documented in the script
before execution. Full metrics, changed cases, examples and integrity checks are
saved in `description_results/`. No production integration is performed.
