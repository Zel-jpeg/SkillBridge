import { useEffect, useRef, useState } from 'react'
import { PlusIcon, RefreshIcon } from './Icons'

const action = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50'

export default function RetakeImageUpload({ image, onChange, disabled }) {
  const input = useRef(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const preview = image?.preview

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function selectFiles(files) {
    if (disabled || !files?.length) return
    if (files.length !== 1) { setError('Choose one supporting image at a time.'); return }
    const file = files[0]
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image up to 5 MiB.')
      return
    }
    setError('')
    onChange({ file, preview: URL.createObjectURL(file) })
  }

  function removeImage() {
    onChange(null)
    if (input.current) input.current.value = ''
  }

  return <div>
    <p id="supporting-image-label" className="text-sm font-medium">Supporting image (optional)</p>
    <input ref={input} id="retake-image" type="file" accept="image/jpeg,image/png,image/webp"
      aria-labelledby="supporting-image-label" aria-describedby="retake-image-help" tabIndex={-1}
      disabled={disabled} className="sr-only" onChange={event => {
        selectFiles(event.target.files)
        event.target.value = ''
      }} />
    <div role="group" aria-labelledby="supporting-image-label" aria-describedby="retake-image-help"
      className={`mt-2 rounded-xl border-2 border-dashed p-4 transition-colors sm:p-6 ${dragging
        ? 'border-green-600 bg-green-50 dark:border-green-400 dark:bg-green-950/40'
        : 'border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-950/30'}`}
      onDragEnter={event => {
        event.preventDefault()
        if (!disabled && event.dataTransfer.types.includes('Files')) { dragDepth.current += 1; setDragging(true) }
      }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy' }}
      onDragLeave={event => {
        event.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDragging(false)
      }}
      onDrop={event => {
        event.preventDefault()
        dragDepth.current = 0; setDragging(false)
        selectFiles(event.dataTransfer.files)
      }}>
      <div className="flex flex-col items-center gap-3 text-center">
        <button type="button" disabled={disabled} onClick={() => input.current?.click()}
          className={`${action} border-gray-300 bg-white text-gray-700 shadow-sm hover:border-green-600 hover:bg-green-50 hover:text-green-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-200`}>
          <span aria-hidden="true">{image ? <RefreshIcon size={16} /> : <PlusIcon size={16} />}</span>
          {image ? 'Replace image' : 'Add image'}
        </button>
        <p className="text-sm text-gray-700 dark:text-gray-200">{dragging ? 'Drop your image here' : image ? 'Drag and drop another image to replace it' : 'Choose an image or drag and drop it here'}</p>
        <p id="retake-image-help" className="text-xs text-gray-500 dark:text-gray-400">JPEG, PNG or WebP · Up to 5 MiB · One image</p>
      </div>
      {image && <div className="mt-5 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <img key={preview} src={preview} alt="Preview of your supporting image" className="max-h-72 w-full bg-gray-100 object-contain dark:bg-gray-950"
          onError={() => { removeImage(); setError('This image could not be previewed. Choose a valid JPEG, PNG or WebP image.') }} />
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0 flex-1 text-xs"><p className="break-all font-medium">{image.file.name}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{Math.max(1, Math.ceil(image.file.size / 1024))} KiB · Ready to send with your request</p></div>
          <button type="button" disabled={disabled} onClick={() => { removeImage(); setError('') }}
            className={`${action} border-transparent text-rose-700 hover:border-rose-200 hover:bg-rose-50 dark:text-rose-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40`}>Remove image</button>
        </div>
      </div>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    <p className="mt-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">Crop unrelated messages and personal information before uploading. Your image is visible only to you and authorized reviewers.</p>
  </div>
}
