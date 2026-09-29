import { useState } from 'react'
import { getInitials } from '../utils/formatters'

export default function Avatar({ name, photoUrl, tone, className = "w-8 h-8 rounded-xl text-xs" }) {
  const [imgError, setImgError] = useState(false)

  if (photoUrl && !imgError) {
    return (
      <img 
        src={photoUrl} 
        alt={name || "Avatar"} 
        className={`${className} object-cover shrink-0 shadow-sm`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div role="img" aria-label={name ? `${name} avatar` : 'Avatar'} className={`${className} ${tone === 'neutral' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' : 'bg-linear-to-br from-indigo-400 to-violet-600 text-white'} flex items-center justify-center font-bold shrink-0`}>
      {getInitials(name)}
    </div>
  )
}
