# Program-eligible opportunities and shared capacity

F09 adds program eligibility to the existing shared partner and position catalog.
An administrator opens **OJT Partners & Positions**, selects a partner and adds or
edits a position. The program picker can search across institutes, and selected
programs persist when the search or page changes. The position has one slot
count across all selections. Clearing the list closes it to new placements.

The optional rubric uses category IDs from one version of an eligible program's
framework. The administrator chooses the program, the framework version and the
minimum percentages. Saving requirements freezes that framework version. Other
eligible programs can use manual placement. Program-specific rubrics for the same
opening would need a separate design. Framework-aware ranking and freshness are
scheduled in F10.

Students browse openings for their active batch's program. Instructors browse
openings for the active batches they manage. The shared catalog is edited through
admin controls. The API validates access on placement approval and manual
assignment and counts current approvals against the position itself. Changes to
eligibility retire incompatible active suggestions while retaining saved evidence
and existing approvals. Existing approvals continue to occupy slots under the
usual active-enrollment rules.

Migration `0038_position_program_eligibility` adds a nullable configuration
timestamp and an initially empty position/program relation. Existing openings
retain their eligibility for unmapped batches. Current IC records stay in their
existing workflows while F14 prepares the approved mapping.

## Verification

- The full PostgreSQL suite passed 716 tests. The final focused run passed 43
  tests, including a PostgreSQL race for the last shared slot and preservation
  of existing approved decisions and saved recommendation evidence.
- Frontend lint, build and 275 unit tests passed. Four browser groups exercised
  the real API and production bundle, including the phone dark editor, filtered
  instructor browsing, manual assignment and clearing eligibility. Seven
  additional partner catalog browser groups passed.
- The configured migration passed the backup and restore checks and retained
  all data in 43 existing tables. The nullable timestamp remained unset for
  existing openings and the new relation started empty.
- `dda3a47` was fast-forwarded into local `main`. See the
  [implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for evidence
  locations and the next feature.
