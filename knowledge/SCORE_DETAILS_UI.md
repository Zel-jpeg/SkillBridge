# Score Details card and modal redesign

Implemented 10 November 2026 from the user's approved imagegen preview, including
the follow-up removing the modal footer Close button.

Only the Score Details collection uses the new ScoreDetailsCard. Recommendation
Order, Nearest and All Partners retain their existing card layouts. Score Details
cards keep partner rank, logo, top suggested role, full address, tags, position and
slot counts, straight-line distance, saved Match and evidence/minimum status.
Two equal-height actions share a divided footer: outlined View match breakdown
and green View partner details. They stack at narrow card widths. Legacy saved
policies retain their component explanations and a full-width partner action
when an assessment breakdown is unavailable.

The shared MatchBreakdown modal follows the approved design: icon and role
context, Match/evidence summary, category score bars and minimums, calculation
panel, supporting tie-breakers and a short evidence note. The X is the only
visible close control; Escape, focus restoration and nested-dialog locking remain.
The modal body scrolls independently beneath its fixed header and is keyboard
scrollable. Both themes use the existing SkillBridge color and text conventions.

The percentage comes from the existing recommendation utilities. The display
uses a short parenthesized formula only for complete small breakdowns with safe
display precision; other evidence breakdowns retain the assessed total divided
by all required categories. Missing grades remain unassessed. Minimum checks,
legacy-policy explanations and NLP/location exclusion are retained. No API,
ranking, approval or score-generation behavior changed.

Implementation: ScoreDetailsCard.jsx and scoreDetailsCard.css under
skillbridge-frontend/src/components/student; MatchBreakdown.jsx and
matchBreakdown.css under components; the Score Details branch in
pages/student/StudentResults.jsx; one shared InfoCircleIcon in Icons.jsx.
The existing missing_match_playwright.py assertion follows the new summary copy.

Validation: final frontend lint and production build passed. Synthetic browser
checks passed at 1440x1000, 768x960, 390x844 and 320x568, plus a 35-category case at
390x568, across light/dark themes. Checks cover 44px equally sized card actions,
responsive stacking, Score Details-only visibility, the approved 80% calculation,
earned-zero versus missing evidence, prior average-policy display, X-only closure,
focus trapping/restoration, nested partner-dialog Escape and body locking, no
card expansion and no horizontal overflow. No page errors or API writes occurred.
The existing missing-evidence regression also passed at 390 and 1440px using
synthetic responses. The checks do not certify live API data or map providers.

The approved preview and browser screenshots are saved in the current Codex
workspace under output/design/score-details-ui.