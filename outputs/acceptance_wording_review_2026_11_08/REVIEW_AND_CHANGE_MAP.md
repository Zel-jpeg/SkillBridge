# SkillBridge acceptance wording review

Reviewed 8 November 2026 against local source revision `0ce4ee97ed6433a79bd81a0f556ec5c829e29646` and the working tree. This is a documentation alignment review, not a new deployment, effectiveness evaluation or certification of every requirement.

## Decision

Keep the title, the five-objective structure, the three user roles and the assessment/NLP/recommendation purpose. Most approved statements already cover configurable disciplines. Do not rewrite them simply to make the paper sound newer.

The signed Scope and Limitation explicitly names deployment at the Institute of Computing. Supporting other DNSC institutes and programs changes that stated deployment boundary, even though DNSC remains one institution. It should be disclosed as a bounded scope revision rather than described as grammar alone. Whether an addendum or replacement signatures are required is for the adviser/panel to decide; this review does not establish their procedure.

Current ranking also differs from the October manuscript: numerical requirement coverage and demand alignment determine order before NLP/location support. The 60/25/15 score remains a legacy/reference value. This is a method change and needs an accurate description independent of institute generalization.

## Review coverage and limits

Reviewed the complete backend URL registry and frontend route map; searched production source for IC/BSIT/BSIS assumptions; traced organization configuration, staff grants, skill catalogs, enrollment/profile scope, assessment authoring and grading, combined competency evidence, partner/position ownership, eligible recommendation inputs, NLP generation/preprocessing, ranking, result presentation, placement decisions, analytics/report scope and authentication/settings. Inspected relevant regression test definitions and existing verification receipts. Visually read all six pages of the supplied signed acceptance form and extracted the relevant manuscript pages.

This is a system-wide functional wording scan, not a line-by-line audit of every file. No application tests were rerun, no hosted environment/database was accessed, and no application behavior, original manuscript or signed form was changed. Prior test receipts are context, not checks performed in this task. The working tree already contained unrelated documentation/frontend changes; those were preserved.

Some earlier readiness notes are superseded by current source: `Position.description`, general institute shared skills, the used-library Add Skill revision path and shared-batch metadata in the overview response now exist. Do not use the earlier gap list as proof these features are still absent. Conversely, code presence does not prove hosted activation or academic validity across all programs.

## Objectives: every item reviewed

IDs below refer to the signed form, pages 1-2. Suggested edits are in the companion copyable file.

| Item | Decision | Reason |
| --- | --- | --- |
| O1 - platform, records, assessments and ranked recommendations | Keep | No IC-only restriction. Configurable catalogs implement the existing platform purpose. |
| O2 - competency questionnaires and predefined skill areas | Keep | Categories are still defined before use. Configurable does not mean undefined. This wording does not prove psychometric standardization of questionnaires. |
| O3 - compare spaCy small, medium and Stanza | Keep | Generalization does not change the named comparison. Record the actual model and fallback separately; selection still requires experiment evidence. |
| O4 - category-score, NLP and location similarity | Targeted method correction | Current ranking gives numerical requirement evidence priority; it is not simply descending hybrid percentage. Preserve matching inputs and decision-support purpose while correcting ordering language. |
| O5 - analytics and reports | Keep | Institute/program filters are details of the existing reporting objective. |

No sixth objective is needed merely to describe configuration. Keep the approved title; a display-term change to OJT Partners does not by itself require renaming the capstone.

## Scope and Limitation

Required: replace the IC-exclusive deployment sentence with DNSC deployment across configured institutes and programs. Keep single-institution deployment, the three roles, internal data, no external employment-system integration, no advanced generative AI, human final decisions and no long-term outcome tracking.

Correct the accompanying sign-in phrase: students and instructors use institutional Google identity; administrators use individual password login. Clarify that scores come from answer-key grading and that NLP processes generated competency/position text. Do not imply that spaCy or Stanza grades general free-text answers.

Do not replace the submitting department or signatories' official “Institute of Computing” heading with another institute. The unit awarding the capstone and the system's supported user population are different facts.

## Functional requirements: every item reviewed

IDs refer to signed form pages 3-4 (manuscript physical pages 28-30).

