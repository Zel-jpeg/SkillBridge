"""Build the standalone Colab notebook from reviewed local evaluation sources."""
import hashlib
import json
import shutil
from pathlib import Path
from types import SimpleNamespace as Obj
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BACKEND = ROOT / 'skillbridge-backend'
SNAPSHOT = HERE / 'sb_snapshot'
SNAPSHOT.mkdir(exist_ok=True)
(SNAPSHOT / '__init__.py').write_text('', encoding='utf-8')
for name in ['recommendation_nlp.py', 'skill_taxonomy.py']:
    (SNAPSHOT / name).write_bytes((BACKEND / 'api' / name).read_text(encoding='utf-8').encode('utf-8'))
sys.path.insert(0, str(HERE))
from sb_snapshot.recommendation_nlp import suggest_skill_tags, suggest_position_tags

source = json.loads((BACKEND / 'api/data/nlp_evaluation.json').read_text(encoding='utf-8'))
data = {'metadata': {'name': 'SkillBridge current-helper development demonstration',
                    'evidence_kind': 'synthetic_development',
                    'labeling_protocol': 'Original synthetic archetype labels; not independently judged.',
                    'source_dataset_sha256': hashlib.sha256((BACKEND / 'api/data/nlp_evaluation.json').read_bytes()).hexdigest(),
                    'note': 'All 60 cases are familiar development data. No final validation is claimed. '
                            'Coordinates were not present in this source: all location scores are neutral .5.'},
        'categories': source['categories'], 'positions': source['positions'], 'cases': []}
for c in data['categories']:
    c['tags'] = suggest_skill_tags(c['name']) or c['tags']
for p in data['positions']:
    p['tags'] = suggest_position_tags(p['title']) or p['tags']
    p.update(lat=None, lng=None)
for case in source['cases']:
    data['cases'].append({'id': case['id'], 'group_id': case['id'], 'split': 'dev',
                          'scores': case['scores'], 'expected_position_id': case['expected_position_id'],
                          'address': {}})
