/** Display only. Never use this text as recommendation/NLP input. */
export function scorePercentage(value) {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

// Preserve API precision: distinct stored percentages must not look tied.
export function categoryPercentage(value) {
  const number = scorePercentage(value)
  return number == null ? 'Not available' : `${number}%`
}

export function assessmentSummary(scores = [], { scope = 'combined', audience = 'staff', locked = false } = {}) {
  if (locked) return { highestLabel: 'Results locked', highestNames: '', summary: 'Combined assessment results are locked until current evidence is finalized.', suggestions: [], leaders: [] }
  const rows = (Array.isArray(scores) ? scores : []).map(row => ({
    category: row.category || (row.category_id != null ? `Category ${row.category_id}` : 'Unnamed category'),
    percentage: row.max_score != null && Number(row.max_score) <= 0 ? null : scorePercentage(row.percentage),
  }))
  const assessed = rows.filter(row => row.percentage != null)
  const context = scope === 'individual' ? 'This individual assessment' : 'Combined assessment results'
  if (!assessed.length) return { highestLabel: 'No assessed category scores', highestNames: '', summary: `${context}: no assessed category scores are available.`, suggestions: [], leaders: [] }
  let maximum = 0
  for (const row of assessed) maximum = Math.max(maximum, row.percentage)
  const leaders = assessed.filter(row => row.percentage === maximum)
  const tied = leaders.length > 1
  const highestLabel = maximum === 0 ? 'No assessed category scored above zero' : `Highest-scoring area${tied ? 's' : ''}: ${tied ? 'tied at ' : ''}${categoryPercentage(maximum)}`
  const highestNames = leaders.map(row => row.category).join(' · ')
  const subject = audience === 'student' ? 'you scored' : 'the student scored'
  let summary = maximum === 0
    ? `${context}: no assessed category scored above zero. ${assessed.map(row => `${row.category}: 0%`).join('; ')}.`
    : `${context}: ${subject} ${tied ? `equally highest in these ${leaders.length} areas: ` : 'highest in '}${leaders.map(row => row.category).join(' · ')} (${categoryPercentage(maximum)}${tied ? ' each' : ''}).`
  const others = assessed.filter(row => row.percentage !== maximum)
  if (others.length) summary += ` Other assessed scores: ${others.map(row => `${row.category}: ${categoryPercentage(row.percentage)}`).join('; ')}.`
  const missing = rows.filter(row => row.percentage == null)
  if (missing.length) summary += ` No assessed score available: ${missing.map(row => row.category).join(' · ')}.`
  const focus = assessed.filter(row => row.percentage < 80)
  const suggestions = (focus.length ? focus : assessed).map(row => ({
    ...row,
    message: focus.length
      ? `Continue guided practice and practical activities in ${row.category.toLowerCase()}.`
      : `Continue developing ${row.category.toLowerCase()} through more complex practical projects and peer collaboration.`,
  }))
  return { highestLabel, highestNames, summary, suggestions, leaders }
}
