# SkillBridge latest-code rescan and progress-report corrections

Reviewed October 20, 2026, at application commit `6b301ea` (`updated major UI on both isntructor&admin pages also added an reports/statistic pages on both users`). Application files were unchanged by this rescan. The progress-report files are working documents.

## Reporting decisions

**Latest date correction and evidence plan:** The user superseded November 9-10 with **November 11-13, 2026 informal defense** and **November 16-17, 2026 formal defense**. Adviser review is targeted for October 26-31, followed by feedback fixes/retesting November 1-7; no appointment is claimed. The current report uses these dates and marks deployment, formal UAT/evaluation and maintenance **Not yet started**. The team will replace archived sample figures using the [localhost capture guide](EVIDENCE_CAPTURE_GUIDE.md). Earlier schedule decisions below are historical context.

**Subsequent schedule update:** The team's Gantt chart has now arrived. The [revised report](PROGRESS_REPORT_UPDATED_GANTT.md) and its PDF replace the pending-chart draft. The image shows Implementation through January 2027, deployment in January, UAT/evaluation approximately February-March, and maintenance February-June. Exact days are not visible. The waiting/tentative decisions below are retained as the earlier reporting context, not the current document status. Source interpretation is in `evidence/gantt-source.json`.

- Wait for the team's revised Gantt chart before issuing another PDF. November 9-10, 2026 is the pre-deployment defense, not the assumed production-deployment deadline.
- The team tentatively recalls development ending and deployment starting in January, with maintenance through June. January-June 2027 is the inferred year sequence; exact dates and phase overlap await the chart. The prior PDF's proposed November completion targets must not be treated as the approved project schedule.
- Use direct accomplishment headings: Manage project information; Provide competency assessments; Compare NLP preprocessors; Generate hybrid recommendations; Provide analytics and reports. Remove numbered objective labels from evidence explanations too.
- Challenges and Solutions should describe actual development problems and the responses already taken. Keep unfinished work in Work in Progress. Code and issue records support technical examples, but cannot establish which calendar month the team experienced each problem or invent adviser discussions.

## Scope and current evidence

The inventory covers 345 application/configuration, migration and test/fixture files, totaling 48,080 lines. Compared with the closing inventory of the first independent review, 82 files changed, 52 were added and 18 were removed. This is a broad inventory and Python syntax scan with focused manual tracing, not a claim that every line was independently reviewed.

Manual follow-up covered grading/answer validation; combined-evidence gates; actual NLP loading and TF-IDF ranking; ranking provenance; category validation; admin ownership and audit APIs; analytics role/cohort scoping; and representative report, student-company and dashboard callers. Project records were cross-checked against current source and relevant regression tests. No application fixes, live record reads/writes, migration, recommendation regeneration or deployment were performed.

| Latest implementation | Source evidence | Effect on the report |
| --- | --- | --- |
| Staff Reports & Analytics | `api/analytics.py`, `pages/reports/ReportsAnalytics.jsx`, analytics hooks/utilities and tests | Include assessment/skills/placement tabs, scoped summaries, drill-downs, sortable student tables and exports. Current cohort totals are not historical completion trends. |
| Dashboard presentation and highlights | Shared dashboard components and `utils/dashboardStudents.js` | Mention clearer summary cards, top matches, skill leaders and linked student details. Locked results are not treated as zero. |
| Expanded admin assessment and batch management | `api/management_access.py`, `api/management_views.py`, `AdminBatches.jsx`, shared assessment authoring | Include admin authoring, instructor assignment/reassignment, batch-scoped actions and management history; preserve instructor ownership boundaries. |
| Recommendation freshness | `api/recommendation_freshness.py`, combined gates, freshness regression tests | The earlier stale-ranking defect now has local fix evidence: input changes lock results and approval until explicit refresh. Do not repeat it as an unchanged current defect. |
| Strict category validation | `api/catalog_validation.py`, shared creation endpoint, freshness tests | Earlier malformed-name server errors now have local rejection/validation evidence. |
| Student company browsing | `utils/recommendationResults.js`, `StudentCompanyDetails.jsx`, `PlacementGuidance.jsx` | One company card uses its best position; positions remain individually ranked. Coordinator approval is separate from a match. |
| Submission and result handling | `api/scoring.py`, `StudentAssessment.jsx`, submission-integrity records/tests | Full question denominators, exact identification answers, attempt identity and recovery after uncertain submission are supported. Background recommendation processing remains a proposal; a longer timeout does not make model loading instantaneous. |
| UI consistency | Shared toasts/dialogs, dashboard/report table components and implementation records | Describe delivered improvements and continuing refinement of selected pages. Do not claim all UI work is finished. |

## Verification performed in this rescan

