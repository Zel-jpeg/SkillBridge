export default function CompletionRing({ summary, onSelect }) {
  const complete = summary.required_complete, incomplete = summary.students - complete
  const rate = summary.students ? complete / summary.students * 100 : 0
  return <section className="ar-panel ar-completion"><h3>Required-work completion</h3><div className="ar-ring" style={{ background: `conic-gradient(#059669 ${rate}%, var(--ar-track) 0)` }} role="img" aria-label={`${complete} complete, ${incomplete} incomplete`}><div><strong>{summary.students ? `${Math.round(rate)}%` : '—'}</strong><span>{complete} of {summary.students}</span></div></div><button type="button" onClick={() => onSelect('complete')}>Complete <strong>{complete}</strong></button><button type="button" onClick={() => onSelect('incomplete')}>Incomplete <strong>{incomplete}</strong></button></section>
}
