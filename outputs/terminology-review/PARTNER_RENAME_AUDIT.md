# Companies to OJT Partners: terminology audit

Reviewed 28 October 2026 against the current checkout.

Implementation is now complete; see [current behavior and verification](../../knowledge/PARTNER_TERMINOLOGY.md).
The review-stage observations and limits below record the state before implementation.

## Recommendation

Use **OJT Partners** as the user-facing collection name and **partner organization**
in explanatory text. It accommodates companies, government offices and institutions
without changing the existing organization-to-position structure.

Implement this as a terminology change across all three roles, human-readable API
messages and newly generated reports. Retain existing database models, relations,
API URLs, JSON fields, cache keys and internal component names. No database migration
or record recreation is needed for this scope.

The current catalog has no organization type, partnership approval, agreement expiry
or active/inactive partnership fields. A label change cannot establish these facts.
Use **OJT Host Organizations** instead if the catalog includes prospective hosts
that DNSC does not yet consider partners. Partnership lifecycle management would
be a separate feature with explicit eligibility rules.

## Coverage and findings

| Area inspected | Finding and safe treatment |
| --- | --- |
| Admin and instructor catalog | Navigation says Companies; the admin page says Companies & Positions; forms also say Company / Institution. Rename display text consistently, including dialogs, search, counts, validation, toasts and accessible names. |
| Maps | The admin map already uses Partner Locations. Review student/staff maps, popups, location guidance and image alternative text for consistent terminology. |
| Student dashboard and results | Recommendations are grouped by company ID, with the highest individual position score representing the organization. Rename labels without changing grouping, order, precision or score meanings. |
| Placement management | Suggestions, decisions, candidate review and history refer to company records. Retain company/position IDs, permissions, approved-placement capacity accounting and decision score snapshots. |
| Reports and analytics | Company labels appear in headings, filters, summaries, charts, PDF tables and spreadsheet/CSV headings. Update human-readable labels; retain machine report types, query parameters and payload fields. Check downstream spreadsheet consumers before changing exported column headings. |
| Backend API | Admin, instructor and student company endpoints have different role checks and payloads. Keep URLs and JSON fields stable; readable error text may adopt the new terminology. |
| Persistence | Company is an existing Django model. Position.company and OJTPlacement.company reference it; placement references are protected against deletion. Retain these relationships and historical migrations. |
| Recommendation freshness | The catalog fingerprint includes company ID, actual organization name and coordinates. A display-label change does not affect that input; changing saved names does. |
| NLP | Position text includes the actual organization name. Preserve generated text and its version during the terminology change to avoid altering similarity inputs. |
| Cache and navigation | Response validation, SSE invalidation patterns, prefetch maps and lazy page loading refer to companies. Preserve technical paths. Renaming only the navigation label is compatible with existing URLs and bookmarks. |
| Images | Existing image helpers and stored image references work with the company entity. Update visible wording without moving images or changing storage configuration. |
| Documentation and fixtures | Update current user guidance and relevant expected display labels. Keep historical notes, saved decision evidence and organization names intact. |

## Suggested wording

| Current label | Proposed label |
| --- | --- |
| Companies | OJT Partners |
| Companies & Positions | OJT Partners & Positions |
| Add Company | Add Partner |
| Company / Institution Name | Organization name |
| Search companies | Search partners |
| All Companies | All Partners |
| Top companies for you | Top partners for you |
| Company area | Partner area |
| Approved company | Assigned partner |
| Company / Position Placement Report | Partner / Position Placement Report |

Keep **Top suggested position** and **Best position match**: a recommendation score
belongs to a position, and placement still requires the coordinator's decision.
Do not introduce an aggregate partner score as part of this rename.

## Implementation and verification boundary

1. Update visible text across admin, instructor and student workflows, shared
   components, readable backend messages and report presentation.
2. Keep `Company`, `company_id`, `companies`, `/api/.../companies/`, existing page
   URLs, report-type identifiers and data/cache contracts unchanged. Avoid a global
   source-code search-and-replace.
3. Update expected wording in relevant tests and current documentation. Check report
   consumers if exported headings change.
4. Run frontend lint/build and relevant unit checks; verify all three roles, catalog
   editing, partner details/maps, placement actions, errors and report exports with
   synthetic data. Include backend catalog/access/placement tests if readable backend
   messages are changed. Any database tests must use a dedicated local test database.
5. Confirm record IDs/counts, recommendation values and placement history are
   preserved. If new page URLs are later desired, provide redirects and update
   prefetch/loading/navigation together as a separate scoped change.

A full technical rename is possible but has a larger migration and compatibility
surface without a user-facing benefit beyond the terminology change.

## Evidence and limits

Read-only review covered the repository overview and relevant collection,
recommendation, catalog, student browsing, capacity and report documentation;
current frontend callers and shared utilities; backend models, routes, views,
ranking/freshness, analytics, placement and image helpers; and relevant migrations.

Ran eight frontend test files covering response contracts, query invalidation,
navigation, recommendation grouping, collection disclosure, image requests,
analytics and assessment-report evidence: **44 passed, 0 failed**.

This is a cross-system terminology/dependency review, not a complete security,
performance or production-readiness audit. No application code, live records,
schema or deployment was changed. No browser checks, backend database tests,
lint or build were run for this review. Live catalog membership and external
report consumers were not verified.

## Follow-up completeness check

A second static pass checked notification fallbacks, assessment processing text,
student profile distance guidance, score explanation text, image upload labels and
image accessible names, navigation/loading lookups, report dispatch and workbook
construction, relevant browser-test selectors and name-based legacy placement
comparison. The inspected email service, shared staff notification helper, frontend
HTML entry and hosting configuration had no company/partner wording matches.

Additional details to carry into implementation:

- Student results constructs singular/plural words as `compan` plus `y`/`ies`.
  A whole-word search alone will miss these visible counts.
- Analytics uses `company:` as an internal selection prefix; placement report
  dispatch uses `company_placements`. Preserve both when changing visible labels.
- Navigation labels, paths and icon keys are independent. Change the labels while
  retaining paths and the `companies` icon lookup key.
- Spreadsheet object keys become exported column headings. Updating those labels
  changes the exported file contract even when JSON payloads remain stable.
- Browser tests use visible names such as Search companies. Update those selectors
  with the interface wording, while preserving synthetic organization names and IDs.
- Legacy placement comparison can fall back to actual company and position names.
  Do not rewrite stored names or recommendation payload values to rename the entity.

No additional structural blocker to a display-only rename was identified. This
does not certify an implementation that has not been made. The 44 checks above
verify the unchanged baseline; the completed rename still needs lint/build,
relevant automated checks and role/browser/export regression verification.

## Source entry points

- [Company and related models](../../skillbridge-backend/api/models.py)
- [API routes](../../skillbridge-backend/api/urls.py)
- [Role checks and API payloads](../../skillbridge-backend/api/views.py)
- [Recommendation fingerprint](../../skillbridge-backend/api/recommendation_freshness.py)
- [NLP position text](../../skillbridge-backend/api/recommendation_nlp.py)
- [Navigation labels](../../skillbridge-frontend/src/navigation/navigation.js)
- [API response contracts](../../skillbridge-frontend/src/api/responseContract.js)
- [Live query invalidation](../../skillbridge-frontend/src/api/queryInvalidation.js)
- [Placement report presentation](../../skillbridge-frontend/src/utils/placementReports.js)
- [Analytics export presentation](../../skillbridge-frontend/src/utils/analytics.js)
- [Current student browsing contract](../../knowledge/STUDENT_COMPANY_BROWSING.md)
