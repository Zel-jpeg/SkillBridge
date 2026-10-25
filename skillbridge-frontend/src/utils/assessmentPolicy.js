import { manilaApiDate, toManilaInput } from './assessmentDates.js'

export function assessmentLocks(assessment = {}) {
  const attempted = Boolean(assessment.questions_locked || assessment.attempt_count > 0)
  return { attempted, duration: attempted, opening: attempted,
    publication: assessment.unfinished_attempt_count > 0,
    deadline: attempted && !assessment.due_at }
}

export function assessmentChangeImpact(assessment, draft) {
  const messages = []
  if (draft.publication_status !== assessment.publication_status) {
    messages.push(draft.publication_status === 'published'
      ? 'Publishing makes this assessment available according to its schedule. If required and included, students must complete it before final recommendations unlock.'
      : 'Unpublishing stops new attempts and removes this assessment from current required-completion checks. Eligible closed results can still contribute to competency.')
  }
  if (draft.is_required !== assessment.is_required) messages.push(draft.is_required
    ? 'Making this required adds a completion requirement when it is published and included in competency.'
    : 'Making this optional removes its completion requirement; eligible included results can still contribute.')
  if (draft.include_in_competency !== assessment.include_in_competency) messages.push(draft.include_in_competency
    ? 'Including this assessment adds eligible results to the combined competency profile and may introduce a completion requirement or change recommendations.'
    : 'Excluding this assessment removes its evidence and completion requirement from combined competency. Recommendations may change or lock; individual results remain.')
  if (draft.due_at !== undefined && draft.due_at !== toManilaInput(assessment.due_at)) messages.push('The new deadline applies to new attempts. Existing attempt cutoffs stay unchanged; use Grant extra time to extend an active attempt.')
  return messages
}

export function assessmentDatePayload(assessment, draft) {
  return Object.fromEntries(['available_at', 'due_at'].map(key => [key,
    draft[key] === toManilaInput(assessment[key]) ? assessment[key] ?? null : manilaApiDate(draft[key])]))
}
