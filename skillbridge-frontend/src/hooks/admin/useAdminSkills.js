import { useState } from 'react'
import api from '../../api/axios'
import { fetchWithDedup, updateCachedData, useApi } from '../useApi'

const SKILLS_URL = '/api/admin/skills/'

export function useAdminSkills() {
  const { data, loading, error: loadError } = useApi(SKILLS_URL)
  const skills = Array.isArray(data) ? data : []
  const error = loadError ? 'Failed to load skills.' : null

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState(null)
  
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toast, setToast] = useState('')

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.tags || []).some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  )

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSave = async (skillData) => {
    setSaving(true)
    try {
      if (skillData.id) {
        // Edit
        const res = await api.put(`/api/admin/skills/${skillData.id}/`, skillData)
        updateCachedData(SKILLS_URL, skills.map(s => s.id === skillData.id ? res.data : s))
        showToast('Skill updated successfully.')
      } else {
        // Add
        const res = await api.post('/api/admin/skills/', skillData)
        updateCachedData(SKILLS_URL, [...skills, res.data].sort((a, b) => a.name.localeCompare(b.name)))
        showToast('Skill added successfully.')
      }
      setShowModal(false)
      setSelectedSkill(null)
      fetchWithDedup(SKILLS_URL).catch(() => {})
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || 'Failed to save skill.' }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await api.delete(`/api/admin/skills/${deleteConfirm.id}/`)
      updateCachedData(SKILLS_URL, skills.filter(s => s.id !== deleteConfirm.id))
      fetchWithDedup(SKILLS_URL).catch(() => {})
      setDeleteConfirm(null)
      showToast('Skill deleted successfully.')
    } catch {
      alert('Failed to delete skill. It might be in use by an assessment or position.')
      setDeleteConfirm(null)
    }
  }

  const openAdd = () => {
    setSelectedSkill(null)
    setShowModal(true)
  }

  const openEdit = (skill) => {
    setSelectedSkill(skill)
    setShowModal(true)
  }

  return {
    skills: filteredSkills,
    loading,
    error,
    search,
    setSearch,
    showModal,
    setShowModal,
    selectedSkill,
    openAdd,
    openEdit,
    saving,
    handleSave,
    deleteConfirm,
    setDeleteConfirm,
    handleDelete,
    toast
  }
}
