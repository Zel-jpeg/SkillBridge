# Generalized system and deployment readiness review

Reviewed 8 November 2026. Application baseline `ad2d908`, with the working-tree
changes present during verification. This is a review receipt and follow-up
checklist. Application behavior was not changed by this review.

**Verdict**

The program-based system works across configurable institutes and programs.
The verified journeys include Entrepreneurship, Tourism and an arbitrary Field
Documentation program in another institute. Those programs use the same code.
Existing mixed IC records remain in their ordinary institute area.

Hold the next general release until the blocked Add Skill workflow and the
shared-roster dashboard disclosure are fixed. Institute-wide shared skill
libraries also need a general implementation to fulfill the earlier request
for the same shared/program structure in every institute. A program-only pilot
can use the existing program libraries once its content and hosted checks are
complete.

The checked core flows pass broad regression. That result does not establish
that the current Tourism configuration is prepared for an evaluator or that
independent faculty have validated its questions and recommendations.

**Verified behavior**

| Area | Result from this review |
| --- | --- |
| Institutes, programs and staff | Configurable catalogs and program assignments work. A coordinator can have several program assignments. Program catalog sharing and private batch ownership remain distinct. |
| New batches and enrollment | New batches use one program. The integrated journeys exercise enrolled students, setup, assessment access and actual submissions. |
| Assessments | Required completion, question/category identity, attempt recovery, submission retry rejection, grading and retained evidence pass regression. |
| Recommendations | Program-specific numerical requirements and results stay isolated. Stale inputs hide outdated recommendations while retaining graded evidence. |
| Partners and positions | Assigned coordinators create program openings, reuse eligible partners, recover uncertain saves and archive/restore records. Creator/admin editing rules and revoked access pass browser checks. |
| Placement decisions | Sibling-program openings are rejected when ineligible. Eligible approval consumes the shared seat. A recommendation remains a decision-support input. |
| Admin navigation | Batches, assessments, archives, retakes, partners and placements keep institute/program scope, including invalid and archived selections. |
| Reports | Scoped comparison, CSV/PDF export, freshness checks and instructor privacy pass the report suite. |
| Existing IC | Shared assessments, the full mixed roster, retakes and placement exports passed before the shared-view suite stopped at the dashboard disclosure defect. |

**Confirmed findings and implementation gaps**

1. **P1 — Adding another skill becomes blocked after the library is used.**

   Saving even a draft assessment binds its batch and freezes its library.
   Position requirements can also freeze a library. The taxonomy only shows
   Add Skill when the library is unlocked. The category POST returns HTTP 409
   and tells staff to create a new version, while the normal page no longer
   exposes version creation. Editing/removing a used skill can make an updated
   copy, but adding a new skill has no equivalent normal workflow.

   Reproduced with the sole active program library. The API reported it locked
   and rejected the new category with HTTP 409. This affects a coordinator
   maintaining a program after its first assessment or opening is prepared.

   Implement Add Skill for used libraries through an automatic, reviewed copy
   for future work. Keep the simple Add/Edit Skill interface. Preserve existing
   batch, question, requirement and score references. Handle stale drafts,
   repeated saves and concurrent coordinators using the existing digest and
   request-ID patterns.

   Sources include [the taxonomy page](../skillbridge-frontend/src/pages/CompetencyCatalog.jsx)
   at line 138, [category writes and revisions](../skillbridge-backend/api/competencies.py)
   at lines 330 and 373, and [batch binding](../skillbridge-backend/api/authoring_scope.py).

2. **P2 — The admin dashboard loses the shared mixed-roster disclosure.**

   The dashboard requests `view=overview`. That response omits
   `scope.shared_batch_ids`, while the dashboard uses that field to show the
   explanation that a program view includes a full mixed-program batch.
   The full report response still supplies the field. The browser displayed
   the mixed roster but could not find its required explanation.

   This is a response-contract defect rather than a reason to split or change
   IC records. Include the shared batch IDs in the overview scope and test the
   field in the overview API contract. Rerun the entire shared-visibility suite.

   Sources include [the overview response](../skillbridge-backend/api/analytics.py)
   at line 336, its full-response scope at line 383, and
   [the dashboard disclosure](../skillbridge-frontend/src/pages/admin/AdminDashboard.jsx)
   at line 145.

3. **P2 — Institute-wide shared skills remain IC-specific.**

   The backend locates the shared skill institute using the literal code `IC`,
   and the shared catalog uses categories without a program framework. The
   frontend consequently creates only the Shared IC skills card. Arbitrary
   programs have their own libraries, but another institute cannot configure
   the equivalent shared library through this workflow.

   Generalize institute ownership and access for shared definitions through a
   planned additive change. Preserve existing IC IDs and evidence. Define how
   shared definitions are used by program assessments and requirements before
   changing the scoring scope. A text replacement alone would not provide the
   ownership or authorization required.

   Sources include [shared skill access](../skillbridge-backend/api/competencies.py)
   at line 37 and [shared library navigation](../skillbridge-frontend/src/pages/CompetencyCatalog.jsx)
   at line 213.

