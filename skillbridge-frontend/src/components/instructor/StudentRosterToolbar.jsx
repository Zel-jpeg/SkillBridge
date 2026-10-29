import { useState } from 'react'
import GroupedFilterPanel from '../GroupedFilterPanel'
import { fetchWithDedup, useApi } from '../../hooks/useApi'
import { DEFAULT_ROSTER_FILTERS, filterPreviouslyUnenrolled, filterRosterStudents, rosterFilterCount } from '../../utils/studentRosterFilters'

const groups = [
  { key: 'course', label: 'Course', options: [['all', 'All courses'], ['BSIT', 'BSIT'], ['BSIS', 'BSIS']] },
  { key: 'enrollment', label: 'Enrollment', options: [['enrolled', 'Enrolled students'], ['unenrolled', 'Previously unenrolled']] },
  { key: 'accountStatus', label: 'Account status', options: [['all', 'All accounts'], ['active', 'Active'], ['archived', 'Archived']] },
  { key: 'assessmentStatus', label: 'Assessment status', enrolledOnly: true, options: [['all', 'All'], ['complete', 'Complete'], ['incomplete', 'Incomplete'], ['stopped', 'Stopped / flagged'], ['retake', 'Retake approved']] },
  { key: 'recommendationStatus', label: 'Recommendation status', enrolledOnly: true, options: [['all', 'All'], ['available', 'Available'], ['awaiting', 'Awaiting review'], ['approved', 'Approved decision']] },
]

function summary(filters) {
  return groups.filter(group => filters[group.key] !== DEFAULT_ROSTER_FILTERS[group.key]).map(group => {
    const label = group.options.find(([value]) => value === filters[group.key])?.[1]
    if (group.key === 'assessmentStatus') return `Assessments: ${label}`
    if (group.key === 'recommendationStatus') return `Recommendations: ${label}`
    if (group.key === 'accountStatus') return `${label} accounts`
    return label
  }).join(' · ')
}

export default function StudentRosterToolbar({ batchId, students, pending, filters, onApply, onSearch, view, onView, gridIcon: GridIcon, listIcon: ListIcon }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(filters)
  const needsPrevious = filters.enrollment === 'unenrolled' || (open && draft.enrollment === 'unenrolled')
  const previousUrl = batchId && needsPrevious ? `/api/instructor/batches/${batchId}/unenrolled/` : null
  const { data: previous, error: previousError } = useApi(previousUrl)
  const previousPending = needsPrevious && !previous
  const previewPending = draft.enrollment === 'unenrolled' ? previousPending : pending
  const previewFailed = draft.enrollment === 'unenrolled' && Boolean(previousError)
  const count = filters.enrollment === 'unenrolled'
    ? filterPreviouslyUnenrolled(previous?.students || [], filters).length
    : filterRosterStudents(students, filters).length
  const total = filters.enrollment === 'unenrolled' ? previous?.students.length ?? 0 : students.length
  const previewCount = draft.enrollment === 'unenrolled'
    ? filterPreviouslyUnenrolled(previous?.students || [], draft).length
    : filterRosterStudents(students, draft).length
  const activeCount = rosterFilterCount(filters)
  const active = activeCount > 0 || Boolean(filters.search.trim())

  function changeOpen(next) {
    if (next) setDraft({ ...filters })
    setOpen(next)
  }
  function change(key, value) {
    setDraft(previous => ({ ...previous, [key]: value,
      ...(key === 'enrollment' ? { assessmentStatus: 'all', recommendationStatus: 'all' } : {}),
    }))
  }
  return <section className="sb-roster-toolbar" aria-label="Student filters">
    <div className="sb-roster-primary">
      <label className="sb-roster-field"><span className="sr-only">Search students</span><span className="relative block">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        <input value={filters.search} onChange={event => onSearch(event.target.value)} placeholder="Search by name, ID, or email…" className="h-[38px] w-full rounded-xl border border-gray-200 bg-white py-2 pr-4 pl-9 text-xs text-gray-900 outline-none focus:border-green-500 focus-visible:ring-2 focus-visible:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
      </span></label>
      <div className="sb-roster-controls">
        <GroupedFilterPanel groups={groups.map(group => ({ ...group, disabled: group.enrolledOnly && draft.enrollment !== 'enrolled', hint: group.enrolledOnly && draft.enrollment !== 'enrolled' ? 'Available for enrolled students.' : undefined }))}
          draft={draft} onChange={change} open={open} onOpenChange={changeOpen} onApply={() => onApply(draft)}
          onClear={() => setDraft({ ...DEFAULT_ROSTER_FILTERS })} activeCount={activeCount} previewCount={previewCount}
          pending={previewPending} error={previewFailed ? 'Could not load previously unenrolled students.' : undefined}
          onRetry={() => fetchWithDedup(previousUrl).catch(() => {})} noun="students" disabled={!batchId} dialogLabel="Student filter options" errorLabel="Students unavailable" loadingLabel="Loading students…" />
        <div role="group" aria-label="Student view" className="sb-roster-view-tools">
          {[{ value: 'grid', Icon: GridIcon, label: 'Show student cards' }, { value: 'list', Icon: ListIcon, label: 'Show student list' }].map(item =>
            <button key={item.value} type="button" aria-label={item.label} aria-pressed={view === item.value} onClick={() => onView(item.value)}><item.Icon /></button>)}
        </div>
      </div>
    </div>
    <div className="sb-roster-secondary">
      <p role="status">{(filters.enrollment === 'unenrolled' ? previousPending : pending) ? 'Loading students…' : `${count} of ${total} ${total === 1 ? 'student' : 'students'}`}</p>
      {activeCount > 0 && <p className="sb-roster-filter-summary">{summary(filters)}</p>}
      {active && <button type="button" className="sb-roster-reset" onClick={() => onApply({ ...DEFAULT_ROSTER_FILTERS })}>Clear filters</button>}
    </div>
  </section>
}
