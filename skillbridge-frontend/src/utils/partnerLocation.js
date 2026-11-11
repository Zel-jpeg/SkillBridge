import { externalJson } from './externalServices.js'
import { loadAddressRows, NCR, provinceOptions } from './philippineAddresses.js'
import { validPin } from './recommendationResults.js'

const NUMBER = '[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)'
const COORDINATES = new RegExp(`^\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*$`)
const PLACE_PIN = new RegExp(`!3d(${NUMBER})!4d(${NUMBER})(?=!|$)`, 'g')

export function googleMapsPin(value) {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['www.google.com', 'google.com', 'maps.google.com'].includes(url.hostname)) return null
    const path = decodeURIComponent(url.pathname)
    if (/^\/maps\/place\//.test(path)) {
      const matches = [...path.matchAll(PLACE_PIN)]
      if (matches.length) {
        const pins = matches.map(([, lat, lng]) => validPin(lat, lng))
        return pins[0] && pins.every(pin => pin?.lat === pins[0].lat && pin?.lng === pins[0].lng) ? pins[0] : null
      }
    }
    const search = /^\/maps\/search(?:\/(.*?))?\/?$/.exec(path)
    const queryPath = /^\/maps\/?$/.test(path) || (url.hostname === 'maps.google.com' && path === '/')
    if ((!search && !queryPath) || url.searchParams.has('query_place_id')) return null
    const queries = [...url.searchParams.getAll('query'), ...url.searchParams.getAll('q')]
    if (search?.[1]) queries.push(search[1])
    if (queries.length !== 1) return null
    const match = COORDINATES.exec(queries[0])
    return match ? validPin(match[1], match[2]) : null
  } catch {
    return null
  }
}

function normalize(value, kind) {
  let name = typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ') : ''
  if (kind === 'city') name = name.replace(/^(city|municipality) of /, '').replace(/ city$/, '')
  if (kind === 'barangay') name = name.replace(/^(barangay|brgy\.?) /, '')
  return name
}

function matchingRow(rows, candidates, kind) {
  const names = new Set(candidates.map(value => normalize(value, kind)).filter(Boolean))
  const matches = rows.filter(row => names.has(normalize(row.name, kind)))
  return matches.length === 1 ? matches[0] : null
}

export async function lookupPartnerAddress(pin, signal) {
  const data = await externalJson(`https://photon.komoot.io/reverse?lat=${pin.lat}&lon=${pin.lng}&limit=1`, { signal })
  const place = data?.features?.[0]?.properties
  if (place?.countrycode !== 'PH') return null

  const provinces = provinceOptions(await loadAddressRows('provinces', '', signal), true)
  const regionNames = [place.state, place.county].map(value => normalize(value))
  const metroManila = regionNames.some(name => ['metro manila', 'national capital region', 'national capital region (ncr)', 'ncr'].includes(name))
  const province = metroManila ? NCR : matchingRow(provinces, [place.state, place.county])
  if (!province) return null

  const result = {
    provinces, cities: [], barangays: [],
    selected: { province: province.name, provinceCode: province.code, city: '', cityCode: '', barangay: '' },
  }
  async function load(kind, code) {
    try {
      result[kind] = await loadAddressRows(kind, code, signal)
    } catch (error) {
      if (signal?.aborted) throw error
      result.fetchError = { kind, code }
    }
  }
  await load('cities', province.code)
  const city = matchingRow(result.cities, [place.city, place.municipality, place.town], 'city')
  if (!city) return result
  Object.assign(result.selected, { city: city.name, cityCode: city.code })
  await load('barangays', city.code)
  const barangay = matchingRow(result.barangays, [place.district, place.locality, place.suburb], 'barangay')
  result.selected.barangay = barangay?.name ?? ''
  return result
}
