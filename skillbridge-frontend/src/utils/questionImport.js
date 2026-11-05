export const CHOICE_LABELS = ['A', 'B', 'C', 'D']

const optionLine = /^([A-Z])[.)][ \t]+(\S.*)$/
const answerLine = /^ANSWER:[ \t]+([A-Z])$/
const answerStart = /^ANSWER\s*:/i
const optionStart = /^[A-Z][.)](?:\s|$)/i
const richContent = /!\[[^\]]*\]\(|<(?:img|svg|picture|audio|video|iframe|table|object|math|script)\b|\[\[(?:image|file):/i

export function parseAikenQuestions(content) {
  const rows = []
  const errs = []
  let block = []
  let number = 0
  let hasKey = false

  function finish() {
    if (!block.length) return
    number += 1
    const [stem, ...body] = block
    const errors = []
    const choices = []
    const letters = []
    let answer = null
    let keys = 0
    if (optionStart.test(stem.text) || answerStart.test(stem.text)) errors.push('Start the question with its own line of text.')
    if (block.some(line => richContent.test(line.text))) errors.push('Images or rich content require manual review. Use a plain-text question.')
    for (const { text, line } of body) {
      const option = text.match(optionLine)
      if (option) {
        const [, letter, choice] = option
        if (keys) errors.push(`Line ${line} has a choice after the answer key.`)
        if (letters.includes(letter)) errors.push(`Line ${line} repeats choice ${letter}.`)
        letters.push(letter)
        choices.push(choice)
      } else if (answerStart.test(text)) {
        keys += 1
        const match = text.match(answerLine)
        if (!match) errors.push(`Line ${line} needs ANSWER: followed by one uppercase choice letter.`)
        else answer = match[1]
      } else {
        errors.push(`Line ${line} must be a lettered choice or an answer key. Keep the question on one line.`)
      }
    }
    if (!keys) errors.push('An ANSWER: key is required.')
    if (keys > 1) errors.push('Use one ANSWER: key per question.')
    if (choices.length < 2 || choices.length > 4) errors.push('SkillBridge accepts two to four AIKEN choices per question.')
    if (letters.some((letter, index) => index < CHOICE_LABELS.length && letter !== CHOICE_LABELS[index])) {
      errors.push('List consecutive choices in order beginning with A.')
    }
    const correctIdx = letters.indexOf(answer)
    if (answer && correctIdx < 0) errors.push('The answer key must point to a choice in this question.')
    const source = { rowNum: number, line: stem.line, question: stem.text }
    if (errors.length) errs.push({ ...source, errors })
    else rows.push({ ...source, type: 'mcq', choices, correctIdx, identAnswer: '', category: '' })
    block = []
    hasKey = false
  }

  for (const [index, value] of content.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).entries()) {
    const text = value.trim()
    if (!text) {
      finish()
      continue
    }
    const isKey = answerStart.test(text)
    if (hasKey && !optionStart.test(text) && !isKey) finish()
    block.push({ text, line: index + 1 })
    hasKey ||= isKey
  }
  finish()
  if (!rows.length && !errs.length) errs.push({ rowNum: '–', errors: ['The file has no AIKEN questions.'] })
  return { rows, errs }
}

function validatedRows(values) {
  const rows = []
  const errs = []
  for (const { rowNum, question, type, choices, correct, category } of values) {
    const errors = []
    if (!question) errors.push('Question text is required.')
    if (!category) errors.push('Category is required.')
    const key = correct.toUpperCase()
    let correctIdx = null
    if (type === 'mcq') {
      if (!choices[0] || !choices[1]) errors.push('Choices A and B are required for multiple choice.')
      correctIdx = CHOICE_LABELS.indexOf(key)
      if (correctIdx < 0) errors.push('The correct answer must be A, B, C or D.')
      else if (!choices[correctIdx]) errors.push('The answer key must point to a choice with text.')
    } else if (type === 'truefalse') {
      correctIdx = ['TRUE', 'FALSE'].indexOf(key)
      if (correctIdx < 0) errors.push('The correct answer must be True or False.')
    } else if (type === 'identification') {
      if (!correct) errors.push('A correct answer is required for identification.')
    } else errors.push('Type must be mcq, truefalse or identification.')
    if (errors.length) errs.push({ rowNum, question, errors })
    else rows.push({ rowNum, question, type, category, correctIdx,
      choices: type === 'truefalse' ? ['True', 'False'] : type === 'identification' ? [] : choices,
      identAnswer: type === 'identification' ? correct : '',
    })
  }
  if (!rows.length && !errs.length) errs.push({ rowNum: '–', errors: ['The file has no questions.'] })
  return { rows, errs }
}

export function parseNativeQuestions(content) {
  const blocks = content.replace(/\r\n|\r/g, '\n').split(/^\s*---+[^\S\n]*$/m)
  const values = blocks.map(block => block.split('\n').map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))).filter(lines => lines.length)
  const rows = []
  const errs = []
  values.forEach((lines, index) => {
    const fields = new Map(lines.filter(line => line.includes(':')).map(line => {
      const colon = line.indexOf(':')
      return [line.slice(0, colon).trim().toUpperCase(), line.slice(colon + 1).trim()]
    }))
    const rowNum = index + 1
    const field = key => {
      if (!fields.has(key)) return ''
      if (fields.get('ENCODING') !== 'JSON') return fields.get(key)
      const value = JSON.parse(fields.get(key))
      if (typeof value !== 'string') throw new Error('Expected encoded text')
      return value
    }
    try {
      rows.push({ rowNum, question: field('QUESTION'), type: (fields.get('TYPE') || 'mcq').toLowerCase(),
        choices: CHOICE_LABELS.map(field), correct: field('CORRECT'), category: field('CATEGORY') })
    } catch {
      errs.push({ rowNum, errors: ['The encoded SkillBridge text is invalid.'] })
    }
  })
  if (!rows.length && errs.length) return { rows, errs }
  const parsed = validatedRows(rows)
  return { rows: parsed.rows, errs: [...parsed.errs, ...errs].sort((a, b) => a.rowNum - b.rowNum) }
}

