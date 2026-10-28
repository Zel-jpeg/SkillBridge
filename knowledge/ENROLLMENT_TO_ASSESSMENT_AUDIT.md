# Enrollment through assessment completion audit — 28 October 2026

The review exercised the current uncommitted SkillBridge updates using synthetic
identities, fresh local PostgreSQL test clusters and a separate SQLite browser
fixture. No real accounts, hosted database, email provider or production migrations
were used. Application behavior was left unchanged; this review added repeatable
tests and corrected an outdated security-test expectation.

## Confirmed finding — corrected in the follow-up

**P2: Setup offers a skip action that cannot skip the required location pin.**

In [StudentSetup.jsx](../skillbridge-frontend/src/pages/student/StudentSetup.jsx),
`handleNext` rejects step 3 without a pin (lines 252–255), while the same step's
primary button says **Skip for now →** when no pin exists (line 584). Clicking it
stays on the step with “Please place a pin on the map … before continuing.”

This was reproduced in desktop and phone Chrome after blocking the external map
assets. A new student cannot finish this setup screen while the map cannot load;
there is no working skip route through the wizard. **Retry map** works once the
service is restored, after which pinning, review and profile saving complete.
This is a setup availability/wording defect, not an enrollment or grading failure.

The original recommendation was to make the required-pin wording and button agree.
If enrollment-to-assessment access must continue through a prolonged map outage,
define an explicit deferred-location state with truthful missing-distance behavior
before making the pin optional. Do not silently insert a default or fabricated pin.
The original audit left application behavior unchanged. The user subsequently
authorized the required-pin wording correction described below.

Evidence: `tests/artifacts/enrollment-assessment-journey/{instructor,admin}-map-outage.png`
under the frontend. Those screenshot names are also used by the updated test
and now show the corrected outage state. The original defect was reproduced by
the initial browser audit recorded in this document.

### Authorized required-pin correction

The map step now displays **Place a pin to continue** with a disabled action until
the student explicitly places a pin. Guidance explains the requirement and points
to **Retry map** when the map is unavailable. Once pinned, the button reads
**Continue →** and becomes enabled. Removing the pin disables it again; the remove
control has an accessible label. Back/review navigation preserves the selected pin.
The existing validation remains in place and no default pin is saved.

The follow-up browser check also exposed delayed map-resize work after leaving
the map step. The resize timer is now cleared on teardown and checks that its
map is still active. Removing a pin now removes its visible Leaflet marker too,
keeping the map and the required-pin button state consistent.

This fixes the misleading skip action. A prolonged map outage still requires
retrying when service is restored, because location remains required. Deferred
location onboarding was not introduced.

Follow-up verification passed: frontend lint/build and both real-API browser
journeys (desktop 1366px and phone 390px), with zero page errors. Checks cover
the disabled action during outage, working map retry, required-pin enablement,
marker removal/replacement, preserved fields/pin through back/review navigation,
profile saving and subsequent assessment completion. Evidence is recorded in
`work/setup-pin-fix-{lint,build,browser}.log` and the updated journey `checks.json`.
No backend behavior or schema changed, so the PostgreSQL suite was not rerun for
this follow-up; the 245 checks below describe the preceding audit.

## Expected versus observed

| Case | Expected | Observed |
| --- | --- | --- |
| Enroll 100 students, replay the exact command | 100 memberships and email notices, one saved result | Passed; no provider I/O during enrollment |
| Unsent enrollment emails | Approved enrolled students can sign in independently | Passed with queued and held emails |
| Student identity | Verified Google identity; reviewed enrollment name preserved; no local student password | Passed at real login endpoint with synthetic provider response |
| Setup/map outage | Button should describe the required pin and available recovery | Corrected in follow-up: explicit disabled required-pin action, guidance and working Retry map |
| Normal onboarding | Contact/address selections, map pin, review, saved profile | Passed through real UI on desktop and phone after map retry |
| First required assessment | Own score visible; final batch results still locked | Passed: 3/4 (75%), one of two required assessments complete |
| Final required assessment | Combine raw/max evidence and unlock only after completion | Passed: 2/2 second result; combined Programming 3/4 (75%), Networking 2/2 (100%), total 5/6 (83.33%) |
| Omitted answer | Included in denominator, zero credit | Passed in integration test; denominator remains 4 for first assessment |
| MCQ, true/false, identification | Stored key; identification trims and ignores letter case | Passed, including intentionally incorrect MCQ |
| Malformed/duplicate answers | Reject before score/answer writes | Passed |
| Repeated start / finalized submit | Stable current layout and identity; no duplicate finalization | Passed |
| Saved submit response lost | Read canonical attempt; show results without another submit | Passed in both browser journeys; one submission per first assessment |
| Request fails before saving | Keep local answers, do not claim completion, allow explicit retry | Passed; second assessment remains in progress until successful retry |
| Stopped attempt / retake | No completion credit while stopped; preserve history; reject old attempt identity | Passed |
| Staff visibility | Instructor and admin see the student's completed required assessments | Passed against the real roster API |
| Email status after assessments | Assessment completion does not pretend email was sent | Passed: queued/held notices stayed queued/held |
| Quota/provider failures, ownership and concurrency | Saved pending work, scoped access, serialized finalization | Passed in the PostgreSQL regression suite |

