import { useState } from 'react'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import { DurationBarChart, TrendLineChart } from '../components/AdvancedCharts'
import useVerifiedResource from '../hooks/useVerifiedResource'
import useJsonResource from '../hooks/useJsonResource'
import { csvCell } from '../lib/csv'
import '../styles/DashboardPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const format = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '자료 없음'
function normalizeDashboard(data) {
  const count = value => Number.isSafeInteger(value) && value >= 0
  const total = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0)
  if (data?.schema !== 'observed-dashboard-v1' || data.meta?.source !== 'historical_observed_events' || !count(data.kpis?.trendEvents) || !count(data.kpis.durationN) || !count(data.kpis.durationExcluded) || data.kpis.durationN + data.kpis.durationExcluded !== data.kpis.trendEvents || !Array.isArray(data.filters?.years) || !Array.isArray(data.filters?.categories) || !Array.isArray(data.topVideos) || !Array.isArray(data.categoryStats) || data.categoryStats.some(row => !count(row.events)) || total(data.categoryStats, 'events') !== data.kpis.trendEvents || !Array.isArray(data.durationDistribution) || data.durationDistribution.some(row => !count(row.value)) || total(data.durationDistribution, 'value') !== data.kpis.durationN || !Array.isArray(data.trendFlow)) throw new Error('대시보드의 관측 집계와 표본 수를 확인할 수 없습니다.')
  return data
}

export default function DashboardPage() {
  const [year, setYear] = useState('ALL')
  const [category, setCategory] = useState('ALL')
  const resource = useJsonResource(`${API}/dashboard/summary?${new URLSearchParams({ year, category })}`, { normalize: normalizeDashboard })
  const { data, loading, error } = resource
  const evaluation = useVerifiedResource('/evaluation')
  const report = evaluation.data
  const selected = report?.models.find(row => row.name === report.selected_model)
  const downloadCSV = () => {
    if (!data) return
    const rows = [['filter_year', year], ['filter_category', category], ['data_source', data.meta.source], ['dataset_sha256', data.meta.dataset_sha256], ['filtered_events', data.kpis.trendEvents], [], ['title', 'category', 'duration_h'], ...data.topVideos.map(row => [row.title, row.category, row.duration])]
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = `dashboard_${year}_${category}.csv`; link.click(); URL.revokeObjectURL(url)
  }
  return <main className="dashboard-page">
    <section className="dashboard-hero"><div><p className="eyebrow">HISTORICAL OBSERVATIONS</p><h1>트렌딩 과거 분석 대시보드</h1><p>기간과 카테고리에 실제로 해당하는 이벤트만 집계합니다. 모델 성능은 필터와 별개의 고정 Test 평가입니다.</p></div></section>
    <section className="data-source-box"><div><b>현재 조건</b><p>{year} · {category}</p></div><div><b>데이터 상태</b><p>{loading ? '관측 집계 준비 중' : error ? '사용 불가' : '실제 관측 집계'}</p></div><div className="export-actions"><button onClick={downloadCSV} disabled={!data}>CSV 다운로드</button><button onClick={() => window.print()}>PDF 요약</button></div></section>
    <section className="dashboard-filter"><div><label>기간</label><div className="filter-pills">{(data?.filters.years || [year]).map(value => <button key={value} className={year === value ? 'active' : ''} onClick={() => setYear(value)}>{value === 'ALL' ? '전체' : value}</button>)}</div></div><div><label>카테고리</label><div className="filter-pills">{(data?.filters.categories || [category]).map(value => <button key={value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{value === 'ALL' ? '전체' : value}</button>)}</div></div></section>
    {loading && <LoadingState title="관측 집계 로딩 중" />}
    {error && <ErrorState title="API 연결 실패" message={error} onRetry={resource.retry} />}
    {data && <>
      <section className="dash-kpi-grid">{[['이벤트 내 관측 수 합계', data.kpis.eventSnapshots], ['트렌딩 이벤트', data.kpis.trendEvents], ['중앙 지속 시간 (h)', data.kpis.medianDuration], ['카테고리 그룹', data.kpis.categories]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{format(value)}</strong></article>)}</section>
      <section className="data-source-box"><p>지속 시간 유효 N={format(data.kpis.durationN)}, 제외 {format(data.kpis.durationExcluded)}. 이벤트 내 관측 수 합계는 원본 수집 전체 스냅샷 수와 구분합니다.</p></section>
      <section className="dash-grid two"><article className="dash-card"><h2>선택 조건의 연도별 이벤트</h2><TrendLineChart data={data.trendFlow} title="관측 이벤트 흐름" /></article><article className="dash-card"><h2>선택 조건의 지속 시간 분포</h2><DurationBarChart data={data.durationDistribution} title="관측 지속 시간" /></article></section>
      <section className="dash-card"><h2>관측 카테고리 비교</h2><table className="dash-table"><thead><tr><th>카테고리</th><th>이벤트</th><th>중앙 지속 시간</th></tr></thead><tbody>{data.categoryStats.map(row => <tr key={row.category}><td>{row.category}</td><td>{format(row.events)}</td><td>{format(row.medianDuration)}h</td></tr>)}</tbody></table></section>
      <section className="dash-card"><h2>상위 관측 지속 시간 이벤트</h2><p>현재 조건의 상위 20개까지 표시하며 CSV도 이 목록을 내보냅니다.</p><table className="dash-table"><thead><tr><th>영상</th><th>카테고리</th><th>관측 지속 시간</th></tr></thead><tbody>{data.topVideos.map((row, index) => <tr key={`${row.video_id}-${row.event_id}-${index}`}><td>{row.title}</td><td>{row.category}</td><td>{format(row.duration)}h</td></tr>)}</tbody></table>{!data.topVideos.length && <EmptyState title="조건에 맞는 관측 이벤트가 없습니다" />}</section>
    </>}
    <section className="dash-card model-status" data-testid="dashboard-verified-metrics"><p className="eyebrow">T0 v2 · OFFLINE EVALUATION</p><h2>{report?.selected_model || '검증 보고서 확인 필요'}</h2>{selected ? <><div className="score-row"><div><span>Test AUC</span><strong>{selected.test.auc.toFixed(4)}</strong></div><div><span>Test F1</span><strong>{selected.test.f1.toFixed(4)}</strong></div><div><span>Test Precision</span><strong>{selected.test.precision.toFixed(4)}</strong></div></div><p className="muted">실험 ID: {report.run_id}</p></> : <p role={evaluation.error ? 'alert' : 'status'}>{evaluation.error || '검증 보고서를 불러오는 중입니다.'}</p>}<p>현재 필터와 별개의 고정 Test 평가입니다. <a href="/analysis/model">평가 조건 보기 →</a></p></section>
  </main>
}
