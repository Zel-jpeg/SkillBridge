import './skeletons.css'

const items = count => Array.from({ length: count }, (_, index) => index)

function Block({ width, className = '' }) {
  return <span className={`sk-block ${className}`} style={width ? { width } : undefined} />
}

function Lines() {
  return <div className="sk-lines"><Block width="65%" /><Block width="42%" className="sk-small" /></div>
}

function Identity() {
  return <div className="sk-identity"><Block className="sk-avatar" /><Lines /><Block className="sk-badge" /></div>
}

function Rows({ count = 4, columns = 5, identity = false }) {
  return <div className="sk-table">
    <div className="sk-row sk-table-head" style={{ '--sk-columns': columns }}>{items(columns).map(index => <Block key={index} width={index ? '60%' : '45%'} className="sk-small" />)}</div>
    {items(count).map(index => <div key={index} className="sk-row" style={{ '--sk-columns': columns }}>{items(columns).map(column => column === 0 && identity ? <div key={column} className="sk-identity"><Block className="sk-avatar sk-avatar-small" /><Lines /></div> : <Block key={column} width={column ? '65%' : '75%'} />)}</div>)}
  </div>
}

function Collection({ count, kind, columns }) {
  return <div className={`sk-grid sk-grid-${columns} sk-collection-${kind}`}>
    {items(count).map(index => <div className={`sk-card sk-card-${kind}`} key={index}>
      <Identity />
      {kind === 'student' ? <>
        <Block width="30%" className="sk-badge" />
        <div className="sk-score"><Block width="20%" className="sk-small" /><Block width="100%" className="sk-bar" /></div>
        <div className="sk-mini-grid">{items(4).map(item => <Block key={item} className="sk-chip" />)}</div>
        <Block className="sk-strip" /><Block className="sk-strip" />
      </> : kind === 'assessment' ? <>
        <div className="sk-inline"><Block width="26%" className="sk-badge" /><Block width="35%" className="sk-badge" /></div>
        <div className="sk-inline"><Block width="22%" className="sk-chip" /><Block width="32%" className="sk-chip" /><Block width="20%" className="sk-chip" /></div>
        <Lines /><Block className="sk-bar" /><div className="sk-mini-grid"><Block className="sk-strip" /><Block className="sk-strip" /></div>
      </> : kind === 'batch' || kind === 'batch-student' ? <>
        <div className="sk-divider"><Identity /></div>
        <Block width="55%" />{kind === 'batch-student' && <Block className="sk-bar" />}<Block width="40%" className="sk-small" />
      </> : kind === 'placement-company' ? <>
        <Block width="60%" className="sk-small" /><div className="sk-divider"><Block width="35%" className="sk-metric" /><Block width="75%" className="sk-small" /></div><Block width="45%" className="sk-button" />
      </> : <><Lines /><div className="sk-inline"><Block width="35%" className="sk-chip" /><Block width="30%" className="sk-chip" /></div></>}
    </div>)}
  </div>
}

function Chart({ compact = false }) {
  return <div className={`sk-chart ${compact ? 'sk-chart-compact' : ''}`}><div className="sk-chart-axis">{items(4).map(index => <div key={index} className="sk-chart-row"><Block width="24%" className="sk-small" /><Block width={`${45 + (index % 3) * 20}%`} className="sk-chart-bar" /></div>)}</div></div>
}

function Fields({ count = 4 }) {
  return <div className="sk-fields">{items(count).map(index => <div key={index}><Block width="28%" className="sk-small" /><Block className="sk-field" /></div>)}</div>
}

