# Collection UI reference: filters, tables, cards and pagination

Use this guide when adding or updating a SkillBridge screen that displays a
collection: students, assessments, companies, positions or users. The visual
reference is the instructor dashboard's student table and the instructor
Students page's card/list views, including the two screenshots supplied on
17 October 2026.

This is a design and interaction reference, not a request to change application
behavior. **Current baseline** describes inspected code; **future guidance**
describes what to aim for on the next relevant UI task. Current code takes
precedence if these implementation details become outdated.

The screenshots contain personal student information, so they are not copied
into this repository. Examples below use synthetic identities.

## 1. The pattern to preserve

A quiet, light workspace with white surfaces, thin borders, rounded corners,
compact filter pills and clear hierarchy. Let names, statuses and useful numbers
carry the page. Use color to explain a state or action.

Arrange collection sections in this order:

```text
Page title + batch/context                              Page actions
Optional summary statistics

Search ....................................       Course/scope pills
Status pills ..............................       [Cards | List]  Count

+-----------------------------------------------------------------+
| Table rows OR a grid of cards                                    |
+-----------------------------------------------------------------+

Showing 11–20 of 26                       [Prev] [1] [2] [3] [Next]
Score key: [Strong] [Fair] [Needs work]    (only for scored content)
```

The toolbar may fit on one row, as in the dashboard screenshot, or wrap onto
two rows, as in Students. Keep the same reading order rather than fixing its
height or forcing every control onto one line.

## 2. Current baseline by screen

| Detail | Instructor dashboard | Instructor Students page |
| --- | --- | --- |
| Initial desktop view | List/table | Card grid |
| Search | Placeholder: name or ID; code also matches course | Name, ID or email |
| Scope | Dashboard student collection | Selected batch; All courses, BSIT, BSIS |
| Status filters | All, Completed, Pending | All, Complete, In progress, Stopped / flagged, Retake approved, Recommendations unlocked, Unplaced, Placed |
| Filter selection | One status at a time | One course and one status at a time; combined with search |
| Sorting controls | Student name and Overall table headers; initially name ascending | No table-header sorting controls |
| Page size | 6 students | 10 students |
| Pagination | Shared `Pagination` component | Same component |
| Small screens | Cards below `sm`, even when list is selected | Same fallback |
| Details | Card or row opens the student dialog | Same, with batch management context |

Search and filters operate on the loaded collection before slicing the page.
The count beside the view toggle is the full filtered count, not the number on
the current page. Switching views preserves search, filters and page.

The screenshots show two students, so pagination is correctly absent: neither
collection exceeds its page size. They do not show a separate pagination design.

## 3. Visual recipe

These are existing Tailwind utility patterns, not a new global token system.
Continue using the project's typography and Tailwind v4 setup.

| Element | Reference treatment |
| --- | --- |
| Page width | `max-w-6xl mx-auto`; `px-4 sm:px-6` |
| Page rhythm | `py-6 sm:py-8`; roughly 24–32px between major sections |
| Surface | White in light mode; `dark:bg-gray-900` for cards/tables |
| Surface border | `border border-gray-100 dark:border-gray-800` |
| Container corners | `rounded-2xl` for cards and table wrapper |
| Search field | `rounded-xl`, subtle gray border, leading search icon, green focus indication |
| Primary text | Gray-900/light; white/dark; names around `text-sm` with medium/semibold weight |
| Secondary text | `text-xs` for identifiers, course, counts and supporting labels |
| Filter pills | `text-xs font-medium px-3 py-1.5 rounded-full` |
| Selected pill | `bg-gray-900 text-white`; inverted in dark mode |
| Unselected pill | Gray-100 surface and muted text; stronger gray on hover |
| View switch | Gray rounded tray, `p-1`; active icon on raised white/dark-gray surface |
| Card padding/gaps | `p-5`, `gap-4`; grid gap `gap-4` |
| Table header | Muted gray surface, `text-xs font-semibold`, `py-3.5` |
| Table cells | `py-4`; 12px inner horizontal padding, 20px around identity/outer edges |
| Identity avatar | 40px on cards; 28px in rows; photo or initials fallback |
| Interaction | Green row hover; green card border/ring and modest shadow on hover (exact classes below) |

### Green card and row hover

