import { useToast } from '../../context/ToastContext'
import { requestErrorMessage } from '../../api/requestErrors'
import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api/axios'
import { invalidateCache, useApi } from '../../hooks/useApi'
import DataSection from '../DataSection'
import ConfirmModal from '../admin/ConfirmModal'
import { GridIcon, ListIcon, XIcon } from '../Icons'
import { confirmationText, downloadStudentTemplate, editReviewRow, parseStudentFile, resultText, statusLabel } from '../../utils/studentEnrollmentImport'

const columns = [['school_id', 'Student ID'], ['first_name', 'First name'], ['last_name', 'Last name'],
  ['name', 'Display name'], ['course', 'Program'], ['year_level', 'Year level'], ['email', 'Email']]
const emptyStudent = { school_id: '', name: '', first_name: '', last_name: '', email: '', course: 'BSIT', year_level: '' }
const counts = { total: 'Total parsed', ready: 'Ready to enroll', existing_students: 'Existing students',
  already_enrolled: 'Already enrolled', unsupported: 'Unsupported', duplicate: 'Duplicate', invalid: 'Invalid', conflict: 'Conflict' }
const PAGE_SIZE = 25

export default function StudentEnrollmentModal({ batchId, onClose, onEnrolled, requireConfirmation = false }) {
  const dialog = useRef(null)
  const reviewDialog = useRef(null)
  const fileRef = useRef(null)
  const { data: batchesData } = useApi('/api/instructor/batches/')
  const batches = Array.isArray(batchesData) ? batchesData.filter(batch => batch.status === 'active') : []
  const [target, setTarget] = useState(String(batchId ?? ''))
  const [rows, setRows] = useState([])
  const [review, setReview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [tab, setTab] = useState('excel')
  const [manual, setManual] = useState(emptyStudent)
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

  useEffect(() => {
    dialog.current.showModal()
  }, [])

  const selectedBatch = batches.find(b => String(b.id) === target)
  const visible = useMemo(() => rows.map((row, index) => ({ row, index })).filter(({ row }) =>
    filter === 'all' || (filter === 'needs_review' ? ['invalid', 'duplicate', 'conflict'].includes(row.status)
      : filter === 'ready' ? ['ready', 'existing_student'].includes(row.status) : row.status === filter)), [rows, filter])

  function invalidateReview() { setReview(null); setVerified(false); setDirty(false) }


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

  async function readFile(file) {
    if (!file || busy || !selectedBatch || result) return
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
    if (!review || !verified || dirty || busy || enrollmentPending.current) return
    enrollmentPending.current = true
    setBusy(true); setError('')
    try {
      const { data } = await api.post(`/api/instructor/batches/${target}/enroll/`, { students: rows, review_token: review.review_token })
      setResult(data); setRows(data.rows); setReview(null); setFilter('all'); setPage(0)
      invalidateCache('/api/admin/users/')
      invalidateCache('/api/instructor/batches/')
      const enrolled = data.summary?.enrolled ?? 0
      showToast(`Enrollment completed: ${enrolled} ${enrolled === 1 ? 'student' : 'students'} enrolled.`)
      onEnrolled?.(data)
      setConfirming(false)
    } catch (err) {
      invalidateReview()
      const message = requestErrorMessage(err, { mutation: true })
      setError(message)
      showToast(message, 'error')
      setConfirming(false)
    } finally { enrollmentPending.current = false; setBusy(false) }
  }

  function reviewConfirmation() {
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

  const reviewContent = rows.length > 0 && <section aria-label="Student review" className="enrollment-review">
        {!spreadsheetReview && <h3>{result ? 'Enrollment results' : 'Review students'}</h3>}
        {!result && <p className="enrollment-warning">Generated emails are predictions. Verify each address belongs to the intended student before confirming.</p>}
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
              <button type="button" className="enrollment-button" aria-expanded={editingIndex === index} disabled={busy}
                onClick={() => editingIndex === index && !result ? finishEditing() : setEditingIndex(current => current === index ? null : index)}>
                {editingIndex === index ? (result ? 'Hide' : busy ? 'Saving…' : 'Done') : result ? 'Details' : 'Edit'}
              </button>
              {!result && <button type="button" className="enrollment-button enrollment-button-danger" disabled={busy}
                aria-label={`Remove row ${row.source_row}`} onClick={() => removeRow(index)}>Remove</button>}
            </div>
            <div className="enrollment-record-header">
              <div><strong>Row {row.source_row}</strong><span>{row.school_id || 'Student ID missing'}</span></div>
              <span className={`enrollment-status status-${row.status}`}>{statusLabel(row.status)}</span>
              {!result && <button type="button" className="enrollment-button enrollment-button-danger" disabled={busy}
                aria-label={`Remove row ${row.source_row}`} onClick={() => removeRow(index)}>Remove</button>}
            </div>
            <div className="enrollment-record-grid">
              {columns.map(([field, label]) => <label className={`enrollment-record-field field-${field.replace('_', '-')} ${['name', 'email'].includes(field) ? 'enrollment-record-field-wide' : ''}`} key={field}>
                <span>{label}</span>
                {result ? <output>{row[field] || '—'}</output> : <input aria-label={`${label} row ${row.source_row}`}
                  value={row[field] || ''} disabled={busy} onChange={e => edit(index, field, e.target.value)} />}
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

  return <><dialog ref={dialog} className="enrollment-dialog" aria-labelledby="enrollment-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="enrollment-header">
      <div>
        <h2 id="enrollment-title">Enroll students</h2>
        <p>Upload a spreadsheet or add manually</p>
      </div>
      <button type="button" aria-label="Close enrollment" disabled={busy} onClick={onClose} className="enrollment-close"><XIcon size={16} /></button>
    </header>

    {!result && <div className="enrollment-tabs" aria-label="Enrollment method">
      {[{ key: 'excel', label: 'Upload Excel / CSV' }, { key: 'manual', label: 'Manual entry' }].map(item =>
        <button type="button" key={item.key} aria-pressed={tab === item.key} onClick={() => {
          setTab(item.key); setRows([]); setFileRows(false); setReview(null); setVerified(false); setError(''); setNote('')
        }}>{item.label}</button>)}
    </div>}

    <div className="enrollment-content">
      <label className="enrollment-field">Target batch
<DataSection url="/api/instructor/batches/" layout="control" count={1}>        <select value={target} disabled={busy || !!result || !!batchId} onChange={e => {
          setTarget(e.target.value); setRows([]); setFileRows(false); setNote(''); invalidateReview()
        }}>
          <option value="">Select an active batch</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name} — {b.instructor_name || 'Instructor unassigned'}</option>)}
        </select></DataSection>
      </label>
      {selectedBatch && <p className="enrollment-caption">Assigned instructor: {selectedBatch.instructor_name || 'Unassigned'}</p>}
      {error && <p role="alert" className="enrollment-error">{error}</p>}

      {!result && (tab === 'excel' ? <>
        <div className="enrollment-template-card">
          <div><strong>Need a template?</strong><p>Student Number, Last Name, First Name, Program, YearLevel</p></div>
          <button type="button" className="enrollment-button enrollment-button-blue" disabled={busy} onClick={() => downloadStudentTemplate()}>Download enrollment template</button>
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
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" disabled={busy || !selectedBatch} aria-label="Student list file"
            onChange={e => { readFile(e.target.files[0]); e.target.value = '' }} />
        </div>
        <p className="enrollment-caption">XLSX, XLS or CSV · Maximum 5 MB and 1,000 records. IAMS headers may appear within the first 50 rows.</p>
      </> : <form className="enrollment-manual" onSubmit={e => { e.preventDefault(); preview([{ ...manual, source_row: 1, worksheet: 'Manual' }]) }}>
        <p className="enrollment-caption">Add one student at a time. Review the details before enrollment.</p>
        <label className="enrollment-field">DNSC Email
          <input type="email" value={manual.email} disabled={busy} placeholder="e.g. villanueva.azel@dnsc.edu.ph"
            onChange={e => setManual(current => ({ ...current, email: e.target.value }))} />
        </label>
        <label className="enrollment-field">Full Name
          <input type="text" value={manual.name} disabled={busy} placeholder="e.g. Azel Villanueva"
            onChange={e => setManual(current => ({ ...current, name: e.target.value }))} />
        </label>
        <label className="enrollment-field">Student ID
          <input type="text" value={manual.school_id} disabled={busy} placeholder="e.g. 2026-01982"
            onChange={e => setManual(current => ({ ...current, school_id: e.target.value }))} />
        </label>
        <div className="enrollment-field"><span>Course</span><div className="enrollment-course-options">
          {['BSIT', 'BSIS'].map(course => <button type="button" key={course} aria-pressed={manual.course === course}
            disabled={busy} onClick={() => setManual(current => ({ ...current, course }))}>{course}</button>)}
        </div></div>
        <button className="enrollment-primary" disabled={busy || !selectedBatch}>Preview student</button>
      </form>)}

      {note.includes(' — ') && <p className="enrollment-caption">{note.split(' — ')[1]}</p>}
      {!fileRows && reviewContent}
    </div>

    {!fileRows ? <footer className="enrollment-footer">
      {result ? <><p role="status">{resultText(result.summary)} Queued does not mean delivered. Check dispatch failures in each record.</p><button type="button" className="enrollment-button" onClick={onClose}>Done</button></> : <>
        {review && <><p>{confirmationText(review.summary)}</p><label className="enrollment-verify"><input type="checkbox" checked={verified} disabled={busy} onChange={e => setVerified(e.target.checked)} />I verified the Student IDs and final DNSC email addresses.</label></>}
        <div className="enrollment-actions"><button type="button" className="enrollment-button" disabled={busy} onClick={onClose}>Close</button>{rows.length > 0 && <><button type="button" className="enrollment-button" disabled={busy || !selectedBatch} onClick={() => preview(rows, { preserveVerification: true, successMessage: dirty ? 'Student changes updated successfully.' : 'Review refreshed.' })}>{dirty ? 'Apply changes' : 'Refresh review'}</button><button type="button" className="enrollment-primary" disabled={busy || dirty || !review?.summary.ready || !verified} onClick={reviewConfirmation}>{busy ? 'Processing…' : `Confirm ${review?.summary.ready ?? 0} enrollments`}</button></>}</div>
      </>}
    </footer> : <footer className="enrollment-footer enrollment-actions">
      <button type="button" className="enrollment-button" disabled={busy} onClick={onClose}>Close</button>
      <button type="button" className="enrollment-primary" disabled={busy} onClick={openSpreadsheetReview}>Continue review</button>
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
      {result ? <><p role="status">{resultText(result.summary)} Queued does not mean delivered. Check dispatch failures in each record.</p><button type="button" className="enrollment-button" onClick={onClose}>Done</button></> : <>
        {review && <><p>{confirmationText(review.summary)}</p><label className="enrollment-verify"><input type="checkbox" checked={verified} disabled={busy} onChange={e => setVerified(e.target.checked)} />I verified the Student IDs and final DNSC email addresses.</label></>}
        <div className="enrollment-actions"><button type="button" className="enrollment-button" disabled={busy} onClick={backToUpload}>Back</button><button type="button" className="enrollment-button" disabled={busy || !selectedBatch} onClick={() => preview(rows, { preserveVerification: true, successMessage: dirty ? 'Student changes updated successfully.' : 'Review refreshed.' })}>{dirty ? 'Apply changes' : 'Refresh review'}</button><button type="button" className="enrollment-primary" disabled={busy || dirty || !review?.summary.ready || !verified} onClick={reviewConfirmation}>{busy ? 'Processing…' : `Confirm ${review?.summary.ready ?? 0} enrollments`}</button></div>
      </>}
    </footer>
  </dialog>
  {confirming && <ConfirmModal tone="confirm" title="Confirm student enrollment?" message={`Enroll ${review?.summary.ready ?? 0} verified students in ${selectedBatch?.name || 'the selected batch'} with ${selectedBatch?.instructor_name || 'its assigned instructor'}? ${confirmationText(review?.summary || {})} Existing records and other batch memberships are preserved.`} confirmLabel="Enroll students" onCancel={() => setConfirming(false)} onConfirm={confirm} />}
  </>
}
