import { useEffect, useMemo, useRef, useState } from 'react'
import { invalidateCache, useApi } from '../../hooks/useApi'
import { ORGANIZATION_OPTIONS } from '../../utils/organizationScope'
import { groupPartnerPins, mapAddress, partnerMapData, SHARED_MAP_COLOR, UNASSIGNED_MAP_COLOR } from '../../utils/partnerMap'
import { loadLeaflet } from '../../utils/externalServices'
import { escapeHtml } from '../../utils/escapeHtml'
import MapStatus from '../MapStatus'
import { ChevronDown, PinIcon } from '../Icons'
import { organizationButton as button, organizationField as field } from './organizationUi'

const COMPANIES = '/api/admin/companies/'

function popup(rows) {
  return rows.map(row => `<section style="min-width:190px;max-width:280px;padding:6px 0;font:12px/1.5 system-ui;color:#111827">
    <strong>${escapeHtml(row.name)}</strong>
    <p style="margin:4px 0">${escapeHtml(mapAddress(row.address) || 'No address set')}</p>
    <p style="margin:4px 0">${escapeHtml(row.institutes.map(item => item.code).join(' · ') || 'Institute not assigned')}</p>
    <p style="margin:4px 0">${escapeHtml(row.programs.map(item => item.name).join(' · ') || (row.icShared ? 'IC shared batches' : 'Program not assigned'))}</p>
    <p style="margin:4px 0">${row.positions.length} active opening${row.positions.length === 1 ? '' : 's'} · ${row.remaining == null ? 'Capacity unavailable' : `${row.remaining} shared slots remaining`}</p>
    <small>Slots include current approvals from every eligible program.${row.archived_at ? ' Archived partner.' : ''}</small>
  </section>`).join('<hr>')
}

