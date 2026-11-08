import { useToast } from '../../context/ToastContext'
import { useState, useRef } from 'react'
import api from '../../api/axios'
import { fetchWithDedup, updateCachedData, useApi } from '../useApi'
import { requestErrorMessage } from '../../api/requestErrors'

const SKILLS_URL = '/api/admin/skills/'

export function useAdminSkills(url = SKILLS_URL) {
  const { data, loading, error: loadError } = useApi(url)
  const skills = Array.isArray(data) ? data : []
  const error = loadError ? 'Failed to load skills.' : null

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState(null)
  
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.tags || []).some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  )

  const { showToast } = useToast()

  const handleSave = async (skillData) => {
    if (pending.current) return { ok: false, error: 'A save is already in progress.' }
    pending.current = true
    setSaving(true)
    try {
      if (skillData.id) {
        // Edit
        const res = await api.put(`${url}${skillData.id}/`, skillData)
        updateCachedData(url, skills.map(s => s.id === skillData.id ? res.data : s))
        showToast('Skill updated successfully.')
      } else {
        // Add
        const res = await api.post(url, skillData)
        updateCachedData(url, [...skills, res.data].sort((a, b) => a.name.localeCompare(b.name)))
        showToast('Skill added successfully.')
      }
      setShowModal(false)
      setSelectedSkill(null)
      fetchWithDedup(url).catch(() => {})
      return { ok: true }
    } catch (err) {
      const message = requestErrorMessage(err, { mutation: true })
      showToast(message, 'error')
      return { ok: false, error: message }
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await api.delete(`${url}${deleteConfirm.id}/`)
      updateCachedData(url, skills.filter(s => s.id !== deleteConfirm.id))
      fetchWithDedup(url).catch(() => {})
      setDeleteConfirm(null)
      showToast('Skill deleted successfully.')
    } catch (error) {
      const message = requestErrorMessage(error, { mutation: true })
      showToast(message, 'error')
      return { ok: false, message }
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
  }
}
