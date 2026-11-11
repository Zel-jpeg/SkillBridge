# Advanced recommendation tools review and design

## Implementation checkpoint · 11 November 2026

Active feature branch: `codex/advanced-recommendation-tools-20261111`, based on
`70e461e` from the unmerged dashboard branch. Main remains unchanged. Unrelated
working-tree edits from the earlier collection/score work are preserved.

Implemented:

- Reviewed two-tab interface with scoped natural-height dialogs, one scrollable
  body, narrow-screen controls, light/dark styling, visible keyboard focus,
  hover feedback and asynchronous loading/error states. Coverage and measured
  case results open separate dialogs; no inline expanding sections remain.
- Real Placements refresh button and shortcut from model settings. Selected
  batch is the default; an empty selection cannot submit. Whole system is an
  explicit choice followed by review confirmation. Shared institute batches
  appear within appropriate program choices with their full shared scope.
- Consistent Stanza resource resolution: explicit environment directory,
  build-packaged `.nlp/stanza`, installed version's normal default, or the former
  home-directory resources when present. Strict runtime rechecks distinguish
  installed files from successful execution. Saving rejects an engine that
  cannot process text; inspecting configuration no longer creates a row.
- Bounded successful-document preprocessing cache for Stanza, retaining strict
  failure handling and the production fallback behavior. Pure matching accepts
  strict preprocessing for comparisons without changing ordinary callers.
- Available 200-scenario synthetic dataset and admin-only GET/POST comparison:
  50 scenarios per IT, IS, Social Work and Tourism test program. Forty distinct
  evidence patterns each use five location variants; this is disclosed rather
  than claimed as 200 independent proficiency samples. Exact program/framework
  isolation, unequal assessment raw/max pooling, missing/zero gates, descriptions,
  tags and production numerical/position-specific matching helpers are used.
- Fixed reference labels remain outside generated student inputs. Full-workflow
  agreement, ranked-only/gate measures and NLP-only diagnostics are distinct.
  Historical API comparison modes remain explicitly labeled reference methods.
- Build manifests include Small, Medium and Stanza; Railway build provisioning
  uses CPU PyTorch and downloads Stanza resources into the application image,
  then strictly probes every model. Requests never download models. Existing
  local resources were reused, not downloaded again.

Checks completed so far:

- Backend check and the final 107 relevant backend regression tests passed on
  isolated SQLite settings, without Supabase access.
  Three additional existing configuration/recommendation API regressions passed
  after making their optional-model readiness fixture explicit (110 checks in
  total). Real installed-model behavior was separately exercised in the browser.
  An initial command named a nonexistent test module; rerunning the correct
  module set passed. An initial no-dotenv invocation lacked a synthetic test
  key/DEBUG setting; corrected process-only test settings resolved it.
- All 360 frontend Node tests passed. Frontend lint and production build passed.
- Strict local probes passed for actual spaCy Small, Medium and Stanza without
  fallback. Real pure 200-case comparison passed for all three in about 57 s
  locally. Full-workflow Top-1 agreement was 91.5%, Top-3 99.5%; separate NLP-only
  Top-1 63.89%, Top-3 97.22% across 180 ranked cases. All 20 no-positive-evidence
  gates agreed. These are synthetic reference-label results, not field accuracy.
  Synthetic-only output: `work/advanced-tools-workflow-200-local.json`.
- Seven real-API UI browser groups passed with no page errors, including
  permission boundaries, available data, keyboard/focus, loading/error recovery,
  scope/cancel safety and desktop/tablet/dark-phone containment. Browser testing
  caught a rejected GET cache-buster (`_t`); the endpoint and regression now
  support that transport parameter only on GET. A subsequent narrow-screen
  specificity correction is scoped to this dialog variant.

Final browser receipts:

- `work/advanced-tools-browser-itfqfuzm/`: eight real-API groups passed, including
  actual 200-case execution with all three engines, zero comparison writes,
  result search/pagination/model inspection and tab preservation, actual strict
  model recheck/save with preserved evidence, shared batch refresh and explicit
  whole-system cancellation, plus short desktop/tablet/dark-phone geometry.
  Its final additional error test hit a test-locator collision between a global
  toast and an inline alert, rather than an application failure.
