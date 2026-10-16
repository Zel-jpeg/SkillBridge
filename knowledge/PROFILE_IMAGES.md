# Company branding and Google student photos

## Audit and implementation scope

The repository was clean before this feature. The audit inventoried first-party
application source, tests, migrations, configuration, knowledge and references.
Dependency trees, virtual environments, generated artifacts, binaries and secret
files were excluded from content inspection. Current code was traced from routes
through company CRUD, manual response dictionaries, Google userinfo, normalization
hooks, shared images, placement snapshots, selected detail objects and recipient
SSE invalidation. Existing settings configured PostgreSQL, not Storage access.
No secret file or production database was inspected.

Previously companies had no image field; forms sent JSON. Placement serializers
omitted student photos, and placement Avatars omitted photo props. Most other
student identities already propagated provider photos. Avatar retained its error
flag after a URL change; StudentProfile duplicated fallback handling. Catalog
events already covered recommendations/placements; identity events lacked the
placement topic. Read-only selections already reconcile with refreshed lists;
edit drafts intentionally retain their initial values.

The implementation adds current branding without changing competency evidence,
ranking weights, placement eligibility or assignment score snapshots. It uses
existing Django JWT authorization, Axios, API cache and recipient SSE streams.
No Supabase Auth, student uploads, Google-photo rehosting, extra polling, image
bytes in database/browser storage/events, or remote images in exports were added.

## Storage setup (manual; no external services provisioned)

1. In the intended Supabase project, create a dedicated **public** bucket named
   `company-branding`. Set allowed MIME types to `image/webp` and maximum object
   size to **204800 bytes** (200 KiB). The application never uploads originals.
2. Leave client INSERT/UPDATE/DELETE policies absent for this bucket. Do not grant
   `anon` or `authenticated` writes. Public reads are intentional; Django checks
   the existing admin/instructor roles before performing privileged writes.
3. Configure backend secrets/environment using
   [the blank example](../skillbridge-backend/.env.example):

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_STORAGE_URL` | HTTPS project API origin, e.g. `https://<ref>.supabase.co` |
   | `SUPABASE_STORAGE_SERVICE_KEY` | Backend-only legacy `service_role` key |
   | `COMPANY_IMAGE_BUCKET` | `company-branding` (default) |

   A PostgreSQL URL/password does not authorize Storage. Never use a Django JWT
   as a Supabase token. Never expose the service key in Vite, browser storage,
   fixtures, documentation or logs. The server-managed prefix is `companies`.
4. Install the backend requirements (including pinned Pillow 12.3.0), confirm
   `PIL.features.check('webp')`, and apply Django migration
   `0014_company_image_key` to the intended environment during normal deployment.
   This work does not apply migrations to a production database or deploy code.
5. Verify a synthetic branding upload/replacement/removal in a separate test
   project before enabling real uploads. Tests here mock Storage and Google.

**Public-read branding is accessible outside SkillBridge to anyone with its URL.**
Never place student photos, student records or private documents in this bucket.
Removed objects may remain in browser/CDN caches until cache expiry; public
branding must not contain sensitive content. Deletion is not access revocation.