Preserve the instructor Students card hover: the border turns green, a soft
green ring appears around the card and a modest shadow lifts the surface. Keep
the card's base surface color; this treatment highlights the outline. Table rows
use a pale green background on hover instead.

```text
Card: hover:shadow-md hover:border-green-300 dark:hover:border-green-700
      hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all
Row:  hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors
```

Provide equivalent visible keyboard-focus feedback when updating the UI. These
classes describe hover styling; they do not provide focus styling by themselves.

Reserve stronger shadows for interaction or overlays. Avoid heavy borders,
decorative gradients or a new accent color for each column. Check muted labels
for readable contrast; the screenshots are visual inspiration, not a contrast
certification. Dark mode must retain the same hierarchy and state meanings.

## 4. Search, filters and view controls

**Current baseline**

- Search grows into available width. Placeholder text describes supported fields.
- Course and status are separate groups of single-select pills. Selecting a new
  pill replaces the selection in that group; selecting All clears that group.
- Search, course and status changes reset the page to 1. The Students batch
  selector also resets the page.
- Filter pills wrap. The desktop view switch sits toward the right, near the
  filtered count, and is hidden below `sm`.
- Dashboard sorting applies before pagination. Clicking the active sort column
  reverses its direction; choosing a different column starts ascending. Current
  sorting does not reset the page.

**Future guidance**

- Keep search prominent. Use plain labels such as `Search by name, ID, or email…`
  only when those fields are actually searchable.
- Match the filter set to the entity and workflow. Reuse pill styling without
  copying student-specific statuses into unrelated collections.
- Keep groups identifiable when labels repeat, especially All. A selection in
  one group should not silently clear another group.
- Preserve the query and current page when changing cards/list. Both views must
  render the same ordered slice of the same filtered collection.
- For new sortable collections, prefer returning to page 1 when sort changes.
  This differs from the current dashboard and needs an intentional behavior
  change if applied there.
- When a toolbar becomes crowded, wrap or use a labeled filter panel. Keep active
  filters discoverable and provide Clear filters for a filtered empty state.
- Keep page-level creation/enrollment actions near the title, separate from
  search and filter controls.

## 5. Table/list view

Use tables when instructors need to compare many students across consistent
fields. Keep identity first, context and status next, evidence in the middle,
and summary numbers or actions toward the end.

The dashboard column order is:

`Student → Status → Placement → Skills → Top Match → Overall`

Students adds Required progress after Status and a final removal-action column.
That extra progress column explains required completion and recommendation access.

- Group name, ID and course in one identity cell. Keep the name strongest.
- Use semantic table markup, a softly tinted header and thin row dividers.
  Subtle alternating backgrounds are acceptable; hover must remain clear.
- Wrap compact skill chips inside the evidence cell. Show category and percentage
  together; retain access to full category labels when abbreviating them.
- Keep status badges separate from placement badges. Completed assessments,
  unlocked recommendations and approved placement are different facts.
- Make sortable columns recognizable with direction indicators. Only mark
  headers as sortable when a working sort exists.
- Use a dash for unavailable values and explicit text such as Not assessed.
  Never turn missing evidence into a displayed zero score.
- A row opens details. An independent row action must not also open that dialog.
  Keep destructive actions visually secondary and confirm their actual effect.
- For future wide tables, check intermediate widths and zoom. Prefer a usable
  card fallback or an intentional, contained horizontal scroller over clipped
  columns or page-wide overflow.

## 6. Card view

Use cards when an instructor needs a compact student story: identity, progress,
competency evidence and the top recommendation in one place.

The Students card follows this hierarchy:

1. Avatar, name, ID/course and email; status badge and optional action at the right.
2. OJT placement summary.
3. Required assessments completed/remaining and recommendation lock state.
4. Overall percentage and a slim progress bar, when results are displayed.
5. Compact category panels with label, percentage, qualitative tag and score bar.
6. Best skill summary, then a blue-tinted top-company match strip when available.

Current outer grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
Students skill panels use one column on mobile and two from `sm`.
Cards share the grid's row height naturally; do not add a large fixed height just
to reproduce empty space from a two-student screenshot.

The current unfinished card replaces the evidence area with Waiting for assessment
and subdued category placeholders. Retain the identity and progress context.
When adding more states, use state-specific explanations for stopped/flagged or
incomplete work rather than treating every unfinished record as simply waiting.

