# Scoped recommendation inputs and freshness

F10 uses the active enrollment's batch and its recorded framework version to
select evidence and positions. Submitted assessment scores enter combined totals
only when the assessment and category belong to that version. Individual score
history stays available through the existing assessment workflow.

Each candidate must be active, explicitly eligible for the program, and have
positive requirements from that framework version. Exact category IDs identify
requirements and scores. Shared openings can still receive manual placements
from their other eligible programs. The matching text and TF-IDF corpus use
only these candidates. Requirement coverage still leads recommendation order,
followed by demand alignment and supporting NLP/location scores.

Each scoped ranking records the program, framework version, catalog fingerprint,
text version, configured and actual NLP model, and requirement category IDs.
The current fingerprint incorporates the compatible corpus, effective definitions,
model, ranking policy and student coordinates. Changes in an independent catalog
leave existing rankings current. Removing applicable eligibility or changing a
scored input hides stale recommendations and blocks new approval from those
rows. Completed category scores and issued placement snapshots remain available.

Zero-score and no-opportunity cases can have finalized competency results with
an empty recommendation list. The existing administrator refresh can recompute
rankings. Ordinary result reads recover a missing finalized profile when all
gates pass, and a stale saved ranking waits for an explicit refresh. Unmapped
batches retain the existing legacy catalog and matching policy until F14.

The full PostgreSQL regression passed 721 tests before the final enrollment
lock was added. The final focused run passed 89 tests, including simultaneous
refreshes, eligibility changes, irrelevant edits, stale approvals and retained
snapshots. Eight browser groups across two runs exercised scoped recommendations,
neutral result summaries and an actual competency CSV download. These used
synthetic questionnaires and verify software behavior. Academic suitability of
the ranking across disciplines remains a separate evaluation.

See the [implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md)
for evidence and merge status.
