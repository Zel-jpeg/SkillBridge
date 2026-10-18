export default function MapStatus({ status, onRetry }) {
  if (status === 'ready') return null
  return <div role="status" className="absolute top-2 left-2 right-2 z-1000 rounded-lg border border-gray-200 bg-white/95 p-3 text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200">
    {status === 'loading' ? 'Loading map…' : <>
      <p>{status === 'tiles' ? 'Map tiles are unavailable. Location pins are retained.' : 'Map is unavailable. Saved locations and results are retained.'}</p>
      <button type="button" onClick={onRetry} className="mt-2 rounded border border-green-600 px-3 py-1.5 font-medium text-green-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:text-green-300">Retry map</button>
    </>}
  </div>
}
