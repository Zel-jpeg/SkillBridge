# Coordinator editing and consistent partner cards

The later [card action update](COORDINATOR_CARD_ACTIONS.md) supersedes this
receipt's separate creator-only archive restriction and adds protected deletion.

User clarification, 9 November 2026: assigned instructors/OJT coordinators must
be able to edit their programs' partners and positions, including existing shared
IC entries and entries another coordinator or administrator created. The manage
page should use the administrator's partner/position card layout.

This supersedes the earlier creator-only editing policy. It does not authorize
unrelated programs, global eligibility changes, permanent deletion or a remote push.

## Behavior

- [x] Current approved, active program grants authorize editing the partners and
  active openings visible in that selected program. Creator fields remain audit
  provenance and are not reassigned when a peer edits.
- [x] Original shared IC company details, position descriptions, tags, slots and
  saved shared numerical requirements are editable through either IC program.
  Save preserves original category IDs and unconfigured shared eligibility; it
  does not convert the opening or empty its requirements.
- [x] Configured sharing follows explicit program links in every institute.
  Common partner details and shared position edits update the same record in
  its other program views. Foreign-only openings and private student rosters
  remain excluded.
- [x] Numerical framework requirements remain editable through their own program
  context. In another eligible program, the editor permits position details and
  preserves the existing rubric with a visible explanation. Forged rubric edits
  are rejected server-side. Eligibility reassignment stays on the admin API.
- [x] Archive/restore retains its existing creator/admin authority, current
  approval guards and revision checks; expose a separate `can_archive` flag.
  No permanent delete action is added to the instructor page.
- [x] Reuse `CompanyCollectionCard` for the instructor manage collection. Both
  roles share partner cards, nested position cards, slot/requirement counts,
  expandable descriptions/requirements/tags, icon-only edit actions, address
  details and card/list layouts. Instructor actions follow returned capabilities;
  administrator callbacks retain their existing actions.
- [x] Keep program selection, server-side pagination/status/search, stale-edit
  protection, retained input after errors, uncertain-save recovery and revoked
  assignment handling. Shared definitions are visibly identified in the editor.

The instructor collection uses its program-authorized management API and does not
fetch student identities or use admin write endpoints. Server authorization is
rechecked under existing catalog/program locks before saving and before image
transport. Successful saves retain actor/program audit and freshness events.
No schema migration or live data update is needed for this permission change.

## Verification

- [x] **102 backend tests** passed on isolated PostgreSQL, including original
  IC requirement round trips, peer edits without ownership transfer, foreign
  rubric preservation, forged-field rejection, image authorization, archived
  programs, stale edits, revoked grants, shared capacity and concurrency.
  Receipt: `work/branch-review-postgres-ec9j24k2/tests.txt`; owned cluster stopped.
- [x] **342 frontend tests** passed, including exact requirement-format payloads,
  preservation of an inaccessible rubric, exclusion of authority fields and
  card address/capability normalization. Lint and production build passed.
- [x] Nine real-API shared-visibility browser check groups passed in
  `work/organization-browser-rrci3bul/`: both IC programs edit original shared
  descriptions/minimums; the other program sees the change; original data links,
  exports, mixed rosters, admin pages and responsive layouts remain correct.
- [x] Final coordinator browser workflow: peer editing, image transport,
  search/pagination, archive/restore, stale/lost-save recovery, revoked access,
  another program's preserved rubric and phone card layout. All **13 check groups**
  passed in `work/organization-browser-h_71vx4o/`, with zero page errors. Phone
  card and editor screenshots were inspected; task-owned servers stopped.

An initial SQLite run encountered an obsolete peer-image denial assertion; it
was replaced with authorized-peer upload and unauthorized-program rejection
checks before the completed PostgreSQL run. The first card browser run retained
an Archived filter after restoring an entry; the check now explicitly verifies
that the entry leaves Archived and returns in Active. Another stopped run used
the removed selected-detail URL alone for a simulated SSE event; the completed
test invalidates the actual list URL as the real catalog-topic handler does.
Those stopped runs are not passing full workflow receipts.

Branch: `codex/coordinator-shared-editing-20261109`, based on main's visibility
fix. The separate position-specific NLP feature remains independently unmerged
into main. No real company, position, score, recommendation or placement snapshot
was edited by these isolated tests. Do not push to GitHub without instruction.

## Importing a partner pin

The coordinator partner editor accepts full Google Maps links with an explicit
pin. The latitude and longitude are applied to the existing map immediately.
An on-demand Photon reverse lookup can suggest PSGC address selections, including
Metro Manila (NCR). The coordinator reviews the suggested address and can change
any selection or move the pin before saving. The street/building text is kept.
An unavailable lookup leaves the pin usable, and a link without an explicit pin
leaves the draft as entered. Short links can be opened to copy the full URL.