function icon(L, rows) {
  const shared = new Set(rows.map(row => row.color)).size > 1
  const color = shared ? SHARED_MAP_COLOR : rows[0].color
  const label = rows.length > 1 ? `${rows.length} partners` : rows[0].markerLabel
  return L.divIcon({ className: '', iconSize: [88, 48], iconAnchor: [44, 46], popupAnchor: [0, -40],
    html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 1px 2px #0005)"><span style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 7px;border-radius:10px;border:1px solid white;color:white;background:${color};font:600 11px/16px system-ui">${escapeHtml(label)}</span><svg width="24" height="28" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 27C10 23 2 16 2 11a10 10 0 0 1 20 0c0 5-8 12-10 16Z" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="12" cy="11" r="3" fill="white"/></svg></div>` })
}

function PartnerLocationsMap({ rows, expanded }) {
  const el = useRef(null), map = useRef(null), markers = useRef([])
  const latest = useRef(rows), fitted = useRef(false)
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)
  function fit() {
    const L = window.L
    if (!map.current || !L || !markers.current.length) return
    if (markers.current.length === 1) map.current.setView(markers.current[0].getLatLng(), 13)
    else map.current.fitBounds(L.featureGroup(markers.current).getBounds().pad(.18), { maxZoom: 14 })
    fitted.current = true
  }
  function draw(L) {
    markers.current.forEach(marker => marker.remove())
    markers.current = groupPartnerPins(latest.current).map(group => {
      const title = group.map(row => `${row.name} · ${row.markerLabel}`).join('; ')
      const marker = L.marker(group[0].pin, { icon: icon(L, group), title, keyboard: true })
        .addTo(map.current).bindPopup(popup(group), { maxWidth: 300 })
      marker.getElement()?.setAttribute('aria-label', title)
      return marker
    })
    if (!fitted.current && el.current?.clientWidth) fit()
  }
  useEffect(() => {
    let alive = true, observer
    loadLeaflet().then(L => {
      if (!alive || !el.current) return
      map.current = L.map(el.current).setView([7.3072, 125.6839], 10)
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 19,
      }).addTo(map.current)
      tiles.on('tileerror', () => { if (alive) setStatus('tiles') })
      map.current.zoomControl.setPosition('bottomright')
      draw(L)
      observer = new ResizeObserver(() => {
        if (!el.current?.clientWidth) return
        map.current?.invalidateSize({ pan: false })
        if (!fitted.current) fit()
      })
      observer.observe(el.current)
      setStatus('ready')
    }).catch(() => { if (alive) { map.current?.remove(); map.current = null; setStatus('error') } })
    return () => { alive = false; observer?.disconnect(); map.current?.remove(); map.current = null; markers.current = []; fitted.current = false }
    // The map is initialized once per explicit retry; live rows use the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])
  useEffect(() => {
    latest.current = rows
    if (map.current && window.L) draw(window.L)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])
  return <div hidden={!expanded} className="space-y-3">
    <div className="relative isolate"><div ref={el} role="region" aria-label="Partner locations map" className="h-72 w-full rounded-xl sm:h-96" />
      <MapStatus status={status} onRetry={() => { setStatus('loading'); setAttempt(value => value + 1) }} /></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Select a pin for its partner, institutes, programs and shared capacity.</p>
      <button type="button" className={button} disabled={!rows.length || status === 'error' || status === 'loading'} onClick={fit}>Fit matching partners</button></div>
  </div>
}

export default function AdminPartnerMap({ scope }) {
  const { data: companies, error: companiesError } = useApi(COMPANIES)
  const { data: options, error: optionsError } = useApi(ORGANIZATION_OPTIONS)
  const [expanded, setExpanded] = useState(true)
  const [status, setStatus] = useState('active')
  const data = useMemo(() => partnerMapData(companies || [], options, scope, status), [companies, options, scope, status])
  const pending = !companies || !options
  const error = companiesError || optionsError
  return <section aria-label="Partner map overview" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <button type="button" aria-controls="partner-locations-map" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg text-left hover:text-green-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:text-green-300">
        <PinIcon size={21} /><span><span className="block text-sm font-semibold">Partner Locations</span><span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{!scope.institute ? 'All institutes' : options?.institutes.find(row => String(row.id) === scope.institute)?.name || 'Institute unavailable'}{scope.program ? ` · ${options?.programs.find(row => String(row.id) === scope.program)?.code || 'Program unavailable'}` : ' · All programs'}</span></span>
        <span className="text-xs">{expanded ? 'Collapse' : 'Expand'}</span><ChevronDown open={expanded} size={14} />
      </button>
      <label className="text-xs font-medium">Map partner status<select aria-label="Map partner status" value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="active">Active partners</option><option value="archived">Archived partners</option><option value="all">All partners</option></select></label>
    </header>
    {error && <div role="alert" className="text-xs text-rose-700 dark:text-rose-300"><p>Could not refresh partner locations.{pending ? '' : ' Showing the last loaded data.'}</p><button className={button} onClick={() => { invalidateCache(COMPANIES); invalidateCache(ORGANIZATION_OPTIONS) }}>Retry partner locations</button></div>}
    {pending ? <p role="status" className="text-xs">Loading partner locations…</p> : <>
      <p role="status" className="text-xs text-gray-600 dark:text-gray-300">{data.rows.length} matching partners · {data.mapped.length} mapped · {data.missing} need a location pin</p>
      <div id="partner-locations-map"><PartnerLocationsMap rows={data.mapped} expanded={expanded} /></div>
      {data.rows.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{data.invalid ? 'Choose a valid institute and program to view matching pins.' : 'No partners match this institute, program and status.'}</p>}
      {data.rows.length > 0 && !data.mapped.length && <p className="text-xs text-gray-500 dark:text-gray-400">No pinned partners in this view. Add a saved location to show a partner on the map.</p>}
      {data.mapped.length > 0 && <ul aria-label="Institute map legend" className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {data.legend.map(item => <li key={item.id} className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: item.color }} /><span className="break-words">{item.code} · {item.name}</span></li>)}
        {!scope.institute && data.mapped.some(row => row.institutes.length > 1) && <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: SHARED_MAP_COLOR }} />Shared across institutes</li>}
        {data.mapped.some(row => !row.institutes.length) && <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: UNASSIGNED_MAP_COLOR }} />Institute not assigned</li>}
      </ul>}
    </>}
  </section>
}
