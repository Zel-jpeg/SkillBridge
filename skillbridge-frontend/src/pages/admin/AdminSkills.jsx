import { useState } from 'react'
import AdminNav from '../../components/admin/AdminNav'
import ConfirmModal from '../../components/admin/ConfirmModal'
import SearchBar from '../../components/SearchBar'
import EmptyState from '../../components/EmptyState'
import { useAdminSkills } from '../../hooks/admin/useAdminSkills'

const PlusIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const PencilIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
)

function SkillModal({ skill, onClose, onSave, saving }) {
  const [name, setName] = useState(skill?.name || '')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Skill name is required.')
      return
    }
    const res = await onSave({ id: skill?.id, name })
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {skill ? 'Edit Skill Category' : 'Add Skill Category'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Standardize the skills used across the platform.
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
            <XIcon size={16}/>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-medium rounded-lg border border-rose-100 dark:border-rose-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Skill Name <span className="text-rose-500">*</span>
            </label>
            <input value={name} onChange={e => { setName(e.target.value); setError('') }} autoFocus
              placeholder="e.g. ReactJS"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? <><Spinner /> Saving...</> : skill ? 'Save Changes' : 'Add Skill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminSkills() {
  const {
    skills, loading, error, search, setSearch,
    showModal, setShowModal, selectedSkill, openAdd, openEdit,
    saving, handleSave, deleteConfirm, setDeleteConfirm, handleDelete, toast
  } = useAdminSkills()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav activePath="/admin/skills" />

      {toast && (
        <div className="fixed top-4 right-4 z-60 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {toast}
        </div>
      )}

      {showModal && (
        <SkillModal
          skill={selectedSkill}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Skill Category?"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone and will affect any assessments or positions using this skill.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Skill Taxonomy</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage the global list of skill categories used for recommendations.</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors shrink-0 shadow-sm shadow-green-600/20">
            <PlusIcon /> Add Skill
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between">
            <SearchBar value={search} onChange={setSearch} placeholder="Search skills..." className="w-full sm:max-w-sm" />
            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center text-gray-400">
              <Spinner />
            </div>
          ) : error ? (
            <div className="py-12 flex justify-center">
              <p className="text-sm text-rose-500">{error}</p>
            </div>
          ) : skills.length === 0 ? (
            <EmptyState message="No skill categories found." onClear={() => setSearch('')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Skill Name</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((skill, i) => (
                    <tr key={skill.id} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                      <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                        {skill.name}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEdit(skill)} title="Edit skill"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                            <PencilIcon />
                          </button>
                          <button onClick={() => setDeleteConfirm(skill)} title="Delete skill"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
