import { useState } from 'react'
import api from '../api/axios'

export function GeneratedText({ label, text, note }) {
  // Presentation only: keep the exact supplied input available below. Never
  // send this shortened narrative back to the scorer or save it as a profile.
  const raw = typeof text === 'string' ? text : ''
  const narrative = raw.split(/\s+(?:Skill|Requirement) evidence:\s*/)[0].trim()
  const sections = narrative.split(/(?=The student demonstrates |Required skill percentages: |Competency requirements: |Role-specific vocabulary: )/).filter(Boolean)
  const headings = [
    ['The student demonstrates ', 'Assessed competencies'],
    ['Required skill percentages: ', 'Required skill percentages'],
    ['Competency requirements: ', 'Competency requirements'],
    ['Role-specific vocabulary: ', 'Position tags'],
  ]
  return <div className="space-y-1 min-w-0">
    <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</h4>
    {note && <p className="text-[11px] text-gray-500 dark:text-gray-400">{note}</p>}
    <div className="space-y-3 break-words rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
      {!raw && <p>No generated text available.</p>}
      {sections.map((section, index) => {
        const heading = headings.find(([prefix]) => section.startsWith(prefix))
        if (!heading) return <p key={index} className="whitespace-pre-wrap">{section.trim()}</p>
        const content = section.slice(heading[0].length).trim()
        const items = heading[1] === 'Required skill percentages'
          ? content.split(/;\s*/)
          : content.split(/;\s*(?=(?:excellent|strong|proficient|developing|basic)\s)/)
        return <div key={index}>
          <h5 className="font-semibold mb-1">{heading[1]}</h5>
          {items.length > 1
            ? <ul className="list-disc pl-4 space-y-1">{items.map((item, i) => <li key={i}>{item.replace('; category vocabulary:', '. Category vocabulary:')}</li>)}</ul>
            : <p>{content.replace('; category vocabulary:', '. Category vocabulary:')}</p>}
        </div>
      })}
    </div>
    {raw && <details className="pt-1 text-xs text-gray-500 dark:text-gray-400">
      <summary className="cursor-pointer font-medium text-violet-700 dark:text-violet-300">View raw weighted NLP input</summary>
      <p className="my-2">Exact input before model preprocessing. Repeated evidence gives terms more influence in scoring; the readable summary above omits that repeated section.</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3 text-xs leading-relaxed font-sans text-gray-700 dark:text-gray-300">{raw}</pre>
    </details>}
  </div>
}

export default function NlpTextPreview({ studentId, positionId }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    setBusy(true)
    setError('')
    setData(null)
    try {
      const url = studentId ? `/api/nlp/students/${studentId}/text/` : `/api/nlp/positions/${positionId}/text/`
      const response = await api.get(url)
      setData(response.data)
    } catch (err) { setError(err.response?.data?.error || 'Could not load generated text.') }
    finally { setBusy(false) }
  }
  return <div className="my-2 min-w-0">
    <button type="button" onClick={toggle} disabled={busy} aria-expanded={open}
      className="text-xs font-semibold text-violet-700 dark:text-violet-300 hover:underline disabled:opacity-50">
      {busy ? 'Loading text…' : open ? 'Hide generated NLP text' : studentId ? 'View Generated Competency Profile' : 'Preview Position NLP Description'}
    </button>
    {open && <div className="mt-2 space-y-3" aria-live="polite">
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
      {data && <><p className="text-xs text-gray-500 dark:text-gray-400">{data.note || data.message}</p>
        {data.assessment_id && <p className="text-[11px] text-gray-400">Assessment #{data.assessment_id} · {data.text_generation_version}</p>}
        {data.texts?.map(item => <GeneratedText key={item.label} {...item} />)}</>}
    </div>}
  </div>
}
