# SkillBridge multi-institute generalization guide

The subsequent [coordinator catalog plan](INSTRUCTOR_PARTNER_POSITION_PLAN.md)
extends the original admin-managed catalog with instructor/OJT coordinator
partner and position creation and editing. Its F17–F19 requirements govern the
requested extension.

Prepared 4 November 2026 from the current local source on `main`, project
documentation, and the user-supplied DNSC LMS AIKEN export. This is a proposal,
not an implementation or deployment record. No application code, database,
student results or hosted services were changed for this review.

Execution follow-up: the user has now authorized implementation, tested database
migrations and sequential feature branches merged to local `main`, with no GitHub
push. The [implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md)
is the active checklist/checkpoint and supersedes earlier review-only permission
statements in this guide. Finish and test one feature before starting the next.

Clarifications confirmed by the user on 4 November:

- The product must support configurable DNSC institutes/programs. Entrepreneurship
  and Tourism are test examples, not special cases in product code or mandatory
  preloaded catalogs. IBPA is the confirmed current institute name.
- Keep IC as a normal institute section with its existing records and statuses.
  It will be left unused in practice because of InternLink, not converted to a
  special history-only/read-only mode. Add organizational relationships without
  deleting records or moving IC evidence into other programs.
- Assigned instructors create their own categories, definitions and contextual tags.
- Categories are reusable by other instructors assigned to the same program.
  Institute membership alone does not grant access to another program's catalog.
- Each newly created batch contains one program. Preserve existing mixed-program
  batches and their evidence through a reviewed compatibility path.
- AIKEN and SkillBridge structured text remain supported choices. AIKEN is the
  default text selection; the native format retains MCQ, true/false and identification.
- Research official DNSC program information and credible competency sources for
  editable starter content. See [research and pilot recommendation](DNSC_PROGRAM_AND_COMPETENCY_RESEARCH.md).

## 1. Decision and feasibility

**Generalization is feasible without rewriting SkillBridge. It is a substantial
change to organization, permissions and competency configuration, rather than a
course-dropdown update.** Keep the React/Vite frontend, Django API, existing
assessment grading, batch evidence, retakes and placement history.

The intended product is one DNSC application in which an administrator configures
institutes and their programs, assigns instructors, and oversees institute-scoped
assessment and placement workflows. Each instructor works in assigned programs
and batches. Adding another supported program should require configuration and
reviewed educational content, rather than another source-code change.

The user's deadline is before the coming weekend ends: Sunday, 8 November 2026,
Asia/Manila. Treat that as a target for a **controlled, reviewable pilot**, subject
to verification. A complete, validated school-wide product by then is not a
credible commitment. The access, migration and matching changes have dependencies
that cannot safely be reduced to renaming labels.

Recommended scope decisions:

- Support multiple institutes within DNSC first. Selling separate installations
  to other schools and building a multi-school hosted service are different scopes.
- Retain the three existing account roles: admin, instructor and student.
  Institute coordinators with delegated administration can be a later feature.
- Use one program and one competency-framework version per pilot batch.
  An institute can have any number of assigned instructors; this does not require
  multiple instructors to share the same batch.
- Retain one active OJT batch per student for the pilot. Returning students keep
  earlier batch history. Simultaneous program enrollments need separate design.
- Keep manual question creation and existing spreadsheet imports. Add AIKEN and
  make it the default text import/export option, as requested.
- Keep the system's assessment and placement decision-support scope. Do not add
  internship attendance, progress or completion tracking.

The hierarchy examples below illustrate data relationships. Official website
research is recorded separately; the user has resolved its IBPA/ILEGG naming
discrepancy in favor of IBPA. Neither the names nor the test-program content become
hardcoded product behavior.

## 2. What current code actually supports

