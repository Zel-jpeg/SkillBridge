# Proposed minimal revisions for adviser/panel review

Prepared 8 November 2026. This is an amendment draft, not an approved or signed replacement. Copy only the specified items into the editable master; preserve every other approved item unless the panel requests otherwise. Numbering follows the signed acceptance form. See `REVIEW_AND_CHANGE_MAP.md` for reasons, source evidence and limitations.

## Objectives

Keep Objectives 1, 2, 3 and 5 unchanged. Replace only Objective 4 to accurately describe the current method:

> 4. Develop a recommendation engine that prioritizes assessment-based category results and position requirements, with supporting NLP-assisted text similarity and location-based similarity, to match student competency profiles with eligible company-position requirements and generate ranked OJT placement recommendations.

This is a method-alignment amendment. It is not required simply because programs are configurable.

## Scope and Limitation: replace the first paragraph

> SkillBridge is a web-based OJT placement decision support system designed for deployment at Davao del Norte State College in Panabo City, Davao del Norte, Philippines, across configured institutes and academic programs. It supports three user roles: administrators, instructors, and students. Students and instructors authenticate through institutional Google accounts (@dnsc.edu.ph), while administrators use individual email-password accounts. The system consists of three main modules: (1) a skills assessment module for instructor-created questionnaires organized by configured competency categories, (2) an NLP-assisted competency profiling module that uses assessment scores and saved skill definitions to generate structured student profiles and profile texts, and (3) a recommendation module that matches student profiles with eligible company-position requirements to produce ranked placement suggestions.

Keep the approved second paragraph, including human final decisions, internal-data boundaries, single-institution deployment, integration exclusions and evaluation limitations. “Across configured institutes and academic programs” describes supported configuration, not proof of deployment or evaluation in every DNSC institute.

## Functional requirements: replace only these existing items

### FR1 - authentication

> 1. The system shall provide secure authentication and role-based access control for students, instructors, and administrators, including institutional Google OAuth for student and instructor accounts and email-password login for administrator accounts.

### FR3 - batches and enrollment

> 3. The system shall allow authorized instructors to create and manage program-based student batches, enroll students by email, and automatically create student accounts for unregistered student emails.

### FR4 - partner and position management

> 4. The system shall allow administrators and authorized instructors or OJT coordinators to manage company profiles, company locations, OJT positions, available slots, skill category requirements, and position-specific tags within their permitted scope.

### FR7 - assessment grading

> 7. The system shall allow students to answer assigned competency assessments and automatically grade submitted responses using correct answer flags for objective questions and case-insensitive text comparison after trimming leading and trailing whitespace for Identification questions.

### FR11 - recommendation generation

> 11. The system shall generate ranked OJT placement recommendations for eligible positions by prioritizing assessment-based requirement coverage and requirement-demand alignment, followed by supporting NLP-assisted text similarity and location-based similarity.

### FR12 - recommendation display

> 12. The system shall display ranked recommendations to students, including the recommended company and position, recommendation rank, requirement coverage percentage, supporting similarity information, distance information, and company location on an interactive map.

Keep FR2, FR5, FR6, FR8, FR9, FR10 and FR13 unchanged. Optional terminology note below aligns “company” with current screens without changing every approved sentence.

## Proposed additional FR14 - explicit configuration coverage

> 14. The system shall allow administrators to configure institutes and academic programs and assign instructors to programs, and allow authorized staff to manage competency categories, descriptions, and tags within their permitted institute or program scope.

FR14 documents a delivered capability not expressly enumerated in the original list. It requires review as an addition. It adds no external institution, new user role, attendance monitoring, timekeeping or employment-system integration.

## Nonfunctional requirements: replace only these items

### NFR4 - Security

> 4. Security. The system shall protect data through JWT-based authentication, role-based and assigned institute/program access control, HTTPS for all communications, API rate limiting, and domain-restricted Google OAuth for student and instructor login.

### NFR7 - Scalability (Portability/Adaptability)

> 7. Scalability (Portability/Adaptability). The system shall support the addition of configured institutes, academic programs, skill categories, companies, positions, students, and assessments without significant degradation in performance or recommendation accuracy.

Keep NFR1, NFR2, NFR3, NFR5, NFR6 and NFR8 unchanged. These remain requirements to evaluate, not claims proven by this wording review. In particular, automatic failover and maintained recommendation accuracy need their own evidence.

## Optional terminology note for the paper/design chapter

> In this study, company refers to an OJT host organization, which may be a company, office, or institution. The system interface uses the label OJT Partner for these organizations.

Keep the approved capstone title and official Institute of Computing/signature headings. Do not change the authors' degree information or rewrite historical IC research findings as results for all programs.

## Minimal related paper replacements

For the Significance of Study student-beneficiary paragraph, replace only:

- “BSIT students” with “students in participating DNSC academic programs”.
- “the respective IT areas” with “the relevant competency areas”.
- Beneficiary heading “Educational Institutions (DNSC Institute of Computing)” with “Davao del Norte State College and Participating Institutes”.

For descriptions of the current target population, “IT students” can become “students in participating programs.” Retain “IT students” when accurately describing the original interviews, historical problem setting or a cited study's participants.

## Current recommendation method: copy into methods, not the objectives list

> For program-scoped batches, the system considers active positions that are eligible for the student's program and have positive numerical requirements from the batch's recorded competency framework. It orders recommendations first by requirement coverage, then by requirement-demand alignment, and then by supporting NLP and location similarity. The supporting score combines NLP and location percentages in a 25:15 ratio. The earlier 60/25/15 category, NLP, and location score is retained as a reference measure and does not determine the current assessment-led order. Recommendation ranks and requirement coverage percentages are not probabilities of placement success. Final placement decisions remain with authorized staff.

Do not relabel October notebook results as evaluation of this updated policy. Current-method results require a comparison run of the actual current policy; cross-program effectiveness requires reviewed program content and appropriate evaluation cases.
