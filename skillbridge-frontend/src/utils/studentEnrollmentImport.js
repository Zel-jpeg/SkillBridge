import * as XLSX from 'xlsx'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 1000
const IAMS_HEADERS = ['Student Number', 'Last Name', 'First Name', 'Program', 'YearLevel']

export function createStudentTemplate() {
  const rows = [['Davao Del Norte State College'], ['SkillBridge IAMS-compatible template'], [], [],
    ['Student Data'], [`System Generated: ${new Date().toISOString()}`], [], IAMS_HEADERS]
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [{ wch: 21 }, { wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(book, sheet, 'Students')
  return book
}

export function downloadStudentTemplate() {
  XLSX.writeFile(createStudentTemplate(), 'iams_student_enrollment_template.xlsx')
}

const aliases = {
  studentnumber: 'school_id', studentid: 'school_id', schoolid: 'school_id',
  firstname: 'first_name', lastname: 'last_name', name: 'name',
  program: 'course', course: 'course', yearlevel: 'year_level', email: 'email',
}
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function detectHeader(rows) {
  for (let index = 0; index < Math.min(rows.length, 50); index++) {
    const fields = rows[index].map(value => aliases[normalize(value)] ?? null)
    const has = (...names) => names.every(name => fields.includes(name))
    const format = has('school_id', 'first_name', 'last_name', 'course', 'year_level') ? 'iams'
      : has('school_id', 'name', 'email', 'course') ? 'skillbridge' : null
    if (format) {
      const mapped = fields.filter(Boolean)
      if (new Set(mapped).size !== mapped.length) throw new Error('Ambiguous duplicate headers. Keep one column per field.')
      return { index, fields, format }
    }
  }
  return null
}

export function parseWorkbook(workbook) {
  const students = [], ignoredSheets = []
  for (const worksheet of workbook.SheetNames) {
    const sheet = workbook.Sheets[worksheet]
    if (!sheet['!ref']) { ignoredSheets.push(worksheet); continue }
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'])
    if (range.e.r > MAX_ROWS + 50 || range.e.c > 100) throw new Error('Worksheet exceeds 1,000 records plus 50 header rows, or 101 columns.')
    const arrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: true, range: 0 })
    const header = detectHeader(arrays)
    if (!header) { ignoredSheets.push(worksheet); continue }
    arrays.slice(header.index + 1).forEach((cells, offset) => {
      if (!cells.some(value => String(value).trim())) return
      const row = { worksheet, source_row: header.index + offset + 2, format: header.format }
      header.fields.forEach((field, column) => { if (field) row[field] = String(cells[column] ?? '').trim() })
      students.push(row)
    })
  }
  if (!students.length) throw new Error('No student records found. Use the IAMS or SkillBridge headers within the first 50 rows.')
  if (students.length > MAX_ROWS) throw new Error('Import at most 1,000 students across all worksheets.')
  return { students, ignoredSheets }
}

export async function parseStudentFile(file) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Choose an XLSX, XLS or CSV file.')
  if (file.size > MAX_FILE_BYTES) throw new Error('File exceeds the 5 MB limit.')
  let workbook
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true, sheetRows: MAX_ROWS + 52 })
  } catch { throw new Error('Cannot read this file. Export a new XLSX, XLS or CSV file.') }
  return parseWorkbook(workbook)
}

export const statusLabel = status => ({ ready: 'Ready', existing_student: 'Existing student',
  already_enrolled: 'Already enrolled', unsupported: 'Unsupported program', duplicate: 'Duplicate',
  invalid: 'Invalid', conflict: 'Identity conflict', enrolled: 'Enrolled', skipped: 'Skipped', failed: 'Failed' }[status] || status)

export function editReviewRow(row, field, value) {
  const next = { ...row, [field]: value }
  if (field === 'email') next.email_source = 'Edited'
  if (field === 'name') next.name_edited = true
  if (['first_name', 'last_name'].includes(field)) {
    next.name = [next.first_name, next.last_name].filter(Boolean).join(' ')
    next.name_edited = false
    if (row.email_source === 'Generated') next.email = ''
  }
  return next
}

export function confirmationText(summary) {
  return `${summary.ready} students will be enrolled and ${summary.ready} notifications will be queued. ${summary.total - summary.ready} rows will be skipped.`
}

export function resultText(summary) {
  return `${summary.enrolled} enrolled; ${summary.already_enrolled} already enrolled; ${summary.total - summary.enrolled - summary.already_enrolled} not enrolled. ${summary.notifications_queued} notifications queued.`
}
