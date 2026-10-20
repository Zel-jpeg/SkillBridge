import { useState, useEffect } from 'react'
import api from '../../api/axios'

const TYPE_META = {
  mcq:            { label: 'MCQ',   color: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'       },
  truefalse:      { label: 'T / F', color: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' },
  identification: { label: 'IDENT', color: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'   },
}
const CHOICE_LABELS = ['A', 'B', 'C', 'D']
const QUESTION_TYPES = [
  { key: 'mcq',            label: 'Multiple Choice' },
  { key: 'truefalse',      label: 'True / False'    },
  { key: 'identification', label: 'Identification'  },
]

const TrashIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <path d="M6 9l6 6 6-6"/>
  </svg>
)
export default function EditableQuestionCard({ q, index, categories, onUpdate, onChangeType, onUpdateChoice, onSetCorrect, onRemove }) {
  const typeMeta = TYPE_META[q.question_type] || TYPE_META.mcq

  const preview = q.question_text
    ? (q.question_text.length > 70 ? q.question_text.slice(0, 70) + '…' : q.question_text)
    : 'No question text yet…'

  const [suggestedCategory, setSuggestedCategory] = useState(null)

  useEffect(() => {
    if (!q.question_text || q.question_text.trim() === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestedCategory(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/api/categories/suggest/', { question_text: q.question_text })
        if (res.data.suggested_category) {
          // Check if it's already selected
          if (q.category?.name !== res.data.suggested_category) {
            setSuggestedCategory(res.data.suggested_category)
          } else {
            setSuggestedCategory(null)
          }
        } else {
          setSuggestedCategory(null)
        }
      } catch {
        // silently ignore
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [q.question_text, q.category?.name])

  return (
    <div
      id={`q_${q._tempId}`}
      className={`rounded-2xl overflow-hidden border transition-all ${
        q._isNew
          ? 'border-green-200 dark:border-green-800 shadow-sm shadow-green-100 dark:shadow-green-950'
          : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      {/* ── Collapsed header ── always visible, click to expand */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={q._expanded}
        aria-label={`Question ${index + 1}: ${preview}`}
        onKeyDown={event => {
          if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
            event.preventDefault()
            onUpdate(q._tempId, { _expanded: !q._expanded })
          }
        }}
        onClick={() => onUpdate(q._tempId, { _expanded: !q._expanded })}
        className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-900 cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/20 select-none transition-colors focus-visible:outline-2 focus-visible:outline-green-600"
      >
        {/* Index */}
        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
          {index + 1}
        </div>

        {/* Type badge */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide shrink-0 ${typeMeta.color}`}>
          {typeMeta.label}
          {q._isNew && <span className="ml-1 opacity-70">NEW</span>}
        </span>

        {/* Category pill — hidden on smallest screens */}
        {q.category && (
          <span className="hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shrink-0">
            {q.category.name}
          </span>
        )}

        {/* Question preview */}
        <p className={`flex-1 text-sm truncate ${q.question_text ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600 italic'}`}>
          {preview}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(q._tempId) }}
            className="p-1.5 rounded-lg text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
            title="Remove question"
          >
            <TrashIcon />
          </button>
          <div className="p-1.5 text-gray-400 dark:text-gray-600">
            <ChevronIcon open={q._expanded} />
          </div>
        </div>
      </div>

      {/* ── Expanded edit body ── */}
      {q._expanded && (
        <div className="px-4 pb-5 pt-4 flex flex-col gap-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">

          {/* QUESTION TYPE */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Question Type</p>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => onChangeType(q._tempId, t.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    q.question_type === t.key
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* QUESTION TEXT */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Question</p>
            <textarea
              value={q.question_text}
              onChange={e => onUpdate(q._tempId, { question_text: e.target.value })}
              onClick={e => e.stopPropagation()}
              placeholder="Type the question here..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white resize-none outline-none focus:border-green-500 focus:bg-white dark:focus:bg-gray-900 transition-colors"
            />
          </div>

          {/* MCQ CHOICES */}
          {q.question_type === 'mcq' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Answer Choices</p>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">Click a letter to mark correct</span>
              </div>
              <div className="flex flex-col gap-2">
                {q.choices.map((choice, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <button
                      onClick={() => onSetCorrect(q._tempId, ci)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-colors border ${
                        choice.is_correct
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'
                      }`}
                      title={choice.is_correct ? 'Correct answer' : 'Mark as correct'}
                    >
                      {CHOICE_LABELS[ci]}
                    </button>
                    <input
                      type="text"
                      value={choice.text}
                      onChange={e => onUpdateChoice(q._tempId, ci, 'text', e.target.value)}
                      placeholder={`Choice ${CHOICE_LABELS[ci]}`}
                      className={`flex-1 px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors text-gray-900 dark:text-white ${
                        choice.is_correct
                          ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/50'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-green-500'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRUE / FALSE */}
          {q.question_type === 'truefalse' && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Correct Answer</p>
              <div className="flex gap-3">
                {[0, 1].map(ci => (
                  <button
                    key={ci}
                    onClick={() => onSetCorrect(q._tempId, ci)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                      q.choices[ci]?.is_correct
                        ? 'bg-green-600 border-green-600 text-white shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-400 dark:hover:border-green-600'
                    }`}
                  >
                    {ci === 0 ? 'True' : 'False'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* IDENTIFICATION */}
          {q.question_type === 'identification' && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Correct Answer</p>
              <input
                type="text"
                value={q.identAnswer || ''}
                onChange={e => onUpdate(q._tempId, { identAnswer: e.target.value })}
                placeholder="Type the exact correct answer..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-green-500 focus:bg-white dark:focus:bg-gray-900 transition-colors"
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Graded with case-insensitive matching.</p>
            </div>
          )}

          {/* SKILL CATEGORY */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Skill Category</p>
            {categories.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 italic">No categories found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => onUpdate(q._tempId, { category: { id: cat.id, name: cat.name } })}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                        (q.category?.id === cat.id || q.category?.name?.toLowerCase() === cat.name.toLowerCase())
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-400 hover:text-green-700 dark:hover:text-green-300'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                {suggestedCategory && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Suggested:</span>
                    <button
                      onClick={() => {
                        const catObj = categories.find(c => c.name.toLowerCase() === suggestedCategory.toLowerCase())
                        if (catObj) {
                          onUpdate(q._tempId, { category: { id: catObj.id, name: catObj.name } })
                          setSuggestedCategory(null)
                        }
                      }}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      {suggestedCategory}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Assessment card (in the list) ─────────────────────────────────────────────
