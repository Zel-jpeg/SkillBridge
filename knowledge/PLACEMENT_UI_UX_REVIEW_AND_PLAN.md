# Placement UI/UX review and proposed plan

21 October 2026. The user subsequently authorized implementation on branch
`update-placement-ui-ux`. The user later selected zero new tables, reuse of existing placement/audit tables
and removal of pinning, then automatic reconciliation on the visible placement
page with preserved coordinator choices and no generation panel. The original
review and design rationale below are
retained as historical context; see the current
[implementation contract](PLACEMENT_DRAFT_IMPLEMENTATION.md) for shipped behavior
and verification. The user prefers company-first placement because there are many
students.

## Recommendation

Use **Companies → Company workspace → Position → Ranked students → Review and
approve** for both admin and instructor. Keep one entry per company in the main
overview. Do not reproduce the student card's company-ranking treatment: students
compare roles for themselves, while staff fill positions with different students.
There is no meaningful single company match score for a staff placement queue.

The current API already groups suggestions by company and position and ranks
students within each position. The problem is that the page expands every group
and all statuses at once. Improve information hierarchy and scope before changing
ranking or adding new metrics.

## Panel workflow clarification

The user clarified that the panel expects the system to propose a student's
company/position placement automatically, with the coordinator/instructor reviewing
and approving before it becomes final. Use **Suggested placement** and **Approved
placement** as visibly distinct states. A suggestion is advisory and must not
silently become an approved assignment.

Recommended action wording:

- **Review suggestion**: inspect the student, target role, evidence and capacity.
- **Approve placement**: confirm the placement and consume a seat after server
  validation succeeds.
- **Choose another position**: inspect alternatives; do not imply the student's
  suitability or assessment score has been rejected.
- **Decline suggestion**: decline this specific student-position proposal with
  context retained in history. Keep distinct from removing an approved assignment.
- **Remove placement**: explicitly remove an existing approval and release its
  capacity under current rules, with confirmation and history retained.

Avoid exposing both Remove suggestion and Reject suggestion as unexplained equal
actions. Do not combine/change existing persisted statuses without defining the
business distinction and history behavior first.

The user's follow-up prefers each student's highest match plus their top three
position suggestions, dynamic capacity during provisional allocation, and keeping
unallocated students available for future opportunities. This narrows the proposed
direction to the model below. It is still a design proposal requiring allocation
policy decisions, not an implemented algorithm or authorization to change data.

### Confirmed allocation rules (21 October 2026)

The user explicitly confirmed:

- **One shared allocation across active batches**, considering students with
  current unlocked results together. Instructor access remains restricted to
  their authorized students, while capacity accounts for all commitments.
- **Propose available matches even when scores are low and flag them for human
  review.** Do not add a minimum match-score eligibility cutoff. A low-score flag
  explains the strength of the evidence; it is not a rejection or automatic
  disqualification. Reuse and clearly label existing score-band presentation
  rather than silently inventing a new acceptance threshold.

These resolve the two user-facing policy questions asked after the review. Retain
the other agreed design constraints: one provisional position per student, top
three position matches accessible, separate provisional/approved seat counts,
approved placements fixed during draft updates, and instructor/admin final
approval. Allocation objective/tie handling must still be specified transparently
and verified during technical design; these confirmations do not mean an
allocation algorithm has already been implemented or evaluated.

### Suggested matches versus draft allocation

Keep two distinct outputs:

1. **Ranked matches:** the student's top three distinct positions by the existing
   match score, with their companies shown. Two positions can belong to the same
   company. Retain access to every other match. A high match is evidence similarity,
   not guaranteed suitability, acceptance or placement eligibility.
2. **Draft allocation:** at most one provisional position per student, respecting
   remaining seats and other students' alternatives. The draft may differ from the
   student's highest match. Display both highest match and proposed draft position
   with a clear capacity/conflict explanation. Final approval remains manual.

