import { useState } from 'react'
import { getInitials } from '../utils/formatters'

export default function CompanyImage({ name, imageUrl, className = 'w-10 h-10 rounded-xl', loading = 'lazy' }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const frame = `${className} shrink-0 border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800`
  return imageUrl && failedUrl !== imageUrl
    ? <img src={imageUrl} alt={`${name || 'Company'} logo`} loading={loading} decoding="async" referrerPolicy="no-referrer"
        className={`${frame} object-contain p-1`} onError={() => setFailedUrl(imageUrl)} />
    : <span role="img" aria-label={`${name || 'Company'} logo`} className={`${frame} inline-flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300`}>{getInitials(name) || '?'}</span>
}
