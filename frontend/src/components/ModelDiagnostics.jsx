import { useState } from 'react'
import useJsonResource from '../hooks/useJsonResource'
import { API_BASE } from '../lib/verifiedApi'
import '../styles/ModelDiagnostics.css'

const f = value => value.toFixed(4)
const interval = value => `${f(value.lower)} ~ ${f(value.upper)}`
function validate(data) {
  const unit = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
  if (data?.schema !== 't0-diagnostics-v1' || !Array.isArray(data.seed_results) || data.seed_results.length !== 5 || !Array.isArray(data.validation_threshold_curve) || data.validation_threshold_curve.length !== 91 || !data.bootstrap?.intervals || data.bootstrap.confidence !== .95 || data.bootstrap.attempted !== 2000 || !Number.isSafeInteger(data.bootstrap.valid) || data.bootstrap.valid < 2 || !unit(data.baseline_selected_threshold)) throw new Error('추가 진단의 표본과 형식을 확인할 수 없습니다.')
  for (const row of data.seed_results) {
    if (!Number.isSafeInteger(row.seed) || !unit(row.threshold_validation_f1)) throw new Error('시드별 설정을 확인할 수 없습니다.')
    for (const split of ['validation', 'test']) for (const key of ['auc', 'f1', 'precision', 'recall']) if (!unit(row[split]?.[key])) throw new Error('시드별 성능 값을 확인할 수 없습니다.')
  }
  for (const key of ['auc', 'f1']) {
    const stats = data.test_seed_summary?.[key]
    const bounds = data.bootstrap.intervals.embedding_mlp?.[key]
    if (!unit(stats?.mean) || !unit(stats?.std_sample) || !unit(bounds?.lower) || !unit(bounds?.upper) || bounds.lower > bounds.upper) throw new Error('진단 범위의 숫자를 확인할 수 없습니다.')
  }
  for (const point of data.validation_threshold_curve) if (!unit(point.threshold) || !unit(point.precision) || !unit(point.recall) || !unit(point.f1)) throw new Error('임계값 곡선이 유효하지 않습니다.')
  if (!Array.isArray(data.limits) || data.limits.some(value => typeof value !== 'string') || !Number.isSafeInteger(data.bootstrap.events) || !Number.isSafeInteger(data.bootstrap.videos) || data.bootstrap.videos <= 0 || data.bootstrap.videos > data.bootstrap.events) throw new Error('추가 진단의 평가 범위를 확인할 수 없습니다.')
  return data
}

export default function ModelDiagnostics({ baselineRun }) {
  const resource = useJsonResource(`${API_BASE}/predict/t0-verified/diagnostics`, { normalize: validate, timeoutMs: 12000 })
  const [threshold, setThreshold] = useState(44)
  const data = resource.data?.base_run_id === baselineRun ? resource.data : null
  const error = resource.error || (resource.data && !data ? '현재 기준 실험과 진단 보고서가 일치하지 않습니다.' : '')
  const point = data?.validation_threshold_curve.find(row => Math.round(row.threshold * 100) === threshold)
  return <section className="verified-panel model-diagnostics" data-testid="model-diagnostics"><h2>학습 변동과 오탐 추가 진단</h2>
    <p>같은 시간 분할에서 학습 변동과 기준 시드 42의 표본 오차를 따로 확인합니다. 이미 확인한 Test를 이용한 추가 진단입니다.</p>
    {resource.loading && <p role="status">추가 진단을 불러오는 중입니다.</p>}
    {error && <div><p role="status">{error}</p><button className="verified-button secondary" onClick={resource.retry}>추가 진단 다시 불러오기</button></div>}
    {data && <><p>진단 ID: {data.run_id} · 기준 실험: {data.base_run_id}</p>
      <div className="verified-metrics"><div className="verified-metric"><span>5개 시드 Test AUC 평균 ± 표본 표준편차</span><strong data-testid="seed-auc-summary">{f(data.test_seed_summary.auc.mean)} ± {f(data.test_seed_summary.auc.std_sample)}</strong></div><div className="verified-metric"><span>5개 시드 Test F1 평균 ± 표본 표준편차</span><strong>{f(data.test_seed_summary.f1.mean)} ± {f(data.test_seed_summary.f1.std_sample)}</strong></div></div>
      <div className="verified-table-wrap" role="region" aria-label="학습 시드 비교" tabIndex={0}><table className="verified-table" data-testid="seed-comparison"><caption>고정된 모델 종류·분할·전처리. 각 시드의 임계값은 Validation F1로 선정했습니다. 시드 42는 기존 checkpoint를 재사용했으며 Test 최고 시드로 모델을 교체하지 않았습니다.</caption><thead><tr><th>시드</th><th>Val AUC</th><th>Test AUC</th><th>Test F1</th><th>정밀도</th><th>재현율</th><th>임계값</th></tr></thead><tbody>{data.seed_results.map(row => <tr key={row.seed}><th scope="row">{row.seed}</th><td>{f(row.validation.auc)}</td><td>{f(row.test.auc)}</td><td>{f(row.test.f1)}</td><td>{f(row.test.precision)}</td><td>{f(row.test.recall)}</td><td>{row.threshold_validation_f1}</td></tr>)}</tbody></table></div>
      <h3>기준 시드 42의 영상 단위 95% 재표집 구간</h3><p>Test 이벤트 {data.bootstrap.events.toLocaleString('ko-KR')}건 / 영상 {data.bootstrap.videos.toLocaleString('ko-KR')}개. 시도 {data.bootstrap.attempted.toLocaleString('ko-KR')}회 중 유효 {data.bootstrap.valid.toLocaleString('ko-KR')}회. 같은 영상의 모든 이벤트를 함께 재표집합니다.</p><p data-testid="bootstrap-auc">AUC: {interval(data.bootstrap.intervals.embedding_mlp.auc)} · F1: {interval(data.bootstrap.intervals.embedding_mlp.f1)}</p><p>이는 이 기간·고정 모델에 대한 조건부 구간입니다. 다른 기간의 성능 범위나 여러 시드 평균의 신뢰구간과 다릅니다.</p>
      <h3>Validation 임계값별 정밀도·재현율</h3><label>탐색할 임계값 {threshold / 100}<input aria-label="Validation 탐색 임계값" type="range" min="5" max="95" step="1" value={threshold} onChange={event => setThreshold(Number(event.target.value))} /></label>{point && <p data-testid="validation-threshold-point">정밀도 {f(point.precision)} · 재현율 {f(point.recall)} · F1 {f(point.f1)}</p>}<p>현재 모델의 판정 임계값은 {data.baseline_selected_threshold}입니다. 이 조작은 Validation 표를 탐색하며 실제 예측의 설정을 바꾸지 않습니다.</p>
      <details><summary>추가 진단의 제한 사항 원문</summary><ul>{data.limits.map(limit => <li key={limit}>{limit}</li>)}</ul></details>
    </>}
  </section>
}
