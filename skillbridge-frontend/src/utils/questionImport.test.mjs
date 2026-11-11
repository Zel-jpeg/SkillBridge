import test from 'node:test'
import assert from 'node:assert/strict'
import { detectQuestionTextFormat, parseAikenQuestions, parseNativeQuestions, parseSpreadsheetQuestions,
  questionImportPayload, QUESTION_IMPORT_TEMPLATES } from './questionImport.js'

test('AIKEN keeps all twenty synthetic question stems, choices and keys in file order', () => {
  const source = Array.from({ length: 20 }, (_, index) =>
    `Synthetic question ${index + 1}?\r\nA. first\r\nB. second\r\nC. third\r\nD. fourth\r\nANSWER: ${'ABCD'[index % 4]}`
  ).join('\r\n\r\n')
  const { rows, errs } = parseAikenQuestions(source)
  assert.deepEqual(errs, [])
  assert.equal(rows.length, 20)
  rows.forEach((row, index) => {
    assert.equal(row.rowNum, index + 1)
    assert.equal(row.question, `Synthetic question ${index + 1}?`)
    assert.equal(row.correctIdx, index % 4)
    assert.deepEqual(row.choices, ['first', 'second', 'third', 'fourth'])
    assert.equal(row.category, '')
  })
})

test('AIKEN handles BOM, Unicode, CR, LF, CRLF and two-choice items as MCQ', () => {
  for (const ending of ['\n', '\r', '\r\n']) {
    const { rows, errs } = parseAikenQuestions(['\ufeffMay tala ba sa café?', 'A) True', 'B) False', 'ANSWER: B'].join(ending))
    assert.deepEqual(errs, [])
    assert.equal(rows[0].question, 'May tala ba sa café?')
    assert.equal(rows[0].type, 'mcq')
    assert.deepEqual(questionImportPayload(rows)[0].choices, [{ text: 'True', is_correct: false }, { text: 'False', is_correct: true }])
  }
})

test('missing, malformed, duplicate and foreign keys produce line and question diagnostics', () => {
  const blocks = [
    'Missing?\nA. Alpha\nB. Beta',
    'Malformed?\nA. Alpha\nB. Beta\nANSWER: b',
    'Duplicate?\nA. Alpha\nB. Beta\nANSWER: A\nANSWER: B',
    'Outside?\nA. Alpha\nB. Beta\nANSWER: C',
    'Valid?\nA. Alpha\nB. Beta\nANSWER: B',
  ]
  const { rows, errs } = parseAikenQuestions(blocks.join('\n\n'))
  assert.deepEqual(errs.map(row => row.rowNum), [1, 2, 3, 4])
  assert.deepEqual(errs.map(row => row.line), [1, 5, 10, 16])
  assert.deepEqual(rows.map(row => row.rowNum), [5])
  assert.match(errs[0].errors.join(' '), /key is required/)
  assert.match(errs[1].errors.join(' '), /uppercase/)
  assert.match(errs[2].errors.join(' '), /one ANSWER/)
  assert.match(errs[3].errors.join(' '), /point to a choice/)
})

test('AIKEN rejects unsupported choices or rich content without truncating or shifting', () => {
  for (const block of [
    'Too many?\nA. a\nB. b\nC. c\nD. d\nE. e\nANSWER: E',
    'Duplicate choices?\nA. a\nA. again\nANSWER: A',
    'Gap?\nA. a\nC. c\nANSWER: C',
    'Image? ![example](figure.png)\nA. a\nB. b\nANSWER: A',
    'Broken stem\ncontinues here?\nA. a\nB. b\nANSWER: B',
  ]) {
    const { rows, errs } = parseAikenQuestions(block)
    assert.equal(rows.length, 0, block)
    assert.equal(errs.length, 1, block)
  }
})

test('AIKEN accepts another question immediately after a finished answer', () => {
  const { rows, errs } = parseAikenQuestions('One?\nA. a\nB. b\nANSWER: A\nTwo?\nA. c\nB. d\nANSWER: B')
  assert.deepEqual(errs, [])
  assert.deepEqual(rows.map(row => [row.question, row.correctIdx]), [['One?', 0], ['Two?', 1]])
})

test('native text handles comments, separators, categories and all three types', () => {
  const text = '\ufeff' + QUESTION_IMPORT_TEMPLATES.native[1].replaceAll('\n', '\r\n')
  assert.equal(detectQuestionTextFormat(text), 'native')
  const { rows, errs } = parseNativeQuestions(text)
  assert.deepEqual(errs, [])
  assert.deepEqual(rows.map(row => row.type), ['mcq', 'truefalse', 'identification'])
  assert.deepEqual(rows.map(row => row.category), ['Records', 'Records', 'Records'])
  assert.equal(rows[2].identAnswer, '0')
})

test('native export blocks preserve embedded line breaks and reject malformed encoded fields', () => {
  const content = 'TYPE: mcq\nENCODING: JSON\nQUESTION: "Read the log:\\n---\\nprint(0)"\nA: "1"\nB: "0"\nCORRECT: "B"\nCATEGORY: "Records"'
  assert.equal(detectQuestionTextFormat(content), 'native')
  const { rows, errs } = parseNativeQuestions(content)
  assert.deepEqual(errs, [])
  assert.equal(rows[0].question, 'Read the log:\n---\nprint(0)')
  assert.deepEqual(questionImportPayload(rows)[0].choices, [{ text: '1', is_correct: false }, { text: '0', is_correct: true }])
  assert.equal(parseNativeQuestions(content.replace('A: "1"', 'A: 1')).errs.length, 1)
})

test('text format detection preserves AIKEN and does not reinterpret mixed files', () => {
  const aiken = 'QUESTION: Which record is current?\nA. First\nB. Second\nANSWER: B'
  assert.equal(detectQuestionTextFormat(aiken), 'aiken')
  assert.equal(detectQuestionTextFormat(QUESTION_IMPORT_TEMPLATES.native[1] + '\n' + aiken), 'aiken')
  assert.equal(detectQuestionTextFormat(aiken.replace('ANSWER: B', 'ANSWER: b')), 'aiken')
})

test('older SkillBridge text is detected when its fields appear in a different order', () => {
  const text = 'CATEGORY: Records\nB: Second\nA: First\nQUESTION: Which record is current?\nCORRECT: B'
  assert.equal(detectQuestionTextFormat(text), 'native')
  const { rows, errs } = parseNativeQuestions(text)
  assert.deepEqual(errs, [])
  assert.equal(rows[0].correctIdx, 1)
})

test('spreadsheet numeric zero and boolean false survive normalization and stage payloads', () => {
  const { rows, errs } = parseSpreadsheetQuestions([
    { question: 'Numeric choice?', category: 'Records', choice_a: 0, choice_b: 1, correct: 'A' },
    { question: 'True or false?', category: 'Records', type: 'truefalse', correct: false },
    { question: 'Empty quantity?', category: 'Records', type: 'identification', correct: 0 },
    { question: 'Blank choice?', category: 'Records', choice_a: '', choice_b: 1, correct: 'A' },
  ])
  assert.equal(errs[0].rowNum, 5)
  const payload = questionImportPayload(rows.map(row => ({ ...row, categoryId: 17 })))
  assert.equal(payload[0].choices[0].text, '0')
  assert.equal(payload[1].choices[1].is_correct, true)
  assert.equal(payload[2].correct_answer, '0')
  assert.equal(payload[2].category_id, 17)
})
