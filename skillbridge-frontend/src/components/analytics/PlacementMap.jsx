import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadLeaflet, externalJson } from '../../utils/externalServices'
import './analyticsRedesign.css'

let heatPromise
const boundaryPromises = new Map()
function loadBoundaries(level) {
  if (!boundaryPromises.has(level)) boundaryPromises.set(level,
    externalJson(`/maps/philippines-${level === 'city' ? 'cities' : 'provinces'}.geojson`)
      .catch(error => { boundaryPromises.delete(level); throw error }))
  return boundaryPromises.get(level)
}
function heatLayer() {
  if (window.L?.heatLayer) return Promise.resolve()
  if (!heatPromise) heatPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/vendor/leaflet-heat.js'
    const timer = setTimeout(() => { script.remove(); reject(new Error('Heatmap unavailable')) }, 8000)
    script.onload = () => { clearTimeout(timer); window.L?.heatLayer ? resolve() : reject(new Error('Heatmap unavailable')) }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Heatmap unavailable')) }
    document.head.append(script)
  }).catch(error => { heatPromise = null; throw error })
  return heatPromise
}
const shade = count => count > 50 ? '#065f46' : count > 25 ? '#059669' : count > 10 ? '#6ee7b7' : count > 0 ? '#d1fae5' : '#e2e8f0'

