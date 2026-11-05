# Questionnaire import

Open **Upload file** when creating an assessment or **Import questions** when
editing an assessment. Both administrators and instructors use the same review
panel. Import adds questions to the local authoring draft. Save the assessment
to send the questions and their selected categories to the server.

| Format | File | Supported questions |
| --- | --- | --- |
| AIKEN, the default | UTF-8 `.txt` | Single-answer multiple choice with two to four choices |
| SkillBridge text | UTF-8 `.txt` | Multiple choice, true/false and identification |
| Excel or CSV | `.xlsx`, `.xls` or `.csv` | Multiple choice, true/false and identification |

Download the template for the selected format. AIKEN uses a one-line question,
consecutive uppercase letters starting at A, and one uppercase answer key.
Each option can use a period or closing parenthesis after its letter. A
two-choice item remains multiple choice. The preview flags malformed questions,
keys, and unsupported options or rich content with their question or row number.
[MoodleDocs AIKEN format](https://docs.moodle.org/en/Aiken_format)

1. Choose a batch and framework when the assessment is program-scoped.
2. Choose a file and check the valid, invalid, unmapped and selected counts.
3. Check the option marked **Correct** in each valid question. If the file has
   errors, explicitly select the valid questions you want to use. Correct and
   upload the file again to include questions with errors.
4. Use **Category for selected questions** and **Apply category to selected** to
   assign a group. Use the category selector on a question to adjust it.
5. Choose **Add questions to draft**, then save the assessment. Assign a valid
   category to every question before publishing.

The supplied DNSC export has 20 questions, 80 choices and 20 answer keys. Its
source content stays outside the repository. This verifies the supplied export
shape for SkillBridge import. LMS-side import and questionnaire export are
separate checks in F12.

The original file was imported and saved in an isolated browser test with every
stem, option and key checked against the source. The test also verified a partial
selection, cancellation, per-question and bulk mappings, atomic publication
rejection, a retryable save conflict and student access denial. Other checks
covered native and spreadsheet imports, numeric zero and boolean false keys,
framework authoring, archive behavior and device draft recovery. F11 requires
no database migration.

Implementation `c7f8b6f` was fast-forwarded into local `main`. See the
[implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for evidence
and the next feature.