Do not allocate sequentially by whichever student is loaded, viewed or processed
first. For example, A has X=95 and Y=94, while B has X=94 and Y=40, with one seat
each. Giving A their highest X first forces B to 40; A→Y and B→X gives both strong
matches. This is why a cohort-level capacity-constrained allocation needs an
explicit objective and deterministic tie policy, not an independent top-choice
assignment. Do not promise a globally optimal or fair allocation before choosing
and verifying that policy. Do not restrict the engine to the displayed top three:
other valid alternatives may prevent avoidable unallocated students. Do not invent
a minimum match cutoff as part of the UI work.

### Provisional and approved seat counts

Recommended display for a three-seat role with one approval and one active draft:
**3 total · 1 approved · 1 proposed · 1 open in draft**.

- Official remaining capacity remains `total minus approved` (2 in this example),
  consistent with existing placement reports and the documented capacity contract.
- Provisional headroom in the active draft is `total minus approved minus proposed`
  (1 in this example). Label it explicitly; never pass it off as the approved count.
- Top-three alternatives do not reserve seats. Only the student's single active
  draft allocation counts provisionally; approval converts it without double use.
- Declining/changing a draft proposal releases/reassigns provisional capacity. Removing
  an approval is a distinct confirmed action that releases official capacity.
- Shared capacity needs one authoritative active draft or centrally coordinated
  reservations. Independent instructor drafts cannot each consume the same seats.
  Instructor views remain limited to authorized students; counts can reflect shared
  capacity without exposing other instructors' student identities.

The current system has no draft reservation layer. Adding one requires persisted
draft state, lifecycle rules, atomic conflict checks and complete counts. A visual
counter alone is not sufficient. Keep suggested/draft/approved semantics distinct
in student screens, staff screens, exports and history.

### Unallocated students and refresh policy

Use **Awaiting allocation**, not Rejected or Failed placement, for a student with
current usable evidence but no draft seat. Separately label incomplete/stale evidence
and students whose proposals were declined; these are different reasons for not
having a placement. Show top three position matches even if those positions are
full, with capacity labels and an explanation. Retain ranking within each position
for future consideration; do not invent one universal waiting-list rank from scores
for different roles. If a global queue is wanted, define its priority policy first.

When seats increase or a proposal/approval is released, mark the draft as needing
an update and let authorized staff **Update draft allocation**. Preserve approved
placements, coordinator-confirmed draft choices and history; do not reshuffle
reviewed work silently. New companies/positions or matching-input changes also need
fresh valid recommendation evidence under existing provenance rules before inclusion.
The UI should explain which data changed and show the proposed changes before
committing a revised active draft. No automatic recommendation regeneration is
authorized by this planning discussion.

## Evidence and current friction

Inspected the shared [PlacementsPage](../skillbridge-frontend/src/pages/placements/PlacementsPage.jsx),
[usePlacements](../skillbridge-frontend/src/hooks/usePlacements.js),
[report panel](../skillbridge-frontend/src/components/placements/PlacementReportPanel.jsx),
placement API reads/actions in [views.py](../skillbridge-backend/api/views.py),
[capacity definitions](CAPACITY_AND_AREAS.md),
[recommendation contract](RECOMMENDATION_CONTRACT.md),
[saved-ranking freshness](RECOMMENDATION_FRESHNESS.md) and
[role capability review](ROLE_CAPABILITIES_REVIEW_AND_PLAN.md).

Both roles render the same page; the server scopes instructor student data to
their batches, while admin can manage across the system. Capacity counts are
shared globally, including assignments outside an instructor's visible roster.

Read-only local Chrome review used synthetic data for both roles at desktop and
375px mobile widths. All non-read requests and external services were blocked.
The visual stress fixture is not a validated placement dataset. It is used to
inspect density, states and interactions, not to validate metric reconciliation.
With two companies, three positions each and eight candidate rows per position:

