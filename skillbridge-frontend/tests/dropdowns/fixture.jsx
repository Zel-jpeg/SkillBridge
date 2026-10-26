import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import AddressDropdowns from '../../src/components/AddressDropdowns'
import '../../src/index.css'

const batches = Array.from({ length: 36 }, (_, i) => `Sample Batch ${String(i + 1).padStart(2, '0')}`)
export default function Fixture() {
  const [batch, setBatch] = useState('')
  const [status, setStatus] = useState('all')
  const [address, setAddress] = useState({})
  const [saved, setSaved] = useState('')
  const dialog = useRef(null)
  return <main className="mx-auto max-w-5xl space-y-6 p-4 text-xs text-gray-800 sm:p-8 dark:text-gray-200">
    <header><p className="text-green-700 dark:text-green-400">SkillBridge · Synthetic fixture</p><h1 className="mt-2 text-xl font-semibold">Modern dropdowns</h1><p className="mt-2 text-gray-500">Filters, forms and grouped addresses share one presentation.</p></header>
    <section className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:grid-cols-2 dark:border-gray-700 dark:bg-gray-900">
      <label className="grid min-w-0 gap-2">Batch<select aria-label="Batch" name="batch" value={batch} onChange={e => { setBatch(e.target.value); setStatus('all') }}><option value="">All batches</option>{batches.map((text, i) => <option value={String(i + 1)} key={text}>{text}</option>)}</select></label>
      <label className="grid min-w-0 gap-2">Student status<select aria-label="Student status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All students</option><option value="complete">Complete</option><option value="pending">Pending</option><option value="stopped" disabled>Stopped (unavailable)</option></select></label>
      <label className="grid min-w-0 gap-2">Long company name<select aria-label="Long company name" className="w-full"><option>Sample Institution With A Long Company And Department Name For Narrow Screens</option><option>Sample Company Two</option></select></label>
      <label className="grid min-w-0 gap-2">Locked publication<select aria-label="Locked publication" disabled defaultValue="published"><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <label className="grid min-w-0 gap-2">Zero value<select aria-label="Zero value" defaultValue="0"><option value="">Choose a value</option><option value="0">0 · Earned zero</option><option value="1">1</option></select></label>
      <label className="grid min-w-0 gap-2">Invalid selection<select aria-label="Invalid selection" aria-invalid="true" defaultValue=""><option value="">Choose an instructor</option><option value="1">Sample Instructor</option></select></label>
    </section>
    <p role="status" aria-label="Filter state">Batch {batch || 'all'} · Status {status}</p>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"><h2 className="mb-4 text-sm font-semibold">Student address</h2><AddressDropdowns label="Home" prioritizeDavao onChange={setAddress} /><output aria-label="Selected address">{Object.values(address).filter(Boolean).join(' · ')}</output></section>
    <button type="button" className="rounded-lg bg-green-700 px-4 py-3 text-white" onClick={() => dialog.current.showModal()}>Open form dialog</button>
    <dialog ref={dialog} className="m-auto w-[min(480px,calc(100vw-32px))] rounded-2xl border border-gray-200 bg-white p-6 text-gray-800 backdrop:bg-black/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); setSaved(new FormData(event.currentTarget).get('course')); dialog.current.close() }}>
        <h2 className="text-base font-semibold">Enrollment course</h2><label className="grid gap-2">Course<select aria-label="Course" name="course" required defaultValue=""><option value="" disabled>Choose course</option><option value="BSIT">BSIT</option><option value="BSIS">BSIS</option></select></label>
        <button type="submit" className="rounded-lg bg-green-700 px-3 py-2 text-white">Save sample form</button><button type="button" onClick={() => dialog.current.close()}>Cancel</button>
      </form>
    </dialog><output aria-label="Saved course">{saved}</output>
  </main>
}
document.body.className = 'bg-gray-50 dark:bg-gray-950'
createRoot(document.getElementById('root')).render(<Fixture />)
