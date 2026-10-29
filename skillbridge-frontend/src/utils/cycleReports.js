const stamp = value => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded'
const safe = value => {
  if (typeof value !== 'string') return value ?? ''
  const first = [...value].find(char => char.charCodeAt(0) > 32 && !/\s/.test(char))
  return first && '=+@-'.includes(first) ? `'${value}` : value
}

export function cycleReportTables(snapshot) {
  const current = snapshot.schema_version >= 2
  const legacyTime = snapshot.placements.some(p => p.status === 'completed' && p.completed_at)
  return [
    { name: 'Summary', columns: ['Field', 'Recorded value'], rows: [
      ['Batch', snapshot.batch.name], ['Version', snapshot.version], ['Saved (Manila)', stamp(snapshot.generated_at)],
      ['Saved by', snapshot.generated_by.name], ['Scope', snapshot.catalog_scope],
      ['Capacity note', current ? 'Shared current allocations at report time; archived batch approvals do not reserve current slots.' : 'Historical approved allocations as recorded; current allocation rules may differ.'],
      ['Records note', 'Historical snapshot. Current openings, profiles and rankings may differ.'],
      ['Archive note', snapshot.archive_note || 'Not recorded'],
    ] },
    { name: 'Students', columns: ['Student ID', 'Student', 'Course', 'Required completed', 'Required total', 'Stored profile finalized', 'Saved ranking state', 'Model used', current ? 'Approved decision recorded' : 'Legacy outcome as recorded'], rows: snapshot.students.map(s => [s.school_id, s.name, s.course, s.progress.completed_required_count, s.progress.total_required_count, s.combined_profile_finalized ? 'Yes' : 'No', !s.combined_profile_finalized ? 'Unavailable' : s.recommendations_stale ? 'Stale' : 'As recorded at closeout', s.combined_profile?.model_used || 'Not recorded', current ? (snapshot.placements.some(p => p.student.id === s.id && p.status === 'approved') ? 'Yes' : 'No') : snapshot.exceptions?.[String(s.id)] || 'Not recorded']) },
    { name: 'Assessment scores', columns: ['Student ID', 'Student', 'Assessment', 'Attempt status', 'Category', 'Raw', 'Maximum', 'Percent'], rows: snapshot.students.flatMap(s => s.assessments.flatMap(a => a.category_scores.map(c => [s.school_id, s.name, a.title, a.attempt_status, c.category, c.raw_score, c.max_score, c.percentage]))) },
    { name: 'Combined scores', columns: ['Student ID', 'Student', 'Category', 'Raw', 'Maximum', 'Percent', 'Source assessment IDs'], rows: snapshot.students.flatMap(s => s.combined_scores.map(c => [s.school_id, s.name, c.category, c.raw_score, c.max_score, c.percentage, c.source_assessment_ids.join(', ')])) },
    { name: 'Saved matches', columns: ['Student ID', 'Student', 'Partner', 'Position', 'Match', 'Category fit', 'NLP fit', 'Location fit', 'Distance km', 'Model', 'Record state'], rows: snapshot.students.flatMap(s => (s.recommendations || []).map(r => [s.school_id, s.name, r.partner, r.position, r.match_score, r.category, r.nlp, r.location, r.distance_km, r.model_used, !r.is_current ? 'Historical' : s.recommendations_stale ? 'Stale' : 'As recorded at closeout'])) },
    { name: 'Decisions', columns: ['Student ID', 'Student', 'Partner', 'Position', 'Recorded status', 'Approved (Manila)', 'Match at decision', ...(legacyTime ? ['Legacy recorded time (Manila)'] : [])], rows: snapshot.placements.map(p => [p.student.school_id, p.student.name, p.company.name, p.position.title, p.status, stamp(p.approved_at), p.match_score_at_assignment, ...(legacyTime ? [stamp(p.completed_at)] : [])]) },
    { name: 'Openings at closeout', columns: ['Partner', 'Position', 'Total slots', current ? 'Shared current approved allocations' : 'Approved allocations as recorded', 'Archived', 'Requirements'], rows: snapshot.catalog.map(p => [p.partner, p.position, p.slots, p.current_approved_shared ?? p.ongoing_shared, p.archived ? 'Yes' : 'No', Object.entries(p.requirements).map(([name, value]) => `${name}: ${value}%`).join('; ')]) },
  ]
}

export async function downloadCycleReport(snapshot, format) {
  const filename = `ojt-batch-${snapshot.batch.id}-closeout-v${snapshot.version}`
  const tables = cycleReportTables(snapshot)
  if (format === 'xlsx') {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    for (const table of tables) {
      const sheet = XLSX.utils.aoa_to_sheet([table.columns, ...table.rows])
      sheet['!cols'] = table.columns.map(() => ({ wch: 26 }))
      XLSX.utils.book_append_sheet(workbook, sheet, table.name)
    }
    XLSX.writeFile(workbook, `${filename}.xlsx`)
  } else if (format === 'pdf') {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const doc = new jsPDF({ orientation: 'landscape' })
    tables.forEach((table, index) => {
      if (index) doc.addPage()
      doc.setFontSize(13)
      const title = doc.splitTextToSize(`OJT closeout: ${snapshot.batch.name}`, doc.internal.pageSize.getWidth() - 24)
      const top = 25 + title.length * 5
      autoTable(doc, { startY: top, head: [table.columns], body: table.rows, styles: { fontSize: 7, overflow: 'linebreak' }, margin: { top, left: 12, right: 12, bottom: 15 }, didDrawPage: () => {
        doc.setFontSize(13); doc.text(title, 12, 14)
        doc.setFontSize(8); doc.text(`Version ${snapshot.version} | Saved ${stamp(snapshot.generated_at)} (Manila) | ${table.name}`, 12, 17 + title.length * 5)
      } })
    })
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setFontSize(8); doc.text(`Page ${page} of ${pages}`, 12, doc.internal.pageSize.getHeight() - 7) }
    doc.save(`${filename}.pdf`)
  } else {
    const quote = value => `"${String(safe(value)).replaceAll('"', '""')}"`
    const csv = tables.map(t => [[t.name], t.columns, ...t.rows].map(r => r.map(quote).join(',')).join('\r\n')).join('\r\n\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `${filename}.csv`; link.click(); URL.revokeObjectURL(url)
  }
}
