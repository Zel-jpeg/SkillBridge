# Match breakdown modal

10 November 2026. The student Final Skill Profile recommendation cards show the
View match breakdown button only in Score Details. Recommendation Order and
Nearest retain concise cards with their existing scores and minimum/evidence
status. Switching the display mode does not change scoring or recommendation
policy. The three mode controls wrap within narrow screens.

The shared MatchBreakdown component now opens the existing native DialogShell
instead of expanding an inline details element. It retains partner/position
context, saved Match percentage, assessed versus unassessed categories, minimums,
the policy-specific calculation and supporting-score notes. The modal has a
scrolling body with fixed close controls, keyboard focus trapping/restoration,
Escape closure and the shared body scroll lock. Existing partner details,
assessment student details and coordinator review callers use this same modal;
partner details supplies its company name for context. No backend change,
migration, score recomputation or live record update is involved.

Validation: final frontend lint and production build passed. Synthetic browser
checks passed at 1440x1000, 768x960, 390x844 and 320x568, plus a 35-category long
list at 390x568, across light/dark themes. Verified display-mode visibility,
no card expansion, earned-zero and prior average-policy displays, dialog focus
trap/restoration, nested partner-dialog Escape/body locking, fixed close controls
and no horizontal overflow. The final table column adjustment was rechecked at
320px. No page errors or API writes were reported. The updated existing
missing_match_playwright.py regression passed at 390 and 1440px with synthetic
API responses; missing grades remain unassessed rather than becoming zero.

These checks verify presentation and interaction using synthetic data; they do
not rerun or certify live recommendation generation.
## Approved visual redesign — 10 November 2026

The later approved design supersedes the original modal footer: the X is now
the sole visible close control. The scrollable body includes the summary panel,
category bars, explicit calculation and supporting tie-breakers. Score Details
cards have balanced footer actions. See [Score Details UI](SCORE_DETAILS_UI.md)
for scope and final verification.