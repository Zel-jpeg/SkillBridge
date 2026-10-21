# Placement implementation checkpoint

Updated 21 October 2026.

- Branch: `update-placement-ui-ux`, created from the current local `main`.
- Design and confirmed workflow: [placement UI/UX plan](PLACEMENT_UI_UX_REVIEW_AND_PLAN.md).
- Status: review/design complete; implementation has not started.
- Confirmed: shared draft across active batches; current unlocked results;
  low-score proposals flagged for review with no automatic cutoff; one draft
  position per student; top-three matches accessible; distinct provisional and
  approved seat counts; instructor/admin final approval.
- Existing approved placements must remain fixed during draft updates. Instructor
  student visibility remains scoped, while company capacity is shared.

## Pause and resume agreement

When the user says **PAUSE**, stop initiating new work, safely conclude or stop
active local checks, preserve edits and record the current work, checks, outstanding
issues and precise next step here. Do not discard or reset changes, create a commit
automatically, or treat a partially implemented feature as complete. State any
unfinished operation honestly. Wait for **CONTINUE** to resume from this checkpoint.
The user uses this flow when their token allowance is low and later resets.

## Existing changes to preserve

At branch creation, unrelated authoring-draft work was already present:
`knowledge/VALIDATION_AND_RECOVERY.md`,
`skillbridge-frontend/src/hooks/instructor/useInstructorUpload.js`,
`skillbridge-frontend/src/pages/instructor/InstructorUpload.jsx`,
`skillbridge-frontend/src/utils/authoringDraft.js`,
`skillbridge-frontend/src/utils/authoringDraft.test.mjs`, and untracked
`skillbridge-frontend/tests/authoring_draft_playwright.py`.
Preserve those changes and do not include them indiscriminately in placement commits.
The placement design plan was also untracked and remains preserved.

## Next implementation step

Inspect current models, migrations, placement callers/authorization and test setup;
define and document the draft allocator's objective, deterministic tie handling,
shared draft lifecycle and concurrency behavior before adding allocation state.
Then follow the implementation sequence in the plan using isolated synthetic tests.
No live data changes, migration execution, deployment or draft generation occurred
during branch creation.
