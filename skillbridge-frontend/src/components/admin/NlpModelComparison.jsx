import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import { NLP_COMPARISON_TIMEOUT_MS, nlpComparisonErrorMessage } from '../../api/nlpComparison'
import { invalidateCache, useApi } from '../../hooks/useApi'
import DialogShell from '../DialogShell'
import Pagination from '../Pagination'
import { RefreshIcon, ReportIcon, InfoCircleIcon } from '../Icons'

const URL = '/api/admin/nlp-model-comparison/'
const COVERAGE = `${URL}?mode=workflow_simulation&program_scope=all`
const percentage = value => typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—'
const seconds = value => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(3)} s` : '—'
const emptyModels = [{ id: 'spacy_sm', label: 'spaCy Small' }, { id: 'spacy_md', label: 'spaCy Medium' }, { id: 'stanza_en', label: 'Stanza English' }]

function DetailDialog({ title, onClose, children }) {
  return <DialogShell title={title} size="recommendation-tools" closeLabel={`Close ${title.toLowerCase()}`} onClose={onClose} footer={<div className="flex justify-end"><button className="rt-button" type="button" onClick={onClose}>Done</button></div>}><div className="rt-scroll text-xs leading-relaxed">{children}</div></DialogShell>
}

function CoverageDetails({ metadata, onClose }) {
  const dataset = metadata.dataset || {}
  const programs = dataset.programs || []
  return <DetailDialog title="Test data & coverage" onClose={onClose}>
    <section className="rt-section"><h3 className="rt-heading">Synthetic workflow test data</h3><p className="rt-note">{dataset.description}</p><p className="mt-3 font-semibold">{metadata.case_count} student scenarios · {metadata.position_count} test positions</p>
      <div className="rt-table-wrap mt-4"><table className="rt-table"><caption className="sr-only">Test data by program</caption><thead><tr><th scope="col">Test program</th><th scope="col">Institute</th><th scope="col">Students</th><th scope="col">Positions</th></tr></thead><tbody>{programs.map(program => <tr key={program.id}><th scope="row">{program.name} ({program.code})</th><td>{program.institute}</td><td>{program.case_count}</td><td>{program.position_count}</td></tr>)}</tbody></table></div>
      <p className="rt-note mt-3">These are synthetic test programs and records. Comparison does not enroll students, save recommendations or change the active model.</p>
    </section>
    <section className="rt-section"><h3 className="rt-subheading">What the cases check</h3><ul className="mt-3 list-disc space-y-2 pl-5">{(dataset.coverage || []).map((row, index) => <li key={row.id || index}>{typeof row === 'string' ? row : `${row.label}${row.case_count != null ? ` · ${row.case_count} cases` : ''}`}</li>)}</ul><p className="rt-note mt-3">{dataset.expected_labels_note}</p>{dataset.method && <p className="rt-note mt-2">{typeof dataset.method === 'string' ? dataset.method : JSON.stringify(dataset.method)}</p>}</section>
    {(dataset.limitations || []).length > 0 && <section className="rt-section"><h3 className="rt-subheading">Interpretation limits</h3><ul className="mt-3 list-disc space-y-2 pl-5">{dataset.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></section>}
    {metadata.text_samples && <section className="rt-section"><h3 className="rt-subheading">Input text samples</h3><p className="rt-note mt-2">{metadata.text_samples.note || 'Generated text before preprocessing. Tags provide context; they are not separately assessed skills.'}</p>
      {(metadata.text_samples.profiles || []).map(row => <label className="mt-4 block" key={row.case_id}>Student profile · {row.case_id}<textarea className="rt-text mt-2" readOnly value={row.text} /></label>)}
      {(metadata.text_samples.positions || []).map(row => <label className="mt-4 block" key={row.id}>Position · {row.title}<textarea className="rt-text mt-2" readOnly value={row.text} /></label>)}
    </section>}
    <section className="rt-section"><p className="rt-hash">Dataset: {dataset.version || 'Not provided'}<br />SHA-256: {dataset.sha256 || 'Not provided'}</p></section>
  </DetailDialog>
}

function MetricDetails({ result, onClose }) {
  const available = result.models.filter(model => model.metrics)
  const [modelId, setModelId] = useState(available[0]?.id || result.models[0]?.id || '')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const model = result.models.find(row => row.id === modelId)
  const positionName = id => { if (id == null) return 'No recommendation (no positive assessment evidence)'; const row = result.positions?.find(position => position.id === id); return row ? `${row.title} — ${row.company}` : String(id) }
  const filtered = (model?.predictions || []).filter(row => `${row.case_id} ${row.program_id} ${positionName(row.expected_position_id)} ${row.top3_position_ids?.map(positionName).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  const pageSize = 10
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  return <DetailDialog title="Metrics & case results" onClose={onClose}>
    <section className="rt-section"><h3 className="rt-heading">How to read the comparison</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2"><div><dt className="font-semibold">Top-1 agreement</dt><dd className="rt-note">The first recommended position equals the fixed expected position.</dd></div><div><dt className="font-semibold">Top-3 hit rate</dt><dd className="rt-note">The expected position appears among the first three recommendations.</dd></div></dl><p className="rt-note mt-3">{result.metric_note}</p><p className="rt-note mt-2">These are test-set measures, not a student’s Match percentage or a probability of placement success. Identical results across models can be valid because assessment evidence leads the order.</p><p className="rt-note mt-2">{result.timing_note}</p></section>
    <section className="rt-section"><label className="block font-medium">Model to inspect<select aria-label="Model to inspect" className="rt-field" value={modelId} onChange={event => { setModelId(event.target.value); setPage(1); setSearch('') }}>{result.models.map(row => <option value={row.id} key={row.id}>{row.label}</option>)}</select></label>
      {model?.metrics ? <><div className="rt-table-wrap mt-4"><table className="rt-table"><caption className="sr-only">Additional metrics for {model.label}</caption><thead><tr><th scope="col">Macro precision</th><th scope="col">Macro recall</th><th scope="col">Macro F1</th><th scope="col">Model load time</th></tr></thead><tbody><tr><td>{percentage(model.metrics.precision)}</td><td>{percentage(model.metrics.recall)}</td><td>{percentage(model.metrics.f1)}</td><td>{seconds(model.metrics.load_time_seconds)}</td></tr></tbody></table></div>
        <h3 className="rt-subheading mt-5">NLP-only diagnostics</h3><p className="rt-note mt-1">These diagnostics use only text similarity to order eligible positions. They do not replace the assessment-led workflow above.</p><div className="rt-table-wrap mt-3"><table className="rt-table"><caption className="sr-only">Supporting text-only model diagnostics</caption><thead><tr><th scope="col">Ranked cases</th><th scope="col">NLP Top-1 agreement</th><th scope="col">NLP Top-3 hit rate</th><th scope="col">No-evidence cases</th><th scope="col">No-evidence gate agreement</th></tr></thead><tbody><tr><td>{model.metrics.ranked_case_count ?? '—'}</td><td>{percentage(model.metrics.nlp_top1_accuracy)}</td><td>{percentage(model.metrics.nlp_top3_accuracy)}</td><td>{model.metrics.no_evidence_case_count ?? '—'}</td><td>{percentage(model.metrics.no_evidence_gate_agreement)}</td></tr></tbody></table></div>
        {model.program_metrics?.length > 0 && <div className="rt-table-wrap mt-4"><table className="rt-table"><caption className="sr-only">Results by test program</caption><thead><tr><th scope="col">Program</th><th scope="col">Cases</th><th scope="col">Top-1 agreement</th><th scope="col">Top-3 hit rate</th></tr></thead><tbody>{model.program_metrics.map(row => <tr key={row.program_id || row.id}><th scope="row">{row.program_name || row.name || row.program_id || row.id}</th><td>{row.case_count}</td><td>{percentage(row.metrics?.top1_accuracy ?? row.top1_accuracy)}</td><td>{percentage(row.metrics?.top3_accuracy ?? row.top3_accuracy)}</td></tr>)}</tbody></table></div>}
      </> : <p role="status" className="rt-message rt-message--error">{model?.message || 'No measured results are available for this model. Metrics from another model are never substituted.'}</p>}
    </section>
    <section className="rt-section"><h3 className="rt-subheading">Labeled cases and predictions</h3><label className="block mt-3 font-medium">Search cases<input className="rt-field" type="search" value={search} placeholder="Case ID, program or position" onChange={event => { setSearch(event.target.value); setPage(1) }} /></label><p className="rt-note mt-2">{filtered.length} matching cases</p>
      {filtered.slice((safePage - 1) * pageSize, safePage * pageSize).map(row => <article key={row.case_id} className="rt-case"><h4>{row.case_id} · {row.program_id}</h4><p className="mt-1">Expected: {positionName(row.expected_position_id)}</p><p className="rt-note">{row.expected_position_id == null ? 'Expected outcome: no recommendations' : `Expected position rank: ${row.expected_rank ?? 'Outside candidate set'}`}</p>{!row.top3_position_ids?.length && <p className="rt-note mt-2">No recommendations generated.</p>}<ol className="mt-2 list-decimal pl-5 space-y-1">{(row.top3_position_ids || []).map((id, index) => { const detail = row.top3_details?.find(item => item.position_id === id); return <li key={id}>{positionName(id)}{detail && <span className="block rt-note">Match: {typeof detail.match_percentage === 'number' ? `${detail.match_percentage.toFixed(1)}%` : '—'} · Minimums: {detail.all_targets_met ? 'met' : 'not all met'} · Supporting NLP: {typeof detail.nlp_percent === 'number' ? `${detail.nlp_percent.toFixed(1)}%` : '—'} · Location: {typeof detail.location_percent === 'number' ? `${detail.location_percent.toFixed(1)}%` : '—'}</span>}{!detail && row.top3_scores?.[index] != null && <span className="rt-note"> · {row.top3_scores[index]}</span>}</li> })}</ol></article>)}
      {!filtered.length && <p className="rt-note mt-4">No cases match this search.</p>}<Pagination total={filtered.length} page={safePage} onPage={setPage} pageSize={pageSize} compact />
    </section>
    <section className="rt-section"><p className="rt-hash">Dataset: {result.dataset?.version} · Input SHA-256: {result.input_sha256}<br />Matching: {result.matching_input_version} · Text: {result.text_generation_version} · Taxonomy: {result.taxonomy_version}</p></section>
  </DetailDialog>
}

