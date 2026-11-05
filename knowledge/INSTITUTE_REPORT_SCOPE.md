# Institute report scope

Report filters narrow the batch rows staff can already access. An instructor
needs both batch ownership and a current program assignment for configured
programs. A program grant alone gives access to the shared competency catalog.
Assessment and placement report requests can filter by institute, program and
batch. The legacy placement report's batch-only filter returns an empty list for
an inaccessible batch. Analytics exposes institute and program choices drawn
from the staff member’s accessible batches.

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
also revalidate their source before writing a local file. A guessed retake
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
