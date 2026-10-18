export function authoringDraftKey(storage = globalThis.localStorage) {
  try {
    const user = JSON.parse(storage.getItem('sb-user'))
    if (!['instructor', 'admin'].includes(user?.role) || !Number.isSafeInteger(user?.id) || user.id <= 0) return null
    return `sb_assessment_draft:${user.role}:${user.id}`
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