function Body({ layout, count, columns }) {
  if (layout === 'text' || layout === 'control') return <Block className={layout === 'control' ? 'sk-field' : ''} width={layout === 'text' ? '8rem' : undefined} />
  if (layout === 'stats' || layout.endsWith('-stats')) return <div className={`sk-stats sk-stats-${count} sk-${layout}`}>
    {items(count).map(index => <div key={index} className="sk-card sk-stat"><Block width="60%" className="sk-small" /><Block width="28%" className="sk-metric" /><Block width="80%" className="sk-small" /></div>)}
  </div>
  if (layout.endsWith('-table') && ['student-table', 'user-table', 'batch-table', 'batch-student-table', 'assessment-table'].includes(layout)) {
    const kind = layout.replace('-table', '')
    return <><div className="sk-mobile-cards"><Collection kind={kind} count={Math.min(count, 3)} columns={columns || 3} /></div><div className="sk-desktop-table"><Rows count={count} columns={kind === 'student' ? 6 : columns || 5} identity /></div></>
  }
  if (layout.endsWith('-cards') || layout === 'cards') return <Collection kind={layout === 'cards' ? 'generic' : layout.replace('-cards', '')} count={count} columns={columns || 3} />
  if (layout === 'table') return <Rows count={count} columns={columns || 5} />
  if (layout === 'timeline') return <div className="sk-timeline">{items(count).map(index => <div key={index} className="sk-identity"><Block className="sk-dot" /><Lines /></div>)}</div>
  if (layout === 'allocation') return <div className="sk-card sk-allocation">{items(count).map(index => <div key={index} className="sk-allocation-row"><Identity /><Block className="sk-chip" /><Block width="70%" /><Block className="sk-button" /></div>)}</div>
  if (layout === 'batch-completion' || layout === 'attempt-status') return <div className="sk-stack"><div className="sk-progress-summary"><Block width="25%" className="sk-metric" /><Block width="45%" className="sk-small" /></div><div className="sk-card"><Lines /><Block className="sk-bar" /><div className="sk-mini-grid">{items(layout === 'attempt-status' ? 4 : 2).map(index => <div key={index} className="sk-status-tile"><Block width="45%" className="sk-small" /><Block width="25%" className="sk-metric" /></div>)}</div>{layout === 'batch-completion' && <Block className="sk-field" />}</div></div>
  if (layout === 'placement-progress') return <div className="sk-stack"><div className="sk-progress-summary"><Block width="40%" className="sk-metric" /><Block className="sk-bar" /></div>{items(3).map(index => <div key={index} className="sk-status-tile"><Lines /></div>)}</div>
  if (layout === 'activity-chart') return <div className="sk-line-chart"><div className="sk-line-plot"><svg viewBox="0 0 600 180" preserveAspectRatio="none"><path d="M0 150 L90 150 L150 110 L230 110 L320 60 L390 90 L470 35 L600 35" /></svg></div><div className="sk-inline">{items(5).map(index => <Block key={index} width="15%" className="sk-small" />)}</div></div>
  if (layout === 'chart' || layout === 'map') return layout === 'chart' ? <Chart /> : <div className="sk-map"><Block className="sk-map-pin" /></div>
  if (layout === 'progress') return <div className="sk-progress"><Block width="48%" /><Block className="sk-bar" /><Block width="32%" className="sk-small" /></div>
  if (layout === 'greeting') return <div className="sk-card sk-greeting"><div><Block width="65%" className="sk-title" /><Lines /></div><Block className="sk-avatar" /></div>
  if (layout === 'status') return <div className="sk-card"><Identity /><Block className="sk-bar" /><Block width="75%" /><Block width="45%" className="sk-button" /></div>
  if (layout === 'skills') return <div className="sk-card"><Block width="45%" className="sk-title" /><Chart compact /></div>
  if (layout === 'matches') return <div className="sk-card"><Block width="50%" className="sk-title" />{items(3).map(index => <div key={index} className="sk-divider"><Identity /></div>)}</div>
  if (layout === 'profile') return <div className="sk-profile"><div className="sk-card"><Identity /></div><div className="sk-card"><Fields count={3} /></div><div className="sk-card"><Fields count={3} /></div></div>
  if (layout === 'company-detail') return <div className="sk-detail"><div className="sk-card"><Lines /></div><Block width="25%" />{items(2).map(index => <div key={index} className="sk-card"><Identity /><Lines /><div className="sk-inline"><Block width="30%" className="sk-chip" /><Block width="25%" className="sk-chip" /></div></div>)}</div>
  if (layout === 'student-detail') return <div className="sk-detail"><Identity /><div className="sk-inline">{items(5).map(index => <Block key={index} width="16%" className="sk-chip" />)}</div><Block className="sk-bar" /><div className="sk-pair"><Fields count={4} /><Fields count={2} /></div></div>
  if (layout === 'result-summary') return <div className="sk-card"><Block width="50%" className="sk-title" /><Lines /><Body layout="stats" count={4} /><Block width="65%" /><Block width="45%" className="sk-button" /></div>
  if (layout === 'assessment') return <div className="sk-assessment"><div className="sk-card"><Block width="45%" className="sk-title" /><Block className="sk-bar" /></div><div className="sk-card"><Lines /><Block width="90%" />{items(4).map(index => <Block key={index} className="sk-option" />)}</div></div>
  if (layout === 'questions' || layout === 'answers') return <div className="sk-stack">{items(count).map(index => <div key={index} className="sk-card"><Lines /><Block width="90%" />{items(layout === 'questions' ? 4 : 2).map(option => <Block key={option} className="sk-option" />)}</div>)}</div>
  if (layout === 'settings') return <Fields count={4} />
  if (layout === 'categories') return <div className="sk-inline">{items(6).map(index => <Block key={index} width={`${5 + index % 3}rem`} className="sk-chip" />)}</div>
  if (layout === 'category-editor') return <div className="sk-stack"><Block className="sk-field" /><Body layout="categories" /></div>
  if (layout === 'position-review') return <div className="sk-position-review"><div className="sk-stack">{items(2).map(index => <div key={index} className="sk-card"><Lines /><Block className="sk-bar" /></div>)}</div><div className="sk-card"><Lines /><Block width="60%" className="sk-field" /><Rows count={3} columns={3} identity /></div></div>
  return <div className="sk-stack">{items(count).map(index => <div key={index} className="sk-card"><Lines /><Block width="85%" /></div>)}</div>
}