| Check | Fresh result | Scope |
| --- | --- | --- |
| Frontend `npm run lint` | Passed | No lint diagnostics. |
| Frontend `npm run build` | Passed; 996 modules transformed | Local production build; plugin-time advisory only. No hosted release verified. |
| Frontend `node --test` over all 28 `src/**/*.test.mjs` files | 135 passed, zero failed/skipped | Current source unit tests; not a browser scenario total. |
| Focused backend run | 79 passed | Analytics, recommendation freshness, admin management, combined competency, NLP diagnostics/evaluation and submission integrity. These are included in, not additional to, the broad suite below. |
| Broad backend `verify_review.py sqlite api` | 347 discovered; 335 passed, 12 skipped; zero failures/errors | Disposable in-memory SQLite; dotenv disabled; cache isolated between tests. PostgreSQL locking/transport tests are explicitly skipped. |

The fresh backend run uses the existing isolated review runner. It does not establish that the ordinary unisolated test command is free of cache interference. Previous PostgreSQL/browser records are supporting history, not newly rerun checks. This rescan did not open a browser, conduct user acceptance, benchmark actual model accuracy or operate hosted services.

The full backend log is `rescan-backend-tests.log`. `source-inventory-rescan.json` records source hashes and definitions; `rescan-diff.json` records changes relative to the earlier inventory. No new application defect was confirmed in the reviewed paths and fresh checks; this is not a release-readiness certification.

## Pretrained-model explanation

Using pretrained NLP components is technically appropriate for an applied decision support system. Official spaCy and Stanza documentation provides trained pipelines for reuse. Whether that implementation satisfies the institution's capstone criteria depends on the approved objectives and adviser/panel evaluation; it is not guaranteed by a library's availability.

Current SkillBridge code loads spaCy Small/Medium or Stanza English as optional language-processing pipelines. The spaCy path removes stop words/punctuation and obtains lemmas; Stanza supplies token/lemma processing. These processed texts then enter a locally fitted TF-IDF vectorizer and cosine similarity. The final formula combines category similarity (60%), text similarity (25%) and location similarity (15%).

The application does not train these language models from scratch or fine-tune them in this path. TF-IDF `fit_transform` builds corpus vocabulary/weights; it does not train spaCy/Stanza. The current ranking path does not consume spaCy Medium's word-vector embeddings, so its name/size alone does not prove a semantic-matching advantage. Student narratives are constructed from aggregate category evidence and contextual vocabulary, not an independent assessment of every tag.

Assessment grading is separate: MCQ/true-false use answer keys; identification compares strings after trimming and lowercasing. Do not claim that pretrained NLP semantically grades student answers. Likewise, a match percentage is a similarity score, not a probability of OJT success.

Suggested defense wording:

> SkillBridge integrates pretrained NLP pipelines for text preprocessing rather than training a new language model. We developed the competency-to-position matching workflow, combine structured competency, text and location evidence, and evaluate the selected preprocessing approach within our OJT placement context. Final placement remains a staff decision.

Explain the exact selected model/version, preprocessing, comparison dataset, baselines, metrics and runtime/resource requirements. Report the actual model used and any fallback. Synthetic expected-role agreement must not be presented as real placement success; missing comparison models must not inherit fallback metrics. The final selected-model explanation must agree with the manuscript and experiment records.

Primary sources: [spaCy trained models and pipelines](https://spacy.io/models), [Stanza pretrained model downloads](https://stanfordnlp.github.io/stanza/download_models.html), [Stanza pipeline and processors](https://stanfordnlp.github.io/stanza/pipeline.html).

## Suggested historical Challenges and Solutions

These are supported technical development issues. Use the ones the team recognizes from its actual experience; specific months are not inferred.

- **Maintaining accurate assessment scores.** Internal checks identified inconsistent handling of unanswered questions and invalid answer submissions. We revised validation and grading so that each assessment question contributes to the correct category total, and added checks for incomplete answers, retakes and repeated submissions.
- **Handling slow or uncertain submissions.** Initial model loading and recommendation processing could delay submission feedback. We extended the submission wait and added a check of the recorded attempt after a failed response, allowing the interface to recognize a saved result while retaining answers when saving is unconfirmed. Further performance refinement remains ongoing.
- **Keeping recommendations consistent with updated records.** Changes to position requirements could leave older matches available for review. We added matching-input checks, blocked outdated results and provided an explicit refresh while retaining previous placement records.
- **Managing administrator and instructor responsibilities.** Assessment and batch workflows needed clearer ownership and broader administrator controls. We added shared authoring, instructor assignment, scoped batch management and action history while enforcing role boundaries.
- **Presenting results clearly and consistently.** Several pages needed clearer grouping, tables, navigation and feedback. We improved dashboards, report views, student company details and shared notifications. Refinement of selected pages continues under Work in Progress.

These paragraphs describe past issues and implemented responses. Pending adviser review, manuscript reconciliation, intended-environment migration, formal testing and deployment should be described separately according to the revised Gantt chart.
