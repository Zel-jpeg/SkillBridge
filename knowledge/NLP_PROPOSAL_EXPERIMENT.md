# Offline comparison of proposed NLP evidence features

The [proposal notebook](../outputs/colab_proposal/SkillBridge_Proposed_Features_Comparison.ipynb)
and [guide](../outputs/colab_proposal/README.md) test the improvement plan without
implementing its features in the application. The single notebook is self-contained.

It compares the frozen current-helper text baseline, automatic role-task
descriptions only, question-level evidence only, and both together. A no-NLP
category/location baseline and a non-NLP structured skill-coverage baseline
separate the value of new evidence from the value of text matching. Regex and
spaCy small are default configurations; medium and Stanza are optional.

The bundled dataset preserves the 60 familiar synthetic cases and category
totals. It allocates correct responses across artificial item annotations using
a fixed seed and case ID, never the expected role. These are not historic
responses or an independent test. Suggested duties are illustrative role
templates, not actual employer requirements. Missing coordinates remain neutral.

The independent-data template supports observed complete equal-weight assessment
outcomes, reviewed skill annotations, confirmed task selections, blinded
placement relevance judgments and student-separated dev/test groups. Production
batch aggregation, retakes and evidence export are outside this prototype.
The simulation cannot produce an independent final test or an acceptance claim.

The notebook exports predictions, helped/hurt cases, per-role diagnostics,
previews, source hashes and partial warm timings. Simulation results can identify
representation issues and guide a pilot; they cannot establish real-world
improvement or the capstone's acceptability. Real inputs and independent labels
remain necessary before deciding what to deploy.