| Area | Current evidence | Consequence for generalization |
| --- | --- | --- |
| User organization | `User.course` and `User.department` are text fields; department defaults to Institute of Computing | These are labels, not institute/program relationships or authorization boundaries |
| Enrollment | `enrollment_import.py` explicitly permits only BSIT/BSIS; `profile_validation.py` has the same restriction | DNSC account eligibility is different from supporting all DNSC programs |
| Instructor assignment | A batch has one instructor; management queries use that owner or global admin access | Several instructors can already own separate batches, but institute/program assignments do not exist |
| Student workflow | `current_enrollment()` selects the newest active enrollment | Multiple simultaneous active contexts must not be introduced accidentally |
| Skill categories | Categories, descriptions and tags are editable database content; listing and name lookup are global | Domain content is partly configurable already, but identical names can collide across institutes |
| Question authoring | Each question points to one category; authoring can resolve/create categories by name | Name-only resolution must become framework-scoped and use stable IDs |
| Assessment evidence | Individual grading and combined raw/max aggregation are batch based | Reuse these; preserve completion, integrity and retake rules |
| Generated results | Profile construction uses saved categories/tags, but `ORIENTATION_GROUPS` contains computing-oriented keyword groups | Neutral evidence text is reusable; orientation and contextual advice need generalization |
| Tag assistance | `skill_taxonomy.py` contains curated categories, roles and aliases; unknown categories have a description-based fallback | Existing vocabulary is useful seed content, not a complete catalog for other disciplines |
| Recommendation candidates | `_rank_recommendations()` loads active positions globally | Introduce explicit program eligibility before ranking and NLP corpus construction |
| Category equivalence | `canonical_context()` can pool categories with matching canonical names and saved tag sets | Matching labels/tags alone must not establish equivalence across frameworks |
| Freshness | `catalog_fingerprint()` includes a global position/category catalog | Institute separation must include the ranking corpus and its fingerprint |
| UI and communication | BSIT/BSIS options and IC defaults occur in setup, rosters, admin forms, login footers and emails | Update all callers, templates, filters and exports, rather than only the profile screen |
| Questionnaire text import | `parseTextFileContent()` expects `QUESTION:`, `CORRECT:`, `CATEGORY:` and `---` separators | The supplied AIKEN export does not match the implemented text contract |

The current personal ordering is assessment-led: numerical requirement coverage,
then demand alignment, then NLP/location support, then a stable ID. The old
60/25/15 hybrid value remains a reference field. Do not use older reference notes
or the historical weights in the audit skill to describe current list ordering.
See [the current contract](ASSESSMENT_LED_RECOMMENDATIONS.md).

This was source and document review, not an exhaustive endpoint security audit or
a runtime test of imported questions. No real student records were inspected.

## 3. Product boundaries and relationship with InternLink

Describe SkillBridge as a configurable competency-assessment and placement
decision-support product. An institute provides its approved program structure,
assessment content, competency definitions and relevant opportunities through
the product's supported configuration workflows.

That gives the product a stable contract. It does not remove the need to check
whether its supported assessment methods serve the users. For example, a tourism
instructor may need scenario questions, while laboratory or field performance
may eventually require an observed rubric that the present objective-question
engine cannot measure.

Generalization alone does not establish that any conflict with InternLink has
been resolved. Its current scope and ownership have not been examined here.
Agree with the responsible school stakeholders which system owns student
records, partner catalogs and final placement decisions, and whether SkillBridge
is a complementary assessment tool or has an authorized placement role.
Evaluation access, actual adoption and deployment are separate decisions.

File-based questionnaire exchange is enough for the requested first step. It
does not imply live LMS synchronization, gradebook exchange, shared login,
automatic enrollment or an approved integration with InternLink.

## 4. Proposed organization and data model

Use these first-class concepts instead of free-text institute names:

| Concept | Proposed fields and rules |
| --- | --- |
| Institute | Stable ID, unique code, display name and ordinary active/archive lifecycle; no special IC mode |
| Program | Stable ID, institute FK, code, name, approved import aliases, active/archive state |
| Instructor assignment | Instructor, institute, allowed programs and active state; only an admin grants assignments |
| Competency framework | Program, version, title, draft/active/retired state and reviewed competency definitions |
| Batch | Required institute/program, selected framework version, existing instructor and lifecycle fields |
| Student | Validated current program reference; existing identity and authentication remain |
| Enrollment | Batch and student, plus the program context needed to preserve historical interpretation |
| Skill category | Framework reference, stable competency code, name, definition, contextual tags and lifecycle/version rules |
| Position eligibility | Explicit allowed programs for each shared OJT position |

The institute of a program must agree with the institute of its batch and the
instructor's assignment. Do not accept incompatible IDs just because each exists.
Where institute is stored alongside program, enforce agreement centrally; do not
let those fields become independent sources of truth.

This proposal introduces at least four main concepts—Institute, Program,
InstructorAssignment and CompetencyFramework—and relationship tables for program
assignments and opportunity eligibility. The exact table/column count must follow
the schema design, not a premature promise that this needs only two new fields.
Existing `Batch`, `User`, `SkillCategory` and related contracts will also change.

Keep one batch owner in the first version. If co-teaching is later requested,
add an explicit batch-staff relationship and permissions then. Institute
membership alone must never grant access to every colleague's batches.

Example configuration:

