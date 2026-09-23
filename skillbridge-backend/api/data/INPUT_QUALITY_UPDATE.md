# NLP input quality update

## Measured result, not an accuracy target

The baseline and updated pipeline were each run locally against the same 60
synthetic cases and six positions. Scores, expected labels and sampling did not
change. The updated run uses curated tags in memory and the current production
text generators. These changes were designed before the updated results were
inspected; no further tuning to these cases was performed.

| Model | Baseline Top-1 | Updated Top-1 | Baseline Top-3 | Updated Top-3 | Updated macro F1 |
|---|---:|---:|---:|---:|---:|
| spaCy Small | 60.0% | 65.0% | 98.3% | 100.0% | 62.8% |
| spaCy Medium | 60.0% | 66.7% | 98.3% | 100.0% | 64.5% |
| Stanford Stanza English | unavailable | unavailable | — | — | — |

`input_quality_baseline.json` and `input_quality_current.json` contain the actual
local results and predictions. They are evidence artifacts only: no endpoint
reads them as metrics. The latter also contains raw generated samples and the
input fingerprint. Timing is machine-dependent (the updated text is longer).
Stanza's English resources were missing on this machine. Nothing was downloaded.

**This is a development-set comparison, not a held-out validation or proof of
real-world improvement.** The same familiar test design motivated the update;
do not report it as independent evidence or round it up to an 85/90% claim.
Some Top-1 predictions still disagree with the synthetic archetype labels.

## Vocabulary and generated text

- `skill_taxonomy.py` supplies curated tags for Programming, Database Management,
  Networking, Web Development, Cybersecurity, Cloud, DevOps, Operating Systems,
  Version Control, Tools, Design, Data Analytics, Quality Assurance and Technical
  Support. Exact normalized aliases resolve Database/DBMS to Database Management,
  Cloud Computing to Cloud, etc. Unknown category names no longer yield fragments
  such as “Version, Control”; short description phrases can supply editable
  fallback suggestions. No name or tag is changed in the database automatically.
- Known position roles get their own specific vocabulary. They do not append all
  category tags. Unknown roles get a small sample from the two strongest nonzero
  requirements, for human review.
- Student profiles keep the strongest-category summary and orientation derived
  only from scores/tags. Both student and position texts now use symmetric
  category evidence: canonical category, competency band and selected tags.
  Stronger scores repeat evidence more; zero scores provide no positive tag
  evidence. Generic/category-name tags are excluded from evidence. Tags shared
  across categories within a document receive fewer repetitions; TF-IDF supplies
  corpus-wide down-weighting. No expected role or archetype is passed to either
  generator. Tests permute expected labels and verify identical generated text.
- Position descriptions show title, company, required categories, exact required
  percentages, competency bands, category tags and saved role-specific tags.
  Role evidence has two repetitions (previously six), limiting its ability to
  overwhelm assessed category evidence. Text is generated on demand, not stored.
- Category vocabulary is illustrative. A category-level assessment score does
  not prove mastery of every listed technology. The diagnostic UI says so.

Weights remain 60/25/15. Active-model configuration and model failure fallback
are unchanged. Comparison uses strict model loading, excluding unavailable models
instead of assigning fallback metrics. No dependency or migration was added.

## Taxonomy quality diagnostics

Admin Skills and Admin Reports expose **Check saved taxonomy quality**. Warnings
cover normalized duplicate names, alias/near-duplicate names (name similarity at
least .88), no tags, fewer than four tags, only generic tags, and high tag overlap
(at least three shared tags and Jaccard similarity at least .60). Shared tag
counts are also shown. These are review heuristics, not instructions to merge.

**Suggest/Refresh Tags** fills the editable draft in the admin category/position
editor. The existing Save Changes action persists accepted edits. Cancel leaves
saved tags intact. Suggestions, warnings, previews and comparison do not modify
scores, saved profiles, recommendations, categories, positions or placements.
There is no bulk tag overwrite or automatic merge.

## Comparison diagnostics and dataset variant

Prepared mode is explicitly **Production prepared dataset**. It uses the
original JSON cases/labels/requirements with curated category and role suggestions
applied to in-memory objects. It does not read live saved category tags, and does
not write curated suggestions back to JSON or the database. Live tag edits affect
production previews/recommendations and real placement evaluation, not this fixed
reference corpus. Original JSON and resulting input hashes are shown separately,
along with `it-taxonomy-v2` and `neutral-evidence-v2` versions.

No Notebook Reproduction variant was added. The notebook's inferred role-title
injection, original stopwords and full 300-case corpus differ from production.
This update prioritizes the production-prepared variant and does not claim to
reproduce the paper's exact numbers. See README.md for the original export.

Each available model now includes:

- dataset/candidate counts and the existing six metrics;
- expected-to-predicted Top-1 confusion pairs with counts;
- all cases whose label is ranked #2 or #3;
- full expected rank and Top-3 scores alongside IDs;
- a note explaining high Top-3 but lower Top-1;
- evaluated taxonomy warnings, and a separate live taxonomy check;
- **View Generated Text Samples**, showing a bounded sample of actual raw inputs
  used in that run, before preprocessing. Samples are selected after generation;
  labels never influence text generation.

## Read-only text preview endpoints and UI

Previews now show the narrative, competency categories, required percentages and
role tags as readable sections and lists. Repeated Skill/Requirement evidence is
omitted from this display summary. **View raw weighted NLP input** is collapsed
by default and exposes the exact original input, including repetitions. This is
a frontend presentation change only: stored text, preprocessing, scores and
evaluation metrics are unchanged. It applies to both staff previews and the
comparison's generated text samples.

