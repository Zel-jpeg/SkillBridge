import { useEffect, useRef, useState } from 'react'
import { applyDataChange, useApi } from './useApi'
import { queryStore } from '../api/queryStore'
import { readBrowserSession } from '../api/sessionRenewal'
import { useToast } from '../context/ToastContext'
import { publishOrganizationRecord } from '../utils/organizationCache'

const accessLost = status => [401, 403, 404].includes(status)
const explicitRejection = status => status >= 400 && status < 500 && status !== 408

function validRecord(row, id) {
  return row?.id === id && typeof row.name === 'string' && typeof row.code === 'string' &&
    (row.banner_color === null || Number.isInteger(row.banner_color))
}

function sameRecord(left, right) {
  return ['banner_color', 'image_url', 'name', 'code', 'description', 'is_active', 'program_count'].every(field => left[field] === right[field]) &&
    JSON.stringify(left.aliases) === JSON.stringify(right.aliases)
}

export function useOrganizationBannerSave() {
  const [states, setStates] = useState({})
  const operations = useRef(new Map())
  const { request } = useApi()
  const { showToast } = useToast()

  useEffect(() => {
    const active = operations.current
    function reset() {
      active.clear()
      setStates({})
    }
    window.addEventListener('auth:reset', reset)
    return () => {
      window.removeEventListener('auth:reset', reset)
      active.clear()
    }
  }, [])

  function isCurrent(operation) {
    return operations.current.get(operation.url) === operation && readBrowserSession().id === operation.sessionId
  }

  function update(operation, state) {
    operation.state = state
    if (!state) operations.current.delete(operation.url)
    setStates(previous => {
      const next = { ...previous }
      if (state) next[operation.url] = { ...state, color: operation.color }
      else delete next[operation.url]
      return next
    })
  }

  function reconcile(operation, row) {
    publishOrganizationRecord(queryStore, operation.url, row)
    applyDataChange({ topics: ['organization'] })
    if (row.banner_color === operation.color && !row.image_url) {
      update(operation, null)
      showToast('Banner saved.', 'success')
      return
    }
    update(operation, { phase: 'different', message: 'The saved banner differs from your preview. Review the current banner before editing again.' })
  }

  function handleAccessLoss(operation, result) {
    update(operation, null)
    if (result.status !== 401) {
      queryStore.evict(operation.url)
      applyDataChange({ topics: ['organization'] })
      showToast(result.message || 'This banner is no longer available to edit.', 'error')
    }
  }

  async function checkOperation(operation) {
    update(operation, { phase: 'checking' })
    const result = await request('get', `${operation.url}?_t=${Date.now()}`, undefined, { silentError: true })
    if (!isCurrent(operation)) return
    if (result.cancelled) update(operation, null)
    else if (accessLost(result.status)) handleAccessLoss(operation, result)
    else if (result.ok && validRecord(result.data, operation.original.id)) reconcile(operation, result.data)
    else update(operation, { phase: 'uncertain', message: 'Could not confirm whether the banner was saved. Check the saved banner to continue.' })
  }

  async function commit(operation) {
    const result = await request('patch', operation.url, { banner_color: operation.color }, { silentError: true })
    if (!isCurrent(operation)) return
    if (result.cancelled) update(operation, null)
    else if (accessLost(result.status)) handleAccessLoss(operation, result)
    else if (result.ok && validRecord(result.data, operation.original.id)) {
      const current = queryStore.read(operation.listUrl)?.data?.results?.find(row => row.id === operation.original.id)
      // A refresh may already show another administrator's newer edit.
      if (current && !sameRecord(current, operation.original) && !sameRecord(current, result.data)) await checkOperation(operation)
      else reconcile(operation, result.data)
    } else if (explicitRejection(result.status)) {
      update(operation, { phase: 'rejected', message: result.message || 'The banner could not be saved.' })
    } else await checkOperation(operation)
  }

  function save(url, listUrl, original, color) {
    const existing = operations.current.get(url)
    const sessionId = readBrowserSession().id
    if (!sessionId || ['saving', 'checking', 'uncertain'].includes(existing?.state.phase)) return false
    const operation = { url, listUrl, original, color, sessionId }
    operations.current.set(url, operation)
    update(operation, { phase: 'saving' })
    void commit(operation)
    return true
  }

  function check(url) {
    const operation = operations.current.get(url)
    if (operation && isCurrent(operation) && ['uncertain', 'different'].includes(operation.state.phase)) void checkOperation(operation)
  }

  function discard(url) {
    const operation = operations.current.get(url)
    if (operation && isCurrent(operation) && ['rejected', 'different'].includes(operation.state.phase)) update(operation, null)
  }

  return { states, save, check, discard }
}
