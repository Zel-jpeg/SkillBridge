import Avatar from './Avatar'
import CompanyImage from './CompanyImage'
import StatusBadge from './StatusBadge'
import PlacementStatusCard from './placements/PlacementStatusCard'
import { AlertTriangleIcon, LockIcon, StarIcon, TrashIcon, WarnIcon } from './Icons'
import { categoryPercentage } from '../utils/assessmentSummary'
import { scoreBg, scoreColor } from '../utils/formatters'
import { studentCardEvidence } from '../utils/studentCard'
import './studentPerformanceCard.css'

const EMPTY_CATEGORIES = []

/** Dashboard-style student cards for management pages; actions remain separate buttons. */
export default function StudentPerformanceCard({ student, categories = EMPTY_CATEGORIES, onOpen, onRemove }) {
  const { locked, stopped, scores, overall, leaders, recommendation } = studentCardEvidence(student)
  const leaderScore = leaders[0]?.percentage
  const leaderNames = leaders.map(row => row.category).join(' · ')
  const message = student.archived ? 'Archived student' : stopped ? student.stoppedReason || 'Assessment stopped or flagged'
    : locked && student.status === 'completed' ? 'Final results locked'
      : locked ? 'Waiting for assessment' : 'Category results not available'
  const EmptyIcon = stopped ? AlertTriangleIcon : locked || student.archived ? LockIcon : WarnIcon
  return <article className="sp-card" data-student-id={student.id}>
    <header className="sp-card-header">
      <div className="sp-card-identity"><Avatar name={student.name} photoUrl={student.photoUrl} className="h-10 w-10 rounded-full text-sm" />
        <div><h3><button type="button" className="sp-card-open" aria-haspopup="dialog" aria-label={`View student ${student.name}`} onClick={event => onOpen(student, event.currentTarget)}>{student.name}</button></h3><p>{student.studentId || 'No student ID'} · {student.course || 'Course not provided'}</p></div>
      </div>
      <div className="sp-card-status"><StatusBadge status={student.archived ? 'archived' : stopped ? 'stopped' : student.status} />
        {onRemove && !student.archived && <button type="button" className="sp-card-remove" aria-label={`Remove ${student.name}`} title="Remove student" onClick={() => onRemove(student)}><TrashIcon size={15} /></button>}
      </div>
    </header>
    <div className="sp-card-placement">{student.placement ? <PlacementStatusCard placement={student.placement} audience="instructor" compact /> : <span>Placement not provided</span>}</div>
    {overall != null ? <div className="sp-card-results">
      <div className="sp-card-overall"><div><span title="Mean of assessed category percentages; separate from recommendation fit.">Overall</span><strong className={scoreColor(overall)}>{overall}%</strong></div>
        <div className="sp-card-track" role="progressbar" aria-label="Overall category average" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overall}><div className={scoreBg(overall)} style={{ width: `${overall}%` }} /></div>
      </div>
      <div className="sp-card-skills">{scores.slice(0, 4).map((row, index) => <div key={row.category_id ?? index} className="sp-card-chip" title={row.category}>
        <span className={`sp-card-dot ${scoreBg(row.percentage)}`} /><span className="sp-card-category">{row.category}</span><strong className={scoreColor(row.percentage)}>{categoryPercentage(row.percentage)}</strong>
      </div>)}</div>
      {scores.length > 4 && <p className="sp-card-more">+{scores.length - 4} more categories in student details</p>}
      {leaderScore > 0 ? <div className="sp-card-best"><StarIcon size={13} /><span>{leaders.length > 1 ? 'Tied best' : 'Best in'}</span><strong className="sp-card-best-name" title={leaderNames}>{leaderNames}</strong><strong className={scoreColor(leaderScore)}>{categoryPercentage(leaderScore)}</strong></div>
        : <p className="sp-card-more">No assessed category scored above zero.</p>}
      {recommendation && <div className="sp-card-recommendation" title={`${recommendation.position || 'Position not provided'} · Recommendation fit is separate from placement approval.`}>
        <CompanyImage name={recommendation.company} imageUrl={recommendation.company_image_url} className="h-6 w-6 rounded-md" /><span className="sp-card-company-name">{recommendation.company || 'Company not provided'}</span><strong>{categoryPercentage(recommendation.match_score)}</strong>
      </div>}
    </div> : <div className={`sp-card-empty ${stopped ? 'sp-card-empty--stopped' : ''}`}>
      <span className="sp-card-empty-icon" aria-hidden="true"><EmptyIcon size={16} /></span><p>{message}</p>
      {locked && student.status === 'completed' && <p>Required work complete; awaiting current finalized evidence.</p>}
      {!stopped && !student.archived && <div className="sp-card-placeholders">{categories.slice(0, 4).map(category => <span key={category} title={category}>{category}</span>)}</div>}
    </div>}
  </article>
}
