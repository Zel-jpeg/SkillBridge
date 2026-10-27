import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/axios'
import { useApi, invalidateCache, fetchWithDedup, updateCachedData } from '../../hooks/useApi'
import RetakeEvidence from '../../components/RetakeEvidence'
import RetakeImageUpload from '../../components/RetakeImageUpload'

const field = 'mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:border-green-600 focus:outline-2 focus:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-white'
export default function StudentRetakeRequest() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const url = /^\d+$/.test(assessmentId || '') ? `/api/assessments/${assessmentId}/retake-request/` : null
  const { data, loading, error } = useApi(url)
  const [explanation, setExplanation] = useState(''), [noImage, setNoImage] = useState(''), [image, setImage] = useState(null)
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('')
  const requestId = useRef(null)
  const pending = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (pending.current || !data?.can_request) return
    pending.current = true
    setSaving(true); setMessage('')
    requestId.current ||= crypto.randomUUID()
    const form = new FormData()
    form.append('payload', JSON.stringify({ request_id: requestId.current, attempt_started_at: data.attempt_started_at,
      explanation: explanation.trim(), no_image_reason: noImage.trim() }))
    if (image) form.append('image', image.file)
    try {
      const result = await api.post(url, form)
      updateCachedData(url, { ...data, can_request: false, request: result.data.request })
      invalidateCache('/api/assessments/'); invalidateCache(url)
      setMessage('Your retake request was sent for review.')
      void fetchWithDedup(url).catch(() => setMessage('Your retake request was sent for review, but the latest details could not refresh. You do not need to submit it again.'))
    } catch (failure) { setMessage(failure.response?.data?.error || 'Saving could not be confirmed. Keep this form and retry; duplicate requests are prevented.') }
    finally { pending.current = false; setSaving(false) }
  }
  return <section className="mx-auto max-w-3xl px-4 py-6 text-gray-900 dark:text-gray-100">
    <button type="button" onClick={() => navigate('/student/assessments')} className="mb-5 min-h-11 cursor-pointer rounded-lg px-2 text-sm text-green-700 transition-colors hover:bg-green-50 hover:text-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-green-300 dark:hover:bg-green-950 dark:hover:text-green-200">← Assessments</button>
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h1 className="text-xl font-bold">Request a retake</h1><p className="mt-2 break-words text-sm">{data?.assessment}</p>
      {loading && <p role="status" className="mt-4">Loading request…</p>}
      {(error || !url) && <div role="alert" className="mt-4"><p>This assessment request is unavailable.</p>{url && <button className="min-h-11 underline" onClick={() => fetchWithDedup(url).catch(() => {})}>Retry</button>}</div>}
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
      {data?.request?.status && <div className="mt-5 space-y-3 break-words text-sm">
        <p className="font-semibold">Request {data.request.status}</p><p className="whitespace-pre-wrap">{data.request.explanation}</p>
        {data.request.review_note && <p><strong>Reviewer’s response: </strong>{data.request.review_note}</p>}
        {data.request.no_image_reason && <p><strong>No image available: </strong>{data.request.no_image_reason}</p>}
        {data.request.has_image && <RetakeEvidence assessmentId={assessmentId} studentId={data.student_id} />}
      </div>}
      {data && !data.can_request && !data.request?.status && <p className="mt-4 text-sm">{data.retake_allowed ? 'Your retake is already approved. Return to the assessment card to start.' : 'A request is available after a finalized or expired attempt in an active, unarchived assessment.'}</p>}
      {data?.can_request && <form onSubmit={submit} className="mt-6 space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-300">Describe what happened and why another attempt is needed. A request does not change your score or grant a retake automatically.</p>
        {data.status === 'in_progress' && <p className="text-sm">Your previous attempt has expired. Sending this request will preserve its last server-saved draft as review evidence. It will not count as completed.</p>}
        <div><label className="block text-sm font-medium">Explanation (30–500 characters)<textarea required minLength={30} maxLength={500} aria-describedby="retake-explanation-count" rows={5} className={field} value={explanation} disabled={saving} onChange={event => setExplanation(event.target.value)} /></label>
          <p id="retake-explanation-count" className="mt-1 text-right text-xs text-gray-600 dark:text-gray-300">{explanation.length}/500 characters</p>
        </div>
        <RetakeImageUpload image={image} disabled={saving} onChange={selected => { setImage(selected); setMessage('') }} />
        {!image && <label className="block text-sm font-medium">Why no image is available (15–500 characters)<textarea required minLength={15} maxLength={500} rows={3} className={field} value={noImage} disabled={saving} onChange={event => setNoImage(event.target.value)} /></label>}
        <button disabled={saving} className="min-h-11 w-full cursor-pointer rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 active:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green-700 sm:w-auto">{saving ? 'Sending request…' : 'Send retake request'}</button>
      </form>}
      {data?.history?.length > 0 && <details className="mt-6 text-sm"><summary className="min-h-11 cursor-pointer py-3">Previous retake requests</summary>{data.history.map(item => <div key={item.history_id} className="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700"><p className="font-semibold">{item.status}</p><p className="whitespace-pre-wrap break-words">{item.explanation}</p><p className="break-words">{item.review_note}</p>{item.has_image && <RetakeEvidence assessmentId={assessmentId} studentId={data.student_id} historyId={item.history_id} />}</div>)}</details>}
    </div>
  </section>
}
