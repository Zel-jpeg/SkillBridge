import { useId, useState } from 'react'
import api from '../../api/axios'
import DialogShell from '../DialogShell'
import ConfirmModal from './ConfirmModal'
import SkillDefinitionFields from '../SkillDefinitionFields'
import { skillTagValues } from '../../utils/skillTagEditor'
import { instituteSkillsUrl } from '../../utils/organizationScope'
import { organizationButton as button, organizationPrimary as primary } from './organizationUi'

export default function SharedSkillEditor({ skill, instituteId, onClose, onSave, saving }) {
  const id = useId()
  const [name, setName] = useState(skill?.name || '')
  const [description, setDescription] = useState(skill?.description || '')
  const [tags, setTags] = useState((skill?.tags || []).join(', '))
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState(false)
  const changed = name !== (skill?.name || '') || description !== (skill?.description || '') ||
    tags !== (skill?.tags || []).join(', ') || Boolean(draft.trim())
  function close() { if (!saving) { if (changed) setDiscard(true); else onClose() } }
  async function submit(event) {
    event.preventDefault()
    if (saving) return
    if (!name.trim() || !description.trim()) { setError('Enter a skill name and description.'); return }
    let values
    try { values = skillTagValues(tags, draft) } catch (failure) { setError(failure.message); return }
    const result = await onSave({ id: skill?.id, name: name.trim(), description: description.trim(), tags: values })
    if (!result.ok) setError(result.error)
  }
  return <DialogShell title={skill ? 'Edit Skill Category' : 'Add Skill Category'} description="Update this skill and its related keywords."
    size="skill" fixedHeader onClose={close} closeDisabled={saving}
    footer={<div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={close}>Cancel</button>
      <button type="submit" form={id} className={primary} disabled={saving}>{saving ? 'Saving…' : skill ? 'Save Changes' : 'Add Skill'}</button></div>}>
    <form id={id} onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      <SkillDefinitionFields name={name} setName={setName} description={description} setDescription={setDescription}
        tags={tags} setTags={setTags} draft={draft} setDraft={setDraft} disabled={saving}
        suggestionKey={JSON.stringify([instituteId, name, description])}
        onSuggest={async () => (await api.post(
          instituteId ? `${instituteSkillsUrl(instituteId)}suggest-tags/` : '/api/tags/suggest/',
          instituteId ? { name, description } : { type: 'skill', name, description },
        )).data.suggested_tags} />
    </form>
    {discard && <ConfirmModal title="Discard skill changes?" message="Your unsaved skill changes will be discarded." confirmLabel="Discard changes" onCancel={() => setDiscard(false)} onConfirm={onClose} />}
  </DialogShell>
}
