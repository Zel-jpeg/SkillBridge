import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './AnalyticsCharts.css'
import { activityDateLabel } from '../../utils/activityPeriods'

const colors = ['#16a34a', '#3b82f6', '#94a3b8', '#f43f5e']
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600'
const shortName = value => value.length > 21 ? `${value.slice(0, 20)}…` : value
const axis = { fontSize: 12, fill: 'var(--analytics-muted)' }

export function ChartPanel({ title, description, children, className = '' }) {
  return <section className={`analytics-chart min-w-0 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900 ${className}`}>
    <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">{title}</h3>
    <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-600 dark:text-gray-400">{description}</p>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
}

function ChartTooltip({ active, payload, label, unit = 'students' }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return <div className="max-w-72 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
    <p className="mb-2 break-words font-semibold text-gray-900 dark:text-white">{row.name ?? row.date ?? label}</p>
    {payload.map(item => <p key={item.dataKey} className="flex items-center justify-between gap-5"><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: item.color ?? item.fill }} />{item.name}</span><strong className="tabular-nums">{item.value} {unit}</strong></p>)}
    {row.sample != null && <p className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-700">{row.sample} students with results · {row.missing} missing or locked</p>}
  </div>
}

function RecordExplorer({ children, label = 'View counts and student lists' }) {
  return <details className="rounded-xl border border-gray-200 dark:border-gray-700">
    <summary className={`min-h-11 cursor-pointer px-4 py-3 text-xs font-medium text-green-800 dark:text-green-300 ${focus}`}>{label}</summary>
    <div className="space-y-4 border-t border-gray-100 p-4 dark:border-gray-800">{children}</div>
  </details>
}

export function ComparisonBars({ rows, onSelect, value = 'count', total, label = 'name' }) {
  if (!rows.length) return <p className="py-6 text-xs text-gray-500 dark:text-gray-400">No records in this scope.</p>
  const chartData = rows.map(row => ({ ...row, name: row[label], chartValue: row[value] }))
  return <>
    <div className="max-h-[36rem] overflow-y-auto pr-1">
      <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 60 + 40)} initialDimension={{ width: 600, height: 220 }}>
        <BarChart accessibilityLayer layout="vertical" data={chartData} margin={{ top: 8, right: 38, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--analytics-grid)" strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} domain={[0, total || 'auto']} tickCount={4} />
          <YAxis type="category" dataKey="name" width={140} tick={axis} tickFormatter={shortName} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--analytics-grid)', opacity: 0.3 }} content={<ChartTooltip />} />
          <Bar dataKey="chartValue" name={value === 'completed' ? 'Required work complete' : 'Students'} fill="#16a34a" radius={[0, 5, 5, 0]} barSize={20} isAnimationActive={false} onClick={entry => onSelect(entry.payload)} className="cursor-pointer">
            <LabelList dataKey="chartValue" position="right" fontSize={12} fill="var(--analytics-muted)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Counts are students. Select a bar or open the list below to view records.</p>
    <RecordExplorer>{rows.map(row => <button type="button" key={row.id ?? row[label]} onClick={() => onSelect(row)} className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-700 hover:bg-green-50 dark:text-gray-200 dark:hover:bg-green-950 ${focus}`}>
      <span className="min-w-0 break-words font-medium">{row[label]}</span><span className="tabular-nums">{row[value]}{row.total != null ? ` of ${row.total}` : ''}{row.completion_rate != null ? ` · ${row.completion_rate}% complete` : ''}</span>
    </button>)}</RecordExplorer>
  </>
}

export function StackedBars({ rows, segments, denominator, onSelect, unit = 'students', scoreGuide = false }) {
  const series = segments.map((segment, index) => ({ ...segment, fill: segment.fill ?? colors[index] }))
  return <>
    {scoreGuide ? <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">How to read this chart</p>
      <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">Each bar counts students by their final score in that skill.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">{series.map(segment => <li key={segment.key} className="border-l-2 pl-3 text-xs leading-5" style={{ borderColor: segment.fill }}><span className="block font-semibold text-gray-800 dark:text-gray-100">{segment.label}</span><span className="text-gray-600 dark:text-gray-400">{segment.guide}</span></li>)}</ul>
    </div> : <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-300">{series.map(segment => <span key={segment.key} className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: segment.fill }} />{segment.label}</span>)}</div>}
    {rows.length ? <>
      <div className="max-h-[36rem] overflow-y-auto pr-1">
        <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 64 + 40)} initialDimension={{ width: 600, height: 260 }}>
          <BarChart accessibilityLayer layout="vertical" data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--analytics-grid)" strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} tickCount={4} />
            <YAxis type="category" dataKey="name" width={140} tick={axis} tickFormatter={shortName} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--analytics-grid)', opacity: 0.3 }} content={<ChartTooltip unit={unit} />} />
            {series.map(segment => <Bar key={segment.key} stackId="counts" dataKey={segment.key} name={segment.label} fill={segment.fill} barSize={22} isAnimationActive={false} onClick={entry => onSelect(entry.payload, segment.key)} className="cursor-pointer" />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Counts are {unit}. Select a colored section to view records. Zero counts are available in the list below.</p>
      <RecordExplorer label={unit === 'slots' ? 'View slot counts and capacity records' : undefined}>{rows.map(row => <div key={row.id}>
        <p className="break-words text-xs font-semibold text-gray-800 dark:text-gray-100">{row.name}</p>
        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{row.occupied != null ? `${row.total} configured slots${row.occupied > row.total ? ' · over configured capacity' : ''}` : row.sample != null ? `${row.sample} students with results · ${row.missing} missing or locked` : `${denominator(row)} students assigned`}</p>
        <div className="mt-2 flex flex-wrap gap-2">{series.map(segment => <button key={segment.key} type="button" aria-label={`${row.name} · ${segment.label}: ${row[segment.key]}`} onClick={() => onSelect(row, segment.key)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-green-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-green-950 ${focus}`}><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: segment.fill }} />{segment.label}: <strong className="tabular-nums">{row[segment.key]}</strong></button>)}</div>
      </div>)}</RecordExplorer>
    </> : <p className="py-6 text-xs text-gray-500 dark:text-gray-400">No eligible results in this scope.</p>}
  </>
}

