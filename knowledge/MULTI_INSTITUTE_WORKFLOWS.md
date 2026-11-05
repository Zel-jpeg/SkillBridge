# SkillBridge multi-institute workflow guide

## Set up a program

- [ ] In **Institutes & Programs**, add or select the institute. Create the
  program with its official name and code. Add aliases for labels that already
  appear in approved enrollment files.
- [ ] Assign approved instructors to that program. Assign instructors
  separately for each program they should manage.
- [ ] In **Program competencies**, create a framework and add the skills the
  program intends to assess. Review the definitions before freezing the version.
- [ ] In **Batches & students**, create a batch for one program and choose its
  responsible instructor. Review enrollment rows and confirm the correct roster.
- [ ] Configure placement openings with eligible programs and numerical
  requirements from the applicable framework. The slot count is shared by
  everyone eligible for the same opening.

| Role | Typical work | Access boundary |
| --- | --- | --- |
| Administrator | Configure institutes, programs, instructor grants, openings and requirements. Manage batches and review placement decisions. | Staff management across programs. Assessment and placement rules still apply. |
| Assigned instructor | Reuse or add program competency definitions, manage owned batches, enroll students, author assessments, review results and export reports. | The program grant permits access to its shared framework library. Private roster, assessment and key access also requires batch ownership. |
| Student | Review the assigned program and batch, take published assessments, and view available results and recommendations. | Own profile, attempts and results. Program changes use the reviewed enrollment process. |

The IC batch remains in the regular institute area with its original status and
ownership. Existing mixed cohorts can contain both IT and IS students. The
new-batch rule applies when staff create a new batch. Entrepreneurship and
Tourism are synthetic acceptance examples under IBPA. The same configuration
works for other programs. [DNSC program research](DNSC_PROGRAM_AND_COMPETENCY_RESEARCH.md)

## Define competencies

A category is an assessable area with a name, a description and vocabulary
tags. Use the description to state what the questions can demonstrate. Use tags
for relevant terms and variations. For example, a category named **Reservation
records** might assess choosing the appropriate booking document and recognizing
incorrect entries. Its tags could include booking record, confirmation and
cancellation. The description and tags can support text matching. Scored
evidence comes from the linked assessment questions.

Instructors assigned to the same program share its category library. Verify
that a category covers the intended construct before reusing it. Once a
framework is frozen or used, create a new version for definition changes.
Earlier assessments and placement requirements retain their version and category
IDs. Category identity comes from the saved framework and ID, even when names
match.
[Competency frameworks](PROGRAM_COMPETENCY_FRAMEWORKS.md) ·
[Starter competency research](DNSC_PROGRAM_AND_COMPETENCY_RESEARCH.md)

## Prepare, import and export a questionnaire

1. Open the assessment creator. Choose the batch and its framework, then set
   the timing and completion options.
2. Add questions manually using the multiple choice, true/false or
   identification buttons. Enter the stem, answer key and category. For bulk
   entry choose **Upload file**, or **Import questions** in an existing editor.
3. Use AIKEN for plain-text single-answer multiple choice. Choose **SkillBridge
   text** or **Excel / CSV** when the questionnaire uses mixed types.
4. Open **Question import guide** for the selected format and download its
   template. Review the preview, answer keys, excluded rows and category
   mappings. Add the selected questions to the draft. Save and finish category
   mapping before publishing.
5. From a saved assessment, open **Export questionnaire**. Choose AIKEN for
   multiple choice or SkillBridge text for supported mixed question types.
   Review omissions before confirming a partial download. Keep downloaded
   answer keys within the authorized staff group.

The supplied DNSC LMS export was imported and its 20 questions and answer keys
were checked. SkillBridge-generated files were downloaded and re-imported in
SkillBridge. Importing the exported AIKEN into the DNSC LMS remains to be
verified in an authorized test question bank. Manual authoring stays available
in both systems. [Import](QUESTIONNAIRE_IMPORT.md) ·
[Export](QUESTIONNAIRE_EXPORT.md)

## Interpret results and placement decisions

- An assessment result shows evidence from one assessment. A final category
  result combines eligible raw and maximum scores across the batch's included
  assessments after required completion.
- Matching uses eligible openings and positive numerical requirements from the
  exact framework. Coverage leads the student's personal order. Demand
  alignment, text similarity and location provide the remaining ordering signals.
- A recommendation and a shared provisional suggestion are review inputs.
  Approval requires a separate coordinator decision and checks the applicable
  evidence, eligibility and capacity rules. A saved placement keeps the
  evidence used at approval.
- Scoped reports and exports check current access. Ranking inputs can become
  stale independently of valid assessment results. Staff can request a
  recalculation in the appropriate batch scope when needed.

[Matching inputs and freshness](SCOPED_RECOMMENDATION_INPUTS.md) ·
[Ordering and allocation](ASSESSMENT_LED_RECOMMENDATIONS.md) ·
[Report access](INSTITUTE_REPORT_SCOPE.md)

## Evaluate and operate

Synthetic QA verifies isolation, scoring mechanics, import keys, report access
and shared capacity. Before claiming educational validity or placement
improvement, have faculty review each program's definitions and questions.
Evaluate with independent cases and declared criteria. Check numerical
requirements, student evidence and placement decisions separately. Claims about
practical proficiency require independent evidence from program-appropriate
tasks.
[NLP evaluation scope](NLP_COLAB_EVALUATION.md)

Use the operator's read-only migration plan and the recorded configured schema
before applying changes. Rehearse each pending migration and data mapping on a
verified backup restore. Compare the allowed changes and saved evidence before
accepting the receipt. Existing IC links use a separate data reconciliation
command. Keep backups and student records private. [IC reconciliation and recovery](EXISTING_IC_RECONCILIATION.md) ·
[Feature checklist and receipts](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md)
