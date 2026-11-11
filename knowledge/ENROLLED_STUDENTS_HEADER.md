# Enrolled students header actions

10 November 2026. Implements only the top action layout selected from the
imagegen preview, in `skillbridge-frontend/src/pages/instructor/EnrolledStudents.jsx`.

Enrollment emails and the green primary Enroll students action sit beside the
page title. Batch actions and the quieter Start new batch action are grouped
beside the existing program context and batch selector. Controls are 44px tall,
use shared icons and wrap on narrow screens. The native selector keeps explicit
Active/Archived labels. Archived batches retain Reactivate batch and Switch to
active batch; enrollment and active-only menu controls remain hidden there.

Statistics, student cards, roster filters, tabs, pagination and all mutation
handlers are unchanged. No new dependency, backend change or migration is needed.

Validation: frontend lint and production build passed. Browser checks used the
actual page with synthetic API responses at widths 320, 390, 768, 1024 and 1440px,
including light/dark themes. Verified aligned 44px controls, no horizontal
overflow, one primary enrollment action, keyboard menu opening/focus restoration,
all four menu items, email/enrollment/new-batch/archive dialog opening and
archived-to-active batch switching. No page errors or API writes occurred.
Fixture responses were adapted to current response contracts; no live backend
or real record mutation was tested or required for this presentation-only update.