export default function NlpModelComparison() {
  const { data: metadata, error: metadataError, loading: metadataLoading } = useApi(COVERAGE)
  const { data: config } = useApi('/api/admin/nlp-configuration/')
  const [programScope, setProgramScope] = useState('all')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const pending = useRef(false)
  const controller = useRef(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort() } }, [])
  const programs = metadata?.dataset?.programs || []
  const selectedProgram = programs.find(row => row.id === programScope)
  const models = result?.models || config?.models || emptyModels

  async function run() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setResult(null)
    controller.current = new AbortController()
    try {
      const { data } = await api.post(URL, { mode: 'workflow_simulation', program_scope: programScope }, { timeout: NLP_COMPARISON_TIMEOUT_MS, signal: controller.current.signal })
      if (mounted.current) setResult(data)
    } catch (err) {
      if (mounted.current && !err.staleIdentity && err.code !== 'ERR_CANCELED') setError(nlpComparisonErrorMessage(err))
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return <section>
    <h3 className="rt-heading">Compare models using the system workflow</h3>
    <p className="rt-note">Same combined assessment evidence and eligible program positions for every model.</p>
    <p className="rt-flow">Category minimums → Assessment-based Match → NLP + location support</p>
    {metadataLoading && !metadata && <p className="rt-note" role="status">Loading test data…</p>}
    {metadataError && <div className="rt-message rt-message--error" role="alert"><p>Could not load the test dataset. Run is unavailable until the dataset can be checked.</p><button type="button" className="rt-button mt-2" onClick={() => invalidateCache(COVERAGE)}>Retry test data</button></div>}
    <div className="rt-toolbar mt-4"><div className="flex-1 min-w-0"><span className="font-medium">Test data</span><p className="rt-field">System workflow simulation</p></div><label>Program scope<select className="rt-field" value={programScope} disabled={busy || !metadata} onChange={event => { setProgramScope(event.target.value); setResult(null); setError('') }}><option value="all">All test programs</option>{programs.map(row => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}</select></label><button type="button" className="rt-button rt-button--primary" disabled={busy || !metadata || Boolean(metadataError)} aria-busy={busy} onClick={run}>{busy && <span className="rt-busy-icon" aria-hidden="true"><RefreshIcon size={15} /></span>}{busy ? 'Comparing models…' : 'Run comparison'}</button></div>
    <div className="rt-dataset"><div>{metadata && <p className="font-semibold">{selectedProgram ? selectedProgram.case_count : metadata.case_count} synthetic students · {selectedProgram ? '1 test program' : `${programs.length} test programs`}</p>}<p className="rt-note">{selectedProgram ? selectedProgram.name : programs.map(row => row.code).join(', ')} · No real student records are changed.</p></div><button className="rt-button" type="button" disabled={!metadata} onClick={() => setDialog('coverage')}><InfoCircleIcon size={16} />Test data & coverage</button></div>
    <section className="rt-section" aria-live="polite" aria-busy={busy}>
      <h3 className="rt-heading">Comparison results</h3>
      <p className="rt-note mb-3">{busy ? 'Loading models and evaluating the fixed cases. The first run can take several minutes.' : result ? `${result.case_count} cases · ${result.position_count} positions · ${new Date(result.evaluated_at).toLocaleString()}` : 'Not run yet.'}</p>
      {error && <p role="alert" className="rt-message rt-message--error mb-4">{error}</p>}
      <div className="rt-table-wrap"><table className="rt-table"><caption className="sr-only">NLP model comparison using the current system workflow</caption><thead><tr><th scope="col">Model</th><th scope="col">Runtime status</th><th scope="col">Top-1 agreement</th><th scope="col">Top-3 hit rate</th><th scope="col">Processing time</th></tr></thead><tbody>{models.map(model => <tr key={model.id}><th scope="row">{model.label}</th><td><span>{result ? model.status === 'available' ? 'Verified · evaluated' : model.status : model.verified ? 'Verified' : model.available ? 'Installed · not checked' : config ? 'Unavailable' : 'Not checked'}</span>{model.message && <p className="rt-note mt-1">{model.message}</p>}</td><td>{percentage(model.metrics?.top1_accuracy)}</td><td>{percentage(model.metrics?.top3_accuracy)}</td><td>{seconds(model.metrics?.processing_time_seconds)}</td></tr>)}</tbody></table></div>
      {result?.message && <p role="status" className="rt-message">{result.message}</p>}
      <p className="rt-note mt-3">Full-workflow agreement is separate from NLP-only text similarity. Models can legitimately tie when assessment evidence determines the order.</p>
      <div className="flex flex-wrap items-center gap-3 mt-4"><button type="button" className="rt-button" disabled={!result || busy} onClick={() => setDialog('metrics')}><ReportIcon size={16} />Metrics & case results</button>{!result && <p className="rt-note">Available after comparison.</p>}</div>
      <p className="rt-note mt-5">Test agreement is separate from a student’s Match percentage. Comparison does not save recommendations or change the active model.</p>
    </section>
    {dialog === 'coverage' && metadata && <CoverageDetails metadata={metadata} onClose={() => setDialog(null)} />}
    {dialog === 'metrics' && result && <MetricDetails result={result} onClose={() => setDialog(null)} />}
  </section>
}
