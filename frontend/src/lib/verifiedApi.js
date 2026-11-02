export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
export const REQUEST_TIMEOUT_MS = 12000

export class ApiError extends Error {
  constructor(message, status = 0, fields = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

export async function verifiedRequest(path, { signal, ...options } = {}) {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS)
  const abort = () => timeout.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) timeout.abort()
  try {
    const response = await fetch(`${API_BASE}/predict/t0-verified${path}`, { ...options, signal: timeout.signal, cache: 'no-store' })
    let body
    try { body = await response.json() } catch (error) { if (timeout.signal.aborted) throw error; body = null }
    if (!response.ok) {
      const fields = {}
      if (Array.isArray(body?.detail)) body.detail.forEach(item => { fields[item.loc?.at(-1)] = '입력 형식과 허용 범위를 확인하세요.' })
      const message = response.status === 503
        ? '검증된 모델을 사용할 수 없습니다. 서버의 실험 설정과 산출물을 확인한 뒤 다시 시도하세요.'
        : response.status === 422
          ? (typeof body?.detail === 'string' ? `입력을 확인하세요: ${body.detail}` : '입력값이 모델의 허용 범위와 맞지 않습니다.')
          : `요청을 처리하지 못했습니다. (HTTP ${response.status})`
      throw new ApiError(message, response.status, fields)
    }
    if (!body || typeof body !== 'object') throw new ApiError('서버 응답 형식을 확인할 수 없습니다.')
    return body
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof ApiError) throw error
    if (timeout.signal.aborted) throw new ApiError('응답 시간이 초과되었습니다. 연결 상태를 확인한 뒤 다시 시도하세요.')
    throw new ApiError('서버에 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도하세요.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function validatePrediction(body) {
  const prediction = body.predictions?.[0]
  if (typeof body.run_id !== 'string' || !body.run_id || typeof body.model !== 'string' || !body.model ||
      body.target !== 'tdi_v2' || typeof body.threshold !== 'number' || !Number.isFinite(body.threshold) || body.threshold < 0 || body.threshold > 1 ||
      !Array.isArray(body.predictions) || body.predictions.length !== 1 ||
      typeof prediction?.probability !== 'number' || !Number.isFinite(prediction.probability) || prediction.probability < 0 || prediction.probability > 1 ||
      ![0, 1].includes(prediction.label) || prediction.label !== Number(prediction.probability >= body.threshold)) {
    throw new ApiError('예측 응답을 검증하지 못했습니다. 다시 시도하세요.')
  }
  return body
}
