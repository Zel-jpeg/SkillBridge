import { useEffect, useRef, useState } from 'react'
import { escapeHtml } from '../../utils/escapeHtml'
import { loadLeaflet } from '../../utils/externalServices'
import MapStatus from '../MapStatus'
import { PinIcon, XIcon } from '../Icons'
import { requestRoadRoute } from '../../utils/roadRoutes'
import './nearbyMap.css'

// ── Haversine distance ────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Leaflet singleton ─────────────────────────────────────────────


function makeCompanyIcon(L, name, isTopMatch = false) {
  const pinFill = isTopMatch ? '#f59e0b' : '#16a34a'
  const labelBg = isTopMatch ? '#f59e0b' : '#111827'

  return L.divIcon({
    className: '', iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -42],
    html: `
      <div class="group relative flex flex-col justify-end items-center cursor-pointer select-none"
           style="position:relative;z-index:${isTopMatch ? 9999 : 100}">
        <div style="
          position:absolute;bottom:40px;white-space:nowrap;
          background:${labelBg};color:white;
          font-size:10px;font-weight:700;font-family:system-ui,sans-serif;
          padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.35);
          pointer-events:none;transition:all .18s;
          transform:translateX(-50%);left:50%;
        ">
          ${isTopMatch ? '⭐ ' : ''}${escapeHtml(name)}
          <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
            width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
            border-top:6px solid ${labelBg}"></div>
        </div>
        <div style="transition:transform .18s" class="group-hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="${isTopMatch ? 32 : 26}" height="${isTopMatch ? 40 : 34}" viewBox="0 0 28 36" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));display:block">
            <path fill="${pinFill}" stroke="white" stroke-width="2" d="M14 1C7.4 1 2 6.4 2 13c0 9.5 12 23 12 23S26 22.5 26 13C26 6.4 20.6 1 14 1z"/>
            <circle fill="white" cx="14" cy="13" r="5"/>
          </svg>
        </div>
      </div>`,
  })
}

