import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api/axios'
import { invalidateCache } from '../../hooks/useApi'
import { XIcon } from '../Icons'
import { confirmationText, downloadStudentTemplate, editReviewRow, parseStudentFile, resultText, statusLabel } from '../../utils/studentEnrollmentImport'

const columns = [['school_id', 'Student ID'], ['first_name', 'First name'], ['last_name', 'Last name'],
  ['name', 'Display name'], ['course', 'Program'], ['year_level', 'Year level'], ['email', 'Email']]
const emptyStudent = { school_id: '', name: '', first_name: '', last_name: '', email: '', course: 'BSIT', year_level: '' }
const counts = { total: 'Total parsed', ready: 'Ready to enroll', existing_students: 'Existing students',
  already_enrolled: 'Already enrolled', unsupported: 'Unsupported', duplicate: 'Duplicate', invalid: 'Invalid', conflict: 'Conflict' }

export default function StudentEnrollmentModal({ batchId, onClose, onEnrolled }) {
  const dialog = useRef(null)
  const reviewDialog = useRef(null)
  const fileRef = useRef(null)
  const [batches, setBatches] = useState([])
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
  const [page, setPage] = useState(0)
  const [verified, setVerified] = useState(false)
  const [spreadsheetReview, setSpreadsheetReview] = useState(false)
  const [fileRows, setFileRows] = useState(false)

  useEffect(() => {
    dialog.current.showModal()
    const controller = new AbortController()
    api.get('/api/instructor/batches/', { signal: controller.signal })
      .then(({ data }) => setBatches(data.filter(b => b.status === 'active')))
      .catch(err => { if (err.code !== 'ERR_CANCELED') setError('Could not load active batches. Close and try again.') })
    return () => controller.abort()
  }, [])

  const selectedBatch = batches.find(b => String(b.id) === target)
  const visible = useMemo(() => rows.map((row, index) => ({ row, index })).filter(({ row }) =>
    filter === 'all' || (filter === 'needs_review' ? ['invalid', 'duplicate', 'conflict'].includes(row.status)
      : filter === 'ready' ? ['ready', 'existing_student'].includes(row.status) : row.status === filter)), [rows, filter])

  function invalidateReview() { setReview(null); setVerified(false) }

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

  async function preview(nextRows = rows) {
    setBusy(true); setError(''); invalidateReview()
    try {
      const { data } = await api.post(`/api/instructor/batches/${target}/enroll/preview/`, { students: nextRows })
      setRows(data.rows); setReview(data); setResult(null); setPage(0)
      return true
    } catch (err) { setError(err.response?.data?.error || 'Preview failed. No enrollment was confirmed.') }
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
    if (!review || !verified || busy) return
    setBusy(true); setError('')
    try {
      const { data } = await api.post(`/api/instructor/batches/${target}/enroll/`, { students: rows, review_token: review.review_token })
      setResult(data); setRows(data.rows); setReview(null); setFilter('all'); setPage(0)
      invalidateCache('/api/admin/users/')
      invalidateCache('/api/instructor/batches/')
      onEnrolled?.(data)
    } catch (err) {
      invalidateReview()
      setError(err.response?.data?.error || 'Confirmation response unavailable. Preview again to check enrollment before retrying.')
    } finally { setBusy(false) }
  }

  function edit(index, field, value) {
    setRows(current => current.map((row, i) => i === index ? editReviewRow(row, field, value) : row))
    invalidateReview()
  }

  const reviewContent = rows.length > 0 && <section aria-label="Student review" className="enrollment-review">
        {!spreadsheetReview && <h3>{result ? 'Enrollment results' : 'Review students'}</h3>}
        {!result && <p className="enrollment-warning">Generated emails are predictions. Verify each address belongs to the intended student before confirming.</p>}
        {(review || result) && <div className="enrollment-counts" aria-label="Import counts">
          {Object.entries(counts).map(([key, label]) => <span key={key}><strong>{(review || result).summary[key]}</strong> {label}</span>)}
        </div>}
        {!review && !result && <p role="status" className="enrollment-caption">Changes need validation. Review again to update statuses and counts.</p>}
        <label className="enrollment-field enrollment-filter">Show rows
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }}>
            <option value="all">All rows</option><option value="needs_review">Needs review</option>
            {['ready', 'existing_student', 'already_enrolled', 'unsupported', 'duplicate', 'invalid', 'conflict'].map(status =>
              <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
        </label>
        <div className="enrollment-table-scroll" tabIndex={0} role="region" aria-label="Scrollable student review table">
          <table><thead><tr><th scope="col">Source row</th>{columns.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}<th scope="col">Email source</th><th scope="col">Validation status</th><th scope="col">Warning or error</th><th scope="col">Action</th></tr></thead>
            <tbody>{visible.slice(page * 25, (page + 1) * 25).map(({ row, index }) => <tr key={index}>
              <td>{row.worksheet || 'File'}<br />{row.source_row}</td>
              {columns.map(([field, label]) => <td key={field}>{result ? row[field] : <input aria-label={`${label} row ${row.source_row}`} value={row[field] || ''} disabled={busy} onChange={e => edit(index, field, e.target.value)} />}</td>)}
              <td>{row.email_source}</td><td><span className={`enrollment-status status-${row.status}`}>{statusLabel(row.status)}</span></td>
              <td>{row.issues?.join(' ')}{result && <span>{row.notification_status?.replaceAll('_', ' ')}</span>}</td>
              <td>{!result && <button type="button" disabled={busy} aria-label={`Remove row ${row.source_row}`} onClick={() => { setRows(current => current.filter((_, i) => i !== index)); invalidateReview(); setPage(0) }}>Remove</button>}</td>
            </tr>)}</tbody></table>
        </div>
        <div className="enrollment-pagination"><span>{visible.length} matching rows</span><button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button type="button" disabled={(page + 1) * 25 >= visible.length} onClick={() => setPage(p => p + 1)}>Next</button></div>
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
        <select value={target} disabled={busy || !!result || !!batchId} onChange={e => {
          setTarget(e.target.value); setRows([]); setFileRows(false); setNote(''); invalidateReview()
        }}>
          <option value="">Select an active batch</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name} — {b.instructor_name || 'Instructor unassigned'}</option>)}
        </select>
      </label>
      {selectedBatch && <p className="enrollment-caption">Assigned instructor: {selectedBatch.instructor_name || 'Unassigned'}</p>}
      {error && <p role="alert" className="enrollment-error">{error}</p>}

      {!result && (tab === 'excel' ? <>
        <div className="enrollment-template-card">
          <div><strong>Need a template?</strong><p>Student Number, Last Name, First Name, Program, YearLevel</p></div>
          <button type="button" disabled={busy} onClick={() => downloadStudentTemplate()}>Download enrollment template</button>
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
      {result ? <><p role="status">{resultText(result.summary)} Queued does not mean delivered. Check dispatch failures in the table.</p><button type="button" onClick={onClose}>Done</button></> : <>
        {review && <><p>{confirmationText(review.summary)}</p><label className="enrollment-verify"><input type="checkbox" checked={verified} disabled={busy} onChange={e => setVerified(e.target.checked)} />I verified the Student IDs and final DNSC email addresses.</label></>}
        <div className="enrollment-actions"><button type="button" disabled={busy} onClick={onClose}>Close</button>{rows.length > 0 && <><button type="button" disabled={busy || !selectedBatch} onClick={() => preview()}>Review again</button><button type="button" className="enrollment-primary" disabled={busy || !review?.summary.ready || !verified} onClick={confirm}>{busy ? 'Processing…' : `Confirm ${review?.summary.ready ?? 0} enrollments`}</button></>}</div>
      </>}
    </footer> : <footer className="enrollment-footer enrollment-actions">
      <button type="button" disabled={busy} onClick={onClose}>Close</button>
      <button type="button" disabled={busy} onClick={openSpreadsheetReview}>Continue review</button>
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
      {result ? <><p role="status">{resultText(result.summary)} Queued does not mean delivered. Check dispatch failures in the table.</p><button type="button" onClick={onClose}>Done</button></> : <>
        {review && <><p>{confirmationText(review.summary)}</p><label className="enrollment-verify"><input type="checkbox" checked={verified} disabled={busy} onChange={e => setVerified(e.target.checked)} />I verified the Student IDs and final DNSC email addresses.</label></>}
        <div className="enrollment-actions"><button type="button" disabled={busy} onClick={backToUpload}>Back</button><button type="button" disabled={busy || !selectedBatch} onClick={() => preview()}>Review again</button><button type="button" className="enrollment-primary" disabled={busy || !review?.summary.ready || !verified} onClick={confirm}>{busy ? 'Processing…' : `Confirm ${review?.summary.ready ?? 0} enrollments`}</button></div>
      </>}
    </footer>
  </dialog></>
}
