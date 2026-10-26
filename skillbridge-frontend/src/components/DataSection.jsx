import { useSyncExternalStore } from 'react'
import { queryStore } from '../api/queryStore.js'
import { ContentSkeleton } from './loading/Skeletons'

export { ContentSkeleton }

// Observes the existing cache; does not add fetches, polling or SSE connections.
// Page hooks remain mounted so requests and unsaved form state survive refresh.
export default function DataSection({ url, urls = url ? [url] : [], pending = false, layout = 'cards', count, label = 'Loading content', columns, className, skeleton, children }) {
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
  if (missing.length || pending) return <div className={className} aria-busy="true">{skeleton ?? <ContentSkeleton layout={layout} count={count} columns={columns} label={label} />}</div>
  const content = <>
      {backgroundError && <div role="status" className="sb-data-error"><p>Could not refresh. Showing the last loaded data.</p><button type="button" onClick={retry}>Retry</button></div>}
      {children}
    </>
  // Preserve the page's existing grid/flex/space-y children after initial load.
  return className ? <div className={className}>{content}</div> : content
}
