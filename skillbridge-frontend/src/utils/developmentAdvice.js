import { scorePercentage } from './assessmentSummary.js'
import catalog from './developmentActivities.json' with { type: 'json' }

// Display-only activities. The coverage check keeps categories/aliases aligned
// with api/skill_taxonomy.py without importing its matching logic into the app.
const { activities: ACTIVITIES, aliases: ALIASES } = catalog
const categoryKey = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : ''

function practiceApproach(percentage) {
  // Reuse the existing competency bands; these are practice suggestions, not diagnoses.
  if (percentage >= 90) return 'Add a more complex requirement and explain the trade-offs in your approach.'
  if (percentage >= 80) return 'Extend the activity with a new requirement and compare approaches with a peer.'
  if (percentage >= 70) return 'Try the activity independently, then check and explain your result.'
  if (percentage >= 60) return 'Complete the activity step by step, then repeat it with less help.'
  return 'Start with a worked example from your course materials and ask for guidance when needed.'
}

function reviewTopics(evidence, percentage) {
  // Saved profiles round to one decimal. Do not reuse topics from a different score snapshot.
  const savedPercentage = scorePercentage(evidence?.percentage)
  if (savedPercentage == null || Math.round(savedPercentage * 10) !== Math.round(percentage * 10)) return []
  const seen = new Set()
  return (Array.isArray(evidence?.tags) ? evidence.tags : []).filter(tag => {
    const key = categoryKey(tag)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 4).map(tag => tag.trim().replace(/\s+/g, ' '))
}

/** Display only. Use current summary selections, never saved advice or NLP text. */
export function developmentAdvice(suggestions, { profile, audience = 'student', scope = 'individual' } = {}) {
  const evidence = new Map((Array.isArray(profile?.supporting_categories) ? profile.supporting_categories : [])
    .map(row => [categoryKey(row?.category), row]))
  return (Array.isArray(suggestions) ? suggestions : []).filter(item => scorePercentage(item?.percentage) != null).map(item => {
    const percentage = scorePercentage(item.percentage)
    const key = categoryKey(item.category)
    const normalizedActivityKey = key.replace(/[^a-z0-9+#]+/g, ' ').trim()
    const activityKey = Object.hasOwn(ALIASES, normalizedActivityKey) ? ALIASES[normalizedActivityKey] : normalizedActivityKey
    const activity = (Object.hasOwn(ACTIVITIES, activityKey) ? ACTIVITIES[activityKey] : null)
      || 'Choose one related activity from your course materials, complete it, and explain your approach.'
    const review = percentage < 80
      ? scope === 'individual'
        ? audience === 'student' ? 'Review your incorrect and unanswered questions in this category.' : 'Review incorrect and unanswered questions in this category with the student.'
        : audience === 'student' ? 'Review your incorrect and unanswered questions in the assessments contributing to this category.' : 'Review incorrect and unanswered questions in the contributing assessments with the student.'
      : ''
    const nextStep = audience === 'student'
      ? 'Discuss your result and any difficult concepts with your instructor.'
      : 'Ask the student to explain the result and discuss any difficult concepts together.'
    const approach = practiceApproach(percentage)
    return { ...item,
      message: [review, activity, approach, nextStep].filter(Boolean).join(' '),
      practiceActivity: activity,
      practiceSteps: [review && { label: 'Review your answers', text: review },
        { label: 'How to practise', text: approach },
        { label: 'Discuss your progress', text: nextStep }].filter(Boolean),
      topics: reviewTopics(evidence.get(key), percentage),
    }
  })
}
