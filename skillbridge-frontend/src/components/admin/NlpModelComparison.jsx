import { useState } from 'react'
import api from '../../api/axios'
import { GeneratedText } from '../NlpTextPreview'
import TaxonomyQuality, { TaxonomyWarnings } from './TaxonomyQuality'

const modes = { evaluation_dataset: 'Prepared evaluation dataset', real_placement_data: 'Real placement data' }
const metrics = [['top1_accuracy', 'Top-1 accuracy'], ['top3_accuracy', 'Top-3 accuracy'],
  ['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1-score']]

export default function NlpModelComparison() {
  const [mode, setMode] = useState('evaluation_dataset')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const { data } = await api.post('/api/admin/nlp-model-comparison/', { mode })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Comparison could not finish. Check the backend connection and try again.')
    } finally { setBusy(false) }
  }
  const positionName = id => {
    const p = result?.positions.find(item => item.id === id)
    return p ? `${p.title} — ${p.company}` : String(id)
  }

  return <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-5 space-y-4">
    <div><h2 className="text-sm font-semibold text-gray-900 dark:text-white">NLP model comparison</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">“NLP fit” is a per-match text similarity score. Model accuracy is measured across labeled test cases or approved placements.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex-1 min-w-52 text-xs text-gray-600 dark:text-gray-300">Evaluation mode
        <select value={mode} disabled={busy} onChange={e => { setMode(e.target.value); setResult(null); setError('') }}
          className="block w-full mt-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="button" onClick={run} disabled={busy} className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">
        {busy ? 'Comparing models…' : 'Run comparison'}
      </button>
    </div>
    <p className="text-xs text-gray-500 dark:text-gray-400">{mode === 'evaluation_dataset'
      ? 'Production prepared dataset: 60 synthetic cases, 6 positions, current neutral text and curated tags applied in memory. The original scores and labels are fixed. This is not exact notebook reproduction or an independent accuracy study.'
      : 'Evaluates the full 60% category / 25% NLP / 15% location ranking against approved position IDs. Needs at least 5 eligible approved placements and 3 positions with requirements. Uses up to 100 newest eligible approvals.'}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">Comparison does not save recommendation scores or change the active model. Use Save Model and the separate Re-run Recommendations action above when needed.</p>
    <TaxonomyQuality />
    <div aria-live="polite" aria-busy={busy}>
      {busy && <p className="text-sm text-violet-600 dark:text-violet-300">Loading local models and evaluating cases. The first run can take longer.</p>}
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      {result && <div className="space-y-3">
        <p className="text-xs text-gray-600 dark:text-gray-300">{modes[result.mode]} · {result.ranking} · {result.case_count} cases · {result.position_count} positions · {new Date(result.evaluated_at).toLocaleString()}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{result.dataset.description}</p>
        <TaxonomyWarnings data={result.dataset.taxonomy} label="Evaluated taxonomy" />
        {result.text_samples && <details className="text-xs text-gray-600 dark:text-gray-300"><summary className="cursor-pointer font-semibold">View Generated Text Samples</summary>
          <p className="my-2">Readable summaries of the inputs used in this run. Expand “View raw weighted NLP input” to inspect each exact scoring text before preprocessing. Category tags describe vocabulary, not separately verified subskills. These previews are read-only and contain no assessment answers.</p>
          <div className="space-y-3">{result.text_samples.profiles.map(p => <GeneratedText key={p.case_id} label={`Student competency profile — ${p.case_id}`} text={p.text} />)}
          {result.text_samples.positions.map(p => <GeneratedText key={p.id} label={`Position description — ${p.title}`} text={p.text} />)}</div>
        </details>}
        {result.mode === 'real_placement_data' && <p className="text-xs text-gray-500 dark:text-gray-400">Approved: {result.dataset.approved_count}. Skipped (missing eligible assessment, approval date or position requirements): {result.dataset.skipped_count}. Not examined due to run limit: {result.dataset.unexamined_count}.</p>}
        {result.status === 'insufficient_data' && <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">{result.message}</p>}
        {result.models.length > 0 && <>
          <div className="overflow-x-auto"><table className="w-full text-xs text-left text-gray-600 dark:text-gray-300">
            <caption className="sr-only">NLP preprocessing model evaluation metrics</caption>
            <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th scope="col" className="py-3 pr-4">Model / availability</th>
              {metrics.map(([key, label]) => <th scope="col" key={key} className="p-3 whitespace-nowrap">{label}</th>)}<th scope="col" className="p-3 whitespace-nowrap">Processing time</th></tr></thead>
            <tbody>{result.models.map(model => <tr key={model.id} className="border-b border-gray-100 dark:border-gray-800">
              <th scope="row" className="py-3 pr-4 min-w-48 font-medium"><span className="block">{model.id === 'stanza_en' ? 'Stanford Stanza English' : model.label}</span><span className="block font-normal text-gray-500">{model.package}</span><span className={model.status === 'available' ? 'text-green-600 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}>{model.status}</span>{model.message && <p className="font-normal mt-1">{model.message}</p>}</th>
              {metrics.map(([key]) => <td key={key} className="p-3 tabular-nums">{model.metrics ? `${(model.metrics[key] * 100).toFixed(1)}%` : '—'}</td>)}
              <td className="p-3 tabular-nums whitespace-nowrap">{model.metrics ? `${model.metrics.processing_time_seconds.toFixed(3)} s` : '—'}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{result.metric_note}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">High Top-3 with lower Top-1 means the labeled position is often close, but another position ranks first. Review evidence and ambiguous labels; do not change labels to fit predictions.</p>
          {result.models.filter(model => model.diagnostics).map(model => <details key={model.id} className="text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <summary className="cursor-pointer font-semibold">{model.label}: confusion pairs and rank #2/#3 cases</summary>
            <h3 className="font-semibold mt-3">Common confusion pairs (expected → first recommendation)</h3>
            {model.diagnostics.common_confusions.length ? <ul className="mt-2 space-y-2">{model.diagnostics.common_confusions.map(pair => <li key={`${pair.expected_position_id}-${pair.predicted_position_id}`}>{positionName(pair.expected_position_id)} → {positionName(pair.predicted_position_id)}: <strong>{pair.count} cases</strong></li>)}</ul> : <p>No Top-1 confusion in this run.</p>}
            <h3 className="font-semibold mt-3">Expected position ranked #2 or #3 ({model.diagnostics.near_misses.length})</h3>
            <div className="max-h-64 overflow-auto space-y-2 mt-2">{model.diagnostics.near_misses.map(row => <p key={row.case_id}><strong>{row.case_id}</strong>: {positionName(row.expected_position_id)} ranked #{row.expected_rank}. First: {positionName(row.top3_position_ids[0])}.</p>)}
              {!model.diagnostics.near_misses.length && <p>No rank #2/#3 cases in this run.</p>}</div>
          </details>)}
          <p className="text-xs text-gray-500 dark:text-gray-400">{result.timing_note} These are preprocessing models followed by TF-IDF; spaCy Medium word vectors are not used, so models can tie.</p>
          <details className="text-xs text-gray-600 dark:text-gray-300"><summary className="cursor-pointer">Inspect labeled cases and Top-3 predictions</summary>
            {result.models.filter(model => model.predictions).map(model => <div key={model.id} className="mt-3"><h3 className="font-semibold">{model.label}</h3><div className="max-h-80 overflow-auto mt-2 space-y-2">{model.predictions.map(row => <p key={row.case_id} className="border-b border-gray-100 dark:border-gray-800 pb-2"><strong>{row.case_id}</strong> · Expected: {positionName(row.expected_position_id)}<br />Top-3: {row.top3_position_ids.map((id, i) => `${i + 1}. ${positionName(id)}`).join('; ')}</p>)}</div></div>)}
          </details>
        </>}
        {result.dataset.version && <p className="text-[11px] text-gray-400 break-all">Dataset: {result.dataset.version} · SHA-256: {result.dataset.sha256}</p>}
        <p className="text-[11px] text-gray-400 break-all">Text: {result.text_generation_version} · Taxonomy: {result.taxonomy_version} · Input SHA-256: {result.input_sha256 || 'No eligible input corpus'}</p>
      </div>}
    </div>
  </section>
}
