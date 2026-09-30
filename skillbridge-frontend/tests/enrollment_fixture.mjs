// Synthetic fixtures use the application's installed parser and SheetJS package.
import * as XLSX from 'xlsx'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseWorkbook } from '../src/utils/studentEnrollmentImport.js'

const output = fileURLToPath(new URL('./artifacts/enrollment/', import.meta.url))
mkdirSync(output, { recursive: true })
const metadata = [['Davao Del Norte State College'], ['Synthetic school address'], [], [], ['Student Data'], ['System Generated: 2026-09-30 09:00'], []]
const headers = ['Student Number', 'Last Name', 'First Name', 'Program', 'YearLevel']
const book = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([...metadata, headers,
  ['2099-00001', 'BALI-OS', 'DAVID REY', 'BSIT', 4],
  ['2099-00002', 'Other', 'Synthetic Two', 'BCRIM', 4],
  ['2099-00003', 'Duplicate', 'Synthetic', 'BSIS', 4],
  ['2099-00003', 'Duplicate', 'Synthetic', 'BSIS', 4],
  ['2099-00005', 'Missing', '', 'BSIT', 4],
  ['2099-00006', 'Existing', 'Synthetic', 'BSIT', 4],
  ['2099-00007', 'Already', 'Synthetic', 'BSIT', 4],
]), 'IAMS Students')
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Notes only']]), 'Notes')
XLSX.writeFile(book, output + 'iams-synthetic.xlsx')
writeFileSync(output + 'parsed.json', JSON.stringify(parseWorkbook(book)))
