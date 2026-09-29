import { manilaDateTime } from './assessmentDates.js'

const reportNames = {
  batch_progress: 'Batch Assessment Progress',
  student_competency: 'Student Competency',
  assessment_completion: 'Assessment Completion',
}

const scoreText = score => `${score.category}: ${score.raw_score}/${score.max_score} (${Number(score.percentage).toFixed(1)}%)`

export function studentCompetencySections(row) {
  const locked = Boolean(row.recommendations_locked)
  const placement = row.placement || { status: 'unplaced' }
  return {
    identity: `${row.student || 'Unnamed student'} (${row.school_id || 'No student ID'})`,
    batch: `${row.batch || 'No batch'} - ${row.instructor || 'No instructor'}`,
    progress: `${row.completed_required_count ?? 0} of ${row.total_required_count ?? 0} required assessments complete`,
    individual: (row.individual_results || []).map(result => [
      result.title, result.attempt_status || 'Not started',
      (result.category_scores || []).map(scoreText).join('\n') || 'No category scores',
    ]),
    combined: locked ? [] : (row.combined_category_scores || []).map(score => [
      score.category, `${score.raw_score}/${score.max_score}`, `${Number(score.percentage).toFixed(1)}%`,
    ]),
    included: locked ? [] : (row.included_assessments || []).map(assessment => assessment.title),
    summary: locked ? '' : row.combined_competency_profile?.orientation_summary || '',
    recommendationState: locked ? 'Locked - required assessments remain incomplete' : 'Unlocked',
    recommendations: locked ? [] : (row.final_recommendations || []).map((rec, index) => [
      String(rec.rank ?? index + 1), rec.company, rec.position, `${Number(rec.match_score).toFixed(1)}%`,
      `${Number(rec.category_score_component).toFixed(1)}%`, `${Number(rec.nlp_score_component).toFixed(1)}%`,
      `${Number(rec.location_score_component).toFixed(1)}%`,
    ]),
    placement: placement.status === 'approved'
      ? `Approved: ${placement.company?.name || 'Company unavailable'} - ${placement.position?.title || 'Position unavailable'}`
      : (placement.status || 'unplaced').replaceAll('_', ' '),
  }
}

export function buildAssessmentReportPdf(payload, filters, jsPDF, autoTable) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const title = reportNames[payload.report_type] || 'Assessment Report'
  const filterText = `Filters: Batch ${filters.batch || 'all'} | Assessment ${filters.assessment || 'all'} | Student ${filters.student || 'all'}`
  let y = 39
  const bodyStyle = { fontSize: 8, cellPadding: 2.4, overflow: 'linebreak', valign: 'top' }
  const table = (head, body, options = {}) => {
    autoTable(doc, {
      startY: y, head: [head], body,
      styles: bodyStyle, headStyles: { fillColor: [20, 83, 45], textColor: 255 },
      alternateRowStyles: { fillColor: [247, 249, 248] },
      margin: { top: 39, bottom: 17, left: 12, right: 12 },
      showHead: 'everyPage', rowPageBreak: 'avoid',
      ...options,
    })
    y = doc.lastAutoTable.finalY + 6
  }
  const room = needed => {
    if (y + needed > 190) { doc.addPage(); y = 39 }
  }
  const section = heading => {
    room(10)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20, 83, 45)
    doc.text(heading, 12, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(45, 55, 65)
    y += 4
  }
  const note = value => {
    room(32)
    table(['Details'], [[value || 'None available']], { headStyles: { fillColor: [230, 237, 232], textColor: [31, 55, 42] } })
  }
  const paragraph = value => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(45, 55, 65)
    for (const line of doc.splitTextToSize(value || 'No summary available', 270)) {
      if (y > 189) { doc.addPage(); y = 39 }
      doc.text(line, 12, y)
      y += 4.2
    }
    y += 4
  }

  if (!payload.rows?.length) {
    doc.setFontSize(11); doc.text('No records match the selected filters.', 12, y)
  } else if (payload.report_type === 'student_competency') {
    payload.rows.forEach((row, index) => {
      if (index) { doc.addPage(); y = 39 }
      const s = studentCompetencySections(row)
      section(s.identity)
      note(`${s.batch}\n${s.progress}\nPlacement: ${s.placement}`)
      section('Individual assessment results')
      table(['Assessment', 'Attempt status', 'Individual category scores'], s.individual.length ? s.individual : [['No assessments', '', 'No results']],
        { columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 39 }, 2: { cellWidth: 159 } } })
      section('Combined competency')
      if (s.recommendationState.startsWith('Locked')) paragraph('Combined profile and recommendations are locked until required assessments are complete.')
      else {
        table(['Category', 'Raw / maximum', 'Percentage'], s.combined.length ? s.combined : [['No combined categories', '', '']])
        section('Assessments included in competency calculation')
        table(['Assessment'], s.included.length ? s.included.map(title => [title]) : [['None']])
        section('Combined competency profile summary')
        paragraph(s.summary)
      }
      section(`Final ranked recommendations - ${s.recommendationState}`)
      if (s.recommendationState.startsWith('Locked')) paragraph('Recommendations are locked. No current rankings are shown.')
      else table(['Rank', 'Company', 'Position', 'Match', 'Category', 'NLP', 'Location'],
        s.recommendations.length ? s.recommendations : [['', 'No eligible company positions', '', '', '', '', '']],
        { columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 58 }, 2: { cellWidth: 80 }, 3: { cellWidth: 24 }, 4: { cellWidth: 30 }, 5: { cellWidth: 30 }, 6: { cellWidth: 36 } } })
    })
  } else if (payload.report_type === 'assessment_completion') {
    table(['Assessment', 'Batch', 'Instructor', 'State', 'Required', 'Assigned', 'Submitted', 'In progress', 'Not started', 'Stopped/flagged', 'Completion %'],
      payload.rows.map(row => [row.assessment, row.batch, row.instructor, row.publication_status, row.required ? 'Yes' : 'No', row.assigned, row.submitted, row.in_progress, row.not_started, row.stopped_or_flagged, row.completion_percentage]),
      { styles: { ...bodyStyle, fontSize: 7 } })
  } else {
    table(['Student ID', 'Student', 'Batch', 'Instructor', 'Assessment', 'Status', 'Required', 'Progress', 'Recommendations'],
      payload.rows.flatMap(row => (row.assessments?.length ? row.assessments : [{}]).map(assessment => [
        row.school_id, row.student, row.batch, row.instructor, assessment.title || 'None', assessment.status || 'Not started',
        assessment.required ? 'Yes' : 'No', `${row.completed_required_count}/${row.total_required_count}`,
        row.recommendations_locked ? 'Locked' : 'Unlocked',
      ])))
  }

  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page)
    doc.setTextColor(20, 83, 45); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
    doc.text(`SkillBridge - ${title}`, 12, 12)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(55, 65, 75)
    doc.text(`Generated ${manilaDateTime(payload.generated_at)}`, 12, 20)
    doc.setDrawColor(20, 83, 45); doc.setLineWidth(0.5); doc.line(12, 25, 285, 25)
    doc.setTextColor(55, 65, 75); doc.text(doc.splitTextToSize(filterText, 273), 12, 33)
    doc.setFontSize(8); doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, 285, 203, { align: 'right' })
  }
  return doc
}
