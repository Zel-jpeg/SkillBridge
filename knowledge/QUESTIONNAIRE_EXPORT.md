# Questionnaire export

Open a saved assessment and choose **Export questionnaire**. Administrators can
find it under **Questions** in assessment details and in the authoring editor.
Instructors can find it with the questions in the assessment editor. Downloads
contain saved questions and grading keys. Staff changes in an unsaved draft are
outside the exported snapshot.

| Format | Content |
| --- | --- |
| AIKEN, the default | Plain-text multiple choice questions with two to four choices and a single key. Categories are mapped after import. |
| SkillBridge text | Multiple choice, true/false, identification and saved category names. Blocks with embedded line breaks use `ENCODING: JSON` to preserve their text. |

The review shows the number of downloadable questions and the reason for each
omission. Confirm the supported subset when the format leaves questions out.
SkillBridge text needs a saved category for each included question. Exports
follow saved question order and authored MCQ option order. True/false keeps
SkillBridge’s fixed True then False display order. Schedules, framework IDs,
attempts and student records are outside both exports.

The API rechecks assessment access on preview and download. Saved changes
that affect the download or its omissions require a new review. Both responses
use `Cache-Control: no-store` because the files contain grading keys.

The file supplied by DNSC was used to verify import in F11. Testing a
SkillBridge export inside the DNSC LMS requires access to an authorized test
question bank. See the [implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md)
for the local verification status.

The isolated Chrome run downloaded both formats. It parsed the exported AIKEN
file in the importer and saved the native file as a new draft, checking every
saved stem, type, category name, option and key against the original. The
PostgreSQL tests verified authorization on both requests, revocation, saved
order, stale review rejection and explicit confirmation of omissions.
