# Program setup and instructor dialogs

Implemented on `codex/program-management-dialogs` from the three approved
Imagegen concepts. The concepts guide the React layout; generated mockup images
are not inserted as application UI. The shared catalog form also keeps institute
and skill-page branding edits consistent with program creation.

## Program form

The desktop form separates required name/code and optional description/aliases
from the banner editor. The institute context is shown for a program and remains
fixed. Aliases start collapsed for a new program; existing aliases are visible
when editing. The existing field limits and API payloads remain unchanged.

The banner editor shows one live cover preview with the current code. Preset
colors and Upload image are separate options. All twelve existing colors remain
keyboard-selectable with accessible names, hover labels and a selected-color
summary. Selecting a preset deliberately replaces an uploaded cover on save;
switching options without selecting a replacement does not discard the upload.
Uploading, removing and undoing still use the existing validation, conversion and
storage flow. On phones, Change banner initially collapses those extra options;
the preview remains visible, and selecting a file reveals its upload controls.

Headers and save/cancel controls remain outside the scrolling form. No wizard,
automatic account creation, institute-specific program fields or extra save step
was added.

## Instructor manager and picker

Both dialogs use the same identity-card treatment as Users: the shared Avatar,
name, instructor/school ID when present, purple Instructor pill and email.
Names, IDs and addresses wrap within narrow cards. Each program assignment adds
its own status and Revoke access/Restore access action; the picker instead shows
Assign or a disabled Assigned state. These cards do not use course banners or
student performance fields. The manager's short heading is Program instructors,
with the full program and institute/code context beneath it.

Both collections support card/list views, server search, result counts and
eight-record pages. The manager retains assignment-status filtering. Views show
the same ordered page; search/filter changes reset the page. Pagination and
Done/Cancel stay in the dialog footer while the body scrolls. The optional compact
Pagination mode hides neighboring page-number buttons on narrow screens, keeping
previous/current/next and a Page x of y summary. Other pagination callers keep
their existing layout and summary.

The desktop collection modal fits its content up to the viewport limit rather
than filling most of the screen for a single instructor. Phones use the existing
full-height dialog adaptation. Assignment feedback is inline in the manager,
so a floating success toast does not obscure the phone header. Revoke/restore
still requires confirmation, retains records, and affects only the selected
program. Assignment still chooses one existing account per action, retains its
in-flight guard and explicit retry, and closes the picker after success.

## Access and data

Membership management and candidate search remain admin-only. Active approved
accounts are eligible; unavailable parent programs/institutes block new/restored
grants. Program grants do not reveal a colleague's private batches. The backend
adds only existing `photo_url` values to its assignment/candidate DTOs so cards
can show the same saved profile image as Users. IDs already came from school_id.
No model, database migration, storage policy or permission expansion is needed.
No configured account, assignment, banner or program was changed for testing.

## Verification

- Frontend lint/build and all 348 Node tests passed.
- All 37 isolated PostgreSQL assignment/catalog/image tests passed in
  `work/organization-postgres-k69b60n7/`; the new identity check verifies matching
  photo/ID fields in both DTOs and continued instructor-role denial. Django check
  and migration-drift checks passed with no model changes.
- Program/institute CRUD, archive hierarchy, errors and responsive forms passed
  eleven browser groups in `work/organization-browser-kfajiujx/`.
- The final assignment suite passed nine groups in
  `work/organization-browser-zmwetl68/`, including current-JWT grants,
  duplicate/retry handling, revoke/restore identity, nested focus/Escape,
  pagination, parent-scope denial and light/dark phone layouts.
- Four new larger-directory groups passed in
  `work/organization-browser-a0_kv3vy/`, using 36 synthetic candidates and 25
  program assignments, instructor-ID search, both views, disabled assigned
  controls and 320/390/768/1440px layouts. Program form state, aliases, preset/upload
  switching, single preview and phone disclosure were verified too.
- The final staff-scope suite passed twelve groups in
  `work/organization-browser-c7ojemm2/`. Partner-image regression passed seven
  groups in `work/organization-browser-zc8la43a/`. In total, 43 browser groups
  passed without page errors.

Desktop and phone screenshots were reviewed. An initial preview run lost a
hashed asset when another build replaced dist while it was serving that bundle;
final runs used the completed build without rebuilding during browser execution.
The observed phone success-toast overlap was corrected with inline feedback.

Checkpoint: verified on the feature branch for local merge to main. No known
feature failures remain. No migration, push or deployment is included. Next:
review the three updated dialogs locally. Unrelated overview and optimization
plan edits stay outside this feature's commit.
