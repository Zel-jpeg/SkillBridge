// src/pages/admin/AdminReports.jsx
// System-wide analytics: submissions, match distribution, skill breakdown, top companies.

import AdminNav from '../../components/admin/AdminNav'
import { useApi } from '../../hooks/useApi'
import { SkillTagBadge } from '../../components/SkillTagBadge'
import { getQualitativeTag } from '../../utils/formatters'

const Spinner = () => (
  <svg className="animate-spin w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
)

function StatCard({ label, value, sub, color }) {
  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm`}>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-black ${color || 'text-gray-900 dark:text-white'}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function BarRow({ label, value, max, colorClass, right, tag }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex items-center gap-2 w-48 shrink-0">
        <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{label}</span>
        {tag && <SkillTagBadge tag={tag} />}
      </div>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass || 'bg-green-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-14 text-right shrink-0">{right}</span>
    </div>
  )
}

export default function AdminReports() {
  const { data, loading } = useApi('/api/admin/reports/')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AdminNav activePath="/admin/reports" />
        <div className="flex justify-center py-24"><Spinner /></div>
      </div>
    )
  }

  const sub   = data?.submission_stats     || {}
  const rec   = data?.recommendation_stats || {}
  const skills = data?.skill_breakdown     || []
  const companies = data?.top_companies    || []
  const batches   = data?.batch_completion || []

  const submittedPct = sub.total > 0 ? Math.round((sub.submitted / sub.total) * 100) : 0

  // Determine dominant match tier
  const matchTiers = [
    { label: 'Strong Matches (≥80%)', value: rec.strong, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Fair Matches (60–79%)',  value: rec.fair,   color: 'bg-amber-500',   textColor: 'text-amber-600 dark:text-amber-400'   },
    { label: 'Low Matches (<60%)',     value: rec.low,    color: 'bg-rose-500',    textColor: 'text-rose-600 dark:text-rose-400'     },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminNav activePath="/admin/reports" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            System-wide insights on student performance, skill gaps, and company matching.
          </p>
        </div>

        {/* ── Row 1: Top-level stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Students"       value={sub.total}          color="text-blue-600 dark:text-blue-400"   sub="registered in system" />
          <StatCard label="Assessments Submitted" value={sub.submitted}     color="text-green-600 dark:text-green-400"  sub={`${submittedPct}% completion rate`} />
          <StatCard label="Pending Submission"   value={sub.pending}        color="text-amber-600 dark:text-amber-400"  sub="haven't submitted yet" />
          <StatCard label="Avg Match Score"      value={rec.avg_score != null ? `${rec.avg_score}%` : '—'} color="text-violet-600 dark:text-violet-400" sub="across all recs" />
        </div>

        {/* ── Row 2: Submission ring + Match distribution ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Submission completion */}
          <SectionCard title="Assessment Completion" subtitle="Percentage of enrolled students who have submitted.">
            <div className="flex items-center justify-center gap-8">
              <div className="relative w-32 h-32 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#16a34a" strokeWidth="3.5"
                    strokeDasharray={`${submittedPct} ${100 - submittedPct}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">{submittedPct}%</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">done</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{sub.submitted} submitted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{sub.pending} pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{sub.total} total</span>
                </div>
              </div>
            </div>

            {batches.length > 0 && (
              <div className="mt-5 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">By Batch</p>
                {batches.map(b => (
                  <BarRow key={b.batch} label={b.batch} value={b.submitted} max={b.total}
                    colorClass="bg-green-500"
                    right={`${b.submitted}/${b.total} (${b.rate}%)`} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Match distribution */}
          <SectionCard title="Match Score Distribution" subtitle={`${rec.total} total recommendations generated.`}>
            <div className="space-y-4">
              {matchTiers.map(t => {
                const pct = rec.total > 0 ? Math.round((t.value / rec.total) * 100) : 0
                return (
                  <div key={t.label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{t.label}</span>
                      <span className={`text-xs font-bold ${t.textColor}`}>{t.value ?? 0} ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${t.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="grid grid-cols-3 gap-3 text-center">
                {matchTiers.map(t => (
                  <div key={t.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <p className={`text-xl font-black ${t.textColor}`}>{t.value ?? 0}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{t.label.split('(')[0].trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Row 3: Skill breakdown + Top companies ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Skill category avg scores */}
          <SectionCard title="Skill Category Performance" subtitle="Average student score per skill category.">
            {skills.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-600 italic">No skill score data yet.</p>
            ) : (
              <div className="space-y-0.5">
                {skills.map(s => (
                  <BarRow
                    key={s.category}
                    label={s.category}
                    value={s.avg_score}
                    max={100}
                    colorClass={
                      s.avg_score >= 80 ? 'bg-emerald-500' :
                      s.avg_score >= 60 ? 'bg-amber-500' : 'bg-rose-400'
                    }
                    right={`${s.avg_score}%`}
                    tag={getQualitativeTag(s.avg_score)}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Top companies by matches */}
          <SectionCard title="Top Matched Companies" subtitle="Companies with the most students scoring ≥60% match.">
            {companies.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-600 italic">No recommendation data yet.</p>
            ) : (
              <div className="space-y-3">
                {companies.map((c, i) => (
                  <div key={c.company} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      i === 0 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                      i === 1 ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' :
                      i === 2 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400' :
                      'bg-gray-50 dark:bg-gray-800/50 text-gray-400'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.company}</span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0 ml-2">
                          {c.match_count} matches · {c.avg_score}% avg
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 dark:bg-blue-500 rounded-full"
                          style={{ width: `${Math.min((c.match_count / (companies[0]?.match_count || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

      </main>
    </div>
  )
}
