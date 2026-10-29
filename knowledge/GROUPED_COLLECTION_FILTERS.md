# Grouped collection filter rollout

29 October 2026. Branch: `ojt-cycle-closeout-rollover`, local/uncommitted.

Fresh whole-branch follow-up: [29 October verification](BRANCH_VERIFICATION_2026_10_29.md).
Both shared filters and the full roster suite pass in a single production-build
run, including all 567 roster combinations; earlier interrupted runs below remain
historical failures rather than being relabeled as passes.

The user authorized applying the approved student-roster grouped filter pattern to
instructor Assessments, admin Users and admin Assessments. Keep 38px search/trigger,
28px radio chips and the existing compact card/list controls. Preserve each role's
existing filter options, tabs, authorized data, sort order, pagination and actions.

## Checkpoint

- [x] Inspect current collection pages, hooks and documentation.
- [x] Extract shared controlled popover/sheet and compact styles from the roster.
- [x] Add the synchronous preview toolbar to both assessment libraries and Users.
- [x] Preserve student-specific Users filters; other role tabs keep search/scope.
- [x] Apply assessment filters atomically and reset page 1 without resetting view.
- [x] Verify role/tab filtering, preview/application, cancel/reset, pagination,
  keyboard behavior, mobile/desktop and loading/error states in the browser.
- [x] Run final lint/build and relevant Node tests; inspect screenshots.
- [x] Update affected documentation.
- [x] Finish original roster extraction replay and stop the task-owned server.

Current work: final lint/build and all 288 Node tests pass. The new read-only
synthetic browser suite passes 31 groups across all three routes, five viewport
sizes in both themes, with no page errors or API writes. Existing assessment
regressions pass 11 instructor and 9 admin groups after adapting old selectors and
count wording. Final desktop/mobile screenshots are inspected. The original roster
extraction run passed eleven responsive groups but timed out in short-landscape
dark mode; the final isolated case and keyboard replay passed. One earlier
concurrent replay timed out during initial load; that run is not recorded as
passing. The original async previous-enrollment error/Retry check also passes.
Evidence: `work/collection-filters-roster-regression.txt`,
`work/collection-filters-roster-landscape.txt` and
`work/collection-filters-roster-error.txt`. The task-owned port-5178 Vite server
was stopped. No required steps remain. No backend, database, deployment or live
user-management action was performed. Changes remain local/uncommitted.

## Implementation and evidence

- [GroupedFilterPanel](../skillbridge-frontend/src/components/GroupedFilterPanel.jsx)
  provides the native radio groups, accessible popover/modal sheet, dismissal and
  focus behavior. [CollectionFilterToolbar](../skillbridge-frontend/src/components/CollectionFilterToolbar.jsx)
  provides synchronous previews, applied summaries/removal, search and reset.
- [Shared styles](../skillbridge-frontend/src/styles/collectionFilters.css) preserve
  compact dimensions. The roster keeps its existing controlled async preview.
- Assessments keep their existing filter helper and immutable ordering. The new
  reducer action commits the staged group changes atomically at page 1.
- Users now shares one pure preview/record helper with the existing role, archive
  and sort rules. Only its student tab has group filters; other tabs retain search.
- Evidence: `work/collection-filters-node.txt`, `work/collection-filters-lint.txt`,
  `work/collection-filters-build.txt`, `work/collection-filters-browser.txt`,
  `work/collection-filters-instructor-regression.txt`,
  `work/collection-filters-admin-regression.txt` and ignored collection-filter
  screenshots/results. An incomplete background analytics fixture caused a
  notification in early captures; the completed fixture removes it. No production
  behavior changed for that fixture correction. Browser checks do not establish
  physical-device, hosted-service or large-option-cohort coverage.
