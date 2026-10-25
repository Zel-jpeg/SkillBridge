import { useEffect, useRef, useState } from 'react'
import { PencilIcon, XIcon } from '../Icons'

export default function AssessmentTitleEditor({ value, onChange, disabled = false }) {
  const [editing, setEditing] = useState(false)
  const [original, setOriginal] = useState(value)
  const input = useRef(null)
  const editButton = useRef(null)
  useEffect(() => {
    if (editing) { input.current?.focus(); input.current?.select() }
    else editButton.current?.focus()
  }, [editing])
  const blank = !value.trim()
  function cancel() { onChange(original); setEditing(false) }
  function finish() {
    if (blank) return
    onChange(value.trim())
    setEditing(false)
  }
  const button = 'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50'
  if (!editing) return <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
    <h2 className="min-w-0 break-words text-xl font-semibold leading-8 text-gray-900 dark:text-white">{value || 'Untitled assessment'}</h2>
    <button ref={editButton} type="button" disabled={disabled} aria-label="Edit assessment name" title="Edit assessment name" onClick={() => { setOriginal(value); setEditing(true) }} className={`${button} gap-2 text-gray-500 hover:bg-green-50 hover:text-green-700 dark:text-gray-400 dark:hover:bg-green-950 dark:hover:text-green-300`}><PencilIcon size={15} /><span>Edit name</span></button>
  </div>
  return <div className="min-w-0">
    <div className="flex min-w-0 items-center gap-2">
      <input ref={input} aria-label="Assessment title" aria-invalid={blank} aria-describedby={blank ? 'assessment-title-error' : undefined} placeholder="Assessment title" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); finish() }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() }
      }} className="h-10 min-w-0 flex-1 rounded-lg border border-green-500 bg-white px-3 text-sm font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-green-600 dark:bg-gray-800 dark:text-white" />
      <button type="button" disabled={disabled || blank} onClick={finish} className={`${button} bg-green-600 text-white enabled:hover:bg-green-700`}>Done</button>
      <button type="button" disabled={disabled} aria-label="Cancel name edit" onClick={cancel} className={`${button} w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800`}><XIcon size={15} /></button>
    </div>
    {blank && <p id="assessment-title-error" className="mt-1 text-xs text-rose-700 dark:text-rose-300">Enter an assessment name.</p>}
  </div>
}
