import { useId, useState } from 'react'
import { ChevronDown } from '../Icons'

export default function SubmittedAnswerReview({ questions, answers }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const prefix = useId()
  if (!questions?.length) return null
  const allExpanded = questions.every(question => expandedIds.has(question.id))
  const listId = `${prefix}-questions`
  function toggleQuestion(id) {
    setExpandedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return <section className="sa-card sa-submitted-answers" aria-labelledby={`${prefix}-title`}>
    <header className="sa-review-heading"><div><h2 id={`${prefix}-title`}>Submitted answers</h2><p className="sa-muted">{questions.length} question{questions.length === 1 ? '' : 's'} · Expand a question to review your answer.</p></div>
      <button type="button" className="sa-button sa-button-secondary sa-bulk-toggle" aria-expanded={allExpanded} aria-controls={listId}
        onClick={() => setExpandedIds(allExpanded ? new Set() : new Set(questions.map(question => question.id)))}>{allExpanded ? 'Collapse all' : 'Expand all'}</button>
    </header>
    <p className="sa-review-note">Only your selected answer and its result are marked. The answer key is not shown.</p>
    <ol id={listId} className="sa-review-list">{questions.map((question, index) => {
      const answer = answers?.[String(question.id)]
      const selectedId = answer?.selected_choice_id
      const typed = answer?.text_answer?.trim()
      const answered = question.question_type === 'identification' ? Boolean(typed) : selectedId != null
      const result = !answered ? 'Unanswered' : answer?.submitted_answer_correct ? 'Correct' : 'Incorrect'
      const expanded = expandedIds.has(question.id)
      const buttonId = `${prefix}-question-${question.id}`
      const panelId = `${buttonId}-answer`
      return <li key={question.id} className="sa-review-question">
        <h3><button type="button" id={buttonId} className="sa-question-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggleQuestion(question.id)}>
          <span className="sa-question-copy"><span className="sa-question-title">{index + 1}. {question.question_text}</span><span className="sa-question-category">{question.category || 'General'}</span></span>
          <span className={`sa-answer-status is-${result.toLowerCase()}`}>{result}</span><span className="sa-question-chevron" aria-hidden="true"><ChevronDown open={expanded} size={15} /></span>
        </button></h3>
        <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded} className="sa-answer-panel">
          {expanded && (question.question_type === 'identification'
            ? <p className={`sa-typed-answer is-${result.toLowerCase()}`}>Your answer: {typed || 'No answer submitted'}</p>
            : <><p className="sa-muted sa-choice-note">{answered ? 'Your selected answer is highlighted below.' : 'No answer submitted.'}</p><ul className="sa-reviewed-choices">{(question.choices || []).map(choice => {
                const selected = choice.id === selectedId
                return <li key={choice.id} className={selected ? `is-selected is-${result.toLowerCase()}` : ''}>{choice.text}{selected && <span> · Your answer ({result.toLowerCase()})</span>}</li>
              })}</ul></>)}
        </div>
      </li>
    })}</ol>
  </section>
}
