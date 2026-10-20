# General position suggestion design proposal

20 October2026. Requested after the Networking/Tools defect. This is a proposal,
not implemented behavior or authorization to change matching/production data.
The user separately authorized restoring expanded existing-file vocabulary; that
restoration retains the generic Tools exclusion and network-title fix.
Restoration verified with46 focused tests,308/308 PostgreSQL and7 real local browser
workflow groups. These verify current restored behavior,not the proposed changes.

## Verified current data flow

Admin Add/Edit Position and instructor company-position edit send title plus
positive required-category percentages to POST /api/tags/suggest/. Backend validates
the categories and retrieves each category's saved tags from SkillCategory.

1. Recognized title/alias: returns matching hard-coded ROLE_TAGS and stops. In this
   branch,selected requirements do not filter or enrich the returned role list.
2. Unrecognized title: removes generic Tools,selects up to2 strongest specific
   requirements,then uses saved database category.tags if nonempty. Otherwise it
   looks up hard-coded SKILL_TAGS through suggestion-only category aliases.
3. It takes up to4 nongeneric tags per category and deduplicates/caps the result.
4. The browser replaces the current draft tag string. Only explicit editor save
   persists it. Existing position tags are not passed as input to suggestion API.

Thus both Python vocabulary and database taxonomy are used. They are not synced:
expanding Python defaults does not overwrite nonempty saved category tags. There
is no inference of actual company duties or actual applications in this pipeline.

## Problems that apply across roles

- A category such as Tools spans multiple activities; its product names are not
  requirements for every position that selects that category.
- Even a specific category such as Programming contains alternative languages;
  selecting it cannot establish that all languages/products are required.
- Recognized titles currently ignore conflicting or missing selected requirements.
- Unknown/compound titles and equally weighted requirements can be underspecified.
- More catalog entries do not solve broad/misclassified/stale database tags.
- Draft replacement may remove deliberately selected/custom tags and hide origins.

## Proposed consistent rule set

Use one pipeline for every role rather than separate title-wins/fallback-wins lists:

1. Build candidates from recognized role aliases and selected category vocabulary.
   Attach origin,category,role and kind to each candidate. Use source-file metadata
   on the existing catalog; no new tables are necessary. Distinguish general work
   concepts from particular products or techniques that need company confirmation.
2. Use selected specific categories as context. Compare role/category compatibility
   through explicit metadata,not substring overlap or similarity to the title alone.
   A video title with only networking requirements should show a mismatch for staff
   review,not silently return unrelated tags or infer a new requirement.
3. Keep broad categories from automatically contributing product names. Even for
   specific categories,a product such as React,Photoshop,Postman or Cisco tooling
   remains an optional candidate until staff confirms actual use. A high required
   percentage measures category level,not certainty about individual technologies.
4. Show role-related suggestions,category-context suggestions,and manually entered
   company tools separately with short origin labels. Do not call them confirmed
   requirements/duties just because a title or category matches.
5. Explicit Add/Remove selection preserves existing saved/custom tags. Refresh
   recalculates available suggestions without replacing selected entries. Flag
   possible mismatches for review rather than silently deleting existing tags.
6. Return no automatic role claims for unknown/ambiguous titles. Staff can select
   relevant general category concepts or enter exact company work/tools manually.
7. Only confirmed selected tags pass into the existing save/description workflow.
   Keep numeric requirements and assessment evidence separate from textual overlap;
   no inferred subskill mastery,score inflation or expected placement in profiles.

## Required comparisons before a later implementation

Cover every catalog role and aliases,unmapped/new categories,custom database tags,
broad Tools only,role/category conflicts,compound/multidisciplinary titles,zero
requirements,equal requirements,duplicate tags,retired/custom tags and refresh after
manual edits. Assert that no unconfirmed products enter saved position tags. Test
admin/instructor scopes,validation,save/cancel/failure and delayed response handling.
Keep original ranking/model/weights untouched. Wider suggestion coverage is not
independent evidence of improved recommendation accuracy. No bulk tag replacement,
automatic requirement changes or live regeneration belongs to this proposal.
