# Accepted questionnaire import format

25 October follow-up: instructor and admin existing-assessment imports now append
to the local authoring draft and persist only through the confirmed assessment
save. Cancel/discard and failed-save recovery preserve the expected draft boundary.
Canceled asynchronous parses cannot populate a later import panel. Existing
archived assessments are read-only. See [assessment archives](ASSESSMENT_ARCHIVES.md).

20 October admin authoring follow-up: the shared parsers load the installed `xlsx`
package on demand instead of injecting a CDN script. Formats below are unchanged.
Admin authoring stages parsed questions locally and saves them with the other
edits. See [implementation](ADMIN_MANAGEMENT_IMPLEMENTATION.md) for browser checks.

On 18 October 2026 the user explicitly directed that the existing questionnaire
format be treated as final for the 28-task release, with an update later this
week if the adviser file differs. This supersedes the prior official-sample
prerequisite for P01. It is an accepted release assumption, not evidence that an
unseen external LMS export has been compared. No particular LMS vendor or export
standard is assumed.

Both the assessment creator and existing-assessment upload retain Excel/CSV and
text inputs. The first workbook sheet uses these lower-case column names:

| Column | Meaning |
|---|---|
| `question` | Required question text |
| `type` | `mcq`, `truefalse`, or `identification`; omitted defaults to `mcq` |
| `choice_a`, `choice_b`, `choice_c`, `choice_d` | MCQ choices; A and B required |
| `correct` | MCQ letter A-D pointing to a non-empty choice; True/False for Boolean; exact answer text for identification |
| `category` | Required skill-category name |

Text files contain blocks separated by a line of `---`. Each block has
`QUESTION:`, `TYPE:`, `CORRECT:`, `CATEGORY:` and MCQ `A:` through `D:` fields.
Text field names and type/key values are normalized as the existing parser
specifies; identification answer text is preserved. Templates remain downloadable
from the upload panel. Valid rows retain their preview, import and manual editing;
invalid rows display row-level reasons and are skipped before import. Server
publication validation and ownership/attempt locks remain authoritative.

The verification reproduced an MCQ answer key C with no choice C incorrectly
appearing ready to import. Both spreadsheet upload paths and the shared text
parser now reject that row. Manual authoring also requires a non-empty marked
answer. Valid formats and saved question/choice IDs are not rewritten.

Synthetic evidence lives in `work/defense_audit/p01-*`: a real XLSX workbook
checks mixed MCQ, true/false and identification keys/categories through real
React/API publication, invalid input and retry, and existing-assessment append.
Retained CSV/text workflows and server validation are recorded in P01 and S01 of
the single continuous checklist. No configured Supabase database or real
questionnaire was changed.

Follow-up when the adviser file arrives: compare actual headers, sheet structure,
question types, answer-key encoding and categories with this contract. If it
matches, record that comparison; if it differs, add only the required adapter and
rerun import/validation/authoring and scoring checks. Preserve current formats and
the existing official IAMS enrollment importer throughout.
