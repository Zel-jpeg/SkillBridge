import { useId, useRef, useState } from 'react'
import api from '../../api/axios'
import DataSection from '../DataSection'
import DialogShell from '../DialogShell'
import { RefreshIcon, SearchIcon } from '../Icons'
import './positionDialog.css'

const LEVELS = [
  { label: 'Not required', value: 0 },
  { label: 'Beginner', value: 25 },
  { label: 'Competent', value: 50 },
  { label: 'Proficient', value: 75 },
  { label: 'Expert', value: 90 },
]

function SectionHeading({ number, id, children }) {
  return <h3 id={id} className="position-editor-heading"><span aria-hidden="true">{number}</span>{children}</h3>
}

function SkillRequirement({ category, value, onChange }) {
  const id = useId()
  const customRef = useRef(null)
  const [customMode, setCustomMode] = useState(() => !LEVELS.some(level => level.value === value))
  return <li className="position-editor-row">
    <label id={`${id}-label`} htmlFor={`${id}-level`}>{category}</label>
    <div className="position-editor-level" data-active={value > 0}>
      <select id={`${id}-level`} aria-label={`Minimum level for ${category}`} value={customMode ? 'custom' : value}
        onChange={event => {
          const custom = event.target.value === 'custom'
          setCustomMode(custom)
          if (custom) requestAnimationFrame(() => customRef.current?.focus())
          else onChange(Number(event.target.value))
        }}>
        {LEVELS.map(level => <option key={level.value} value={level.value}>{level.label}{level.value > 0 ? ` · ${level.value}%` : ''}</option>)}
        <option value="custom">Custom percentage</option>
      </select>
      {customMode && <div className="position-editor-custom">
        <input ref={customRef} type="number" min={0} max={100} step="any" value={value || ''} placeholder="0–100"
          aria-label={`Custom percentage for ${category}`}
          onChange={event => {
            const percent = Number(event.target.value)
            onChange(Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0)
          }} />
        <span aria-hidden="true">%</span>
      </div>}
    </div>
  </li>
}

export default function PositionDialog(props) {
  const { mode, companyName, onClose } = props
  const [saving, setSaving] = useState(false)
  const close = () => { if (!saving) onClose() }
  return <DialogShell title={mode === 'edit' ? 'Edit Position' : 'Add Position'}
    description="Define the role, set skill levels, and add relevant tags."
    eyebrow={`${companyName} · OJT Partner`}
    headerDetails={<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Define the role, set skill levels, and add relevant tags.</p>}
    size="position" closeLabel="Close position editor" closeDisabled={saving} onClose={close}>
    <DataSection url="/api/categories/" layout="settings" label="Loading position requirements" className="position-editor-content">
      <PositionForm {...props} saving={saving} setSaving={setSaving} />
    </DataSection>
  </DialogShell>
}

