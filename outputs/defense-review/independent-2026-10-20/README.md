# Independent review deliverables

Prepared 20 October 2026. These are separate from the earlier review and execution checklist. No application fixes or hosted acceptance are claimed by creating these files.

- [Progress report PDF](SkillBridge_Progress_Report_2026-10-20.pdf): report using the supplied college format, dated October 20 with proposed work before the November 9–10 defense. Accomplishments follow the five study objectives; a captioned evidence appendix shows UI, source code and generated output.
- [Editable report text](PROGRESS_REPORT.md): the same report in Markdown.
- [Independent code and readiness review](REVIEW.md): findings, scope, new verification, all five objectives, 13 functional requirements, eight nonfunctional requirements and remaining work.
- [Panel action matrix](PANEL_ACTION_MATRIX.md): all 17 June 2 outline-defense comments, current evidence and proposed updated actions for adviser checking.
- [Verification summary](verification-summary.json) and [issue observations](issue-observations.json): machine-readable results and independent defect reproductions.
- [Initial source inventory](source-inventory.json) and [closing inventory](source-inventory-final.json): hashes and source statistics. Four catalog files changed externally while this review was running; the full suite is not a certification of an immutable final release.

The highest-priority new issue is stale saved recommendations after position-requirement changes. The probes also reproduce malformed category fields returning 500. The ordinary full suite has throttle-cache interference. Read the review for exact impacts and closure conditions.

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

`build_report_evidence.py` prepares the five figure assets from archived synthetic local UI/report examples and current source excerpts. [Figure provenance](evidence/sources.json) records exact source files, hashes, dates and crop bounds. The figures are implementation evidence, not fresh live screenshots, real student outcomes or adviser acceptance. The October 20 report revision moves automated results into Supporting Verification and preserves the independent technical review separately.