4. **P2 — Updating skills needs a clearer assessment/position preparation flow.**

   An automatic skill revision creates new category IDs. Existing assessments,
   batches and position requirements retain their original IDs. The local
   probe confirmed that an opening with requirements for the original library
   had zero requirements for its updated copy. This is the evidence-preservation
   rule working, but staff need to understand its effect on new work.

   Assessment and position forms still expose named skill sets and version
   numbers. Automatic selection occurs only when there is a single saved set.
   An opening currently supports numerical requirements from one framework,
   even if several programs are eligible. Other eligible programs can use
   manual placement without a matching recommendation rubric.

   Make the selected skill definitions and requirement readiness clear in
   those forms. Guide staff to review requirements for an updated library.
   Explain why an existing batch uses its saved definitions. For genuinely
   shared seats, define how each eligible program gets an appropriate rubric
   while preserving the one shared capacity. Matching by category names would
   lose the current identity and evidence safeguards.

   Sources include [the skill selector](../skillbridge-frontend/src/components/assessment/FrameworkSelect.jsx),
   [assessment scope](../skillbridge-backend/api/authoring_scope.py),
   [requirement validation](../skillbridge-backend/api/catalog_validation.py)
   and [recommendation eligibility](../skillbridge-backend/api/opportunity_scope.py).

5. **P3 — Position descriptions remain an enhancement to implement.**

   Positions currently save a title, tags, seats, eligibility and numerical
   requirements. They have no saved description/duties field. Their NLP text
   is generated from the saved title, category definitions, requirements and
   tags. The earlier discussion of a position description has therefore not
   become a stored product feature.

   A reviewed description may improve the role context available to staff and
   NLP. Add it as a separately verified enhancement, with bounded text,
   freshness invalidation and evaluation of its effect. Current numerical
   matching can run with the existing fields.

   Sources include [Position](../skillbridge-backend/api/models.py) at line 461
   and [position text construction](../skillbridge-backend/api/recommendation_nlp.py)
   at line 259.

6. **P3 — The operator guide still describes controls that were removed.**

   The workflow guide tells staff to open Program competencies, create a
   framework and freeze its version. The current normal page uses Skill
   taxonomy and Add Skill. Update the instructions after settling the skill
   lifecycle above so an evaluator can follow the actual screens.

   Source is [the workflow guide](MULTI_INSTITUTE_WORKFLOWS.md), particularly
   its setup and definition sections.

**Current configured program readiness**

Read-only aggregate checks on the configured Supabase project returned the
following. No student identities, answers or result records were read.

| Institute / program | Active staff assignments | Active program libraries | Program skills in those libraries | Active program batches |
| --- | --- | --- | --- | --- |
| IBPA / BSTM | 1 | 0 | 0 | 0 |
| IC / BSIS | 1 | 1 | 1 | 0 |
| IC / BSIT | 1 | 1 | 1 | 0 |

There is one institute-shared IC batch. Program-batch counts above exclude that
shared batch. Existing IC shared skills are also separate from the program-skill
counts in the table.

Tourism is assigned but its program library and batch are not prepared. Have
its coordinator supply and review categories, descriptions, tags, questions,
keys and role requirements. Then run a synthetic student journey. The program
needs content setup through the normal system, rather than program-specific code.

**Verification receipt**

| Check | Result |
| --- | --- |
| Complete PostgreSQL API regression | 816 tests passed, zero skips, in 598.556 seconds on an owned disposable cluster. |
| Frontend unit tests | 322 passed, zero failures/skips. |
| Frontend lint and production build | Passed. |
| Django deployment settings check | Only `security.W021`, the optional HSTS preload-list setting, was reported under synthetic production settings. Actual hosted environment values were not exported. |
| Schema drift | `makemigrations --check --dry-run` reported no changes. |
| Python dependency compatibility | `pip check` reported no broken requirements. |
| Production npm advisory scan | Zero reported vulnerabilities in the audited production dependency tree. |
| PyPI release advisory metadata | Zero active advisories reported for the 34 exact runtime pins queried from the base and spaCy manifests. This check covers those pins; model-wheel and complete Python transitive-package advisory coverage was not established. |
| Multi-institute acceptance browser suite | Passed. |
| Coordinator partner/position browser suite | Passed. |
| Scoped recommendation browser suite | Passed. |
| Admin navigation browser suite | Passed. |
| Scoped reports browser suite | Passed. |
| Shared visibility browser suite | Failed at the absent dashboard mixed-roster disclosure. Later steps in that suite were not reached. Earlier roster, retake and placement-export steps passed. |
| Focused local API probes | Reproduced blocked Add Skill, preserved original requirement IDs after a revision, and the missing overview shared-batch field. |