(HERE / 'development_dataset.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
template = {'metadata': {'name': 'REPLACE_WITH_STUDY_NAME', 'evidence_kind': 'expert_independent',
                         'labeling_protocol': 'REPLACE: who labeled, rubric, blinding, date, adjudication, consent/data handling'},
            'categories': data['categories'], 'positions': data['positions'],
            'cases': [{'id': 'replace-dev-case', 'group_id': 'replace-student-A', 'split': 'dev',
                       'scores': {c['name']: None for c in data['categories']},
                       'expected_position_id': None, 'relevant_position_ids': [], 'address': {}},
                      {'id': 'replace-test-case', 'group_id': 'replace-student-B', 'split': 'test',
                       'scores': {c['name']: None for c in data['categories']},
                       'expected_position_id': None, 'relevant_position_ids': [], 'address': {}}]}
(HERE / 'independent_dataset_template.json').write_text(json.dumps(template, indent=2), encoding='utf-8')
files = ['evaluation_engine.py', 'development_dataset.json', 'independent_dataset_template.json',
         'sb_snapshot/__init__.py', 'sb_snapshot/recommendation_nlp.py', 'sb_snapshot/skill_taxonomy.py']
payload = {name: (HERE / name).read_text(encoding='utf-8') for name in files}
# Canonical LF bytes survive Windows -> Colab unchanged.
for name, content in payload.items():
    (HERE / name).write_bytes(content.encode('utf-8'))
hashes = {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in files}
hashes['source_scoring.py'] = hashlib.sha256((BACKEND / 'api/scoring.py').read_bytes()).hexdigest()
(HERE / 'source_manifest.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
payload['source_manifest.json'] = json.dumps(hashes, indent=2)

cells = []
def md(text):
    cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': text.splitlines(keepends=True)})
def code(text):
    cells.append({'cell_type': 'code', 'metadata': {}, 'execution_count': None, 'outputs': [],
                  'source': text.splitlines(keepends=True)})

md('''# SkillBridge: Does NLP improve OJT recommendations?

Open in Google Colab: **File -> Upload notebook**, choose this `.ipynb`, then run cells in order.
This notebook is self-contained: it embeds a versioned snapshot of the actual system's pure Python
text/preprocessing helpers and a small synthetic development dataset. It never connects to Django,
Supabase, student accounts, or production records. Downloading model resources happens only in setup.

**Research question:** Does NLP improve independently judged recommendation relevance beyond
assessment/location matching, at an acceptable computation cost?

Do not aim for a predetermined 85/90% result. The notebook reports failures and negative gains too.
The bundled 60 cases demonstrate the workflow; they cannot establish final capstone effectiveness.
If NLP does not help, that is an actionable result: investigate evidence quality and ranking assumptions.
Generated category text is derived from scores and may add no independent information.

## 1. Setup (CPU is sufficient)
Use a fresh Colab runtime. The default setup installs spaCy small; medium and Stanza are optional.
No medium word vectors are used in these TF-IDF experiments. These are preprocessing pipelines,
not three different semantic embedding algorithms. Package/model versions are exported with results.
''')
code('''import os, sys, subprocess, platform, importlib.util
try:
    IN_COLAB = importlib.util.find_spec("google.colab") is not None
except ModuleNotFoundError:
    IN_COLAB = False
INSTALL_PACKAGES = IN_COLAB
INSTALL_MEDIUM = True
INSTALL_STANZA = False  # turn on to compare Stanza; resource download is larger
if INSTALL_PACKAGES:
    packages = ["numpy>=1.26,<3", "scikit-learn>=1.4,<2", "pandas>=2,<3", "matplotlib>=3.8,<4", "spacy>=3.7,<4"]
    if INSTALL_STANZA:
        packages.append("stanza>=1.8,<2")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *packages])
    for package in ["en_core_web_sm"] + (["en_core_web_md"] if INSTALL_MEDIUM else []):
        if importlib.util.find_spec(package) is None:
            subprocess.check_call([sys.executable, "-m", "spacy", "download", package])
    if INSTALL_STANZA:
        import stanza
        stanza.download("en", processors="tokenize,lemma", verbose=False)
print("Python:", sys.version)
print("Runtime:", platform.platform(), "CPU:", platform.processor())
if IN_COLAB:
    print(subprocess.run(["lscpu"], capture_output=True, text=True).stdout)
    print(subprocess.run(["free", "-h"], capture_output=True, text=True).stdout)
''')
md('''## 2. Unpack the embedded system snapshot
This pins the helpers used in this study. New system changes require a newly versioned notebook;
do not silently replace helpers after viewing the final test. Source hashes are recorded.
The engine reproduces per-student TF-IDF and the 60/25/15 formula, but it is an offline computation
benchmark: authorization, batch gates, saved-profile freshness, capacity, and placement approval
remain separate application behaviors. Rounded ties follow the supplied candidate order.
''')
code('''from pathlib import Path
import json, hashlib, sys
WORK = Path("skillbridge_nlp_study").resolve()
WORK.mkdir(exist_ok=True)
EMBEDDED_FILES = ''' + repr(payload) + '''
for relative, content in EMBEDDED_FILES.items():
    path = WORK / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") != content:
        raise RuntimeError(f"Snapshot file changed: {relative}. Start a new versioned study.")
    path.write_bytes(content.encode("utf-8"))
sys.path.insert(0, str(WORK))
import evaluation_engine as engine
source_manifest = json.loads((WORK / "source_manifest.json").read_text())
for relative, expected in source_manifest.items():
    if relative != "source_scoring.py":
        assert hashlib.sha256((WORK / relative).read_bytes()).hexdigest() == expected, relative
print("Snapshot verified. Workspace:", WORK)
print(json.dumps(engine.environment(), indent=2))
''')
md('''## 3. Choose the data and agree the protocol before evaluating
Default: **development demonstration only**. Every case is synthetic, already used in development,
and missing coordinates receive the production neutral 0.5 location score. This does not test
location discrimination. Do not label these cases as a new independent final test.

For your own study, use `independent_dataset_template.json`. Supply de-identified assessed scores,
the same candidate catalog for all methods, and `group_id` to keep all records of a student in one split.
Choose dev/test cohorts before model selection. Have instructors judge cases without seeing model
predictions: choose one expected first-choice position, and optionally mark **all** suitable positions.
Describe the rubric, assessors, disagreement/adjudication process and date in metadata.
An approved placement influenced by this recommender is not an independent relevance label.
Input only the evidence available before recommendation; no role names/labels in student text.

Real data in Colab is an external upload: use institution-approved, de-identified inputs.
The notebook will not upload local files automatically. The template deliberately has nulls until filled.

Set criteria with your adviser **before** the final test. Fractions such as .80 mean 80%, but there
is no automatic .80/.90 default. None means no acceptance claim. The chosen primary gain must have
a paired 95% bootstrap lower bound at least as large as the pre-agreed practical gain.
This is a proposed conservative study rule, not a universal rule from the literature.
''')
code('''CUSTOM_DATASET_PATH = ""  # e.g. a manually uploaded /content/independent_dataset.json
dataset_path = Path(CUSTOM_DATASET_PATH) if CUSTOM_DATASET_PATH else WORK / "development_dataset.json"
data = json.loads(dataset_path.read_text(encoding="utf-8"))
warnings = engine.validate(data)
PROTOCOL = {
    "primary_metric": "top1_correct",  # use "ndcg3" only with complete multi-position judgments
    "min_top1": None,
    "min_macro_f1": None,
    "min_primary_gain": None,
    "agreed_by": "",
    "agreed_before_test_date": "",
    "cohort_rationale": "Describe sample size, recruitment, candidate coverage, and limits here."
}
METHODS = ["structured_only", "tfidf_regex", "spacy_sm", "spacy_md"]
if INSTALL_STANZA:
    METHODS.append("stanza_en")
REPEATS = 3
print("Dataset:", data["metadata"])
print("Cases by split:", {s: sum(c["split"] == s for c in data["cases"]) for s in ["dev", "test"]})
print("Checks:", warnings)
''')
md('''## 4. Check the input boundary
Permutation of expected labels must not alter the actual input text or score components.
This does not establish complete absence of bias; it verifies a concrete leakage boundary.
Category tags are vocabulary associated with a category, not proof that each technology was tested.
''')
code('''import copy
inputs = engine.build_inputs(data, "dev")
permuted = copy.deepcopy(data)
ids = [p["id"] for p in data["positions"]]
for case in permuted["cases"]:
    case["expected_position_id"] = ids[(ids.index(case["expected_position_id"]) + 1) % len(ids)]
    case.pop("relevant_position_ids", None)
assert engine.build_inputs(permuted, "dev")["input_hash"] == inputs["input_hash"]
print("PASS: changing labels does not change text/category/location inputs.")
print("Example neutral profile:", inputs["profiles"][0])
print("Example position description:", inputs["descriptions"][0])
''')
md('''## 5. Development comparison: isolate contribution
- **structured_only:** assessment + location, NLP removed; relative weights are unchanged.
- **tfidf_regex:** same neutral text and TF-IDF, deterministic regex preprocessing, no trained model.
- **spaCy / Stanza:** exact snapshot preprocessing, then the same TF-IDF and hybrid formula.

NLP-only metrics are also reported for each text pipeline. Compare these separately from hybrid metrics.
All methods share cases and candidate order. Models that cannot load are reported unavailable;
no fallback silently inherits a requested model's label. One warm-up and repeated timed batches are used.
Timing excludes source/profile generation, category/location construction, model loading, metrics,
database and network; it is **not** end-to-end application latency. No result is a probability of success.
''')
code('''import pandas as pd
dev = engine.compare(data, "dev", METHODS, REPEATS)
engine.export_report(dev, WORK / "results/dev")
rows = []
for result in dev["results"]:
    if result["status"] != "available":
        print(result["method"], result["status"], result.get("error"))
        continue
    rows.append({"method": result["method"], **result["hybrid"],
                 "median_partial_batch_seconds": result["median_batch_seconds"],
                 "nlp_only_top1": None if result["nlp_only"] is None else result["nlp_only"]["top1_accuracy"]})
development_table = pd.DataFrame(rows)
display(development_table)
print("Macro metrics classify the first predicted position; Hit Rate@3 is not Precision@3.")
print("NDCG@3 / Precision@3 / Recall@3 appear only with complete multi-position judgments.")
''')
md('''## 6. Diagnose the errors before changing the system
Select a candidate based on **development** results. An NLP pipeline that changes no rankings
or harms the baseline has not demonstrated added value. High Hit Rate@3 with lower Top-1 calls
for inspection of near-ties, overlapping category tags, candidate requirements, and label ambiguity.
Do not change expected labels to match model predictions.
''')
code('''SELECTED_METHOD = "spacy_sm"  # choose after inspecting development data, before any final test
available = {r["method"]: r for r in dev["results"] if r["status"] == "available"}
if SELECTED_METHOD not in available:
    raise RuntimeError("Selected method unavailable. Install it or choose an available development candidate.")
selected = available[SELECTED_METHOD]
print("Hybrid versus no NLP:", engine.paired_delta(selected, available["structured_only"]))
if "tfidf_regex" in available:
    print("Trained preprocessor versus regex + TF-IDF:", engine.paired_delta(selected, available["tfidf_regex"]))
changes = pd.DataFrame(engine.improvement_rows(dev, SELECTED_METHOD))
display(changes[changes["change"] != "unchanged"])
display(pd.DataFrame(selected["diagnostic"]["per_role"]))
print("Confusion matrix position order:", selected["diagnostic"]["position_ids"])
display(pd.DataFrame(selected["diagnostic"]["confusion_matrix"],
                     index=selected["diagnostic"]["position_ids"], columns=selected["diagnostic"]["position_ids"]))
display(pd.DataFrame(selected["predictions"])[["case_id", "expected", "predicted", "expected_rank", "margin_percent"]])
import matplotlib.pyplot as plt
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
development_table.plot.bar(x="method", y=["top1_accuracy", "macro_f1", "hit_rate3"], ax=axes[0], ylim=(0, 1.05))
development_table.plot.bar(x="method", y="median_partial_batch_seconds", ax=axes[1], legend=False)
axes[0].set_title("Development only: recommendation metrics")
axes[1].set_title("Partial warm batch computation (seconds)")
plt.tight_layout()
plt.savefig(WORK / "results/dev/development_comparison.png", dpi=160)
plt.show()
''')
md('''## 7. Freeze the choice, then evaluate the independent test once
The bundled demonstration has no final test, so this cell reports **not_run**. This is intentional.
For your own study, freeze data, method, protocol and code before running. Only the selected hybrid
and the no-NLP baseline are evaluated on test, avoiding a test-set model leaderboard.
Save/download the lock and final receipt. Colab can be reset, so these safeguards are a research
workflow aid, not tamper-proof proof of a preregistration. Never reuse a viewed test cohort for tuning.
The dataset and code hashes prevent silent edits within the same saved study.
''')
code('''selection = engine.lock_selection(data, dev, SELECTED_METHOD, PROTOCOL, WORK / "selection_lock.json")
final = engine.final_test(data, selection, WORK / "results/final", REPEATS)
print(final.get("decision", final.get("reason")))
if final["status"] == "complete":
    print("Paired NLP gain:", final["paired_delta"])
    engine.export_report(final["report"], WORK / "results/final/details")
else:
    print("No final accuracy or acceptance claim is produced for the demonstration.")
''')
md('''## 8. Applying findings to SkillBridge
1. If generated descriptions overlap too much, review category/position taxonomy and assessed
   evidence with instructors. More repeated keywords are not evidence of better placements.
2. If neutral-text TF-IDF does not beat structured-only, current NLP has no demonstrated ranking
   gain under these labels. Report this and investigate on development data.
3. If spaCy does not beat regex + TF-IDF, you may have evidence for text matching but not an
   additional benefit from the trained preprocessing model. Keep those claims distinct.
4. Candidate improvements: verified question-level skill evidence, independently written
   student project descriptions, richer company requirements, or a semantic-embedding experiment.
   These require assessment/data provenance and a new versioned study. No embeddings are used here.
   Never infer individual technology mastery from an overall category percentage alone.
5. Preserve independent final labels. Choose any text/ranking changes on development data only,
   then evaluate on a new untouched cohort. Existing approved placements can be circular labels.
6. Transfer only the independently supported change, with matching helper versions, preprocessing,
   TF-IDF scope and weights. Use the exported per-case component vectors to check backend parity.
   Similarity ranks do not replace eligibility, capacity or instructor placement decisions.

The current engine uses the exact embedded text helpers and formula; parity checks still need
real production candidate ordering, current combined competency evidence and runtime model versions.
Its synthetic results must not be relabeled as live-system accuracy.

## 9. Export your study
Exports contain case-level inputs/predictions. Do not publish a ZIP with private student records.
The default bundled study is synthetic. Downloading is manual in the next cell.
''')
code('''import shutil
(WORK / "dataset_used.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
(WORK / "protocol.json").write_text(json.dumps(PROTOCOL, indent=2), encoding="utf-8")
archive = shutil.make_archive(str(WORK.parent / "SkillBridge_NLP_Study_Results"), "zip", WORK)
print("Export ready:", archive)
DOWNLOAD_RESULTS = False  # set True when ready to download
if IN_COLAB and DOWNLOAD_RESULTS:
    from google.colab import files
    files.download(archive)
''')
md('''## Supporting sources and claim boundaries
- Gunawardana & Shani (2009), *A Survey of Accuracy Evaluation Metrics of Recommendation Tasks*,
  JMLR 10, 2935-2962. https://jmlr.org/papers/v10/gunawardana09a.html
  Supports task-appropriate metrics/experimental design, not a passing percentage.
- Qin et al. (2018), *Enhancing Person-Job Fit for Talent Recruitment: An Ability-aware Neural
  Network Approach*, SIGIR, 25-34. https://doi.org/10.1145/3209978.3210025
  Supports classification metrics in related matching; its binary outcome task differs.
- Kara et al. (2023; online 2022), *Job Recommendation Based on Extracted Skill Embeddings*,
  IntelliSys proceedings, 497-507. https://doi.org/10.1007/978-3-031-16075-2_35
  Supports skill-based matching with a TF-IDF/cosine baseline; no cross-dataset superiority claim.
- Qi et al. (2020), *Stanza: A Python Natural Language Processing Toolkit for Many Human Languages*,
  ACL System Demonstrations, 101-108. https://doi.org/10.18653/v1/2020.acl-demos.14
  Supports preprocessing comparisons, not an OJT effectiveness threshold.
- spaCy model setup: https://spacy.io/usage/models
- Stanza model setup: https://stanfordnlp.github.io/stanza/download_models.html

This notebook performs no model fine-tuning and does not establish a universal acceptable score.
A more complex model is a hypothesis to test, not evidence of capstone quality by itself.
''')

notebook = {'nbformat': 4, 'nbformat_minor': 5,
            'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
                         'language_info': {'name': 'python'},
                         'colab': {'name': 'SkillBridge_NLP_Contribution_Evaluation.ipynb', 'provenance': []}},
            'cells': cells}
for i, cell in enumerate(cells):
    cell['id'] = f'skillbridge-{i:02}'
(HERE / 'SkillBridge_NLP_Contribution_Evaluation.ipynb').write_text(
    json.dumps(notebook, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'Built {len(cells)} cells')
