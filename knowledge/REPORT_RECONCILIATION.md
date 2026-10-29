# Report reconciliation

28 October cycle update: **Save report & archive batch** saves versioned recommendation-cycle
facts and exports PDF/XLSX/CSV, including original partner labels, openings and slots.
Existing placement reports still join the current catalog; no training completion
is inferred. Choose the saved report version when an immutable past-cycle record is
needed. See [closeout implementation and checks](OJT_CYCLE_CLOSEOUT_AND_ROLLOVER_PLAN.md).

28 October terminology update: newly generated reports use Partner headings;
underlying company fields and report-type identifiers are unchanged. See
[partner terminology](PARTNER_TERMINOLOGY.md) for the column compatibility boundary
and repeated PDF/XLSX download verification.

V02 uses known synthetic records, not live placement data. The fixture has four
students across two instructors' batches, three positions with nine configured
slots, two approved placements, one removed, two rejected and one suggested.

The report's six records reference two positions: capacity five, current approvals
two, remaining slots three. System analytics also includes the position with no
placement records: capacity nine, approvals two, remaining slots seven. History
never consumes additional seats. Davao City has two deployed students and six
configured slots across its positions; student residence is a separate metric.
The synthetic dashboard reports four students, zero completed required assessment
sets, and batch membership counts of four and two. Existing management/competency
tests additionally cover completed, locked and stopped assessment evidence.

Placement report/history authorization follows the **record's batch instructor**.
An additional enrollment in another instructor's batch does not expose that
batch's placement records. Unenrollment preserves the original instructor's
record history. Records with no retained batch are visible to administrators;
no access is inferred from an unrelated enrollment. This corrects four reproduced
cross-batch report/history failures. Broader security acceptance remains V03.

Placement date filters now use the existing project `Asia/Manila` convention,
matching assessment scheduling and CSV generation. A `2026-10-17T16:30Z` approval
belongs to October 18 in Philippine time. PDF dates, Excel serial dates and file
date suffixes use the same convention independently of the browser timezone.
The original generated UTC instant is retained in Excel metadata.

PDF and XLSX retain the fetched snapshot, identity, filters and assignment scores.
PDF headers wrap long generator/company names; multi-page exports retain page
numbers/signatures. XLSX keeps the existing raw `Placements` sheet and adds a
`Report` sheet with generation details, individual filters, capacity scope and
counts. Long metadata has explicit continuation rows. Numeric zero is retained;
missing values stay missing. Dates are typed serial values with a date format.
Raw-table text is preserved in full for spreadsheet selection/resizing.

Formula-like XLSX names remain literal string cells; no formula cells were
generated. CSV text is protected for direct prefixes, leading whitespace and
control characters. Download activation is guarded while a request is pending.
No historical assignment evidence was recalculated or migrated.

Evidence under `work/defense_audit/`:

- `v02-before.txt`: four reproduced scope failures and one corrected test-key
  error. `v02-after.txt`: 37 focused API tests passed after the corrections.
- `v02-postgres-final.txt`: full isolated PostgreSQL **252/252 passed**, no skips.
- `v02-{lint,build,unit}-final.txt`: lint zero errors/five existing warnings,
  build passed, **114 frontend tests passed**.
- `v02-export-controls.json` and `v02-batch-progress.csv`: actual isolated API
  output from migrated in-memory SQLite. No provider calls or real messages.
- `v02-browser-final4.txt`: five grouped cases, ten downloaded PDF/XLSX files,
  zero page errors. A Los Angeles browser timezone tests independence from the
  reporting timezone. Earlier fixture/selector failures are retained separately.
- `v02-export-verification.json`: independent saved-file checks using bundled
  read-only Python tools: exact records, school IDs, score 72.345, zero distances,
  typed local dates, filter metadata and no formula cells. CSV retains four
  scoped students with a protected formula-like name.
- `v02-pdf-contact.png` and `v02-render-*.png`: all eight PDF pages rendered and
  visually inspected. `v02-xlsx-report.png` and `v02-xlsx-placements.png` inspect
  metadata and identity ranges using the bundled artifact tool. Source XLSX files
  were not modified by inspection. Initial clipped metadata was corrected before
  the final render.

Official LMS/IAMS compatibility, broad role/device workflows, concurrency,
security, performance and actual hosted acceptance remain separate checklist
tasks. This evidence does not close those gates.

V04 follow-up explicitly reopened V02 after a confirmed new-decision batch defect.
Approval and new rejection now store the recommendation evidence batch instead of
the latest enrollment. The final 60-test PostgreSQL run includes approval/rejection
with a newer foreign enrollment and scoped report reconciliation. V02 was restored
only after these checks passed; no historical data repair was performed. See
[PostgreSQL concurrency verification](POSTGRES_CONCURRENCY_VERIFICATION.md).
