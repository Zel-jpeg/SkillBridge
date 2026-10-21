export function authoringDraftKey(storage = globalThis.localStorage) {
  try {
    const user = JSON.parse(storage.getItem('sb-user'))
    if (!['instructor', 'admin'].includes(user?.role) || !Number.isSafeInteger(user?.id) || user.id <= 0) return null
    return `sb_assessment_draft:${user.role}:${user.id}`
  } catch { return null }
}

// Compare authored values, excluding generated IDs and presentation-only state.
export function authoringDraftSignature(draft) {
  return JSON.stringify({
    title: draft.title || '', duration: String(draft.duration || ''),
    selectedBatchId: draft.selectedBatchId || null,
    publicationStatus: draft.publicationStatus || 'draft',
    isRequired: draft.isRequired ?? true, includeInCompetency: draft.includeInCompetency ?? true,
    displayOrder: String(draft.displayOrder ?? 0), availableAt: draft.availableAt || '', dueAt: draft.dueAt || '',
    categories: draft.categories.map(c => c.name),
    questions: draft.questions.map(q => ({
      text: q.text, type: q.type, choices: q.choices, correct: q.correct ?? null,
      identAnswer: q.identAnswer,
      category: draft.categories.find(c => c.id === q.categoryId)?.name ?? null,
    })),
  })
}

export function questionHasContent(q) {
  return Boolean(q.text.trim() || q.identAnswer.trim() || q.correct != null || q.categoryId != null ||
    q.choices.some((choice, i) => choice.trim() && !(q.type === 'truefalse' && choice === ['True', 'False'][i])))
}

export function isRecoverableAuthoringDraft(draft, sharedCategories) {
  if (!draft) return false
  if (draft.version === 2 && draft.hasUserChanges === true) return true
  // Older saves did not distinguish defaults from edits. Ignore only clearly
  // untouched forms; keep incomplete metadata, answers and custom categories.
  if (draft.title?.trim() || String(draft.duration || '').trim() || draft.availableAt || draft.dueAt ||
    (draft.publicationStatus && draft.publicationStatus !== 'draft') ||
    draft.isRequired === false || draft.includeInCompetency === false ||
    draft.questions.length !== 1 || draft.questions.some(q => questionHasContent(q) || q.type !== 'mcq')) return true
  if (!Array.isArray(sharedCategories)) return draft.categories.length > 0
  return draft.categories.some(c => !sharedCategories.some(shared => shared.id === c.id && shared.name === c.name))
}

export function writeAuthoringDraft(key, draft, storage = globalThis.localStorage) {
  if (!key || key !== authoringDraftKey(storage)) return null
  try {
    const savedAt = Date.now()
    storage.setItem(key, JSON.stringify({ ...draft, version: 2, hasUserChanges: true, savedAt }))
    return savedAt
  } catch { return null }
}

export function readAuthoringDraft(key, storage = globalThis.localStorage) {
  try {
    const draft = key && JSON.parse(storage.getItem(key))
    if (!draft || typeof draft !== 'object' || Array.isArray(draft) ||
      !Array.isArray(draft.categories) || !Array.isArray(draft.questions)) return null
    if (['title', 'availableAt', 'dueAt'].some(field => draft[field] != null && typeof draft[field] !== 'string') ||
      (draft.duration != null && !['string', 'number'].includes(typeof draft.duration)) ||
      (draft.publicationStatus != null && !['draft', 'published', 'closed'].includes(draft.publicationStatus))) return null
    if (draft.categories.some(c => !Number.isSafeInteger(c?.id) || typeof c?.name !== 'string') ||
      draft.questions.some(q => !Number.isSafeInteger(q?.id) || typeof q?.text !== 'string' ||
        !['mcq', 'truefalse', 'identification'].includes(q?.type) || !Array.isArray(q?.choices) ||
        q.choices.some(choice => typeof choice !== 'string') || typeof q?.identAnswer !== 'string')) return null
    return draft
  } catch { return null }
}