function makeStudentIcon(L) {
  return L.divIcon({
    className: '', iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -44],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path fill="#2563eb" stroke="white" stroke-width="2.5"
        d="M16 1C8.8 1 3 6.8 3 14c0 10.5 13 26 13 26S29 24.5 29 14C29 6.8 23.2 1 16 1z"/>
      <circle fill="white" cx="16" cy="14" r="7"/>
      <text x="16" y="18" text-anchor="middle" fill="#2563eb" font-size="8" font-weight="700" font-family="sans-serif">YOU</text>
    </svg>`,
  })
}

// ════════════════════════════════════════════════════════════════
// NearbyMap — fills its container height, no fixed px height
// ════════════════════════════════════════════════════════════════
export default function NearbyMap({ companies, studentPin, initialCenter }) {
  const elRef  = useRef(null)
  const mapRef = useRef(null)
  const [ready, setReady] = useState(false)
  const framed = useRef(false)
  const openMarker = useRef(null)
  const initialView = useRef(initialCenter)
  const studentMarker = useRef(null)
  const highlightTimer = useRef(null)
  const routeCache = useRef(new Map())
  const [selectedKey, setSelectedKey] = useState(null)
  const [routeAttempt, setRouteAttempt] = useState(0)
  const [routeState, setRouteState] = useState(null)
  const selected = companies.find((company, index) => (company.companyKey ?? `company:${company.id ?? index}`) === selectedKey)
  const fromLat = studentPin?.lat, fromLng = studentPin?.lng
  const toLat = selected?.lat, toLng = selected?.lng

  const [mapStatus, setMapStatus] = useState('loading')
  const [mapAttempt, setMapAttempt] = useState(0)
  const routeKey = ready && fromLat != null && toLat != null ? `${fromLat},${fromLng};${toLat},${toLng}:${selectedKey}:${routeAttempt}:${mapAttempt}` : null
  const routeView = routeKey ? routeState?.key === routeKey ? routeState : { status: 'loading' } : null
  function retryMap() { setReady(false); framed.current = false; setMapStatus('loading'); setMapAttempt(value => value + 1) }

  useEffect(() => {
    let alive = true
    let invalidateTimer
    const cache = routeCache.current
    loadLeaflet().then(L => {
      if (!alive || !elRef.current || mapRef.current) return

      // Center on student's pinned location if available, otherwise Panabo City
      const center = initialView.current
        ? [initialView.current.lat, initialView.current.lng]
        : [7.3072, 125.6839]
      const zoom = initialView.current ? 13 : 11

      const map = L.map(elRef.current).setView(center, zoom)
      mapRef.current = map
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      tiles.on?.('tileerror', () => { if (alive) setMapStatus('tiles') })
      map.zoomControl.setPosition('bottomright')
      invalidateTimer = setTimeout(() => map.invalidateSize(), 150)

      mapRef.current = map
      setReady(true)
      setMapStatus('ready')
    }).catch(() => {
      if (alive) {
        mapRef.current?.remove()
        mapRef.current = null
        setMapStatus('error')
      }
    })
    return () => {
      alive = false
      clearTimeout(invalidateTimer)
      clearTimeout(highlightTimer.current)
      cache.clear()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapAttempt]) // intentional
  useEffect(() => {
    if (!ready || !mapRef.current || !window.L) return
    const map = mapRef.current
    const L = window.L
    const allMarkers = []

    // Company pins — add in reverse so top match (highest rank) renders last = on top
    const companiesWithIdx = companies.map((co, idx) => ({ co, idx }))
    ;[...companiesWithIdx].reverse().forEach(({ co, idx }) => {
      if (co.lat == null) return
      const isTopMatch = idx === 0
      const distTxt = studentPin
        ? `<span style="color:#2563eb;font-weight:600">${haversineKm(studentPin.lat, studentPin.lng, co.lat, co.lng).toFixed(1)} km away</span>`
        : ''
      const mk = L.marker([co.lat, co.lng], {
        icon: makeCompanyIcon(L, co.company ?? co.name ?? '', isTopMatch),
        zIndexOffset: isTopMatch ? 1000 : idx * -10,
        title: `Show driving route to ${co.company ?? co.name ?? 'company'}`,
        alt: co.company ?? co.name ?? 'Company',
      })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:150px;font-family:system-ui,sans-serif;line-height:1.4">
            <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#111827">${escapeHtml(co.company ?? co.name ?? 'Company')}</p>
            <p style="font-size:11px;color:#6b7280;margin:0 0 3px">${escapeHtml(co.position)}</p>
            <div style="display:flex;gap:8px;font-size:11px;margin:0">
              <span style="color:#16a34a;font-weight:600">${escapeHtml(co.match)}% match</span>
              ${distTxt ? '· ' + distTxt : ''}
            </div>
          </div>`)
      mk._freshnessKey = co.companyKey ?? `company:${co.id ?? idx}`
      mk.on?.('click', () => { setSelectedKey(mk._freshnessKey); setRouteAttempt(value => value + 1) })
      mk.getElement?.()?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation()
          mk.fire('click', { latlng: mk.getLatLng(), originalEvent: event })
        }
      })
      if (openMarker.current === mk._freshnessKey) mk.openPopup()
      allMarkers.push(mk)
    })

    if (studentPin) {
      const mk = L.marker([studentPin.lat, studentPin.lng], { icon: makeStudentIcon(L), title: 'Your saved location', alt: 'Your saved location', zIndexOffset: 2000 })
        .addTo(map)
        .bindPopup(`<div style="font-family:system-ui,sans-serif;font-size:12px;font-weight:600;color:#2563eb">Your location</div>`)
      mk._freshnessKey = 'student'
      studentMarker.current = mk
      if (openMarker.current === 'student') mk.openPopup()
      allMarkers.push(mk)
    }

    if (!framed.current && allMarkers.length > 1) {
      map.fitBounds(L.featureGroup(allMarkers).getBounds().pad(0.22))
    } else if (!framed.current && allMarkers.length === 1) {
      map.setView(allMarkers[0].getLatLng(), 13)
    }
    if (allMarkers.length) framed.current = true
    return () => {
      openMarker.current = allMarkers.find(marker => marker.isPopupOpen())?._freshnessKey ?? null
      allMarkers.forEach(marker => marker.remove())
      studentMarker.current = null
    }
  }, [ready, companies, studentPin])

  useEffect(() => {
    if (!routeKey || !mapRef.current || !window.L) return
    const controller = new AbortController()
    const map = mapRef.current, L = window.L
    const layers = []
    const cacheKey = `${fromLat},${fromLng};${toLat},${toLng}`
    const promise = routeCache.current.has(cacheKey) ? Promise.resolve(routeCache.current.get(cacheKey))
      : requestRoadRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }, { signal: controller.signal })
    promise.then(route => {
      if (controller.signal.aborted || mapRef.current !== map) return
      if (routeCache.current.size >= 20) routeCache.current.delete(routeCache.current.keys().next().value)
      routeCache.current.set(cacheKey, route)
      layers.push(L.polyline(route.points, { color: '#fff', weight: 8, opacity: .9, interactive: false }).addTo(map))
      layers.push(L.polyline(route.points, { color: '#2563eb', weight: 5, opacity: .95, interactive: false }).addTo(map))
      map.fitBounds(L.latLngBounds([[fromLat, fromLng], ...route.points, [toLat, toLng]]), {
        paddingTopLeft: [24, 64], paddingBottomRight: [50, 115], maxZoom: 15,
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      })
      setRouteState({ key: routeKey, status: 'ready', ...route })
    }).catch(() => {
      if (!controller.signal.aborted && mapRef.current === map) {
        layers.forEach(layer => layer.remove())
        setRouteState({ key: routeKey, status: 'error' })
      }
    })
    return () => { controller.abort(); layers.forEach(layer => layer.remove()) }
  }, [routeKey, fromLat, fromLng, toLat, toLng])

  function highlightLocation() {
    const marker = studentMarker.current, map = mapRef.current
    if (!marker || !map || !studentPin) return
    map.setView([studentPin.lat, studentPin.lng], Math.max(map.getZoom?.() ?? 13, 14), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches })
    marker.openPopup()
    const element = marker.getElement?.()
    element?.classList.remove('student-pin-highlight')
    if (element) { void element.offsetWidth; element.classList.add('student-pin-highlight') }
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => element?.classList.remove('student-pin-highlight'), 3000)
  }


  // Fill 100% of parent — parent must have an explicit height or use flex-1
  return <div className="relative w-full h-full" style={{ isolation: 'isolate' }}>
    <div ref={elRef} className="w-full h-full rounded-xl overflow-hidden" />
    <MapStatus status={mapStatus} onRetry={retryMap} />
    {ready && mapStatus === 'ready' && <div className="student-map-actions">
      <button type="button" disabled={!studentPin} onClick={highlightLocation} title={studentPin ? 'Center and highlight your saved profile pin' : 'Set your location pin in Profile first'}><PinIcon size={15} />Show my location</button>
    </div>}
    {ready && <div className="student-map-route" role="region" aria-label="Road route">
      {routeView ? <>
        <div className="student-map-route-heading"><strong title={selected.company ?? selected.name}>Route to {selected.company ?? selected.name}</strong><button type="button" aria-label="Clear route" onClick={() => setSelectedKey(null)}><XIcon size={15} /></button></div>
        <div role="status">{routeView.status === 'loading' ? 'Finding a driving route…' : routeView.status === 'error'
          ? <>Road route unavailable. Pins are still visible. <button type="button" className="student-map-retry" onClick={() => setRouteAttempt(value => value + 1)}>Retry route</button></>
          : <><b>{routeView.distanceKm.toFixed(1)} km by road</b> · about {routeView.minutes} min driving</>}</div>
        {routeView.status === 'ready' && <small>Estimate between nearby mapped roads; not live traffic.</small>}
      </> : <span>{studentPin ? 'Select a company pin to see a road route.' : 'Set your profile pin to see road routes.'}</span>}
      <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">Routes: OSRM</a>
    </div>}
  </div>
}
