// src/pages/admin/AdminReports.jsx
// System-wide analytics: submissions, match distribution, skill breakdown, top companies.

import AdminNav from '../../components/admin/AdminNav'
import NlpModelComparison from '../../components/admin/NlpModelComparison'
import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { SkillTagBadge } from '../../components/SkillTagBadge'
import { getQualitativeTag } from '../../utils/formatters'
import api from '../../api/axios'

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

function NlpConfigurationCard() {
  const [config, setConfig] = useState(null)
  const [selected, setSelected] = useState('spacy_md')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get('/api/admin/nlp-configuration/').then(({ data }) => {
      setConfig(data)
      setSelected(data.active_model)
    }).catch(() => setMessage('Could not load NLP model configuration.'))
  }, [])

  async function saveModel() {
    setBusy(true)
    try {
      const { data } = await api.patch('/api/admin/nlp-configuration/', { active_model: selected })
      setConfig(data)
      setMessage(data.message)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not update the active model.')
    } finally { setBusy(false) }
  }

  async function rerun() {
    setBusy(true)
    try {
      const { data } = await api.post('/api/admin/rerun-recommendations/')
      setMessage(data.message || 'Recommendations refreshed.')
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not re-run recommendations.')
    } finally { setBusy(false) }
  }

  return (
    <SectionCard title="Recommendation NLP Model" subtitle="Students automatically use the active preprocessing model; the 60/25/15 weights stay fixed.">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Current active model: {config?.active_model_label || 'Loading…'}</label>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            {(config?.models || []).map(model => (
              <option key={model.id} value={model.id}>{model.label}{model.available ? '' : ' (fallback will be used)'}</option>
            ))}
          </select>
        </div>
        <button onClick={saveModel} disabled={busy || !config || selected === config?.active_model}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">Save Model</button>
        <button onClick={rerun} disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 text-white disabled:opacity-50">Re-run Recommendations</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(config?.models || []).map(model => (
          <span key={model.id} title={model.error || ''} className={`text-[11px] px-2 py-1 rounded-full ${model.available ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
            {model.label}: {model.available ? 'available' : 'offline fallback'}
          </span>
        ))}
      </div>
      {message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{message}</p>}
    </SectionCard>
  )
}

export default function AdminReports() {
  const { data, loading } = useApi('/api/admin/reports/')
  const { data: placementData, loading: placementLoading } = useApi('/api/admin/placement-analytics/')

  if (loading || placementLoading) {
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
  const placement = placementData?.summary || {}
  const areas = placementData?.area_breakdown || []
  const topStudentAreas = placementData?.top_areas?.by_student_count || []
  const topPlacementAreas = placementData?.top_areas?.by_placement_count || []

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

        <NlpConfigurationCard />
        <NlpModelComparison />

        {/* ── OJT placement analytics ── */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">OJT Placement Analytics</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Approved assignments, student demand, and remaining company capacity by area.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total OJT Slots" value={placement.total_ojt_slots ?? 0} color="text-blue-600 dark:text-blue-400" sub="across all positions" />
          <StatCard label="Approved Placements" value={placement.approved_placements ?? 0} color="text-green-600 dark:text-green-400" sub="finalized assignments" />
          <StatCard label="Remaining Slots" value={placement.remaining_slots ?? 0} color="text-cyan-600 dark:text-cyan-400" sub="free company capacity" />
          <StatCard label="Unplaced Students" value={placement.unplaced_students ?? 0} color="text-amber-600 dark:text-amber-400" sub="active students without approval" />
          <StatCard label="Placement Fill Rate" value={`${placement.placement_fill_rate ?? 0}%`} color="text-violet-600 dark:text-violet-400" sub="approved placements ÷ slots" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <SectionCard title="Placement Fill Rate" subtitle="Share of all OJT slots currently approved.">
            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#16a34a" strokeWidth="3.5"
                    strokeDasharray={`${Math.min(placement.placement_fill_rate ?? 0, 100)} ${Math.max(100 - (placement.placement_fill_rate ?? 0), 0)}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-gray-900 dark:text-white">{placement.placement_fill_rate ?? 0}%</span>
                  <span className="text-[10px] text-gray-400">filled</span>
                </div>
              </div>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                <p><span className="font-bold text-green-600 dark:text-green-400">{placement.approved_placements ?? 0}</span> approved</p>
                <p><span className="font-bold text-cyan-600 dark:text-cyan-400">{placement.remaining_slots ?? 0}</span> free slots</p>
                <p><span className="font-bold text-amber-600 dark:text-amber-400">{placement.unplaced_students ?? 0}</span> unplaced students</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Top Student Areas" subtitle="Areas with the most active students.">
            {topStudentAreas.length ? (
              <div className="space-y-1">
                {topStudentAreas.map(row => <BarRow key={row.area} label={row.area} value={row.count} max={topStudentAreas[0]?.count || 1} right={`${row.count}`} colorClass="bg-blue-500" />)}
              </div>
            ) : <p className="text-sm italic text-gray-400">No student area data yet.</p>}
          </SectionCard>

          <SectionCard title="Top Placement Areas" subtitle="Company areas with the most approved placements.">
            {topPlacementAreas.length ? (
              <div className="space-y-1">
                {topPlacementAreas.map(row => <BarRow key={row.area} label={row.area} value={row.count} max={topPlacementAreas[0]?.count || 1} right={`${row.count}`} colorClass="bg-green-500" />)}
              </div>
            ) : <p className="text-sm italic text-gray-400">No approved placements yet.</p>}
          </SectionCard>
        </div>

        <SectionCard title="Placement Breakdown by Area" subtitle="Student counts use student addresses; placement, company, and slot counts use company addresses.">
          {areas.length === 0 ? (
            <p className="text-sm italic text-gray-400">No students, companies, or placement capacity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-500 dark:text-gray-400">
                    <th className="pb-3 pr-4 font-semibold">Area</th>
                    <th className="pb-3 px-3 text-center font-semibold">Students</th>
                    <th className="pb-3 px-3 text-center font-semibold">Approved</th>
                    <th className="pb-3 px-3 text-center font-semibold">Unplaced</th>
                    <th className="pb-3 px-3 text-center font-semibold">Companies</th>
                    <th className="pb-3 px-3 text-center font-semibold">Total Slots</th>
                    <th className="pb-3 pl-3 text-center font-semibold">Free Slots</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map(row => (
                    <tr key={row.area} className="border-b border-gray-50 last:border-0 dark:border-gray-800/70">
                      <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">{row.area}</td>
                      <td className="px-3 py-3 text-center text-blue-600 dark:text-blue-400">{row.student_count}</td>
                      <td className="px-3 py-3 text-center text-green-600 dark:text-green-400">{row.approved_placements}</td>
                      <td className="px-3 py-3 text-center text-amber-600 dark:text-amber-400">{row.unplaced_students}</td>
                      <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300">{row.company_count}</td>
                      <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300">{row.total_slots}</td>
                      <td className="py-3 pl-3 text-center font-semibold text-cyan-600 dark:text-cyan-400">{row.available_slots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

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
