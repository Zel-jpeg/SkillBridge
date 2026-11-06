import { useState } from 'react'
import { taxonomyBannerColor } from '../utils/taxonomyBannerColors'

const FALLBACK_COVER = '/images/taxonomy-card-cover.webp'

export default function TaxonomyCardBanner({ imageUrl, name, color = 0, loading = 'lazy' }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const uploaded = imageUrl && imageUrl !== failedUrl

  return <img src={uploaded ? imageUrl : FALLBACK_COVER}
    alt={uploaded ? `${name} banner` : ''} loading={loading} decoding="async"
    referrerPolicy="no-referrer"
    className="h-full w-full object-cover"
    style={uploaded ? undefined : { filter: `hue-rotate(${taxonomyBannerColor(color) * 30}deg)` }}
    onError={uploaded ? () => setFailedUrl(imageUrl) : undefined} />
}