export function PlacementDonut({ summary, onSelect }) {
  const entries = [
    { key: 'approved', name: 'Approved in selected batches', value: summary.approved, fill: '#16a34a' },
    { key: 'approved_other_batch', name: 'Approved in another batch', value: summary.approved_other_batch, fill: '#3b82f6' },
    { key: 'unplaced', name: 'Unplaced', value: summary.unplaced, fill: '#f59e0b' },
  ]
  return <div className="flex flex-wrap items-center gap-6 py-2">
    <div className="relative h-44 w-44 shrink-0" role="img" aria-label={`${summary.approved} approved in selected batches, ${summary.approved_other_batch} approved in another batch, ${summary.unplaced} unplaced`}>
      {summary.students ? <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 176, height: 176 }}><PieChart accessibilityLayer><Tooltip content={<ChartTooltip />} /><Pie data={entries} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={84} stroke="none" paddingAngle={2} isAnimationActive={false} onClick={entry => onSelect(entry.key)} className="cursor-pointer" /></PieChart></ResponsiveContainer> : <div className="h-full w-full rounded-full border-[22px] border-gray-200 dark:border-gray-700" />}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{summary.placement_rate == null ? '—' : `${summary.placement_rate}%`}</strong><span className="mt-1 text-xs text-gray-500 dark:text-gray-400">approved</span></div>
    </div>
    <div className="min-w-0 flex-1 basis-56 space-y-2">{entries.map(entry => <button type="button" aria-label={`${entry.name}: ${entry.value}`} className={`flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left text-xs text-gray-700 hover:bg-green-50 dark:text-gray-200 dark:hover:bg-green-950 ${focus}`} key={entry.key} onClick={() => onSelect(entry.key)}>
      <span className="flex items-center gap-3"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.fill }} />{entry.name}</span><strong className="text-base tabular-nums text-gray-900 dark:text-white">{entry.value}</strong>
    </button>)}</div>
  </div>
}

export function ActivityLine({ rows, onSelect, interval = 'day' }) {
  const total = rows.reduce((sum, row) => sum + row.submissions, 0)
  const dateLabel = date => activityDateLabel(date, interval)
  const chartRows = rows.map(row => ({ ...row, name: dateLabel(row.date) }))
  return <>
    <p className="text-xs leading-5 text-gray-600 dark:text-gray-400"><strong className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{total}</strong> recorded submissions</p>
    <ResponsiveContainer width="100%" height={260} initialDimension={{ width: 600, height: 260 }}><AreaChart accessibilityLayer data={chartRows} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
      <CartesianGrid vertical={false} stroke="var(--analytics-grid)" strokeDasharray="3 3" />
      <XAxis dataKey="date" tick={axis} tickFormatter={dateLabel} minTickGap={36} axisLine={false} tickLine={false} />
      <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
      <Tooltip content={<ChartTooltip unit="submissions" />} />
      <Area dataKey="submissions" name="Recorded" type="linear" stroke="#16a34a" strokeWidth={2} fill="#16a34a" fillOpacity={0.1} dot={rows.length === 1 ? { r: 4, fill: '#16a34a' } : false} isAnimationActive={false} />
    </AreaChart></ResponsiveContainer>
    <button type="button" onClick={onSelect} className={`min-h-11 rounded-lg text-xs font-semibold text-green-700 underline underline-offset-4 dark:text-green-400 ${focus}`}>View {interval === 'month' ? 'monthly' : interval === 'year' ? 'yearly' : 'daily'} activity table</button>
  </>
}
