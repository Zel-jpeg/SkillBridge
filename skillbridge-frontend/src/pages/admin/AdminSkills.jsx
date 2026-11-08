import { Link } from 'react-router-dom'
import ConfirmModal from '../../components/admin/ConfirmModal'
import SkillLibraryTable from '../../components/SkillLibraryTable'
import { organizationPrimary as primary } from '../../components/admin/organizationUi'
import { useAdminSkills } from '../../hooks/admin/useAdminSkills'
import SkillModal from '../../components/admin/SharedSkillEditor'
import { instituteSkillsUrl } from '../../utils/organizationScope'

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
export default function AdminSkills({ embedded = false, readOnly = false, institute }) {
  const url = institute ? instituteSkillsUrl(institute.id) : readOnly ? '/api/management/shared-ic-skills/' : '/api/admin/skills/'
  const {
    skills, loading, error, search, setSearch,
    showModal, setShowModal, selectedSkill, openAdd, openEdit,
    saving, handleSave, deleteConfirm, setDeleteConfirm, handleDelete
  } = useAdminSkills(url)
  const Heading = embedded ? 'h2' : 'h1'

  return (
    <div className="min-w-0">



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
          message={`Delete unused category "${deleteConfirm.name}"? Categories used by questions, requirements or score history are protected.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <section className={embedded ? 'space-y-5' : 'max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5'}>
        {!embedded && <Link to="/admin/competencies" className="inline-flex min-h-10 items-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:text-green-300 dark:hover:bg-green-950">Back to program skill taxonomy</Link>}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Heading className="text-lg font-bold text-gray-900 dark:text-white">{institute ? `${institute.code} shared skill taxonomy` : 'IC shared skill taxonomy'}</Heading>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{institute ? 'Programs in this institute can reuse these definitions as editable copies.' : 'Shared skills used by IC assessments and position requirements. IC programs can reuse them as editable copies.'}</p>
          </div>
          {!readOnly && <button type="button" onClick={openAdd} className={primary}>
            <PlusIcon /> Add Skill
          </button>}
        </header>
        <SkillLibraryTable url={url} skills={skills} total={loading || error ? null : skills.length} search={search} onSearch={setSearch}
          renderActions={readOnly ? undefined : skill => <>
            <button type="button" onClick={() => openEdit(skill)} title="Edit skill" aria-label={`Edit ${skill.name}`}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-green-50 hover:text-green-800 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-gray-300 dark:hover:bg-green-950">
              <PencilIcon />
            </button>
            <button type="button" onClick={() => setDeleteConfirm(skill)} title="Delete skill" aria-label={`Delete ${skill.name}`}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-gray-300 dark:hover:bg-rose-950">
              <TrashIcon />
            </button>
          </>} />
      </section>
    </div>
  )
}
