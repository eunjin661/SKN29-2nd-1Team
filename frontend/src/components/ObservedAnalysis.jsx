import { Link } from 'react-router-dom'
import { useEDA } from '../hooks/useEDA'
import { csvCell } from '../lib/csv'
import LoadingState from './LoadingState'
import ErrorState from './ErrorState'
import '../styles/PredictionPage.css'
import '../styles/ObservedAnalysis.css'

const titles = { eda: 'EDA — 탐색적 데이터 분석', feature: '현재 모델의 입력과 전처리', insight: '관측 데이터 해석', problem: '문제 정의와 평가 표본', strategy: '관측 비교와 활용 범위' }
const num = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '자료 없음'
const pct = value => `${num(value * 100)}%`

function Bars({ rows, label, value, suffix = '' }) {
  const max = Math.max(1, ...rows.map(row => Number.isFinite(row[value]) ? row[value] : 0))
  return <div className="observed-bars">{rows.map((row, i) => <div className="observed-bar" key={`${row[label]}-${i}`}><span>{row[label]}</span><div><i style={{ width: `${((row[value] || 0) / max) * 100}%` }} /></div><strong>{num(row[value])}{suffix}</strong></div>)}</div>
}

function Download({ data }) {
  const download = () => {
    const rows = [['source', data.provenance.dataset], ['dataset_sha256', data.provenance.sha256], ['period_start', data.provenance.period_start], ['period_end', data.provenance.period_end], ['observed_events', data.population.events], ['tdi_population', data.tdi.population], ['tdi_excluded', data.tdi.excluded ?? ''], [], ['category', 'events', 'duration_n', 'duration_excluded', 'duration_median_h', 'duration_mean_h'], ...data.category_summary.map(row => [row.category, row.events, row.duration_n, row.duration_excluded, row.median, row.mean])]
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'trendit_observed_analysis.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <button className="verified-button secondary" onClick={download}>집계 CSV 다운로드</button>
}

export default function ObservedAnalysis({ onBack, view = 'eda' }) {
  const resource = useEDA(view)
  const data = resource.data
  const showEDA = view === 'eda'
  const categories = data?.category_summary || []
  const mostEvents = [...categories].sort((a, b) => b.events - a.events)[0]
  const longest = categories.filter(row => Number.isFinite(row.median)).sort((a, b) => b.median - a.median)[0]
  return <main className="yta-app-inner verified-page observed-page">
    {onBack && <button className="back-btn" onClick={onBack}>← 목록으로</button>}
    <header className="verified-header"><span className="verified-eyebrow">저장된 관측 · 출처와 표본 확인</span><h1>{titles[view]}</h1><p>관측 자료와 현재 T0 v2 실험의 정의를 연결합니다. 이미 관측한 결과를 미래 성과나 광고 효과로 해석할 수 없습니다.</p></header>
    {resource.loading && <LoadingState title="관측 집계 로딩 중" message="표본 수와 데이터 출처를 확인하고 있습니다." />}
    {resource.error && <ErrorState title="관측 집계를 불러오지 못했습니다" message={resource.error} onRetry={resource.retry} />}
    {data && <>
      <section className="verified-panel observed-source"><h2>자료 출처와 계산 범위</h2><p>{data.provenance.dataset} · KST {data.provenance.period_start} ~ {data.provenance.period_end}</p><p>전체 관측 <b data-testid="observed-events">{num(data.population.events)}</b>개 이벤트 / 고유 영상 {num(data.population.unique_videos)}개. TDI v2는 별도의 유효 표본을 사용합니다.</p><details><summary>자료 식별 정보</summary><code>{data.provenance.sha256 || '식별 정보 없음'}</code></details><Download data={data} /></section>
      <div className="verified-metrics">{[['전체 관측 이벤트', data.population.events], ['관측 카테고리', data.population.categories], ['중앙 지속 시간 (h)', data.duration.median], ['평균 지속 시간 (h)', data.duration.mean]].map(([label, value]) => <div className="verified-metric" key={label}><span>{label}</span><strong>{num(value)}</strong><small>지속 시간 유효 N={num(data.duration.n)}, 제외 {num(data.duration.excluded)}</small></div>)}</div>
      {(showEDA || view === 'insight' || view === 'strategy') && <>
        <section className="verified-panel"><h2>카테고리별 관측 이벤트</h2><Bars rows={categories} label="category" value="events" suffix="건" /><p>합계 {num(categories.reduce((sum, row) => sum + row.events, 0))}건 · 전체 관측 N={num(data.population.events)}</p></section>
        <section className="verified-panel"><h2>카테고리별 지속 시간</h2><div className="verified-table-wrap" role="region" aria-label="관측 지속 시간 표" tabIndex={0}><table className="verified-table"><caption>단위: 시간. 평균·중앙값·사분위수는 각 카테고리의 유효 지속 시간에서 계산합니다.</caption><thead><tr><th>카테고리</th><th>이벤트</th><th>유효 N</th><th>제외</th><th>Q1</th><th>중앙값</th><th>평균</th><th>Q3</th></tr></thead><tbody>{categories.map(row => <tr key={row.category}><th scope="row">{row.category}</th>{['events', 'duration_n', 'duration_excluded', 'q25', 'median', 'mean', 'q75'].map(key => <td key={key}>{num(row[key])}</td>)}</tr>)}</tbody></table></div></section>
      </>}
      {showEDA && <>
        <section className="verified-panel"><h2>연도별 카테고리 비중</h2><div className="verified-table-wrap" role="region" aria-label="연도별 관측 표" tabIndex={0}><table className="verified-table"><caption>차트 진입 연도 기준. 유효 N={num(data.annual.n)}, 시각 제외 {num(data.annual.excluded)}. 연도 내 카테고리 비중을 계산합니다.</caption><thead><tr><th>연도</th><th>이벤트</th>{categories.map(row => <th key={row.category}>{row.category}</th>)}</tr></thead><tbody>{data.annual.rows.map(year => <tr key={year.year}><th scope="row">{year.year}</th><td>{num(year.events)}</td>{categories.map(row => <td key={row.category}>{num(year.categories.find(cat => cat.category === row.category)?.percent)}%</td>)}</tr>)}</tbody></table></div></section>
        <div className="verified-two-columns"><section className="verified-panel"><h2>발행 요일별 이벤트</h2><Bars rows={data.weekday.rows} label="day" value="events" suffix="건" /><p>발행 시각 기준 N={num(data.weekday.n)}, 제외 {num(data.weekday.excluded)}. 최다 요일: {[...data.weekday.rows].sort((a, b) => b.events - a.events)[0].day}.</p></section><section className="verified-panel"><h2>최초 진입 순위 분포</h2><Bars rows={data.rank.histogram} label="label" value="count" suffix="건" /><p>1~200 정수 순위 N={num(data.rank.n)}, 제외 {num(data.rank.excluded)}. 중앙값 {num(data.rank.median)}위.</p></section></div>
        <section className="verified-panel"><h2>24시간 후 관측 여부</h2><p>관측 있음 {num(data.observed_24h.observed)}건 / 없음 {num(data.observed_24h.not_observed)}건 / 확인 불가 {num(data.observed_24h.missing)}건.</p><p>저장된 관측 여부를 집계한 값입니다. 24h 예측 모델의 검증 결과를 의미하지 않습니다.</p></section>
      </>}
      {(showEDA || view === 'problem') && <section className="verified-panel" data-testid="tdi-population"><h2>TDI v2 정답 분포와 평가 표본</h2>{data.tdi.status === 'ready' ? <>
        <p>현재 실험 {data.tdi.run_id} · 유효 N=<b>{num(data.tdi.population)}</b> / 제외 {num(data.tdi.excluded)}. 전체 관측 {num(data.population.events)}건과 구분합니다.</p>
        <p>제외: 발행 시각 오류 {num(data.tdi.exclusions.invalid_publication_time)}, 정답 미확정 {num(data.tdi.exclusions.unresolved_label)}, 앞선 분할의 영상 재등장 {num(data.tdi.exclusions.seen_video)}.</p>
        <Bars rows={data.tdi.histogram.map((row, i) => ({ ...row, label: `${row.lower.toFixed(1)}–${row.upper.toFixed(1)}${i === 9 ? ' (1 포함)' : ''}` }))} label="label" value="count" suffix="건" />
        <p data-testid="tdi-total">분포 합계 {num(data.tdi.histogram.reduce((sum, row) => sum + row.count, 0))}건 · TDI v2 ≥ {data.tdi.threshold}: {num(data.tdi.positive)}건 ({pct(data.tdi.positive_rate)}).</p>
        <p>TDI v2 = clip(지속 시간 ÷ Train 카테고리 q95, 0, 1) × clip(1 − (최고 순위 − 1) ÷ 200, 0, 1). 지속 시간과 최고 순위는 정답 계산에만 사용합니다. 분포는 원본의 과거 TDI 컬럼에서 읽지 않습니다.</p>
        <div className="verified-table-wrap"><table className="verified-table"><caption>시간 분할·6시간 종료 확인·분할 사이 영상 ID 중복 제거를 적용한 표본</caption><thead><tr><th>분할</th><th>이벤트</th><th>고유 영상</th><th>양성 비율</th></tr></thead><tbody>{Object.entries(data.tdi.splits).map(([name, split]) => <tr key={name}><th>{name}</th><td>{num(split.rows)}</td><td>{num(split.unique_videos)}</td><td>{pct(split.positive_rate)}</td></tr>)}</tbody></table></div>
      </> : <p role="status">TDI v2 분포를 사용할 수 없습니다. 설정된 실험과 관측 자료의 일치를 확인해야 합니다. 다른 관측 통계와 구분합니다.</p>}</section>}
      {(view === 'feature' || view === 'problem') && <section className="verified-panel"><h2>최초 진입 시점의 입력 계약</h2><p>최초 진입 시각·발행 시각·최초 순위·조회수·댓글·카테고리에서 수치 피처 {data.features.numeric.length}개와 카테고리 {data.features.categorical.length}개를 만듭니다.</p><ul className="verified-list">{[...data.features.numeric, ...data.features.categorical].map(name => <li key={name}><code>{name}</code></li>)}</ul><p>로그 변환과 발행 요일/시각의 sin·cos를 사용합니다. 결측 처리·스케일링·카테고리 사전은 Train에서 학습합니다.</p><p>요일 sin(2π × 요일 ÷ 7), cos(2π × 요일 ÷ 7)는 순환 구조를 표현하는 수학적 변환입니다. 변수의 예측 기여도를 검증한 그래프가 아닙니다.</p><p>피처 중요도·SHAP과 24h 예측 모델은 현재 검증 범위에 포함되지 않습니다.</p></section>}
      {(view === 'insight' || view === 'strategy') && <section className="verified-panel"><h2>관측 결과로 설명할 수 있는 내용</h2><p>이 기간의 이벤트가 가장 많은 카테고리는 {mostEvents?.category} ({num(mostEvents?.events)}건)입니다.</p><p>유효 지속 시간 중앙값이 가장 큰 카테고리는 {longest?.category || '자료 없음'} ({num(longest?.median)}h)입니다. 동률일 수 있습니다.</p><p>이 비교만으로 미래 성장·최적 업로드 시각·광고 ROI·인과 효과를 판단할 수 없습니다. 광고 조건을 비교하려면 직접 정한 가정을 사용하세요.</p><Link className="verified-link" to="/campaign">입력 가정으로 캠페인 계산하기 →</Link></section>}
      <section className="verified-panel"><h2>검증된 기능과 미산출 항목</h2><p>클러스터 유의성·AI 전략 점수·광고 효과·피처 중요도는 이 관측 집계로 산출하지 않습니다. 해당 항목을 고정 예시로 채우지 않습니다.</p><Link className="verified-link" to="/analysis/model">모델의 검증 성능과 한계 보기 →</Link><p><Link className="verified-link" to="/analysis/predict">실제 최초 관측값으로 예측하기 →</Link></p></section>
    </>}
  </main>
}
