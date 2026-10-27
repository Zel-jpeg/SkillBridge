import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddressDropdowns from '../AddressDropdowns'
import Avatar from '../Avatar'
import DataSection from '../DataSection'
import './studentProfile.css'

const stayingOptions = [
  { value: 'boarding', label: 'Boarding / rented room' },
  { value: 'home', label: 'Family home · commuting' },
  { value: 'open', label: 'No fixed preference' },
]

export default function StudentProfileForm({ student, fields, errors, travelOptions, travelWilling, onTravelChange,
  stayingAt, onStayingChange, homeAddress, boardingAddress, onHomeChange, onBoardingChange,
  hasBoardingAddress, mapView, onMapViewChange, mapLabel, mapCenter, geocoding, pinned, onRemovePin, map,
  saving, saved, saveError, onSave }) {
  const navigate = useNavigate()
  const [editingHome, setEditingHome] = useState(false)
  const homeOpen = editingHome || Boolean(errors.homeAddress) || stayingAt !== 'boarding'
  const homeFields = <AddressDropdowns prioritizeDavao onChange={address => { setEditingHome(true); onHomeChange(address) }} error={errors.homeAddress} />

  return <section className="student-profile">
    <button type="button" onClick={() => navigate('/student/dashboard')} className="profile-back">← Dashboard</button>
    <header><h1>My profile</h1><p className="profile-muted mt-1">Keep your contact details and OJT location up to date.</p></header>
    <DataSection url="/api/students/me/" layout="profile" label="Loading your profile">
      <div className="profile-panel profile-identity">
        <Avatar name={student.name} photoUrl={student.photoUrl} tone="neutral" className="h-14 w-14 rounded-full text-lg" />
        <div className="min-w-0"><p className="break-words font-semibold">{student.loading ? 'Loading profile…' : student.name}</p><p className="profile-muted mt-1 break-words">{student.course} · {student.schoolId}</p><p className="profile-muted mt-1">Photo from your DNSC Google account</p></div>
      </div>

      <div className="profile-top-grid">
        <section className="profile-panel" aria-labelledby="profile-details-title">
          <h2 id="profile-details-title">Personal details</h2><p className="profile-muted mt-1">Update your student and contact information.</p>
          <div className="profile-fields">{fields.map(field => <div key={field.key}>
            <label htmlFor={`profile-${field.key}`}>{field.label}</label>
            <input id={`profile-${field.key}`} type={field.type || 'text'} inputMode={field.inputMode} maxLength={field.maxLength}
              value={field.value} placeholder={field.placeholder} onChange={event => field.onChange(event.target.value)}
              aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `profile-${field.key}-error` : undefined} />
            {errors[field.key] && <p id={`profile-${field.key}-error`} className="profile-error">{errors[field.key]}</p>}
          </div>)}</div>
        </section>

        <section className="profile-panel" aria-labelledby="profile-travel-title">
          <h2 id="profile-travel-title">Travel preference</h2><p className="profile-muted mt-1">Where are you willing to travel for OJT?</p>
          <div role="group" aria-label="Travel preference" className="profile-travel-options">{travelOptions.map(option => <button type="button" key={option.value} aria-pressed={travelWilling === option.value} onClick={() => onTravelChange(option.value)} className="profile-option">{option.label}</button>)}</div>
          {errors.travelWilling && <p className="profile-error">{errors.travelWilling}</p>}
        </section>
      </div>

      <section className="profile-panel" aria-labelledby="profile-location-title">
        <h2 id="profile-location-title">OJT location</h2><p className="profile-muted mt-1">Where will you stay during OJT?</p>
        <div role="group" aria-label="Where you will stay during OJT" className="profile-staying-options">{stayingOptions.map(option => <button type="button" key={option.value} aria-pressed={stayingAt === option.value} onClick={() => onStayingChange(option.value)} className="profile-option">{option.label}</button>)}</div>
        {errors.stayingAt && <p className="profile-error">{errors.stayingAt}</p>}

        <div className="profile-location-grid">
          <div className="profile-addresses">
            {stayingAt === 'boarding' && <section aria-labelledby="profile-boarding-title">
              <h3 id="profile-boarding-title">Boarding address</h3><p className="profile-muted mt-1">Where you will stay during OJT.</p><p className="profile-address-summary">Current: {boardingAddress}</p>
              <AddressDropdowns prioritizeDavao onChange={onBoardingChange} error={errors.boardingAddress} />
            </section>}
            <section className={stayingAt === 'boarding' ? 'profile-home-disclosure' : ''} aria-label="Permanent home address">
              {stayingAt === 'boarding' ? <>
                <button type="button" className="profile-home-toggle" aria-expanded={homeOpen} aria-controls="profile-home-fields" onClick={() => setEditingHome(value => !value)}>
                  <span aria-hidden="true" className={`profile-chevron ${homeOpen ? 'is-open' : ''}`}>›</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold">Permanent home address</span><span className="profile-muted mt-1 block break-words">{homeAddress}</span></span><span className="profile-edit-label">{homeOpen ? 'Close' : 'Edit'}</span>
                </button>
                <div id="profile-home-fields" hidden={!homeOpen} className="profile-home-fields">{homeFields}</div>
              </> : <>
                <h3>Permanent home address</h3><p className="profile-address-summary">Current: {homeAddress}</p>{homeFields}
              </>}
            </section>
          </div>

          <section className="profile-map-section" aria-labelledby="profile-pin-title">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="profile-pin-title">Your location pin</h3>{pinned && <button type="button" onClick={onRemovePin} className="profile-remove-pin">Remove pin</button>}</div>
            <p className="profile-muted mt-1">Place the pin where you will stay during OJT.</p>
            {hasBoardingAddress && <div className="mt-3"><p className="mb-1 font-medium">Map view</p><div role="group" aria-label="Map view" className="profile-map-view">
              <button type="button" className="profile-option" aria-pressed={mapView === 'primary'} onClick={() => onMapViewChange('primary')}>Boarding address</button>
              <button type="button" className="profile-option" aria-pressed={mapView === 'home'} onClick={() => onMapViewChange('home')}>Permanent home</button>
            </div></div>}
            <p className="profile-map-status" role="status">{geocoding ? `Locating ${mapLabel}…` : mapCenter?.approximate ? 'Address lookup unavailable; showing default Panabo view. Your pin is unchanged.' : `Centered on ${mapLabel}`}</p>
            {map}
            <p className="profile-map-status">{pinned ? `Pinned · ${pinned.lat.toFixed(5)}, ${pinned.lng.toFixed(5)}` : 'No pin set — tap the map above to place one.'}</p>
            <div className="profile-pin-help"><p>{hasBoardingAddress ? 'Both addresses are saved. Only one pin is used for company distances.' : 'Your saved pin is used to calculate company distances.'}</p><p className="mt-1">{hasBoardingAddress ? 'Map view only changes the area shown. ' : ''}Tap the map or drag the pin to move it.</p></div>
          </section>
        </div>
      </section>

      <p className="profile-muted">Result notification emails are not available. View your latest results on the Results page.</p>
      <div className="profile-save-bar">
        <div className="min-w-0"><p className="profile-muted">Changes apply after you save.</p>
          {saveError && <p role="alert" className="profile-error">{saveError}</p>}
          {!saveError && saved && <p role="status" className="profile-save-success">Profile saved successfully</p>}
        </div>
        <button type="button" onClick={onSave} disabled={saving} className="profile-save-button">{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </DataSection>
  </section>
}
