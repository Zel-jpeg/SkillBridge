# SkillBridge localhost evidence capture guide

Use this guide to fill the blank insertion areas on pages 5-12 of **SkillBridge_Progress_Report_Screenshot_Ready.pdf** with your current localhost captures. The old sample images have been removed from that version. Eleven insertion areas form eight figure groups covering the five study goals. Lettered panels, such as Figure 1(a) and 1(b), share a figure number and are arranged vertically for readability.

## Preparation

- Open your running frontend at the localhost address Vite actually prints. Append the route below; the guide does not assume your port.
- Use synthetic demonstration accounts and records, such as Demo Student A, Demo Batch and Demo Company. Use the same case across records, assessments, recommendations and report exports so the evidence forms one coherent workflow. Keep real student identities and credentials out of captures.
- Capture a stable loaded screen at a readable desktop size. Keep the page title, relevant scope/filter and labels visible; exclude unrelated windows and long blank areas. Save PNG originals. Do not alter scores, statuses or comparison results in an image editor.
- In captions, identify what the screenshot actually shows, the localhost/demo context and capture date. A useful pattern is: **Figure N. [Feature/output] showing [specific visible information]. Localhost demonstration using synthetic data, [actual capture date].** Use the date you capture it, rather than copying the report's October 20 status date.
- Keep downloaded PDF/XLSX/CSV files with the screenshots. A screenshot of a Download button does not demonstrate a generated file. A code screenshot complements UI/output evidence; it does not by itself establish successful execution or effectiveness.

## Figure 1 - Manage project information

**Capture (a):** Sign in as admin, open **Companies** (`/admin/companies`), expand a company and one position's skill requirements. Show company/position names, available slots and required skill levels. Do not capture only an empty Add Company form.

**Capture (b):** Open **Batches** (`/admin/batches`), select a demonstration batch and display its instructor and student roster. Instructor alternative: **Students** (`/instructor/students`) with the correct batch selected. Keep demo student identifiers, batch and status readable. An existing local record demonstrates stored information; no new real account is needed for a screenshot.

**Caption:** **Figure 1. Project information management showing (a) company positions, slot counts and skill requirements and (b) a batch's instructor and enrolled student records. Localhost demonstration using synthetic data, [capture date].**

**Demonstrates:** Company/position and student/batch records, supporting the data-management goal. Other figures also show competency, recommendation and placement records; this one screenshot is not claimed to show every entity.

## Figure 2 - Provide competency assessments: authoring

Sign in as instructor and open **New Assessment** (`/instructor/assessment/create`); admin also has `/admin/assessment/create`. Prepare readable example questions in the authoring workspace. Show Multiple Choice, True/False and Identification examples, their category assignments and answer controls. If all three do not fit, capture two lettered panels. Include the assessment title/batch/settings if they remain readable. A saved assessment opened for editing is stronger evidence than an untouched blank form.

**Caption:** **Figure 2. Assessment authoring interface showing supported question types, answer-key controls and skill-category assignments. Localhost demonstration using synthetic questions, [capture date].**

**Demonstrates:** Assessment preparation and question management. It does not yet demonstrate successful grading.

## Figure 3 - Provide competency assessments: generated results

Use a demonstration student's completed assessment. Open **Assessments** (`/student/assessments`) and its results, or the route `/student/assessments/<actual-assessment-id>/results`. Capture the assessment title, raw/maximum score, overall percentage and **Category scores** section. Use a normal submitted demo attempt; a stopped/flagged attempt has a different meaning and must not be captioned as ordinary completed evidence.

**Caption:** **Figure 3. Automatically generated assessment results showing the student's raw score, percentage and scores by skill category. Localhost demonstration using a completed synthetic assessment, [capture date].**

**Demonstrates:** Actual output of the scoring workflow. Use the same assessment/student later when showing combined results. Per-assessment results and combined competency are different views, so identify which one you captured.

## Figure 4 - Compare NLP preprocessors: actual comparison output

Sign in as admin, open **Reports & Analytics** (`/admin/reports`), expand **Advanced** and find **NLP model comparison**. Select **Prepared evaluation dataset** for a synthetic local demonstration, then use **Run comparison**. Capture the evaluation mode, case/position counts, model names and availability, Top-1/Top-3 accuracy, precision, recall, F1 and processing time. If necessary, capture the scope/header and the metrics table as two panels. You do not need **Save Model** or **Re-run Recommendations** just to capture this comparison.

**Caption:** **Figure 4. NLP preprocessing comparison results for spaCy Small, spaCy Medium and Stanza English, showing model availability, ranking metrics and processing time on the prepared synthetic evaluation dataset. Localhost comparison run, [capture date].**

Use that caption only if those results are actually visible. If a model is unavailable, retain its status and say **“Available model results and unavailable model status”** rather than implying a successful three-model comparison. Do not invent a missing metric or substitute fallback results.

**Demonstrates:** Execution of the implemented comparison under the shown dataset/settings. This prepared dataset is a development demonstration, not independent validation or actual OJT success. A per-student NLP-fit percentage is not model accuracy. If the final study experiment was conducted in Colab, include that experiment's actual comparison table and saved output as a separate panel, with its dataset/run clearly identified; do not present these two evaluation setups as identical.

If a comparison has not been run, use an honest caption such as **“NLP comparison interface prepared for model evaluation”** and describe the accomplishment as **comparison tools implemented; evaluation in progress**. An empty interface cannot establish a completed experimental comparison.

## Figure 5 - Compare NLP preprocessors: implementation excerpt

Open these current files in your editor, with the filename and line numbers visible. Show short relevant sections rather than a whole screen of tiny code:

