import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function RetakeEvidence({ assessmentId, studentId, historyId }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true, objectUrl
    const controller = new AbortController()
    api.get(`/api/assessments/${assessmentId}/retake-requests/${studentId}/evidence/`, {
      responseType: 'blob', signal: controller.signal, params: historyId ? { history_id: historyId } : {},
    }).then(({ data }) => {
      if (active) { objectUrl = URL.createObjectURL(data); setUrl(objectUrl); setError('') }
    }).catch(() => { if (active) setError('Evidence could not be loaded.') })
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [assessmentId, studentId, historyId, attempt])
  return error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }} className="min-h-11 underline">Retry image</button></div>
    : url ? <a href={url} target="_blank" rel="noreferrer" className="block"><img src={url} alt="Student-provided evidence supporting this retake request" className="max-h-96 max-w-full rounded-lg object-contain" /><span className="text-xs underline">Open full image</span></a>
      : <p role="status">Loading private evidence…</p>
}
