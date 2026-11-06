import { useState } from 'react'

const FALLBACK_COVER = '/images/taxonomy-card-cover.webp'

export default function TaxonomyCardBanner({ imageUrl, name, fallbackTone = '', loading = 'lazy' }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const uploaded = imageUrl && imageUrl !== failedUrl

  return <img src={uploaded ? imageUrl : FALLBACK_COVER}
    alt={uploaded ? `${name} banner` : ''} loading={loading} decoding="async"
    referrerPolicy="no-referrer"
    className={`h-full w-full object-cover ${uploaded ? '' : fallbackTone}`}
    onError={uploaded ? () => setFailedUrl(imageUrl) : undefined} />
}
