import { useRef, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import DialogShell from '../DialogShell'
import ProgramSelect from '../ProgramSelect'

const programsUrl = '/api/management/competency-programs/'

export default function AssessmentProgramSelect({ value, onChange, readOnly = false }) {
  const { data: program, error } = useApi(value ? `${programsUrl}${value}/` : null)
  const trigger = useRef(null)
  const [pending, setPending] = useState(null)
  const current = String(value || '')

  function apply() {
    if (pending === null || pending === current) return
    onChange(pending)
    setPending(null)
  }

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-48 space-y-1">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Program</p>
        {program ? <>
          <p className="text-sm font-semibold wrap-anywhere text-gray-900 dark:text-white">{program.name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {[program.code, program.institute_code].filter(Boolean).join(' · ')}
            {!program.is_active && ' · Archived'}
          </p>
        </> : <p className="text-sm text-gray-600 dark:text-gray-300">
          {value ? error ? 'Program details are unavailable.' : 'Loading program…' : 'No program selected'}
        </p>}
      </div>
      {!readOnly && <button ref={trigger} type="button" aria-haspopup="dialog" onClick={() => setPending(current)}
        className="min-h-11 cursor-pointer rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-green-800 hover:border-green-300 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-700 dark:border-gray-700 dark:bg-gray-900 dark:text-green-300 dark:hover:border-green-700 dark:hover:bg-green-950">
        {value ? 'Change program' : 'Choose program'}
      </button>}
    </div>
    {!readOnly && pending !== null && <DialogShell title="Choose a program" description="Choose the program whose skills this assessment will use."
      size="skill" onClose={() => setPending(null)} restoreFocusRef={trigger} closeLabel="Close program picker"
      footer={<div className="flex justify-end">
        <button type="button" disabled={pending === current} onClick={apply}
          className="min-h-11 cursor-pointer rounded-xl bg-green-700 px-4 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">
          {current && !pending ? 'Clear program' : 'Apply program'}
        </button>
      </div>}>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
        <ProgramSelect value={pending} onChange={setPending} endpoint={programsUrl} hideLegend onClear={() => setPending('')} />
      </div>
    </DialogShell>}
  </>
}
