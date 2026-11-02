export class RequestError extends Error {
  constructor(message, kind, status = 0) {
    super(message)
    this.name = 'RequestError'
    this.kind = kind
    this.status = status
  }
}

export async function fetchJson(url, { signal, timeoutMs = 10000, ...options } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(abort, timeoutMs)
  try {
    const response = await fetch(url, { cache: 'no-store', ...options, signal: controller.signal })
    if (!response.ok) throw new RequestError(`HTTP ${response.status}`, 'http', response.status)
    return await response.json()
  } catch (error) {
    if (signal?.aborted || error instanceof RequestError) throw error
    if (controller.signal.aborted) throw new RequestError('응답 시간이 초과되었습니다.', 'timeout')
    if (error instanceof SyntaxError) throw new RequestError('서버 응답 형식을 확인할 수 없습니다.', 'response')
    throw new RequestError('서버에 연결할 수 없습니다.', 'network')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
