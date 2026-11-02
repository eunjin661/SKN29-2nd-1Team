import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useVerifiedResource from '../hooks/useVerifiedResource'
import { ApiError, validatePrediction, verifiedRequest } from '../lib/verifiedApi'
import '../styles/PredictionPage.css'

const EMPTY = { T0: '', published_at: '', entry_rank: '', T0_view: '', T0_comment: '', category_group: '' }
const SAMPLE = { T0: '2025-02-01T12:00', published_at: '2025-02-01T00:00', entry_rank: '30', T0_view: '100000', T0_comment: '250', category_group: 'Entertainment' }
const LABELS = { T0: '최초 차트 진입 시각 (KST)', published_at: '영상 발행 시각 (KST)', entry_rank: '최초 진입 순위', T0_view: '진입 당시 조회수', T0_comment: '진입 당시 댓글 수', category_group: '카테고리' }
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

function observation(form, categories) {
  const errors = {}
  for (const key of ['T0', 'published_at']) {
    const time = new Date(`${form[key]}:00+09:00`)
    if (!DATE_PATTERN.test(form[key]) || !Number.isFinite(time.getTime()) || new Date(time.getTime() + 9 * 3600000).toISOString().slice(0, 16) !== form[key]) errors[key] = '유효한 날짜와 시각을 입력하세요.'
  }
  if (!errors.T0 && !errors.published_at && form.published_at > form.T0) errors.published_at = '발행 시각은 최초 진입 시각보다 늦을 수 없습니다.'
  for (const key of ['entry_rank', 'T0_view', 'T0_comment']) {
    const value = Number(form[key])
    if (!/^\d+$/.test(form[key]) || !Number.isSafeInteger(value) || value < (key === 'entry_rank' ? 1 : 0) || (key === 'entry_rank' && value > 200)) errors[key] = key === 'entry_rank' ? '1~200 사이의 정수를 입력하세요.' : '0 이상의 정수를 입력하세요.'
  }
  if (!categories.includes(form.category_group)) errors.category_group = '학습 범위에 포함된 카테고리를 선택하세요.'
  return { errors, payload: { ...form, T0: `${form.T0}:00+09:00`, published_at: `${form.published_at}:00+09:00`, entry_rank: Number(form.entry_rank), T0_view: Number(form.T0_view), T0_comment: Number(form.T0_comment) } }
}

function PredictionResult({ result }) {
  const response = result.response
  const row = response.predictions[0]
  return <section className="verified-panel verified-result" aria-labelledby="result-title" aria-live="polite" data-testid="prediction-result">
    <div className="verified-eyebrow">검증된 T0 분류 결과</div>
    <h2 id="result-title">{row.label === 1 ? '고지속 후보' : '고지속 후보 아님'}</h2>
    <p>학습 데이터의 TDI v2 기준으로 분류한 결과입니다.</p>
    <div className="verified-score"><span>모델 점수</span><strong data-testid="model-score">{row.probability.toFixed(4)}</strong><small>0~1 범위 · 클수록 고지속 후보 쪽</small></div>
    <div className="verified-meter" aria-hidden="true"><span style={{ width: `${row.probability * 100}%` }} /></div>
    <p className="verified-note">모델 점수는 정답률이나 교정된 확률이 아닙니다. Validation에서 선택한 판정 임계값 <b data-testid="model-threshold">{response.threshold}</b> 이상이면 고지속 후보로 표시합니다.</p>
    <dl className="verified-details"><div><dt>모델</dt><dd data-testid="result-model">{response.model}</dd></div><div><dt>실험 ID</dt><dd data-testid="result-run">{response.run_id}</dd></div><div><dt>정답 정의</dt><dd>TDI v2 ≥ 0.4</dd></div></dl>
    <details className="verified-snapshot" open><summary>이 결과에 사용한 입력</summary><dl className="verified-details">{Object.entries(result.input).map(([key, value]) => <div key={key}><dt>{LABELS[key]}</dt><dd>{value.replace?.('T', ' ') || value}</dd></div>)}</dl></details>
    <Link className="verified-link" to="/analysis/model">평가 조건과 전체 성능 보기 →</Link>
  </section>
}

