import { lazy, Suspense, useRef, useState } from 'react'
import CompanyEditDialog from './CompanyEditDialog'
import CompanyImageInput from './CompanyImageInput'
import AddressDropdowns from './AddressDropdowns'
import ConfirmModal from './admin/ConfirmModal'

const PinMap = lazy(() => import('../pages/admin/AdminCompanies').then(module => ({ default: module.PinMap })))
const field = 'min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs dark:border-gray-700 dark:bg-gray-900'
const button = 'min-h-11 rounded-xl border border-gray-300 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700'

export default function CoordinatorPartnerForm({ initial, program, onSave, onClose, saveBlocked, recovery }) {
  const [name, setName] = useState(initial?.name || '')
  const [address, setAddress] = useState(initial?.address || {})
  const [changeAddress, setChangeAddress] = useState(!initial)
  const [lat, setLat] = useState(initial?.lat ?? '')
  const [lng, setLng] = useState(initial?.lng ?? '')
  const [image, setImage] = useState({ action: 'unchanged', file: null, error: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState(false)
  const pending = useRef(false)
  const original = useRef(JSON.stringify({ name, address, lat, lng }))
  const dirty = image.action !== 'unchanged' || JSON.stringify({ name, address, lat, lng }) !== original.current
  const coordinate = lat !== '' && lng !== '' ? { lat: Number(lat), lng: Number(lng) } : null
  const pin = coordinate && Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng)
    && Math.abs(coordinate.lat) <= 90 && Math.abs(coordinate.lng) <= 180 ? coordinate : null
  function close() {
    if (pending.current) return
    if (dirty) setDiscard(true)
    else onClose()
  }
  async function save() {
    if (pending.current || saveBlocked) return
    if (!name.trim() || name.trim().length > 255) { setError('Enter an organization name with at most 255 characters.'); return }
    if ((lat !== '' || lng !== '') && !pin) { setError('Provide both valid latitude and longitude, or clear both.'); return }
    if (image.error) { setError(image.error); return }
    pending.current = true
    setSaving(true)
    setError('')
    try {
      const result = await onSave({ name: name.trim(), address: Object.values(address).some(Boolean) ? address : null,
        lat: pin?.lat ?? null, lng: pin?.lng ?? null }, image)
      if (result.ok) onClose()
      else setError(result.message)
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  const addressText = ['street', 'barangay', 'city', 'province'].map(key => address[key]).filter(Boolean).join(', ')
  return <>
    <CompanyEditDialog title={initial ? 'Edit Partner' : 'Add Partner'}
      description={'Manage the partner for ' + program.name + '.'} saving={saving} saveError={error}
      invalid={saveBlocked || Boolean(image.error)} onSave={save} onClose={close}
      saveLabel={initial ? 'Save Changes' : 'Create partner'}
      details={<div className="space-y-5 [&_input]:text-xs [&_p]:text-xs">
        {recovery}
        <p className="text-xs text-gray-500">Instructor / OJT coordinator · {program.institute_code} · {program.code}</p>
        <label className="block space-y-2 text-xs font-semibold">Organization name
          <input aria-label="Organization name" className={field} maxLength={255} value={name} onChange={event => setName(event.target.value)} />
        </label>
        <CompanyImageInput name={name} imageUrl={initial?.image_url} value={image} onChange={setImage} disabled={saving} />
        <label className="block space-y-2 text-xs font-semibold">Street / Building / Unit
          <input aria-label="Street / Building / Unit" className={field} maxLength={255} value={address.street || ''}
            onChange={event => setAddress(previous => ({ ...previous, street: event.target.value }))} />
        </label>
        <p className="text-xs leading-6 text-gray-500">Other coordinators in this program can reuse this partner. Administrators manage common details when several programs share the organization.</p>
      </div>}
      location={<div className="space-y-4 [&_select]:text-xs [&_p]:text-xs">
        <p className="break-words text-xs text-gray-600 dark:text-gray-300">{addressText || 'Address is optional. You can add it later.'}</p>
        {initial && <button type="button" className={button} onClick={() => {
          if (changeAddress) setAddress(previous => ({ ...(initial.address || {}), street: previous.street }))
          setChangeAddress(value => !value)
        }}>
          {changeAddress ? 'Keep current address' : 'Change address'}
        </button>}
        {changeAddress && <AddressDropdowns onChange={parts => setAddress(previous => ({ ...previous, ...parts }))} />}
        <Suspense fallback={<p role="status">Loading partner map…</p>}>
          <PinMap center={pin} pinned={pin} onPin={value => { setLat(value.lat); setLng(value.lng) }} height={230} />
        </Suspense>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2 text-xs font-semibold">Latitude
            <input aria-label="Latitude" type="number" step="any" min={-90} max={90} className={field} value={lat} onChange={event => setLat(event.target.value)} />
          </label>
          <label className="block space-y-2 text-xs font-semibold">Longitude
            <input aria-label="Longitude" type="number" step="any" min={-180} max={180} className={field} value={lng} onChange={event => setLng(event.target.value)} />
          </label>
        </div>
        <button type="button" className={button} onClick={() => { setLat(''); setLng('') }}>Clear pin</button>
      </div>} />
    {discard && <ConfirmModal title="Discard partner changes?" message="Your unsaved partner changes will be discarded."
      confirmLabel="Discard changes" onCancel={() => setDiscard(false)} onConfirm={onClose} />}
  </>
}
