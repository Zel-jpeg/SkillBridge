# Position tag relevance fix

Current update20 October:user restored expanded35/33 vocabulary while keeping this
fix. Earlier original14/8 statements below describe the fix's initial base. See
[general design proposal](POSITION_SUGGESTION_DESIGN.md) for remaining cross-role
issues; the proposal itself is not implemented.

20 October2026. User reported IT Network Specialist Intern with Networking75 and
Tools75 returning TCP/IP,routing,switching,subnetting,VS Code,Postman,Figma,Jira.
Reproduced exactly using the original helper. The rolled-back expanded vocabulary
had not changed the generic Tools fallback,so switching versions did not fix it.

## Cause and bounded correction

Title was unrecognized; fallback copied up to4 tags from each of the2 strongest
requirements. Tools is a broad category containing products from different domains.
A Tools score does not establish which applications a company actually uses.

- Authoring-only network title aliases map Network Specialist,Network Engineer,
  Network Technician and Network Support to the existing network administrator
  vocabulary. Whole-word phrase matching avoids accidental substring matches.
- Requirement fallback excludes Tools and its existing aliases before choosing
  the2 strongest specific categories. Tools alone yields no position suggestions.
- The Tools skill-category editor retains its original optional tag vocabulary.
  Staff may manually add actual company tools; no existing tag is bulk-deleted.

Admin and instructor position editors call the same POST /api/tags/suggest/.
The endpoint validates actual known categories/finite percentages and remains
staff-only/read-only. Clicking Suggest replaces the current editable draft list,
as before; data is persisted only when the user explicitly saves the editor.

Original14 category lists/8 role profiles remain; broader media catalog stays
rolled back. No database/model/migration,grading,matching descriptions,ranking,
60/25/15 weights,placement rules or live recommendations changed. Existing saved
Tools category vocabulary can still appear as contextual category evidence in
original generated descriptions; this fix targets position-tag suggestions only,
not a claim of individually assessed tools or confirmed company software.

## Verification

New7 tests plus existing31 focused tests pass: exact screenshot reproduction,
network variants,Tools aliases/only-Tools exclusion,unknown/substrings,zero values,
fallback specific categories,unchanged category vocabulary,no-write scoped APIs,
saved custom tags preserved,permission/validation checks. Full PostgreSQL300/300
passed,zero skips; frontend178/178,lint/build,Django check and no migration drift
pass. Four real local Chrome workflow groups pass,zero page errors: exact admin
Networking75/Tools75 payload,unknown fallback,explicit custom save/description and
instructor existing-position editor. Synthetic in-memory API only; external
requests blocked and SSE transport mocked. Desktop/mobile screenshots inspected.
No fixture/assertion repairs needed. Full suite's mocked missing-model tracebacks
are expected passing error-path tests.47 unrelated file hashes preserved; grading,
ranking,rendering,preprocessing functions AST-identical to HEAD. No efficacy claim.

No Supabase access or deployment. Logs:work/defense_audit/position-tag-relevance-*.
