# OJT partner terminology

Implemented 28 October 2026. The application now calls the existing organization
catalog **OJT Partners**. A partner may be a company, office or institution; forms
ask for the **Organization name**, and actions say **Add Partner** or **Edit Partner**.

## Scope and compatibility

The update covers admin/instructor navigation and catalog screens, student
dashboard/results/details, maps and location guidance, placement collections and
dialogs, notifications, score explanations, loading/empty/error text, image labels,
analytics and newly generated PDF/XLSX/CSV presentation. Singular/plural counts and
accessible names use the same terminology. Existing organization names are kept
exactly as saved, including names that contain the word Company.

`Company`, `Position.company`, `OJTPlacement.company`, IDs, API and page URLs,
JSON fields, report-type identifiers, cache/prefetch/invalidation keys, image
references and historical migrations retain their existing names and behavior.
No schema or data migration is required. Existing bookmarked company routes work.

Recommendation generation text, fingerprints, model versions, scores, grouping,
ordering, completion gates and decision snapshots are unchanged. Capacity and
role authorization are unchanged. A renamed label does not create partnership
approval, agreement expiry, organization-type or partner-account functionality.

New downloadable reports use **Partner**, **Partner Address**, **Partner area** and
related headings. Consumers that read CSV/XLSX columns by their old Company labels
must use the new headings. Payload keys such as `company_id`, `companies` and
`unique_companies`, report types such as `company_placements`, and existing download
filename prefixes are preserved. Previously downloaded files are not rewritten.

## Verification

- Full frontend unit suite: **206 passed**.
- `npm run lint`: passed without warnings/errors.
- `npm run build`: passed.
- Django system check: no issues.
- Django migration dry run: **No changes detected**.
- Nine backend modules: **117 discovered, 116 passed, 1 skipped** on isolated
  in-memory SQLite. Coverage includes catalog validation, images, core workflows,
  access boundaries, recommendation contracts/freshness, capacity/areas, report
  reconciliation and analytics. The skipped test requires PostgreSQL concurrency.
- Frontend and backend syntax-tree comparisons confirm the source structure is
  unchanged except display/message strings and the Partner spreadsheet heading.
- Admin catalog browser regression: passed real-Leaflet map/disclosures,
  search/refresh, image editing, retained drafts, partner and position
  creation/edit/delete/cancel, responsive/dark layouts and error/empty/loading states.
- Student details browser regression: **4 viewport/theme cases passed**; both tabs,
  grouping and ranking, zero/missing scores, current catalog refresh, maps,
  dialogs and keyboard/focus behavior.
- Student dashboard browser regression: **6 viewport/theme cases passed**; ranking
  and distance order, compact rows, score bars, partner dialogs and result links.
- Staff placement browser regression: **30 groups passed** across both staff roles,
  six viewports and light/dark themes, with capacity, filters/paging, candidate and
  allocation review, read-only history, focus restoration and empty states.
- Actual report downloads: **5 PDF and 5 XLSX cases passed** (three report types,
  filtered data and empty data). PDF text contains Partner headings. All five
  spreadsheets retain exact record IDs, organization names and row counts while
  using Partner/Partner Address columns. Requests retain the original API keys.

Backend checks used `core.test_settings`, `PYTHON_DOTENV_DISABLED=1`, a synthetic
process-only secret and `DEBUG=True` to avoid HTTPS redirects in local API tests.
Browser checks use synthetic data and mocked APIs/providers. Windows sandbox
localhost restrictions required running those checks with local access enabled.
No live data, image storage or deployed service was changed. Hosted deployment,
PostgreSQL concurrency and external spreadsheet consumers were not exercised.

See the [original audit](../outputs/terminology-review/PARTNER_RENAME_AUDIT.md)
for the dependency review and naming rationale.
