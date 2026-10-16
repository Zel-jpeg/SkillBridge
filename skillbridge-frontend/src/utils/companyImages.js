export const MAX_COMPANY_IMAGE_BYTES = 5 * 1024 * 1024

export function companyImageError(file) {
  if (!file) return ''
  if (file.size > MAX_COMPANY_IMAGE_BYTES) return 'Choose an image of at most 5 MiB.'
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a static JPEG, PNG, or WebP image.'
  return ''
}

// Only form details and the JSON envelope enter requests. File/preview state
// stays in the form and never enters the shared API cache or browser storage.
export function companyRequest(details, image = { action: 'unchanged' }) {
  const payload = { ...details, image_action: image.action }
  if (image.action !== 'replace') return payload
  const form = new FormData()
  form.append('payload', JSON.stringify(payload))
  form.append('image', image.file)
  return form
}
