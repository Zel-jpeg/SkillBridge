import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../context/ToastContext'
import NlpModelComparison from '../../components/admin/NlpModelComparison'
import { updateCachedData, useApi, invalidateCache } from '../../hooks/useApi'
import api from '../../api/axios'
import { RefreshIcon, CheckCircleIcon, WarnIcon } from '../../components/Icons'
import '../../components/admin/recommendationTools.css'

const CONFIG = '/api/admin/nlp-configuration/'

function NlpConfigurationCard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: config, error: configError, loading } = useApi(CONFIG)
  const [choice, setChoice] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const selected = choice ?? config?.active_model ?? 'spacy_md'

  async function action(kind) {
    if (pending.current) return
    pending.current = true
    setBusy(kind)
    setMessage(null)
    try {
      const { data } = kind === 'save'
        ? await api.patch(CONFIG, { active_model: selected }, { timeout: 120000 })
        : await api.get(`${CONFIG}?verify=1`, { timeout: 120000 })
      if (!mounted.current) return
      updateCachedData(CONFIG, data)
      if (kind === 'save') {
        setChoice(null)
        invalidateCache('/api/admin/reports/')
        invalidateCache('/api/admin/students/recommendations/')
        showToast(data.message || 'Active model updated.')
      }
      setMessage({ text: kind === 'save' ? data.message || 'Active model updated. Saved recommendations have not been refreshed.' : 'Runtime checks finished. Review each model’s status below.', error: false })
    } catch (err) {
      if (!mounted.current || err.staleIdentity) return
      const text = err.response?.data?.error || (kind === 'save' ? 'Could not confirm the model change. Recheck the active model before retrying.' : 'Could not complete the runtime checks. Try again.')
      setMessage({ text, error: true })
      if (kind === 'save') invalidateCache(CONFIG)
    } finally {
      pending.current = false
      if (mounted.current) setBusy('')
    }
  }

  return <div>
    <section className="rt-section">
      <h3 className="rt-heading">Recommendation model</h3>
      <p className="rt-note">Assessment results lead; NLP supplies supporting text similarity.</p>
      <p className="mt-2 text-green-800 dark:text-green-300">Applies across all institutes and programs.</p>
      {loading && !config && <p className="mt-4 rt-note" role="status">Loading model settings…</p>}
      {configError && <div className="rt-message rt-message--error" role="alert"><p>Could not load the latest model settings.</p><button className="rt-button mt-2" type="button" onClick={() => invalidateCache(CONFIG)}>Retry settings</button></div>}
      <div className="rt-toolbar mt-5">
        <label>Active model
          <select className="rt-field" aria-label="Recommendation model" value={selected} disabled={!config || Boolean(busy)} onChange={event => setChoice(event.target.value)}>
            {(config?.models || []).map(model => <option key={model.id} value={model.id}>{model.label}{model.available ? '' : ' — unavailable'}</option>)}
          </select>
        </label>
        <button type="button" className="rt-button rt-button--primary" disabled={!config || Boolean(busy) || selected === config.active_model} aria-busy={busy === 'save'} onClick={() => action('save')}>
          {busy === 'save' && <span className="rt-busy-icon" aria-hidden="true"><RefreshIcon size={15} /></span>}{busy === 'save' ? 'Saving model…' : 'Save model'}
        </button>
      </div>
    </section>
    <section className="rt-section">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="rt-subheading">Model availability</h3><button className="rt-button" type="button" disabled={!config || Boolean(busy)} aria-busy={busy === 'verify'} onClick={() => action('verify')}><span className={busy === 'verify' ? 'rt-busy-icon' : ''} aria-hidden="true"><RefreshIcon size={15} /></span>{busy === 'verify' ? 'Checking models…' : 'Recheck models'}</button></div>
      <div className="rt-models" aria-live="polite" aria-busy={busy === 'verify'}>
        {(config?.models || []).map(model => <div className="rt-model" key={model.id} data-ready={model.verified ? 'verified' : model.available ? 'installed' : 'unavailable'}>
          <strong>{model.label}</strong>
          <div className="rt-model-status">{model.verified ? <CheckCircleIcon size={16} /> : !model.available ? <WarnIcon size={16} /> : null}<span>{model.verified ? 'Verified in this runtime' : model.available ? 'Installed · not yet verified' : 'Unavailable'}{config.active_model === model.id ? ' · Active' : ''}</span></div>
          {model.error && <p className="rt-note mt-2">{model.error}</p>}
        </div>)}
      </div>
      <p className="rt-note mt-3">Recheck runs each model without fallback. Local availability does not establish hosted availability.</p>
      {message && <p role={message.error ? 'alert' : 'status'} className={`rt-message${message.error ? ' rt-message--error' : ''}`}>{message.text}</p>}
    </section>
    <section className="rt-section">
      <h3 className="rt-subheading">Saved recommendations</h3>
      <p className="rt-note mt-1 mb-3">Refresh from OJT Placements after choosing a batch or the whole system. Saving a model does not start a refresh.</p>
      <button type="button" className="rt-button" disabled={Boolean(busy)} onClick={() => navigate('/admin/placements?refresh=recommendations')}><RefreshIcon size={16} />Refresh saved recommendations</button>
    </section>
  </div>
}

export default function AdminRecommendationTools() {
  const [tab, setTab] = useState('settings')
  const id = useId()
  const tabs = useRef([])
  function move(event, index) {
    let next
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = 1
    if (next == null) return
    event.preventDefault()
    setTab(next === 0 ? 'settings' : 'comparison')
    tabs.current[next]?.focus()
  }
  return <div className="rt-workspace">
    <div role="tablist" aria-label="Recommendation tools" className="rt-tabs">
      {[['settings', 'Model settings'], ['comparison', 'Model comparison']].map(([key, label], index) => <button type="button" key={key} id={`${id}-${key}-tab`} ref={node => { tabs.current[index] = node }} role="tab" aria-selected={tab === key} aria-controls={`${id}-${key}`} tabIndex={tab === key ? 0 : -1} className="rt-tab" onClick={() => setTab(key)} onKeyDown={event => move(event, index)}>{label}</button>)}
    </div>
    <div className="rt-scroll">
      <div id={`${id}-settings`} role="tabpanel" aria-labelledby={`${id}-settings-tab`} tabIndex={0} hidden={tab !== 'settings'} className="rt-panel"><NlpConfigurationCard /></div>
      <div id={`${id}-comparison`} role="tabpanel" aria-labelledby={`${id}-comparison-tab`} tabIndex={0} hidden={tab !== 'comparison'} className="rt-panel"><NlpModelComparison /></div>
    </div>
  </div>
}
