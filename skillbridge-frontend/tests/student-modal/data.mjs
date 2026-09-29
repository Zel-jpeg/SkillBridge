export function syntheticStudent(scenario = 'complete') {
  const scores = [
    { category_id: 1, category: 'Software development and enterprise application architecture', raw_score: 8, max_score: 10, percentage: 80, source_assessment_ids: [101] },
    { category_id: 2, category: 'Network administration and information security fundamentals', raw_score: 6, max_score: 10, percentage: 60, source_assessment_ids: [101] },
  ]
  const history = { attempt_number: 1, status: 'stopped', stopped_at: '2026-09-01T04:00:00Z', submitted_at: '2026-09-01T04:00:00Z', is_flagged: true, stopped_reason: 'tab_switch_limit', violation_count: 3, category_scores: scores.map(({ category_id, raw_score, max_score, percentage }) => ({ category_id, raw_score, max_score, percentage })), answers: [{ text_answer: 'RESTRICTED_ANSWER_KEY_SENTINEL', correct_answer: 'RESTRICTED_ANSWER_KEY_SENTINEL' }] }
  const results = Array.from({ length: 10 }, (_, index) => ({
    id: 101 + index, title: index === 0 ? 'Applied software engineering and enterprise systems assessment with extended category evaluation' : `QA assessment ${index + 1}`,
    is_required: index < 2, include_in_competency: index < 3, publication_status: 'published',
    attempt_status: index === 2 ? 'stopped' : index === 3 ? 'in_progress' : index === 4 ? null : 'submitted',
    submitted_at: index === 3 || index === 4 ? null : '2026-09-20T04:30:00Z',
    category_scores: index === 3 || index === 4 ? [] : scores,
    retake_allowed: index === 1, is_flagged: index === 2,
    stopped_reason: index === 2 ? 'Assessment stopped after repeated tab changes' : '', violation_count: index === 2 ? 3 : 0,
    prior_attempts: index === 0 ? [history, { ...history, attempt_number: 2, status: 'submitted', is_flagged: false, stopped_reason: '', violation_count: 0 }] : [],
  }))
  const student = {
    id: 9001, name: 'Alexandra Dominique QA Student With A Long Enrollment Name',
    studentId: 'QA-2026-001', school_id: 'QA-2026-001', course: 'BS Information Technology',
    email: 'alexandra.dominique.synthetic.student.with.a.long.address@example.invalid',
    batch: { id: 77, name: 'Synthetic DNSC OJT cohort 2026' }, instructor: 'QA Instructor',
    total_required_count: 2, completed_required_count: 2, remaining_required_count: 0, recommendations_locked: false,
    assessment_results: results, combined_category_scores: scores,
    combined_competency_profile: { orientation_label: 'Application development orientation', orientation_summary: 'The finalized evidence indicates strength in software development and a need to strengthen network administration. This profile supports instructor review alongside individual assessment results.', development_suggestions: [{ category: scores[1].category, percentage: 60, message: 'Practice network routing and troubleshooting in a supervised laboratory.' }], model_used: 'regex', finalized_at: '2026-09-20T04:31:00Z' },
    top_recommendations: [
      { company: 'Synthetic Enterprise Technology and Academic Operations Services Company', position: 'Application Development and Systems Integration OJT Trainee', match_score: 78.5, category_score_component: 80, nlp_score_component: 75, location_score_component: 78, distance_km: 4.2 },
      { company: 'QA Systems Company', position: 'QA Support Trainee', match_score: 70, category_score_component: 70, nlp_score_component: 60, location_score_component: 85, distance_km: 8 },
      { company: 'STALE_RECOMMENDATION_SENTINEL', position: 'Stale position', is_current: false, match_score: 99 },
    ],
    placement: { status: 'unplaced' },
  }
  if (scenario === 'locked' || scenario === 'pending') {
    student.recommendations_locked = true
    student.completed_required_count = 1
    student.remaining_required_count = 1
    student.combined_competency_profile.orientation_label = 'LOCKED_PROFILE_SENTINEL'
    student.top_recommendations[0].company = 'LOCKED_RECOMMENDATION_SENTINEL'
    student.assessment_results[1] = { ...student.assessment_results[1], attempt_status: 'in_progress', submitted_at: null, category_scores: [], retake_allowed: false }
  }
  if (scenario === 'empty' || scenario === 'no-required') {
    student.total_required_count = 0; student.completed_required_count = 0; student.remaining_required_count = 0
    student.recommendations_locked = true
    student.assessment_results = scenario === 'empty' ? [] : [{ ...results[0], is_required: false }]
  }
  if (scenario === 'no-recommendations') student.top_recommendations = []
  if (scenario === 'archived') { student.archived = true; student.recommendations_locked = true }
  if (scenario === 'flagged') {
    student.recommendations_locked = true; student.completed_required_count = 1; student.remaining_required_count = 1
    student.assessment_results[1] = { ...student.assessment_results[1], is_flagged: true, violation_count: 2, stopped_reason: 'Submitted attempt flagged for integrity review' }
  }
  if (scenario === 'approved') student.placement = { status: 'approved', company: { name: student.top_recommendations[0].company, address_text: 'Synthetic location, Panabo City' }, position: { title: student.top_recommendations[0].position }, match_score_at_assignment: 78.5, approved_at: '2026-09-21T04:00:00Z' }
  return student
}
