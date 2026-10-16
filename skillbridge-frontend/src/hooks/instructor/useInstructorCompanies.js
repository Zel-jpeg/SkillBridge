// src/hooks/instructor/useInstructorCompanies.js
//
// Fetches all companies with positions + matched students for this instructor's batches.
// Exposes open/close/save for editing a company (address + pin + position titles/slots).
//
// API:
//   GET   /api/instructor/companies/
//   PATCH /api/instructor/companies/<id>/  { name, address, lat, lng, positions:[...] }

import { useState, useCallback } from 'react'
import api from '../../api/axios'
import { useApi, invalidateCache, fetchWithDedup, updateCachedData, applyDataChange } from '../useApi'
import { companyRequest } from '../../utils/companyImages'

const URL = '/api/instructor/companies/'

export function useInstructorCompanies() {
  const { data: raw, loading } = useApi(URL)
  const companies = raw ?? []

  // ── Edit state ─────────────────────────────────────────────────────
  const [editing,   setEditing]   = useState(null)   // Company object
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState(null)

  // ── Toast ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)
  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // ── Search + filter ────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const filtered = companies.filter(co =>
    !search.trim() || co.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Open / close ───────────────────────────────────────────────────
  function openEdit(company) {
    setSaveError(null)
    setEditing(company)
  }
  function closeEdit() {
    setEditing(null)
    setSaveError(null)
  }

  // ── Save — called from the modal with fully-resolved payload ───────
  const handleSave = useCallback(async (payload) => {
    // payload: { name, address:{province,city,barangay}, lat, lng, positions:[{id,title,slots}] }
    setSaving(true)
    setSaveError(null)
    try {
      const { image, ...details } = payload
      const response = await api.patch(`/api/instructor/companies/${editing.id}/`, companyRequest(details, image))

      // Optimistic local update for instant feedback
      updateCachedData(URL, (raw ?? []).map(co =>
        co.id !== editing.id ? co : {
          ...co,
          name:    payload.name,
          image_url: response.data.image_url ?? null,
          address: payload.address,
          lat:     payload.lat,
          lng:     payload.lng,
          positions: co.positions.map(p => {
            const u = payload.positions.find(x => x.id === p.id)
            return u ? { ...p, title: u.title, slots: u.slots, tags: u.tags } : p
          }),
        }
      ))

      // Invalidate + re-fetch so the cache has fresh data for the next navigation
      invalidateCache(URL)
      try {
        await fetchWithDedup(URL)
      } catch { /* keep optimistic data if re-fetch fails */ }

      showToast(`${payload.name} updated`)
      applyDataChange({ topics: ['catalog', 'results', 'students', 'placements'] })
      closeEdit()
    } catch (err) {
      setSaveError(err.response?.data?.error ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [editing, raw])

  return {
    companies: filtered, allCompanies: companies,
    allCount:  companies.length,
    loading,
    // Search
    search, setSearch,
    // Edit
    editing, openEdit, closeEdit,
    saving, saveError, handleSave,
    // Toast
    toast,
  }
}
