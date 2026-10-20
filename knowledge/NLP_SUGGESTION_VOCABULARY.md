# Existing-file suggestion vocabulary

**Current:restored20 October2026 at the user's explicit request,with the position
relevance fix retained.**35 category/33 role vocabulary is active. Network Specialist
aliases and generic Tools fallback exclusion remain. Earlier comparison rollbacks
are superseded. No database catalog,annotation feature or matching pilot restored.
See [general suggestion design proposal](POSITION_SUGGESTION_DESIGN.md) for verified
hard-coded/database precedence and a broader,not-yet-implemented solution.

Combined restoration verification:46 focused tests and308/308 full PostgreSQL tests
pass,zero skips; both real local browser suites pass(7 workflow groups),zero page
errors. Django check/no migration drift pass. Existing frontend app is unchanged;
prior178 frontend tests/lint/build remain applicable.48 unrelated files preserved.

20 October 2026. New bounded work authorized after the NLP experiment rollback.
This expands existing authoring suggestions; it does not restore the removed
catalog tables, duties/tools UI, question annotations or matching pilot.

## Coverage and existing screens

The Python vocabulary now includes video editing, image/photo editing, photography,
videography, graphic design, audio editing, animation and multimedia production;
accounting/bookkeeping, spreadsheet skills, office work, data entry, records and
inventory; additional software, mobile, documentation and support roles.
Coverage expands from14 to35 category lists and8 to33 role lists, with61 separate
category aliases for suggestions. These are source definitions, not new database
categories or automatically saved company requirements.

- Admin **Skill Taxonomy > Add/Edit Skill > Suggest/Refresh Tags** uses category
  names/aliases and returns editable vocabulary. A new assessment category still
  needs to be created through that existing screen; no categories are auto-added.
- Admin **Companies > Add/Edit Position > Suggest/Refresh Tags** recognizes role
  title phrases, variants and explicit compound titles. Examples include Video &
  Photo Editor Intern, LGU Database Encoder & Administrator, and Help Desk Technician.
- Instructor question authoring can suggest the existing media/office categories
  from question vocabulary. Staff explicitly accept a category; grading still uses
  the original answer-key rules. Missing categories are never fabricated/created.

Suggested tags are possible vocabulary, not verified company duties, required
software or evidence of student mastery. New role lists use task vocabulary rather
than assuming a particular commercial tool. Staff can add their own software tags.
Unknown/ambiguous titles such as Editor, Assistant or Encoder abstain unless numeric
requirements supply context, as before. Whole-word phrase matching avoids accidental
matches inside unrelated titles. Compound media roles may include both tag lists.

## Boundaries

Original14 category lists,8 role lists and matching-text ALIASES remain unchanged.
Broader SUGGESTION_CATEGORY_ALIASES are used only for tag/question assistance.
Existing matching-text normalization, neutral-evidence-v3 sentence templates,
preprocessing/model configuration, ranking formula60/25/15, eligibility and placement
rules are unchanged. New question keywords are a fallback after original keyword sets.

Saved tags and descriptions are never bulk-updated. New vocabulary enters generated
descriptions when staff explicitly save corresponding tags through the existing
workflow. As with any saved input change, later matching may differ. This work makes
no claim of improved recommendation accuracy and generates no live recommendations.

No schema changes, migrations, added packages, AI service calls, model downloads,
Supabase access or deployment. Future vocabulary maintenance is a source-code edit;
admins can continue manually editing saved tags through existing screens.

## Verification

Baseline31 focused tests pass. New focused suite39 passes, including real scoped
suggestion APIs, no INSERT/UPDATE/DELETE statements, saved tags unchanged until
explicit save, separate media vocabulary, mixed roles, substring/unknown abstention,
alias targets and tag limits.96 synthetic saved-input student/position description
and insight examples remain identical before/after expansion. These are behavior
checks, not independently labeled placement effectiveness results.

Full PostgreSQL regression301/301 passed, zero skips; frontend178/178, lint/build,
Django check and no migration drift passed. Three real Chrome workflow groups
passed against the actual local Django API on migrated synthetic in-memory SQLite:
category suggestions/custom tag save, mixed media position suggestions/unknown
abstention/saved-description text, and instructor category accept/save/student403.
Zero browser page errors; external requests blocked, SSE transport intercepted.
Desktop/mobile screenshots inspected. These checks do not claim live hosting,
external map availability or improved matching effectiveness.

An aggregate SQLite run hit shared throttle buckets(50 failures/10 errors,12 skips).
The unchanged production throttles were retained; the complete PostgreSQL suite
then passed. Focused SQLite39 also passed. New browser-fixture issues were scoped
button selection and an unenrolled student authenticating as401 before reaching
role authorization; a complete/enrolled fixture now verifies the existing403 gate.
No score/permission/assertion expectations were weakened.

All task-owned servers are stopped after verification. See
[checkpoint](NLP_IMPLEMENTATION_CHECKPOINT.md) for the final record.
Logs: ignored work/defense_audit/vocabulary-*.
