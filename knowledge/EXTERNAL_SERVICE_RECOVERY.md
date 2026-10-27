# External-service recovery

E02 was verified locally with synthetic data and mocked providers. This does not
establish live provider availability, credentials, quotas or hosted policy.

The 26 October dashboard road-route addition is documented in
[student company browsing](STUDENT_COMPANY_BROWSING.md#dashboard-saved-location-and-road-routes).
Its public OSRM reads are explicit-selection-only, bounded to eight seconds,
rate-limited, abortable and cached only for the current map. No-route/provider
failure retains all map pins and offers Retry route; it does not substitute an
invented road line. Clear route and page teardown remove route layers, and saved
pin changes cannot keep an obsolete route visible.

Browser address/geocode requests have an eight-second deadline and abort support.
Address errors identify the failed level and offer an explicit retry without
discarding unrelated fields. Parent changes cancel obsolete child requests;
unmounted components ignore late results. Invalid response/cache shapes are not
used. A failed geocode shows a default Panabo **view**, with explicit guidance;
it never creates a saved pin or distance evidence. Zero coordinates remain valid.

Student setup and profile address dropdowns group API-returned Davao provinces
first, followed by all other provinces in alphabetical order. No province is
automatically selected; API names and codes are preserved. Company address
dropdowns retain their alphabetical list. Boarding students provide both boarding
and permanent home addresses, but the profile saves one `pinLat`/`pinLng` pair.
The map's “View boarding house” and “View home address” buttons only recenter the
view; clicking or dragging sets the single pin. Students should pin where they
will stay during OJT. Company distances and location similarity use that saved
pin, and staff previews show one student marker alongside company markers.

Profile, setup, results, dashboard, staff location previews and all five company
overview/view/edit maps share the bounded Leaflet loader. Script/CSS denial,
invalid library or timeout rejects cleanly and
allows retry. Map/tile failures have visible retry guidance; saved coordinates,
results and drafts remain usable. Retrying result/dashboard maps rebuilds their
markers. Failed initializers release partially created maps. The CDN remains a
runtime dependency; local tests do not prove it will be reachable in deployment.

Company images retain their existing safe contract: only transformed WebP is
uploaded; storage failure leaves prior details/reference unchanged; rollback
cleans only owned unreferenced new objects; retired objects are cleaned after
commit. Cleanup failure logs a safe maintenance diagnostic without undoing the
committed save. Failed remote photos use initials, with no download of provider
photos. Storage calls use connect/read bounds `(3.05, 10)` and reject redirects.

Google lookups retain `(3.05, 10)` deadlines and distinguish invalid credentials
from retryable provider failures. Google and Brevo now reject redirects instead
of forwarding credential-bearing calls. Email uses `(5, 15)` HTTPS bounds;
explicit SMTP fallback uses the configured five-second timeout. Provider
acceptance, in-process queue admission and delivery remain distinct. Failed
optional enrollment dispatch preserves the enrollment and reports failure;
it does not claim delivery. The in-process queue is not a durable delivery queue.

Evidence under `work/defense_audit/`:

- `e02-postgres.txt`: 248 API tests passed on disposable PostgreSQL, including
  mocked provider deadlines/denial/redirects, image rollback/owned cleanup,
  notification failure/privacy and existing Google/NLP fallback tests.
- `e02-unit-final2.txt`: 114 frontend tests passed, including hung fetch abort,
  cancellation/invalid geocode and map denial/timeout/CSS failure/retry.
- `e02-browser-final4.txt`: three grouped browser scenarios passed with no page
  errors: map/tile failures and retained zero pin; address failure/invalid data/
  obsolete selection recovery; broken company photo initials. External requests
  were intercepted. Earlier fixture errors are retained, not passing evidence.
- `e02-results-regression.txt`: five recommendation states passed;
  `e02-profile-regression.txt`: three profile/draft cases passed.
- Final lint/build results are recorded in the continuous checklist. The five
  pre-existing lint warnings remain. Broader device, workflow, security,
  performance and actual hosted integration acceptance remain separate tasks.

During the resumed audit, the company maps were found to retain legacy loaders,
so E02 was explicitly reopened. They now share bounded recovery, preserve drafts
and zero-coordinate pins, and escape catalog text in map markup. Company address
search may retry a city after an empty barangay result; neither an unavailable
lookup nor the default Davao view creates a pin. The original five surfaces keep
their Panabo default. The instructor edit initializer now validates coordinates
instead of testing their truthiness.

Resumed evidence: `e02-company-browser-resumed-final.txt` passed both staff roles,
including denial, retry, retained drafts, zero pins, invalid geocode and confirmed
save; no page errors or executed catalog markup. `e02-browser-resumed-regression.txt`
passed the three general recovery groups. `e02-external-unit-resumed.txt` passed
five focused tests, including bounded/cancelled city fallback; the full frontend
run passed116 tests. Resumed lint has zero errors/warnings and build passed.
`e02-backend-resumed-approved.txt` passed37 PostgreSQL provider/image/auth tests.
Earlier failed browser fixture steps and sandbox connection denial are retained;
they are not passing evidence. Security review and hosted integration acceptance
remain separate tasks.

The former Supabase skill path was absent during the original audit; it is now
available and was read on resume. Storage verification uses source and mocked
tests; no live Supabase calls or migrations were performed. Do not infer hosted
readiness from this local evidence.
