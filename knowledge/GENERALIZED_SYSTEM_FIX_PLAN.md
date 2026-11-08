# Generalized system fixes

Authorized 8 November 2026 after the [readiness review](SYSTEM_READINESS_REVIEW_2026_11_08.md).
Implement, verify and merge each feature locally before starting the next.
Tourism's empty catalog is intentional setup testing. Faculty content entry and
manual evaluation can continue later.

- [x] G01. Restore the shared institute-batch disclosure in dashboard overview responses. Verified 21 PostgreSQL tests and the complete shared-visibility browser journey for IT, IS and an arbitrary non-IC shared cohort.
- [x] G02. Add Skill remains available after use. Saving creates an updated library, preserves original evidence, reuses successful retries and rejects competing stale additions. Verified 43 PostgreSQL tests, lint/build and both skill-editor and competency browser suites.
- [ ] G03. Add editable position descriptions through admin/coordinator APIs, forms, displays, NLP text and freshness. Draft descriptions for the six existing IC openings from their titles, tags and requirements. Verify schema/data updates on a disposable backup before applying the authorized configured update. Preserve approved decision evidence.
- [ ] G04. Generalize institute-wide shared skill libraries and institute/program authorization, while preserving IC identities and records. Verify arbitrary institutes and programs.
- [ ] G05. Clarify saved assessment definitions and position requirement readiness after skill updates. Keep routine workflows simple and expose actionable differences.
- [ ] G06. Update operator instructions, run integrated regressions and record remaining hosted release gates.

Institute-shared reuse was clarified by the user. Programs receive editable
copies of shared skills. Editing a program copy does not change the shared
definition or another program's copy. Existing IC category/assessment identities
must be preserved during this extension.

## Current checkpoint

G01 merged as `f6edec7`. G02 is verified on `codex/add-skills-after-use` and ready
for local merge. G02 API evidence is `work/organization-postgres-7xa1zbee/tests.txt`.
Browser evidence is `work/organization-browser-1p9cuqr5/browser.txt` and
`work/organization-browser-q9v3cy30/browser.txt`. G01 evidence remains in
`work/organization-postgres-at2_ydnz/` and `work/organization-browser-6nucw2ry/`.
Other ongoing UI/Realtime changes in the working
tree belong to separate work and are excluded from these feature commits.

Next step is to merge G02 locally, then implement G03 on a new branch. GitHub publication and
deployment remain separate from local feature completion.
