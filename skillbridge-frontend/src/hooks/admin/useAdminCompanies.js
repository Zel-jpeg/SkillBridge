// src/hooks/admin/useAdminCompanies.js
//
// Data hook for AdminCompanies.
// Handles company + position CRUD with optimistic local state.
//
// Fixes vs original:
//   - handleAddCompany: was sending `latitude`/`longitude` — backend expects `lat`/`lng`
//   - normalizeCompany: was mapping `p.skill_requirements` — API returns `requirements`
//   - handleAddPosition: was sending `skill_requirements` — backend expects `requirements`
//   - Added handleSaveCompany  (PATCH /api/admin/companies/:id/)
//   - Added handleSavePosition (PATCH /api/admin/positions/:id/)
//   - Added editCompanyFor / editPositionFor modal state
//   - All handlers now return { ok } so modals can manage their own save spinner
//
// API:
//   GET    /api/admin/companies/               → list + positions
//   POST   /api/admin/companies/               → create
//   PATCH  /api/admin/companies/:id/           → update (name, address, lat, lng)
//   DELETE /api/admin/companies/:id/
//   POST   /api/admin/companies/:id/positions/ → create position
//   PATCH  /api/admin/positions/:id/           → update (title, slots, requirements)
//   DELETE /api/admin/positions/:id/

import { useState, useCallback, useEffect } from 'react'
import { useApi } from '../useApi'
import { useSSE } from '../useSSE'

export const SKILL_CATEGORIES_FALLBACK = [
  'Web Development', 'Database', 'Design', 'Networking', 'Backend',
]
const SSE_PATH = '/api/admin/events/'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert stored address JSON → human-readable display string. */
function addrToString(address) {
  if (!address) return ''
  if (typeof address === 'string') return address
  // { street, barangay, city, province }
  return [address.street, address.barangay, address.city, address.province]
    .filter(Boolean)
    .join(', ')
}

