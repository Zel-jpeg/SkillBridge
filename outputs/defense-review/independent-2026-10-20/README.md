# Independent review deliverables

Prepared 20 October 2026. These are separate from the earlier review and execution checklist. No application fixes or hosted acceptance are claimed by creating these files.

**Current report:** Use the [screenshot-ready PDF](../../../output/pdf/SkillBridge_Progress_Report_Screenshot_Ready.pdf) and [editable source text](PROGRESS_REPORT_UPDATED_GANTT.md). This 14-page template replaces the old evidence images with **11 blank insertion boxes across eight figure groups on pages 5-12**, each with capture instructions and a draft caption. The Gantt remains included. The earlier [Updated Gantt PDF](../../../output/pdf/SkillBridge_Progress_Report_2026-10-20_Updated_Gantt.pdf) still contains sample images and is superseded; use the screenshot-ready version for evidence preparation.

The corrected defense schedule is **November 11-13, 2026 informal** and **November 16-17, 2026 formal**, with target adviser review **October 26-31** and feedback revisions/retesting **November 1-7**. January 2027 deployment and approximate February-June maintenance follow the supplied Gantt. Deployment, formal UAT/evaluation and maintenance read **Not yet started**. Direct accomplishment headings and historical challenges/solutions are retained.

The [capture guide](EVIDENCE_CAPTURE_GUIDE.md) gives exact role/menu/routes, code locations, generated outputs and captions matching the blank figure groups. It distinguishes an implemented comparison interface/code from an actually executed model comparison. [Screenshot-template checks](screenshot-template-check.json) record validation of the 14-page output. The image boxes are printable layout placeholders, not interactive PDF image-upload fields.

[Gantt source and interpretation](evidence/gantt-source.json) records the unchanged chart hash and approximate month readings; exact day dates were not inferred. [Earlier layout checks](updated-gantt-layout-check.json) describe the superseded sample-image report. Reproduce the current template using `build_report_pdf.py --source outputs/defense-review/independent-2026-10-20/PROGRESS_REPORT_UPDATED_GANTT.md --output output/pdf/SkillBridge_Progress_Report_Screenshot_Ready.pdf --reference-style --gantt-appendix outputs/defense-review/independent-2026-10-20/evidence/gantt-updated-2026-10-20.png` from the repository root with the bundled artifact Python.

- [Latest-code rescan](LATEST_RESCAN.md): current implementation, scope, fresh checks, pretrained-model explanation and supported historical challenges. [Source comparison](rescan-diff.json), [current inventory](source-inventory-rescan.json) and [verification](rescan-verification.json) retain the supporting details.

- [Reference-style progress report](../../../output/pdf/SkillBridge_Progress_Report_2026-10-20_Reference_Style.pdf) and [editable text](PROGRESS_REPORT_REFERENCE_STYLE.md): revised using the supplied ClinicDesk example's presentation, with objective-based accomplishments, concise challenge/solution bullets, evidence directly under Work Completed, ongoing UI refinement and proposed dates before November 9-10. This version incorporates the later local fixes documented in `knowledge/RECOMMENDATION_FRESHNESS.md` and analytics progress in `knowledge/ANALYTICS_IMPLEMENTATION.md`; it is a document revision, not a new application audit or test run.

- [Progress report PDF](SkillBridge_Progress_Report_2026-10-20.pdf): report using the supplied college format, dated October 20 with proposed work before the November 9–10 defense. Accomplishments follow the five study objectives; a captioned evidence appendix shows UI, source code and generated output.
- [Editable report text](PROGRESS_REPORT.md): the same report in Markdown.
- [Independent code and readiness review](REVIEW.md): findings, scope, new verification, all five objectives, 13 functional requirements, eight nonfunctional requirements and remaining work.
- [Panel action matrix](PANEL_ACTION_MATRIX.md): all 17 June 2 outline-defense comments, current evidence and proposed updated actions for adviser checking.
- [Verification summary](verification-summary.json) and [issue observations](issue-observations.json): machine-readable results and independent defect reproductions.
- [Initial source inventory](source-inventory.json) and [closing inventory](source-inventory-final.json): hashes and source statistics. Four catalog files changed externally while this review was running; the full suite is not a certification of an immutable final release.

The original independent review reproduced stale saved recommendations after position-requirement changes, malformed category fields returning 500, and throttle-cache interference in its full-suite command. Those observations describe the reviewed snapshot. Later [project follow-up](../../../knowledge/RECOMMENDATION_FRESHNESS.md) records local application fixes; the original review and first report remain preserved as historical artifacts.

## Reproduce safely

From the repository root, use the existing backend venv. `verify_review.py` disables dotenv and selects isolated test settings. It clears cache between tests, retaining rate limiting within each test.

```powershell
skillbridge-backend/venv/Scripts/python.exe outputs/defense-review/independent-2026-10-20/verify_review.py sqlite
skillbridge-backend/venv/Scripts/python.exe outputs/defense-review/independent-2026-10-20/verify_review.py probes
skillbridge-backend/venv/Scripts/python.exe outputs/defense-review/independent-2026-10-20/verify_review.py sqlite api.test_suggestion_catalog
```

The optional `postgres` mode deliberately uses only the existing synthetic localhost fixture role `sb_test`, port 55438 and database `test_skillbridge_independent_20261020`. Start/stop that test cluster as one owned operation, and ensure no other test run uses the same database. Never replace these settings with normal or production credentials. This review stopped the fixture afterward.

`review_browser.py` starts a temporary Vite server on 5178, runs the existing synthetic recommendation and catalog preview scripts, and stops its owned server. Port 8018 must also be free for the preview fixture. Use the development environment with Playwright/Chrome installed. All remote browser requests are blocked by these fixtures. It does not validate live Google, maps, Storage or email.

`build_report_pdf.py` uses the bundled artifact Python with reportlab/pypdf and the source college PDF rendered as `tmp/pdfs/review_2026_10_20/template-200.png`. Use the PDF skill's renderer and inspect all pages after edits. Original documents remain unchanged. Raw evidence and QA images stay in the ignored temporary folder.

For the reference-style variant, pass `--source outputs/defense-review/independent-2026-10-20/PROGRESS_REPORT_REFERENCE_STYLE.md --output output/pdf/SkillBridge_Progress_Report_2026-10-20_Reference_Style.pdf --reference-style` from the repository root. The seven rendered pages were visually checked; the five evidence images remain beside the Markdown source. This document-only revision did not rerun application checks.

`build_report_evidence.py` prepares the five figure assets from archived synthetic local UI/report examples and current source excerpts. [Figure provenance](evidence/sources.json) records exact source files, hashes, dates and crop bounds. The figures are implementation evidence, not fresh live screenshots, real student outcomes or adviser acceptance. The October 20 report revision moves automated results into Supporting Verification and preserves the independent technical review separately.
