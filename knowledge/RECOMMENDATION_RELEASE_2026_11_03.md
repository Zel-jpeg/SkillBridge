# Recommendation and position-editor release — 3 November 2026

The user authorized publishing the completed assessment-led suggestion update and
rerun feedback fix to GitHub so connected hosting can update. They also explicitly
included the separately prepared frontend position editor. Branch: `main`;
pre-release commit: `c65ef4b`. Existing GitHub main matched that commit at inspection.

## Scope and assessment preservation

The release includes the versioned recommendation order/evidence, shared slot
proposal rules, frozen future approval evidence, compatible role-specific result
presentation, stale-suggestion/profile separation, two-column migration 0031,
rerun request/feedback correction and the documented frontend position editor.
No dependency or hosting configuration changes are intended. Ranking and
provisional allocation change deliberately; cards retain their existing layouts.

AST comparison against the pre-release commit confirms the executable bodies of
`score_submission`, `update_assessment_profile`, `assessment_start`,
`assessment_submit` and `assessment_stop` are identical. Assessment submission
still saves answers/scores, then calls `recalculate_combined`; final required
completion generates the new ranked recommendations without an admin rerun.
Incomplete, stopped/flagged and cross-batch evidence gates remain in regression
coverage. New recommendation policy does not automatically approve placements.

The added submission regression uses synthetic students and real start/submit
endpoints: first required assessment saves its score while recommendations remain
locked; the final submission persists raw/max/category percentages and publishes
the assessment-led positions through the combined-results API. It does not mock
the NLP preprocessing path or rerun production students.

## Release checks

Final release verification: **594 PostgreSQL backend tests passed**, including
the real-submission regression, in a fresh owned local database. **321 frontend
tests**, ESLint and Vite production build passed. All three position-editor,
catalog-validation and company-collection browser scripts passed, including
responsive and error-recovery checks with intercepted synthetic APIs. Django
system check and migration drift check passed. The reviewed application file
hashes match the tested tree. Staged paths exclude private environment files,
databases and disposable artifacts; the sensitive-pattern scan found no matches.
Earlier integration verification also passed 13 role/profile browser checks,
eight rerun-feedback browser checks and migration-preservation checks.
Artifacts are ignored under `work/recommendation_release_20261103/`; no local
credentials, databases, student records or disposable experiment artifacts belong
in the commit.

## Hosting and activation

Read-only Railway inspection confirms the existing SkillBridge web service uses
`Zel-jpeg/SkillBridge`, branch `main`, root `/skillbridge-backend`, and pre-deploy
`python manage.py migrate --noinput`. Its current pre-release deployment is
`75074fac-d539-4551-ad78-57f65fe686b2`. No staged Railway changes existed.
Migration 0031 was previously applied to the configured database and preserves
old application fields; deployment must still report successful migration and
health. Frontend and backend share compatible legacy fields during cutover.

Monitor both connected deployments after push. Public health and authentication
boundaries can be checked without modifying data. Do not submit real assessment
answers, run real recommendations, send messages/email or approve placements to
test the release. An authenticated owner smoke check remains distinct from local
regression evidence. Local tests do not guarantee every production condition.

The user-authorized commit/push proceeds only after these release gates. Commit
and connected-host deployment outcomes are recorded by GitHub and hosting status;
public post-deployment checks do not establish a real user login or submission.

Existing stale rankings need a deliberate admin rerun only after the backend
serving them runs this policy. Submitted assessments do not need retakes. The
rerun remains synchronous; its frontend fix makes uncertain completion honest
and permits up to two minutes without guaranteeing faster computation.

For rollback, keep the additive columns and frozen audit evidence. Review policy
fingerprint compatibility before regenerating old-policy results. Do not reverse
migrations or rewrite assessment/placement history as an automatic rollback.
