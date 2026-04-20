// src/components/instructor/EnrollModal.jsx
//
// Two-tab modal for enrolling students:
//   • Upload Excel / CSV — drag-and-drop or file picker
//   • Manual entry       — single student form
//
// Props:
//   existingStudents — array of already-enrolled students (for duplicate check)
//   onClose          — close handler
//   onEnroll(rows)   — called with array of validated student objects to enroll

import { useState, useRef } from 'react'
import { XIcon } from '../Icons'
import { nameFromEmail } from '../../utils/formatters'

export default function EnrollModal({ existingStudents = [], onClose, onEnroll }) {
  const [tab,         setTab]         = useState('excel')
  const fileRef                       = useRef(null)
  const [xlsxRows,    setXlsxRows]    = useState([])
  const [xlsxErrors,  setXlsxErrors]  = useState([])
  const [xlsxFile,    setXlsxFile]    = useState(null)
  const [xlsxLoading, setXlsxLoading] = useState(false)

  const [manId,      setManId]       = useState('')
  const [manEmail,   setManEmail]    = useState('')
  const [manName,    setManName]     = useState('')
  const [nameEdited, setNameEdited]  = useState(false)
  const [manCourse,  setManCourse]   = useState('BSIT')
  const [manErr,     setManErr]      = useState({})

  // ── Excel parser ──────────────────────────────────────────────────
  async function parseExcel(file) {
    setXlsxLoading(true); setXlsxRows([]); setXlsxErrors([]); setXlsxFile(file.name)
    try {
      if (!window.XLSX) await new Promise((res, rej) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        s.onload = res; s.onerror = rej
        document.head.appendChild(s)
      })
      const wb  = window.XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const raw = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const rows = [], errs = []
      raw.forEach((row, i) => {
        const rowNum = i + 2
        const name   = String(row.name || row.Name || '').trim()
        const sid    = String(row.student_id || row['Student ID'] || '').trim()
        const email  = String(row.email || row.Email || '').trim().toLowerCase()
        const course = String(row.course || row.Course || '').trim().toUpperCase()
        const e = []
        if (!name)  e.push('Name required')
        if (!sid)   e.push('Student ID required')
        if (!email) e.push('Email required')
        else if (!email.endsWith('@dnsc.edu.ph')) e.push('Must be @dnsc.edu.ph')
        if (!['BSIT', 'BSIS'].includes(course)) e.push('Course must be BSIT or BSIS')
        if (existingStudents.find(s => s.studentId === sid))  e.push(`ID ${sid} already enrolled`)
        if (existingStudents.find(s => s.email === email))    e.push('Email already enrolled')
        if (e.length) errs.push({ rowNum, errors: e })
        else rows.push({ name, studentId: sid, email, course })
      })
      setXlsxRows(rows); setXlsxErrors(errs)
    } catch {
      setXlsxErrors([{ rowNum: '–', errors: ['Failed to read file. Use a valid .xlsx or .csv.'] }])
    } finally {
      setXlsxLoading(false)
    }
  }

  // ── Manual form handler ───────────────────────────────────────────
  function handleManual() {
    const e = {}
    if (!manName.trim()) e.name = 'Name is required'
    if (!manId.trim()) e.studentId = 'Student ID is required'
    else if (!/^\d{4}-\d{5}$/.test(manId.trim())) e.studentId = 'Format: YYYY-NNNNN'
    if (!manEmail.trim()) e.email = 'Email is required'
    else if (!manEmail.toLowerCase().endsWith('@dnsc.edu.ph')) e.email = 'Must be a @dnsc.edu.ph email'
    if (existingStudents.find(s => s.studentId === manId.trim()))  e.studentId = 'ID already enrolled'
    if (existingStudents.find(s => s.email === manEmail.trim().toLowerCase())) e.email = 'Email already enrolled'
    if (Object.keys(e).length) { setManErr(e); return }
    onEnroll([{ name: manName.trim(), studentId: manId.trim(), email: manEmail.trim().toLowerCase(), course: manCourse }])
    setManId(''); setManEmail(''); setManName(''); setNameEdited(false); setManCourse('BSIT'); setManErr({})
  }

  function downloadTemplate() {
    const csv = 'name,student_id,email,course\nJuan Dela Cruz,2023-01001,jdelacruz@dnsc.edu.ph,BSIT\n'
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'students_template.csv',
    })
    a.click()
  }

  const inputCls = (field) =>
    `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400
    ${(manErr[field]) ? 'border-rose-400' : 'border-gray-200 dark:border-gray-700 focus:border-green-500'}`

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Enroll students</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Upload a spreadsheet or add manually</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <XIcon size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 pt-4 shrink-0">
          {[{ key: 'excel', label: 'Upload Excel / CSV' }, { key: 'manual', label: 'Manual entry' }].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                tab === t.key
                  ? 'text-green-700 dark:text-green-300 border-green-600 bg-green-50 dark:bg-green-950/40'
                  : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
          {tab === 'excel' ? (
            <>
              {/* Template download */}
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Need a template?</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Columns: <code className="font-mono">name, student_id, email, course</code></p>
                </div>
                <button onClick={downloadTemplate} className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline shrink-0">Download ↓</button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) parseExcel(f) }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300 dark:text-gray-700">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{xlsxFile || 'Drop your .xlsx or .csv here'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or tap to browse</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && parseExcel(e.target.files[0])} />
              </div>

              {xlsxLoading && <p className="text-xs text-center text-gray-400 animate-pulse">Parsing file…</p>}

              {xlsxErrors.length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{xlsxErrors.length} row{xlsxErrors.length > 1 ? 's' : ''} with issues (skipped):</p>
                  {xlsxErrors.map((e, i) => <p key={i} className="text-xs text-rose-600 dark:text-rose-400">Row {e.rowNum}: {e.errors.join(' · ')}</p>)}
                </div>
              )}

              {xlsxRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{xlsxRows.length} student{xlsxRows.length > 1 ? 's' : ''} ready to enroll:</p>
                  <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                            {['Name', 'ID', 'Email', 'Course'].map(h => (
                              <th key={h} className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {xlsxRows.map((r, i) => (
                            <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 last:border-0 ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                              <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{r.name}</td>
                              <td className="px-3 py-2.5 font-mono text-gray-500 dark:text-gray-400">{r.studentId}</td>
                              <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 max-w-[120px] truncate">{r.email}</td>
                              <td className="px-3 py-2.5"><span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-semibold">{r.course}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <button onClick={() => onEnroll(xlsxRows)} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
                    Enroll {xlsxRows.length} student{xlsxRows.length > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500">Add one student at a time. The name is suggested from the DNSC email.</p>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">DNSC Email</label>
                <input
                  type="email" value={manEmail}
                  onChange={e => {
                    const val = e.target.value
                    setManEmail(val); setManErr(err => ({ ...err, email: '' }))
                    if (!nameEdited && val.includes('.')) setManName(nameFromEmail(val.trim().toLowerCase()))
                  }}
                  placeholder="e.g. villanueva.azel@dnsc.edu.ph"
                  className={inputCls('email')}
                />
                {manErr.email && <p className="text-xs text-rose-500 mt-1">{manErr.email}</p>}
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Full Name</label>
                <input
                  type="text" value={manName}
                  onChange={e => { setManName(e.target.value); setNameEdited(true); setManErr(err => ({ ...err, name: '' })) }}
                  placeholder="e.g. Azel Villanueva"
                  className={inputCls('name')}
                />
                {manErr.name && <p className="text-xs text-rose-500 mt-1">{manErr.name}</p>}
              </div>

              {/* Student ID */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Student ID</label>
                <input
                  type="text" value={manId}
                  onChange={e => { setManId(e.target.value); setManErr(err => ({ ...err, studentId: '' })) }}
                  placeholder="e.g. 2023-01001"
                  className={inputCls('studentId') + ' font-mono'}
                />
                {manErr.studentId && <p className="text-xs text-rose-500 mt-1">{manErr.studentId}</p>}
              </div>

              {/* Course */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Course</label>
                <div className="flex gap-2">
                  {['BSIT', 'BSIS'].map(c => (
                    <button key={c} onClick={() => setManCourse(c)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${manCourse === c ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-400'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleManual} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors mt-1">
                Add student
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}
