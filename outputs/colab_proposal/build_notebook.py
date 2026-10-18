"""Build an isolated, self-contained Colab feature-comparison experiment."""
import json
from pathlib import Path
import shutil
import sys
import hashlib

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / 'colab_nlp'
for relative in ['evaluation_engine.py', 'sb_snapshot/__init__.py',
                 'sb_snapshot/recommendation_nlp.py', 'sb_snapshot/skill_taxonomy.py']:
    target = HERE / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((BASE / relative).read_bytes())
sys.path.insert(0, str(HERE))
import proposal_experiment as experiment

original = json.loads((BASE / 'development_dataset.json').read_text())
simulated = experiment.make_simulated_questions(original)
(HERE / 'simulated_proposal_dataset.json').write_text(json.dumps(simulated, indent=2), encoding='utf-8')
template = json.loads((BASE / 'independent_dataset_template.json').read_text())
template['questions'] = simulated['questions']
template['metadata']['labeling_protocol'] = 'REPLACE with assessor rubric, blinding, date and adjudication process'
template['metadata']['evidence_note'] = 'Replace example question descriptions with actual reviewed item annotations; supply observed graded outcomes.'
for p in template['positions']:
    p['confirmed_task_ids'] = None
    p['suggested_task_options'] = experiment.suggested_tasks(p)
for case in template['cases']:
    case.update(responses=[{'question_id': q['id'], 'correct': None} for q in template['questions']],
                evidence_status='eligible_submitted', evidence_source='REPLACE_WITH_OBSERVED_SOURCE')
(HERE / 'independent_proposal_template.json').write_text(json.dumps(template, indent=2), encoding='utf-8')
names = ['proposal_experiment.py', 'evaluation_engine.py', 'sb_snapshot/__init__.py',
         'sb_snapshot/recommendation_nlp.py', 'sb_snapshot/skill_taxonomy.py',
         'simulated_proposal_dataset.json', 'independent_proposal_template.json']
payload = {name: (HERE / name).read_text(encoding='utf-8') for name in names}
for name, content in payload.items():
    (HERE / name).write_bytes(content.encode('utf-8'))