```text
DNSC
  IC [existing institute section, retained as is]
    IT/IS -> existing users, batches, assessments, results and decision history
  IBPA [test configuration example]
    Entrepreneurship -> assigned instructor -> batch -> framework v1
    Tourism           -> assigned instructor -> batch -> framework v1
  Any other configured institute [examples only]
    Food Technology   -> assigned instructor -> batch -> framework v1
    Marine Biology    -> assigned instructor -> batch -> framework v1
```

This is one application with contextual data, not a separate hardcoded dashboard
implementation for every institute.

### Keep existing records in the IC section

"Transfer" means attach existing records to the new institute/program structure
with reviewed mappings. Keep record IDs and relationships; do not move IC students
or their assessment evidence into Entrepreneurship, Tourism or another institute.
Existing mixed IT/IS batches remain as they are through a compatibility path.
One-program validation applies to newly created batches.

The user clarified that IC should still appear and behave as a normal institute
section. Its data will be left unused in practice, but there is no requested
historical label, automatic archive, read-only conversion, disabled account or
IC-specific restriction on normal workflows. The earlier proposed history-only
mode and its special enrollment/attempt/rerun/allocation exclusions are withdrawn.

Preserve accounts, memberships, questions, responses, attempt states, raw/max
scores, profiles, recommendations, decisions, reports and audit records with
their current statuses. Keep normal role/program/batch access boundaries and
existing capacity rules. Do not move evidence to another institute, reset
attempts, release slots or rewrite saved results merely to add institute/program
relationships. No special `if code == 'IC'` behavior is needed.

The addition of organization fields is not an instruction to run assessments,
recalculate real results, send notices or perform a live migration. No record
has been archived, transferred, disabled or otherwise changed by this guide.

## 5. Access rules that must precede a pilot

| Actor | Allowed scope | Required restriction |
| --- | --- | --- |
| Admin | Configure institutes/programs, grant instructor assignments, oversee all authorized DNSC workflows | Preserve content locks, audit actors, history and assessment integrity |
| Instructor | Assigned programs; owned batches, students and assessments; create categories/descriptions/tags and reuse the same program's catalog | Cannot assign themselves to a program, edit another author's definitions without authority, or access a colleague's private batch |
| Student | Own active enrollment, assigned assessments, own released results/history and eligible visible opportunities | Cannot change program to gain access, fetch answer keys or view another student's data |

Apply these rules on list/detail/mutation endpoints and derived data. Include
rosters, reports, downloads, retake evidence images, analytics, search counts,
notifications, SSE recipients, cached responses and recommendation reruns.
Filtering the frontend alone is insufficient.

When staff switch program context, include the authorized context in query/cache
keys and clear incompatible selections. Revalidate assignment changes server-side;
a stale token or open browser tab must not preserve revoked access. Export jobs
must recheck current access before providing their result.

A student should select only an eligible configured program during initial setup,
or confirm the program assigned through enrollment. A later program transfer is
a reviewed administrative action; historical records retain their former context.

## 6. Skill categories and tags: the central design

Keep categories as the scored unit in the first release. Tags describe the
category's vocabulary; they are not separately measured skills.

| Layer | Example | Meaning |
| --- | --- | --- |
| Institute/program | A tourism program | Organizational context |
| Framework/version | Tourism OJT knowledge framework v1 | Approved definition set for a cohort |
| Scored competency | Guest-service knowledge | A defined assessed area with mapped questions |
| Context tags | complaint handling, reservation records | Search/NLP vocabulary associated with that area |
| Question | A scenario with one keyed answer | Evidence for its assigned competency |
| Position requirement | Guest-service knowledge minimum of 75% | A reviewed numerical requirement; illustrative value only |

The same principle works for programming concepts, business costing knowledge,
food-safety knowledge or marine sampling knowledge. These examples are starting
points for domain reviewers, not ready-to-use validated questionnaires.

Recommended workflow:

1. An assigned instructor creates categories with names, meaningful descriptions,
   observable knowledge outcomes and contextual tags in their program context.
2. Same-program instructors can reuse those categories. As a proposed editing
   default, the creator/admin can edit unused definitions; other instructors can
   reuse or copy them. Used definitions require versioning rather than silent edits.
   A mandatory admin approval step is not a user requirement. Academic review can
   be recorded without making the software admin the subject-content approver.
3. Questions and position requirements reference those exact category IDs.
4. Batches select the reviewed framework version. Unmapped draft questions can
   remain drafts; publication requires valid in-scope category mappings.
5. Once used, preserve definitions and evidence. Substantive revisions produce
   a new framework/category version; retire old definitions instead of deleting
   referenced evidence.