/** Normalize one raw API company → local shape. */
function normalizeCompany(c) {
  return {
    id:          c.id,
    name:        c.name,
    // Compute display string from the stored JSON address
    address:     addrToString(c.address) || 'No address set',
    // Keep the raw JSON so edit modal can pre-fill PSGC dropdowns
    addressParts: (typeof c.address === 'object' && c.address !== null) ? c.address : {},
    lat:  c.lat  ?? null,   // API returns 'lat' (mapped from location_lat)
    lng:  c.lng  ?? null,   // API returns 'lng' (mapped from location_lng)
    positions: Array.isArray(c.positions)
      ? c.positions.map(p => ({
          id:           p.id,
          title:        p.title,
          slots:        p.slots        ?? 1,
          requirements: p.requirements ?? {},   // API field is 'requirements'
        }))
      : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useAdminCompanies() {
  // ── Real-time SSE connection ──────────────────────────────────────
  useSSE(SSE_PATH)

  const { data: companiesData, request } = useApi('/api/admin/companies/')
  const { data: categoriesData }         = useApi('/api/categories/')

  const [companies, setCompanies] = useState([])

  // Re-normalize whenever SSE triggers a re-fetch
  useEffect(() => {
    if (!companiesData) return
    const raw = Array.isArray(companiesData) ? companiesData : []
    setCompanies(raw.map(normalizeCompany))
  }, [companiesData])

  // Use real categories from API or fall back to hardcoded list
  const categories = Array.isArray(categoriesData)
    ? categoriesData.map(c => c.name)
    : SKILL_CATEGORIES_FALLBACK

  // ── Modal visibility state ────────────────────────────────────────
  const [showAddCompany,    setShowAddCompany]    = useState(false)
  const [addPositionFor,    setAddPositionFor]    = useState(null)   // company | null
  const [editCompanyFor,    setEditCompanyFor]    = useState(null)   // company | null
  const [editPositionFor,   setEditPositionFor]   = useState(null)   // { company, position } | null
  const [confirmDeleteComp, setConfirmDeleteComp] = useState(null)   // company | null
  const [confirmDeletePos,  setConfirmDeletePos]  = useState(null)   // { company, position } | null

  // ── Toast ─────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)
  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Company actions ───────────────────────────────────────────────

  /** POST /api/admin/companies/ — optimistically prepend to list. */
  async function handleAddCompany(company) {
    const res = await request('post', '/api/admin/companies/', {
      name:    company.name,
      address: company.addressParts || null,   // store structured JSON
      lat:     company.lat  ?? null,           // FIX: was 'latitude'
      lng:     company.lng  ?? null,           // FIX: was 'longitude'
    })
    if (!res.ok) return { ok: false }

    const newCompany = {
      id:          res.data?.id ?? Date.now(),
      name:        company.name,
      address:     addrToString(company.addressParts) || company.name,
      addressParts: company.addressParts || {},
      lat:         company.lat  ?? null,
      lng:         company.lng  ?? null,
      positions:   [],
    }
    setCompanies(prev => [newCompany, ...prev])
    showToast(`"${company.name}" added.`)
    return { ok: true }
  }

  /** PATCH /api/admin/companies/:id/ — merge changes into existing card. */
  async function handleSaveCompany(company) {
    const res = await request('patch', `/api/admin/companies/${company.id}/`, {
      name:    company.name,
      address: company.addressParts || null,
      lat:     company.lat  ?? null,
      lng:     company.lng  ?? null,
    })
    if (!res.ok) return { ok: false }

    setCompanies(prev => prev.map(c =>
      c.id !== company.id ? c : {
        ...c,
        name:        company.name,
        address:     addrToString(company.addressParts) || c.address,
        addressParts: company.addressParts || c.addressParts,
        lat:         company.lat  ?? null,
        lng:         company.lng  ?? null,
      }
    ))
    showToast(`"${company.name}" updated.`)
    return { ok: true }
  }

  /** Optimistically remove company then fire DELETE. */
  function confirmDeleteCompany() {
    if (!confirmDeleteComp) return
    const { id, name } = confirmDeleteComp
    setCompanies(prev => prev.filter(c => c.id !== id))
    request('delete', `/api/admin/companies/${id}/`)
    showToast(`"${name}" removed.`)
    setConfirmDeleteComp(null)
  }

  // ── Position actions ──────────────────────────────────────────────

  /** POST /api/admin/companies/:id/positions/ — append position to company. */
  async function handleAddPosition(company, position) {
    const res = await request('post', `/api/admin/companies/${company.id}/positions/`, {
      title:        position.title,
      slots:        position.slots,
      requirements: position.requirements,   // FIX: was 'skill_requirements'
    })
    if (!res.ok) return { ok: false }

    const newPos = {
      id:           res.data?.id ?? Date.now(),
      title:        position.title,
      slots:        position.slots,
      requirements: position.requirements,
    }
    setCompanies(prev => prev.map(c =>
      c.id === company.id
        ? { ...c, positions: [...c.positions, newPos] }
        : c
    ))
    showToast(`"${position.title}" added to ${company.name}.`)
    return { ok: true }
  }

  /** PATCH /api/admin/positions/:id/ — update position in place. */
  async function handleSavePosition(companyId, position) {
    const res = await request('patch', `/api/admin/positions/${position.id}/`, {
      title:        position.title,
      slots:        position.slots,
      requirements: position.requirements,
    })
    if (!res.ok) return { ok: false }

    setCompanies(prev => prev.map(c =>
      c.id !== companyId ? c : {
        ...c,
        positions: c.positions.map(p =>
          p.id !== position.id ? p : {
            ...p,
            title:        position.title,
            slots:        position.slots,
            requirements: position.requirements,
          }
        ),
      }
    ))
    showToast(`"${position.title}" updated.`)
    return { ok: true }
  }

  /** Optimistically remove position then fire DELETE. */
  function confirmDeletePosition() {
    if (!confirmDeletePos) return
    const { company, position } = confirmDeletePos
    setCompanies(prev => prev.map(c =>
      c.id !== company.id ? c : {
        ...c,
        positions: c.positions.filter(p => p.id !== position.id),
      }
    ))
    request('delete', `/api/admin/positions/${position.id}/`)
    showToast(`"${position.title}" removed.`)
    setConfirmDeletePos(null)
  }

  // ─────────────────────────────────────────────────────────────────
  return {
    companies,
    categories,
    // Modal visibility
    showAddCompany,    setShowAddCompany,
    addPositionFor,    setAddPositionFor,
    editCompanyFor,    setEditCompanyFor,
    editPositionFor,   setEditPositionFor,
    confirmDeleteComp, setConfirmDeleteComp,
    confirmDeletePos,  setConfirmDeletePos,
    // Actions
    handleAddCompany,
    handleSaveCompany,
    confirmDeleteCompany,
    handleAddPosition,
    handleSavePosition,
    confirmDeletePosition,
    toast,
    SKILL_CATEGORIES_FALLBACK,
  }
}