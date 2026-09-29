const control = 'w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white'

export default function AssessmentSettings({ value, onChange, errors = {} }) {
  const field = (key, next) => onChange({ ...value, [key]: next })
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Publication state
      <select className={`${control} mt-1`} value={value.publication_status} onChange={e => field('publication_status', e.target.value)}>
        <option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option>
      </select>
      {errors.publication_status && <span className="text-red-600">{errors.publication_status}</span>}
    </label>
    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Student display order
      <input className={`${control} mt-1`} type="number" min="0" step="1" value={value.display_order} onChange={e => field('display_order', e.target.value)} />
      {errors.display_order && <span className="text-red-600">{errors.display_order}</span>}
    </label>
    <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
      <input type="checkbox" className="mt-0.5 accent-green-600" checked={value.is_required} onChange={e => field('is_required', e.target.checked)} />
      <span><strong>Required</strong><br />Published required assessments included in competency scoring block final recommendations.</span>
    </label>
    <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
      <input type="checkbox" className="mt-0.5 accent-green-600" checked={value.include_in_competency} onChange={e => field('include_in_competency', e.target.checked)} />
      <span><strong>Include in competency profile</strong><br />Completed optional assessments can improve the combined profile. Excluded results remain visible.</span>
    </label>
    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Available at · Asia/Manila
      <input className={`${control} mt-1`} type="datetime-local" value={value.available_at} onChange={e => field('available_at', e.target.value)} />
    </label>
    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Due at · Asia/Manila
      <input className={`${control} mt-1`} type="datetime-local" value={value.due_at} onChange={e => field('due_at', e.target.value)} />
      {errors.due_at && <span className="text-red-600">{errors.due_at}</span>}
    </label>
  </div>
}