| Endpoint | Access / behavior |
|---|---|
| `GET /api/admin/taxonomy-quality/` | Admin; diagnostic warnings only |
| `GET /api/nlp/students/<id>/text/` | Admin or student's batch instructor; latest submitted assessment within scope |
| `GET /api/nlp/students/<id>/text/?assessment_id=<id>` | Same access; restricts to a specific accessible submitted assessment |
| `GET /api/nlp/positions/<id>/text/` | Admin/instructor; current saved position description |
| `POST /api/admin/nlp-model-comparison/` | Existing admin-only comparison with added diagnostics |

Admin Users → student details, and Instructor Enrolled Students → completed
student details expose **View Generated Competency Profile**. It shows saved
text (if present) and a separate current preview generated from SkillScore and
category tags. Saved text is explicitly labeled as potentially older. The current
preview never replaces it. Admin/instructor Companies → position details expose
**Preview Position NLP Description**. Historical position text is not stored, so
the current preview may differ from text used for earlier recommendations.

An instructor must have the student enrolled in a batch they own; the assessment
must also belong to one of their batches. Sharing a student with another
instructor does not grant access to the other instructor's assessments. Admins
can view all. Students are denied every new diagnostic endpoint. Student results
keep their simplified orientation/supporting-category summaries and no longer
include the technical profile field in their serialized response.

No Question, AnswerChoice or ResponseAnswer records are queried by the previews.
Only category scores, tags, submitted-assessment metadata and existing generated
profiles are read. Text is escaped by React and shown in read-only blocks.

## Manual acceptance checklist

1. Admin Skills: edit Cloud, DevOps, Tools, Version Control and Operating Systems
   one at a time. Click Suggest/Refresh Tags; verify meaningful technologies and
   multiword tags. Edit the draft. Cancel and reopen to confirm saved tags did not
   change. Repeat and explicitly Save Changes to accept.
2. With Database and Database Management present, Check saved taxonomy quality.
   Verify a possible-duplicate warning, and no automatic merge/deletion. Also
   check empty tags, a lone “Tools” tag and categories with mostly identical tags.
3. Admin Companies: edit each supported role and refresh tags. Confirm QA gets
   testing vocabulary, frontend gets UI/browser vocabulary, and backend gets
   server/API vocabulary. Cancel/save semantics match category editing.
4. Admin Users → student detail → View Generated Competency Profile. Inspect the
   saved and current texts, assessment ID and source notes. Confirm existing
   profile/recommendation timestamps do not change after opening it.
5. Instructor Enrolled Students → completed student → same preview. Verify a
   student outside the instructor's batches is denied by the API; explicitly
   requesting another instructor's assessment exposes no profile.
6. Admin/instructor Companies → position → Preview Position NLP Description.
   Verify title, company, required percentages, category and role tags. Check a
   position without tags/requirements and an assessment without a saved profile.
7. Student login: verify the new preview endpoints return 403 and student cards
   still display Hybrid match / Category fit / NLP fit / Location fit with help.
8. Admin Reports: run Prepared evaluation dataset. Confirm the Production
   prepared dataset note, 60 cases/six positions, hashes and live computed metrics.
   Inspect Top-1/Top-3, confusion pairs, and rank #2/#3 cases per model. Expand
   generated text samples. Verify source labels do not appear in profiles as roles.
9. Run Real placement data with insufficient approvals and with at least five
   eligible approvals and three candidate positions; verify existing behavior and
   new confusion/taxonomy diagnostics. Missing models must not stop available ones.
10. After deliberately saving improved tags, preview the current text again.
    Stored recommendations should retain their scores until explicitly clicking
    Admin Reports → Re-run Recommendations. Check regenerated profiles/cards.
11. Submit a normal development assessment and verify grading, profile creation,
    recommendation generation and the unchanged 60/25/15 formula.

Automated: `venv/Scripts/python.exe manage.py test api --settings=core.test_settings`
passes 42 tests, including scope, no writes, no answer queries, label independence,
preserved tags, evaluation errors and existing assessment/placement regressions.
The frontend production build passes. New components pass lint; existing company
pages retain unrelated lint errors (empty catches, unused import, effect state).

## Next evidence to collect

Use a new, independently labeled holdout set before claiming generalization.
Have instructors adjudicate ambiguous QA/support labels without viewing model
rankings. The original five broad categories lack direct testing/helpdesk evidence;
adding valid assessment categories/questions can help distinguish those roles,
but should not be done merely to force these labels. Track macro metrics and
per-role support as well as aggregate accuracy. Real placement agreement has
selection bias and uses current requirements/location data; it is not causal
evidence of placement success. Evaluate any later weight/vector changes separately.

## Files changed in this continuation

Backend: `api/skill_taxonomy.py`, `api/recommendation_nlp.py`,
`api/nlp_evaluation.py`, `api/nlp_diagnostic_views.py`, `api/views.py`,
`api/urls.py`, `api/test_nlp_diagnostics.py`; documentation and measured artifacts:
`api/data/README.md`, `api/data/INPUT_QUALITY_UPDATE.md`,
`api/data/input_quality_baseline.json`, `api/data/input_quality_current.json`.

Frontend: `src/components/NlpTextPreview.jsx`,
`src/components/admin/TaxonomyQuality.jsx`,
`src/components/admin/NlpModelComparison.jsx`,
`src/components/admin/UserDetailModal.jsx`,
`src/components/instructor/StudentModal.jsx`,
`src/pages/admin/AdminSkills.jsx`, `src/pages/admin/AdminCompanies.jsx`,
`src/pages/instructor/InstructorCompanies.jsx`.

Earlier card tooltip/comparison changes and unrelated user edits were preserved.
