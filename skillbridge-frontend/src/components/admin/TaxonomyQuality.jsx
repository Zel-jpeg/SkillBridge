import { useState } from 'react'
import api from '../../api/axios'

export function TaxonomyWarnings({ data, label = 'Taxonomy warnings' }) {
  if (!data) return null
  return <details className="text-xs text-gray-600 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
    <summary className="font-semibold cursor-pointer">{label}: {data.warnings.length} · {data.category_count} categories</summary>
    <p className="mt-2">{data.note}</p>
    {!data.warnings.length && <p className="mt-2">No issues detected by these checks.</p>}
    <ul className="mt-2 space-y-2 max-h-72 overflow-auto">{data.warnings.map((warning, index) => <li key={index} className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2">
      <strong>{warning.categories.join(' / ')}</strong>: {warning.message}<br />{warning.suggestion}
    </li>)}</ul>
    {data.common_tags.length > 0 && <p className="mt-2">Shared tags: {data.common_tags.map(t => `${t.tag} (${t.category_count} categories)`).join(', ')}</p>}
  </details>
}

export default function TaxonomyQuality() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function check() {
    setBusy(true)
    setError('')
    try { const response = await api.get('/api/admin/taxonomy-quality/'); setData(response.data) }
    catch (err) { setError(err.response?.data?.error || 'Could not check taxonomy quality.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-2 my-3">
    <button type="button" onClick={check} disabled={busy} className="text-xs font-semibold text-violet-700 dark:text-violet-300 hover:underline disabled:opacity-50">{busy ? 'Checking…' : 'Check saved taxonomy quality'}</button>
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    <TaxonomyWarnings data={data} label="Saved system taxonomy" />
  </div>
}
