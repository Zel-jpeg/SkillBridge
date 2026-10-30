# Assessment numeric-answer import correction

## Active checkpoint — 30 October 2026

Branch: `codex/assessment-zero-import`. Preserve the existing unrelated release
documents. The uploaded Programming CSV exposed an application defect: SheetJS
returns a choice `0` as the number zero, but `String(value || '')` discarded it
before validation. The earlier generated-file validation did not exercise that
conversion. Changing a delivered option to `0 (zero)` avoided the immediate
failure but did not protect future instructor files.

## Change

Both `useInstructorUpload` (new assessments for both staff roles) and
`useAssessmentUpload` (existing-assessment imports for both roles) convert cell
values using nullish fallback. Numeric zero becomes the literal string `0`,
including in optional C/D choices and identification answer keys. A typed Boolean
false becomes `false` and is recognized as a False key. Empty type cells still
default to MCQ. Empty required choices and correct keys remain invalid.

No column names, template structure, API/scoring behavior, question randomization,
student records or dependencies change. No database migration is required.

## Checks

- [x] Reproduce numeric choice 0 being rejected by the current CSV importer.
- [x] Correct both Excel/CSV conversion paths.
- [x] Test numeric/Boolean cells in real browser CSV/XLSX uploads for both roles
  and both new/existing assessment workflows, including the save payload.
- [x] Verify downloadable template re-import and invalid blank-cell rejection.
- [x] Frontend lint/build and final diff review.

Verification uses synthetic local intercepted APIs and does not publish real
assessments or send live requests to the configured database.

Frontend `npm run lint` and `npm run build` pass. The production-build browser
runner `python skillbridge-frontend/tests/run_assessment_numeric_import_browser.py`
passes all eight role/workflow/file-format combinations with zero page errors.
Each case imports zeros in A/B/C/D (including each as the correct choice), a zero
identification key, a typed False key, nonzero numeric choices and an omitted type
defaulting to MCQ. Two genuinely invalid blank-cell rows remain rejected. The
test checks the final intercepted POST/PATCH payload, not just the preview count.
Both roles also download the page's actual CSV template and successfully re-import
its three example questions. Evidence is in the ignored directory
`skillbridge-frontend/tests/artifacts/assessment-numeric-import/`.

`git diff --check` passes. The owner subsequently authorized pushing this fix to
GitHub for live testing. Publish the branch above and merge it into main, keeping
the unrelated local documents out of the commit. No migration is needed. The live
importer needs the updated frontend deployment before plain numeric zero works
there; a successful Git push alone does not establish deployment readiness.
Existing corrected CSVs containing `0 (zero)` remain compatible with both
frontend versions. Git history records the publication and merge commits.