Truncate long email/company/category labels only when necessary, and make their
full values available in an accessible detail view. Keep scores and status labels
readable instead of shrinking the whole card.

## 7. Pagination contract

Reuse [Pagination.jsx](../../../../skillbridge-frontend/src/components/Pagination.jsx).
It accepts `total`, `page` (1-based), `onPage` and `pageSize` (default 10).
The caller owns filtering, sorting, page clamping and data slicing; the component
only renders controls and the range summary.

- Render one paginator below the collection, shared by cards and list.
- Pass the filtered total, never the length of the current page slice.
- Hide pagination when `ceil(total / pageSize) <= 1`, including zero results.
- Show `Showing {from}–{to} of {total}` and Prev/Next with numbered pages.
- Show the first page, last page and current page with its immediate neighbors;
  insert non-interactive ellipses for gaps. The active page uses the dark pill
  treatment; other numbers stay quiet.
- Disable Prev on the first page and Next on the last page.
- Clamp the visible page when filters, removal or refreshed data reduce the
  available pages. Zero results must not produce an invalid range such as 1–0.
- At desktop widths, range text sits left and controls right. On small screens,
  controls stack above the range text.

Synthetic examples, using Students' page size of 10:

| Filtered total / selected page | Expected footer |
| --- | --- |
| 2 / 1 | No paginator; toolbar still says 2 students |
| 26 / 2 | Showing 11–20 of 26; pages 1, 2, 3; Prev and Next enabled |
| 26 / 3 | Showing 21–26 of 26; Next disabled |
| 100 / 5 | Showing 41–50 of 100; `1 … 4 5 6 … 10` |
| 0 after filtering | Empty state; no paginator |

Current pages paginate locally after loading their collection. For a future
server-paginated endpoint, send search/filter/sort/page to the server and use its
filtered total. Do not filter only the fetched page and present that as the total.
Keep the same visible interaction pattern.

## 8. Scores, statuses and missing data

| Score band | Shared legend | Visual treatment |
| --- | --- | --- |
| At least 80% | Strong | Green tint, green text/bar |
| At least 60% and below 80% | Fair; currently labeled 60–79% | Amber tint, amber text/bar |
| Below 60% | Needs work | Rose tint, rose text/bar |
| No evidence | Not assessed / dash | Neutral, explanatory text |

Put the score key after the collection/footer and allow it to wrap. Display
numbers and labels alongside color. Qualitative skill tags such as Expert and
Competent use their own existing formatter rules; the three score-key bands do
not redefine those tags.

Keep Overall, category percentages and company match percentages distinctly
labeled. These pages currently calculate the displayed Overall as a rounded
mean of the category percentages they receive. That display helper is not a
definition of backend combined competency or recommendation scoring. Reusing the
layout does not authorize changing calculations, evidence eligibility, placement
rules or recommendation visibility. See the [project overview](../../../../knowledge/PROJECT_OVERVIEW.md).

## 9. Loading, empty and error states

Reuse [DataSection](../../../../skillbridge-frontend/src/components/DataSection.jsx) for
initial skeletons, retryable section errors and background-refresh feedback.
Keep last-loaded content visible while revalidating, following the
[data freshness](../../../../knowledge/LIVE_DATA_FRESHNESS.md) and [loading](../../../../knowledge/NAVIGATION_LOADING.md) guides.

For new collections, distinguish:

- **No records yet:** Explain what belongs here and show an authorized next step,
  such as Enroll students.
- **No filtered matches:** Keep controls visible; show No students match your
  search and Clear filters, resetting search and filter groups and page 1.
- **No evidence for one record:** Keep its card/row visible with an explicit
  missing-evidence message.
- **Load failure:** Provide Retry and an accurate message. Never present a failed
  request as a successful empty collection.
- **Archived context:** Keep the archive indicator and applicable read-only
  restrictions visible; preserve backend access checks for every action.

## 10. Accessibility and responsive guidance for future work

These are acceptance criteria for new or updated UI, not claims that every
current shared component already implements them.

- Give search a programmatic label; placeholder text alone is insufficient.
- Label icon buttons, for example Show cards, Show list and Remove student.
  Expose selected view/filter state with `aria-pressed` or appropriate native
  single-selection semantics.
