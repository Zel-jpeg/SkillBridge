import { useEffect, useSyncExternalStore } from 'react'
import { queryStore, CACHE_TTL } from '../api/queryStore'
import { adoptCollectionPage } from '../api/collectionPage'

export function useCollectionPage(url, data, setPage) {
  const revision = useSyncExternalStore(queryStore.observe, queryStore.revision)
  useEffect(() => {
    const page = adoptCollectionPage(queryStore, url, data, Date.now(), CACHE_TTL)
    if (page !== null) setPage(page)
  }, [url, data, setPage, revision])
}
