import { useScopedAssistance } from '../../hooks/useScopedAssistance'
import { organizationButton as button } from '../admin/organizationUi'

export default function ScopedQuestionSuggestion({ framework, text, onAccept }) {
  const base = `/api/management/programs/${framework.program_id}/frameworks/${framework.id}/`
  const suggestion = useScopedAssistance(`${base}assist/category/`, { question_text: text }, framework.digest)
  return <div className="mt-3 space-y-2 text-xs">
    <button type="button" className={button} disabled={suggestion.loading || !text.trim()} onClick={suggestion.run}>{suggestion.loading ? 'Checking…' : 'Suggest from this framework'}</button>
    {suggestion.error && <p role="status">{suggestion.error} Choose manually below.</p>}
    {suggestion.data && <div role="status">
      {suggestion.data.status === 'matched' ? <><p>Text suggestion: {suggestion.data.suggested_category.name}. Review the definition before accepting.</p><button type="button" className={`${button} mt-2`} onClick={() => onAccept(suggestion.data.suggested_category)}>Use {suggestion.data.suggested_category.name}</button></> : <p>{suggestion.data.status === 'ambiguous' ? 'Several saved categories are similar.' : 'No clear suggestion available.'} Choose a category manually.</p>}
    </div>}
  </div>
}
