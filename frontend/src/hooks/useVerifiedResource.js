import { useEffect, useState } from 'react'
import { ApiError, verifiedRequest } from '../lib/verifiedApi'

export default function useVerifiedResource(path) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  useEffect(() => {
    const controller = new AbortController()
    verifiedRequest(path, { signal: controller.signal })
      .then(data => {
        if (path === '/status' && (!Array.isArray(data.supported_categories) || !data.supported_categories.length || data.supported_categories.some(value => typeof value !== 'string' || !value))) throw new ApiError('학습된 카테고리 목록을 확인할 수 없습니다.')
        if (path === '/evaluation' && (!Array.isArray(data.models) || !data.models.some(row => row.name === data.selected_model) || !data.data?.splits || !Array.isArray(data.limits))) throw new ApiError('평가 보고서 형식을 확인할 수 없습니다.')
        if (!controller.signal.aborted) setState({ data, loading: false, error: '' })
      })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: error.message }) })
    return () => controller.abort()
  }, [path, attempt])
  const retry = () => { setState({ data: null, loading: true, error: '' }); setAttempt(value => value + 1) }
  return { ...state, retry }
}
