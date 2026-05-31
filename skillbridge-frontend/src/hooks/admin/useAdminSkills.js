import { useState, useEffect } from 'react'
import api from '../../api/axios'

export function useAdminSkills() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState(null)
  
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toast, setToast] = useState('')

  const fetchSkills = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/admin/skills/')
      setSkills(res.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch skills', err)
      setError('Failed to load skills.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSkills()
  }, [])

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.description || '').toLowerCase().includes(search.toLowerCase())
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
        setSkills(prev => prev.map(s => s.id === skillData.id ? res.data : s))
        showToast('Skill updated successfully.')
      } else {
        // Add
        const res = await api.post('/api/admin/skills/', skillData)
        setSkills(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
        showToast('Skill added successfully.')
      }
      setShowModal(false)
      setSelectedSkill(null)
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
      setSkills(prev => prev.filter(s => s.id !== deleteConfirm.id))
      setDeleteConfirm(null)
      showToast('Skill deleted successfully.')
    } catch (err) {
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
