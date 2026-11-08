# SkillBridge UI design guidelines

Read this guide before creating, changing or reviewing UI designs. Use it to
make each screen clear, purposeful and consistent with SkillBridge's theme and
the user's current brief. Apply it alongside the
[UI animation guidelines](UI_ANIMATION_GUIDELINES.md) when motion is involved.

## Screenshot reference: 20 tips

Transcribed from the user-provided image titled **20 Ways to Unslop AI Designs
(In under 40 seconds)**. The screenshot does not identify its author. The list
is a design reference; the application notes below explain its use in SkillBridge.

1. Delete filler badges.
2. Drop redundant labels.
3. Unitalicize random words.
4. Mono only where needed.
5. Use a design system.
6. Show the actual product.
7. Enlarge the main feature.
8. Group with spacing.
9. Make headlines specific.
10. Emphasize the CTA.
11. Add an accent colour.
12. Keep icons consistent.
13. Remove embellishments.
14. Inner radius = outer − padding.
15. Improve text contrast.
16. Wrap headlines properly.
17. Align by eye, not pixels.
18. Use tabular nums.
19. Add loading states.
20. Animate useful feedback.

## Apply the tips to SkillBridge

### Purpose and hierarchy

- Start with the user's task. Give the page one clear main title and make its
  most important content or decision easiest to find. Additional section headings
  should introduce distinct content rather than repeat the title or breadcrumb.
- Remove badges, repeated descriptions and decorative labels that add no useful
  information. Keep real statuses, units, denominators, field labels, scope,
  permissions and explanations needed to interpret an action or result.
- Use specific headings and action labels, such as **Review retake requests**.
  Emphasize the primary action for the current task; give secondary actions a
  quieter treatment. Destructive actions need an appropriate distinct treatment.
- Use spacing and alignment to group related content before adding borders,
  cards or tinted containers. Give the main feature room without hiding essential
  context or forcing users to scroll through oversized decoration.
- Show actual product workflows and capabilities. Use synthetic or anonymized
  records in demonstrations; don't invent metrics, unsupported features, growth
  claims or success states to make a design look more complete.

### Visual consistency

- Reuse the existing SkillBridge components, type scale and theme. Green is the
  brand accent; do not introduce a new accent for every card. Preserve meaningful
  semantic colors and usable light/dark contrast.
- Reuse shared icons from `skillbridge-frontend/src/components/Icons.jsx`. Keep
  visual size, stroke weight and alignment consistent. Retain accessible names
  for icon-only actions; a tooltip alone is not sufficient.
- Use the established sans-serif type for ordinary UI. Reserve monospace for
  code or identifiers where it improves reading. Avoid arbitrary italics,
  decorative text treatments, shapes, gradients or shadows without a purpose.
- Align related search fields, selects and action controls. Use the established
  toolbar sizing, responsive spacing and adequate click/touch targets.
- Treat **inner radius = outer radius − padding** as a useful approximation for
  truly nested rounded surfaces. Clamp it at zero and adjust visually; do not
  force the formula onto unrelated buttons, fields or cards.
- Use optical alignment to refine icons and text within a consistent layout.
  Don't replace responsive structure with arbitrary positioning or fragile
  per-screen offsets.

### Readability and numbers

- Keep labels and secondary text readable against their actual backgrounds in
  both themes. Target WCAG AA text contrast: 4.5:1 for normal text and 3:1 for
  large text. Preserve visible focus and recognizable controls.
- Let long headings, names and actions wrap naturally. Avoid clipped names,
  awkward isolated words, hardcoded line breaks and shrinking text simply to fit.
  Check narrow widths and enlarged text before truncating necessary information.
- Use `font-variant-numeric: tabular-nums` (or the existing `tabular-nums` utility)
  for changing counts, scores and aligned numeric comparisons. Keep units,
  percentages and denominators explicit; unknown values must not become zero.

### Loading and feedback

- Reuse loading placeholders that fit the content and reserve its space. Provide
  useful empty, error and retry states. Distinguish initial loading from a
  background refresh without hiding usable last-loaded content unnecessarily.
- Animate feedback only when it explains a transition or confirms a real result.
  Follow [UI animation guidelines](UI_ANIMATION_GUIDELINES.md), including reduced
  motion, keyboard access and immediate functional state changes.
- A visual cleanup must preserve existing functionality and access boundaries.
  Do not hide missing evidence, change score meanings or confuse placement
  approval with OJT completion to simplify a screen.

## Review before delivery

Check the main task and action, redundant copy, shared styles/icons, readable
contrast, long text, control alignment, light/dark appearance, narrow screens,
keyboard focus, loading/empty/error states and relevant motion behavior. Verify
the functionality affected by the change and report checks actually performed.

This guide applies to future authorized design work; it does not independently
authorize a redesign of existing pages or removal of functionality.