- Put sortable-header actions in keyboard-operable controls and set `aria-sort`
  on the active header. Use `scope="col"` for column headers.
- Give pagination a labeled navigation region and mark the active page with
  `aria-current="page"`. Consider a polite result-count announcement after
  filtering without announcing every background refresh.
- Preserve Enter/Space activation, visible keyboard focus, dialog focus handling
  and independent row/card actions. Prefer a clearly labeled details action
  where a whole-card trigger would create nested interactive controls.
- Allow enough pointer/touch area around small icons and pills. Aim for 44px
  touch targets where practical while keeping the compact visual treatment.
- Preserve cards below `sm` (normally 640px) and the 3-column grid from `lg`
  (normally 1024px), unless an intentional responsive change is requested.
- Check narrow phones, intermediate widths, large desktops, dark mode and 200%
  zoom with long names, many categories and large filtered counts. Keep both
  views equivalent in information and available actions.

## 11. Implementation map

| Reuse/reference | Source |
| --- | --- |
| Dashboard presentation | [InstructorDashboard.jsx](../../../../skillbridge-frontend/src/pages/instructor/InstructorDashboard.jsx) |
| Dashboard query/filter/sort/page state | [useInstructorDashboard.js](../../../../skillbridge-frontend/src/hooks/instructor/useInstructorDashboard.js) |
| Students presentation and toolbar | [EnrolledStudents.jsx](../../../../skillbridge-frontend/src/pages/instructor/EnrolledStudents.jsx) |
| Students batch/filter/page state | [useEnrolledStudents.js](../../../../skillbridge-frontend/src/hooks/instructor/useEnrolledStudents.js) |
| Page controls | [Pagination.jsx](../../../../skillbridge-frontend/src/components/Pagination.jsx) |
| Search pattern | [SearchBar.jsx](../../../../skillbridge-frontend/src/components/SearchBar.jsx) |
| Identity | [Avatar.jsx](../../../../skillbridge-frontend/src/components/Avatar.jsx) |
| Status pills | [StatusBadge.jsx](../../../../skillbridge-frontend/src/components/StatusBadge.jsx) |
| Category evidence panels/tags | [SkillTagBadge.jsx](../../../../skillbridge-frontend/src/components/SkillTagBadge.jsx), [formatters.js](../../../../skillbridge-frontend/src/utils/formatters.js) |
| OJT summary | [PlacementStatusCard.jsx](../../../../skillbridge-frontend/src/components/placements/PlacementStatusCard.jsx) |
| Filtered empty state | [EmptyState.jsx](../../../../skillbridge-frontend/src/components/EmptyState.jsx) |
| Dialog interaction reference | [Student detail modal guide](../../../../knowledge/STUDENT_DETAIL_MODAL_REDESIGN.md) |

EnrolledStudents currently implements its own search field and empty-state markup;
the shared components above provide reusable patterns. Card/table presentation
and toolbar pills also remain page-local. Do not assume a generic collection
component already exists or introduce a new table library just to match this UI.
Use the existing Axios client and data hooks; the design reference does not
require a new dependency or changes to Tailwind configuration.

## 12. Checklist for the next collection UI

- [ ] Match the surface, spacing, typography, filter pills and view-switch style.
- [ ] Pick an initial view and page size appropriate to the workflow.
- [ ] Filter and sort the full relevant collection before pagination.
- [ ] Keep count, page range and visible items consistent after every change.
- [ ] Preserve filters and page between cards/list; reset page on search/filter changes.
- [ ] Clamp the page after removal or refreshed results shrink.
- [ ] Cover first/last page, ellipses, a partial last page and zero/one-page results.
- [ ] Cover long labels, missing scores, no matches, loading, errors and dark mode.
- [ ] Verify keyboard interaction, accessible control labels and narrow-screen layout.
- [ ] Preserve authorization, confirmation flows and assessment/placement meanings.

Suggested prompt for a future UI task:

> Use $skillbridge-collection-ui and its collection UI reference for this
> collection. Match the instructor dashboard/Students search, filter
> pills, cards/list switch, surfaces and pagination. Adapt fields and filters to
> this workflow, preserve existing permissions and business rules, and verify
> responsive, empty, loading and error states. Explain intentional deviations.

Documentation basis: the two user-provided screenshots and source inspection on
17 October 2026. No application behavior was changed or browser-tested while
creating this guide.