manifest = {name: hashlib.sha256(content.encode('utf-8')).hexdigest() for name, content in payload.items()}
(HERE / 'source_manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
payload['source_manifest.json'] = json.dumps(manifest, indent=2)
cells = []
def md(text):
    cells.append({'cell_type':'markdown', 'metadata':{}, 'source':text.splitlines(keepends=True)})
def code(text):
    cells.append({'cell_type':'code','metadata':{},'execution_count':None,'outputs':[], 'source':text.splitlines(keepends=True)})

md('''# SkillBridge: Test the proposed features before implementation

**Nothing in this notebook edits the application or connects to a database.**
Upload this single notebook into Google Colab (File -> Upload notebook). It embeds the code,
baseline helper snapshot, role-task templates, and a clearly labeled simulated dataset.

We compare:
1. Current generated text.
2. Automatically generated task descriptions only.
3. Specific question-level student evidence only.
4. Task descriptions and specific evidence together.
5. Structured category/location matching without NLP.
6. A structured skill-coverage control with the **same extra evidence**, without NLP.

This is a prototype, not an implemented feature or a promised accuracy improvement.
Simulated responses preserve the 60 existing students' category totals, but allocate correct
items randomly within each category. They are not reconstructed actual student answers.
No expected role or archetype is used to allocate outcomes or generate text.
Simulation results cannot establish real-world benefit. Independent evidence can be supplied later.

## 1. Runtime setup
CPU is sufficient. Default comparison: regex + TF-IDF and spaCy small + TF-IDF.
Medium and Stanza are optional, with strict unavailable-model reporting.
All are preprocessing configurations; no sentence-embedding model is used here.
''')
code('''import sys, os, subprocess, importlib.util, platform
try:
    IN_COLAB = importlib.util.find_spec("google.colab") is not None
except ModuleNotFoundError:
    IN_COLAB = False
INSTALL_MEDIUM = False
INSTALL_STANZA = False
if IN_COLAB:
    packages = ["numpy>=1.26,<3", "scikit-learn>=1.4,<2", "pandas>=2,<3", "matplotlib>=3.8,<4", "spacy>=3.7,<4"]
    if INSTALL_STANZA:
        packages.append("stanza>=1.8,<2")
    subprocess.check_call([sys.executable,"-m","pip","install","-q",*packages])
    for package in ["en_core_web_sm"] + (["en_core_web_md"] if INSTALL_MEDIUM else []):
        if importlib.util.find_spec(package) is None:
            subprocess.check_call([sys.executable,"-m","spacy","download",package])
    if INSTALL_STANZA:
        import stanza
        stanza.download("en", processors="tokenize,lemma", verbose=False)
    print(subprocess.run(["lscpu"],capture_output=True,text=True).stdout)
    print(subprocess.run(["free","-h"],capture_output=True,text=True).stdout)
print(platform.platform(), sys.version)
''')
md('''## 2. Load the isolated prototype
The baseline helpers are frozen from the earlier contribution notebook, using neutral text,
per-student TF-IDF and 60/25/15 weights. Corpus scope and weights remain fixed across variants.
The prototype changes only offline evidence/text inputs. It does not reproduce the old 93% experiment.
''')
code('''from pathlib import Path
import json, hashlib
WORK = Path("skillbridge_proposed_features_study").resolve()
WORK.mkdir(exist_ok=True)
EMBEDDED_FILES = ''' + repr(payload) + '''
for name, content in EMBEDDED_FILES.items():
    path = WORK / name
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") != content:
        raise RuntimeError(f"Changed snapshot: {name}. Use a fresh versioned study directory.")
    path.write_bytes(content.encode("utf-8"))
for name, digest in json.loads((WORK/"source_manifest.json").read_text()).items():
    assert hashlib.sha256((WORK/name).read_bytes()).hexdigest() == digest
sys.path.insert(0,str(WORK))
import proposal_experiment as proposal
import evaluation_engine as core
print("Snapshot verified:", WORK)
print(json.dumps(core.environment(),indent=2))
''')
md('''## 3. Choose simulation or observed pilot evidence
The default is 60 development cases, six positions, five categories, and 100 artificial item
annotations (20/category). Correct responses are randomly allocated to reproduce category totals.
Locations are absent and receive neutral scores. Role duties are curated suggestions, not verified
facts about actual employers. A synthetic score increase would be design evidence only.

To run a real pilot later, fill `independent_proposal_template.json`, upload it manually, and set
CUSTOM_DATASET_PATH. Replace synthetic question descriptions with actual reviewed annotations,
record complete observed outcomes and fixed dev/test groups, and have independent instructors
label suitable positions before seeing predictions. No answer keys are needed in this artifact.
Each item's `skill_id` identifies what it assesses, not what its category generally suggests.
Use only eligible submitted evidence, explicitly exported for this study. This prototype assumes
one complete equal-weight assessment evidence set; production multi-assessment aggregation and
retakes need a separate adapter. Do not mislabel simulated responses as observed data.

For independent data, confirm each position's selected task IDs from the suggested list.
Titles cannot establish actual company duties. Unknown roles need a reviewed catalog extension
before evaluation. This keeps long manual descriptions optional while retaining factual review.
Use approved de-identified data: Colab is external and uploads are manual.
''')
code('''CUSTOM_DATASET_PATH = ""
data = json.loads((Path(CUSTOM_DATASET_PATH) if CUSTOM_DATASET_PATH else WORK/"simulated_proposal_dataset.json").read_text(encoding="utf-8"))
proposal.validate_evidence(data)
MODELS = ["tfidf_regex","spacy_sm"]
if INSTALL_MEDIUM: MODELS.append("spacy_md")
if INSTALL_STANZA: MODELS.append("stanza_en")
REPEATS = 3
print("Evidence kind:",data["metadata"]["evidence_kind"])
print("Evidence limitations:",data["metadata"].get("evidence_note"))
print("Cases:",len(data["cases"]),"Positions:",len(data["positions"]),"Questions:",len(data["questions"]))
''')
md('''## 4. Preview automatic suggestions and descriptions
The demo uses role templates and selected duties, not an external generative service.
For synthetic cases the full suggestion set is a hypothetical selection. No editor has confirmed
these as real employer duties. In a real pilot, `confirmed_task_ids` records reviewed selections.
Specific student text reports correct/assessed counts without calling them technology mastery.
''')
code('''import pandas as pd
preview = [{"position":p["title"],"suggested_duties":proposal.suggested_tasks(p),
            "automatic_description":proposal.position_text(data,p)} for p in data["positions"]]
display(pd.DataFrame(preview)[["position","automatic_description"]])
print("Example student evidence:",proposal.student_text(data,data["cases"][0]))
(WORK/"generated_previews.json").write_text(json.dumps(preview,indent=2),encoding="utf-8")
''')
md('''## 5. Verify labels do not create the new evidence
This checks a concrete boundary, not all possible biases. The simulation is deliberately not
constructed to fit expected roles. If it fails to help, that is a valid outcome.
''')
code('''import copy
changed = copy.deepcopy(data)
ids = [p["id"] for p in data["positions"]]
for c in changed["cases"]:
    c["expected_position_id"] = ids[(ids.index(c["expected_position_id"])+1)%len(ids)]
    c.pop("relevant_position_ids",None)
for scenario in proposal.SCENARIOS:
    assert proposal.scenario_inputs(data,"dev",scenario)["input_hash"] == proposal.scenario_inputs(changed,"dev",scenario)["input_hash"]
print("PASS: all four variants are invariant to expected-label permutation.")
''')
md('''## 6. Compare the proposals on development data
Every variant uses the same cases, labels, category vectors and candidate order. Only the stated
text/evidence inputs change. The structured skill-coverage control uses the same item counts and
duties without text processing, so improved inputs are not automatically credited to NLP.

Metrics: Top-1, macro precision/recall/F1, Hit Rate@3 and MRR; complete multi-position judgments
add Precision@3, Recall@3 and NDCG@3. Macro metrics concern first-ranked position IDs.
Current text and proposal text differ in length/representation; interpret factor effects within
this design, not as a universal comparison. No weights or templates are optimized in this cell.
''')
code('''report = proposal.run_study(data,"dev",MODELS,REPEATS)
proposal.save_report(report,WORK/"results/development")
table = pd.DataFrame(proposal.summarize(report))
display(table)
for r in report["results"]:
    if r["status"] != "available": print(r["variant"],r.get("error"))
print(report["interpretation"])
''')
md('''## 7. Inspect contribution, helped/hurt cases, and per-role errors
Choose a proposed variant on development only. Compare against:
- category/location without NLP;
- the existing text pipeline with the same preprocessor;
- structured skill coverage with the same added evidence.

An improvement over the first two, but not skill coverage, supports useful evidence rather than
an isolated NLP advantage. spaCy versus regex compares trained preprocessing separately.
Confidence intervals on these familiar synthetic templates do not describe a real student population.
''')
code('''SELECTED_VARIANT = "duties_and_evidence__spacy_sm"
available = {r["variant"]:r for r in report["results"] if r["status"]=="available"}
if SELECTED_VARIANT not in available:
    raise RuntimeError("Selected model unavailable; inspect setup and development results.")
selected = available[SELECTED_VARIANT]
for baseline in ["structured_only","structured_skill_coverage","current_text__"+selected["method"]]:
    print(baseline,core.paired_delta(selected,available[baseline]))
current = available["current_text__"+selected["method"]]
changed_rows = [{"case_id":a["case_id"],"expected":a["expected"],"current_prediction":b["predicted"],
                 "proposed_prediction":a["predicted"],"proposed_expected_rank":a["expected_rank"],
                 "effect":"helped" if a["top1_correct"]>b["top1_correct"] else "hurt"}
                for a,b in zip(selected["predictions"],current["predictions"]) if a["top1_correct"]!=b["top1_correct"]]
display(pd.DataFrame(changed_rows))
display(pd.DataFrame(selected["diagnostic"]["per_role"]))
import matplotlib.pyplot as plt
fig,ax=plt.subplots(figsize=(12,6))
table.set_index("variant")[["top1_accuracy","macro_f1","hit_rate3"]].plot.barh(ax=ax,xlim=(0,1.05))
ax.set_title("Proposed features: development diagnostics only")
ax.set_xlabel("Metric (0 to 1)")
ax.set_ylabel("")
ax.legend(["Top-1","Macro F1","Hit Rate@3"],loc="upper left",bbox_to_anchor=(1.01,1))
plt.tight_layout()
plt.savefig(WORK/"results/development/proposal_comparison.png",dpi=160,bbox_inches="tight")
plt.show()
''')
md('''## 8. Freeze a candidate and reserve independent validation
The bundled simulation cannot enter this test. With actual observed evidence and independent labels,
only the selected proposal, its current-text counterpart and the two structured controls run on test.
Record your adviser-agreed suitability/gain/latency criteria before testing. No fixed pass percentage
is supplied and no automatic acceptance is declared. Preserve the selection and receipt; resetting
Colab can erase these workflow safeguards. Never reuse a viewed test cohort for tuning.
''')
code('''frozen = proposal.freeze_candidate(data,report,SELECTED_VARIANT,WORK/"frozen_candidate.json")
final = proposal.independent_test(data,frozen,WORK/"results/independent",REPEATS)
print(final.get("reason",final.get("decision")))
if final["status"]=="complete": print(json.dumps(final["paired_top1_gains"],indent=2))
''')
md('''## 9. Export and decide what to implement
- **Duties-only helps:** investigate better position requirements first.
- **Evidence-only helps:** investigate specific assessed skills first.
- **Both help:** pilot the combined evidence flow and confirm on independent cases.
- **Structured coverage matches/exceeds NLP:** the new evidence may be useful, but additional NLP value is unproven.
- **Nothing helps:** review task relevance, item annotations, label ambiguity and representation on dev data.

Actual implementation remains separate: migrations, admin task selection, instructor question annotations,
eligible-response aggregation, evidence provenance, stale recommendation handling and role-safe explanations
would need deliberate changes and tests. This notebook makes none of them.

Timed batches exclude model loading, category/location precomputation, question evidence/text generation,
database and network. Coverage-baseline timing includes coverage construction, so timer scopes differ.
Record workload/hardware and do not call this website response time.
''')
code('''import shutil
(WORK/"dataset_used.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
archive=shutil.make_archive(str(WORK.parent/"SkillBridge_Proposed_Feature_Results"),"zip",WORK)
print("Study archive:",archive)
DOWNLOAD_RESULTS=False
if IN_COLAB and DOWNLOAD_RESULTS:
    from google.colab import files
    files.download(archive)
''')
md('''## Supporting sources
- Gunawardana & Shani (2009), task-appropriate recommendation evaluation:
  https://jmlr.org/papers/v10/gunawardana09a.html
- Qin et al. (2018), person-job matching classification metrics:
  https://doi.org/10.1145/3209978.3210025
- Kara et al. (2023; online 2022), skill-based job matching and TF-IDF/cosine baseline:
  https://doi.org/10.1007/978-3-031-16075-2_35
- Qi et al. (2020), preprocessing quality/efficiency:
  https://doi.org/10.18653/v1/2020.acl-demos.14

These sources support methodological context, not a universal passing percentage or a validation
of this simulation. Automatic description generation here is template-based, not a claim that
NLP discovered real company duties or independently established student mastery.
''')
for i,c in enumerate(cells):c['id']=f'proposal-{i:02}'
notebook={'nbformat':4,'nbformat_minor':5,'metadata':{'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'},
          'language_info':{'name':'python'},'colab':{'name':'SkillBridge_Proposed_Features_Comparison.ipynb','provenance':[]}},'cells':cells}
(HERE/'SkillBridge_Proposed_Features_Comparison.ipynb').write_text(json.dumps(notebook,indent=1)+'\n',encoding='utf-8')
print('Built',len(cells),'cells')
