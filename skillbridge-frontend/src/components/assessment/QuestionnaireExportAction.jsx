import { useEffect, useRef, useState } from 'react'
import DialogShell from '../DialogShell'
import api from '../../api/axios'
import { requestErrorMessage } from '../../api/requestErrors'

const button = 'min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 enabled:hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:enabled:hover:bg-gray-800'

export default function QuestionnaireExportAction({ assessmentId }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={button} onClick={() => setOpen(true)}>Export questionnaire</button>
    {open && <QuestionnaireExportDialog assessmentId={assessmentId} onClose={() => setOpen(false)} />}
  </>
}

function QuestionnaireExportDialog({ assessmentId, onClose }) {
  const [format, setFormat] = useState('aiken')
  const [attempt, setAttempt] = useState(0)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const downloadRequest = useRef(null)
  const endpoint = `/api/instructor/assessments/${assessmentId}/questionnaire-export/`

  useEffect(() => {
    const controller = new AbortController()
    api.get(endpoint, { params: { file_format: format }, signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setPreview(data)
    }).catch(error => {
      if (!controller.signal.aborted) setError(requestErrorMessage(error))
    })
    return () => controller.abort()
  }, [endpoint, format, attempt])
  useEffect(() => () => downloadRequest.current?.abort(), [])

  function resetReview() {
    setPreview(null)
    setConfirmed(false)
    setError('')
  }

  async function download() {
    if (!preview?.included || (preview.omitted.length && !confirmed) || downloadRequest.current) return
    const controller = new AbortController()
    downloadRequest.current = controller
    setDownloading(true)
    setError('')
    try {
      const { data } = await api.get(endpoint, { responseType: 'blob', signal: controller.signal,
        params: { file_format: format, download: 1, revision: preview.revision, allow_partial: confirmed ? 1 : 0 } })
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(data)
      const link = Object.assign(document.createElement('a'), { href: url, download: preview.filename })
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      onClose()
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.response?.status === 409) {
        resetReview()
        setError('The saved questionnaire changed. Review the updated selection before downloading.')
        setAttempt(previous => previous + 1)
      } else {
        setError(requestErrorMessage(error))
      }
    } finally {
      downloadRequest.current = null
      if (!controller.signal.aborted) setDownloading(false)
    }
  }

  return <DialogShell size="confirm" title="Export questionnaire" description="Download saved questions and answer keys for authorized staff use."
    closeLabel="Close questionnaire export" onClose={onClose}>
    <div className="min-h-0 space-y-4 overflow-y-auto p-4 text-sm sm:p-5">
      <label className="block text-xs font-semibold">Questionnaire export format
        <select aria-label="Questionnaire export format" className={`${button} mt-1 w-full bg-white dark:bg-gray-900`} value={format} disabled={downloading}
          onChange={event => { resetReview(); setFormat(event.target.value) }}>
          <option value="aiken">AIKEN (.txt)</option>
          <option value="native">SkillBridge text (.txt)</option>
        </select>
      </label>
      <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">The file contains saved questions and answer keys. {format === 'aiken'
        ? 'AIKEN carries multiple choice items. Assign categories again after import.'
        : 'SkillBridge text carries multiple choice, true/false, identification and saved category names.'} Frameworks, schedules and student records are outside this export.</p>
      {!preview && !error && <p role="status">Checking saved questions…</p>}
      {error && <div className="space-y-2"><p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
        {!preview && <button type="button" className={button} onClick={() => { resetReview(); setAttempt(previous => previous + 1) }}>Retry review</button>}</div>}
      {preview && <div className="space-y-3">
        <p role="status" className="font-semibold">{preview.included} of {preview.total} saved questions can be downloaded.</p>
        {preview.omitted.length > 0 && <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Questions left out</p>
          <ul className="max-h-36 list-disc space-y-1 overflow-y-auto pl-4">
            {preview.omitted.map(({ number, reason }) => <li key={number}>Question {number}. {reason}</li>)}
          </ul>
          {preview.included > 0 && <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" checked={confirmed} disabled={downloading} onChange={event => setConfirmed(event.target.checked)} />
            Download only the {preview.included} supported {preview.included === 1 ? 'question' : 'questions'}
          </label>}
        </div>}
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={onClose}>Cancel</button>
        <button type="button" className={`${button} bg-green-700 text-white enabled:hover:bg-green-800 dark:enabled:hover:bg-green-800`} onClick={download}
          disabled={downloading || !preview?.included || (preview.omitted.length > 0 && !confirmed)}>{downloading ? 'Preparing…' : 'Download questionnaire'}</button>
      </div>
    </div>
  </DialogShell>
}
