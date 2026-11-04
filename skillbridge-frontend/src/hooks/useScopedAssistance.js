import { useEffect, useRef, useState } from 'react'
import api from '../api/axios'
import { requestErrorMessage } from '../api/requestErrors'

/** Suggestions never mutate form content; obsolete input/context responses stay hidden. */
export function useScopedAssistance(url, input, definitionDigest) {
  const key = JSON.stringify([url, input, definitionDigest])
  const [result, setResult] = useState(null)
  const generation = useRef(0)
  const controller = useRef(null)
  useEffect(() => () => { generation.current++; controller.current?.abort() }, [key])
  async function run() {
    controller.current?.abort()
    const active = new AbortController()
    controller.current = active
    const ticket = ++generation.current
    setResult({ key, phase: 'loading' })
    try {
      const { data } = await api.post(url, input, { signal: active.signal })
      if (!active.signal.aborted && generation.current === ticket) {
        setResult(data.framework_digest === definitionDigest ? { key, phase: 'ready', data } :
          { key, phase: 'error', error: 'The catalog changed. Refresh the catalog before requesting suggestions again. Your manual content is still available.' })
      }
    } catch (failure) {
      if (!active.signal.aborted && generation.current === ticket) {
        // A failed advisory POST did not attempt to save anything.
        setResult({ key, phase: 'error', error: requestErrorMessage(failure.response ? failure : {}) })
      }
    }
  }
  const current = result?.key === key ? result : null
  return { run, loading: current?.phase === 'loading', data: current?.data, error: current?.error }
}
