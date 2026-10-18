# Proposal notebook verification

Verified locally on October 18, 2026. All nine code cells executed, producing
the ten default configurations, previews, diagnostics, chart and study export.
Ten offline unit tests passed. These cover label-independent simulated outcomes,
fixed category/location components, evidence validation, reviewed task selections,
unknown-role handling, same-evidence controls, final-test guards and receipt reuse.
The simulation's independent-test step correctly returned `not_run`.

No Google Colab-hosted execution was performed. Local execution used the backend
Python environment with isolated plotting/display dependencies. The noninteractive
matplotlib warning in the local execution log is expected; the saved chart was
visually inspected. No application implementation or database writes occurred.

## Observed simulation results

| Configuration | Hybrid/structured Top-1 |
| --- | ---: |
| Category/location without NLP | 90.00% |
| Specific-skill coverage without NLP | 70.00% |
| Current text / regex | 81.67% |
| Current text / spaCy small | 80.00% |
| Duties only / regex | 91.67% |
| Duties only / spaCy small | 86.67% |
| Item evidence only / regex | 91.67% |
| Item evidence only / spaCy small | 91.67% |
| Duties and item evidence / regex | 88.33% |
| Duties and item evidence / spaCy small | 88.33% |

These are hybrid first-choice results, not isolated preprocessing accuracy.
The highest score exceeds the category/location baseline by just one correct
case out of 60. This does not establish a reliable benefit or final acceptability.
Combining both proposed features was not the best configuration in this run.

The 60 cases and expected roles are familiar synthetic development data. Item
outcomes were randomly allocated within fixed category totals without using
expected labels, not collected from actual students. Suggested duties are
illustrative templates rather than confirmed employer requirements. Location
values are neutral because coordinates are absent. Do not transfer these scores
into the paper as independent real-world validation.

## Reproducibility and transfer limits

`verified_local_run/study_report.json` records model/runtime versions, source data
hash, parameters, all metrics and predictions. Per-variant subfolders include
CSV predictions, per-role diagnostics and timings. The chart and generated
description previews accompany the report. `source_manifest.json` identifies the
exact embedded experiment/helper files.

Snapshots reproduce the helpers frozen when this notebook was built, not any
subsequent application edits. Rebuild/version deliberately before a new study;
do not update code silently after examining final-test outcomes.

The prototype assumes one complete equal-weight assessment evidence set. It
does not implement production batch evidence aggregation, retake handling,
authorization, capacity, historical snapshots, recommendation freshness or UI.
Actual deployment would require a separate validated evidence adapter and tests.
Partial warm computation timings are not end-to-end website latency.

An independent pilot must supply observed eligible item outcomes, reviewed
skill annotations, confirmed duties and blinded relevance judgments with
student-separated development/test groups. The notebook freezes one development
choice before comparing it with the controls on an untouched final cohort.
No universal passing percentage is defined.
