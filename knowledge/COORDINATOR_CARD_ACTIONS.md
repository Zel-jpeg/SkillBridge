# Partner and position card actions

User instruction, 9–10 November 2026: make instructor edit, archive and delete
controls consistent with admin cards, including shared IC entries. This supersedes
the earlier creator-only archive restriction; current program grants authorize
these catalog actions within the following boundaries.

- Both roles reuse accessible icon-only edit, archive/restore and trash controls.
  Icons have action names and tooltips. Unavailable actions remain visible and
  disabled with a reason rather than silently disappearing.
- Assigned coordinators can edit and archive visible positions, including shared
  openings. Closed eligibility remains admin-controlled. Whole-partner archive
  or delete is disallowed when any opening is outside the selected program scope.
- Program management detail APIs support DELETE with a current grant and fresh
  revision. The UI rereads capabilities and requires an irreversible-deletion
  confirmation. Rejected or uncertain operations never repeat automatically.
- Any recommendation, including stale/noncurrent ones, or any placement state
  blocks deletion. Partner checks cover its child openings and placement records.
  Disabled trash controls explain that archiving preserves saved evidence.
- The backend rechecks scope, revision and history under catalog/record locks.
  Partner deletes also lock its child openings. Successful deletes audit actor
  and program; image cleanup happens only after commit. Protected references
  return conflicts rather than cascading away placement evidence.
- Original shared IC category/program/creator fields and slot counts are not
  rewritten. Active-approval guards continue to block archiving.
- A presentation-version query key makes the management list bypass persisted
  permission flags from the old UI. Viewing the page changes no live record.

The running backend working directory was checked read-only and points to the
expected repository. Computer-use URL verification prevented inspection of the
user's actual browser session; do not claim live-session verification.

## Verification checkpoint

Branch: `codex/coordinator-card-actions-20261109`, based on local main. No remote
push, live deletion/archive, migration or recommendation refresh performed.

- [x] Frontend lint/build and all 342 helper tests passed.
- [x] **61 disposable PostgreSQL checks**: reviewed deletion, evidence retention,
  foreign/revoked access, image cleanup, archive/restore and existing regressions.
  Receipt: `work/branch-review-postgres-2r5wgr4r/tests.txt`; owned cluster stopped.
- [x] **14 instructor browser check groups**: icons, saves/recovery, delete
  cancellation, actual unused-record deletion and permission changes. Receipt:
  `work/organization-browser-8c2tiy68/`; zero page errors; owned servers stopped.
- [x] **Nine shared IC/admin browser groups**: both programs, protected trash
  controls, numerical requirements and responsive views. Receipt:
  `work/organization-browser-j77trlj4/`. Desktop/phone card screenshots inspected,
  zero page errors, owned servers stopped.

The initial backend run rejected a new test fixture that omitted a required
placement-position link. The corrected fixture tests real placement states with
valid links; the initial run is not a passing receipt.

Stopped browser attempts exposed outdated test expectations (hidden versus now
disabled-visible controls, and the create form's button name). The old standalone
company collection runner also stopped at its obsolete map-tile selector before
checking card actions. Current admin/instructor card checks use the shared-
visibility runner. These stopped attempts are not claimed as passing workflows.
