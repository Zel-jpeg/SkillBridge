# Shared partner visibility review

The later [coordinator editing update](COORDINATOR_SHARED_EDITING.md) supersedes
the editing restrictions recorded in this initial visibility-only receipt.

User request, 9 November 2026: restore existing shared IC partners in both
instructor program management views and check other pages for inconsistent
institute/program filtering. No remote push or live data migration.

## Findings and fixes

- [x] Read-only catalog inspection confirmed the six original IC openings have
  no management-program or explicit eligibility-program links. Management reads
  required those links although other pages recognize the retained shared IC catalog.
- [x] Centralize management list, nested opening, direct detail, duplicate-title
  and archive lookup visibility through `api/partner_visibility.py`. Original
  unconfigured openings appear in both IC program views. Explicit sharing follows
  recorded program links for every institute. Sibling-only and foreign openings
  remain excluded from unrelated views.
- [x] Retain original ownership, requirements, eligibility, category evidence and
  slot counts. Visibility grants neither editing nor placement eligibility.
- [x] Display shared numerical requirements in instructor opening details. These
  entries no longer falsely say "No numerical requirements" or "manual placement
  only". Replace "Legacy eligibility" with a shared-batch label.
- [x] Correct administrator guidance: IC shared openings also appear under IT
  and IS, not only All IC programs.
- [x] Restore the shared-roster disclosure lost from the redesigned Reports &
  Analytics scope panel. Data and export scope were already correct.

## Other-page review

| Area | Rules inspected and regression coverage |
| --- | --- |
| Admin batches and student rosters | Both program views retain full mixed rosters; private sibling batches stay separate. |
| Assessments and archives | Institute-shared work appears in each program; explicit program and foreign institute records stay separate. |
| Retakes and attempt history | Scope filters precede pagination; private instructor ownership remains enforced. |
| Partners, positions and map | Admin filtering retains original IC sharing and explicit program sharing; instructor management list/details now agree. |
| Placements, history and exports | Full recorded shared scope is retained; approval eligibility and shared capacity remain separate. |
| Dashboard | Shared-roster disclosure, distinct school totals and scope-linked attention queues retain their rules. |
| Reports & Analytics | Shared batch, capacity, geography and foreign-record scopes are covered; missing visible disclosure restored. |
| Instructor/student access | Peers cannot access another instructor's private batches; exact framework scoring, stale results and program isolation remain enforced. |

Original unconfigured IC data uses the established compatibility identity
(reviewed institute code or name); future sharing uses explicit program links.
No rule makes new unconfigured positions globally shared, and no original
requirement is silently converted into a program framework.

## Verification

- [x] **97 backend tests** on disposable PostgreSQL: five new visibility cases,
  coordinator writes/concurrency, shared slots, batch/enrollment access, reports,
  analytics, exact-framework recommendations and concurrent refreshes. Receipt:
  `work/branch-review-postgres-2kadvtc7/tests.txt`. Owned cluster stopped.
- [x] **340 frontend tests**, including shared versus exclusive catalog cases
  for IC and an arbitrary other institute, plus numerical requirement rendering.
- [x] Final frontend lint and production build after the report disclosure fix.
- [x] Real-API production-bundle browser checks for both IC programs, another
  institute's shared work, full rosters, dashboards, exports and instructor
  partner requirements/authority. All nine check groups passed at
  `work/organization-browser-u0sj5wpr/`, including 320/390/768/1440px roster
  layouts, desktop/phone instructor views, actual CSV/PDF/XLSX scope checks,
  unchanged mixed-batch links and zero browser page errors. Owned servers stopped.

A final read-only query applying the corrected management visibility to configured
records returns **five partners and six positions** for each of BSIS and BSIT,
and zero original IC entries for BSTM. This query does not populate, migrate,
reassign or refresh any record.

The initial direct SQLite command omitted the development DEBUG setting and
hit HTTPS redirects instead of assertions. The completed PostgreSQL run supplies
the intended test configuration. The initial browser run caught the missing
report scope note and stopped; it is not a passing full-browser receipt.

Branch: `codex/shared-partner-management-visibility-20261109`, based on local
main independently of the unmerged NLP feature. No live record, schema, grade,
recommendation or placement snapshot changed. Do not push remotely. Isolated
regressions do not replace operator field testing.