For the weekend version, this can be a small reviewed v1 framework per pilot
program with edits locked once used. A sophisticated approval dashboard and
framework-copy library are later improvements.

Descriptions must be part of the deliberate NLP design. Current question-category
assistance includes `cat.description`, while recommendation profile/position text
mainly uses category names and saved tags. Merely making descriptions editable
does not make the recommendation pipeline consume them.

Use concise, reviewed definitions for category assistance and evaluate a bounded,
symmetric definition contribution to student/position text. Derive student text
from categories actually assessed, with their scores; opportunity requirements
use those same category identities and definitions. Do not insert an expected
job title or target answer into the student narrative. Keep numerical grading
unchanged, version text generation/freshness when inputs change, and compare
before/after behavior on synthetic cross-program cases. Long copied descriptions
must not overwhelm assessed evidence merely by adding more words.

Online research supplies optional starter categories, descriptions and tags.
Store source title/URL, publisher, edition or date, and relevant section with the
draft content or its source record. Instructors review, adapt, add and replace
these entries. Do not require live web access during authoring or automatically
overwrite saved categories when a source website changes. Research is content
preparation, not a prerequisite to add any future program.

Important rules:

- Permit duplicate category display names in different frameworks. Resolve them
  by framework and ID, not a global `name__iexact` query.
- Change equivalence/pooling so matching names and tags in separate frameworks
  cannot silently combine evidence. Default to no cross-framework equivalence.
- Copying a generic category does not prove that two programs assess the same
  construct at the same level. Explicitly reviewed equivalence is a later feature.
- Keep manual tag entry. Suggestions use saved, authorized category content first
  and must abstain when insufficient. Hardcoded IC vocabulary becomes optional
  seed assistance rather than an authority over every program.
- Store enough category/framework context in historical exports and snapshots
  that future edits cannot reinterpret earlier results.

Do not create every skill tag for every DNSC program before starting. Build the
configuration mechanism and a reviewed pilot catalog. Each new program must
supply relevant content before it can yield meaningful recommendations.

## 7. Assessment and result rules to preserve

Reuse MCQ, true/false and identification grading. There is no need to introduce
essays, practical rubrics, AI grading, question-level tag mastery or a new NLP
model to generalize objective assessments.

Keep individual assessment score history distinct from combined competency.
For a category, combined percentage remains:

```text
100 * sum(eligible raw points) / sum(eligible maximum points)
```

For example, 8/10 and 2/5 combine to 10/15 = 66.67%, not 60%. More questions
therefore contribute more to the combined denominator. The program blueprint
must intentionally allocate question coverage; do not quietly introduce equal
assessment weights while generalizing.

Retain timing snapshots, question locks after use, interrupted-attempt recovery,
integrity exclusions, required completion, retake history and active-batch gates.
Only the authorized program/framework evidence belongs in the combined profile.

Replace computing orientation groups with a neutral result template first:

> In this assessment, Guest-service knowledge scored 16/20 (80%).

Use assessed category names and scores for strengths/development guidance. Avoid
asserting that contextual tags were individually mastered or that a knowledge
quiz proves practical performance. A program-specific orientation label can be
added later as reviewed configuration, with a neutral fallback.

Keep existing score-band thresholds initially and document them. Arbitrary
per-program grading formulas or threshold editors add validation and historical
versioning work; they are outside the weekend scope.

## 8. Opportunities, recommendations and shared slots

Generalizing assessments does not automatically generalize placement matching.
Each pilot program needs relevant positions and requirements using its approved
framework. Otherwise show an honest no-eligible-opportunities state while retaining
valid assessment results.

Recommended catalog contract:

- Keep a shared partner organization record under admin management.
- Assign each position explicit eligible programs. A blank eligibility list means
  unavailable for automated matching, rather than implicitly open to everyone.
- Let staff manage only their authorized program requirements; shared opportunity
  edits and eligibility changes remain admin-controlled in the first version.
- A position genuinely shared across programs has one actual capacity. Do not
  duplicate it per institute and accidentally multiply its available slots.
- For the initial version, use program-specific positions where requirements
  differ. A shared position may use explicitly common reviewed competencies;
  do not pretend one flat requirement list expresses alternative program rubrics.
  Program-specific requirement variants need an explicit later design.

Matching sequence:

1. Resolve the student's active batch, program and framework version.
2. Apply current completion, integrity, evidence and profile-confirmation gates.
3. Build only the eligible opportunity set and compatible requirement categories.
4. Pool only valid, explicitly compatible category evidence.
5. Apply the existing assessment-led numerical ordering to these candidates.
6. Compute supporting NLP/location against this same candidate corpus.
7. Save rank, policy/input provenance and relevant version context.
8. Apply existing coordinator authorization, capacity and freshness checks before
   any approval; recommendation rank does not automatically approve a placement.

The demand-alignment rule is currently experimental; adding programs does not
validate it academically. Preserve it for initial engineering scope, then evaluate
it on the new disciplines before claiming suitability benefits.

Freshness must include program eligibility, framework/category version, relevant
candidate requirements, model and text-policy versions, and location inputs.
An unrelated Tourism catalog edit should not stale IT recommendations unless
it changes their actual shared candidate inputs. Conversely, removing IT
eligibility must hide stale suggestions immediately and block their use for a
new approval. Shared capacity changes still reconcile globally even when they
do not alter similarity scores.

Do not globally rank students from different programs by percentages from
different questionnaires. An 85% in one construct is not automatically comparable
to an 85% in another. Shared allocation must use compatible required evidence
and one capacity authority, not independent institute runs that overbook slots.

## 9. AIKEN as the default: exact comparison and proposed behavior

The user confirmed that `Sample AIKEN format for LMS upload.txt` is an actual
DNSC LMS export. It contains 20 question blocks, each with a question, four
lettered choices and one `ANSWER:` key. It has no SkillBridge categories or tags.
The sample establishes this export shape; it does not identify the LMS vendor,
all supported export types, or full round-trip compatibility.

Example using synthetic content:

```text
Which document records a confirmed reservation?
A. A reservation record
B. A network routing table
C. A laboratory equipment log
D. A source-code commit
ANSWER: A
```