export default function PlacementMap({ data, selection, onSelect }) {
  const [params, setParams] = useSearchParams()
  const style = params.get('map_style') === 'boundaries' ? 'boundaries' : 'heatmap'
  const level = params.get('area_level') === 'province' ? 'province' : 'city'
  const measure = params.get('map_measure') === 'suggested' ? 'suggested' : 'approved'
  const parent = params.get('map_parent') || ''
  const prefix = measure === 'suggested' ? 'map-suggested' : 'map'
  const activeId = params.get('map_area') || (selection.startsWith(`${prefix}:${level}:`) ? selection.split(':')[2] : '')
  const geo = measure === 'suggested' ? data.suggested_placement_map : data.placement_map
  const title = measure === 'suggested' ? 'Suggested placements' : 'Approved placements'
  const total = geo?.student_count ?? geo?.approved_students ?? 0
  const rows = (geo?.areas[level] || []).filter(row => (!parent || level !== 'city' || row.parent === parent) && (row.partner_count > 0 || row.count > 0)).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  const active = geo?.areas[level]?.find(row => row.id === activeId)
  const missing = geo?.coverage.areas[level].unresolved || 0
  const host = useRef(null), map = useRef(null), layer = useRef(null), basemap = useRef(null)
  const view = useRef('')
  const [failure, setFailure] = useState(''), [attempt, setAttempt] = useState(0), [loading, setLoading] = useState(true)
  const [tilesUnavailable, setTilesUnavailable] = useState(false)
  const onSelectRef = useRef(onSelect), onChooseRef = useRef(null)
  function change(changes) {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key) }
    if (('map_measure' in changes || 'area_level' in changes) && next.get('group')?.startsWith('map')) next.delete('group')
    setParams(next, { preventScrollReset: true })
  }
  useEffect(() => { onSelectRef.current = onSelect; onChooseRef.current = id => {
    const next = new URLSearchParams(window.location.search); next.set('map_area', id)
    setParams(next, { preventScrollReset: true })
  } }, [onSelect, setParams])
  useEffect(() => {
    if (!geo) return
    let disposed = false
    async function draw() {
      try {
        const L = await loadLeaflet()
        if (disposed) return
        setLoading(true); setFailure('')
        if (!map.current) {
          map.current = L.map(host.current, { scrollWheelZoom: false, minZoom: 3, maxZoom: 18, zoomSnap: 0.25, zoomDelta: 0.5, zoomAnimation: false }).setView([12, 122], 5)
          map.current.attributionControl.addAttribution('<a href="https://github.com/faeldon/philippines-json-maps">PH boundaries: James Faeldon / MIT</a>')
        }
        if (layer.current) map.current.removeLayer(layer.current)
        if (style === 'heatmap') {
          if (!basemap.current) basemap.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).on('tileerror', () => setTilesUnavailable(true))
          if (!map.current.hasLayer(basemap.current)) basemap.current.addTo(map.current)
          await heatLayer()
          if (disposed) return
          layer.current = L.heatLayer(geo.points.map(p => [p.lat, p.lng, p.count]), { radius: 30, blur: 22, max: 50, maxZoom: 12, gradient: { 0.2: '#d1fae5', 0.5: '#34d399', 1: '#065f46' } }).addTo(map.current)
          if (view.current !== `heatmap:${measure}`) {
            if (geo.points.length) map.current.fitBounds(L.latLngBounds(geo.points.map(p => [p.lat, p.lng])), { maxZoom: 11, padding: [25, 25], animate: false })
            else map.current.setView([12, 122], 5, { animate: false })
            view.current = `heatmap:${measure}`
          }
        } else {
          if (basemap.current && map.current.hasLayer(basemap.current)) map.current.removeLayer(basemap.current)
          const boundaries = await loadBoundaries(level)
          if (disposed) return
          const counts = new Map(geo.areas[level].map(r => [r.id, r]))
          layer.current = L.geoJSON(boundaries, {
            style: f => ({ fillColor: shade(counts.get(f.properties.code)?.count || 0), fillOpacity: 0.88,
              color: activeId === f.properties.code ? '#047857' : '#94a3b8',
              weight: activeId === f.properties.code ? 2.5 : level === 'province' ? 0.8 : 0.5 }),
            onEachFeature: (f, polygon) => {
              const count = counts.get(f.properties.code)?.count || 0
              const label = document.createElement('span'); label.textContent = `${f.properties.name}: ${count} ${measure} students`
              polygon.bindTooltip(label)
              polygon.on('click', () => onChooseRef.current(f.properties.code))
              if (activeId === f.properties.code) {
                const popup = document.createElement('div'), name = document.createElement('strong'), caption = document.createElement('p'), button = document.createElement('button')
                name.textContent = f.properties.name; caption.textContent = `${count} ${measure} students`; button.textContent = 'View students →'
                button.type = 'button'; button.onclick = () => onSelectRef.current(`${prefix}:${level}:${f.properties.code}`)
                popup.append(name, caption, button); polygon.bindPopup(popup).openPopup()
              }
            },
          }).addTo(map.current)
          const key = `boundaries:${level}:${parent}`
          if (view.current !== key) {
            const bounds = parent && level === 'city' ? L.geoJSON({ ...boundaries, features: boundaries.features.filter(f => f.properties.parent === parent) }).getBounds() : layer.current.getBounds()
            if (bounds.isValid()) map.current.fitBounds(bounds, { padding: [15, 15], animate: false })
            view.current = key
          }
        }
        map.current.invalidateSize(); setLoading(false)
      } catch (error) { if (!disposed) { setFailure(error.message || 'Map unavailable'); setLoading(false) } }
    }
    draw()
    return () => { disposed = true }
  }, [geo, style, level, parent, measure, prefix, activeId, attempt])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.current?.invalidateSize())
    if (host.current) observer.observe(host.current)
    return () => { observer.disconnect(); map.current?.remove(); map.current = null }
  }, [])
  function fit() {
    const L = window.L
    if (!L || !map.current) return
    if (style === 'boundaries' && layer.current?.getBounds) { change({ map_parent: '' }); map.current.fitBounds(layer.current.getBounds(), { animate: false }) }
    else if (geo?.points.length) map.current.fitBounds(L.latLngBounds(geo.points.map(p => [p.lat, p.lng])), { maxZoom: 11, padding: [25, 25], animate: false })
  }
  return <section className="am-layout" aria-label="Placement geography">
    <div className="ar-panel am-main"><header><div><h3>{title} by partner location</h3><p>{measure === 'suggested' ? 'Current saved allocations awaiting coordinator approval.' : 'Approved students in the selected batches.'}</p></div><button type="button" onClick={fit}>{style === 'boundaries' ? 'Show Philippines' : 'Fit locations'}</button></header>
      <div className="am-toolbar">
        <div role="group" aria-label="Placement map status">{[['approved', 'Approved'], ['suggested', 'Suggested']].map(([key, label]) => <button type="button" key={key} aria-pressed={measure === key} onClick={() => change({ map_measure: key, map_area: '' })}>{label}</button>)}</div>
        <div role="group" aria-label="Map style">{[['heatmap', 'Heatmap'], ['boundaries', 'Area boundaries']].map(([key, label]) => <button type="button" key={key} aria-pressed={style === key} onClick={() => change({ map_style: key })}>{label}</button>)}</div>
        {style === 'boundaries' && <label>Area level<select aria-label="Area level" value={level} onChange={e => change({ area_level: e.target.value, map_parent: '', map_area: '' })}><option value="province">Province / independent city</option><option value="city">City / municipality</option></select></label>}
      </div>
      {parent && <button type="button" onClick={() => change({ map_parent: '', map_area: '' })}>Philippines / All partner areas</button>}
      <div className={`am-map-frame ${style === 'boundaries' ? 'am-outline' : ''}`}><div ref={host} className="am-map" aria-label="Partner location map" /></div>
      {style === 'heatmap' && tilesUnavailable && <p>Basemap tiles are unavailable. Heat and exact counts remain usable.</p>}
      {loading && geo && <p role="status">Loading map…</p>}
      {(!geo || failure) && <p role="status">{failure || 'Geographic data is not available in this snapshot'}. Exact counts remain available. <button type="button" onClick={() => setAttempt(attempt + 1)}>Retry map</button></p>}
      {geo && <><p className="am-legend">{style === 'heatmap' ? `Relative density · Low → High · ${geo.coverage.pins.mapped} of ${total} students mapped` : <>{measure === 'suggested' ? 'Suggested' : 'Approved'} students: {['0', '1–10', '11–25', '26–50', '51+'].map((label, i) => <span key={label}><i style={{ background: shade([0, 1, 11, 26, 51][i]) }} />{label}</span>)} · {geo.coverage.areas[level].matched} of {total} area-matched</>}</p>
      {(style === 'heatmap' ? geo.coverage.pins.missing + geo.coverage.pins.invalid : missing) > 0 && <button className="am-coverage" type="button" onClick={() => onSelect(style === 'heatmap' ? `${prefix}:pins:missing` : `${prefix}:${level}:unknown`)}>{style === 'heatmap' ? geo.coverage.pins.missing + geo.coverage.pins.invalid : missing} students {style === 'heatmap' ? 'without a valid partner pin' : 'with unmatched areas'} · View records</button>}
      {measure === 'suggested' && total === 0 && <p>No current saved suggestions in this scope. Review suggestions in OJT Placement Management.</p>}</>}
    </div>
    <aside className="ar-panel am-list"><h3>Partner areas</h3><p>{total} {measure} students · only areas with partners</p>
      {rows.map(row => <div key={row.id}><button type="button" aria-pressed={activeId === row.id} onClick={() => change({ map_area: row.id })}><span>{row.name}<small>{row.partner_count || 1} {(row.partner_count || 1) === 1 ? 'partner' : 'partners'}</small></span><strong>{row.count}</strong></button>{level === 'province' && geo.areas.city.some(city => city.parent === row.id && city.id !== row.id) && <button type="button" className="am-explore" onClick={() => change({ area_level: 'city', map_parent: row.id, map_area: '' })}>Explore cities →</button>}</div>)}
      {rows.length === 0 && <p>No partner areas match this scope.</p>}
      {active && <div className="am-selected"><h4>{active.name}</h4><p>{active.count} {measure} students</p><button className="am-view-students" type="button" onClick={() => onSelect(`${prefix}:${level}:${active.id}`)}>View {active.count} students</button></div>}
      {missing > 0 && <button type="button" onClick={() => onSelect(`${prefix}:${level}:unknown`)}><span>Unmatched locations</span><strong>{missing}</strong></button>}
      {(activeId || selection.startsWith('map')) && <button type="button" onClick={() => { change({ map_area: '', group: '' }) }}>Clear selection</button>}
      <p>Philippines reference boundaries · <a href="https://github.com/faeldon/philippines-json-maps" target="_blank" rel="noreferrer">James Faeldon / MIT</a>. Unmatched locations stay in totals.</p>
    </aside>
  </section>
}
