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
import { useApi, invalidateCache } from '../useApi'

const URL = '/api/instructor/companies/'

export function useInstructorCompanies() {
  const { data: raw, loading } = useApi(URL)
  const [localData, setLocalData] = useState(null)

  const companies = localData ?? raw ?? []

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
      await api.patch(`/api/instructor/companies/${editing.id}/`, payload)

      // Optimistic local update
      setLocalData(prev => (prev ?? raw ?? []).map(co =>
        co.id !== editing.id ? co : {
          ...co,
          name:    payload.name,
          address: payload.address,
          lat:     payload.lat,
          lng:     payload.lng,
          positions: co.positions.map(p => {
            const u = payload.positions.find(x => x.id === p.id)
            return u ? { ...p, title: u.title, slots: u.slots } : p
          }),
        }
      ))

      invalidateCache(URL)
      showToast(`${payload.name} updated`)
      closeEdit()
    } catch (err) {
      setSaveError(err.response?.data?.error ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [editing, raw])

  return {
    companies: filtered,
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