Standard AIKEN uses a single-line stem, uppercase lettered choices with `.` or
`)`, and an uppercase `ANSWER: ` key. UTF-8 is the appropriate text encoding.
It is an MCQ exchange format and supplies no SkillBridge competency mapping.
See [Moodle's AIKEN specification](https://docs.moodle.org/en/Aiken_format).
This is a format reference, not evidence that DNSC uses Moodle.

| Need | Proposed policy |
| --- | --- |
| Default `.txt` format | AIKEN in new and existing assessment authoring for both staff roles |
| Existing formats | Keep Excel/CSV and offer SkillBridge structured text as a fully supported alternative |
| Internal representation | Parse all formats into the same draft question structure, then apply the same server validation |
| Missing categories | Offer bulk assignment to a selected framework category and per-question corrections |
| Mixed competency file | Review/multi-select groups of questions and map each group; never assume the whole file has one skill |
| Question types | Import AIKEN as single-answer MCQ; a two-choice True/False-looking item remains MCQ unless deliberately converted |
| Identification | Preserve native/manual/spreadsheet support; do not pretend AIKEN represents a free-text answer |
| More than four options | Reject clearly in the initial adapter because current authoring assumes A–D; never truncate valid AIKEN silently |
| Invalid question/key | Show question/line-specific errors; do not shift keys or silently discard questions |
| Unresolved mapping | Allow a draft if supported; block publication until every question has an approved in-scope category |
| Unsupported content | Report images, rich content or unsupported structures rather than flattening them without review |

Default import experience:

1. Select program batch and its framework.
2. Choose Import questions; AIKEN is preselected for text files.
3. Parse locally for preview, reporting total/valid/invalid/unmapped counts.
4. Display exact stems, options and keys to the authorized author.
5. Assign competencies in bulk or individually; optional suggestions require
   explicit acceptance and can be ignored.
6. Stage selected valid questions in the authoring draft. Invalid questions stay
   visible with errors; excluding them requires an explicit reviewed selection.
7. Save using the existing draft/save boundary and authoritative backend checks.
   Cancel or failed requests must not partially publish the import.

Categories are educational metadata added inside SkillBridge after import.
Do not modify standard AIKEN by injecting `CATEGORY:` lines and still label the
file LMS-compatible AIKEN.

Export policy:

- AIKEN is the default question-text export for supported MCQs.
- Report how many questions can be exported and which cannot. A mixed assessment
  requires explicit selection of the supported subset; do not silently omit items.
- Preserve question/choice order and regenerate keys from the selected correct
  choice. Do not accidentally export randomized student answer positions.
- Categories, framework versions, schedules, results and student records are not
  round-tripped through standard AIKEN. Preserve metadata in a separate supported
  native export if needed; never claim AIKEN is a full system backup.
- Export with answer keys is a staff authoring operation protected by the same
  batch/program ownership checks. Student downloads must not expose keys.
- Verify SkillBridge export back in a permitted DNSC LMS test question bank before
  claiming bidirectional interoperability. The supplied export proves only the
  source file shape, not that reverse direction.

If richer exchange is later needed and DNSC's LMS supports it, investigate GIFT
or Moodle XML using actual exports. GIFT represents more question types; Moodle
XML can carry categories, tags and additional question details. Neither an LMS
question-bank category nor its keyword tags automatically equals a SkillBridge
assessed competency. Sources: [GIFT](https://docs.moodle.org/en/GIFT_format),
[Moodle XML](https://docs.moodle.org/en/Moodle_XML_format).

The five-minute LMS video is optional help, not a prerequisite to use SkillBridge.
Add an inline example, downloadable synthetic sample, short import steps and
clear error messages. Manual authors should be able to use the existing question
builder without learning AIKEN syntax.

## 10. Sixteen update workstreams

These are workstreams, not sixteen small edits or an exact file count.

| # | Workstream | Required result | Weekend treatment |
| --- | --- | --- | --- |
| 1 | Institute/program configuration | Admin-managed records and program aliases | Essential |
| 2 | Instructor assignments and authorization | Program assignments plus server-enforced object scopes | Essential; no delegated institute-admin role |
| 3 | Batch/enrollment context | Program/framework-bound batches and validated enrollment | Essential; one owner/program per batch |
| 4 | Profiles and onboarding | Dynamic options, no BSIT/BSIS-only validation, reviewed program changes | Essential |
| 5 | Competency frameworks | Scoped definitions, stable IDs and fixed used versions | Essential; a small v1 catalog |
| 6 | Category content and tag assistance | Instructor-authored definitions/tags, sourced starter content, same-program reuse and scoped suggestions | Manual path essential; advanced assistance later |
| 7 | Assessment authoring | Valid framework mappings, retained locks, timing and completion rules | Essential |
| 8 | Neutral result descriptions | Evidence-based category summaries and no unsupported orientation | Essential; custom narratives later |
| 9 | Opportunity eligibility/capacity | Program eligibility and shared slot accounting | Essential for placement pilot |
| 10 | Recommendations and freshness | Compatible categories/corpus, scoped provenance and retained history | Essential for placement pilot |
| 11 | AIKEN import | Default adapter, errors, category mapping and staged save | Essential |
| 12 | Questionnaire export | Explicit AIKEN support/loss handling and protected keys | Implement supported MCQ subset; actual LMS reverse test required for claim |
| 13 | Reports and derived access | Correct scopes in analytics, exports, counts, SSE, notifications and caches | Access correctness essential; new institute comparisons later |
| 14 | Migration and compatibility | Reviewed backfill, unchanged historical evidence and rehearsed restore | Essential before real-data use |
| 15 | Guidance and research documents | Updated labels, templates, help, scope and diagrams | Essential brief; extended materials later |
| 16 | Validation and pilot | Cross-institute denial tests, workflow checks and domain review | Essential; school-wide release later |

## 11. Weekend sequence and release gates

The following is a dependency order, not a promise that all of it fits four days.
Reserve the final day for verification and repair; adding a feature late must not
remove the access or history checks. Estimates depend on the available developer
time, content readiness and defects found.

| Window | Work | Exit condition |
| --- | --- | --- |
| Wednesday 4 November | Freeze pilot scope; settle schema/access rules; record baseline; prepare synthetic existing-IC cases plus configurable non-IC test contexts | One written model/access contract and an isolated test environment |
| Thursday 5 November | Institutes/programs/assignments, batch/enrollment/profile contracts, scoped categories and API authorization | Cross-institute and colleague-batch access is denied directly by the API |
| Friday 6 November | Framework mappings, neutral evidence text, eligible opportunities, corpus/freshness/equivalence changes and allocation guards | Both institutes can complete independent assessment-to-result workflows without leakage |
| Saturday 7 November | AIKEN import/export, category mapping, dynamic UI/labels, documentation and migration rehearsal | The actual supplied file imports all 20 questions correctly into a draft after reviewed mappings; old formats still work |
| Sunday 8 November | Full focused regression, frontend checks, browser journeys, history comparison and pilot handoff | Required gates pass and limitations are recorded; otherwise retain a local demonstration |

If this schedule slips, reduce the demonstration claim, not the permission
checks. A useful fallback is a synthetic local institute/program/assessment
prototype with AIKEN support. Keep new-program placement suggestions disabled
until opportunity eligibility, compatible requirements, freshness and shared
capacity have all been verified. Label that fallback as an assessment pilot,
not a completed multi-institute placement product.

For broader planning, a polished release across these sixteen workstreams should
be budgeted in weeks. A provisional engineering allowance is approximately
6–10 full-time developer weeks, with additional time for domain content review,
institutional decisions and unexpected migration issues. This is a judgment
estimate, not a measured quote. Re-estimate after the schema/access work and the
first end-to-end second-institute journey. The weekend pilot is a narrower target.

Defer co-teaching, multi-school hosting, per-program grading formula builders,
arbitrary profile field builders, essay/practical grading, automatic taxonomy
generation, new NLP training, LMS API sync and replacement of InternLink.

## 12. Migration and history preservation

Use an additive, reviewed migration sequence:

1. Inventory legacy users, instructor labels, batches, categories, requirements,
   active enrollment, profiles and saved placement/report snapshots. Use counts
   and synthetic examples in documentation, never personal records.
2. Add organization/framework relationships initially in a compatible state.
   Link existing IC/IT/IS records to the normal IC institute/program structure.
   Keep their current statuses and memberships; do not reassign those records
   to the example programs or introduce a special IC lifecycle state.
3. Map known aliases explicitly. Put ambiguous department/course labels and
   shared categories into a review queue; never assign every old row to IC simply
   because a historical default says Institute of Computing.
4. Establish a reviewed legacy framework. Preserve existing category/score IDs
   where possible. If categories must be copied, keep a mapping and retain
   historical references rather than silently repointing or merging scores.
5. Backfill batch/program context with validation and reviewed exceptions.
   Preserve former enrollment/program labels in historical snapshots.
6. Compare grades, raw/max totals, attempt history, recommendation reference
   components, approved decisions and archived reports before/after.
7. Deploy compatible readers/writers before enforcing non-null constraints and
   removing obsolete text-field assumptions. Rehearse on an isolated copy first.
8. Version changed matching/text inputs and mark affected current suggestions
   stale under the normal rules. Refresh only through a deliberate authorized
   action after the serving code supports the new policy. Adding organization
   relationships alone must not trigger a real-record rerun or an IC-specific
   exclusion. Students should not need to retake valid assessments.

Do not infer a batch's program solely from its name or instructor. Existing
batches may contain both IT and IS students. Retain a documented existing-batch
compatibility path with original statuses, memberships and evidence. A split or student
transfer is not needed merely to meet the new structure. Never force all students
into one program to satisfy a new non-null field. New operational batches are
single-program.

Do not delete used institutes/programs/categories or cascade removal through
student history. Archive configuration and block incompatible new writes instead.
Backup/restore rehearsal and a compatible code rollback plan are required before
real-data migration. This guide does not authorize migration or deployment.

## 13. Required verification

| Scenario | Expected evidence |
| --- | --- |
| IC instructor requests another institute's batch/detail/report/retake image | Denied by API, including guessed IDs and exports |
| Instructor requests a colleague's private batch in the same institute | Denied unless explicitly assigned under an implemented sharing rule |
| Instructor submits a foreign program/category/position ID | Validation rejects it; no partial records |
| Admin adds another program after the pilot configuration | Program appears in authorized selectors and validates without source edits |
| User assignment is revoked during an open session | Subsequent requests/downloads/events follow current authorization |
| Student changes the program field to obtain a different assessment | Rejected or routed through reviewed transfer; earlier history unchanged |
| Same category names/tags occur in different frameworks | No accidental pooling, requirement matching or import resolution |
| Two assessments have different category question counts | Combined raw/max percentage remains correct |
| Retake, stopped/flagged attempt, deadline or archived batch | Existing eligibility/history behavior remains correct |
| Tourism content is added with no shared IT candidate inputs | IT corpus/fingerprint/rank remains unchanged |
| Position eligibility or active framework changes | Affected suggestions become stale; valid grades remain visible |
| Two institutes approve the last shared slot concurrently | Capacity cannot be exceeded; history and actor are recorded |
| Program lacks approved content or relevant opportunities | Clear setup/no-opportunity state; no invented competency or forced match |
| Supplied LMS file | 20 stems, all options and correct keys preserved; category mapping required before publication |
| AIKEN variation/error | CRLF/LF, BOM, Unicode, `A.`/`A)`, missing/wrong key, duplicate letters and >4 options have explicit outcomes |
| Import cancellation/save failure | Draft behavior is preserved; no partial publication or stale asynchronous preview |
| AIKEN export | Keys/order survive supported MCQ round trip; unsupported items disclosed; metadata loss explained |
| Previous spreadsheet/text formats | Existing numeric zero, Boolean false and identification behavior retained |
| Migration rehearsal | Historical grades, attempts, placements and archive snapshots reconcile |
| Existing IC institute section | Original statuses, records, memberships and normal authorized workflows remain; no automatic archive, history-only label or IC-specific restriction |
| Arbitrary configured institute/program | A third synthetic institute/program works through the same APIs/UI without Entrepreneurship, Tourism or IC name/code branches |

Run the relevant existing backend tests plus new authorization, framework,
eligibility, migration and interchange tests on a local/dedicated PostgreSQL
database. Run frontend tests, `npm run lint` and `npm run build`, then browser
journeys for admin, instructors from different institutes and students on phone
and desktop layouts. Do not reuse production credentials for test databases.

A useful synthetic demonstration includes existing-style IC IT/IS records, IBPA with
Entrepreneurship/Tourism as test data, separate instructors/batches/frameworks,
and an arbitrary additional institute/program created through configuration.
Use a genuinely shared operational opportunity to exercise capacity. No IC real
records become test fixtures. Domain effectiveness still needs subject reviewers.

Software correctness does not validate questionnaires, practical competency,
fairness or recommendation accuracy. Pilot review should distinguish usability,
assessment content validity and recommendation relevance. Existing computing
evaluation fixtures do not establish effectiveness in other disciplines.

## 14. Documentation and decisions to finish

Update the project overview, ERD/data-flow diagrams, role/access contract,
enrollment guide, competency/tag definitions, import/export guide, result wording,
recommendation contract and evaluation scope alongside implementation. Remove
hardcoded IC copy from product screens, emails and templates while retaining
historically accurate archived records.

Before committing the first schema, settle these items with the project owner:

- Entrepreneurship and Tourism are confirmed test examples, not program-specific
  product requirements. Confirm real content reviewers before representing starter
  material as an approved assessment.
- IBPA is confirmed by the user; names/import aliases remain configurable, and
  historically accurate ILEGG labels are retained in existing records.
- Whether instructors own separate batches as proposed; shared batch management
  is not assumed from having several instructors in one institute.
- Who owns the final placement decision and shared opportunity catalog alongside
  InternLink. A technical plan cannot settle institutional ownership.
- The authorized environment for pilot evaluation. Weekend demonstration and
  school-wide deployment are different acceptance milestones.

IC is expected to be left unused in practice, while remaining a normal institute
section in the system. Linking its existing data to organization fields does not
authorize a live migration, status change, result rewrite or data removal.

The LMS export shape and default-format decision are already supplied by the
user: accept AIKEN and make it the default text format. No LMS vendor identification
or video transcription is required to begin that adapter.

## 15. Review evidence and current status

Primary local entry points:

- [Models](../skillbridge-backend/api/models.py),
  [management access](../skillbridge-backend/api/management_access.py),
  [views](../skillbridge-backend/api/views.py),
  [enrollment validation](../skillbridge-backend/api/enrollment_import.py),
  [profile validation](../skillbridge-backend/api/profile_validation.py).
- [Authoring](../skillbridge-backend/api/assessment_authoring.py),
  [assessment progress](../skillbridge-backend/api/assessment_progress.py),
  [combined competency](../skillbridge-backend/api/combined_competency.py),
  [text parser](../skillbridge-frontend/src/hooks/instructor/useInstructorUpload.js).
- [Scoring/candidates](../skillbridge-backend/api/scoring.py),
  [recommendation policy](../skillbridge-backend/api/recommendation_policy.py),
  [freshness](../skillbridge-backend/api/recommendation_freshness.py),
  [NLP/text generation](../skillbridge-backend/api/recommendation_nlp.py),
  [taxonomy](../skillbridge-backend/api/skill_taxonomy.py),
  [placement scope](../skillbridge-backend/api/placement_scope.py).
- [Accepted import contract](QUESTION_IMPORT_FORMAT.md),
  [IAMS enrollment](IAMS_ENROLLMENT_IMPORT.md),
  [question assistance](QUESTION_ASSISTANCE.md),
  [result interpretation](ASSESSMENT_RESULT_PRESENTATION.md),
  [current recommendation contract](ASSESSMENT_LED_RECOMMENDATIONS.md).

The attached file was read as sample questionnaire data, not as instructions.
Its content was not treated as a validated placement assessment.

Status at preparation: guide and documentation cross-references only. No
implementation, migrations, regrading, recommendation reruns, email delivery,
deployment or external messages were performed. Application tests/builds are
not required for this documentation-only review and were not run. Documentation
links and diff checks are the applicable verification.
