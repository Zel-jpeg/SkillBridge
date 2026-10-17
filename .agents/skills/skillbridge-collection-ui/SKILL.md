---
name: skillbridge-collection-ui
description: Create, update or review SkillBridge collection interfaces using the instructor dashboard and Students page patterns for tables, cards, green hover feedback, search, filters and pagination. Use for authenticated collection UI work or explicit requests to match these screens.
metadata:
  author: SkillBridge project team with Codex assistance
  origin: Original project skill
---

# SkillBridge Collection UI

Use the instructor dashboard and instructor Students page as the shared visual
reference for collection screens. Adapt fields and filters to the user's workflow
while preserving functionality, permissions and assessment/placement meanings.

Read [the collection UI reference](references/COLLECTION_UI_REFERENCE.md) when
applying this skill. It contains the inspected baseline, visual recipe, toolbar,
table/card hierarchy, pagination contract, accessibility guidance and source map.
Read the relevant source components before changing them; the baseline is dated
and current code takes precedence.

## Essential conventions

- Keep search prominent, use compact single-select filter pills, show the full
  filtered count and place the cards/list switch near that count.
- Both views show the same filtered, ordered page. Reset page on search/filter
  changes, clamp it when results shrink and reuse the shared Pagination component.
- Preserve the green hover feedback from instructor Students cards:
  `hover:shadow-md hover:border-green-300 dark:hover:border-green-700
  hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all`.
  Table rows use `hover:bg-green-50 dark:hover:bg-green-950/20`.
  Provide visible keyboard focus as well; hover must not be the only feedback.
- Keep white/dark surfaces, thin borders, rounded containers and the existing
  typography. Use cards on narrow screens, retaining the table's information and
  actions. Test intermediate widths rather than assuming the table always fits.
- Keep completion status, recommendation access, scores, matches and placement
  approval distinct. Missing evidence remains explicit instead of becoming zero.
- Reuse existing components, icons, Axios and data hooks. This skill does not
  require a table library, new dependency or changes to the Vite/Tailwind setup.

For broader visual design, use an available relevant design skill when useful;
this local reference supplies SkillBridge-specific collection conventions. Apply
the user's visual brief when it intentionally differs from the baseline.

## Verification and reporting

For UI changes, use the relevant frontend lint/build checks from the repository's
AGENTS.md. Check responsive layout and interaction in a browser when available,
including hover/focus, view switching, filter resets, pagination boundaries and
empty/loading/error states. Use synthetic data and report unverified behavior.
Documentation-only edits need link and skill validation rather than app builds.

Report what changed, checks actually run and intentional deviations from the
reference. A review request alone does not authorize implementation.
