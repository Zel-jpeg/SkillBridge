# SkillBridge UI animation guidelines

Use this guide when creating, changing or reviewing UI animations. Motion should
explain a state change, connect a control to its content, or confirm an action.
It must keep navigation and forms usable immediately.

## Screenshot reference: 20 tips

Transcribed from the user-provided image titled **20 Ways to Make Beautiful AI
Animations (In under 60 seconds)**. The screenshot does not identify its author;
these are reference heuristics, not measured requirements for every component.

1. Ease-out for entrances.
2. Dropdowns at 150–250ms.
3. Stagger list rows by 30ms.
4. Scale to 0.97 on press.
5. Stretch moving knobs 12%.
6. Stagger as details settle.
7. Arcs for object movement.
8. Pulse to confirm success.
9. Ease-in-out for moves.
10. Start popovers at 0.95.
11. Enter from the trigger.
12. Exit to the trigger.
13. No bounce on everyday UI.
14. Don't tween while held.
15. Make exits 20% shorter.
16. Overlap old & new states.
17. Masks for reveals & colour.
18. Crossfade icons + blur.
19. Rubber band past bounds.
20. Reuse the same layoutId.

## How to apply the reference

Use the relevant tips rather than combining all 20 effects. SkillBridge's daily
administration screens need restrained motion and stable text. Keep semantic
HTML, existing controls, focus indicators and role access intact.

| Interaction | Default guidance |
| --- | --- |
| Dropdown/disclosure | 150–250ms entrance, ease-out; exit about 20% shorter |
| Layout movement | Ease-in-out; animate the actual content size rather than an arbitrary large maximum height |
| Popover | Anchor to its trigger; a small offset or optional 0.95 scale, with opacity |
| Press feedback | Optional 0.97 scale on a suitable control; never move a drag target away from the pointer |
| List reveal | Optional 30ms stagger for short decorative lists; don't delay navigation links, long lists or keyboard access |
| Success | Brief subtle confirmation only after the operation succeeds; no repeated pulsing |
| State replacement | Crossfade only when useful; never leave duplicate interactive or announced content |

Knob stretching, arcs, blur, masks and rubber band effects are optional specialty
techniques, not defaults for forms, menus or data tables. Preserve readable text
and avoid blur on ordinary labels. `layoutId` is a library-specific shared-layout
concept: reuse identity when a supported animation library is already appropriate;
do not add a dependency merely to satisfy that tip. CSS transitions suffice for
simple disclosures. Prefer opacity/transforms for decorative movement; a short
size transition is appropriate for an accordion that must move surrounding rows.

## Accessibility and lifecycle

- Respect `prefers-reduced-motion: reduce`: remove decorative movement and settle
  immediately. Don't delay focus, visibility or action completion for animation.
- Keep `aria-expanded` and `aria-controls` synchronized with the logical state.
  Closed panels must be inert and hidden from assistive technology, even during
  their exit. Exclude their descendants from custom focus-trap queries.
- Preserve content long enough to animate exit, then make its settled visual
  state hidden. Don't unmount at the beginning of a closing transition.
- Rapid toggles must reverse smoothly without queued timers or stale callbacks.
  Initial rendering should show the correct state without a surprise animation.
- Restrict transitions to named properties, avoid broad `transition: all`, and
  use existing shared motion tokens where practical. Animate an icon wrapper
  rather than competing transforms on the SVG itself.
- Check keyboard activation, focus, pointer use, rapid toggling, long content,
  narrow screens, dark mode and reduced motion. Report the checks actually run.

## Sidebar application

The staff sidebar and mobile drawer keep one group open at a time. Submenus use
an intrinsic CSS-grid height reveal and opacity, with a 200ms entrance and 160ms
exit. The chevron rotates with the same timing. Closed links stay mounted for
the visual exit but become inert and `aria-hidden` immediately. Route selection,
the collapsed icon rail and the student's flat navigation retain their behavior.

The reference is guidance for future authorized UI work; it does not require
retrofitting every animation or changing unrelated functionality.

## Sidebar verification · 8 November 2026

- Frontend lint and production build passed.
- The existing `run_organization_browser.py --sidebar-accordion` runner passed
  six browser check groups with zero page errors. It covers admin/instructor
  desktop and mobile accordions, keyboard activation, one-open-group behavior,
  route selection, collapsed icon rails, drawer focus wrapping and restoration,
  measured 200/160ms transitions with intermediate heights/opacity, rapid
  reversal, inert closed-panel focus, dark-phone reduced motion and student
  flat-navigation preservation.
- Evidence: `work/organization-browser-nkuhmymv/`. The phone drawer screenshot
  was reviewed. The runner used synthetic SQLite data and temporary local
  servers, then stopped its owned servers. No configured database was changed.
