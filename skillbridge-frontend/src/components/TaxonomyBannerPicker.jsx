import { useId } from 'react'
import TaxonomyCardBanner from './TaxonomyCardBanner'
import { TAXONOMY_BANNER_COLORS } from '../utils/taxonomyBannerColors'

export default function TaxonomyBannerPicker({ value, uploaded, onChange, disabled }) {
  const id = useId()

  return <fieldset disabled={disabled} className="space-y-2">
    <legend className="text-xs font-semibold text-gray-700 dark:text-gray-200">Geometric banner colors</legend>
    <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">Choose a geometric banner or upload your own below.</p>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {TAXONOMY_BANNER_COLORS.map((name, index) => <label key={name}
        className={`relative min-w-0 cursor-pointer overflow-hidden rounded-lg border p-1 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green-600 ${!uploaded && value === index
          ? 'border-green-600 ring-1 ring-green-600 dark:border-green-400 dark:ring-green-400'
          : 'border-gray-200 hover:border-green-500 dark:border-gray-700 dark:hover:border-green-500'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <input type="radio" name={id} value={index} aria-label={`${name} geometric banner`}
          checked={!uploaded && value === index} onChange={() => onChange(index)}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
        <span className="block aspect-[3/1] overflow-hidden rounded">
          <TaxonomyCardBanner color={index} />
        </span>
        <span className="block py-1 text-xs font-medium text-gray-700 dark:text-gray-200">{name}</span>
      </label>)}
    </div>
  </fieldset>
}
