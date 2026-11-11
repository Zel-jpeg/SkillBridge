import { useToast } from '../../context/ToastContext'
import { requestErrorMessage } from '../../api/requestErrors'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import api from '../../api/axios'
import { invalidateCache, useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import ConfirmModal from '../admin/ConfirmModal'
import { GridIcon, ListIcon, XIcon } from '../Icons'
import { confirmationText, downloadStudentTemplate, editReviewRow, parseStudentFile, resultText, statusLabel } from '../../utils/studentEnrollmentImport'
import { nameFromEmail } from '../../utils/formatters'

const columns = [['school_id', 'Student ID'], ['first_name', 'First name'], ['last_name', 'Last name'],
  ['name', 'Display name'], ['course', 'Program'], ['year_level', 'Year level'], ['email', 'Email']]
const emptyStudent = { school_id: '', name: '', first_name: '', last_name: '', email: '', course: '', year_level: '' }
const counts = { total: 'Total parsed', ready: 'Ready to enroll', existing_students: 'Existing students',
  already_enrolled: 'Already enrolled', unsupported: 'Unsupported', duplicate: 'Duplicate', invalid: 'Invalid', conflict: 'Conflict' }
const PAGE_SIZE = 25
const dnscEmail = /^[^@\s]+@dnsc\.edu\.ph$/i

function ManualStudentReview({ row, batch, result }) {
  if (!row) return null
  const details = [
    ['DNSC email', row.email], ['Student ID', row.school_id],
    ['Target batch', batch?.name], ['Program', row.course],
  ]
  return <section aria-label="Student review" className="enrollment-student-review">
    <div className="enrollment-student-heading">
      <h3>{row.name || 'Name missing'}</h3>
      <span className={`enrollment-status status-${row.status}`}>{row.status === 'ready' ? 'Ready to enroll' : statusLabel(row.status)}</span>
    </div>
    <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
    {row.existing_student && !result && row.status === 'existing_student' && <p>The existing account will be used.</p>}
    {row.issues?.length > 0 && <ul className="enrollment-student-issues">{row.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
  </section>
}

export default function StudentEnrollmentModal({ batchId, onClose, onEnrolled, requireConfirmation = false, initialStudent = null }) {
  const dialog = useRef(null)
  const reviewDialog = useRef(null)
  const fileRef = useRef(null)
  const manualHeading = useRef(null)
  const manualEmailInput = useRef(null)
  const manualFormId = useId()
  const { data: batchesData } = useApi('/api/instructor/batches/')
  const batches = Array.isArray(batchesData) ? batchesData.filter(batch => batch.status === 'active') : []
  const [target, setTarget] = useState(String(batchId ?? ''))
  const [rows, setRows] = useState([])
  const [review, setReview] = useState(null)
  const [result, setResult] = useState(null)
  const [emailMode, setEmailMode] = useState('now')
  const [busy, setBusy] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [tab, setTab] = useState(initialStudent ? 'manual' : 'excel')
  const [manual, setManual] = useState(() => initialStudent ? { ...emptyStudent, ...initialStudent, school_id: initialStudent.school_id || initialStudent.studentId || '' } : emptyStudent)
  const [manualErrors, setManualErrors] = useState({})
  const [manualReview, setManualReview] = useState(false)
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('list')
  const [editingIndex, setEditingIndex] = useState(null)
  const [dirty, setDirty] = useState(false)
  const { showToast } = useToast()
  const [page, setPage] = useState(0)
  const [verified, setVerified] = useState(false)
  const [spreadsheetReview, setSpreadsheetReview] = useState(false)
  const [fileRows, setFileRows] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const enrollmentPending = useRef(false)
  const submission = useRef(null)
  const [uncertain, setUncertain] = useState(false)
  const locked = busy || uncertain

  useEffect(() => {
    dialog.current.showModal()
  }, [])
  useEffect(() => {
    if (manualReview) manualHeading.current?.focus()
  }, [manualReview, result])

  const selectedBatch = batches.find(b => String(b.id) === target)
  const manualCourse = initialStudent ? manual.course : selectedBatch?.program?.code || manual.course
  const visible = useMemo(() => rows.map((row, index) => ({ row, index })).filter(({ row }) =>
    filter === 'all' || (filter === 'needs_review' ? ['invalid', 'duplicate', 'conflict'].includes(row.status)
      : filter === 'ready' ? ['ready', 'existing_student'].includes(row.status) : row.status === filter)), [rows, filter])

  function invalidateReview() { setReview(null); setVerified(false); setDirty(false); submission.current = null; setUncertain(false) }


  function openSpreadsheetReview() {
    dialog.current.close()
    reviewDialog.current.showModal()
    setFileRows(true)
    setSpreadsheetReview(true)
  }

  function backToUpload() {
    reviewDialog.current.close()
    dialog.current.showModal()
    setSpreadsheetReview(false)
  }

  async function preview(nextRows = rows, { preserveVerification = false, successMessage = '' } = {}) {
    if (uncertain) return false
    submission.current = null
    setBusy(true); setError('')
    if (!preserveVerification) setVerified(false)
    try {
      const { data } = await api.post(`/api/instructor/batches/${target}/enroll/preview/`, { students: nextRows })
      setRows(data.rows); setReview(data); setResult(null); setPage(0); setEditingIndex(null); setDirty(false)
      if (successMessage) showToast(successMessage)
      return true
    } catch (err) { const message = requestErrorMessage(err); setError(message); showToast(message, 'error') }
    finally { setBusy(false) }
    return false
  }

  function editManual(field, value) {
    setManual(current => {
      if (field === 'name') return { ...current, name: value, name_edited: true }
      if (field !== 'email' || current.name_edited) return { ...current, [field]: value }
      const email = value.trim()
      const parts = email.split('@')[0].split('.')
      const suggested = dnscEmail.test(email) && parts.length > 1 && parts.every(part => /\p{L}/u.test(part))
        ? nameFromEmail(email) : ''
      return { ...current, email: value, name: suggested }
    })
    setManualErrors(current => ({ ...current, [field]: '', ...(field === 'email' ? { name: '' } : {}) }))
  }

  async function previewManual(event) {
    event.preventDefault()
    if (locked || !selectedBatch) return
    const email = manual.email.trim()
    const name = manual.name.trim()
    const schoolId = manual.school_id.trim()
    const next = {}
    if (!dnscEmail.test(email) || email.length > 254) next.email = 'Enter a valid @dnsc.edu.ph email.'
    if (!name || name.length > 255) next.name = 'Enter the student’s full name (up to 255 characters).'
    if (!/^\d{4}-\d{5}$/.test(schoolId)) next.school_id = 'Enter a Student ID in YYYY-NNNNN format.'
    if (!manualCourse) next.course = 'Choose the student’s program.'
    setManualErrors(next)
    if (Object.keys(next).length) {
      event.currentTarget.querySelector(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }
    if (await preview([{ ...manual, email, name, school_id: schoolId, course: manualCourse, source_row: 1, worksheet: 'Manual' }])) {
      setManualReview(true)
    }
  }

  function backToManual() {
    invalidateReview()
    setManualReview(false)
    setRows([])
    setError('')
    requestAnimationFrame(() => manualEmailInput.current?.focus())
  }

  async function readFile(file) {
    if (!file || locked || !selectedBatch || result) return
    setBusy(true); setError(''); setRows([]); setFileRows(false); invalidateReview(); setNote('')
    try {
      const parsed = await parseStudentFile(file)
      setNote(`${file.name}${parsed.ignoredSheets.length ? ` — ignored sheets without recognized headers: ${parsed.ignoredSheets.join(', ')}` : ''}`)
      setFilter('all')
      if (await preview(parsed.students)) openSpreadsheetReview()
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  async function confirm() {
    if ((!submission.current && (!review || !verified || dirty)) || busy || enrollmentPending.current) return
    submission.current ||= { target, students: structuredClone(rows), review_token: review.review_token,
      email_mode: emailMode, request_id: crypto.randomUUID() }
    enrollmentPending.current = true
    setEnrolling(true)
    setBusy(true); setError('')
    try {
      const { target: submittedBatch, ...payload } = submission.current
      const { data } = await api.post(`/api/instructor/batches/${submittedBatch}/enroll/`, payload)
      setUncertain(false); submission.current = null
      setResult(data); setRows(data.rows); setReview(null); setFilter('all'); setPage(0)
      invalidateCache('/api/admin/users/')
      invalidateCache('/api/instructor/batches/')
      invalidateCache(`/api/instructor/batches/${target}/students/`)
      invalidateCache(`/api/instructor/batches/${target}/unenrolled/`)
      invalidateCache(`/api/instructor/batches/${target}/email-progress/`)
      invalidateCache(`/api/instructor/batches/${target}/emails/`)
      invalidateCache('/api/management/analytics/')
      const enrolled = data.summary?.enrolled ?? 0
      showToast(`Enrollment completed: ${enrolled} ${enrolled === 1 ? 'student' : 'students'} enrolled.`)
      onEnrolled?.(data)
      setConfirming(false)
    } catch (err) {
      const status = err.response?.status
      const unknown = !status || status >= 500 || err.code === 'ERR_BAD_RESPONSE'
      if (unknown) setUncertain(true)
      else invalidateReview()
      const message = requestErrorMessage(err, { mutation: true })
      setError(message)
      showToast(message, 'error')
      setConfirming(false)
    } finally { enrollmentPending.current = false; setEnrolling(false); setBusy(false) }
  }

  function reviewConfirmation() {
    if (uncertain) { confirm(); return }
    if (!review || !verified || dirty || busy || enrollmentPending.current) return
    if (requireConfirmation) setConfirming(true)
    else confirm()
  }

  function edit(index, field, value) {
    setRows(current => current.map((row, i) => i === index ? editReviewRow(row, field, value) : row))
    setDirty(true)
  }

  async function finishEditing() {
    if (!dirty) {
      setEditingIndex(null)
      return
    }
    await preview(rows, { preserveVerification: true, successMessage: 'Student details updated successfully.' })
  }

  function removeRow(index) {
    setRows(current => current.filter((_, i) => i !== index))
    setDirty(true)
    setPage(0)
    setEditingIndex(null)
  }

  const nameHint = !initialStudent && manual.name && !manual.name_edited && 'Suggested from email. Check spelling before continuing.'
  const manualFields = [
    ['email', 'DNSC Email', 'email', 'e.g. santos.mia@dnsc.edu.ph', 254],
    ['name', 'Full Name', 'text', 'e.g. Mia Santos', 255],
    ['school_id', 'Student ID', 'text', 'e.g. 2026-00421', 10],
  ]
  const manualConfirmLabel = initialStudent ? 'Re-enroll student' : 'Enroll student'

  const reviewContent = rows.length > 0 && <section aria-label="Student review" className="enrollment-review">
        {!spreadsheetReview && <h3>{result ? 'Enrollment results' : 'Review students'}</h3>}
        {!result && <p className="enrollment-warning">Generated emails are predictions. Verify each address belongs to the intended student before confirming.</p>}
        {!result && <label className="enrollment-field">Enrollment emails<select aria-label="Enrollment email timing" value={emailMode} disabled={locked} onChange={event => setEmailMode(event.target.value)}><option value="now">Send now (background queue)</option><option value="later">Send later (hold until staff releases)</option></select></label>}
        {uncertain && <p role="status" className="enrollment-warning">The enrollment result could not be confirmed. Choose Check enrollment result to recover the same saved request before changing students or email timing.</p>}
        {(review || result) && <div className="enrollment-counts" aria-label="Import counts">
          {Object.entries(counts).map(([key, label]) => <span key={key}><strong>{(review || result).summary[key]}</strong> {label}</span>)}
        </div>}
        {dirty && !result && <p role="status" className="enrollment-caption">Changes need validation. Select Done on the edited row or Apply changes below.</p>}
        <div className="enrollment-review-toolbar">
          <label className="enrollment-field enrollment-filter">Show rows
            <select value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }}>
              <option value="all">All rows</option><option value="needs_review">Needs review</option>
              {['ready', 'existing_student', 'already_enrolled', 'unsupported', 'duplicate', 'invalid', 'conflict'].map(status =>
                <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </label>
          <div className="enrollment-view-toggle" aria-label="Review view">
            {[{ value: 'cards', label: 'Show cards', Icon: GridIcon }, { value: 'list', label: 'Show list', Icon: ListIcon }].map(option =>
              <button type="button" key={option.value} aria-label={option.label} title={option.label}
                aria-pressed={view === option.value} onClick={() => { setView(option.value); setEditingIndex(null) }}>
                <option.Icon size={15} />
              </button>)}
          </div>
        </div>
        <div className={`enrollment-record-list view-${view}`} role="list" aria-label="Student review records">
          {visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(({ row, index }) => <article
            className={`enrollment-record ${editingIndex === index ? 'is-editing' : ''}`} role="listitem" key={`${row.worksheet || 'file'}-${row.source_row}-${index}`}
            title={row.worksheet ? `Worksheet: ${row.worksheet}` : undefined}>
            <div className="enrollment-list-summary">
              <strong>Row {row.source_row}</strong>
              <div className="enrollment-list-identity"><strong>{row.name || 'Name missing'}</strong><span>{row.school_id || 'Student ID missing'}</span></div>
              <span>{row.course || '—'}{row.year_level ? ` · Year ${row.year_level}` : ''}</span>
              <span className="enrollment-list-email" title={row.email || undefined}>{row.email || 'Email missing'}</span>
              <span className={`enrollment-status status-${row.status}`}>{statusLabel(row.status)}</span>
              <button type="button" className="enrollment-button" aria-expanded={editingIndex === index} disabled={locked || (Boolean(initialStudent) && !result)}
                onClick={() => editingIndex === index && !result ? finishEditing() : setEditingIndex(current => current === index ? null : index)}>
                {editingIndex === index ? (result ? 'Hide' : busy ? 'Saving…' : 'Done') : result ? 'Details' : 'Edit'}
              </button>
              {!result && <button type="button" className="enrollment-button enrollment-button-danger" disabled={locked}
                aria-label={`Remove row ${row.source_row}`} onClick={() => removeRow(index)}>Remove</button>}
            </div>
            <div className="enrollment-record-header">
              <div><strong>Row {row.source_row}</strong><span>{row.school_id || 'Student ID missing'}</span></div>
              <span className={`enrollment-status status-${row.status}`}>{statusLabel(row.status)}</span>
              {!result && <button type="button" className="enrollment-button enrollment-button-danger" disabled={locked}
                aria-label={`Remove row ${row.source_row}`} onClick={() => removeRow(index)}>Remove</button>}
            </div>
            <div className="enrollment-record-grid">
              {columns.map(([field, label]) => <label className={`enrollment-record-field field-${field.replace('_', '-')} ${['name', 'email'].includes(field) ? 'enrollment-record-field-wide' : ''}`} key={field}>
                <span>{label}</span>
                {result ? <output>{row[field] || '—'}</output> : <input aria-label={`${label} row ${row.source_row}`}
                  value={row[field] || ''} disabled={locked} onChange={e => edit(index, field, e.target.value)} />}
              </label>)}
            </div>
            <div className="enrollment-record-meta">
              <span>Email source: <strong>{row.email_source || '—'}</strong></span>
              {row.issues?.length > 0 && <p>{row.issues.join(' ')}</p>}
              {result?.rows && row.notification_status && <p>Notification: {row.notification_status.replaceAll('_', ' ')}</p>}
            </div>
          </article>)}
        </div>
        <div className="enrollment-pagination"><span>{visible.length} matching rows</span>{visible.length > PAGE_SIZE && <nav aria-label="Student review pages">
          <button type="button" className="enrollment-button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span>Page {page + 1}</span>
          <button type="button" className="enrollment-button" disabled={(page + 1) * PAGE_SIZE >= visible.length} onClick={() => setPage(p => p + 1)}>Next</button>
        </nav>}</div>
      </section>

  return <><dialog ref={dialog} className={`enrollment-dialog${tab === 'manual' ? ' enrollment-manual-dialog' : ''}`} aria-labelledby="enrollment-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="enrollment-header">
      <div>
        <h2 ref={manualHeading} tabIndex={-1} id="enrollment-title">{manualReview ? (result ? 'Enrollment result' : 'Review student') : 'Enroll students'}</h2>
        {tab === 'excel' && <p>Upload a spreadsheet or add manually</p>}
      </div>
      <button type="button" aria-label="Close enrollment" disabled={busy} onClick={onClose} className="enrollment-close"><XIcon size={16} /></button>
    </header>

    {!manualReview && !result && !initialStudent && <div className="enrollment-tabs" aria-label="Enrollment method">
      {[{ key: 'excel', label: 'Upload Excel / CSV' }, { key: 'manual', label: 'Manual entry' }].map(item =>
        <button type="button" key={item.key} disabled={locked} aria-pressed={tab === item.key} onClick={() => {
          setTab(item.key); setRows([]); setFileRows(false); setReview(null); setVerified(false); setError(''); setNote('')
        }}>{item.label}</button>)}
    </div>}

    <div className="enrollment-content" key={manualReview ? 'manual-review' : 'entry'}>
      {manualReview ? <>
        {error && <p role="alert" className="enrollment-error">{error}</p>}
        <ManualStudentReview row={rows[0]} batch={selectedBatch} result={result} />
        {uncertain && <p role="status" className="enrollment-warning">Choose Check enrollment result to recover the same saved request.</p>}
        {!result && Boolean(review?.summary.ready) && <>
          <label className="enrollment-field">Enrollment email
            <select aria-label="Enrollment email timing" value={emailMode} disabled={locked} onChange={event => setEmailMode(event.target.value)}>
              <option value="now">Send now</option><option value="later">Send later</option>
            </select>
          </label>
          <label className="enrollment-verify"><input type="checkbox" checked={verified} disabled={locked} onChange={event => setVerified(event.target.checked)} />I verified the name, Student ID, and DNSC email.</label>
        </>}
      </> : <>
      <label className="enrollment-field">Target batch
<DataSection url="/api/instructor/batches/" layout="control" count={1}>        <select value={target} disabled={locked || !!result || !!batchId} onChange={e => {
          setTarget(e.target.value); setRows([]); setFileRows(false); setNote(''); invalidateReview()
        }}>
          <option value="">Select an active batch</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name} — {b.instructor_name || 'Instructor unassigned'}</option>)}
        </select></DataSection>
      </label>
      {selectedBatch && (tab === 'excel' || !batchId) && <p className="enrollment-caption">Assigned instructor: {selectedBatch.instructor_name || 'Unassigned'}{selectedBatch.program && ` · ${selectedBatch.program.institute_code} / ${selectedBatch.program.code}`}</p>}
      {error && <p role="alert" className="enrollment-error">{error}</p>}

      {!result && (tab === 'excel' ? <>
        <div className="enrollment-template-card">
          <div><strong>Need a template?</strong><p>Student Number, Last Name, First Name, Program, YearLevel</p></div>
          <button type="button" className="enrollment-button enrollment-button-blue" disabled={locked} onClick={() => downloadStudentTemplate()}>Download enrollment template</button>
        </div>
        <div className="enrollment-drop" role="button" tabIndex={0} aria-label="Choose or drop a student list"
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); readFile(e.dataTransfer.files[0]) }}
          onClick={() => fileRef.current?.click()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p>{note.split(' — ')[0] || 'Drop your .xlsx or .csv here'}</p><small>or tap to browse</small>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" disabled={locked || !selectedBatch} aria-label="Student list file"
            onChange={e => { readFile(e.target.files[0]); e.target.value = '' }} />
        </div>
        <p className="enrollment-caption">XLSX, XLS or CSV · Maximum 5 MB and 1,000 records. IAMS headers may appear within the first 50 rows.</p>
      </> : <form id={manualFormId} className="enrollment-manual" noValidate onSubmit={previewManual}>
        {manualFields.map(([field, label, type, placeholder, maxLength]) => {
          const id = `${manualFormId}-${field}`
          const hint = field === 'name' ? nameHint : ''
          const invalid = manualErrors[field]
          return <div className="enrollment-field" key={field}>
            <label htmlFor={id}>{label}</label>
            <input id={id} name={field} ref={field === 'email' ? manualEmailInput : undefined} type={type} value={manual[field]}
              readOnly={Boolean(initialStudent)} disabled={locked} required placeholder={placeholder} maxLength={maxLength}
              aria-invalid={Boolean(invalid)} aria-describedby={[hint && `${id}-hint`, invalid && `${id}-error`].filter(Boolean).join(' ') || undefined}
              onChange={event => editManual(field, event.target.value)} />
            {hint && <p id={`${id}-hint`} className="enrollment-manual-hint">{hint}</p>}
            {invalid && <p id={`${id}-error`} className="enrollment-manual-field-error" role="alert">{invalid}</p>}
          </div>
        })}
        {(selectedBatch?.program || initialStudent) ? <dl className="enrollment-manual-program"><dt>Program</dt><dd>{manualCourse || '—'}</dd></dl>
          : selectedBatch && <fieldset className="enrollment-field" aria-describedby={manualErrors.course ? `${manualFormId}-course-error` : undefined}>
            <legend>Program</legend>
            <div className="enrollment-manual-program">
              {['BSIT', 'BSIS'].map(course => <button type="button" className="enrollment-button enrollment-program-choice" name="course" key={course}
                disabled={locked} aria-pressed={manualCourse === course} onClick={() => editManual('course', course)}>{course}</button>)}
            </div>
            {manualErrors.course && <p id={`${manualFormId}-course-error`} className="enrollment-manual-field-error" role="alert">{manualErrors.course}</p>}
          </fieldset>}
      </form>)}

      {note.includes(' — ') && <p className="enrollment-caption">{note.split(' — ')[1]}</p>}
      </>}
    </div>

    {tab === 'manual' ? <footer className="enrollment-footer">
      {result ? <><p role="status">{resultText(result.summary)} Queued does not mean delivered. View saved delivery status in Enrollment emails.</p>
        <div className="enrollment-manual-actions"><button type="button" className="enrollment-button" onClick={onClose}>Done</button></div></> :
        <div className="enrollment-manual-actions">
          {manualReview ? <>
            <button type="button" className="enrollment-button" disabled={locked} onClick={backToManual}>Back to edit</button>
            {!review && !uncertain ? <button type="button" className="enrollment-primary" disabled={busy || !selectedBatch} onClick={() => preview(rows)}>{busy ? 'Checking…' : 'Refresh review'}</button>
              : <button type="button" className="enrollment-primary" disabled={busy || !uncertain && (!review?.summary.ready || !verified)} onClick={reviewConfirmation}>
                {busy ? 'Enrolling…' : uncertain ? 'Check enrollment result' : manualConfirmLabel}
              </button>}
          </> : <>
            <button type="button" className="enrollment-button" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="submit" form={manualFormId} className="enrollment-primary" disabled={locked || !selectedBatch}>{busy ? 'Checking…' : 'Preview student'}</button>
          </>}
        </div>}
    </footer> : fileRows ? <footer className="enrollment-footer enrollment-actions">
      <button type="button" className="enrollment-button" disabled={busy} onClick={onClose}>Close</button>
      <button type="button" className="enrollment-primary" disabled={locked} onClick={openSpreadsheetReview}>Continue review</button>
    </footer> : <footer className="enrollment-footer">
      <div className="enrollment-actions"><button type="button" className="enrollment-button" disabled={busy} onClick={onClose}>Close</button></div>
    </footer>}
  </dialog>
  <dialog ref={reviewDialog} className="enrollment-dialog enrollment-review-dialog" aria-labelledby="enrollment-review-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="enrollment-header">
      <div><h2 id="enrollment-review-title">{result ? 'Enrollment results' : 'Review students'}</h2>
        <p>{selectedBatch?.name || 'Selected batch'} — {selectedBatch?.instructor_name || 'Instructor unassigned'}</p></div>
      <button type="button" aria-label="Close review" disabled={busy} onClick={onClose} className="enrollment-close"><XIcon size={16} /></button>
    </header>
    <div className="enrollment-content">
      {note && <p className="enrollment-caption">{note}</p>}
      {error && <p role="alert" className="enrollment-error">{error}</p>}
      {spreadsheetReview && reviewContent}
    </div>
    <footer className="enrollment-footer">
      {result ? <><p role="status">{resultText(result.summary)} Queued does not mean delivered. View saved delivery status in Enrollment emails.</p><button type="button" className="enrollment-button" onClick={onClose}>Done</button></> : <>
        {review && <><p>{confirmationText(review.summary, emailMode)}</p><label className="enrollment-verify"><input type="checkbox" checked={verified} disabled={locked} onChange={e => setVerified(e.target.checked)} />I verified the Student IDs and final DNSC email addresses.</label></>}
        <div className="enrollment-actions"><button type="button" className="enrollment-button" disabled={busy} onClick={backToUpload}>Back</button><button type="button" className="enrollment-button" disabled={locked || !selectedBatch} onClick={() => preview(rows, { preserveVerification: true, successMessage: dirty ? 'Student changes updated successfully.' : 'Review refreshed.' })}>{dirty ? 'Apply changes' : 'Refresh review'}</button><button type="button" className="enrollment-primary" disabled={busy || !uncertain && (dirty || !review?.summary.ready || !verified)} onClick={reviewConfirmation}>{busy ? (enrolling ? 'Enrolling…' : 'Validating…') : uncertain ? 'Check enrollment result' : `Confirm ${review?.summary.ready ?? 0} enrollments`}</button></div>
      </>}
    </footer>
  </dialog>
  {confirming && <ConfirmModal tone="confirm" title={initialStudent ? 'Re-enroll student?' : 'Confirm student enrollment?'}
    message={manualReview
      ? `Enroll ${rows[0]?.name} (${rows[0]?.school_id}) in ${selectedBatch?.name || 'the selected batch'} with ${selectedBatch?.instructor_name || 'its assigned instructor'}? ${emailMode === 'later' ? 'The enrollment email will be held for later.' : 'The enrollment email will be queued.'}`
      : `Enroll ${review?.summary.ready ?? 0} verified students in ${selectedBatch?.name || 'the selected batch'} with ${selectedBatch?.instructor_name || 'its assigned instructor'}? ${confirmationText(review?.summary || {}, emailMode)} Existing assessment records and other batch memberships are preserved.`}
    confirmLabel={manualReview ? manualConfirmLabel : 'Enroll students'} onCancel={() => setConfirming(false)} onConfirm={confirm} />}
  </>
}
