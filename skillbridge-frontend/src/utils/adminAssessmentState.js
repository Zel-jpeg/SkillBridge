import { filterAssessments } from './assessmentManagement.js'
import { toManilaInput } from './assessmentDates.js'

export const ASSESSMENTS_URL = '/api/instructor/assessments/'
export const PAGE_SIZE = 10
export const DEFAULT_FILTERS = { search: '', instructor: 'all', batch: 'all', state: 'all', required: 'all', category: 'all', completion: 'all', included: 'all', availability: 'all' }
export const initialAssessmentView = { filters: DEFAULT_FILTERS, view: 'grid', page: 1 }

export function assessmentViewReducer(state, action) {
  switch (action.type) {
    case 'filter': return { ...state, filters: { ...state.filters, [action.key]: action.value }, page: 1 }
    case 'filters': return { ...state, filters: { ...DEFAULT_FILTERS, ...action.value }, page: 1 }
    case 'reset': return { ...state, filters: DEFAULT_FILTERS, page: 1 }
    case 'view': return { ...state, view: action.value }
    case 'page': return { ...state, page: action.value }
    default: return state
  }
}

export function assessmentPage(assessments, filters, requestedPage, pageSize = PAGE_SIZE) {
  // Creation time and ID are immutable: live progress changes cannot reshuffle rows.
  const ordered = filterAssessments(assessments, filters).sort((a, b) =>
    (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || Number(b.id) - Number(a.id))
  const total = ordered.length
  const page = Math.max(1, Math.min(requestedPage, Math.ceil(total / pageSize) || 1))
  return { records: ordered.slice((page - 1) * pageSize, page * pageSize), page, total }
}

export function assessmentDraft(assessment) {
  return {
    title: assessment.title, duration_minutes: String(assessment.duration_minutes),
    publication_status: assessment.publication_status, is_required: assessment.is_required,
    include_in_competency: assessment.include_in_competency, display_order: String(assessment.display_order),
    available_at: toManilaInput(assessment.available_at), due_at: toManilaInput(assessment.due_at),
  }
}

export const draftIsDirty = (draft, baseline) => Object.keys(baseline).some(key => draft[key] !== baseline[key])
export const initialEditor = assessment => ({ draft: assessmentDraft(assessment), baseline: assessmentDraft(assessment) })
export function assessmentEditorReducer(state, action) {
  if (action.type === 'edit') return { ...state, draft: action.draft }
  if (action.type === 'remote' && draftIsDirty(state.draft, state.baseline)) return state
  if (['remote', 'saved', 'reset'].includes(action.type)) return initialEditor(action.assessment)
  return state
}

export function validateAssessmentDraft(draft) {
  const errors = {}
  if (!draft.title.trim()) errors.title = 'Enter an assessment title.'
  if (!draft.duration_minutes || !Number.isInteger(Number(draft.duration_minutes)) || Number(draft.duration_minutes) < 1) errors.duration_minutes = 'Enter a whole number of minutes, at least 1.'
  if (draft.display_order === '' || !Number.isInteger(Number(draft.display_order)) || Number(draft.display_order) < 0) errors.display_order = 'Enter a whole number, at least 0.'
  if (draft.available_at && draft.due_at && draft.due_at <= draft.available_at) errors.due_at = 'Due date must follow the available date.'
  return errors
}