function PositionForm({ mode = 'add', initialData = null, categories, onClose, onSubmit, saving, setSaving }) {
  const id = useId()
  const savePending = useRef(false)
  const suggestPending = useRef(false)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const errorRef = useRef(null)
  const [title, setTitle] = useState(initialData?.title || '')
  const [slots, setSlots] = useState(initialData?.slots ?? 1)
  const [tags, setTags] = useState((initialData?.tags || []).join(', '))
  const [reqs, setReqs] = useState(() => ({ ...initialData?.requirements }))
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)

  // Derive the catalog from current props. New skills need no state synchronization;
  // existing saved/edited requirements survive a catalog refresh or removal.
  const skills = [...new Set([...categories, ...Object.keys(reqs)])]
  const selectedCount = skills.filter(category => reqs[category] > 0).length
  const term = search.trim().toLocaleLowerCase()
  const visibleSkills = skills.filter(category => (!selectedOnly || reqs[category] > 0) && category.toLocaleLowerCase().includes(term))

  function resetScroll() { listRef.current?.scrollTo({ top: 0 }) }
  function reportError(message) {
    setError(message)
    // Errors can appear above the current scroll position on a short screen.
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (savePending.current || suggestPending.current) return
    if (!title.trim()) { reportError('Position title is required.'); return }
    if (!String(slots).trim() || !Number.isInteger(Number(slots)) || Number(slots) < 0 || Number(slots) > 2147483647) {
      reportError('Slots must be a whole number from 0 to 2147483647.'); return
    }
    savePending.current = true
    setSaving(true)
    setError('')
    try {
      const result = await onSubmit({
        ...(initialData || {}),
        title: title.trim(),
        slots: Number(slots),
        requirements: Object.fromEntries(Object.entries(reqs).filter(([, value]) => value > 0)),
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      })
      if (result?.ok) onClose()
      else reportError(result?.message || 'Position was not saved. Your changes are kept here.')
    } catch {
      reportError('Save could not be confirmed. Your changes are kept here; check the list before retrying.')
    } finally {
      savePending.current = false
      setSaving(false)
    }
  }

  async function handleSuggestTags() {
    if (suggestPending.current || savePending.current) return
    if (!title.trim()) { reportError('Enter a position title before suggesting tags.'); return }
    suggestPending.current = true
    setSuggesting(true)
    setError('')
    try {
      const requirements = Object.fromEntries(Object.entries(reqs).filter(([, value]) => value > 0))
      const res = await api.post('/api/tags/suggest/', { type: 'position', title, requirements })
      setTags((res.data?.suggested_tags || []).join(', '))
    } catch (err) {
      reportError(err.response?.data?.error || 'Could not suggest tags.')
    } finally {
      suggestPending.current = false
      setSuggesting(false)
    }
  }

  return <form className="position-editor-form" noValidate onSubmit={handleSubmit} aria-busy={saving}>
    <div className="position-editor-body">
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="position-editor-error">{error}</p>}
      <fieldset disabled={saving} className="position-editor-fields">
        <section className="position-editor-section" aria-labelledby={`${id}-details`}>
          <SectionHeading number="1" id={`${id}-details`}>Position details</SectionHeading>
          <div className="position-editor-details">
            <div>
              <label htmlFor={`${id}-title`} className="position-editor-label">Position title <span>*</span></label>
              <input id={`${id}-title`} value={title} required maxLength={255} placeholder="e.g. Frontend Developer Intern"
                onChange={event => { setTitle(event.target.value); setError('') }} className="position-editor-input" />
            </div>
            <div>
              <label htmlFor={`${id}-slots`} className="position-editor-label">Available slots <span>*</span></label>
              <input id={`${id}-slots`} type="number" min={0} max={2147483647} step={1} value={slots} required
                aria-describedby={`${id}-slots-help`} onChange={event => { setSlots(event.target.value); setError('') }} className="position-editor-input" />
              <p id={`${id}-slots-help`} className="position-editor-help">Use 0 to close capacity.</p>
            </div>
          </div>
        </section>

        <section className="position-editor-section" aria-labelledby={`${id}-skills`}>
          <SectionHeading number="2" id={`${id}-skills`}>Skill requirements</SectionHeading>
          <p className="position-editor-help position-editor-intro">Choose a minimum level. Leave unused skills as Not required.</p>
          <div className="position-editor-toolbar">
            <div className="position-editor-filters" role="group" aria-label="Filter skill requirements">
              <button type="button" aria-pressed={!selectedOnly} onClick={() => { setSelectedOnly(false); resetScroll() }}>All skills ({skills.length})</button>
              <button type="button" aria-pressed={selectedOnly} onClick={() => { setSelectedOnly(true); resetScroll() }}>Selected ({selectedCount})</button>
            </div>
            <div className="position-editor-search">
              <SearchIcon size={16} />
              <input ref={searchRef} type="search" aria-label="Find a skill" placeholder="Find a skill…" value={search}
                onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
                onChange={event => { setSearch(event.target.value); resetScroll() }} />
            </div>
          </div>
          <div className="position-editor-list" ref={listRef} role="region" aria-label="Skill requirements list" tabIndex={0}>
            <div className="position-editor-columns" aria-hidden="true"><span>Skill category</span><span>Minimum level</span></div>
            {visibleSkills.length ? <ul>
              {visibleSkills.map(category => <SkillRequirement key={category} category={category} value={reqs[category] ?? 0}
                onChange={value => {
                  // Clearing a selected row removes it from this view. Keep focus in
                  // the editor instead of letting it fall back to the inert page.
                  if (selectedOnly && value === 0) searchRef.current?.focus({ preventScroll: true })
                  setReqs(previous => ({ ...previous, [category]: value }))
                }} />)}
            </ul> : <div className="position-editor-empty">
              <p>{!skills.length ? 'No skill categories available.' : term ? 'No skills match your search.' : 'No skills selected yet.'}</p>
              <p className="position-editor-help">{!skills.length ? 'You can still save position details and tags.' : term ? 'Try another name or clear your search.' : 'Choose a minimum level from All skills to add a requirement.'}</p>
              {(term || selectedOnly) && <button type="button" onClick={() => { setSearch(''); setSelectedOnly(false); resetScroll(); searchRef.current?.focus() }}>Show all skills</button>}
            </div>}
          </div>
          <p className="position-editor-help" role="status">{visibleSkills.length} of {skills.length} skills shown · {selectedCount} selected</p>
        </section>

        <section className="position-editor-section" aria-labelledby={`${id}-tags-heading`}>
          <div className="position-editor-tags-heading">
            <SectionHeading number="3" id={`${id}-tags-heading`}>Position tags <span className="position-editor-optional">Optional</span></SectionHeading>
            <button type="button" className="position-editor-suggest" disabled={suggesting} onClick={handleSuggestTags}>
              <RefreshIcon size={14} />{suggesting ? 'Suggesting…' : 'Suggest / refresh tags'}
            </button>
          </div>
          <label htmlFor={`${id}-tags`} className="sr-only">Position tags</label>
          <textarea id={`${id}-tags`} value={tags} onChange={event => setTags(event.target.value)} rows={2} disabled={suggesting}
            aria-describedby={`${id}-tags-help`} placeholder="Django, REST API, authentication, PostgreSQL" className="position-editor-input" />
          <p id={`${id}-tags-help`} className="position-editor-help">Comma-separated and editable. Refreshing replaces the current tag list.</p>
        </section>
      </fieldset>
    </div>
    <footer className="position-editor-footer">
      <p className="position-editor-help">Save when you’re ready.</p>
      <div className="position-editor-actions">
        <button type="button" onClick={onClose} disabled={saving} className="position-editor-cancel">Cancel</button>
        <button type="submit" disabled={saving || suggesting} className="position-editor-save">
          {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Add Position'}
        </button>
      </div>
    </footer>
  </form>
}
