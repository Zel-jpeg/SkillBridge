import { useState } from 'react'
import { getInitials } from '../utils/formatters'

export default function Avatar({ name, photoUrl, className = "w-8 h-8 rounded-xl text-xs" }) {
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
    <div className={`${className} bg-linear-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white font-bold shrink-0`}>
      {getInitials(name)}
    </div>
  )
}
