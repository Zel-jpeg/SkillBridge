export function mergeSuggestedTags(value, suggested) {
  const seen = new Set()
  const existing = value.split(',').map(tag => tag.trim()).filter(tag => {
    const key = tag.toLocaleLowerCase()
    if (!tag || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const added = []
  for (const tag of suggested) {
    const key = tag.toLocaleLowerCase()
    if (!seen.has(key) && existing.length + added.length < 30) { seen.add(key); added.push(tag) }
  }
  return [...existing, ...added].join(', ')
}
