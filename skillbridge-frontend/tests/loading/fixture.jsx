import { useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import DataSection from '../../src/components/DataSection'
import { AnalyticsSkeleton, ContentSkeleton, CollectionSkeleton, RouteSkeleton } from '../../src/components/loading/Skeletons'
import { queryStore } from '../../src/api/queryStore.js'
import '../../src/index.css'

const URL = '/api/loading-fixture/'

export function Fixture() {
  const [layout, setLayout] = useState('student-cards')
  useSyncExternalStore(queryStore.observe, queryStore.revision)
  useEffect(() => { queryStore.fetch(URL).catch(() => {}) }, [])
  const data = queryStore.read(URL)?.data
  return <main style={{ padding: 20, maxWidth: 1250, margin: 'auto' }}>
    <h1>Student collection</h1>
    <label>Search students<input aria-label="Search students" style={{ display: 'block', margin: '12px 0', border: '1px solid #9ca3af' }} /></label>
    <label>Preview loader<select aria-label="Preview loader" value={layout} onChange={event => setLayout(event.target.value)}>{['student-cards', 'student-table', 'batch-cards', 'batch-student-table', 'assessment-cards', 'assessment-table', 'instructor-stats', 'assessment-stats', 'placement-stats', 'profile', 'company-detail', 'assessment', 'questions', 'allocation', 'timeline', 'position-review', 'analytics-assessments', 'analytics-skills', 'analytics-placements', 'route'].map(value => <option key={value}>{value}</option>)}</select></label>
    <section id="preview" style={{ marginTop: 24 }}>
      {layout.startsWith('analytics-') ? <AnalyticsSkeleton tab={layout.replace('analytics-', '')} /> : layout === 'route' ? <RouteSkeleton pathname="/instructor/assessment/create" /> : layout === 'student-table' || layout === 'batch-student-table' ? <CollectionSkeleton view="list" kind={layout.replace('-table', '')} /> : <ContentSkeleton layout={layout} count={layout === 'assessment-stats' ? 5 : layout === 'placement-stats' ? 3 : undefined} />}
    </section>
    <section aria-label="Live loading boundary" style={{ marginTop: 40 }}>
      <h2>Existing section heading</h2>
      <DataSection url={URL} layout="student-cards" label="Loading example students">
        <p id="loaded-value">Loaded revision {data?.revision}</p><input aria-label="Retained draft" defaultValue="Draft stays mounted" />
      </DataSection>
      <button onClick={() => queryStore.fetch(URL).catch(() => {})}>Refresh example</button>
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<Fixture />)
