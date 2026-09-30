import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { createStudentTemplate, detectHeader, parseWorkbook, parseStudentFile, editReviewRow, confirmationText, resultText, statusLabel, MAX_FILE_BYTES } from './studentEnrollmentImport.js'

const iams = [
  ['Davao Del Norte State College'], ['School address'], [], [], ['Student Data'],
  ['System Generated: 2026-09-30 09:00'], [],
  ['Student Number', 'Last Name', 'First Name', 'Program', 'YearLevel'],
  ['0001-00002', 'Bali-os', 'David Rey', 'BSIT', '4'], [],
]
function workbook(sheets) {
  const book = XLSX.utils.book_new()
  sheets.forEach((rows, index) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), `Sheet ${index + 1}`))
  return book
}

test('IAMS row 8 detection ignores metadata and preserves text IDs and row numbers', () => {
  assert.equal(detectHeader(iams).index, 7)
  const { students } = parseWorkbook(workbook([iams]))
  assert.deepEqual(students[0], { worksheet: 'Sheet 1', source_row: 9, format: 'iams', school_id: '0001-00002', first_name: 'David Rey', last_name: 'Bali-os', course: 'BSIT', year_level: '4' })
  assert.equal(students.length, 1)
})

test('downloadable IAMS template has exact row 8 headers and accepts student records from row 9', () => {
  const book = createStudentTemplate()
  const sheet = book.Sheets.Students
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', range: 0 })
  assert.deepEqual(rows[7], ['Student Number', 'Last Name', 'First Name', 'Program', 'YearLevel'])
  XLSX.utils.sheet_add_aoa(sheet, [['0001-00002', 'Bali-os', 'David Rey', 'BSIT', '4']], { origin: 'A9' })
  const roundTrip = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
  assert.equal(parseWorkbook(roundTrip).students[0].school_id, '0001-00002')
  assert.equal(parseWorkbook(roundTrip).students[0].source_row, 9)
})

test('all recognized sheets read and unrecognized sheets reported', () => {
  const parsed = parseWorkbook(workbook([[['Notes']], iams, iams]))
  assert.equal(parsed.students.length, 2)
  assert.deepEqual(parsed.ignoredSheets, ['Sheet 1'])
})
test('existing template and aliases', () => {
  for (const alias of ['student_id', 'studentId', 'school_id', ' Student ID ']) {
    const { students } = parseWorkbook(workbook([[['Name', alias, 'Email', 'Course'], ['Synthetic', '2026-01982', 'test@dnsc.edu.ph', 'BSIS']]]))
    assert.equal(students[0].school_id, '2026-01982')
    assert.equal(students[0].format, 'skillbridge')
  }
})
test('unsupported programs remain visible for authoritative backend validation', () => {
  const rows = structuredClone(iams)
  rows[8][3] = 'BCRIM'
  assert.equal(parseWorkbook(workbook([rows])).students[0].course, 'BCRIM')
  assert.equal(statusLabel('unsupported'), 'Unsupported program')
})
test('header capitalization and extra spaces', () => {
  assert.equal(detectHeader([[' STUDENT number ', 'LAST name', 'first name', 'PROGRAM', 'Year Level']]).format, 'iams')
})
test('missing and duplicate headers, empty lists, excessive rows rejected', () => {
  assert.throws(() => parseWorkbook(workbook([[['Not a header']]])), /No student/)
  assert.throws(() => parseWorkbook(workbook([iams.slice(0, 8)])), /No student/)
  assert.throws(() => detectHeader([['name', 'email', 'course', 'student_id', 'school_id']]), /Ambiguous/)
  assert.equal(detectHeader([...Array.from({ length: 50 }, () => []), iams[7]]), null)
  assert.throws(() => parseWorkbook(workbook([[iams[7], ...Array.from({ length: 1001 }, () => iams[8])]])), /1,000/)
})
test('real XLSX, XLS and CSV round trips preserve IDs', async () => {
  for (const [extension, bookType] of [['xlsx', 'xlsx'], ['xls', 'biff8'], ['csv', 'csv']]) {
    const bytes = XLSX.write(workbook([iams]), { type: 'buffer', bookType })
    const result = await parseStudentFile({ name: `synthetic.${extension}`, size: bytes.length, arrayBuffer: async () => bytes })
    assert.equal(result.students[0].school_id, '0001-00002')
  }
})
test('file limits and corrupt files fail clearly', async () => {
  await assert.rejects(parseStudentFile({ name: 'bad.exe' }), /Choose/)
  await assert.rejects(parseStudentFile({ name: 'huge.xlsx', size: MAX_FILE_BYTES + 1 }), /5 MB/)
  await assert.rejects(parseStudentFile({ name: 'bad.xlsx', size: 5, arrayBuffer: async () => new Uint8Array([0, 1, 2, 3, 4]) }), /read|No student/)
})
test('edited email retained; generated email regenerated after name correction', () => {
  const row = { first_name: 'Test', last_name: 'Example', email: 'example.test@dnsc.edu.ph', email_source: 'Generated' }
  const edited = editReviewRow(row, 'email', 'controlled@dnsc.edu.ph')
  assert.equal(edited.email_source, 'Edited')
  assert.equal(editReviewRow(edited, 'first_name', 'New').email, 'controlled@dnsc.edu.ph')
  assert.equal(editReviewRow(row, 'first_name', 'New').email, '')
})

test('review name edits preserve typed values until authoritative re-preview', () => {
  const row = { first_name: 'David Rey', last_name: 'Bali-os', name: 'David Rey Bali-os', email: 'bali-os.davidrey@dnsc.edu.ph', email_source: 'Generated' }
  const changed = editReviewRow(row, 'last_name', 'DELA CERNA')
  assert.equal(changed.name, 'David Rey DELA CERNA')
  assert.equal(changed.email, '')
  const corrected = editReviewRow(changed, 'name', 'David Rey McDonald')
  assert.equal(corrected.name, 'David Rey McDonald')
  assert.equal(corrected.name_edited, true)
  assert.equal(editReviewRow(corrected, 'first_name', 'NEW NAME').name_edited, false)
})
test('duplicate labels and confirmation/result counts', () => {
  assert.equal(statusLabel('duplicate'), 'Duplicate')
  assert.equal(confirmationText({ total: 5, ready: 2 }), '2 students will be enrolled and 2 notifications will be queued. 3 rows will be skipped.')
  assert.equal(resultText({ total: 5, enrolled: 2, already_enrolled: 1, notifications_queued: 1 }), '2 enrolled; 1 already enrolled; 2 not enrolled. 1 notifications queued.')
})
