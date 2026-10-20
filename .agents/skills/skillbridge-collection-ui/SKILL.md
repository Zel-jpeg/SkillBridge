---
name: skillbridge-collection-ui
description: Create, update or review SkillBridge tables and card collections with reliable search, filters, pagination and accessible interactions. Use the instructor screens as optional visual references; do not apply their density or layout to whole dashboards, analytics pages, forms or dialogs.
metadata:
  author: SkillBridge project team with Codex assistance
  origin: Original project skill
---

# SkillBridge Collection UI

Design each collection around the user's reading and decision task. The instructor
dashboard and Students page are examples, not a fixed appearance for the product.
Prioritize readable text, clear grouping and breathing room over copying their
compact layout. Preserve functionality, permissions and assessment/placement meanings.

Read [the collection UI reference](references/COLLECTION_UI_REFERENCE.md) when
applying this skill. It contains the inspected baseline, visual recipe, toolbar,
table/card hierarchy, pagination contract, accessibility guidance and source map.
Read the relevant source components before changing them; the baseline is dated
and current code takes precedence.

## Design freedom

- Follow the current visual brief. Typography, spacing, chart size, surface treatment,
  hover style and control layout may change when that improves comprehension.
- Treat the reference's utility classes, font sizes, grids and breakpoints as a dated
  baseline, not acceptance requirements. Do not shrink text to fit more content.
- For analytics, separate scope controls, navigation, summaries, charts and records.
  Apply collection behavior to the records section, not the entire page. Use progressive
  disclosure for detailed notes and secondary tools, retaining essential metric context.
- Use existing components where they fit. JavaScript UI, chart, interaction and animation
  libraries are allowed when they add a concrete benefit. Check React/Vite compatibility,
  accessibility, bundle impact and maintenance; follow actual repository dependency rules.
  This skill itself does not ban dependencies or require permission for routine UI choices.

## Interaction and data conventions

- Keep search discoverable, group and label filters, and show the full filtered count.
  Pills, selects or a filter panel may be chosen to fit the workflow. Offer a cards/list
  switch where useful rather than adding one to every collection.
- Both views show the same filtered, ordered page. Reset page on search/filter
  changes, clamp it when results shrink and reuse the shared Pagination component.
- Green hover feedback from instructor Students cards is an available pattern:
  `hover:shadow-md hover:border-green-300 dark:hover:border-green-700
  hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all`.
  Table rows use `hover:bg-green-50 dark:hover:bg-green-950/20`.
  A quieter hover treatment is also appropriate. Always provide visible keyboard focus;
  hover must not be the only feedback.
- Preserve readable light/dark contrast. Match SkillBridge's existing compact type scale:
  the user's current preference is 12px ordinary text, descriptions, controls, table cells
  and chart labels, with larger headings and key metrics. Improve comprehension through
  wording, grouping and whitespace; do not automatically increase body text to 14–16px.
  Choose responsive layouts from the content width; keep essential information and actions
  available on narrow screens. A contained scroller or a card fallback may be appropriate.
- Keep completion status, recommendation access, scores, matches and placement
  approval distinct. Missing evidence remains explicit instead of becoming zero.
- Reuse shared icons, Axios and data hooks. Keep the React/Vite/Tailwind setup.

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
