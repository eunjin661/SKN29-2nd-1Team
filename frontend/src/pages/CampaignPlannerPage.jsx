import { useEffect, useRef, useState } from 'react'
import useJsonResource from '../hooks/useJsonResource'
import { fetchJson } from '../lib/fetchJson'
import { csvCell } from '../lib/csv'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import '../styles/CampaignPlannerPage.css'
import '../styles/Scenario.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const initial = { budget: '', cpm: '', ctr: '', cvr: '', shares: {} }
const num = value => typeof value === 'number' && Number.isFinite(value) ? value > 0 && value < .01 ? '0.01 미만' : value.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '계산 불가'
function reference(data) {
  if (data?.schema !== 'campaign-reference-v1' || data.source !== 'historical_observed_events' || !Array.isArray(data.categories) || !data.categories.length || !Number.isSafeInteger(data.population?.events) || data.categories.some(row => typeof row.category !== 'string' || !Number.isSafeInteger(row.events) || row.events < 0) || data.categories.reduce((sum, row) => sum + row.events, 0) !== data.population.events) throw new Error('관측 참고 자료의 집계를 확인할 수 없습니다.')
  return data
}
function requestBody(form, categories) {
  if (!/^\d+$/.test(form.budget) || !Number.isSafeInteger(Number(form.budget)) || Number(form.budget) > 1e12) throw new Error('예산은 0 이상 1조원 이하의 정수로 입력하세요.')
  if (!/^\d+$/.test(form.cpm) || Number(form.cpm) <= 0 || Number(form.cpm) > 1e9) throw new Error('CPM은 0보다 큰 10억원 이하 정수로 입력하세요.')
  const percent = (value, label) => {
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 100) throw new Error(`${label}은 0~100% 범위에서 소수 둘째 자리까지 입력하세요.`)
    return value
  }
  const allocations = categories.map(row => ({ category: row.category, share_percent: percent(form.shares[row.category] ?? '', `${row.category} 배분`) }))
  if (allocations.reduce((sum, row) => sum + Math.round(Number(row.share_percent) * 100), 0) !== 10000) throw new Error('카테고리 예산 배분의 합계를 정확히 100%로 맞추세요.')
  return { budget_won: Number(form.budget), cpm_won: Number(form.cpm), ctr_percent: percent(form.ctr, '클릭률'), cvr_percent: percent(form.cvr, '전환율'), allocations }
}
function validateResult(data, body) {
  const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
  if (data?.schema !== 'campaign-scenario-v1' || data.source !== 'user_assumptions' || data.model_used !== false || !Array.isArray(data.rows) || data.rows.length !== body.allocations.length || data.assumptions?.budget_won !== body.budget_won || data.assumptions?.cpm_won !== body.cpm_won || Number(data.assumptions?.ctr_percent) !== Number(body.ctr_percent) || Number(data.assumptions?.cvr_percent) !== Number(body.cvr_percent) || data.rows.reduce((sum, row) => sum + row.budget_won, 0) !== body.budget_won || data.rows.some((row, i) => row.category !== body.allocations[i].category || Number(row.share_percent) !== Number(body.allocations[i].share_percent) || !Number.isSafeInteger(row.budget_won))) throw new Error('현재 입력과 일치하는 계산 결과를 확인할 수 없습니다.')
  for (const row of [data.totals, ...data.rows]) if (!row || ['impressions', 'clicks', 'conversions'].some(key => !valid(row[key])) || !(row.cpa_won === null || valid(row.cpa_won)) || (row.conversions === 0 && row.cpa_won !== null)) throw new Error('계산 응답의 숫자와 단위를 확인할 수 없습니다.')
  return data
}

