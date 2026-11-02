import { useEffect, useState } from 'react'
import { fetchJson } from '../lib/fetchJson'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useApiHealth(intervalMs = 30000) {
  const [apiOnline, setApiOnline] = useState(true)

  useEffect(() => {
    let active

    const check = async () => {
      active?.abort()
      const controller = new AbortController()
      active = controller
      try {
        await fetchJson(`${API}/healthz`, { signal: controller.signal, timeoutMs: 3000 })
        if (!controller.signal.aborted) setApiOnline(true)
      } catch {
        if (!controller.signal.aborted) setApiOnline(false)
      } finally {
        if (active === controller) active = null
      }
    }

    check()
    const id = setInterval(check, intervalMs)

    return () => {
      clearInterval(id)
      active?.abort()
    }
  }, [intervalMs])

  return apiOnline
}
