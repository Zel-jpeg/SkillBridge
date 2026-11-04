# DNSC program and starter competency research

Researched 4 November 2026, Asia/Manila. This supports the
[multi-institute guide](MULTI_INSTITUTE_GENERALIZATION_GUIDE.md); it does not
create configuration records or certify assessment content.

## Confirmed product decisions

The user confirmed same-program category reuse and one program per new batch.
Assigned instructors create category names, descriptions and tags. Research
provides editable starter content rather than a closed system-wide vocabulary.
Both AIKEN and SkillBridge structured text remain supported import choices.
The user subsequently confirmed IBPA as the current name. Entrepreneurship and
Tourism are test data for the generic system, not special product branches.
Existing IC data stays in the normal IC section with its current statuses. IC
will be left unused in practice because it uses InternLink; no special historical
label, read-only mode or workflow exclusion is requested. No records are deleted.

## Official DNSC website findings

DNSC's [program-offerings page](https://dnsc.edu.ph/program-offerings/) groups
undergraduate offerings under IC, IAAS, Institute of Business and Public Affairs
(IBPA), and Institute of Teacher Education (ITED). Its IBPA group includes
Entrepreneurship and Tourism Management. The page still has an image label using
the longer ILEGG name, so page assets and headings are not fully consistent.

An official [5 October 2026 news article](https://dnsc.edu.ph/samar-colleges-inc-benchmarks-dnscs-disaster-resilience-and-management-program/)
also uses Institute of Business and Public Affairs. In contrast, the official
[AY 2026–2027 calendar](https://dnsc.edu.ph/academic-calendar-2/)
uses Institute of Leadership, Entrepreneurship and Good Governance (ILEGG).
The user has confirmed IBPA as the current name. The web evidence does not
establish the formal rename date or all historical organizational mappings.
Retain historically accurate ILEGG labels; do not seed two separate institutes
or rewrite old history just to resolve the website discrepancy.

Relevant program groups from the official program-offerings page:

| Institute label on that page | Program codes listed there |
| --- | --- |
| IC | BSIS, BSIT |
| IAAS | BSAF, BSFAS, BSFT, BSMB |
| IBPA | BPA, BSCrim, BSDRM, BS ENTREP, BSSW, BSTM |
| ITED | BACOMM and BSeD majors among its offerings |

This is a researched starting inventory, not a claim of a complete approved
configuration or a list of programs with identical OJT requirements.

The separate official [programs-by-campus page](https://dnsc.edu.ph/program-offering-by-campus/)
lists Entrepreneurship (BS ENTREP) and Tourism Management (BSTM) at Panabo main
campus, alongside Food Technology (BSFT) and Marine Biology (BSMB). It lists
additional campus offerings, including Criminology at Carmen and Agro-Forestry
at Talaingod, and repeated IT offerings at other campuses. Program identity
therefore must not be inferred from a campus or institute label alone.

The same page includes Communication, secondary-education majors and Technology
and Livelihood Education, so the broader product design should not assume every
program follows the computing placement workflow. Campus support and special
education/practicum workflows need separate requirements before expansion to
them; they are not prerequisites for the first two-program local pilot.

## Confirmed testing examples

**Use Entrepreneurship (BS ENTREP) and Tourism Management (BSTM) under IBPA as
synthetic test examples.** Use synthetic existing-style IC IT/IS cases to verify
preservation and access boundaries; keep existing real IC records out of tests.

This is an engineering recommendation: these programs match the user's brief,
are listed on the official website, and have accessible domain reference material.
It is not evidence of instructor participation, readiness or adoption approval.

Demonstrate the following with synthetic identities:

1. Two Entrepreneurship instructors can reuse program categories, without
   automatically sharing private batches or student records.
2. A Tourism instructor cannot reuse or mutate Entrepreneurship-only categories
   through a guessed ID, despite belonging to the same institute.
3. Each new batch contains one program and its selected framework version.
4. An IC instructor remains outside both non-IC catalogs.
5. Adding an arbitrary third institute/program requires no hardcoded dropdown
   changes, domain-name branches or mandatory use of these starter categories.
6. Existing IC records retain statuses, memberships and normal authorized behavior
   after organizational linking, without automatic archiving or special restrictions.

Use real published names for configuration demonstrations, but synthetic users,
questions, results and opportunities. Do not import public student lists or
create real instructor accounts from web directories.

## Source-based Entrepreneurship starter content

Primary reference: [CHED CMO No. 18, s. 2017, section 6.3, page 4](https://cms-cdn.e.gov.ph/CHED/pdf/2017-CMO-NO18.pdf).
The page was visually inspected. Its outcomes cover business-opportunity
analysis, business planning, resource mobilization and responsible enterprise
management. The following are our draft knowledge-assessment adaptations,
not CHED-prescribed SkillBridge category labels or validated questions:

| Draft category | Original draft description | Context tags |
| --- | --- | --- |
| Business opportunity analysis | Interpret an enterprise opportunity using market conditions and basic feasibility evidence. | market needs, opportunity screening, feasibility |
| Business planning | Recognize how proposed customers, operations and finances fit into a coherent business plan. | business model, market plan, financial plan |
| Resource planning | Identify the people, funding, materials and operational resources a proposed venture needs. | staffing, funding, logistics |
| Responsible enterprise operations | Recognize appropriate operating decisions and responsibilities in a business scenario. | operations, governance, social responsibility |

The CMO is an identified historical reference. This review does not establish
that it is the only applicable or latest standard for DNSC's current curriculum.
Ask the program's reviewers to reconcile starter content with their actual
syllabi and OJT expectations before using it in consequential assessments.

## Source-based Tourism starter content

Primary reference: [TESDA Online Program, Front Office Services NC II](https://e-tesda.gov.ph/course/index.php?categoryid=7).
The official course summary describes reservations, computerized booking,
reception, night audit and other front-office services. Adaptations below target
knowledge questions; they do not establish TESDA certification or practical
performance. Front-office work is only one tourism-related domain.

| Draft category | Original draft description | Context tags |
| --- | --- | --- |
| Reservation procedure knowledge | Recognize the records and steps used to process a guest booking correctly. | reservations, booking records, amendments |
| Computerized booking knowledge | Interpret basic information and actions within a reservation-system scenario. | availability, reservation systems, booking updates |
| Reception procedure knowledge | Select suitable reception steps for arrival, accommodation enquiries and departure. | reception, check-in, check-out |
| Front-office account knowledge | Recognize basic records and checks used in guest accounts and end-of-day review. | cashiering, guest accounts, night audit |

Tourism curriculum references should also be checked with the instructor; do
not treat this front-office seed as a complete BSTM framework.
CHED CMO No. 62, s. 2017 was identified through the official search listing, but
its full PDF could not be inspected through the available browser fetch: the
older URL returned 403 and the government CDN copy exceeded the tool limit.
No detailed outcomes from that uninspected PDF are claimed here.

## How research becomes editable product content

Use this preparation workflow, without requiring runtime web search:

1. Start with the program's own curriculum/outcomes and official program page.
2. Consult appropriate primary competency references and relevant placement-role
   requirements; use job advertisements only as supplementary market examples.
3. Draft a manageable category set with distinct definitions and contextual tags.
4. Record source URL/title, publisher, edition/date, relevant section/page and
   date consulted. Keep wording concise and original; do not copy entire manuals.
5. Have an assigned instructor review, edit and add entries before use.
6. Map draft questions and compatible position requirements to the resulting IDs.
7. Lock/version definitions when used; retain sources and historical context.

Online material should not automatically create an active category, authorize
cross-program sharing or establish that a student mastered a tag. Instructor
judgment and scored question evidence remain separate from the source vocabulary.

An instructor can also create a new category directly without using a starter
pack. A source link is useful provenance for researched entries, not a mandatory
website field for every instructor-authored definition.

## NLP implementation implications

Current `suggest_category()` builds category text using names, descriptions and
built-in vocabulary. Current recommendation profiles and position descriptions
mainly use saved category names/tags; full definitions are not yet a general
recommendation input. This difference must be tested explicitly during the update.

The intended contract is scoped category assistance and a controlled, symmetric
use of reviewed definitions on both sides of textual matching. Definition text
describes the assessed construct, while raw/max results establish the student's
evidence. Do not generate a positive capability claim merely from text supplied
by an instructor. Numerical grading remains unchanged.

Benchmark category-name/tag inputs against the proposed description contribution
on synthetic Entrepreneurship, Tourism and IC cases. Check cross-program scope,
irrelevant long descriptions, zero evidence, ties, manual classification and
missing optional NLP resources. Version changed generated text and freshness;
the same saved historical placement must not be reinterpreted after an edit.

## Status and limits

Research and proposed starter content only. No categories were saved, no live
database was migrated and no application behavior changed. Official pages were
consulted read-only; no accounts were created and no messages were sent.

The user resolved the current naming question: use IBPA. ILEGG still occurs on
an official page and may remain in historical records. Configuration must allow
an authorized administrator to change display labels without changing stable IDs.
