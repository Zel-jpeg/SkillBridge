import { useToast } from '../../context/ToastContext'
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

import { useState, useEffect } from 'react'
import { useApi, invalidateCache, applyDataChange } from '../useApi'
import { useSSE } from '../useSSE'
import { companyRequest } from '../../utils/companyImages'

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
function normalizePosition(position) {
  return {
    ...position,
    archived_at: position.archived_at ?? null,
    slots: position.slots ?? 1,
    tags: position.tags ?? [],
    requirements: position.requirements ?? {},
    eligible_programs: position.eligible_programs ?? [],
    eligibility_configured: position.eligibility_configured ?? false,
    category_requirements: position.category_requirements ?? [],
  }
}

function positionPayload({ title, slots, tags, eligible_program_ids, category_requirements, requirements }) {
  return { title, slots, tags, ...(eligible_program_ids !== undefined
    ? { eligible_program_ids, category_requirements }
    : { requirements }) }
}

function normalizeCompany(c) {
  return {
    id:          c.id,
    archived_at: c.archived_at ?? null,
    name:        c.name,
    management_program_id: c.management_program_id ?? null,
    image_url:   c.image_url ?? null,
    // Compute display string from the stored JSON address
    address:     addrToString(c.address) || 'No address set',
    // Keep the raw JSON so edit modal can pre-fill PSGC dropdowns
    addressParts: (typeof c.address === 'object' && c.address !== null) ? c.address : {},
    lat:  c.lat  ?? null,   // API returns 'lat' (mapped from location_lat)
    lng:  c.lng  ?? null,   // API returns 'lng' (mapped from location_lng)
    positions: Array.isArray(c.positions)
      ? c.positions.map(normalizePosition)
      : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useAdminCompanies() {
  // ── Real-time SSE connection ──────────────────────────────────────
  useSSE(SSE_PATH)

  const { data: companiesData, request } = useApi('/api/admin/companies/')

  const [companiesReady, setCompaniesReady] = useState(companiesData != null)
  const [companies, setCompanies] = useState(() => Array.isArray(companiesData) ? companiesData.map(normalizeCompany) : [])

  // Re-normalize whenever SSE triggers a re-fetch
  useEffect(() => {
    if (!companiesData) return
    const raw = Array.isArray(companiesData) ? companiesData : []
    // Keep optimistic rows in local state, resyncing when the external API cache changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompanies(raw.map(normalizeCompany))
    setCompaniesReady(true)
  }, [companiesData])

  // ── Modal visibility state ────────────────────────────────────────
  const [showAddCompany,    setShowAddCompany]    = useState(false)
  const [addPositionFor,    setAddPositionFor]    = useState(null)   // company | null
  const [editCompanyFor,    setEditCompanyFor]    = useState(null)   // company | null
  const [editPositionFor,   setEditPositionFor]   = useState(null)   // { company, position } | null
  const { data: categoriesData } = useApi('/api/categories/', { skip: !editPositionFor || editPositionFor.position.eligibility_configured })
  const [confirmDeleteComp, setConfirmDeleteComp] = useState(null)   // company | null
  const [confirmDeletePos,  setConfirmDeletePos]  = useState(null)   // { company, position } | null

  // Use real categories from API or fall back to hardcoded list
  const categories = Array.isArray(categoriesData)
    ? categoriesData.map(c => c.name)
    : SKILL_CATEGORIES_FALLBACK

  // ── Toast ─────────────────────────────────────────────────────────
  const { showToast } = useToast()

  // ── Company actions ───────────────────────────────────────────────

  /** POST /api/admin/companies/ — optimistically prepend to list. */
  async function handleAddCompany(company) {
    const res = await request('post', '/api/admin/companies/', companyRequest({
      name:    company.name,
      ...(company.management_program_id ? { management_program_id: company.management_program_id } : {}),
      address: company.addressParts || null,   // store structured JSON
      lat:     company.lat  ?? null,           // FIX: was 'latitude'
      lng:     company.lng  ?? null,           // FIX: was 'longitude'
    }, company.image))
    if (!res.ok) return res

    const newCompany = {
      id:          res.data.id,
      management_program_id: res.data.management_program_id ?? null,
      name:        company.name,
      image_url:   res.data?.image_url ?? null,
      address:     addrToString(company.addressParts) || company.name,
      addressParts: company.addressParts || {},
      lat:         company.lat  ?? null,
      lng:         company.lng  ?? null,
      positions:   [],
    }
    setCompanies(prev => [newCompany, ...prev])
    invalidateCache('/api/admin/companies/')   // force fresh fetch on next navigation
    showToast(`"${company.name}" added.`)
    applyDataChange({ topics: ['catalog', 'results', 'students', 'placements'] })
    return { ok: true }
  }

  /** PATCH /api/admin/companies/:id/ — merge changes into existing card. */
  async function handleSaveCompany(company) {
    const res = await request('patch', `/api/admin/companies/${company.id}/`, companyRequest({
      name:    company.name,
      address: company.addressParts || null,
      lat:     company.lat  ?? null,
      lng:     company.lng  ?? null,
    }, company.image))
    if (!res.ok) return res

    setCompanies(prev => prev.map(c =>
      c.id !== company.id ? c : {
        ...c,
        name:        company.name,
        image_url:   res.data?.image_url ?? null,
        address:     addrToString(company.addressParts) || c.address,
        addressParts: company.addressParts || c.addressParts,
        lat:         company.lat  ?? null,
        lng:         company.lng  ?? null,
      }
    ))
    invalidateCache('/api/admin/companies/')   // force fresh fetch on next navigation
    showToast(`"${company.name}" updated.`)
    applyDataChange({ topics: ['catalog', 'results', 'students', 'placements'] })
    return { ok: true }
  }

  /** Wait for protected deletion to succeed before removing the card. */
  async function confirmDeleteCompany() {
    if (!confirmDeleteComp) return
    const { id, name } = confirmDeleteComp
    const result = await request('delete', `/api/admin/companies/${id}/`)
    if (!result.ok) return result
    setCompanies(prev => prev.filter(c => c.id !== id))
    invalidateCache('/api/admin/companies/')   // force fresh fetch on next navigation
    showToast(`"${name}" removed.`)
    applyDataChange({ topics: ['catalog', 'results', 'students', 'placements'] })
    setConfirmDeleteComp(null)
    return result
  }

  // ── Position actions ──────────────────────────────────────────────

  /** POST /api/admin/companies/:id/positions/ — append position to company. */
  async function handleAddPosition(company, position) {
    const res = await request('post', `/api/admin/companies/${company.id}/positions/`, positionPayload(position))
    if (!res.ok) return res

    const newPos = normalizePosition({ ...position, ...res.data })
    setCompanies(prev => prev.map(c =>
      c.id === company.id
        ? { ...c, positions: [...c.positions, newPos] }
        : c
    ))
    invalidateCache('/api/admin/companies/')   // force fresh fetch on next navigation
    showToast(`"${position.title}" added to ${company.name}.`)
    return { ok: true }
  }

  /** PATCH /api/admin/positions/:id/ — update position in place. */
  async function handleSavePosition(companyId, position) {
    const res = await request('patch', `/api/admin/positions/${position.id}/`, positionPayload(position))
    if (!res.ok) return res

    setCompanies(prev => prev.map(c =>
      c.id !== companyId ? c : {
        ...c,
        positions: c.positions.map(p =>
          p.id !== position.id ? p : normalizePosition({ ...p, ...position, ...res.data })
        ),
      }
    ))
    invalidateCache('/api/admin/companies/')   // force fresh fetch on next navigation
    showToast(`"${position.title}" updated.`)
    return { ok: true }
  }

  /** Retain the position and dialog until protected deletion succeeds. */
  async function confirmDeletePosition() {
    if (!confirmDeletePos) return
    const { company, position } = confirmDeletePos
    const result = await request('delete', `/api/admin/positions/${position.id}/`)
    if (!result.ok) return result
    setCompanies(prev => prev.map(c =>
      c.id !== company.id ? c : {
        ...c,
        positions: c.positions.filter(p => p.id !== position.id),
      }
    ))
    invalidateCache('/api/admin/companies/')   // force fresh fetch on next navigation
    showToast(`"${position.title}" removed.`)
    applyDataChange({ topics: ['catalog', 'results', 'students', 'placements'] })
    setConfirmDeletePos(null)
    return result
  }

  // ─────────────────────────────────────────────────────────────────
  return {
    companies, initialCompaniesPending: !companiesReady,
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
    SKILL_CATEGORIES_FALLBACK,
  }
}
