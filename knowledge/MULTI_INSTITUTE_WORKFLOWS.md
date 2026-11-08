# SkillBridge multi-institute workflow guide

## Set up a program

- [ ] In **Institutes & Programs**, add or select the institute. Create the
  program with its official name and code. Add aliases for labels that already
  appear in approved enrollment files.
- [ ] Assign approved instructors to that program. Assign instructors
  separately for each program they should manage.
- [ ] In **Skill taxonomy**, open the program and use **Add Skill** to define
  the areas the program will assess. Review each definition before using it in
  an assessment or a position requirement.
- [ ] In **Batches & students**, create a batch for one program and choose its
  responsible instructor. Review enrollment rows and confirm the correct roster.
- [ ] Prepare the partner catalog and openings for the program. Coordinators
  can do this before creating a batch. Use numerical requirements from the
  applicable framework to include an opening in recommendations.

| Role | Typical work | Access boundary |
| --- | --- | --- |
| Administrator | Configure institutes, programs and grants. Manage shared partner details, cross-program eligibility, batches and placement decisions. | Staff management across programs. Assessment and placement rules still apply. |
| Assigned instructor / OJT coordinator | Create partners and positions, add or reuse competency definitions, manage owned batches, enroll students, author assessments, review results and export reports. | Assigned programs share their catalogs and frameworks. Editing catalog records depends on creator authority and program eligibility. Private rosters, assessments and answer keys also require batch ownership. |
| Student | Review the assigned program and batch, take published assessments, and view available results and recommendations. | Own profile, attempts and results. Program changes use the reviewed enrollment process. |

The IC batch remains in the regular institute area with its original status and
ownership. Existing mixed cohorts can contain both IT and IS students. The
new-batch rule applies when staff create a new batch. Entrepreneurship and
Tourism are synthetic acceptance examples under IBPA. The same configuration
works for other programs. [DNSC program research](DNSC_PROGRAM_AND_COMPETENCY_RESEARCH.md)

## Maintain skills

A category is an assessable area with a name, a description and vocabulary
tags. Use the description to state what the questions can demonstrate. Use tags
for relevant terms and variations. For example, a category named **Reservation
records** might assess choosing the appropriate booking document and recognizing
incorrect entries. Its tags could include booking record, confirmation and
cancellation. The description and tags can support text matching. Scored
evidence comes from the linked assessment questions.

Administrators can open an institute in **Skill taxonomy** and manage its
**Shared skills** card. Coordinators see the shared libraries of their assigned
institutes and can maintain the skills for their assigned programs. To use an
institute definition in a program, open **Add Skill → Reuse an institute skill**,
choose a definition and select **Copy into draft**. Review the name, required
description and tags, then save. Each program copy is independently editable.

When staff change a skill set already in use, saving creates an updated set
for future work. Existing batches, assessments and requirements keep their
saved definitions. The saved category ID determines which definition each
assessment or opening uses.
[Competency frameworks](PROGRAM_COMPETENCY_FRAMEWORKS.md) ·
[Starter competency research](DNSC_PROGRAM_AND_COMPETENCY_RESEARCH.md)

## Prepare partners and openings

1. Open **OJT Partners → Manage partners & positions** and select an assigned
   program. Use **Add partner** for a new organization or **Reuse existing
   partner** to review an existing organization before adding an opening.
2. Enter the role, a description of the intern's duties, the available slots
   and relevant tags. Select the program's skill set and add minimum levels
   for the opening to participate in recommendations. Without minimum levels,
   eligible batches can use the opening for manual placement.
   For an opening using earlier skills, review the minimum levels against the
   current set before switching. The position editor clears draft levels when
   the selection changes. One position uses one requirement set, and its
   eligible programs share the same slots.
3. Review the listed eligibility and capacity. Ask an administrator to share
   one opening across programs when they compete for the same actual seats.
   Separate positions are appropriate when the organizations offer separate
   roles or seats.
4. Edit the entries you created within your assigned program. Administrators
   manage shared organization details and cross-program eligibility. If an
   administrator removes all eligibility, the opening displays **Closed to
   new placements** and the administrator can reopen it.
5. If the save outcome is uncertain, use **Check saved records** before trying
   again. Archive or restore only after reviewing the affected entry. The
   system checks current approved placements before archiving.

[Coordinator screens and verification](COORDINATOR_CATALOG_SCREENS.md)

## Prepare, import and export a questionnaire

1. Open the assessment creator. Choose the batch, then set the timing and
   completion options. Use **Current program skills** for new work. When a
   batch already uses a skill set, the creator shows its saved selection.
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
- Scoped reports and exports check current access. Position descriptions
  contribute text context to matching. If changed inputs make recommendations
  stale, administrators can open **Placements → Recommendation maintenance**
  and select the appropriate active batch scope. Shared mixed batches use their
  institute scope.

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
[NLP evaluation scope](NLP_COLAB_EVALUATION.md) ·
[Evaluator demonstration checklist](COORDINATOR_EVALUATOR_CHECKLIST.md)

Use the operator's read-only migration plan and the recorded configured schema
before applying changes. Rehearse each pending migration and data mapping on a
verified backup restore. Compare the allowed changes and saved evidence before
accepting the receipt. Existing IC links use a separate data reconciliation
command. Keep backups and student records private. [IC reconciliation and recovery](EXISTING_IC_RECONCILIATION.md) ·
[Feature checklist and receipts](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) ·
[Coordinator migration 0039 receipt](COORDINATOR_CATALOG_AUTHORITY.md)
