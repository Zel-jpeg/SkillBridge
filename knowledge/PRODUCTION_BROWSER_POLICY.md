# Production browser policy preparation

A04 is verified locally on the production build with the exact headers from
`skillbridge-frontend/vercel.json`. No deployment or provider setting was changed.
The user manages the existing Vercel/Railway release and subscription.

The original policy blocked Nominatim requests, branding images from the configured
project, and Google Identity Services connection/style paths. The correction adds:

- `connect-src`: `https://nominatim.openstreetmap.org` and
  `https://accounts.google.com/gsi/`.
- `style-src`: `https://accounts.google.com/gsi/style`.
- `img-src`: only the configured public project origin,
  `https://xlkyxnljcvpkdwnqaskc.supabase.co`.

The Railway API, PSGC, Google API, existing script/frame/photo/tile allowances and
other security headers remain. No generic HTTPS or wildcard Storage allowlist was
added. The public Storage URL is not a credential. If the project/API domain
changes, update the exact corresponding policy and retest before deployment.
Google's [official setup guidance](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
documents the GIS connection and stylesheet paths. Actual Google consent/client
origins remain a live integration check for V05.

`work/defense_audit/a04_policy_browser.py` serves the current built `dist` at
localhost5179 with the exact response headers and SPA rewrite. It verifies the
actual header, runs the built Google sign-in UI through a synthetic GIS adapter
and the real disposable PostgreSQL-backed authentication endpoint, then exercises
11 required resource cases. All external origins are intercepted with synthetic
responses: Google script/connection/style/frame/API, Leaflet script/style/tiles,
PSGC address data, Nominatim, profile photo and company branding. No external
service availability or credentials are inferred from adapters.

Before: geocoder, branding, GIS style and GIS connection failed under CSP.
After: all 11 resource cases and built sign-in pass, with zero page errors.
Unrelated images, another Storage project and unrelated connections still fail;
the three recorded policy violations are those intentional negative cases only.
Evidence: `a04-policy-before.txt`, `a04-policy-after.txt`,
`a04-artifacts/{before,after}.json`, `a04-production-build.txt` and the final
screenshot in `work/defense_audit/`. Static-server connection-aborted diagnostics
at browser shutdown are not failed assertions.

The built frontend uses the existing Railway origin. Publishing, reading the
actual served Vercel policy, live Google/provider/storage calls, production CORS,
SSE/proxy behavior and actual hosted role workflows are still V05. This local
pass does not claim that a paused Railway service is live.
