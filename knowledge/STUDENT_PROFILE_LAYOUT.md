# Student profile layout

27 October 2026. Implements the approved profile concept without section tabs or
radio-style selection glyphs.

## Review and preserved contracts

The profile's state and `handleSave` remain in
[`StudentProfile.jsx`](../skillbridge-frontend/src/pages/student/StudentProfile.jsx).
The save handler is byte-for-byte unchanged: the same own-profile PATCH endpoint,
name/student ID/course/phone validation, both addresses, preferences and one
`pinLat`/`pinLng` pair are sent. Existing loading, errors, retry, duplicate-write
guard, success message, user-cache update and results invalidation are retained.
Backend validation, authorization, recommendation recalculation and database schema
were not changed.

Presentation is in
[`StudentProfileForm.jsx`](../skillbridge-frontend/src/components/student/StudentProfileForm.jsx)
with its adjacent stylesheet. The desktop layout pairs compact Personal details
and Travel preference panels, followed by OJT location with address/map columns.
Narrow screens stack the panels. Text-only option buttons retain every preference
value and expose pressed state. Profile photos remain provider-sourced through
the shared Avatar; no upload was added. A sticky Save changes bar retains errors
and success feedback. The unavailable result-email feature remains a short
informational note instead of a settings card.

For boarding students the permanent-home editor is a disclosure, mounted while
closed so closing/reopening it retains selections. Validation opens an incomplete
home address automatically and editing keeps it open. Family-home/no-fixed-
preference modes show the home editor directly. Both addresses remain in parent
state when switching staying-at preferences.

The shared cascading AddressDropdowns component is unchanged, including loading,
retry, Davao grouping, cached provider data and obsolete-request cancellation.
It continues to show blank edit pickers alongside the current saved-address
summary; this layout change does not reinterpret provider codes or auto-select
an address. Saved values survive an untouched editor.

The map uses the existing Leaflet/geocoder flow. Boarding/home map-view controls
only recenter the view; click/drag moves the single pin. Zero coordinates remain
valid and Remove pin sends null/null. One small display synchronization fix removes
the visible Leaflet marker when the parent pin is cleared; the previous display
could retain the marker after clearing its coordinates. The pin can be placed
again. Map/geocoder errors and explicit retry remain available.

## Verification

Synthetic browser checks live in
[`student_profile_layout_playwright.py`](../skillbridge-frontend/tests/student_profile_layout_playwright.py).
They cover unchanged save payloads, all editable identity/contact fields, travel
and staying-at preferences, both cascading address editors, disclosure retention,
automatic validation disclosure, local user-cache updates, map recenter versus
pin changes, zero pins, removal and re-placement. Map event handling uses a Leaflet
fixture, not a live provider or physical device.

Existing profile draft/error-recovery and external-provider-recovery suites check
400/network/invalid-response retention, single writes, safe explicit retry,
unowned browser pins, zero coordinates, corrupt address cache, stale provider
responses, map script/tile recovery and image fallback. Responsive checks cover
320/375/640/768/1024/1440 CSS pixels in light/dark mode, no page-wide overflow,
compact desktop fields, stacked mobile sections and a 44px save target, including
a 420px-tall viewport. Screenshots/results are under ignored
`skillbridge-frontend/tests/artifacts/student-profile-layout/`.

Application deployment, physical-device behavior and live provider availability
are outside these local checks. No production records were edited for testing.

Completed results: all five profile-layout workflow groups, all three existing
profile/draft recovery groups and all three external-recovery groups passed with
no browser page errors. Frontend lint, production build and `git diff --check`
passed. The existing external-recovery test now matches the exact inline success
message so the simultaneously visible toast cannot make its locator ambiguous.
