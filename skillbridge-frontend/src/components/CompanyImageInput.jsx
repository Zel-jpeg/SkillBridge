import { useEffect, useId, useRef, useState } from 'react'
import CompanyImage from './CompanyImage'
import { RefreshIcon, TrashIcon } from './Icons'
import { companyImageError } from '../utils/companyImages'

function UploadIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 16V3m-5 5 5-5 5 5M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />
  </svg>
}

export default function CompanyImageInput({ name, imageUrl, value, onChange, disabled }) {
  const id = useId()
  const input = useRef(null)
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!value.file) return
    const url = URL.createObjectURL(value.file)
    // The URL is an external browser resource, revoked on replacement/unmount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview({ file: value.file, url })
    return () => URL.revokeObjectURL(url)
  }, [value.file])
  const displayUrl = value.action === 'remove' ? null : value.file
    ? (preview?.file === value.file ? preview.url : null) : imageUrl
  const hasImage = value.action !== 'remove' && Boolean(imageUrl || value.file)
  const helpId = `${id}-formats ${id}-help${value.error ? ` ${id}-error` : ''}`

  function selectFile(file) {
    if (!file || disabled) return
    const error = companyImageError(file)
    onChange(error ? { ...value, error } : { action: 'replace', file, error: '' })
  }

  function reset(action) {
    input.current.value = ''
    onChange({ action, file: null, error: '' })
  }
  return <div className="space-y-2.5">
    <label htmlFor={id} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
      Company image <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
    </label>
    <div role="group" aria-label="Company image upload"
      onDragOver={event => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
      }}
      onDrop={event => {
        event.preventDefault()
        setDragging(false)
        if (disabled) return
        if (event.dataTransfer.files.length > 1) {
          onChange({ ...value, error: 'Choose one company image at a time.' })
          return
        }
        selectFile(event.dataTransfer.files[0])
      }}
      className={`space-y-3 ${disabled ? 'opacity-60' : ''}`}>
      <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
        tabIndex={-1} aria-describedby={helpId} aria-invalid={Boolean(value.error)} className="sr-only"
        onChange={event => {
          selectFile(event.target.files?.[0])
          // Selecting the same file again must still trigger validation.
          event.target.value = ''
        }} />
      {hasImage && <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
        <CompanyImage name={name} imageUrl={displayUrl} className="h-14 w-14 rounded-lg" loading="eager" />
        <div className="min-w-0 flex-1">
          <p title={value.file?.name} className="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">{value.file?.name || 'Current company logo'}</p>
          {value.file ? <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            <span>{value.file.size < 1024 * 1024 ? `${Math.max(1, Math.round(value.file.size / 1024))} KB` : `${(value.file.size / (1024 * 1024)).toFixed(1)} MB`}</span>
            <span className={`inline-flex items-center gap-1.5 font-medium ${value.error ? 'text-gray-500 dark:text-gray-400' : 'text-green-700 dark:text-green-400'}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{value.error ? 'Previous selection kept' : 'Ready to save'}
            </span>
          </div> : <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Currently displayed on your company profile</p>}
        </div>
        <button type="button" aria-label="Remove image" title="Remove image" disabled={disabled} onClick={() => reset('remove')}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-300">
          <span aria-hidden="true"><TrashIcon size={16} /></span>
        </button>
      </div>}
      <div className={`flex min-h-40 flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
        dragging ? 'border-green-500 bg-green-50 ring-2 ring-green-500/15 dark:border-green-400 dark:bg-green-950/30'
          : value.error ? 'border-rose-300 bg-rose-50/30 dark:border-rose-800 dark:bg-rose-950/10'
            : 'border-gray-300 bg-gray-50/40 dark:border-gray-600 dark:bg-gray-800/20'
      }`}>
        <button type="button" disabled={disabled} onClick={() => input.current.click()} aria-describedby={helpId}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-xs transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
          <UploadIcon />{hasImage ? 'Replace image' : 'Upload image'}
        </button>
        <div>
          <p className="text-xs font-medium leading-5 text-gray-700 dark:text-gray-200">
            {dragging ? 'Drop your image here' : 'Choose an image or drag and drop it here'}
          </p>
          <p id={`${id}-formats`} className="mt-1 text-[11px] leading-5 text-gray-500 dark:text-gray-400">JPEG, PNG or WebP · Up to 5 MiB</p>
        </div>
      </div>
      {(value.action !== 'unchanged' || value.error) && <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {value.action === 'remove' && <p className="text-xs text-gray-500 dark:text-gray-400">Your current image will be removed when you save.</p>}
        <button type="button" disabled={disabled} onClick={() => reset('unchanged')}
          className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-100">
          <span aria-hidden="true"><RefreshIcon size={12} /></span>Undo image change
        </button>
      </div>}
    </div>
    <p id={`${id}-help`} className="text-[11px] leading-5 text-gray-500 dark:text-gray-400">
      Company images are publicly visible.
    </p>
    {value.error && <p id={`${id}-error`} role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{value.error}</p>}
  </div>
}
