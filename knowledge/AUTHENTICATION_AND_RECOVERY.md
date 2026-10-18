# Authentication and account recovery contract

The user selected this role contract on 18 October 2026:

| Role | Supported sign-in and onboarding |
|---|---|
| Student | Verified DNSC Google identity, approved account and existing enrollment. Instructor/admin enrollment creates Google-only accounts. |
| Instructor | Verified DNSC Google identity and approved active account. Admin addition creates an approved account with an unusable password; public role registration creates a pending account. |
| Admin | Individual password login. Creation/credential recovery is performed by an authorized operator, not public role selection or Google login. |

This explicitly resolves the older paper's general “staff password” wording in
favor of instructor Google sign-in. It does not remove the admin password flow.
No shared or default password is introduced. Inactive users cannot authenticate
through the custom password backend or receive Google login tokens. Students and
instructors cannot bypass Google identity checks by setting a local password and
calling the admin password endpoint. Admin Google attempts direct users to the
password sign-in page.

Provider userinfo must be a valid object with an institutional email and a true
`email_verified` flag. Client-supplied email, approval and role values cannot
replace provider identity or existing stored roles. Public registration permits
only student/instructor roles and never changes an existing user's role. New
public accounts remain pending and use unusable passwords. Approved students
without enrollment remain denied. Unknown identities receive onboarding guidance.

Missing/malformed local payloads return validation errors without contacting
Google. Invalid tokens remain unauthorized. Timeouts, upstream server errors and
malformed provider responses are retryable service errors, rather than HTTP 500
or invented successful login. The browser explains pending, unenrolled, disabled,
unverified, denied OAuth and unavailable states and stores no session on failure.

Admin instructor creation validates text types/lengths and school-ID conflicts
before writes. Its welcome/approval notification is queued through the existing
mail service. `email_queued` reports enqueueing; compatibility `email_sent` stays
false because queue admission cannot confirm delivery. The UI says queued or
unavailable and still identifies the supported Google sign-in path. Verification
uses mocks and does not send real messages.

Local evidence is tracked by A07 in the single continuous-development checklist:
`api.test_auth_contract`, `api.test_auth_deadlines`, enrollment/image regressions
and `tests/auth_contract_playwright.py`. Actual hosted OAuth origins/provider
configuration belongs to V05. A05 records the assisted-recovery UI and operator
procedure; A06 verifies refresh/expiry behavior separately.

## Assisted recovery (A05)

The public admin “Forgot password?” control shows the same assistance instructions
whether an email is empty, unknown or known. It does not submit a lookup, queue
mail or claim delivery. The designated SkillBridge administrator/authorized server
operator verifies the requester using the college's existing institutional support
channel, confirms which admin account is being recovered and performs a controlled
interactive password change. Public users cannot choose a target account or reset
credentials through this control. Mail availability/rate limiting cannot turn this
help text into a false success.

Authorized operator steps:

1. Verify the requester's identity and authority through the institutional channel;
   confirm the exact admin email and intended environment before any credential
   change. Never change student/instructor Google credentials in SkillBridge.
2. In the backend's intended Python environment, use `python manage.py changepassword
   <verified-admin-email>`. Enter and confirm a unique strong password at the hidden
   prompts; keep it out of command arguments, logs, screenshots and tracked files.
   Django applies the configured password validators and hashes the stored value.
3. Have the verified account holder sign in through `/admin/login` and confirm the
   old password fails. If the command fails or the passwords differ, fix the cause
   before reporting recovery; do not announce an email delivery or successful reset.
4. Review any suspected unauthorized access under the institution's existing
   process. Session invalidation/renewal behavior is verified separately by A06.

This development run executes the real command only against isolated synthetic
accounts; it does not authorize changing a real or production credential. The
tests cover successful recovery, old-password rejection, unchanged other accounts,
validation/mismatch failures, unknown-account errors and no mail dispatch.

Students/instructors recover DNSC Google access through college IT support.
SkillBridge enrollment/pending access is reviewed by their instructor/coordinator
or administrator. The Google sign-in screen explains this distinction. No
self-service email-token reset flow was selected, so token expiry/reuse criteria
for such a flow are not applicable; no false token or delivery result is asserted.

## Seven-day session renewal (A06)

The shared Axios client renews an expired access token using the existing refresh
endpoint. One exchange is shared by concurrent rejected requests in the same
authenticated session; it has a 15-second deadline. Explicit authentication 401s
may be retried once because DRF rejected them before the view executed. Network
failures, timeouts, server errors and uncertain writes are never automatically
replayed. Invalid or revoked refresh tokens end the session; temporary refresh
service/database failures keep recoverable local state and report the failure.

Every sign-in has a new local session ID. A refresh result is accepted only for
that same session and refresh credential. Logout or another sign-in cannot be
undone by an older in-flight response. Renewal updates the access token without
clearing the role/user cache, remounting the protected page, resetting active
assessment timing or discarding unsaved drafts. Other tabs distinguish renewal
from a different authenticated session. SSE reconnects through authenticated
preflight after access expiry and resynchronizes its recipient-scoped queries.

Refresh validates the current user, activity, approval/enrollment where applicable
and password-revocation claim. Access tokens are capped at the original refresh
expiry, so renewal does not extend a session past seven days from sign-in.
Password changes revoke existing refresh/access tokens, including SSE access.
Tokens issued before this claim was enabled require a fresh sign-in once; no
production deployment or real credential change occurred in this execution.

Assessment local answer/integrity keys now include the student ID and exam ID.
They can survive the same student's reauthentication without another account
loading them. Old unscoped keys are left untouched but not read, because their
owner cannot be established safely. This is a local build change; operator-led
recovery of any preexisting unscoped draft requires establishing its owner rather
than automatically importing it into whichever account signs in next.

Coverage includes short-lived real JWT API/browser checks, 20 concurrent renewal
requests, actual submit 401 then one authenticated retry, offline uncertain-write
non-replay, expired refresh, password/activity/approval/enrollment revocation,
SSE reconnection, retained active drafts and logout during an exchange. The
single execution checklist stores the exact checks and evidence.