// Representative records, not a promise of how many results the server will return.
export function ContentSkeleton({ layout = 'cards', count, columns, label = 'Loading content' }) {
  const size = count ?? (layout === 'stats' || layout.endsWith('-stats') ? 4 : layout === 'table' || layout.endsWith('-table') ? 4 : layout === 'questions' || layout === 'answers' ? 2 : layout.endsWith('-cards') || layout === 'cards' ? (columns || 3) : layout === 'timeline' || layout === 'allocation' ? 3 : 1)
  return <div role="status" aria-label={label} aria-busy="true" className={`sb-skeleton sb-skeleton-${layout}`}>
    <span className="sr-only">{label}</span><div aria-hidden="true"><Body layout={layout} count={size} columns={columns} /></div>
  </div>
}

export function CollectionSkeleton({ view = 'grid', kind = 'student', columns = 3, count }) {
  return <ContentSkeleton layout={`${kind}-${view === 'list' ? 'table' : 'cards'}`} count={count} columns={columns} label={`Loading ${kind === 'student' || kind === 'batch-student' ? 'students' : kind === 'batch' ? 'batches' : 'users'}`} />
}

export function InsightsSkeleton({ tab }) {
  return <div className={`sk-insights sk-insights-${tab}`}>
    <div className="sk-pair">{(tab === 'skills' ? ['Skill results by category', 'Best current company match'] : tab === 'placements' ? ['Student placement progress', 'Approved placements by company'] : ['Required completion by batch', 'Assessment attempt status']).map((title, index) => <section key={title} className="sk-insight-panel"><h3>{title}</h3><ContentSkeleton layout={tab === 'skills' || tab === 'placements' && index === 1 ? 'table' : tab === 'placements' ? 'placement-progress' : index === 0 ? 'batch-completion' : 'attempt-status'} count={4} label={`Loading ${title.toLowerCase()}`} /></section>)}</div>
    {tab === 'placements' && <section className="sk-insight-panel"><h3>Shared position slots</h3><ContentSkeleton layout="table" count={4} label="Loading position slots" /></section>}
  </div>
}

export function AnalyticsSkeleton({ tab }) {
  return <div className="sk-stack"><ContentSkeleton layout="report-stats" count={3} label="Loading report totals" /><InsightsSkeleton tab={tab} />{tab === 'assessments' && <section className="sk-insight-panel"><h3>Recorded submission activity</h3><ContentSkeleton layout="activity-chart" label="Loading recorded submission activity" /></section>}</div>
}

