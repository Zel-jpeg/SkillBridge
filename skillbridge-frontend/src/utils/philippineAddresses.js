import { externalJson } from './externalServices.js'

const API = 'https://psgc.gitlab.io/api'
export const NCR = { code: '130000000', name: 'Metro Manila (NCR)' }

function ssGet(key) {
  try { return addressRows(JSON.parse(sessionStorage.getItem(key))) } catch { return null }
}
function ssSet(key, value) {
  try { sessionStorage.setItem(key, value) } catch { /* quota exceeded or blocked */ }
}

function addressRows(value) {
  if (!Array.isArray(value) || value.some(row => !row || typeof row.name !== 'string' || !row.name.trim() ||
    !['string', 'number'].includes(typeof row.code))) throw new Error('Invalid address data')
  return value.map(row => ({ ...row, code: String(row.code) }))
}

export async function loadAddressRows(kind, code = '', signal) {
  const key = kind === 'provinces' ? 'psgc_provinces' : `psgc_${kind}_${code}`
  const parent = code === NCR.code ? 'regions' : 'provinces'
  const encoded = encodeURIComponent(code)
  const url = kind === 'provinces' ? `${API}/provinces/` : kind === 'cities'
    ? `${API}/${parent}/${encoded}/cities-municipalities/`
    : `${API}/cities-municipalities/${encoded}/barangays/`
  const cached = ssGet(key)
  const rows = cached ?? addressRows(await externalJson(url, { signal }))
  rows.sort((a, b) => a.name.localeCompare(b.name))
  ssSet(key, JSON.stringify(rows))
  return rows
}

export function provinceOptions(rows, includeNcr) {
  return includeNcr ? [...rows.filter(row => row.code !== NCR.code), NCR]
    .sort((a, b) => a.name.localeCompare(b.name)) : rows
}
