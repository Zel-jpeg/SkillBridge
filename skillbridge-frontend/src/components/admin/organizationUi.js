const buttonBase = 'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50'
export const organizationButton = `${buttonBase} border-gray-200 text-gray-700 enabled:hover:border-green-400 enabled:hover:bg-green-50 dark:border-gray-700 dark:text-gray-200 dark:enabled:hover:border-green-600 dark:enabled:hover:bg-green-950/50`
export const organizationPrimary = `${buttonBase} border-transparent bg-green-700 text-white enabled:hover:bg-green-800 dark:text-white dark:enabled:hover:bg-green-800`
export const organizationField = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 transition-colors hover:border-green-400 focus:outline-2 focus:outline-green-600 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:border-green-600'
export const organizationCard = 'min-w-0 rounded-2xl border border-gray-200 bg-white transition-[border-color,box-shadow] hover:border-green-300 hover:shadow-sm focus-within:border-green-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-green-700'

export function organizationError(result) {
  const describe = value => Array.isArray(value) ? value.map(describe).join(' ') : value && typeof value === 'object' ? Object.values(value).map(describe).join(' ') : String(value)
  if (result.raw && typeof result.raw === 'object') {
    return Object.entries(result.raw).map(([key, value]) => `${key === 'error' || key === 'non_field_errors' ? '' : `${key}: `}${describe(value)}`).join(' ')
  }
  return result.message || 'Changes could not be confirmed. Check the list before retrying.'
}
