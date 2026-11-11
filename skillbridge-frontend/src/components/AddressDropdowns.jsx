// src/components/AddressDropdowns.jsx
import { useState, useEffect, useRef, useCallback, useId } from 'react'

import { loadAddressRows, provinceOptions } from '../utils/philippineAddresses'

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

export default function AddressDropdowns({ label = '', onChange, error, prioritizeDavao = false, includeNcr = false, initialSelection }) {
  const id = useId()

  const [provinces, setProvinces]   = useState(initialSelection?.provinces ?? [])
  const [cities,    setCities]      = useState(initialSelection?.cities ?? [])
  const [barangays, setBarangays]   = useState(initialSelection?.barangays ?? [])

  const [selected, setSelected] = useState(initialSelection?.selected ?? {
    provinceCode: '',
    province:     '',
    cityCode:     '',
    city:         '',
    barangay:     '',
  })

  const [loading, setLoading] = useState({
    provinces: !initialSelection,
    cities:    false,
    barangays: false,
  })

  const [fetchError, setFetchError] = useState(initialSelection?.fetchError ?? null)
  const pending = useRef({})
  const load = useCallback(async (kind, code = '') => {
    pending.current[kind]?.abort()
    const controller = new AbortController()
    pending.current[kind] = controller
    setLoading(prev => ({ ...prev, [kind]: true }))
    setFetchError(null)
    try {
      const rows = await loadAddressRows(kind, code, controller.signal)
      if (controller.signal.aborted) return
      ;({ provinces: setProvinces, cities: setCities, barangays: setBarangays })[kind](
        kind === 'provinces' ? provinceOptions(rows, includeNcr) : rows
      )
    } catch {
      if (!controller.signal.aborted) setFetchError({ kind, code })
    } finally {
      if (pending.current[kind] === controller && !controller.signal.aborted) {
        setLoading(prev => ({ ...prev, [kind]: false }))
      }
    }
  }, [includeNcr])

  useEffect(() => {
    // Synchronize external address data; cleanup cancels obsolete transports.
    if (!initialSelection) load('provinces')
    const requests = pending.current
    return () => Object.values(requests).forEach(controller => controller.abort())
  }, [load, initialSelection])

  function cancel(kind) {
    pending.current[kind]?.abort()
    setLoading(prev => ({ ...prev, [kind]: false }))
  }
  function handleProvinceChange(e) {
    const code = e.target.value
    const name = provinces.find(p => p.code === code)?.name || ''
    cancel('cities'); cancel('barangays')
    setFetchError(null)
    setSelected({ provinceCode: code, province: name, cityCode: '', city: '', barangay: '' })
    setCities([]); setBarangays([])
    onChange({ province: name, city: '', barangay: '' })
    if (code) load('cities', code)
  }
  function handleCityChange(e) {
    const code = e.target.value
    const name = cities.find(c => c.code === code)?.name || ''
    cancel('barangays')
    setFetchError(null)
    setSelected(prev => ({ ...prev, cityCode: code, city: name, barangay: '' }))
    setBarangays([])
    onChange({ province: selected.province, city: name, barangay: '' })
    if (code) load('barangays', code)
  }
  function handleBarangayChange(e) {
    const name = e.target.value
    setSelected(prev => ({ ...prev, barangay: name }))
    onChange({ province: selected.province, city: selected.city, barangay: name })
  }

  const davaoProvinces = prioritizeDavao ? provinces.filter(p => /^Davao\s/i.test(p.name)) : []
  const otherProvinces = prioritizeDavao ? provinces.filter(p => !/^Davao\s/i.test(p.name)) : provinces

  return (
    <div className="flex flex-col gap-3">
      {fetchError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <p>Could not load {fetchError.kind}. Check your connection and retry. Your other fields are retained.</p>
        <button type="button" onClick={() => load(fetchError.kind, fetchError.code)} className="mt-2 rounded border border-red-400 px-3 py-1.5 focus-visible:outline-2">Retry address data</button>
      </div>}

      {/* PROVINCE */}
      <div>
        <label htmlFor={`${id}-province`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label ? `${label} — ` : ''}Province
        </label>
        <div className="relative">
          <select
            id={`${id}-province`}
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
            {davaoProvinces.length > 0 ? <>
              <optgroup label="Davao provinces — near DNSC">
                {davaoProvinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
              </optgroup>
              <optgroup label="Other provinces">
                {otherProvinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
              </optgroup>
            </> : otherProvinces.map(p => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </div>
        {davaoProvinces.length > 0 && (
          <p className="mt-1.5 text-xs text-green-700">Davao provinces are listed first. You can still choose any province.</p>
        )}
      </div>

      {/* CITY / MUNICIPALITY */}
      <div>
        <label htmlFor={`${id}-city`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          City / Municipality
        </label>
        <div className="relative">
          <select
            id={`${id}-city`}
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
        </div>
      </div>

      {/* BARANGAY */}
      <div>
        <label htmlFor={`${id}-barangay`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Barangay
        </label>
        <div className="relative">
          <select
            id={`${id}-barangay`}
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
        </div>
      </div>

      {/* Validation error from parent */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