| Item | Decision | Basis / minimum necessary adjustment |
| --- | --- | --- |
| FR1 authentication | Correct existing behavior | Google for students AND instructors; password for administrators. This predates generalization. |
| FR2 profile management | Keep | “Course” already means degree program. Assigned program is enrollment-controlled, not a student's unrestricted self-selection. Explain the field behavior in the design chapter. |
| FR3 batches and email enrollment | Small scope clarification | Describe program-based batches under authorized instructors. Retain original account/enrollment purpose. Existing mixed IC batches are compatibility records, not a promise of mixed new batches. |
| FR4 company/position management | Targeted authority correction | Assigned coordinators now create/manage permitted program records; administrator authority remains. Creator/program rules prevent arbitrary peer edits. |
| FR5 questionnaires and Excel upload | Keep | All approved types and spreadsheet import remain. AIKEN/native text import are additional supported formats; documenting them in implementation does not require rewriting the minimum Excel promise. |
| FR6 TF-IDF category assistance | Keep | Program assistance still uses TF-IDF. Explain that suggestions can abstain and staff confirm categories; an automatically computed suggestion is not an automatic final assignment. |
| FR7 grading identification answers | Small technical correction | Current implementation trims leading/trailing whitespace and compares lowercase text with one correct key. Replace the vague NLP-normalization phrase with that actual operation; do not claim semantic grading. |
| FR8 category percentages and structured profiles | Keep | Same purpose across disciplines; aggregation details belong in methods. |
| FR9 generated profile/position text | Keep | Generated text still uses scores, requirements and tags; current position descriptions provide additional saved context. “Generated descriptions” does not require a generative model. |
| FR10 NLP preprocessing and TF-IDF matching | Keep | Same pipeline across eligible program catalogs. Record configuration, actual model and fallback in methods/results. |
| FR11 recommendation combination | Targeted method correction | Describe assessment-led ranking plus supporting NLP/location and program eligibility. Do not claim the legacy weighted score determines current order. |
| FR12 displayed match-score percentage | Targeted presentation correction | Current results distinguish rank, requirement coverage and supporting similarity. A coverage percentage is not the old hybrid percentage or confidence. |
| FR13 role dashboards and reports | Keep | Existing statement is broad enough for scoped reports. Describe filters and privacy in design/security. |

One concise new FR14 is proposed to explicitly capture the delivered institute/program configuration, instructor assignments and authorized skill-library management. This is an added capability statement, not a cosmetic correction. If the panel prefers the original 13-item structure, the same facts can instead be documented in scope and the existing management requirements after their review. Do not silently omit the addition merely to characterize all changes as word substitutions.

“OJT partner” can be defined once as the paper's existing company/host organization, including companies, offices and institutions. Use the current screen label in screenshots and interface descriptions. Preserve existing historical/company terminology where it identifies the approved title, source quotations, database entities or issued records.

## Nonfunctional requirements: every item reviewed

IDs refer to signed form pages 4-5 (manuscript physical pages 30-31).

| Item | Decision for this revision | Evidence boundary |
| --- | --- | --- |
| NFR1 performance efficiency / same request cycle | Keep | Generalization alone does not require changing the target. Larger catalogs need measured runtime/concurrency evidence; this review does not establish acceptable latency. |
| NFR2 reliability / automatic failover | Keep as an approved target; flag evidence gap | Cloud deployment alone does not establish automatic failover. Verify the actual recovery/failover configuration before reporting the requirement as achieved. Any removal of this promise is a separate requirement decision. |
| NFR3 usability | Keep | Existing wording already covers all three roles. Faculty orientation is compatible with avoiding specialized technical training. |
| NFR4 security | Small clarification | Extend institutional Google wording to instructors and state assigned institute/program scope. Backend access, not filters alone, provides the boundary. |
| NFR5 device/browser compatibility | Keep | No IC-specific assumption. |
| NFR6 modular maintainability | Keep | Configuration is compatible with the approved requirement. |
| NFR7 scalability/adaptability | Small scope clarification | Add configured institutes and programs to the existing extensibility list. Preserve the existing quality target; do not claim all disciplines have validated accuracy. |
| NFR8 availability / seven-day refresh | Keep | Current settings retain a seven-day refresh lifetime. That does not guarantee uptime or prevent revocation/expiry/security-based sign-in. |

Do not add an unsupported “supports unlimited programs/users” promise. Multiple DNSC institutes do not mean multiple independent institutions, public job portals or nationwide placement.

## Paper passages outside the acceptance list

| Supplied rev3 physical page | Minimal follow-up |
| --- | --- |
| 8, Objectives | Apply only the O4 correction; the paper and signed form use slightly different prose, so use the signed form as the approval baseline. |
| 9, Significance | Replace the beneficiary restriction “BSIT students” / “respective IT areas” with students in participating DNSC programs / relevant competency areas. Replace the beneficiary heading “Educational Institutions (DNSC Institute of Computing)” with “Davao del Norte State College and Participating Institutes.” Do not rewrite historical IC evidence as college-wide findings. |
| 11, Scope and Limitation | Use the bounded DNSC/program scope and accurate authentication/profile-processing wording. |
| 20, planning/analysis | Where describing the current target problem, change “IT students” to “students in participating programs.” Preserve wording about historical IT-specific interviews/studies. |
| 28-31, requirements | Apply the numbered changes in the copyable file; retain unchanged items. |
| 32 onward, design/data flow/ERD | Explain institute/program catalogs, staff assignments, program skill definitions and eligibility using current schema/permissions. Keep this separate from the small objective wording changes. |
| 55 and 70-75, NLP/recommendation methods and results | The October revised PDF predates assessment-led ordering and current program scope. Do not present old 60/25/15 notebook results as evaluation of the current system. Document the new ranking method and identify which historical experiment each table actually evaluates. |

