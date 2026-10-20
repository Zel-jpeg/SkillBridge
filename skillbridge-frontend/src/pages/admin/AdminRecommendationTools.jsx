import { useToast } from '../../context/ToastContext'
import DataSection from '../../components/DataSection'
import NlpModelComparison from '../../components/admin/NlpModelComparison'
import { useEffect, useRef, useState } from 'react'
import { updateCachedData, useApi, invalidateCache } from '../../hooks/useApi'
import api from '../../api/axios'

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function NlpConfigurationCard() {
  const { showToast } = useToast()
  const { data: config, error: configError } = useApi('/api/admin/nlp-configuration/')
  const [selected, setSelected] = useState('spacy_md')
  const selectedSeeded = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (config && !selectedSeeded.current) {
      selectedSeeded.current = true
      setSelected(config.active_model)
    }
  }, [config])
  useEffect(() => {
    if (configError && !config) setMessage('Could not load NLP model configuration.')
  }, [configError, config])

  async function saveModel() {
    setBusy(true)
    try {
      const { data } = await api.patch('/api/admin/nlp-configuration/', { active_model: selected })
      updateCachedData('/api/admin/nlp-configuration/', data)
      invalidateCache('/api/admin/reports/')
      invalidateCache('/api/admin/students/recommendations/')
      setMessage(data.message)
      showToast(data.message || 'Active model updated.')
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not update the active model.')
      showToast(err.response?.data?.error || 'Could not update the active model.', 'error')
    } finally { setBusy(false) }
  }

  async function rerun() {
    setBusy(true)
    try {
      const { data } = await api.post('/api/admin/rerun-recommendations/', {}, { timeout: 120000 })
      setMessage(data.message || 'Recommendations refreshed.')
      showToast(data.message || 'Recommendations refreshed.')
      ;['/api/admin/reports/', '/api/admin/students/recommendations/', '/api/instructor/students/recommendations/'].forEach(invalidateCache)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not re-run recommendations.')
      showToast(err.response?.data?.error || 'Could not re-run recommendations.', 'error')
    } finally { setBusy(false) }
  }

  return (
    <SectionCard title="Recommendation NLP Model" subtitle="Students automatically use the active preprocessing model; the 60/25/15 weights stay fixed.">
      <DataSection url="/api/admin/nlp-configuration/" layout="panel" count={1}><div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Current active model: {config?.active_model_label || 'Loading…'}</label>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            {(config?.models || []).map(model => (
              <option key={model.id} value={model.id}>{model.label}{model.available ? '' : ' (fallback will be used)'}</option>
            ))}
          </select>
        </div>
        <button onClick={saveModel} disabled={busy || !config || selected === config?.active_model}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">Save Model</button>
        <button onClick={rerun} disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 text-white disabled:opacity-50">Re-run Recommendations</button>
      </div></DataSection>
      <div className="mt-3 flex flex-wrap gap-2">
        {(config?.models || []).map(model => (
          <span key={model.id} title={model.error || ''} className={`text-[11px] px-2 py-1 rounded-full ${model.available ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
            {model.label}: {model.available ? 'available' : 'offline fallback'}
          </span>
        ))}
      </div>
      {message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{message}</p>}
    </SectionCard>
  )
}

export default function AdminRecommendationTools() { return <div className="space-y-5"><NlpConfigurationCard /><NlpModelComparison /></div> }
