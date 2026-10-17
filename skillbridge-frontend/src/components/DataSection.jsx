import { useSyncExternalStore } from 'react'
import { queryStore } from '../api/queryStore.js'

export function ContentSkeleton({ layout = 'cards', count, label = 'Loading content' }) {
  const size = count ?? (layout === 'table' ? 6 : layout === 'stats' ? 4 : layout === 'profile' ? 1 : 3)
  return <div role="status" aria-label={label} aria-busy="true" className={`sb-skeleton sb-skeleton-${layout}`} style={size === 1 ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
    <span className="sr-only">{label}</span>
    {Array.from({ length: size }, (_, i) => <div key={i} aria-hidden="true" className="sb-skeleton-item">
      {layout === 'profile' && <span className="sb-skeleton-avatar" />}
      <span className="sb-skeleton-line sb-skeleton-short" />
      <span className="sb-skeleton-line" />
      <span className="sb-skeleton-line sb-skeleton-medium" />
      {layout === 'profile' && Array.from({ length: 6 }, (_, j) => <span key={j} className="sb-skeleton-field" />)}
    </div>)}
  </div>
}

// Observes the existing cache; does not add fetches, polling or SSE connections.
// Page hooks remain mounted so requests and unsaved form state survive refresh.
export default function DataSection({ url, urls = url ? [url] : [], pending = false, layout = 'cards', count, label = 'Loading content', className, skeleton, children }) {
  useSyncExternalStore(queryStore.observe, queryStore.revision)
  const missing = urls.filter(key => queryStore.read(key)?.data == null)
  const failed = missing.filter(key => queryStore.error(key))
  const backgroundError = urls.some(key => queryStore.error(key)) && !missing.length
  function retry() {
    urls.filter(key => queryStore.error(key) || !queryStore.read(key))
      .forEach(key => queryStore.fetch(key).catch(() => {}))
  }
  if (failed.length) return <div className={className}><div role="alert" className="sb-data-error">
      <p>{failed.some(key => [403, 404].includes(queryStore.error(key)?.response?.status))
        ? 'This content is unavailable or you no longer have access.' : 'Could not load this section. Please try again.'}</p>
      <button type="button" onClick={retry}>Retry</button>
    </div></div>
  if (missing.length || pending) return <div className={className} aria-busy="true">{skeleton ?? <ContentSkeleton layout={layout} count={count} label={label} />}</div>
  const content = <>
      {backgroundError && <div role="status" className="sb-data-error"><p>Could not refresh. Showing the last loaded data.</p><button type="button" onClick={retry}>Retry</button></div>}
      {children}
    </>
  // Preserve the page's existing grid/flex/space-y children after initial load.
  return className ? <div className={className}>{content}</div> : content
}