The title page's “Faculty of the Institute of Computing” identifies the academic recipient and should stay. BSIT in the researchers' degree/signature block should stay. BSIT in an example/schema value can stay as an example, not a restriction. Do not globally replace IC/IT/BSIT in code, the manuscript or the acceptance form.

## Source traceability

Paths are relative to the repository root. Relevant symbols are listed so the review can be checked without trusting a stale line number.

| Area | Current source |
| --- | --- |
| System coverage | `skillbridge-backend/api/urls.py`; `skillbridge-frontend/src/App.jsx` |
| Institutes, programs, grants and skills | `api/models.py`: Institute, Program, InstructorAssignment, CompetencyFramework, InstituteSkill, SkillCategory; `api/organization.py`; `api/instructor_assignments.py`; `api/competencies.py`: institute_skills, framework_categories, category_revision |
| Program authority and enrollment | `api/program_scope.py`: active_program, enrollment_context; `api/enrollment_import.py`; `api/authoring_scope.py`: resolve_framework, bind_batch |
| Authentication | `api/views.py`: login, _verified_google_identity, google_login; `core/settings.py`: SIMPLE_JWT and throttling |
| Grading and combined profiles | `api/scoring.py`: score_submission; `api/combined_competency.py`: eligible_evidence, _recalculate_combined |
| Category assistance | `api/competency_assistance.py`: rank, assist_category, assist_tags; `api/scoring.py`: suggest_category (legacy catalog path) |
| Text generation/preprocessing | `api/recommendation_nlp.py`: build_student_profile, build_position_description, preprocess_texts |
| Current ordering | `api/scoring.py`: _rank_recommendations; `api/recommendation_policy.py`: describe, numerical_key, rank_key; `src/utils/recommendationResults.js`; `src/pages/student/StudentResults.jsx` |
| Eligible openings and catalog authority | `api/opportunity_scope.py`; `api/coordinator_catalog.py`: lock_program, can_edit_company, positions, position_detail; `api/catalog_validation.py` |
| Decisions and analytics | `api/assessment_allocation.py`; `api/analytics.py`; `api/views.py`: placement_approve, placement_manual_assign; `src/pages/reports/ReportsAnalytics.jsx` |
| Regression definitions inspected | `api/test_program_batches.py`; `api/test_competencies.py`; `api/test_scoped_recommendations.py`; `api/test_assessment_led.py`; `api/test_coordinator_catalog.py` |

Backend paths in the last table beginning `api/` or `core/` are within `skillbridge-backend/`; `src/` paths are within `skillbridge-frontend/`.

Supporting project context: `knowledge/PROJECT_OVERVIEW.md`, `MULTI_INSTITUTE_ACCEPTANCE.md`, `SCOPED_RECOMMENDATION_INPUTS.md`, `ASSESSMENT_LED_RECOMMENDATIONS.md`, `PROGRAM_SKILL_EDITOR.md`, `AUTHENTICATION_AND_RECOVERY.md`, `QUESTIONNAIRE_IMPORT.md` and `PARTNER_TERMINOLOGY.md`. Current source takes precedence over historical readiness findings.

Document baseline: `C:/Users/acer/Downloads/Outline_Acceptance_Form.pdf` (six signed/scanned pages) and the supplied `C:/Users/acer/Downloads/rev3_SKILLBRIDGE_ A_WEB-BASED OJT PLACEMENT DECISION SUPPORT SYSTEM WITH NLP-ASSISTED SKILLS ASSESSMENT AND COMPANY-POSITION RECOMMENDATION.docx.pdf` (88 pages). This review does not assume an unseen newer editable master. The six cached acceptance-page images were visually inspected; signed-form wording, not an empty OCR extraction, supplies the numbered approval baseline.

## What to take for signature review

Use `MINIMAL_COPYABLE_REVISIONS.md` as a proposed amendment sheet. Retain numbering, show the limited changed items, and identify FR14 as proposed additional configuration coverage. Keep the signed original intact. Explain the scope as “the same DNSC OJT placement decision-support workflow, configurable by institute and program.” State the ranking correction separately. These drafts do not represent a new panel approval or reuse existing signatures on changed text.
