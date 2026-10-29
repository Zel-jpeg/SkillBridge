export function assessmentFilterGroups({ batches = [], categories = [], availability = [], instructors, oversight = false }) {
  const all = options => [['all', 'All'], ...options]
  return [
    { key: 'state', label: 'Publication status', options: all([['published', 'Published'], ['draft', 'Drafts'], ['closed', 'Closed']]) },
    ...(instructors ? [{ key: 'instructor', label: 'Instructor', options: [['all', 'All instructors'], ...instructors] }] : []),
    { key: 'batch', label: 'Batch', options: [['all', 'All batches'], ...batches] },
    { key: 'required', label: 'Requirement', options: all([['required', 'Required'], ['optional', 'Optional']]) },
    { key: 'included', label: 'Competency inclusion', options: all([['included', 'Included'], ['excluded', oversight ? 'Excluded' : 'Result only']]) },
    { key: 'category', label: 'Skill category', options: all(categories) },
    ...(oversight ? [{ key: 'completion', label: 'Completion', options: all([['complete', '100% complete'], ['incomplete', 'Below 100%']]) }] : []),
    { key: 'availability', label: 'Availability', options: all(availability) },
  ]
}