export default function CampaignPlannerPage() {
  const observations = useJsonResource(`${API}/campaign/plan`, { normalize: reference, timeoutMs: 12000 })
  const [form, setForm] = useState(initial)
  const [result, setResult] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef(null)
  const sequence = useRef(0)
  useEffect(() => () => { sequence.current++; controller.current?.abort() }, [])
  const edit = next => {
    sequence.current++; controller.current?.abort(); setPending(false); setResult(null); setError(''); setForm(next)
  }
  const categories = observations.data?.categories || []
  const sample = () => edit({ budget: '1000000', cpm: '10000', ctr: '1', cvr: '2', shares: Object.fromEntries(categories.map((row, i) => [row.category, i === 0 ? '100' : '0'])) })
  const calculate = async event => {
    event.preventDefault()
    if (pending || !observations.data) return
    let body
    try { body = requestBody(form, categories) } catch (failure) { setError(failure.message); return }
    controller.current?.abort()
    const active = new AbortController(); controller.current = active
    const id = ++sequence.current
    setPending(true); setResult(null); setError('')
    try {
      const response = validateResult(await fetchJson(`${API}/campaign/scenario`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: active.signal, timeoutMs: 12000 }), body)
      if (sequence.current === id && !active.signal.aborted) setResult(response)
    } catch (failure) {
      if (sequence.current === id && !active.signal.aborted) setError(failure.message)
    } finally {
      if (sequence.current === id) setPending(false)
    }
  }
  const download = () => {
    if (!result) return
    const a = result.assumptions
    const rows = [['source', 'user_assumptions'], ['budget_won', a.budget_won], ['cpm_won', a.cpm_won], ['ctr_percent_per_impression', a.ctr_percent], ['cvr_percent_per_click', a.cvr_percent], ['dataset_sha256', observations.data?.provenance.sha256], [], ['category', 'share_percent', 'budget_won', 'impressions', 'clicks', 'conversions', 'cpa_won'], ...result.rows.map(row => [row.category, row.share_percent, row.budget_won, row.impressions, row.clicks, row.conversions, row.cpa_won ?? '계산 불가'])]
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'campaign_user_assumptions.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <main className="campaign-page">
    <header className="campaign-hero"><div><p>USER ASSUMPTIONS</p><h1>캠페인 조건 계산기</h1><p>직접 정한 광고 조건의 산술 결과를 비교합니다. 실제 광고 성과와 전환율을 검증한 예측은 아닙니다.</p></div></header>
    {observations.loading && <LoadingState title="관측 참고 자료 로딩 중" />}
    {observations.error && <ErrorState title="관측 참고 자료를 불러오지 못했습니다" message={observations.error} onRetry={observations.retry} />}
    {observations.data && <>
      <section className="campaign-panel"><h2>계산에 사용할 가정</h2><p>관측 이벤트 {num(observations.data.population.events)}건을 참고합니다. 아래 CPM·클릭률·전환율은 사용자가 정하는 가정입니다.</p><button type="button" onClick={sample}>샘플 조건 채우기</button><p>샘플은 입력만 채웁니다. 계산 실행 후 결과가 표시됩니다.</p>
        <form onSubmit={calculate} noValidate>
          <div className="scenario-inputs">{[['budget', '총예산 (원)', '1'], ['cpm', 'CPM · 노출 1,000회당 비용 (원)', '1'], ['ctr', '클릭률 CTR · 노출 대비 (%)', '0.01'], ['cvr', '전환율 CVR · 클릭 대비 (%)', '0.01']].map(([key, label, step]) => <label key={key}>{label}<input type="number" min="0" step={step} value={form[key]} onChange={event => edit({ ...form, [key]: event.target.value })} /></label>)}</div>
          <h3>카테고리별 예산 배분</h3><p>관측 지속 시간은 과거 참고 정보입니다. 배분은 직접 정하며 합계가 100%여야 합니다.</p>
          <div className="scenario-allocations">{categories.map(row => <label key={row.category}><span>{row.category} · 관측 {num(row.events)}건 / 중앙 {num(row.median)}h</span><input aria-label={`${row.category} 예산 배분 (%)`} type="number" min="0" max="100" step="0.01" value={form.shares[row.category] ?? ''} onChange={event => edit({ ...form, shares: { ...form.shares, [row.category]: event.target.value } })} /></label>)}</div>
          <p>입력 배분 합계: {num(Object.values(form.shares).reduce((sum, value) => sum + (Number(value) || 0), 0))}%</p>
          <button className="scenario-submit" disabled={pending}>{pending ? '계산 중…' : '조건으로 계산하기'}</button>
        </form>
      </section>
      <section className="campaign-panel"><h2>계산식과 단위</h2><p>노출 수 = 예산 ÷ CPM × 1,000 · 클릭 수 = 노출 수 × CTR ÷ 100 · 전환 수 = 클릭 수 × CVR ÷ 100 · CPA = 예산 ÷ 전환 수</p><p>전환 수가 0이면 CPA는 계산할 수 없습니다. 노출은 중복을 제거한 도달 인원이 아닙니다. 계산 결과는 소수일 수 있고, 화면에서는 반올림합니다. 정수 원 단위 배분에는 소수 잔여가 큰 순서로 남은 예산을 배분합니다.</p></section>
    </>}
    {error && <div className="scenario-error" role="alert">{error}</div>}
    {result && <section className="campaign-panel" data-testid="scenario-result"><h2>입력 가정에 따른 계산 결과</h2><p data-testid="scenario-snapshot">예산 {num(result.assumptions.budget_won)}원 · CPM {num(result.assumptions.cpm_won)}원 · CTR {result.assumptions.ctr_percent}% · CVR {result.assumptions.cvr_percent}%</p><div className="scenario-results">{[['가정 노출 수', 'impressions'], ['가정 클릭 수', 'clicks'], ['가정 전환 수', 'conversions'], ['전환당 비용 (원)', 'cpa_won']].map(([label, key]) => <article key={key}><span>{label}</span><strong data-testid={`scenario-${key}`}>{num(result.totals[key])}</strong></article>)}</div><div className="scenario-table"><table><caption>직접 입력한 배분과 조건으로 계산한 결과</caption><thead><tr><th>카테고리</th><th>배분</th><th>예산</th><th>노출</th><th>클릭</th><th>전환</th><th>CPA</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.category}><th scope="row">{row.category}</th>{['share_percent', 'budget_won', 'impressions', 'clicks', 'conversions', 'cpa_won'].map(key => <td key={key}>{num(row[key])}</td>)}</tr>)}</tbody></table></div><button onClick={download}>가정·결과 CSV 다운로드</button><p>실측 광고 성과·모델 점수·수익률로 해석할 수 없습니다.</p></section>}
  </main>
}
