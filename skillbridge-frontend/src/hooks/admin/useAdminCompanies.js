// src/hooks/admin/useAdminCompanies.js
//
// Data hook for AdminCompanies.
// Fetches companies + categories and handles all CRUD actions.
//
// API:
//   GET    /api/admin/companies/               → list + positions
//   POST   /api/admin/companies/               → create
//   DELETE /api/admin/companies/:id/
//   POST   /api/admin/companies/:id/positions/
//   DELETE /api/admin/positions/:id/

import { useState, useCallback } from 'react'
import { useApi } from '../useApi'

const SKILL_CATEGORIES_FALLBACK = ['Web Development', 'Database', 'Design', 'Networking', 'Backend']

export function useAdminCompanies() {
  const { data: companiesData, request } = useApi('/api/admin/companies/')
  const { data: categoriesData }         = useApi('/api/categories/')

  // Normalize companies from API, or use local state for optimistic updates
  const [companies, setCompanies] = useState([])
  const [_initialized, setInit]  = useState(false)

  // Sync from API once
  if (companiesData && !_initialized) {
    setInit(true)
    const raw = Array.isArray(companiesData) ? companiesData : []
    setCompanies(raw.map(c => ({
      id:        c.id,
      name:      c.name,
      address:   c.address || '',
      lat:       c.latitude  ?? null,
      lng:       c.longitude ?? null,
      slots:     c.slots     ?? 0,
      positions: Array.isArray(c.positions) ? c.positions.map(p => ({
        id:          p.id,
        title:       p.title,
        slots:       p.slots      ?? 1,
        description: p.description ?? '',
        skills:      p.skill_requirements ?? {},
      })) : [],
    })))
  }

  const categories = Array.isArray(categoriesData)
    ? categoriesData.map(c => c.name)
    : SKILL_CATEGORIES_FALLBACK

  // ── Modal state ───────────────────────────────────────────────────
  const [showAddCompany,    setShowAddCompany]    = useState(false)
  const [addPositionFor,    setAddPositionFor]    = useState(null) // company object
  const [confirmDeleteComp, setConfirmDeleteComp] = useState(null)
  const [confirmDeletePos,  setConfirmDeletePos]  = useState(null) // { company, position }
  const [mapOpen,           setMapOpen]           = useState(false)

  // ── Toast ─────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)
  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Actions ───────────────────────────────────────────────────────

  async function handleAddCompany(company) {
    const res = await request('post', '/api/admin/companies/', {
      name:      company.name,
      address:   company.address,
      latitude:  company.lat,
      longitude: company.lng,
      slots:     company.slots ?? 0,
    })
    const newCompany = {
      ...company,
      id:        res?.data?.id ?? Date.now(),
      positions: [],
    }
    setCompanies(prev => [newCompany, ...prev])
    showToast(`"${company.name}" added.`)
    setShowAddCompany(false)
  }

  function confirmDeleteCompany() {
    const id = confirmDeleteComp?.id
    setCompanies(prev => prev.filter(c => c.id !== id))
    request('delete', `/api/admin/companies/${id}/`)
    showToast('Company removed.')
    setConfirmDeleteComp(null)
  }

  async function handleAddPosition(company, position) {
    const res = await request('post', `/api/admin/companies/${company.id}/positions/`, {
      title:              position.title,
      slots:              position.slots,
      description:        position.description,
      skill_requirements: position.skills,
    })
    const newPos = { ...position, id: res?.data?.id ?? Date.now() }
    setCompanies(prev => prev.map(c =>
      c.id === company.id ? { ...c, positions: [...c.positions, newPos] } : c
    ))
    showToast(`Position "${position.title}" added to ${company.name}.`)
    setAddPositionFor(null)
  }

  function confirmDeletePosition() {
    const { company, position } = confirmDeletePos
    setCompanies(prev => prev.map(c =>
      c.id === company.id
        ? { ...c, positions: c.positions.filter(p => p.id !== position.id) }
        : c
    ))
    request('delete', `/api/admin/positions/${position.id}/`)
    showToast(`Position "${position.title}" removed.`)
    setConfirmDeletePos(null)
  }

  return {
    companies, categories,
    // modal state
    showAddCompany, setShowAddCompany,
    addPositionFor, setAddPositionFor,
    confirmDeleteComp, setConfirmDeleteComp,
    confirmDeletePos,  setConfirmDeletePos,
    mapOpen, setMapOpen,
    // actions
    handleAddCompany,
    confirmDeleteCompany,
    handleAddPosition,
    confirmDeletePosition,
    // toast
    toast,
    SKILL_CATEGORIES_FALLBACK,
  }
}