Evidence is retained in ignored local work folders. PostgreSQL results are in
`work/organization-postgres-6vr6134w/tests.txt`. Frontend checks, package scans and
the two focused API probes are under `work/readiness-20261108/`.
Browser receipts are in `work/organization-browser-cr6im45f/`,
`work/organization-browser-k9ot1ae2/`, `work/organization-browser-uxfy_hu9/`,
`work/organization-browser-z97zfyqr/`, `work/organization-browser-hbwgny4w/`
and `work/organization-browser-ej_3sjmz/` respectively.

**Hosted observations and release limits**

The public frontend returned HTTP 200. The API health endpoint returned HTTP
200 with status `ok` and allowed the current frontend origin through CORS.
The configured database records API migrations through `0041`, matching the
latest local migration. The branding bucket is public and the retake-evidence
bucket is private.

Supabase's security advisor reported one informational group covering 45 RLS
tables without policies. All 45 public tables have RLS enabled. The `anon` and
`authenticated` roles have neither superuser nor RLS-bypass authority, and no
public application allow policies were found. No Storage object policies were
found either. These observations are consistent with the application's
backend-mediated access model. Public branding downloads follow the public
bucket setting. Preserve the distinction between public branding and private
evidence when verifying real actor access. [Advisory explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

The hosted health/CORS checks do not identify the deployed application commit.
Local `main` was 76 commits ahead of its local `origin/main` tracking reference
when the review started. There was no fetch or publication during this review.
Ongoing shell, modal, style and notification changes were present, with further
UI edits arriving during verification. The browser runs used snapshots of the
build produced earlier in the review. Certify the final integrated release
commit after those edits are settled.

Real Google sign-in, actual email delivery/worker processing, cloud upload and
private-evidence retrieval, real map-provider behavior, Linux runtime/load,
backup restoration and DNSC LMS-side import were not exercised by these local
browser suites. Public health and schema metadata checks do not replace those
workflow checks. Run the deployment checks against the intended host settings.
[Django deployment checklist](https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/).

Independent faculty review remains necessary for the program's categories,
questionnaire, numerical role requirements and usefulness of recommendations.
Tourism's interview/training steps can inform the coordinator's decision outside
the current written-assessment workflow. Confirm Social Work's process with its
coordinator before treating the reported similarity as a validated fit.

**Ordered checkbox guide**

- [x] Review current institute/program ownership, assessment, ranking and placement contracts.
- [x] Run the complete local PostgreSQL and frontend regressions.
- [x] Exercise five complete browser workflows and investigate the shared-view failure.
- [x] Check public hosted health/CORS, migration metadata and bucket access settings read-only.
- [ ] Fix automatic Add Skill for a used library. Verify normal coordinator/admin entry, retries, stale drafts, concurrent saves and retained evidence before merging that feature.
- [ ] Restore shared-batch metadata in the overview API. Verify the label and rerun the entire shared-visibility browser suite before merging.
- [ ] Align assessment and opening preparation with the simplified skill page. Explain saved-batch definitions and identify openings lacking requirements for the chosen library.
- [ ] Implement the requested shared skill-library ownership for any institute, preserving IC references. Verify same-institute reuse and cross-institute denial with arbitrary institute names.
- [ ] Update the staff workflow guide to match the final Add/Edit Skill screens.
- [ ] Prepare the Tourism program's reviewed content and a synthetic batch. Complete coordinator, student and admin walkthroughs and record evaluator feedback.
- [ ] If position descriptions are included in the next scope, implement and evaluate them as a separate feature.
- [ ] Settle ongoing UI/Realtime work and select one release commit. Rebuild and check that exact commit. Keep experimental Realtime restricted until its rollout criteria are satisfied.
- [ ] Rehearse database and Storage recovery, review the target migration plan and configure the web service plus email worker for the intended release.
- [ ] Run a hosted synthetic journey with two institutes, several programs and one coordinator assigned to multiple programs. Include actual sign-in, enrollment email, question import, submission/recovery, recommendations, approval, exports and private evidence access.
- [ ] Verify the expected concurrent cohort on the hosted runtime, including connection limits, background processing, transport recovery and error monitoring.
- [ ] If LMS exchange is part of acceptance, import a SkillBridge-generated AIKEN file into an authorized DNSC LMS test bank and compare questions and keys.
- [ ] Record the selected release revision, remaining accepted limitations, evaluator acceptance and hosted results before school-wide use.

Follow the existing feature-branch, test, local-merge workflow for each code
change. This review saved findings and evidence without changing application
behavior, migrating live data, sending mail or publishing a release.