export function parseSpreadsheetQuestions(raw) {
  return validatedRows(raw.map((row, index) => {
    const field = key => String(row[key] ?? '').trim()
    return { rowNum: index + 2, question: field('question'), type: field('type').toLowerCase() || 'mcq',
      choices: CHOICE_LABELS.map(letter => field(`choice_${letter.toLowerCase()}`)),
      correct: field('correct'), category: field('category') }
  }))
}

export function questionImportPayload(rows) {
  return rows.map(row => ({
    question_text: row.question,
    question_type: row.type,
    category: row.category,
    category_id: row.categoryId ?? null,
    choices: row.choices.flatMap((text, index) => text.trim() ? [{ text, is_correct: row.correctIdx === index }] : []),
    ...(row.type === 'identification' ? { correct_answer: row.identAnswer } : {}),
  }))
}

export const QUESTION_IMPORT_TEMPLATES = {
  aiken: ['questions_aiken.txt', 'Which record shows a confirmed reservation?\nA. Reservation record\nB. Equipment log\nANSWER: A\n'],
  native: ['questions_skillbridge.txt', '# SkillBridge question template\nQUESTION: Which record shows a confirmed reservation?\nTYPE: mcq\nA: Reservation record\nB: Equipment log\nCORRECT: A\nCATEGORY: Records\n\n---\n\nQUESTION: A log can record an entry.\nTYPE: truefalse\nCORRECT: True\nCATEGORY: Records\n\n---\n\nQUESTION: How many entries are in an empty log?\nTYPE: identification\nCORRECT: 0\nCATEGORY: Records\n'],
  excel: ['questions_template.csv', 'question,type,choice_a,choice_b,choice_c,choice_d,correct,category\nWhich record shows a confirmed reservation?,mcq,Reservation record,Equipment log,,,A,Records\nA log can record an entry.,truefalse,,,,,True,Records\nHow many entries are in an empty log?,identification,,,,,0,Records\n'],
}