Supabase documents [public asset URLs](https://supabase.com/docs/guides/storage/serving/downloads)
and recommends [new paths instead of overwrites](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
to avoid stale CDN content. The implementation uses the Storage REST API through
the existing `requests` dependency, avoiding a separate Supabase SDK/Auth client.

## Request and conversion contract

Existing JSON callers remain supported. Image-bearing create/PATCH requests use
multipart with one `payload` field containing a JSON object and an `image` file.
Address objects, null coordinates and position arrays are explicitly decoded and
validated. Legacy no-file multipart forms remain accepted; structured address
and positions fields must contain valid JSON.

| `image_action` | File | Result |
| --- | --- | --- |
| omitted / `unchanged` | none | Preserve current reference |
| `replace` | exactly one | Validate, convert, upload and switch reference |
| `remove` | none | Clear reference after save |

Clients cannot submit arbitrary `image_key` or `image_url` values. The database
stores an application-owned `companies/<uuid>.webp` key; the server consistently
derives `image_url`. Recommendation dictionaries add `company_image_key` and
`company_image_url`; nested company objects add `image_key` and `image_url`.
Existing fields/shapes remain intact. No signed URL is persisted.

All conversion limits live in
[company_images.py](../skillbridge-backend/api/company_images.py):

| Limit | Value |
| --- | --- |
| Compressed input | 5 MiB |
| Decoded pixels | 20,000,000 |
| Maximum input side | 10,000 pixels (also bounds extremely thin images) |
| Output box | 512 × 512, preserve aspect ratio, never upscale |
| Output bytes | At most 200 KiB |
| Encoding work | At most nine fixed quality/dimension attempts, WebP method 4 |
| Storage requests | 3.05 s connect / 10 s read, no retries or redirects |

Static JPEG/PNG/WebP content is identified from decoded bytes, not filenames or
client MIME. Unsupported/SVG, corrupt, animated/multiframe and oversized images
return clear 400 responses. Dimensions/pixels are checked before full decode.
EXIF orientation is applied before resizing. A new pixel-only RGB/RGBA canvas
strips EXIF, ICC, XMP, PNG text, comments and DPI; transparency is preserved.
Only actual WebP bytes are sent with `.webp` keys and `image/webp` content type.
Exhausting the fixed output budget returns a validation error.

Browser type/size checks and previews are convenience checks. File objects stay
in form memory; temporary object URLs are revoked on replacement/unmount. The
server enforces content rules even if browser validation is bypassed. A failed
save retains the form input for retry and does not create a partial company.
The shared admin/instructor picker shows its current/selected-image row above a
centered dashed drop area, with a logo preview, filename, size and save status.
Upload/replace, remove and undo controls support keyboard-accessible selection.
The drop area accepts one image at a time using the same type/size checks and
preserves the previous selection on invalid drops. Files transfer when the
company is saved; the selected-image row shows readiness rather than simulated
upload progress.
Company editing uses a shared spacious dialog: details/logo and expandable
positions on the left, address and an interactive map on the right. Narrow
screens stack the sections in a scrollable body while keeping save/cancel visible.
Admin creation retains its two-step flow; editing saves directly after the same
name/address validation. Existing instructor position title/tag/slot editing is
retained inside the expandable section. Admin position mutations remain on the
company cards. Native dialog behavior supplies focus trapping and Escape handling.
Position fields use separate role cards, a larger resizable tags area, visible
comma-separated guidance, and a distinct slots row; tag suggestions still use
the existing endpoint.

## Lifecycle, permissions and live updates

Admin create/delete and existing instructor/admin edit access boundaries remain.
Company updates/deletion lock the company row. Conversion happens before upload;
the new unique object uploads before the reference saves inside a transaction.
The old reference survives conversion, upload or database failures. Failure after
upload attempts orphan cleanup outside the rolled-back transaction. Old objects
are deleted only in an after-commit callback, including successful company
deletion. Placement history still prevents company deletion.

Only exact application-owned keys in the configured bucket/prefix may be deleted;
cleanup also checks that no company currently references the key. Concurrent
replacement/removal serializes on the row; delayed cleanup cannot delete a later
replacement's current key. No user-provided URL/key is used as a deletion target.

Cleanup failures log `Company image cleanup failed for owned key ...; manual
cleanup required` without credentials or response bodies. A committed operation
remains successful. Operators can retry deletion through the Storage API after
confirming that the logged key is unreferenced. A process crash between Storage
and database work can also leave an orphan; cross-service atomicity is not
possible. No automatic remote cleanup job or external-service changes are made.

Catalog mutations publish existing catalog/results/students/placements topics
after the complete operation commits. The acting client also invalidates those
topics through the existing cache. Google identity mutations now include
placements for authorized recipients. Notifications contain only scoped
invalidation metadata, never photo data or student records. Generated reports
remain explicit snapshots; score/history snapshots are not rewritten.

Google userinfo remains the sole photo source. Successful sign-in refreshes the
stored provider URL; a missing picture clears it so initials display. Existing
role registration follows that same policy and returns an ID for scoped identity
notifications. Photos do not synchronize before the student's next sign-in.
Client profile edits cannot change `photo_url`; the serializer marks it read-only.

## Screen coverage

| Role / screen | Company branding | Student Google photo |
| --- | --- | --- |
| Admin companies | Cards, add/edit preview and controls | Not applicable |
| Instructor companies | Cards and live detail; edit preview and controls | Matched students / best match (existing) |
| Student dashboard | Top recommendations and approved placement | Shared live header (existing) |
| Student results | Recommendation cards, browse-company cards, approved placement | Shared live header (existing) |
| Admin dashboard / users | Company text summaries remain text | Cards, rows, top matches, detail (existing) |
| Instructor dashboard / enrolled students | Shared placement and recommendation details | Cards, rows, detail and leaderboards (existing) |
| Student detail / assessment detail | Shared recommendation and placement cards | Shared student detail avatar; admin assessment roster and selected detail |
| Admin / instructor placements | Company groups, detail and approved summaries | Suggestions, detail/action dialogs, manual student picker, approved groups and history |
| Student profile | Approved placement where rendered | Shared Avatar replaces duplicate fallback |
| Assessment header / pre-start | Not applicable | Shared live ProfileMenu; cached identity remains initial fallback |
| Tables / selects / maps / PDF / spreadsheet exports | Useful existing text/pin presentation retained | Exports retain existing text-only identities |

Image components reserve dimensions, use logo `object-contain`, accessible
initials for missing/broken URLs, lazy loading for lists and `no-referrer`.
Changed URLs can recover after a previous URL fails. Read-only open details
resolve fresh company/student data; unsaved edit fields are not reseeded by SSE.

## Verification

All fixtures use synthetic records and generated images. Automated application
tests use isolated databases and mocked external services. With an explicit user
exception on 2026-10-16, one generated image was uploaded to the configured live
Storage bucket, read anonymously, and deleted. No live Google account, email,
agent-applied production migration or company/student record change was used.
Verification completed on 2026-10-16:

| Check | Result |
| --- | --- |
| Frontend Node tests (`node --test` over existing `src/**/*.test.mjs`) | 58 passed |
| Frontend lint | 0 errors; 5 pre-existing warnings |
| Frontend production build | Passed; existing large-chunk / XLSX import warnings |
| Django system checks | Passed |
| Migration consistency (`makemigrations --check --dry-run`) | No changes detected |
| Backend modules listed below | 119 discovered: 117 passed, 2 PostgreSQL-only skips |
| Focused backend rerun after environment setup | 29 passed; 1 PostgreSQL-only skip |
| Configured database, read-only | Migration `0014_company_image_key` applied; `api_company.image_key` exists |
| Configured Storage, live synthetic object | Upload, anonymous WebP read and delete passed; authenticated listing confirmed removal |
| Headless Chrome, real React/Django/SSE with mocked Storage/Google | All 9 grouped scenarios passed; no page errors |
| Refreshed uploader UI | Keyboard chooser, drag/drop and invalid/oversized/multiple-file handling passed; previous selection preserved; remove/undo, 320/375 px layouts and dark mode reviewed |
| Company editor and position UI | Both roles passed desktop columns, logo-above-drop-area ordering, drop/replace/remove/undo, real Leaflet click/drag/clear, mobile fixed footer and focus trapping; admin address validation/retry and instructor title/tag/slot edits plus mocked tag suggestions passed |
| Visual review | Mobile company edit, student dashboard and instructor placements screenshots reviewed |
| Final diff / documentation links | No whitespace errors; scoped feature files only |

Browser checks covered add/replace/remove, failed upload and retry without a
duplicate company, preview URL revocation, public branding across roles, open
read-only selections, changed-URL Avatar recovery, Google no-picture clearing,
assessment identities, placement groups/history and score snapshot preservation.
Unsaved company/student fields and placement remarks survived live updates.
Screenshots and synthetic results are under ignored `tests/artifacts/profile-images`.

Storage requests and Google userinfo were mocked in automated application tests.
The separate live Storage check used the actual backend conversion/upload/delete
helpers and configured service credential. The public `company-branding` bucket
accepted only `image/webp`, with a 1 MiB bucket limit; the application still
enforces its stricter 200 KiB output limit. Generated JPEG input of 594615 bytes
at 1024 × 768 became valid WebP of 102496 bytes at 512 × 384. Anonymous GET returned
HTTP 200 and `image/webp`, with bytes identical to the converted upload. Deletion
succeeded and a scoped authenticated listing confirmed the object was absent.
This does not verify client write policies, CDN eviction, deployed application
configuration or real Google accounts. No dedicated PostgreSQL test configuration
was available: the row-lock concurrency test and the existing cross-process
PostgreSQL SSE test were skipped.
Deterministic delayed-cleanup interleavings and recipient/SSE behavior passed
against isolated SQLite; they do not establish PostgreSQL concurrency behavior.

Representative deterministic RGB-noise fixture measurements (Pillow 12.3.0):

| Input | Input dimensions / bytes | Output dimensions / bytes |
| --- | --- | --- |
| JPEG | 1024 × 768 / 473294 | 512 × 384 / 103516 |
| PNG | 1024 × 768 / 2363413 | 512 × 384 / 105564 |
| WebP | 1024 × 768 / 539342 | 512 × 384 / 102412 |
| PNG with random alpha | 512 × 512 / 1049688 | 256 × 256 / 87376 |

These are generated fixtures, not universal compression ratios. Small originals
can be smaller than WebP; only the explicit output cap is guaranteed.

Run isolated backend checks without loading normal database secrets:

```powershell
$env:PYTHON_DOTENV_DISABLED='1'
$env:DEBUG='True'
$env:SECRET_KEY='synthetic-local-test-key-not-for-deployment'
venv/Scripts/python.exe manage.py check --settings=core.test_settings
venv/Scripts/python.exe manage.py makemigrations --check --dry-run --settings=core.test_settings
venv/Scripts/python.exe manage.py test api.test_company_images api.tests api.test_multiple_assessments api.test_combined_competency api.test_management_step4 api.test_change_events api.test_nlp_diagnostics api.test_nlp_evaluation --settings=core.test_settings --noinput
```

SQLite tests do not prove PostgreSQL locking or cross-worker SSE delivery. For
those, use the existing dedicated `core.sse_postgres_test_settings` and `SB_TEST_DB_*`
variables naming a disposable `test_` database. Never reuse normal DB credentials.

The [browser fixture](../skillbridge-frontend/tests/profile_images_server.py) runs
on port 8019 with a disposable SQLite file and in-memory Storage/Google mocks.
Run Vite on 5179 with `VITE_API_URL=http://127.0.0.1:8019`, then run
[the Playwright checks](../skillbridge-frontend/tests/profile_images_playwright.py)
with the backend Python environment and installed headless Chrome. Alternatively,
run the Playwright script with `--api-thread` to create/serve the disposable API
in that process (start only Vite separately). This was used for verification
because sandboxed child servers could bind but local connections were denied.
Use an explicitly local `VITE_API_URL` or a temporary Vite `define` override when
the environment injects a deployed API origin. All nonlocal requests are blocked
or fulfilled with synthetic data. Artifacts are ignored.

## Changed files and purpose

| Files | Purpose |
| --- | --- |
| `api/models.py`, `api/migrations/0014_company_image_key.py` | Additive company object key |
| `api/company_images.py` | Central conversion limits, request decoding, URLs, Storage and lifecycle |
| `api/views.py` | Atomic image CRUD and compatible payload/photo propagation |
| `api/serializers.py` | Provider photo read-only contract |
| `api/change_events.py` | Placement identity invalidation |
| `core/settings.py`, `requirements.txt`, `.env.example` | Backend-only configuration and Pillow |
| `api/test_company_images.py` | Conversion, lifecycle, permission, payload, Google/SSE and PostgreSQL concurrency tests |
| `src/components/CompanyImage.jsx`, `CompanyImageInput.jsx` | Stable logo identity and optional preview/file controls |
| `src/components/CompanyEditDialog.jsx`, `companyEdit.css` | Shared responsive company editor, fixed footer and scoped layout styles |
| `src/utils/companyImages.js`, `.test.mjs` | Multipart construction, browser checks and contract tests |
| `src/components/Avatar.jsx`, `src/pages/student/StudentProfile.jsx` | URL recovery and shared photo fallback |
| `src/hooks/admin/useAdminCompanies.js` | Multipart saves, image normalization and protected-delete feedback |
| `src/hooks/instructor/useInstructorCompanies.js` | Multipart saves and current branding in the existing shared cache |
| `src/pages/admin/AdminCompanies.jsx` | Optional image controls within the existing two-step form and company cards |
| `src/pages/instructor/InstructorCompanies.jsx` | Optional edit controls, company cards and live detail branding |
| `src/pages/admin/AdminAssessments.jsx` | Shared student photos in the assessment roster and selected detail |
| `src/pages/student/StudentDashboard.jsx`, `StudentResults.jsx` | Company branding on student cards |
| `src/components/AssessmentStudentDetail.jsx`, `placements/PlacementStatusCard.jsx` | Shared recommendation/placement branding |
| `src/pages/placements/PlacementsPage.jsx` | Company grouping/detail, missing photo props and live action identities without replacing remarks |
| `src/api/queryInvalidation.test.mjs` | Existing topic coverage for branding/identity |
| `tests/profile_images_server.py`, `profile_images_playwright.py` | Disposable mocked integration and actual browser checks |
| `knowledge/PROFILE_IMAGES.md`, `PROJECT_OVERVIEW.md` | Audit, setup, behavior, coverage and verification |

Backend and frontend paths in the last table are relative to their respective
application directories. Existing user changes were absent at the initial audit.
