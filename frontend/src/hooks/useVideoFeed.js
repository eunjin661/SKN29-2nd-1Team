import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchVideoFeed, readInitialVideoFeed } from '../lib/videoFeed'

export default function useVideoFeed(category) {
  const [feed, setFeed] = useState(readInitialVideoFeed)
  const [request, setRequest] = useState({ attempt: 0, automatic: false })
  const active = useRef(null)
  const key = `${category}:${request.attempt}`

  const refresh = useCallback((automatic = false) => {
    active.current?.abort()
    setRequest(previous => ({ attempt: previous.attempt + 1, automatic }))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    active.current = controller
    fetchVideoFeed(category, { signal: controller.signal, force: true })
      .then(result => {
        if (!controller.signal.aborted) setFeed(previous => ({ ...result, key, groups: { ...previous.groups, ...result.groups } }))
      })
      .catch(error => {
        if (!controller.signal.aborted) setFeed(previous => {
          const cached = Boolean(previous.groups[category]?.length)
          return { ...previous, key,
            source: cached ? '이전 캐시 데이터 · API 지연' : '영상 API 연결 확인 필요',
            error: cached ? `최신 영상을 갱신하지 못했습니다. 이전 관측을 표시합니다. ${error.message}` : `영상 데이터를 불러오지 못했습니다. ${error.message}`,
          }
        })
      })
      .finally(() => { if (active.current === controller) active.current = null })
    return () => controller.abort()
  }, [category, key])

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !active.current) refresh(true)
    }, 20000)
    return () => clearInterval(timer)
  }, [refresh])

  const pending = feed.key !== key
  return { ...feed, error: pending ? '' : feed.error,
    loading: pending && !feed.groups[category]?.length,
    refreshing: pending && !request.automatic,
    autoRefreshing: pending && request.automatic,
    refresh,
  }
}
