import { useMemo, useState, useRef } from 'react'
import { useToast } from '../../context/ToastContext'
import OrganizationScope from '../OrganizationScope'
import { useApi } from '../../hooks/useApi'
import { ALL_ORGANIZATIONS, ORGANIZATION_OPTIONS, matchesOrganization } from '../../utils/organizationScope'
import {
  downloadPlacementPdf,
  downloadPlacementXlsx,
  fetchPlacementReport,
} from '../../utils/placementReports'

const selectClass = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-xs text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-green-500/30'
const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-xs text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-green-500/30'

function addressArea(address) {
  if (!address) return ''
  if (typeof address === 'string') return address
  return address.city || address.municipality || address.province || address.region || ''
}

function uniqueOptions(items, valueFor) {
  const values = new Map()
  items.forEach(item => {
    const option = valueFor(item)
    if (option?.value && !values.has(String(option.value))) values.set(String(option.value), option)
  })
  return [...values.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export default function PlacementReportPanel({ companies, positions, placements, students, role }) {
  const { showToast } = useToast()
  const downloadPending = useRef(false)
  const [reportType, setReportType] = useState('company_placements')
  const [status, setStatus] = useState('all')
  const [companyId, setCompanyId] = useState('')
  const [positionId, setPositionId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [scope, setScope] = useState(ALL_ORGANIZATIONS)
  const { data: organizationOptions } = useApi(role === 'admin' ? ORGANIZATION_OPTIONS : null)
  const [course, setCourse] = useState('')
  const [area, setArea] = useState('')
  const [dateField, setDateField] = useState('created_at')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [downloading, setDownloading] = useState('')

  const visiblePositions = useMemo(
    () => companyId ? positions.filter(item => String(item.company_id) === companyId) : positions,
    [companyId, positions],
  )
  const batchOptions = useMemo(() => uniqueOptions(
    [...students, ...placements],
    item => item.batch && matchesOrganization(item.batch, scope) ? { value: item.batch.id, label: item.batch.name } : null,
  ), [placements, students, scope])
  const courseOptions = useMemo(() => uniqueOptions(
    [...students, ...placements],
    item => {
      const value = item.course || item.student?.course
      return value ? { value, label: value } : null
    },
  ), [placements, students])
  const areaOptions = useMemo(() => uniqueOptions(
    companies,
    company => {
      const value = addressArea(company.address)
      return value ? { value, label: value } : null
    },
  ), [companies])

  function filters() {
    return {
      report_type: reportType,
      status,
      company_id: companyId,
      position_id: positionId,
      batch_id: batchId,
      ...(scope.institute ? { institute_id: scope.institute } : {}),
      ...(scope.program ? { program_id: scope.program } : {}),
      course,
      area,
      date_field: dateField,
      date_from: dateFrom,
      date_to: dateTo,
    }
  }

  function filterLabels() {
    return {
      company_id: Object.fromEntries(companies.map(item => [String(item.id), item.name])),
      position_id: Object.fromEntries(positions.map(item => [String(item.id), `${item.title} — ${item.company_name}`])),
      batch_id: Object.fromEntries(batchOptions.map(item => [String(item.value), item.label])),
      institute_id: Object.fromEntries((organizationOptions?.institutes || []).map(item => [String(item.id), item.name])),
      program_id: Object.fromEntries((organizationOptions?.programs || []).map(item => [String(item.id), item.name])),
    }
  }

  async function download(format) {
    if (downloadPending.current) return
    if (dateFrom && dateTo && dateFrom > dateTo) {
      showToast('The start date cannot be after the end date.', 'error')
      return
    }
    downloadPending.current = true
    setDownloading(format)
    try {
      const payload = await fetchPlacementReport(filters())
      if (format === 'pdf') await downloadPlacementPdf(payload, filterLabels())
      else await downloadPlacementXlsx(payload, filterLabels())
      showToast(`${format.toUpperCase()} placement report downloaded.`, 'success')
    } catch (error) {
      const message = error.response?.data?.error || 'Could not generate the placement report.'
      showToast(message, 'error')
    } finally {
      downloadPending.current = false
      setDownloading('')
    }
  }

  function changeCompany(value) {
    setCompanyId(value)
    if (positionId && !positions.some(item => String(item.id) === positionId && (!value || String(item.company_id) === value))) {
      setPositionId('')
    }
  }

  return (
    <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Download placement reports</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {role === 'instructor' ? 'Reports include placement records from your batches, including retained history.' : 'Reports include placement records across the system.'}
          </p>
        </div>
        <p className="text-[11px] text-gray-400">PDF for official records · XLSX for raw data · Dates use Philippine time</p>
      </div>

      {role === 'admin' && <div className="mb-4"><OrganizationScope value={scope} onChange={next => { setScope(next); setBatchId('') }} /></div>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Report type</span><select value={reportType} onChange={event => setReportType(event.target.value)} className={selectClass}><option value="company_placements">Partner / position placements</option><option value="student_placements">Student placements</option><option value="placement_history">Placement history</option></select></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Status</span><select value={status} onChange={event => setStatus(event.target.value)} className={selectClass}><option value="all">All statuses</option><option value="suggested">Suggested</option><option value="approved">Approved</option><option value="removed">Removed</option><option value="rejected">Rejected</option></select></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Partner</span><select value={companyId} onChange={event => changeCompany(event.target.value)} className={selectClass}><option value="">All partners</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Position</span><select value={positionId} onChange={event => setPositionId(event.target.value)} className={selectClass}><option value="">All positions</option>{visiblePositions.map(position => <option key={position.id} value={position.id}>{position.title} — {position.company_name}</option>)}</select></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Batch</span><select value={batchId} onChange={event => setBatchId(event.target.value)} className={selectClass}><option value="">All batches</option>{batchOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Course</span><select value={course} onChange={event => setCourse(event.target.value)} className={selectClass}><option value="">All courses</option>{courseOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Partner area / city / province</span><select value={area} onChange={event => setArea(event.target.value)} className={selectClass}><option value="">All partner areas</option>{areaOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Date field</span><select value={dateField} onChange={event => setDateField(event.target.value)} className={selectClass}><option value="created_at">Created date</option><option value="approved_at">Approved date</option></select></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Date from</span><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className={inputClass} /></label>
        <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Date to</span><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className={inputClass} /></label>
        <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-end gap-2">
          <button type="button" onClick={() => download('pdf')} disabled={Boolean(downloading)} className="pl-button pl-primary flex-1">{downloading === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</button>
          <button type="button" onClick={() => download('xlsx')} disabled={Boolean(downloading)} className="pl-button flex-1">{downloading === 'xlsx' ? 'Preparing XLSX…' : 'Download XLSX'}</button>
        </div>
      </div>
    </section>
  )
}