- [recommendation_nlp.py](C:/Users/acer/Downloads/capstone/SkillBridge/skillbridge-backend/api/recommendation_nlp.py:20): `MODEL_OPTIONS`, listing the three pipelines.
- [nlp_evaluation.py](C:/Users/acer/Downloads/capstone/SkillBridge/skillbridge-backend/api/nlp_evaluation.py:193): the model loop and the call with `allow_fallback=False`, including the actual-model check. Find the function name if later edits move the lines.

**Caption:** **Figure 5. Source-code excerpts defining the NLP preprocessing candidates and executing strict model comparison without substituting fallback-model results. Captured from the local source code, [capture date].**

**Demonstrates:** How comparison is implemented. The pipelines are pretrained; this is not evidence that the team trained a new language model. Pair it with Figure 4, which shows the actual run.

## Figure 6 - Generate hybrid recommendations

**Capture (a):** Sign in as a demonstration student who has completed the required assessments. Open **Skill Profile and Matches** (`/student/results`). Show the combined skill profile and ranked company matches. Open a company to show its individual positions and available match scores. Use a current unlocked result; keep the coordinator-decision notice visible when practical.

**Capture (b):** Sign in as staff and open **Placements** (`/admin/placements` or `/instructor/placements`). Expand a company-position suggestion for that same demo case and open the score explanation/details. Show the total match, category/NLP/location components, distance where available, available slots and review controls. Capture the interface state without approving or changing a placement merely for appearance.

**Caption:** **Figure 6. Hybrid recommendation results showing (a) the student's ranked company-position matches and (b) staff review of category, text and location components with placement capacity. Localhost demonstration using synthetic data, [capture date].**

**Demonstrates:** Ranked matching and decision support. Company cards use their best individual position match; the ranking is still position-based. A match is not an approved placement or a probability of placement success. If the student has no current recommendations, show the real status and do not label it as a successful ranking result.

**Optional code panel:** [scoring.py](C:/Users/acer/Downloads/capstone/SkillBridge/skillbridge-backend/api/scoring.py:364), inside `_rank_recommendations`, showing category similarity, NLP similarity, location similarity and the `0.60 / 0.25 / 0.15` combination. Caption: **“Source code combining category, NLP-assisted text and location similarity into the hybrid match score.”** This may be an appendix figure instead of crowding Figure 6.

## Figure 7 - Provide analytics and reports: interface

Open **Reports & Analytics** (`/admin/reports` or `/instructor/reports`). Choose your demonstration scope and capture:

- **(a) Skills:** A meaningful competency chart together with the supporting student/category table.
- **(b) Placements:** Approved/unplaced summaries, company capacity or placement breakdown, with the relevant company/batch filters visible.

An Assessments-tab completion/follow-up view is a useful optional third panel. Prefer two readable panels over a full-page screenshot with tiny text.

**Caption:** **Figure 7. Reports and analytics showing (a) competency summaries and supporting records and (b) placement status and company-position capacity for the selected scope. Localhost demonstration using synthetic data, [capture date].**

**Demonstrates:** Actual analytics presentation and scoped reporting. Current cohort summaries must not be labeled as historical completion trends. If you capture the activity chart, call it recorded submission activity.

## Figure 8 - Provide analytics and reports: generated output

In **Placements**, open **Download placement reports**, choose **Company / position placements** and your demonstration filters, then download the PDF. Open the saved PDF and capture its report title, generation/filter information, records and capacity summary. Retain the original file. If using Reports & Analytics instead, use **Download displayed PDF** and show the corresponding exported table with the same scope/sort as Figure 7.

**Caption:** **Figure 8. System-generated company/position placement report showing the selected filters, placement records and capacity summary. PDF exported from the localhost demonstration, [capture date].**

Adapt the caption to the actual report type. An analytics PDF should be described as a scoped analytics export, not a company-placement report. An optional XLSX/CSV capture can demonstrate another output format, but a second format is not necessary if it repeats the same information. Keep signature fields blank unless actually signed; an export does not establish institutional approval.

## Selecting and inserting the evidence

Eight figure groups are a practical recommendation, not an institutional minimum. Use fewer only if the evidence still covers data management, authoring and computed assessment results, executed comparison, ranked recommendations and analytics/export output. Use optional code or extra screens in an appendix when they add a distinct point.

The old draft's five sample figures have different numbering. Replace the entire evidence section in sequence rather than attaching these captions to unrelated old images. A suggested file set is `figure-01a-company.png`, `figure-01b-roster.png`, `figure-02-authoring.png`, `figure-03-assessment-results.png`, `figure-04-model-comparison.png`, `figure-05-comparison-code.png`, `figure-06a-student-matches.png`, `figure-06b-staff-components.png`, `figure-07a-skills-analytics.png`, `figure-07b-placement-analytics.png` and `figure-08-exported-report.png`.

For each figure, retain the role, route/file, demonstration record, capture date and original image/output file. If using records created after October 20, either update the report's status date to the agreed reporting cutoff or clearly label the later capture dates. Screenshots demonstrate implementation; reliable operation, model effectiveness and user acceptance require their separate evaluation evidence.

## Confirmed review and defense plan

- **October 26-31, 2026:** Target adviser review in the final week of October; an appointment is not yet confirmed.
- **November 1-7, 2026:** Target revisions, fixes and retesting in response to adviser feedback.
- **November 11-13, 2026:** Informal pre-deployment defense.
- **November 16-17, 2026:** Formal pre-deployment defense. Address informal-defense feedback before this milestone.

These review targets supplement the original Gantt image. They do not change its January 2027 deployment and approximately February-June maintenance windows. In the timeline table, **Not yet started** is appropriate for deployment, formal UAT/evaluation and maintenance. Implementation and local testing remain **In progress**.
