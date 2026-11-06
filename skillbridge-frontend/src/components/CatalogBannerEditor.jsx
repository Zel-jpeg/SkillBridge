import { useState } from 'react'
import CompanyImageInput from './CompanyImageInput'
import TaxonomyBannerPicker from './TaxonomyBannerPicker'
import { TAXONOMY_BANNER_COLORS } from '../utils/taxonomyBannerColors'

export default function CatalogBannerEditor({ item, program, name, code, color, onColorChange, image, onImageChange, disabled }) {
  const [mode, setMode] = useState(item?.image_url ? 'upload' : 'preset')
  const [expanded, setExpanded] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const uploaded = image.action !== 'remove' && Boolean(image.file || item?.image_url)
  function changeImage(value) {
    if (value.file || value.action === 'unchanged' && item?.image_url) { setMode('upload'); setExpanded(true) }
    onImageChange(value)
  }
  return <section aria-label="Card banner" className="min-w-0 space-y-3">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Card banner <span className="ml-2 text-xs font-normal text-gray-500">Optional</span></h3>
    <CompanyImageInput banner hideLabel bannerColor={color} label={program ? 'Program banner' : 'Institute banner'}
      name={name} imageUrl={item?.image_url} value={image} onChange={changeImage} disabled={disabled} previewBadge={code || (program ? 'PROGRAM' : 'INSTITUTE')}
      showUploadControls={expanded && mode === 'upload'} controlsPrefix={<>
        <button type="button" aria-expanded={expanded} disabled={disabled} onClick={() => setExpanded(value => !value)}
          className={`min-h-10 w-full cursor-pointer rounded-lg border border-gray-200 px-3 text-left text-xs font-semibold text-gray-700 hover:border-green-500 focus-visible:outline-2 focus-visible:outline-green-600 dark:border-gray-700 dark:text-gray-200 ${expanded ? 'md:hidden' : ''}`}>{expanded ? 'Hide banner options' : 'Change banner'}</button>
        {expanded && <>
        <div role="group" aria-label="Banner source" className="grid grid-cols-2 rounded-lg border border-gray-200 p-1 dark:border-gray-700">
          {[['preset', 'Preset colors'], ['upload', 'Upload image']].map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} disabled={disabled} onClick={() => setMode(value)}
            className={`min-h-10 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 ${mode === value ? 'bg-green-50 text-green-800 ring-1 ring-green-600 dark:bg-green-950 dark:text-green-200' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}`}>{label}</button>)}
        </div>
        {mode === 'preset' && <>
          <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Choose a preset or upload your own banner.</p>
          <TaxonomyBannerPicker compact value={color} uploaded={uploaded} disabled={disabled} onChange={value => {
            onColorChange(value); onImageChange({ action: 'remove', file: null, error: '' })
          }} />
          <p className="text-xs text-gray-600 dark:text-gray-300">{uploaded ? 'Current uploaded banner kept until you select a preset.' : <>Selected: <strong>{TAXONOMY_BANNER_COLORS[color]}</strong></>}</p>
        </>}
        </>}
      </>} />
  </section>
}
