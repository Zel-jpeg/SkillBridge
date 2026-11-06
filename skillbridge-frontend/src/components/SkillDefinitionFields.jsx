import { useEffect, useId, useRef, useState } from 'react'
import { XIcon } from './Icons'
import { skillTagValues } from '../utils/skillTagEditor'
import { mergeSuggestedTags } from '../utils/competencyAssistance'
import { organizationField as field, organizationButton as button } from './admin/organizationUi'

export default function SkillDefinitionFields({ name, setName, description, setDescription, tags, setTags,
  draft, setDraft, onSuggest, suggestionKey, disabled = false, children }) {
  const id = useId()
  const [issue, setIssue] = useState('')
  const [status, setStatus] = useState(null)
  const generation = useRef(0)
  const values = tags.split(',').map(tag => tag.trim()).filter(Boolean)
  useEffect(() => () => { generation.current++ }, [suggestionKey])
  const current = status?.key === suggestionKey ? status : null
  function commit() {
    try {
      setTags(skillTagValues(tags, draft).join(', ')); setDraft(''); setIssue('')
    } catch (failure) { setIssue(failure.message) }
  }
  async function suggest() {
    const ticket = ++generation.current
    let manual
    try { manual = skillTagValues(tags, draft).join(', ') } catch (failure) { setIssue(failure.message); return }
    setTags(manual); setDraft(''); setIssue('')
    setStatus({ key: suggestionKey, loading: true })
    try {
      const result = await onSuggest()
      if (ticket !== generation.current) return
      if (!Array.isArray(result) || result.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 80)) throw new Error('Invalid suggestions')
      // Merge against the latest manual edits, including tags added while waiting.
      setTags(previous => mergeSuggestedTags(previous, result))
      setStatus({ key: suggestionKey, text: result.length ? 'Suggestions added to your draft. Review them before saving.' : 'No clear keywords found. You can add tags manually.' })
    } catch {
      if (ticket === generation.current) setStatus({ key: suggestionKey, error: 'Could not suggest tags. You can still enter and save your own tags.' })
    }
  }
  return <div className="space-y-5 text-xs">
    <div className="space-y-2"><label htmlFor={`${id}-name`} className="font-semibold">Skill name <span className="text-rose-600">*</span></label>
      <input id={`${id}-name`} aria-label="Name" className={field} required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={disabled} /></div>
    <div className="space-y-2"><label htmlFor={`${id}-description`} className="font-semibold">Description <span className="text-rose-600">*</span></label>
      <textarea id={`${id}-description`} aria-label="Description" aria-describedby={`${id}-description-help`} className={`${field} min-h-24`} required maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)} disabled={disabled} />
      <p id={`${id}-description-help`} className="leading-5 text-gray-500 dark:text-gray-400">Describe what students should know or be able to do.</p></div>
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor={`${id}-tags`} className="font-semibold">Skill tags <span className="ml-1 font-normal text-gray-500">{values.length} / 30</span></label>
        <button type="button" className={`${button} min-h-9`} onClick={suggest} disabled={disabled || current?.loading || !name.trim() || !description.trim()}>{current?.loading ? 'Suggesting…' : 'Suggest tags'}</button></div>
      <div className="rounded-xl border border-gray-300 bg-white p-2 focus-within:ring-2 focus-within:ring-green-600 dark:border-gray-600 dark:bg-gray-900">
        {values.length > 0 && <ul aria-label="Selected skill tags" className="mb-2 flex flex-wrap gap-1.5">
          {values.map((tag, index) => <li key={`${index}:${tag}`} className="inline-flex max-w-full items-center rounded-lg bg-green-50 pl-2.5 text-green-900 dark:bg-green-950 dark:text-green-200">
            <span className="break-words [overflow-wrap:anywhere]">{tag}</span><button type="button" aria-label={`Remove tag ${tag}`} title={`Remove ${tag}`} disabled={disabled}
              onClick={() => { setTags(values.filter((_, item) => item !== index).join(', ')); setIssue('') }}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-green-100 focus-visible:outline-2 focus-visible:outline-green-700 disabled:opacity-50 dark:hover:bg-green-900"><XIcon size={13} /></button>
          </li>)}
        </ul>}
        <input id={`${id}-tags`} aria-label="Tags" aria-describedby={`${id}-tags-help`} aria-invalid={Boolean(issue)} disabled={disabled} value={draft}
          onChange={event => { setDraft(event.target.value); setIssue('') }}
          onKeyDown={event => { if ((event.key === 'Enter' || event.key === ',') && !event.nativeEvent.isComposing) { event.preventDefault(); commit() } }}
          placeholder="Type a tag and press Enter" className="min-h-10 w-full min-w-0 border-0 bg-transparent px-1 outline-none placeholder:text-gray-400" />
      </div>
      <p id={`${id}-tags-help`} className="leading-5 text-gray-500 dark:text-gray-400">Keywords that describe this skill. Tags are not scored separately.</p>
      {issue && <p role="alert" className="text-rose-700 dark:text-rose-300">{issue}</p>}
      {current?.error && <p role="alert" className="text-rose-700 dark:text-rose-300">{current.error}</p>}
      {current?.text && <p role="status" className="text-gray-600 dark:text-gray-300">{current.text}</p>}
    </div>
    {children}
  </div>
}
