export const organizationButton = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
export const organizationPrimary = `${organizationButton} border-transparent bg-green-700 text-white hover:bg-green-800 dark:text-white dark:hover:bg-green-800`
export const organizationField = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:outline-2 focus:outline-green-600 dark:border-gray-600 dark:bg-gray-900 dark:text-white'

export function organizationError(result) {
  const describe = value => Array.isArray(value) ? value.map(describe).join(' ') : value && typeof value === 'object' ? Object.values(value).map(describe).join(' ') : String(value)
  if (result.raw && typeof result.raw === 'object') {
    return Object.entries(result.raw).map(([key, value]) => `${key === 'error' || key === 'non_field_errors' ? '' : `${key}: `}${describe(value)}`).join(' ')
  }
  return result.message || 'Changes could not be confirmed. Check the list before retrying.'
}
