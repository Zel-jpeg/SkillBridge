import DialogShell from './DialogShell'
import { CompanyIcon, PinIcon } from './Icons'
import './companyEdit.css'

export default function CompanyEditDialog({ details, location, saving, saveError, invalid, onSave, onClose, saveLabel = 'Save changes' }) {
  const close = () => { if (!saving) onClose() }
  return <DialogShell title="Edit Company" description="Keep your company profile up to date."
    size="company-edit" onClose={close} closeLabel="Close company editor"
    headerDetails={<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Keep your company profile up to date.</p>}
    footer={<div className="company-edit-footer">
      <p className="text-xs text-gray-500 dark:text-gray-400">Your changes appear after you save.</p>
      <div className="company-edit-actions">
        <button type="button" onClick={close} disabled={saving}
          className="min-h-11 cursor-pointer rounded-xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-wait disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
        <button type="button" onClick={onSave} disabled={saving || invalid}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />}
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>}>
    <div className="company-edit-body" aria-busy={saving}>
      {saveError && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{saveError}</p>}
      <fieldset disabled={saving} className="company-edit-grid">
        <section className="min-w-0 space-y-5" aria-label="Company details">
          <h3 className="company-edit-heading"><span aria-hidden="true"><CompanyIcon size={21} /></span>Company details</h3>
          {details}
        </section>
        <section className="company-edit-location min-w-0 space-y-5" aria-label="Company location">
          <h3 className="company-edit-heading"><span aria-hidden="true"><PinIcon size={21} /></span>Company location</h3>
          {location}
        </section>
      </fieldset>
    </div>
  </DialogShell>
}
