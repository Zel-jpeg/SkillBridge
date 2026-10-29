import { useId, useSyncExternalStore } from 'react'
import { Button } from 'react-aria-components/Button'
import { Dialog, DialogTrigger } from 'react-aria-components/Dialog'
import { Modal, ModalOverlay } from 'react-aria-components/Modal'
import { Popover } from 'react-aria-components/Popover'
import { FilterIcon, XIcon } from './Icons'
import '../styles/collectionFilters.css'

const compactQuery = '(max-width: 639px), (max-height: 540px)'
const compactSnapshot = () => window.matchMedia(compactQuery).matches
function subscribeCompact(listener) {
  const media = window.matchMedia(compactQuery)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

export default function GroupedFilterPanel({ groups, draft, onChange, open, onOpenChange, onApply, onClear, activeCount, previewCount, pending = false, error, onRetry, noun = 'records', disabled = false, dialogLabel = 'Collection filter options', errorLabel = 'Results unavailable', loadingLabel = 'Loading results…' }) {
  const id = useId()
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, () => false)
  const content = <Dialog aria-label={dialogLabel} className="sb-roster-filter-dialog">
    <header className="sb-roster-filter-header"><div><h2>Filters</h2><p>Choose one option per group.</p></div>
      <Button aria-label="Close filters" onPress={() => onOpenChange(false)} className="sb-roster-close"><span aria-hidden="true"><XIcon size={18} /></span></Button>
    </header>
    <div className="sb-roster-filter-body">
      {groups.map(group => <fieldset key={group.key} disabled={group.disabled} className="sb-roster-filter-group">
        <legend>{group.label}</legend>
        {group.hint && <p className="sb-roster-filter-hint">{group.hint}</p>}
        <div className="sb-roster-chip-options">{group.options.map(([value, label]) => <label key={value} className="sb-roster-filter-chip" data-selected={draft[group.key] === value || undefined}>
          <input type="radio" name={`${id}-${group.key}`} value={value} checked={draft[group.key] === value} onChange={() => onChange(group.key, value)} />
          <span className="sb-roster-chip-indicator" aria-hidden="true">{draft[group.key] === value ? '✓' : ''}</span><span>{label}</span>
        </label>)}</div>
      </fieldset>)}
      {error && <div role="alert" className="sb-roster-filter-error">{error} {onRetry && <Button className="sb-roster-reset" onPress={onRetry}>Retry</Button>}</div>}
    </div>
    <footer className="sb-roster-filter-footer">
      <Button className="sb-roster-reset" onPress={onClear}>Clear filters</Button>
      <Button className="sb-roster-apply" isDisabled={pending || Boolean(error)} onPress={() => { onApply(); onOpenChange(false) }}>{error ? errorLabel : pending ? loadingLabel : `Show ${previewCount} ${previewCount === 1 ? noun.replace(/s$/, '') : noun}`}</Button>
    </footer>
  </Dialog>
  return <DialogTrigger isOpen={open} onOpenChange={onOpenChange}>
    <Button isDisabled={disabled} className="sb-roster-filter-trigger"><FilterIcon size={17} /><span>Filters{activeCount ? ` (${activeCount})` : ''}</span></Button>
    {compact ? <ModalOverlay isDismissable className="sb-roster-filter-overlay"><Modal className="sb-roster-filter-sheet">{content}</Modal></ModalOverlay>
      : <Popover placement="bottom end" offset={8} containerPadding={12} className="sb-roster-filter-popover">{content}</Popover>}
  </DialogTrigger>
}
