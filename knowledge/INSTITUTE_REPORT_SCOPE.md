# Institute report scope

Report filters narrow the batch rows staff can already access. An instructor
needs both batch ownership and a current program assignment for configured
programs. A program grant alone gives access to the shared competency catalog.
Assessment and placement report requests can filter by institute, program and
batch. The legacy placement report's batch-only filter returns an empty list for
an inaccessible batch. Instructor analytics exposes institute and program choices
drawn from that instructor's accessible batches. Admin analytics includes all
saved institutes and programs, including empty and archived configuration, so an
empty selected scope keeps its actual name in the page and downloads. Unknown
IDs return 404; a program paired with a different institute returns 400.

Admin report controls follow Institute → Program → Batch, with batch status next
to them. Instructor and course are secondary filters under More scope filters.
Changing an institute or program clears dependent filters. An admin may review
school-wide totals before choosing a scope; program and batch controls wait for
an institute. Existing mixed IC batches remain in the ordinary shared IC scope.
They also appear when selecting IT or IS. More generally, selecting a program
includes institute-linked batches without a single program, with their complete
rosters. Page and export notes identify shared batches and overlapping program
views. Missing institute context is never inferred to belong to every institute.
See the [shared-visibility review](INSTITUTE_SHARED_VISIBILITY_REVIEW.md).

The institute/program comparison partitions the report's distinct-student cohort
using recorded enrollment, with separate shared/unassigned rows where applicable.
Each rate uses that row's student count; an empty cohort has no rate. Opening a
scope recomputes its newest selected enrollment independently, so its count can
differ from its share of a broader cohort. This is not a historical trend or an
OJT completion measure. Comparison records support search, sorting, pagination
and the same snapshot CSV/PDF download flow as other analytics records.

Scoped analytics shows eligible openings. The remaining-seat count for each
visible opening includes all current approvals against the same position,
including approvals from other eligible programs. Student and placement details
remain limited to authorized batches. Retained reports and placement decisions
continue to use their recorded enrollment and assessment context. The admin
skill breakdown separates same-name categories when they belong to different
program framework versions. Analytics labels those versions and counts missing
evidence within each framework's selected cohort.

Assessment CSV, placement downloads, questionnaire downloads and retake evidence
pass through the current API access check. Assessment PDF and analytics exports
also revalidate their source before writing a local file. Analytics exports
include organization names, batch selection, status, cohort unit and generated
time. A renamed organization also invalidates a pending download and asks the
admin to review the refreshed snapshot. A guessed retake
evidence ID outside the accessible set has the same response as a missing ID.

Live updates carry invalidation topics and permitted identifiers. The stream
checks queued identifiers against current access at delivery. An assignment
change clears the affected instructor’s private cached views and local report
snapshot. Instructor reconnection revalidates scoped views and clears any
previously generated assessment report preview.

The administrator’s recommendation tools can rerun a single active batch. The
API accepts a batch, program or institute scope and restricts both processing
and notifications to the selected active cohorts. Existing system-wide admin
reruns remain available. F13 requires no database migration.

See the [implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for
verification and the local merge status.