- 48 View details controls and 16 enabled Approve controls appeared at once.
- Page height was 6725px at 1440px width and 16546px at 375px width.
- The three placement filter selects had no associated label or aria-label.
- Candidate details did not close on Escape. The page uses a custom overlay
  without the shared native DialogShell's focus/inert/scroll-lock behavior.
- No browser page errors or page-wide horizontal overflow were observed. Mobile
  history uses a wide horizontally scrolling table and hides many fields offscreen.

Specific issues:

1. **Everything is expanded:** approved, placed elsewhere, removed and rejected
   candidates remain among the active suggestions. Company, position and candidate
   detail are all competing in the same reading level; there is no pagination.
2. **Repeated decision noise:** every row repeats all three component scores,
   overall score, status, distance, and up to four actions. Secondary evidence is
   already available in details, which currently provides no next-step action.
3. **Duplicated approved identity:** an approved student may appear in both the
   approved-student strip and the suggestion rows beneath it.
4. **Manual-placement management gap:** manually assigned students appear in the
   approved strip, but that strip has no removal action. The history table also
   has no record action. An assignment with no recommendation therefore has no
   obvious removal path in this page, although the API accepts a placement ID.
5. **Ambiguous counts/scope:** actionable suggestions count recommendation pairs,
   not distinct students, and include full positions. Company totals use all its
   positions while filters can show only some positions. Instructor counts combine
   global capacity with a scoped student roster without an explicit scope note.
6. **History is not a complete data source:** the hook requests only the first
   500 history records. The API supports offset/limit and returns total count, but
   the page neither paginates nor uses that total. The hook derives approved
   rosters/unplaced counts from this limited response. Fix that dependency before
   treating the summaries as complete at larger record counts.
7. **Missing decision context:** the candidate detail shows score components but
   no category-versus-requirement comparison or other role alternatives. Useful
   evidence needs authorized detail data, not invented skill explanations.
8. **Unclear wording:** Remove versus Reject is unexplained. Approval/manual-copy
   text describes backend implementation instead of what the coordinator is doing.

Artifacts are ignored under `skillbridge-frontend/tests/artifacts/placement-ux-review/`:
`review.py`, `observations.json`, role-specific overview, detail, manual-assignment
and history screenshots. No production API, live data or placement writes were used.

## Proposed information architecture

### 1. Company overview

Use a compact company list/table on desktop for comparison, with a card equivalent
on phones. Either version has one entry per company and a clear Open company
action. Do not make a giant gallery of decorative cards with repeated badges.

Show company name/logo, city, number of positions, remaining/total seats and number
of positions with unplaced suggestions to review. Only call a count actionable
when its definition includes open capacity and current evidence. Label global
capacity versus scoped candidate counts. Keep full/empty companies discoverable.

Start with a manageable default such as companies with open seats and current
unplaced suggestions, visibly labeled and easy to clear. Offer All companies,
Open seats and Full filters. Prioritize companies needing review or sort by name;
do not order companies by their single highest candidate score. Show the full
filtered company count and paginate; reset/clamp pages correctly.

Keep three task summaries: Students awaiting placement, Approved placements in
scope and Seats remaining across partner companies. Put catalog totals in a quiet
summary rather than six equally prominent colored cards. Separate unknown/loading
values from zero. Verify metrics against complete, appropriately scoped data.

Add explicit scope: admin All instructors / Instructor / Batch, instructor My
batches / Selected batch. Apply scope consistently to candidates, counts and
history. Company seats remain shared across batches and must be labeled as such.
Report filters should inherit scope or clearly show when a different scope applies.

### 2. Dedicated company workspace

Open a workspace within the placement page (or a nested route), not a chain of
nested dialogs. Use a Back to companies path that restores filters, page and
scroll. Keep company title and shared capacity at the top.

On desktop, use a position list on the left and the selected position's candidate
table on the right. Each position entry shows title, approved/total seats, remaining
seats and unplaced suggestion count. Open the first position needing review; never
silently make an approval. On mobile, use a position selector/list followed by the
same candidate content. Retain a visible company/position breadcrumb.