export default function PredictionPage({ onBack }) {
  const status = useVerifiedResource('/status')
  const categories = status.data?.supported_categories || []
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const pending = useRef(null)
  const sequence = useRef(0)
  useEffect(() => () => { sequence.current += 1; pending.current?.abort() }, [])
  const changeForm = next => {
    const changed = Boolean(pending.current || result)
    sequence.current += 1
    pending.current?.abort()
    pending.current = null
    setLoading(false)
    setForm(next)
    setResult(null)
    setErrors({})
    setError('')
    setNotice(changed ? '입력이 변경되었습니다. 변경한 입력으로 다시 예측하세요.' : '')
  }
  const submit = async event => {
    event.preventDefault()
    if (pending.current || !status.data) return
    const { errors: fieldErrors, payload } = observation(form, categories)
    setErrors(fieldErrors)
    setError('')
    setResult(null)
    setNotice('')
    if (Object.keys(fieldErrors).length) { setError('표시된 입력 항목을 확인하세요.'); document.getElementById(`t0-${Object.keys(fieldErrors)[0]}`)?.focus(); return }
    const id = ++sequence.current
    const controller = new AbortController()
    pending.current = controller
    const input = { ...form }
    setLoading(true)
    try {
      const response = validatePrediction(await verifiedRequest('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal }))
      if (id === sequence.current) setResult({ response, input })
    } catch (failure) {
      if (id === sequence.current && !controller.signal.aborted) { setError(failure.message); if (failure instanceof ApiError) setErrors(failure.fields) }
    } finally {
      if (id === sequence.current) { pending.current = null; setLoading(false) }
    }
  }
  return <main className="yta-app-inner prediction-page verified-page">
    <button className="back-btn" onClick={onBack}>← 목록으로</button>
    <header className="verified-header"><span className="verified-eyebrow">T0 · 최초 진입 관측 기반</span><h1>트렌딩 지속성 예측</h1><p>차트에 처음 진입했을 때의 관측값으로 고지속 후보를 분류합니다. 모든 시각은 한국 표준시(KST)로 입력하세요.</p></header>
    <div className="verified-scope-note">현재 누적 조회수와 현재 순위는 이 입력을 대신할 수 없습니다. 정확한 최초 관측값이 없으면 검증된 T0 예측을 적용할 수 없습니다.</div>
    {status.loading && <p role="status">검증된 모델과 카테고리를 확인하고 있습니다.</p>}
    {status.error && <div role="alert" className="verified-error"><strong>모델 준비 상태를 확인할 수 없습니다.</strong><p>{status.error}</p><button className="verified-button secondary" onClick={status.retry}>모델 상태 다시 확인</button></div>}
    <div className="verified-prediction-grid">
      <section className="verified-panel"><div className="verified-panel-head"><h2>최초 관측 입력</h2><button className="verified-button secondary" type="button" disabled={!status.data} onClick={() => changeForm({ ...SAMPLE, category_group: categories.includes(SAMPLE.category_group) ? SAMPLE.category_group : '' })}>샘플 입력 채우기</button></div>
        <p className="verified-note">샘플은 입력값만 채웁니다. 예측 실행 후 실제 모델 결과를 확인할 수 있습니다.</p>
        <form onSubmit={submit} noValidate aria-label="T0 예측 입력"><div className="verified-form-grid">{Object.keys(EMPTY).map(key => <div className="verified-field" key={key}>
          <label htmlFor={`t0-${key}`}>{LABELS[key]}</label>
          {key === 'category_group' ? <select id={`t0-${key}`} value={form[key]} onChange={event => changeForm({ ...form, [key]: event.target.value })} disabled={!status.data} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined} required><option value="">카테고리 선택</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select> : <input id={`t0-${key}`} type={['T0', 'published_at'].includes(key) ? 'datetime-local' : 'number'} value={form[key]} onChange={event => changeForm({ ...form, [key]: event.target.value })} min={key === 'entry_rank' ? 1 : 0} max={key === 'entry_rank' ? 200 : undefined} step={['T0', 'published_at'].includes(key) ? 60 : 1} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined} required />}
          {errors[key] && <span id={`error-${key}`} className="verified-field-error">{errors[key]}</span>}
        </div>)}</div>
          <p className="verified-note">요일, 시간대, 진입 지연, 댓글 비율은 서버에서 계산합니다.</p>
          {error && <div role="alert" className="verified-error">{error}</div>}
          {notice && <p role="status" className="verified-note">{notice}</p>}
          <button className="verified-button primary" type="submit" disabled={loading || !status.data}>{loading ? '예측 요청 중…' : error ? '다시 예측하기' : '예측 실행'}</button>
          {loading && <p role="status" className="verified-note">입력을 바꾸면 진행 중인 요청이 취소됩니다.</p>}
        </form>
      </section>
      {result ? <PredictionResult result={result} /> : <section className="verified-panel verified-empty" aria-live="polite" data-testid="empty-result"><span className="verified-eyebrow">분류 결과</span><h2>{loading ? '모델 응답을 기다리고 있습니다' : '입력 후 예측을 실행하세요'}</h2><p>요청이 성공하면 모델 점수, 판정 기준, 사용한 입력과 실험 ID가 여기에 표시됩니다.</p><Link className="verified-link" to="/analysis/model">현재 모델의 검증 결과 보기 →</Link></section>}
    </div>
  </main>
}