- After scoping that locator to the comparison panel,
  `work/advanced-tools-browser-sjgzgq4g/` passed all eight UI/error-recovery groups
  with zero page errors on the final fresh production bundle. This includes
  real metadata recovery after an intentionally intercepted HTTP 503. Across
  both receipts, ten distinct acceptance groups were verified. Desktop and
  final 390px dark screenshots were inspected; owned test servers were stopped.

Implementation and local verification are complete. Synthetic test refresh and
model-save actions affected only disposable test databases. No live model
selection, recommendation refresh, migration, deployment, merge or GitHub push
occurred. Unrelated pre-existing edits remain outside the feature changes.

Hosted limitations: actual Linux image installation, memory under two workers,
hosted timeout behavior and deployed authenticated model execution still require
release verification. A successful Windows/local comparison is not a hosted pass.

### Social Work institute label correction · 11 November 2026

The user confirmed replacing Social Work's temporary institute label with
**IBPA → BSSW**, verified against
[DNSC's current program offerings](https://dnsc.edu.ph/program-offerings/).
Only synthetic dataset metadata changed. All 17 workflow evaluation tests passed;
coverage still returns 200 scenarios overall and 50 for Social Work. A direct
before/after comparison confirmed identical matching-input fingerprints and an
updated dataset fingerprint. No category evidence, reference labels, ranking
calculations or live institute/program records were changed. This correction
remains on the same unmerged local feature branch.

## Review checkpoint · 10 November 2026

Current branch: `codex/admin-dashboard-drilldown-20261110`, application HEAD
`70e461e`. Main remains `0fb2c1d`. The user requested a responsive-height modal,
working Stanza selection and comparison tests representative of the current
system, with ImageGen previews for design review before implementation.
Application code/model configuration and school records were not changed in this
review. Existing unrelated working-tree changes are preserved.

## Confirmed findings

- `DialogShell` defaults to a fixed `92dvh` height. The advanced tools caller
  uses that default, leaving a large empty region with short contents. The
  appropriate fix is scoped content-height behavior with a viewport maximum and
  one scrolling body; other student/assessment dialogs must retain their rules.
- Local database-free strict probes successfully processed two synthetic texts
  with actual `spacy_sm` and `spacy_md`, without fallback. The initial sandbox
  Stanza probe raised `ResourcesFileNotFoundError`; this did not establish that
  the user's previously downloaded models were absent. Follow-up inspection
  found the full English resources under the normal Windows StanfordNLP versioned
  cache. With `STANZA_RESOURCES_DIR` pointed to that existing cache for the probe
  process, actual `stanza_en` processed both texts successfully with fallback
  disabled (`actual_model=stanza_en`, no fallback reason). The probe took 18.545 s
  including imports/model loading, not a benchmark or hosted latency measurement.
  No model download, package installation or persistent configuration change was
  necessary for this verification. The earlier missing-resource conclusion was
  too broad; the confirmed problem is resource discovery/path consistency.
- There is also a path consistency issue: `model_status()` assumes the old home
  resource directory when `STANZA_RESOURCES_DIR` is unset, whereas installed
  Stanza uses its versioned platform cache. Loader, readiness checks and installer
  must agree on a resource directory; a directory merely existing is not proof
  that tokenization/lemmatization can load and process text.
- Prepared comparison fits a corpus-wide NLP-only benchmark. Real-placement
  comparison still uses the old 60/25/15 hybrid reference, the latest individual
  assessment and unscoped categories/candidates. Neither evaluates the current
  combined-evidence, program-scoped, position-specific assessment-led order.
- Existing comparison correctly avoids fallback metrics and data writes. Preserve
  those protections and retain the old benchmark with an explicit historical
  method label rather than relabeling its results as current-system accuracy.

## Proposed interface

- One compact dialog with Model settings and Model comparison tabs. Natural
  content height; bounded by available viewport space. Header/tabs/footer remain
  usable while long comparison details scroll. Controls/model results stack on
  phones. Preserve keyboard navigation, close/focus handling and dark mode.
- Model settings shows active global model, explicit save, and truthful readiness
  for all three preprocessors. Failed/missing resources explain what is missing.
  A strict health check must distinguish actual execution from production fallback.
- Recommendation maintenance should use the existing institute/program picker
  on Placements, with a contextual link from the tools instead of duplicating an
  immediate all-active-batch rerun control.
- Comparison defaults to a new current-system workflow simulation, shows its
  scope and fixed test inputs, and separates Top-1 agreement/Top-3 hit rate from
  student Match percentages. Additional metrics, case diagnostics, hashes and
  text inputs are secondary disclosures. Unavailable models have missing metrics,
  not zero or scores borrowed from another model.

ImageGen desktop previews, design only:

- Settings: `C:/Users/acer/.codex/generated_images/01a1a6b3-e6a7-7ef3-9aa1-ffe270ca30de/exec-6139a1ae-6c88-4f25-8b61-9200a1f04054.png`
- Comparison: `C:/Users/acer/.codex/generated_images/01a1a6b3-e6a7-7ef3-9aa1-ffe270ca30de/exec-266bb9fa-656d-4c9e-82e6-aea846fa5033.png`

The comparison preview deliberately has no numeric results; no comparison run or
accuracy measurement is claimed. Its Stanza setup label reflects the initial
discovery failure and is superseded by the successful explicit-directory probe
above: implementation must show verified runtime readiness, not assert that files
need downloading again. Background screens in generated images are illustrative
and do not define new pages/workflows.

## Implementation and verification sequence

### Revised preview decisions, 10 November 2026

The user requested another design preview before implementation:

- Use a real **Refresh saved recommendations** button in OJT Placements. A
  shortcut from model settings may open the same scope chooser. Opening it or
  saving a model must not start a refresh.
- Require an explicit scope: **Selected batch** (default, with institute,
  program and batch selection) or **Whole system** (all active batches across
  institutes/programs). Missing batch selection must never mean whole system.
  Review the affected scope before starting; preserve assessment evidence and
  approved decisions. Include retained institute-shared batches in the chooser
  with their shared scope clearly identified rather than excluding them through
  a program-only filter.
- Prepare **200 synthetic student scenarios**, 50 each for the IT, IS, Social
  Work and Tourism test programs. These are proposed test inputs, not a dataset
  already executed. Fix expected labels independently of model predictions and
  evaluate the same inputs/candidate sets for every model.
- Remove expandable detail rows/accordions. **Test data & coverage** opens a
  focused dialog explaining program counts, evidence sources, scenario coverage
  and dataset/method versions. **Metrics & case results** opens a separate dialog
  for metric definitions, per-program results and individual case diagnostics;
  disable it until results exist. Raw text/input details belong inside those
  dialogs, without exposing real student records.
- Settings previews reflect successful strict local probes for all three
  models, while hosted availability remains unverified. Implementation must
  obtain readiness from the actual runtime rather than hardcode these labels.
- Keep content-sized dialogs with a viewport height cap, contained scrolling,
  visible close/actions and responsive stacked controls on narrow screens.

Revised ImageGen previews (design only; no app changes or comparison run):

- Settings: `C:/Users/acer/.codex/generated_images/01a1a6b3-e6a7-7ef3-9aa1-ffe270ca30de/exec-5d3f9ab3-6700-4d54-9248-ce4a85d6d70e.png`
- Comparison: `C:/Users/acer/.codex/generated_images/01a1a6b3-e6a7-7ef3-9aa1-ffe270ca30de/exec-1200d840-ca9f-4265-9cf6-a9c79ec2d946.png`
- Refresh scope: `C:/Users/acer/.codex/generated_images/01a1a6b3-e6a7-7ef3-9aa1-ffe270ca30de/exec-58bca308-15b6-4777-a75a-1c1091f7099e.png`

These supersede the older previews' Stanza setup warning and disclosure rows.
Generated background navigation/table counts are illustrative and must not be
implemented as new features or treated as real system data.

- [x] Inspect current runtime, model selection, comparison and modal callers.
- [x] Strictly probe local spaCy/Stanza using synthetic text and no database.
- [x] Generate separate content-sized settings/comparison design previews.
- [x] Apply the reviewed interface on a separate feature branch based on this
      current unmerged work; do not merge or push without instruction.
- [ ] Make Stanza resource resolution/readiness consistent and reuse the already
      downloaded local English resources. Verify selected/actual model reporting
      and unavailable/error cases through the application. Provision resources
      during hosted builds, outside request handling. Do not redownload local
      files unnecessarily. Installation needs network/filesystem access only
      where resources are genuinely absent.
- [x] Add an explicitly versioned current-workflow evaluation using shared pure
      production functions: fixed combined assessment evidence; exact program/
      framework category IDs; eligible per-program positions; category and position
      descriptions/tags; one common TF-IDF basis per candidate set with required-
      category student views; numerical minimum/Match policy, supporting NLP and
      location, and stable tie ordering. No production persistence helpers.
- [x] Reuse/extend the existing multi-program synthetic fixture approach for IC,
      Tourism, Social Work and arbitrary program names, with fixed expected labels
      established independently of model predictions. Cover multiple assessments,
      missing/zero categories, score/minimum ties, location preferences, shared
      catalogs and foreign-framework exclusion. Do not insert expected role names
      or labels into student matching text.
- [x] Separate current-workflow ranking agreement from NLP-only diagnostics so
      assessment-led models tying is an honest result. Measure/disclose actual
      loading, preprocessing and ranking timing consistently.
- [x] Replace or explicitly separate approved-placement agreement: use valid
      batch/combined evidence and compatible candidates, and distinguish current
      evidence re-evaluation from historical snapshot reconstruction. Saved
      approvals are not independent ground truth or placement-success outcomes.
- [x] Verify strict/no-fallback comparisons, all model/resource failures,
      input/method versions, reproducibility and zero writes on isolated tests.
- [x] Test both dialog tabs before/after results, loading/error/empty states,
      shorter viewports, phones/tablets/desktop, dark mode, keyboard/focus and
      scroll containment. Run relevant API tests and frontend lint/build.

Next step: review the implemented feature locally, then perform the Linux/hosted
release checks below before deployment. Main is not merged and GitHub is not
pushed. Local strict resource handling is complete; hosted build/runtime checks
remain separate from the successful local verification.

## Local and hosted readiness review

The user additionally requested consistent local/live operation when deploying.
The current `requirements-production.txt` includes both spaCy wheels and
Stanza. The web build installs CPU PyTorch, downloads the English resources into
the image and probes all three models before collecting static files. Verify
that the active Railway build uses this command. The Windows run verifies the
local installation. The Linux image and hosted model execution remain open.
[Current Railway handoff](RELEASE_AND_RECOVERY_HANDOFF.md#current-release-and-environment-settings)

Release criteria for the implementation:

- [x] Confirm existing local English files and actual strict Stanza processing.
- [x] One consistent resource path used by installation, status and
      runtime; reuse the user's Windows cache locally and a server-owned Linux
      path in the deployment image. Never hardcode this computer's path in code.
- [x] Configure the web build to install versioned CPU inference dependencies
      and all three resources, then run strict load and processing checks.
- [x] Configure Stanza resources in the application image build output. The
      pre-deploy command is reserved for database migrations.
- [x] Keep request-time downloads disabled. Report requested/actual models and
      fallback reasons truthfully; availability must not rely only on a directory
      name existing.
- [ ] Verify cold/warm timings, resident memory and concurrent comparison/scoring
      behavior for the configured two Gunicorn workers; check long comparison
      requests against server/hosting timeouts rather than assuming a browser's
      five-minute timeout is sufficient.
- [ ] Run an actual Linux build/runtime smoke test, then after the owner deploys,
      authenticate and verify each selected model plus the real comparison
      endpoint on the hosted backend. A basic HTTP health response alone does
      not establish model readiness. No hosted pass is claimed yet.

Primary deployment references checked during review:
[Stanza offline resources](https://stanfordnlp.github.io/stanza/download_models.html),
[Stanza offline pipelines](https://stanfordnlp.github.io/stanza/getting_started.html),
[Railway pre-deploy filesystem](https://docs.railway.com/deployments/pre-deploy-command),
[PyTorch CPU installation](https://docs.pytorch.org/get-started/locally/).
Installed Stanza 1.14 source was used to verify its actual platform-cache default;
older examples in the public documentation still describe the former home path.