Do not put every position's full candidate list into a scrollable company modal.
Coordinators need to work repeatedly through one role and retain their place.

### 3. Ranked candidates for the selected position

Default to unplaced suggestions with current results. Keep **Suggested students**
and **Approved students** as distinct views with counts. Put dismissed/rejected
records in history or a deliberate additional view; placed-elsewhere students
remain available through an explicit filter for comparison.

Keep the candidate row to rank within the position, name/ID, batch, hybrid match,
distance when available and a primary **Review candidate** action. Preserve score
precision, missing values and deterministic ordering from the existing ranking.
Use pagination rather than rendering hundreds of candidates or hiding them in
many separate fixed-height scroll boxes. Search must open the relevant company
and position or identify matches so collapsed groups do not hide search results.

Company position order is an operational order (open roles needing review), not
the student's role-match ranking. Student ranking remains specific to each role.
One student may appear under several positions until a placement is approved.

### 4. Candidate review and approval

Use an accessible side panel on desktop and full-screen detail on phones. Show
student identity, batch, target company/position, current placement/evidence state,
and capacity. Follow with overall match and expandable category/NLP/location
components. Add a category-versus-requirements comparison only when the authorized
API provides the evidence; do not interpret NLP as independently assessed skills.

Place **Approve placement** in a persistent footer, with student/position context.
Retain one explicit confirmation of the target and slot use. Remarks survive errors;
prevent repeat submissions. Keep Reject/Remove secondary and explain their effects.
Resolve their meaning with the user before renaming or combining stored statuses.
Do not require closing the detail panel to find an approval action elsewhere.

After a successful approval, show the confirmed result, update remaining capacity
and the approved roster, remove the student from other unplaced queues, and keep
the coordinator in the current company/position. A failed refresh after a saved
action must not encourage replay of the write. If another coordinator filled the
seat first, explain the capacity conflict and preserve the draft remarks.

### 5. Approved placements, manual assignment and history

Give every authorized approved record, including manual assignments with no score,
a View placement and Remove placement path addressed by placement ID. Do not
require a live recommendation to manage an existing approval.

Make Manual assignment contextual: when opened within a position, preselect and
show that position rather than displaying two long pickers. The global action can
still start with either a student or position. Explain missing ranking evidence and
existing assignments; preserve current backend distinctions between manual and
recommendation approval rather than silently enforcing a new eligibility policy.

History is a separate paginated audit view with student, company/position, decision,
actor and timestamp visible. Remarks and full score snapshots belong in record
details. Use responsive record cards on mobile. Do not use the first 500 historical
rows as a substitute for the complete current approved roster. Keep exports as
explicit snapshots with their scope, separate from the placement decision flow.

## Implementation sequence, once approved

1. Confirm Remove/Reject semantics and metric definitions. Build complete scoped
   current-placement/count reads, and consume the history API's total/offset.
2. Introduce company overview and company workspace with retained navigation state;
   keep the shared page architecture and server authorization for both roles.
3. Add selected-position candidate/approved views, search, filters and pagination;
   keep actual scoring and ranking calculations unchanged.
4. Move review/actions into the accessible shared dialog/panel infrastructure;
   add manual-placement management by placement ID and contextual assignment.
5. Polish hierarchy, restrained state colors, readable existing type scale, dark
   mode and responsive behavior. Keep status text and counts alongside colors.

Acceptance: both roles' scopes verified; shared seats clear; no duplicate approved
rows; distinct student versus suggestion counts; >500 history records handled;
manual approvals removable; keyboard/focus/Escape and phone flows work; filter/page
state survives back navigation; zero/full/stale/empty/error states explicit; drafts
and successful-write/failed-refresh recovery preserved; no automatic placement or
ranking/assessment changes. Use synthetic local browser/API checks and the relevant
existing placement authorization, capacity, freshness and recovery test modules.