## Verification and reusable tests

- [Journey API regressions](../skillbridge-backend/api/test_enrollment_assessment_journey.py)
  connect reviewed bulk enrollment, JWT sign-in, profile validation, assessment
  start/resume/submission, exact combined totals, staff visibility and retakes.
- [Browser journey](../skillbridge-frontend/tests/enrollment_assessment_journey_playwright.py)
  uses [journey_server.py](../skillbridge-frontend/tests/journey_server.py), a
  process-specific synthetic SQLite database and blank Brevo key. The browser
  enrolls through instructor desktop and admin phone views, then completes each
  student's setup and two real assessment submissions. Google userinfo is replaced
  only in this isolated server. PSGC/geocoding responses and map tiles are synthetic;
  map retry uses the cached real Leaflet 1.9.4 assets already in
  `tests/artifacts/company-collection/leaflet.min.{js,css}`. Those cached files are
  prerequisites for rerunning the browser script. No remote download occurs.
- The 212-test PostgreSQL suite passed, including the two new integration tests.
  It covered enrollment/import, outbox/progress, authentication, profile recovery,
  submission integrity, multiple assessments, combined scores, timing, retakes,
  access controls, concurrent workflows, student recovery and provider failures.
  Evidence: `work/enrollment-assessment-postgres.log` and
  `work/email-outbox-postgres-ysgz7q24/tests.txt`.
- The initial 210-test run exposed one stale test classification: the new Brevo
  webhook uses an independent provider secret and rejects missing/incorrect
  secrets with 403; it is not a JWT-protected staff route returning 401.
  [test_access_security.py](../skillbridge-backend/api/test_access_security.py)
  now excludes it from that JWT-specific loop. The dedicated outbox tests retain
  their missing-secret rejection, authenticated delivery, duplicate-event and
  malformed-event checks. The webhook implementation was not weakened or changed.
- Browser evidence: `work/enrollment-assessment-browser.log` and
  `tests/artifacts/enrollment-assessment-journey/checks.json`; both journeys passed
  with zero page errors. Server diagnostics are written to fixture log files to
  avoid blocking on the Windows helper's captured output pipe.
- The initial targeted SQLite run of the two new integration tests also passed:
  `work/journey-integration.log`.
- A further 33 core assessment, question-presentation, Google deadline and session
  renewal tests passed on another isolated PostgreSQL cluster, bringing this
  audit's successful PostgreSQL checks to **245** with no skips. Evidence:
  `work/journey-core-postgres.log` and
  `work/email-outbox-postgres-p9_0l078/tests.txt`. Django's system checks passed.

Verification changed only tests and documentation, so frontend lint/build were
not rerun for this audit; the preceding UI implementation's checks are recorded
in the enrollment email document. No claim of new frontend build verification
is implied by the browser result.

Run the isolated PostgreSQL helper from the repository root, passing Django test
labels as arguments; it disables normal dotenv loading, creates a fresh localhost
cluster and stops it afterwards. For the browser, run the testing skill's
`with_server.py` from `skillbridge-frontend` with Vite on **5186**, `journey_server.py`
on **8026**, then `tests/enrollment_assessment_journey_playwright.py`. Keep those
ports separate from the normal development servers. On Windows, verify and stop
any remaining helper-owned child listeners after completion.

## Limits

This is a workflow/regression audit, not a production load benchmark. It does not
establish the capacity or latency of 100 simultaneous student exam sessions.
Google's hosted popup/origin configuration, actual Brevo credits/reset/delivery,
Railway workers, mobile operating-system overlays and deployed network behavior
remain unverified. The synthetic journey has no partner catalog, so an unlocked
result can correctly contain no recommendations; scoring/ranking gates and
candidate behavior are separately covered by combined-competency tests. A match
score does not mean placement approval.

See [enrollment email behavior](ENROLLMENT_EMAIL_DELIVERY.md),
[submission integrity](ASSESSMENT_SUBMISSION_INTEGRITY.md),
[interruption and retakes](ASSESSMENT_RECOVERY_AND_RETAKES.md), and
[authentication](AUTHENTICATION_AND_RECOVERY.md).
