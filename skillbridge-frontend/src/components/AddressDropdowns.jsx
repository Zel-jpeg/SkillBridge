// src/components/AddressDropdowns.jsx
import { useState, useEffect } from 'react'

// Official Philippine address API — no signup needed, free
const API = 'https://psgc.gitlab.io/api'

// ================================================================
// HOW TO USE THIS COMPONENT:
//
// <AddressDropdowns
//   label="Home"
//   onChange={(address) => console.log(address)}
// />
//
// The onChange gives you: { province, city, barangay }
//
// PERFORMANCE NOTES (production):
//   - Province list is cached in sessionStorage → loads instantly on revisit
//   - City list per province is cached   → no re-fetch on same province
//   - Barangay list per city is cached   → no re-fetch on same city
//   All caches clear when the browser tab is closed (sessionStorage behaviour).
// ================================================================

// ── Safe sessionStorage helpers (never crash if storage is blocked) ──
function ssGet(key) {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function ssSet(key, value) {
  try { sessionStorage.setItem(key, value) } catch { /* quota exceeded or blocked */ }
}

export default function AddressDropdowns({ label = '', onChange, error }) {

  const [provinces, setProvinces]   = useState([])
  const [cities,    setCities]      = useState([])
  const [barangays, setBarangays]   = useState([])

  const [selected, setSelected] = useState({
    provinceCode: '',
    province:     '',
    cityCode:     '',
    city:         '',
    barangay:     '',
  })

  const [loading, setLoading] = useState({
    provinces: true,
    cities:    false,
    barangays: false,
  })

  const [fetchError, setFetchError] = useState('')

  // ── Load all provinces on mount — use cache when available ──────
  useEffect(() => {
    const cached = ssGet('psgc_provinces')
    if (cached) {
      setProvinces(JSON.parse(cached))
      setLoading(prev => ({ ...prev, provinces: false }))
      return
    }

    fetch(`${API}/provinces/`)
      .then(r => {
        if (!r.ok) throw new Error('Network response was not ok')
        return r.json()
      })
      .then(data => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
        ssSet('psgc_provinces', JSON.stringify(sorted))
        setProvinces(sorted)
        setLoading(prev => ({ ...prev, provinces: false }))
      })
      .catch(() => {
        setFetchError('Could not load address data. Check your internet connection.')
        setLoading(prev => ({ ...prev, provinces: false }))
      })
  }, [])

  // ── Province change → load cities (cached per province code) ────
  function handleProvinceChange(e) {
    const code = e.target.value
    const name = provinces.find(p => p.code === code)?.name || ''

    const next = { provinceCode: code, province: name, cityCode: '', city: '', barangay: '' }
    setSelected(next)
    setCities([])
    setBarangays([])
    onChange({ province: name, city: '', barangay: '' })

    if (!code) return

    // Check cache first
    const cacheKey = `psgc_cities_${code}`
    const cached = ssGet(cacheKey)
    if (cached) {
      setCities(JSON.parse(cached))
      return  // no loading spinner needed — instant
    }

    setLoading(prev => ({ ...prev, cities: true }))
    fetch(`${API}/provinces/${code}/cities-municipalities/`)
      .then(r => {
        if (!r.ok) throw new Error('Network response was not ok')
        return r.json()
      })
      .then(data => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
        ssSet(cacheKey, JSON.stringify(sorted))
        setCities(sorted)
        setLoading(prev => ({ ...prev, cities: false }))
      })
      .catch(() => setLoading(prev => ({ ...prev, cities: false })))
  }

  // ── City change → load barangays (cached per city code) ─────────
  function handleCityChange(e) {
    const code = e.target.value
    const name = cities.find(c => c.code === code)?.name || ''

    setSelected(prev => ({ ...prev, cityCode: code, city: name, barangay: '' }))
    setBarangays([])
    onChange({ province: selected.province, city: name, barangay: '' })

    if (!code) return

    // Check cache first
    const cacheKey = `psgc_barangays_${code}`
    const cached = ssGet(cacheKey)
    if (cached) {
      setBarangays(JSON.parse(cached))
      return  // instant
    }

    setLoading(prev => ({ ...prev, barangays: true }))
    fetch(`${API}/cities-municipalities/${code}/barangays/`)
      .then(r => {
        if (!r.ok) throw new Error('Network response was not ok')
        return r.json()
      })
      .then(data => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
        ssSet(cacheKey, JSON.stringify(sorted))
        setBarangays(sorted)
        setLoading(prev => ({ ...prev, barangays: false }))
      })
      .catch(() => setLoading(prev => ({ ...prev, barangays: false })))
  }

  // ── Barangay change ──────────────────────────────────────────────
  function handleBarangayChange(e) {
    const name = e.target.value
    setSelected(prev => ({ ...prev, barangay: name }))
    onChange({ province: selected.province, city: selected.city, barangay: name })
  }

  // ── Full API failure ─────────────────────────────────────────────
  if (fetchError) {
    return (
      <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
        {fetchError}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">

      {/* PROVINCE */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label ? `${label} — ` : ''}Province
        </label>
        <div className="relative">
          <select
            value={selected.provinceCode}
            onChange={handleProvinceChange}
            disabled={loading.provinces}
            className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 text-sm
              outline-none focus:border-green-500 transition-colors appearance-none bg-white
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-wait"
          >
            <option value="">
              {loading.provinces ? 'Loading provinces…' : 'Select province'}
            </option>
            {provinces.map(p => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
          <Chevron />
        </div>
      </div>

      {/* CITY / MUNICIPALITY */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          City / Municipality
        </label>
        <div className="relative">
          <select
            value={selected.cityCode}
            onChange={handleCityChange}
            disabled={!selected.provinceCode || loading.cities}
            className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 text-sm
              outline-none focus:border-green-500 transition-colors appearance-none bg-white
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <option value="">
              {loading.cities
                ? 'Loading cities…'
                : !selected.provinceCode
                  ? 'Select a province first'
                  : 'Select city or municipality'}
            </option>
            {cities.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <Chevron />
        </div>
      </div>

      {/* BARANGAY */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Barangay
        </label>
        <div className="relative">
          <select
            value={selected.barangay}
            onChange={handleBarangayChange}
            disabled={!selected.cityCode || loading.barangays}
            className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 text-sm
              outline-none focus:border-green-500 transition-colors appearance-none bg-white
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <option value="">
              {loading.barangays
                ? 'Loading barangays…'
                : !selected.cityCode
                  ? 'Select a city first'
                  : 'Select barangay'}
            </option>
            {barangays.map(b => (
              <option key={b.code} value={b.name}>{b.name}</option>
            ))}
          </select>
          <Chevron />
        </div>
      </div>

      {/* Validation error from parent */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// Small down arrow icon for the selects
function Chevron() {
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}