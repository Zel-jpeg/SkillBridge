import StatusBadge from '../StatusBadge'

function formatApprovalDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(date)
}

export default function PlacementStatusCard({ placement, audience = 'student', compact = false }) {
  const status = placement?.status || 'unplaced'
  const approved = status === 'approved'
  const company = placement?.company
  const position = placement?.position
  const score = placement?.match_score_at_assignment
  const approvalDate = formatApprovalDate(placement?.approved_at)

  if (audience === 'student' && !approved) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">No approved placement yet</p>
          <StatusBadge status="unplaced" />
        </div>
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
          Please wait for your instructor/OJT coordinator to finalize your placement.
        </p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">OJT</span>
        <StatusBadge status={status} />
        {approved && company?.name && (
          <span className="min-w-0 truncate text-xs font-medium text-green-700 dark:text-green-300">
            {company.name}{position?.title ? ` · ${position.title}` : ''}
          </span>
        )}
      </div>
    )
  }

  const approvedStyles = approved
    ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30'
    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${approvedStyles}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-bold ${approved ? 'text-green-900 dark:text-green-100' : 'text-gray-900 dark:text-white'}`}>
            {approved ? (audience === 'student' ? 'Your OJT placement has been approved' : 'Approved OJT placement') : 'OJT placement status'}
          </p>
          {company?.name && (
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
              {company.name}
            </p>
          )}
          {position?.title && <p className="text-xs text-gray-600 dark:text-gray-300">{position.title}</p>}
        </div>
        <StatusBadge status={status} size="md" />
      </div>

      {(company || score != null || approvalDate) && (
        <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          <div>
            <p className="font-medium text-gray-400 dark:text-gray-500">Company location</p>
            <p className="mt-0.5 text-gray-700 dark:text-gray-300">{company?.address_text || 'Location not provided'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-400 dark:text-gray-500">Match at assignment</p>
            <p className="mt-0.5 font-semibold text-gray-800 dark:text-gray-200">{score != null ? `${Math.round(score)}%` : 'Manual assignment'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-400 dark:text-gray-500">Approval date</p>
            <p className="mt-0.5 text-gray-700 dark:text-gray-300">{approvalDate || 'Not approved'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
