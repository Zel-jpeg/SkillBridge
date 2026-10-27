import { useId } from 'react'
import { categoryPercentage } from '../../utils/assessmentSummary'
import { ChevronRightIcon } from '../Icons'

export default function DevelopmentFocusItem({ item }) {
  const titleId = useId()
  const topics = item.topics || []
  return <li className="sa-focus-item" aria-labelledby={titleId}>
    <header className="sa-focus-item-heading"><h4 id={titleId}>{item.category}</h4><div className="sa-focus-score-group"><span className="sa-focus-score-label">Category score</span><span className={`sa-focus-score ${item.percentage >= 80 ? 'is-strong' : ''}`}>{categoryPercentage(item.percentage)}</span></div></header>
    <div className={`sa-focus-body ${topics.length ? 'has-topics' : ''}`}>
      <div className="sa-focus-activity"><p className="sa-focus-label">Practice activity</p><p>{item.practiceActivity || item.message}</p></div>
      {topics.length > 0 && <div className="sa-focus-topics"><p className="sa-focus-label">Suggested review topics</p><ul aria-label="Suggested review topics">{topics.map(topic => <li key={topic}>{topic}</li>)}</ul></div>}
    </div>
    {item.practiceSteps?.length > 0 && <details className="sa-focus-steps">
      <summary><span className="sa-focus-when-closed">View practice steps</span><span className="sa-focus-when-open">Hide practice steps</span><span aria-hidden="true"><ChevronRightIcon size={14} /></span></summary>
      <ol>{item.practiceSteps.map(step => <li key={step.label}><strong>{step.label}</strong><p>{step.text}</p></li>)}</ol>
    </details>}
  </li>
}