export function RouteSkeleton({ pathname = '/', search = '' }) {
  const [, role, section] = pathname.split('/')
  const creating = pathname.endsWith('/assessment/create')
  const profile = section === 'profile'
  let content
  if (pathname.endsWith('/take')) return <ContentSkeleton layout="assessment" label="Loading assessment" />
  if (creating) content = <><div className="sk-card"><Fields count={1} /><div className="sk-route-form-grid"><Fields count={2} /><Fields count={2} /></div><div className="sk-route-form-grid"><Lines /><Lines /></div><div className="sk-route-form-grid"><Fields count={1} /><Fields count={1} /></div></div><div className="sk-card"><ContentSkeleton layout="category-editor" /></div></>
  else if (section === 'setup') content = <div className="sk-card"><Identity /><Fields count={4} /><ContentSkeleton layout="map" /></div>
  else if (profile) content = <ContentSkeleton layout="profile" label="Loading your profile" />
  else if (section === 'reports') {
    const requested = new URLSearchParams(search).get('tab')
    const tab = ['skills', 'placements'].includes(requested) ? requested : 'assessments'
    content = <><div className="sk-card"><div className={`sk-route-filters sk-route-filters-${role === 'admin' ? 4 : 3}`}><Fields count={1} /><Fields count={1} /><Fields count={1} />{role === 'admin' && <Fields count={1} />}</div></div><ContentSkeleton layout="categories" /><AnalyticsSkeleton tab={tab} /></>
  } else if (section === 'dashboard') content = role === 'student'
    ? <><ContentSkeleton layout="greeting" /><div className="sk-pair"><ContentSkeleton layout="status" /><ContentSkeleton layout="matches" /></div><ContentSkeleton layout="skills" /></>
    : <><ContentSkeleton layout={role === 'instructor' ? 'instructor-stats' : 'stats'} count={role === 'admin' ? 5 : 4} /><ContentSkeleton layout="highlight-cards" columns={4} /><ContentSkeleton layout="highlight-cards" columns={4} /><CollectionSkeleton view={role === 'instructor' ? 'list' : 'grid'} /></>
  else if (section === 'results' || pathname.endsWith('/results')) content = <ContentSkeleton layout="result-summary" />
  else if (pathname.endsWith('/archives')) content = <ContentSkeleton layout="assessment-table" count={4} columns={7} />
  else if (section === 'assessments') content = role === 'student'
    ? <><ContentSkeleton layout="progress" /><ContentSkeleton layout="assessment-cards" /></>
    : <><ContentSkeleton layout={role === 'admin' ? 'assessment-stats' : 'library-stats'} count={role === 'admin' ? 5 : 4} /><ContentSkeleton layout="control" /><ContentSkeleton layout="assessment-cards" /></>
  else if (section === 'placements') content = <><ContentSkeleton layout="placement-stats" count={3} /><ContentSkeleton layout="control" /><ContentSkeleton layout="placement-company-cards" columns={2} /></>
  else if (section === 'companies') content = <><ContentSkeleton layout="map" /><ContentSkeleton layout={role === 'admin' ? 'placement-company-cards' : 'company-cards'} columns={role === 'admin' ? 2 : 3} /></>
  else if (section === 'skills') content = <><ContentSkeleton layout="control" /><ContentSkeleton layout="table" columns={3} /></>
  else if (section === 'students' || section === 'users' || section === 'batches') content = <>{section === 'students' && <ContentSkeleton layout="roster-stats" count={8} />}<ContentSkeleton layout="control" /><CollectionSkeleton kind={section === 'batches' ? 'batch' : section === 'users' ? 'user' : 'student'} /></>
  else content = <ContentSkeleton layout="panel" />
  return <div className={`sk-route-page ${creating || section === 'setup' ? 'sk-route-page-form' : profile ? 'sk-route-page-profile' : ''}`}>
    <div aria-hidden="true" className="sk-route-heading"><Block width="14rem" className="sk-title" /><Block width="22rem" className="sk-small" /></div>
    {content}
  </div>
}
