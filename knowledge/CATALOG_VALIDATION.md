# Catalog validation and recovery

20 October2026:shared category creation reuses strict admin skill validation;
malformed names,envelopes,descriptions and tags return400 before writes.
[Ranking freshness](RECOMMENDATION_FRESHNESS.md) also detects input changes before
visibility or approval; capacity remains a separate check.

Company/position mutations validate all supplied values before saving related
records. Company image envelope, address and coordinate checks remain shared;
company names must be nonempty text of at most 255 characters, and booleans are
not accepted as coordinates. Position titles have the same text constraint.

Slots are whole numbers in the portable PostgreSQL/Django PositiveIntegerField
range, 0–2147483647. Zero retains the existing instructor API's ability to close
capacity; the admin form now supports the same bound. A slot count can never be
less than the position's approved placements. Position edits lock that position,
matching placement approval's lock. This concurrency guarantee must be verified
on PostgreSQL rather than inferred from SQLite tests.

Requirements must be an object keyed by known, case-insensitively matched skill
category names. Each category appears once. Percentages must be finite numeric
values from 0 through 100. Zero removes/omits that requirement; an empty object
clears requirements. Invalid, unknown or repeated categories are rejected rather
than silently skipped. Tags accept text lists or CSV strings and retain the
existing normalization/deduplication behavior; malformed tag structures fail.

Admin position creation and replacement of requirements are atomic. A failed
validation or database write leaves no partial position, changed title or erased
requirements. Instructor company edits validate all position updates together
before image upload or writes. Instructors retain their existing company and
position title/capacity/tag edit permissions; requirement changes use the admin
endpoint. Referenced company/position deletion continues to return conflict and
preserve placement history and image references.

The admin form retains drafts, clears loading and shows the server error after
failure. Pending activation is guarded against duplicate clicks. Protected
position deletion now retains its row and confirmation dialog until the server
confirms success; failed deletion no longer displays a success toast. The shared
confirmation dialog prevents repeated activation while pending and displays
returned errors. No mutation is automatically replayed after an uncertain write.

Evidence: `api.test_catalog_validation`, `api.test_company_images`, placement
tests in `api.tests`, and `tests/catalog_validation_playwright.py` (mocked local
API; no external writes). The single continuous-development checklist records
the exact executions and remaining PostgreSQL acceptance work.
