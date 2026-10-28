import CompanyImage from '../CompanyImage'
import { ChevronRightIcon, PinIcon } from '../Icons'
import './dashboardCompanyHighlights.css'

export default function DashboardCompanyHighlights({ companies, nearest = false, onSelect, onSeeAll }) {
  return <div className={`student-company-highlights ${nearest ? 'is-nearest' : 'is-ranked'}`}>
    {companies.length ? <ol className="student-company-list">{companies.map((company, index) => {
      const score = company.match_score
      const hasScore = Number.isFinite(score)
      const tone = !hasScore ? 'unavailable' : score >= 80 ? 'strong' : score >= 60 ? 'fair' : 'low'
      return <li key={company.companyKey}>
        <button type="button" className={`student-company-row ${index === 0 ? 'is-first' : ''}`}
          onClick={() => onSelect(company.company_id != null ? { companyId: company.company_id } : { positionId: company.position_id })}
          aria-label={`View ${nearest ? 'nearby ' : ''}partner details for ${company.company}, ${company.position}`} aria-haspopup="dialog">
          <CompanyImage name={company.company} imageUrl={company.company_image_url} className="student-company-avatar" />
          <span className="student-company-identity"><span className="student-company-name"><span className="student-company-rank">#{index + 1}</span><span title={company.company}>{company.company}</span></span><span className="student-company-position" title={company.position}>{company.position}</span></span>
          <span className="student-company-metric">
            {nearest && <span className="student-company-distance" title="Straight-line distance from your saved location"><PinIcon size={13} />{Number.isFinite(company.distKm) ? `${company.distKm.toFixed(1)} km` : 'Distance unavailable'}</span>}
            <span className={`student-company-score score-${tone}`}>{hasScore ? `${score}%` : 'No score'}<span className="student-company-match-label">{hasScore ? 'match' : 'available'}</span></span>
            {!nearest && hasScore && <span className={`student-company-track score-${tone}`} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></span>}
          </span>
          <span className="student-company-chevron" aria-hidden="true"><ChevronRightIcon size={16} /></span>
        </button>
      </li>
    })}</ol> : <p className="student-company-empty">{nearest ? 'No recommended partners with a known location are currently available.' : 'No eligible partner positions are currently available.'}</p>}
    <div className="student-company-footer">
      <button type="button" onClick={onSeeAll}>{nearest ? 'See distance & match details' : 'See all matches'} <span aria-hidden="true">→</span></button>
    </div>
  </div>
}
