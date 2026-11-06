export function skillTagValues(value, draft = '') {
  const seen = new Set()
  const tags = `${value},${draft}`.split(/[,;\n]/).map(tag => tag.trim().replace(/\s+/g, ' ')).filter(tag => {
    const key = tag.toLocaleLowerCase()
    if (!tag || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (tags.length > 30) throw new Error('Use at most 30 tags. Remove a tag before adding another.')
  if (tags.some(tag => tag.length > 80)) throw new Error('Each tag must be 80 characters or fewer.')
  return tags
}
