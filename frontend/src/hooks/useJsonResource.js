import { useEffect, useState } from 'react'
import { fetchJson } from '../lib/fetchJson'

const identity = value => value

export default function useJsonResource(url, { timeoutMs = 10000, normalize = identity } = {}) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(null)
  const requestKey = `${url}:${attempt}`
  useEffect(() => {
    const controller = new AbortController()
    fetchJson(url, { signal: controller.signal, timeoutMs })
      .then(value => {
        const data = normalize(value)
        if (!controller.signal.aborted) setState({ requestKey, data, error: '' })
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ requestKey, data: null, error: error.message })
      })
    return () => controller.abort()
  }, [url, timeoutMs, normalize, requestKey])
  const current = state?.requestKey === requestKey ? state : null
  return {
    data: current?.data ?? null,
    error: current?.error || '',
    loading: current === null,
    retry: () => setAttempt(value => value + 1),
  }
}
