# Paused checkpoint: proposed-feature Colab experiment

Resumed on October 18, 2026 after the user said CONTINUE. Notebook delivery
packaging and documentation are complete. The sections below retain the paused
work record; the remaining-work list has been completed. No application
implementation was performed as part of this notebook request.

## Current user objective

Compare automatic position-duty descriptions and question-level assessed skill
evidence in an isolated Google Colab notebook before implementing any features
in SkillBridge. Preserve truthful evaluation and distinguish simulation from
independently observed evidence.

## Completed

- Created `outputs/colab_proposal/SkillBridge_Proposed_Features_Comparison.ipynb`.
  It is self-contained, with 19 cells (9 code cells), embedding the prototype,
  frozen baseline engine/helpers, sample data, independent-data template and hashes.
- Created `proposal_experiment.py`, `build_notebook.py`, `test_proposal.py`,
  `verify_notebook.py`, `README.md`, and supporting JSON/snapshot files in that folder.
- All 9 notebook code cells executed locally using the backend venv plus isolated
  plotting dependencies in `tmp/colab_qa_runtime`. No Colab-hosted execution occurred.
- All 10 prototype unit tests passed. They check label-independent generation,
  unchanged structured components, evidence validation, unknown-role behavior,
  independently reviewed duties, simulation guards, final-test receipts and controls.
- The default simulation final test correctly returned `not_run`.
- Visually inspected the generated chart; labels and bars are legible.
- Added `knowledge/NLP_PROPOSAL_EXPERIMENT.md`, linked it in the project overview,
  and updated `knowledge/NLP_IMPROVEMENT_PLAN.md` with the new offline artifact.
- No application implementation, database writes or live recommendation changes.

## Experiment and evidence limits

Variants: current neutral text; duties only; assessed-item evidence only; both.
Default preprocessors: regex and spaCy small, each followed by the same per-student
TF-IDF and 60/25/15 hybrid. Optional medium/Stanza are available in setup.
Controls: category/location without NLP, and structured skill coverage using the
same added item evidence and selected tasks (no NLP). The latter separates the
value of new information from an NLP-specific contribution.

Default dataset: 60 familiar synthetic development cases, 6 positions, 5 categories.
Artificial outcomes on 100 item annotations are seeded by case ID, independently
of expected labels, and reconcile with category totals. They are NOT observed
historic responses. Role duties are illustrative templates, NOT actual confirmed
employer duties. Missing coordinates yield neutral location scores.

Independent data requires reviewed questions, observed complete equal-weight
outcomes, truthful source provenance, reviewed selected duties, blinded relevance
labels and fixed student-separated dev/test cohorts. Production multi-assessment,
retake and evidence eligibility adaptation is deliberately outside this prototype.

## Actual local results

Full report:
`outputs/colab_proposal/qa_run/skillbridge_proposed_features_study/results/development/study_report.json`

| Variant | Hybrid Top-1 |
| --- | ---: |
| Structured category/location, no NLP | 90.00% |
| Structured specific-skill coverage control | 70.00% |
| Current text / regex | 81.67% |
| Current text / spaCy small | 80.00% |
| Duties only / regex | 91.67% |
| Duties only / spaCy small | 86.67% |
| Item evidence only / regex | 91.67% |
| Item evidence only / spaCy small | 91.67% |
| Both / regex | 88.33% |
| Both / spaCy small | 88.33% |

The highest result is only one additional correct case out of 60 over the no-NLP
baseline. Do not describe this as a proven gain or an acceptable final score.
The combined variant is not the best in this simulation. No tuning or favorable
seed selection was performed. No independent test results exist.

Chart:
`outputs/colab_proposal/qa_run/skillbridge_proposed_features_study/results/development/proposal_comparison.png`

Execution log: `outputs/colab_proposal/qa_run/execution.log`.
All stdout/stderr was captured there. The local noninteractive matplotlib warning
is expected; the saved chart was inspected successfully.

## Remaining work when resuming

1. Save a concise LOCAL_VERIFICATION.md for this proposal artifact, describing
   the 10 tests, full local notebook execution, results and limitations.
2. Copy the verified report/CSV/chart to a clean `verified_local_run/` subfolder
   of `outputs/colab_proposal` for delivery. Leave the existing earlier notebook
   and its results intact.
3. Package notebook, guide, templates, source/hash files, snapshots, verification
   note and clean results into `SkillBridge_Proposed_Features_Package.zip`.
   Exclude QA caches, temporary dependencies, __pycache__, and generated nested ZIPs.
4. Check notebook JSON/code syntax, local document links, and ZIP integrity.
   Do not rerun expensive model comparisons absent a relevant change or failure.
5. Deliver direct links to the new notebook, guide and package. Explain that the
   system was unchanged, all code cells ran locally (not on Colab), and results
   remain simulation diagnostics pending independent pilot evidence.

## Commands and workspace

Root: `C:/Users/acer/Downloads/capstone/SkillBridge`.
Backend Python: `skillbridge-backend/venv/Scripts/python.exe`.

```powershell
& skillbridge-backend/venv/Scripts/python.exe outputs/colab_proposal/build_notebook.py
& skillbridge-backend/venv/Scripts/python.exe outputs/colab_proposal/test_proposal.py
& skillbridge-backend/venv/Scripts/python.exe outputs/colab_proposal/verify_notebook.py
```

Many unrelated application edits already existed in the workspace. Preserve them.
No agent delegation is authorized by the current instructions. Continue only the
notebook delivery work after the user resumes.
