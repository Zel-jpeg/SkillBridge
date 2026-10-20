# Recommendation contract and local verification

20 October2026:[saved-ranking provenance](RECOMMENDATION_FRESHNESS.md) locks
rankings whose catalog/model/pin inputs changed or whose legacy provenance is
unknown. Approval rejects them until an explicit admin refresh. Migration0020
adds one profile field; score history and placement snapshots remain.

The ranking remains 60% category cosine similarity, 25% TF-IDF text similarity
and 15% location similarity. Student and requirement vectors use the same category
ID order. Location falls linearly to zero at 80 km; missing or invalid coordinates
receive the existing neutral 50% location component and no distance. Similarity
is not a success probability or placement approval: a full position can still rank,
and approval separately checks capacity, current evidence and authorization.

Coordinates must be a complete finite pair within ±90 latitude and ±180 longitude.
Boolean, blank, malformed and incomplete values are missing. Supported numeric
strings are normalized. Old text addresses remain readable. Ranking does not repair
historical records. Haversine's intermediate value is clamped for antipodal
floating-point precision.

Both API and browser preserve stored score precision. Exact ties use position ID
in ascending order, independent of recommendation creation order. Nearest sorting
places unknown distances last, then uses score and position ID. Student map pins
come only from the authenticated profile; an older account's browser fallback pin
is not used while a profile loads or fails.

## Isolated evidence, 18 October 2026

- `api.test_recommendation_contract`: eight cases; before fixes, five failures and
  one error reproduced invalid coordinates, a legacy-address crash and unstable
  tied API order. After fixes the focused 57-test suite passed.
- Complete API suite: 209 tests passed on disposable localhost PostgreSQL 17,
  including raw/max weighting, required gates, active-batch isolation, retakes,
  stopped/flagged evidence, stale results, preserved placement snapshots,
  empty/zero evidence, empty vocabulary and unavailable-model fallback.
- `src/utils/recommendationResults.test.mjs`: three deterministic coordinate,
  precision and sorting tests passed; full frontend suite recorded in the tracker.
- `tests/recommendation_contract_playwright.py`: four real React screen cases
  passed with synthetic API responses: close-score/nearest ordering and marker
  inputs; no-required-work lock; no candidates; failed read with successful retry.
  No browser page errors. Leaflet is a deterministic test adapter; this does not
  establish external map/tile availability, hosted CSP or overall visual acceptance.
- Lint: zero errors, five pre-existing warnings. Production build passed.

Logs are in `work/defense_audit/n02-{before,after,postgres,browser,frontend}.txt`;
browser screenshots/results are in
`skillbridge-frontend/tests/artifacts/recommendation-contract/`.
No live Supabase data, historical scores or placements were changed.
