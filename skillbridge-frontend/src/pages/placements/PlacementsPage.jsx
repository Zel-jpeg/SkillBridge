import { useMemo, useState } from 'react'
import AdminNav from '../../components/admin/AdminNav'
import InstructorNav from '../../components/instructor/InstructorNav'
import Avatar from '../../components/Avatar'
import ScoreLabel from '../../components/ScoreLabel'
import EmptyState from '../../components/EmptyState'
import PageHeader from '../../components/PageHeader'
import SearchBar from '../../components/SearchBar'
import PlacementReportPanel from '../../components/placements/PlacementReportPanel'
import { RefreshIcon, XIcon } from '../../components/Icons'
import { matchColor } from '../../utils/formatters'
import { usePlacements } from '../../hooks/usePlacements'

const ACTIONABLE = new Set(['unplaced', 'suggested'])
const STATUS_STYLES = {
  unplaced: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  suggested: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  approved: 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  already_placed: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  removed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
}
const STATUS_LABELS = {
  unplaced: 'Suggested', suggested: 'Suggested', approved: 'Approved here',
  already_placed: 'Placed elsewhere', removed: 'Removed', rejected: 'Rejected',
}
const selectClass = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-green-500/30'
const inputClass = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500/30'

function StatusPill({ status }) {
  return <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[status] ?? STATUS_STYLES.removed}`}>{STATUS_LABELS[status] ?? status}</span>
}

function addressText(address) {
  if (!address) return ''
  if (typeof address === 'string') return address
  const values = ['street', 'barangay', 'city', 'municipality', 'province', 'region'].map(key => address[key]).filter(Boolean)
  if (!values.length) values.push(...Object.values(address).filter(value => typeof value === 'string' && value.trim()))
  return [...new Set(values)].join(', ')
}

function areaName(company) {
  const address = company.address
  if (!address || typeof address === 'string') return address || 'Unspecified area'
  return address.city || address.municipality || address.province || address.region || 'Unspecified area'
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function StatCard({ label, value, tone, note }) {
  const tones = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-300',
    green: 'bg-green-50 border-green-100 text-green-700 dark:bg-green-950/30 dark:border-green-900 dark:text-green-300',
    amber: 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300',
    violet: 'bg-violet-50 border-violet-100 text-violet-700 dark:bg-violet-950/30 dark:border-violet-900 dark:text-violet-300',
    gray: 'bg-white border-gray-100 text-gray-700 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200',
  }
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-2xl font-bold">{value}</p><p className="text-xs font-medium mt-1 opacity-80">{label}</p>{note && <p className="text-[10px] mt-1 opacity-60">{note}</p>}</div>
}

function ModalShell({ children, onClose, width = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-60 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className={`relative w-full ${width} max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl`}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close modal"><XIcon size={16} /></button>
        {children}
      </div>
    </div>
  )
}

function ActionModal({ action, busy, onClose, onSubmit }) {
  const [remarks, setRemarks] = useState('')
  if (!action) return null
  const labels = {
    approve: ['Approve placement?', 'The backend will validate the student and reserve one available slot.', 'Approve student', 'bg-green-600 hover:bg-green-700'],
    remove: ['Remove suggestion?', 'The placement or suggestion remains visible in history.', 'Remove', 'bg-gray-700 hover:bg-gray-800'],
    reject: ['Reject suggestion?', 'The rejected recommendation remains visible in history.', 'Reject', 'bg-rose-600 hover:bg-rose-700'],
  }
  const [title, description, button, buttonClass] = labels[action.type]
  async function submit(event) {
    event.preventDefault()
    const result = await onSubmit(action, remarks.trim())
    if (result?.ok) onClose()
  }
  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit} className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pr-10">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{action.suggestion.student.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{action.position.title} at {action.company.name}</p>
          <p className="text-xs text-gray-400 mt-1">{action.position.remaining_slots} of {action.position.slots_available} slots remaining</p>
        </div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mt-4 mb-1.5">Reason or remarks (optional)</label>
        <textarea value={remarks} onChange={event => setRemarks(event.target.value)} rows={3} autoFocus placeholder="Add context for placement history…" className={inputClass} />
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${buttonClass}`}>{busy ? 'Saving…' : button}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function DetailModal({ detail, onClose }) {
  if (!detail) return null
  const { suggestion, company, position } = detail
  const scores = [['Hybrid match', suggestion.match_score], ['Category fit', suggestion.category_score_component], ['NLP fit', suggestion.nlp_score_component], ['Location fit', suggestion.location_score_component]]
  return (
    <ModalShell onClose={onClose} width="max-w-2xl">
      <div className="p-6">
        <div className="flex items-center gap-3 pr-10">
          <Avatar name={suggestion.student.name} className="w-12 h-12 rounded-xl text-sm" />
          <div className="min-w-0"><h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{suggestion.student.name}</h2><p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.student.school_id || 'No school ID'} · {suggestion.student.course || 'No course'} · {suggestion.batch?.name || 'No batch'}</p></div>
        </div>
        <div className="mt-5 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-semibold text-gray-900 dark:text-white">{position.title}</p><p className="text-xs text-gray-500 dark:text-gray-400">{company.name}{addressText(company.address) ? ` · ${addressText(company.address)}` : ''}</p></div><StatusPill status={suggestion.placement_status} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {scores.map(([label, score]) => <div key={label} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-center"><p className={`text-xl font-bold ${matchColor(Number(score ?? 0))}`}>{score == null ? '—' : `${Math.round(Number(score))}%`}</p><p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1"><ScoreLabel label={label} /></p></div>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3"><p className="text-xs text-gray-400">Distance</p><p className="font-medium text-gray-900 dark:text-white mt-1">{suggestion.distance_km == null ? 'Not available' : `${Number(suggestion.distance_km).toFixed(1)} km`}</p></div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3"><p className="text-xs text-gray-400">Position capacity</p><p className="font-medium text-gray-900 dark:text-white mt-1">{position.approved_count} approved · {position.remaining_slots} remaining</p></div>
        </div>
        {suggestion.approved_placement && <div className="mt-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 px-4 py-3 text-sm text-violet-700 dark:text-violet-300">Current approved placement: {suggestion.approved_placement.position_title} at {suggestion.approved_placement.company_name}.</div>}
      </div>
    </ModalShell>
  )
}

function ManualAssignmentModal({ students, positions, approvedByStudent, initialPositionId, busy, onClose, onSubmit }) {
  const [studentId, setStudentId] = useState('')
  const [positionId, setPositionId] = useState(initialPositionId ? String(initialPositionId) : '')
  const [studentSearch, setStudentSearch] = useState('')
  const [positionSearch, setPositionSearch] = useState('')
  const [remarks, setRemarks] = useState('')
  const filteredStudents = students.filter(student => { const term = studentSearch.trim().toLowerCase(); return !term || [student.name, student.student_id, student.course, student.batch?.name].filter(Boolean).some(value => String(value).toLowerCase().includes(term)) })
  const filteredPositions = positions.filter(position => { const term = positionSearch.trim().toLowerCase(); return !term || [position.company_name, position.title].some(value => value.toLowerCase().includes(term)) })
  const selectedStudent = students.find(student => String(student.id) === studentId)
  const selectedPosition = positions.find(position => String(position.id) === positionId)
  const existingPlacement = selectedStudent ? approvedByStudent.get(selectedStudent.id) : null
  const full = selectedPosition?.remaining_slots <= 0
  const blocked = !selectedStudent || !selectedPosition || Boolean(existingPlacement) || full
  async function submit(event) { event.preventDefault(); if (blocked) return; const result = await onSubmit(selectedStudent.id, selectedPosition.id, remarks.trim()); if (result?.ok) onClose() }
  return (
    <ModalShell onClose={onClose} width="max-w-3xl">
      <form onSubmit={submit} className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pr-10">Manual placement assignment</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Search for a student and choose a company position. Final validation is performed by the backend.</p>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Find student</label>
            <input value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Name, school ID, course, or batch" className={inputClass} />
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {filteredStudents.map(student => { const approved = approvedByStudent.get(student.id); return <button key={student.id} type="button" onClick={() => setStudentId(String(student.id))} className={`w-full text-left px-3 py-2.5 transition-colors ${studentId === String(student.id) ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}><p className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</p><p className="text-[11px] text-gray-500 dark:text-gray-400">{student.student_id || 'No school ID'} · {student.course || 'No course'} · {student.batch?.name || 'No batch'}</p>{approved && <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-0.5">Already placed at {approved.company.name}</p>}</button> })}
              {!filteredStudents.length && <p className="p-4 text-xs text-center text-gray-400">No students found.</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Find company position</label>
            <input value={positionSearch} onChange={event => setPositionSearch(event.target.value)} placeholder="Company or position title" className={inputClass} />
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {filteredPositions.map(position => <button key={position.id} type="button" onClick={() => setPositionId(String(position.id))} className={`w-full text-left px-3 py-2.5 transition-colors ${positionId === String(position.id) ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}><p className="text-sm font-medium text-gray-900 dark:text-white">{position.title}</p><p className="text-[11px] text-gray-500 dark:text-gray-400">{position.company_name} · {position.remaining_slots} of {position.slots_available} slots left</p>{position.remaining_slots <= 0 && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">Position is full</p>}</button>)}
              {!filteredPositions.length && <p className="p-4 text-xs text-center text-gray-400">No positions found.</p>}
            </div>
          </div>
        </div>
        {existingPlacement && <div className="mt-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 px-4 py-3 text-sm text-violet-700 dark:text-violet-300">{selectedStudent.name} already has an approved placement as {existingPlacement.position.title} at {existingPlacement.company.name}. Remove that placement before assigning another.</div>}
        {full && <div className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{selectedPosition.title} is full. Increase capacity in Companies or remove an approved placement first.</div>}
        <label className="block mt-4"><span className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Remarks (optional)</span><textarea value={remarks} onChange={event => setRemarks(event.target.value)} rows={3} placeholder="Why is this student being assigned manually?" className={inputClass} /></label>
        <div className="flex gap-2 mt-5"><button type="button" onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50">Cancel</button><button type="submit" disabled={busy || blocked} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed">{busy ? 'Assigning…' : 'Assign student'}</button></div>
      </form>
    </ModalShell>
  )
}

function SuggestionRow({ suggestion, company, position, canManage, onAction, onView }) {
  const actionable = ACTIONABLE.has(suggestion.placement_status)
  const approvedHere = suggestion.placement_status === 'approved'
  const placedElsewhere = suggestion.placement_status === 'already_placed'
  const full = position.remaining_slots <= 0
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(220px,1.35fr)_90px_minmax(250px,1fr)_auto] gap-3 xl:items-center px-4 py-4 border-t border-gray-100 dark:border-gray-800 first:border-t-0">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={suggestion.student.name} className="w-10 h-10 rounded-xl text-xs" />
        <div className="min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{suggestion.student.name}</p><p className="text-xs text-gray-500 dark:text-gray-400 truncate">{suggestion.student.school_id || 'No school ID'} · {suggestion.student.course || 'No course'}</p><p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{suggestion.batch?.name || 'No batch'}</p></div>
      </div>
      <div><p className={`text-lg font-bold ${matchColor(Number(suggestion.match_score ?? 0))}`}>{Math.round(Number(suggestion.match_score ?? 0))}%</p><p className="text-[10px] text-gray-400"><ScoreLabel label="Hybrid match" /></p></div>
      <div className="space-y-1.5">
        <StatusPill status={suggestion.placement_status} />
        <p className="text-[11px] text-gray-500 dark:text-gray-400"><ScoreLabel label="Category fit" /> {Math.round(Number(suggestion.category_score_component ?? 0))}% · <ScoreLabel label="NLP fit" /> {Math.round(Number(suggestion.nlp_score_component ?? 0))}% · <ScoreLabel label="Location fit" /> {Math.round(Number(suggestion.location_score_component ?? 0))}%</p>
        {suggestion.distance_km != null && <p className="text-[11px] text-gray-400 dark:text-gray-500">{Number(suggestion.distance_km).toFixed(1)} km away</p>}
        {placedElsewhere && suggestion.approved_placement && <p className="text-[11px] text-violet-600 dark:text-violet-400">{suggestion.approved_placement.position_title} at {suggestion.approved_placement.company_name}</p>}
      </div>
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <button type="button" onClick={() => onView({ suggestion, company, position })} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800">View details</button>
        {canManage && actionable && <><button type="button" disabled={full} title={full ? 'This position has no remaining slots.' : ''} onClick={() => onAction({ type: 'approve', suggestion, company, position })} className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">{full ? 'Position full' : 'Approve'}</button><button type="button" onClick={() => onAction({ type: 'remove', suggestion, company, position })} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium">Remove</button><button type="button" onClick={() => onAction({ type: 'reject', suggestion, company, position })} className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-medium">Reject</button></>}
        {canManage && approvedHere && <button type="button" onClick={() => onAction({ type: 'remove', suggestion, company, position })} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium">Remove placement</button>}
        {placedElsewhere && <button type="button" disabled className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 text-xs font-medium opacity-70 cursor-not-allowed">Already placed</button>}
      </div>
    </div>
  )
}

function ApprovedStudents({ placements }) {
  if (!placements.length) return null
  return (
    <div className="px-4 py-3 bg-green-50/60 dark:bg-green-950/20 border-b border-green-100 dark:border-green-900/40">
      <p className="text-[11px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300 mb-2">Current approved students</p>
      <div className="flex flex-wrap gap-2">
        {placements.map(placement => <div key={placement.id} className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 border border-green-100 dark:border-green-900 px-2.5 py-2"><Avatar name={placement.student.name} className="w-7 h-7 rounded-lg text-[10px]" /><div><p className="text-xs font-semibold text-gray-900 dark:text-white">{placement.student.name}</p><p className="text-[10px] text-gray-500 dark:text-gray-400">{placement.student.school_id || 'No school ID'}{placement.recommendation_id ? ' · Recommended' : ' · Manual'}</p></div></div>)}
      </div>
    </div>
  )
}

export default function PlacementsPage({ role = 'admin' }) {
  const isAdmin = role === 'admin'
  const canManage = ['admin', 'instructor'].includes(role)
  const Nav = isAdmin ? AdminNav : InstructorNav
  const activePath = isAdmin ? '/admin/placements' : '/instructor/placements'
  const placement = usePlacements()
  const [tab, setTab] = useState('suggestions')
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [positionStatus, setPositionStatus] = useState('all')
  const [historyStatus, setHistoryStatus] = useState('all')
  const [action, setAction] = useState(null)
  const [detail, setDetail] = useState(null)
  const [manualRequest, setManualRequest] = useState(null)
  const [reportsOpen, setReportsOpen] = useState(false)

  const approvedPlacements = useMemo(() => placement.placements.filter(item => item.status === 'approved'), [placement.placements])
  const approvedByStudent = useMemo(() => new Map(approvedPlacements.map(item => [item.student.id, item])), [approvedPlacements])
  const approvedByPosition = useMemo(() => {
    const result = new Map()
    approvedPlacements.forEach(item => result.set(item.position.id, [...(result.get(item.position.id) || []), item]))
    return result
  }, [approvedPlacements])
  const areaOptions = useMemo(() => [...new Set(placement.companies.map(areaName))].sort((a, b) => a.localeCompare(b)), [placement.companies])

  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLowerCase()
    return placement.companies.map(company => {
      if (areaFilter !== 'all' && areaName(company) !== areaFilter) return null
      const companyContext = !term || [company.name, addressText(company.address)].filter(Boolean).some(value => value.toLowerCase().includes(term))
      const positions = company.positions.map(position => {
        const approvedStudents = approvedByPosition.get(position.id) || []
        const positionContext = companyContext || position.title.toLowerCase().includes(term)
        const visibleSuggestions = positionContext ? position.suggested_students : position.suggested_students.filter(item => [item.student.name, item.student.school_id, item.student.course, item.batch?.name].filter(Boolean).some(value => String(value).toLowerCase().includes(term)))
        const approvedMatch = approvedStudents.some(item => [item.student.name, item.student.school_id, item.student.course, item.batch?.name].filter(Boolean).some(value => String(value).toLowerCase().includes(term)))
        const searchMatch = positionContext || visibleSuggestions.length > 0 || approvedMatch
        const availableMatch = availabilityFilter === 'all' || position.remaining_slots > 0
        const statusMatch = positionStatus === 'all'
          || (positionStatus === 'needs_approval' && position.remaining_slots > 0 && position.suggested_students.some(item => ACTIONABLE.has(item.placement_status)))
          || (positionStatus === 'full' && position.remaining_slots <= 0)
          || (positionStatus === 'has_approved' && position.approved_count > 0)
        return searchMatch && availableMatch && statusMatch ? { ...position, suggested_students: visibleSuggestions, approved_students: approvedStudents } : null
      }).filter(Boolean)
      if (!positions.length) return null
      const totals = company.positions.reduce((result, position) => ({ slots: result.slots + position.slots_available, approved: result.approved + position.approved_count, remaining: result.remaining + position.remaining_slots }), { slots: 0, approved: 0, remaining: 0 })
      return { ...company, positions, totals, total_positions: company.positions.length }
    }).filter(Boolean)
  }, [approvedByPosition, areaFilter, availabilityFilter, placement.companies, positionStatus, search])

  const filteredHistory = useMemo(() => {
    const term = search.trim().toLowerCase()
    return placement.placements.filter(item => {
      const company = placement.companies.find(entry => entry.id === item.company.id)
      const statusMatch = historyStatus === 'all' || item.status === historyStatus
      const areaMatch = areaFilter === 'all' || (company && areaName(company) === areaFilter)
      const searchMatch = !term || [item.student.name, item.student.school_id, item.student.course, item.company.name, item.position.title, item.remarks, item.batch?.name].filter(Boolean).some(value => String(value).toLowerCase().includes(term))
      return statusMatch && areaMatch && searchMatch
    })
  }, [areaFilter, historyStatus, placement.companies, placement.placements, search])

  function clearFilters() { setSearch(''); setAreaFilter('all'); setAvailabilityFilter('all'); setPositionStatus('all'); setHistoryStatus('all') }
  async function submitAction(currentAction, remarks) {
    const payload = { placementId: currentAction.suggestion.placement_id, recommendationId: currentAction.suggestion.recommendation_id, remarks: remarks || (currentAction.type === 'remove' ? 'No removal reason provided.' : 'No rejection reason provided.') }
    if (currentAction.type === 'approve') return placement.approve(payload.recommendationId, remarks)
    if (currentAction.type === 'remove') return placement.remove(payload)
    return placement.reject(payload)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Nav activePath={activePath} />
      <ActionModal key={action ? `${action.type}-${action.suggestion.recommendation_id}` : 'closed'} action={action} busy={placement.mutating} onClose={() => setAction(null)} onSubmit={submitAction} />
      <DetailModal detail={detail} onClose={() => setDetail(null)} />
      {manualRequest && <ManualAssignmentModal students={placement.students} positions={placement.positions} approvedByStudent={approvedByStudent} initialPositionId={manualRequest.positionId} busy={placement.mutating} onClose={() => setManualRequest(null)} onSubmit={placement.manualAssign} />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <PageHeader title="OJT Placement Management" subtitle={isAdmin ? 'Review ranked recommendations and turn them into approved OJT placements.' : 'Manage OJT placements for students enrolled in your batches.'} action={<><button type="button" onClick={() => setReportsOpen(value => !value)} className={`px-3 py-2 rounded-xl border text-xs font-semibold ${reportsOpen ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-900 dark:text-green-300' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>{reportsOpen ? 'Hide reports' : 'Download reports'}</button><button type="button" onClick={placement.refresh} disabled={placement.refreshing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50"><span className={placement.refreshing ? 'animate-spin' : ''}><RefreshIcon /></span>Refresh</button>{canManage && <button type="button" onClick={() => setManualRequest({})} disabled={!placement.students.length || !placement.positions.length} className="px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50">Manual assignment</button>}</>} />

        {reportsOpen && <PlacementReportPanel companies={placement.companies} positions={placement.positions} placements={placement.placements} students={placement.students} role={role} />}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Companies" value={placement.stats.companies} tone="gray" />
          <StatCard label="Positions" value={placement.stats.positions} tone="violet" />
          <StatCard label="Total slots" value={placement.stats.slots} tone="blue" />
          <StatCard label="Approved" value={placement.stats.approved} tone="green" />
          <StatCard label="Remaining slots" value={placement.stats.remaining} tone="amber" />
          <StatCard label="Unplaced students" value={placement.stats.unplaced} tone="gray" note={`${placement.stats.actionable} actionable suggestions`} />
        </div>

        <div className="flex bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-1 w-fit">
          {[['suggestions', 'Companies & suggestions'], ['history', `Placement history (${placement.placements.length})`]].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${tab === key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400'}`}>{label}</button>)}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Company, position, student, or school ID…" className="sm:col-span-2 lg:col-span-1" />
          <select value={areaFilter} onChange={event => setAreaFilter(event.target.value)} className={selectClass}><option value="all">All areas</option>{areaOptions.map(area => <option key={area} value={area}>{area}</option>)}</select>
          {tab === 'suggestions' ? <><select value={availabilityFilter} onChange={event => setAvailabilityFilter(event.target.value)} className={selectClass}><option value="all">All slot availability</option><option value="available">Available slots only</option></select><select value={positionStatus} onChange={event => setPositionStatus(event.target.value)} className={selectClass}><option value="all">All placement statuses</option><option value="needs_approval">Needs approval</option><option value="full">Full positions</option><option value="has_approved">Has approved placements</option></select></> : <select value={historyStatus} onChange={event => setHistoryStatus(event.target.value)} className={`${selectClass} lg:col-span-2`}><option value="all">All history statuses</option><option value="approved">Approved</option><option value="removed">Removed</option><option value="rejected">Rejected</option><option value="suggested">Suggested</option></select>}
        </div>

        {placement.loading && !placement.companies.length ? <div className="py-20 text-center text-sm text-gray-400">Loading placement data…</div> : placement.error && !placement.companies.length ? <EmptyState message={placement.error} onClear={placement.refresh} /> : tab === 'suggestions' ? (
          filteredCompanies.length === 0 ? <EmptyState message="No companies or positions match these filters." onClear={clearFilters} /> : <div className="space-y-6">{filteredCompanies.map(company => (
            <section key={company.id} className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 px-1">
                <div><h2 className="text-base font-semibold text-gray-900 dark:text-white">{company.name}</h2><p className="text-xs text-gray-400 dark:text-gray-500">{addressText(company.address) || 'Address not provided'}</p></div>
                <div className="flex flex-wrap gap-2 text-[11px]"><span className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">{company.total_positions} position{company.total_positions !== 1 ? 's' : ''}</span><span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{company.totals.slots} slots</span><span className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300">{company.totals.approved} approved</span><span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{company.totals.remaining} remaining</span></div>
              </div>
              {company.positions.map(position => <div key={position.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50/70 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div><h3 className="text-sm font-semibold text-gray-900 dark:text-white">{position.title}</h3><p className="text-xs text-gray-400 mt-0.5">{position.approved_count} approved of {position.slots_available} slots · {position.suggested_students.length} suggestion{position.suggested_students.length !== 1 ? 's' : ''} shown</p></div>
                  <div className="flex items-center gap-2">{canManage && <button type="button" onClick={() => setManualRequest({ positionId: position.id })} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Assign manually</button>}<div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${position.remaining_slots > 0 ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>{position.remaining_slots} remaining</div></div>
                </div>
                <ApprovedStudents placements={position.approved_students} />
                {position.suggested_students.length ? position.suggested_students.map(suggestion => <SuggestionRow key={suggestion.recommendation_id} suggestion={suggestion} company={company} position={position} canManage={canManage} onAction={setAction} onView={setDetail} />) : <p className="px-4 py-6 text-xs text-center text-gray-400">No ranked suggestions for this position.</p>}
              </div>)}
            </section>
          ))}</div>
        ) : filteredHistory.length === 0 ? <EmptyState message="No placement history matches these filters." onClear={clearFilters} /> : (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full min-w-225 text-left"><thead className="bg-gray-50 dark:bg-gray-800/60 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Placement</th><th className="px-4 py-3">Score snapshot</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Decision</th><th className="px-4 py-3">Remarks</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{filteredHistory.map(item => <tr key={item.id} className="text-sm text-gray-700 dark:text-gray-300 align-top"><td className="px-4 py-4"><p className="font-semibold text-gray-900 dark:text-white">{item.student.name}</p><p className="text-xs text-gray-400 mt-0.5">{item.student.school_id || 'No school ID'} · {item.student.course || 'No course'} · {item.batch?.name || 'No batch'}</p></td><td className="px-4 py-4"><p className="font-medium">{item.position.title}</p><p className="text-xs text-gray-400 mt-0.5">{item.company.name}</p></td><td className="px-4 py-4 font-semibold">{item.match_score_at_assignment == null ? 'Manual / no score' : `${Math.round(item.match_score_at_assignment)}%`}</td><td className="px-4 py-4"><StatusPill status={item.status} /></td><td className="px-4 py-4 text-xs"><p>{formatDate(item.updated_at)}</p><p className="text-gray-400 mt-1">by {item.approved_by?.name || item.removed_by?.name || item.rejected_by?.name || item.assigned_by?.name || 'System'}</p></td><td className="px-4 py-4 text-xs max-w-60 text-gray-500 dark:text-gray-400">{item.remarks || '—'}</td></tr>)}</tbody></table>
          </div>
        )}
      </main>
    </div>
  )
}

export function InstructorPlacements() {
  return <PlacementsPage role="instructor" />
}
