import { useSyncExternalStore } from 'react'
import { createNotificationReadStore, notificationFingerprint } from '../utils/notificationReadState'

const store = createNotificationReadStore(() => window.localStorage)
const hasRead = (read, entry) => read.has(notificationFingerprint(entry)) || read.has(notificationFingerprint(entry, true))

export function notificationWasRead(entry) {
  return hasRead(new Set(store.getSnapshot().reads.map(([fingerprint]) => fingerprint)), entry)
}
let removeStorageListener
let subscriptions = 0
function subscribe(listener) {
  const unsubscribe = store.subscribe(listener)
  if (subscriptions++ === 0) {
    const onStorage = event => store.invalidate(event.key)
    window.addEventListener('storage', onStorage)
    removeStorageListener = () => window.removeEventListener('storage', onStorage)
  }
  return () => { unsubscribe(); if (--subscriptions === 0) removeStorageListener() }
}

export function useNotificationReads(entries) {
  const snapshot = useSyncExternalStore(subscribe, store.getSnapshot)
  const read = new Set(snapshot.reads.map(([fingerprint]) => fingerprint))
  const isRead = entry => hasRead(read, entry)
  return {
    isRead,
    unread: entries.filter(entry => !isRead(entry)),
    markRead: items => store.markRead(items, snapshot.owner),
  }
}
