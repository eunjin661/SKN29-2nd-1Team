import { useMemo, useState } from 'react'
import LoadingState, { SkeletonBlock } from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { DurationBarChart, StrategyScoreChart, TrendLineChart } from '../components/AdvancedCharts'
import useVerifiedResource from '../hooks/useVerifiedResource'
import useJsonResource from '../hooks/useJsonResource'
import { csvCell } from '../lib/csv'
import '../styles/DashboardPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function format(n) { return Number(n || 0).toLocaleString('ko-KR') }

function normalizeDashboard(json) {
  const filters = json?.filters || { years: ['ALL'], categories: ['ALL'] }
  const kpis = json?.kpis || {}
  return {
    meta: json?.meta || {},
    filters,
    kpis: {
      rawSnapshots: Number(kpis.rawSnapshots || 0),
      trendEvents: Number(kpis.trendEvents || 0),
      medianDuration: Number(kpis.medianDuration || 0),
      categories: Number(kpis.categories || 0),
    },
    byYear: json?.byYear || {},
    categoryStats: Array.isArray(json?.categoryStats) ? json.categoryStats.map((x) => ({
      category: String(x.category || 'Unknown'),
      events: Number(x.events || 0),
      medianDuration: Number(x.medianDuration || x.median_duration_h || 0),
      strategyScore: Number(x.strategyScore || 0),
      risk: x.risk || 'MID',
    })) : [],
    trendFlow: Array.isArray(json?.trendFlow) ? json.trendFlow.map((x) => ({ label: String(x.label), value: Number(x.value || 0) })) : [],
    durationDistribution: Array.isArray(json?.durationDistribution) ? json.durationDistribution.map((x) => ({ label: String(x.label), value: Number(x.value || 0) })) : [],
    topVideos: Array.isArray(json?.topVideos) ? json.topVideos.map((x) => ({
      title: x.title || 'Untitled', category: x.category || '-', duration: Number(x.duration || 0), score: Number(x.score || 0),
    })) : [],
  }
}

function pickConclusion(category, modelReady) {
  return {
    strategy: `${category === 'ALL' ? '전체' : category} 카테고리의 과거 지속 시간과 이벤트 분포 비교`,
    risk: '기존 규칙 기반 전략 점수로 실제 광고 성과나 미래 지속 시간을 판단할 수 없습니다.',
    action: modelReady ? '정확한 최초 관측값을 확보한 뒤 T0 예측과 평가 조건 확인' : '검증 보고서 연결 상태 확인',
  }
}

export default function DashboardPage() {
  const { data, loading, error, retry: loadDashboard } = useJsonResource(`${API}/dashboard/summary`, { normalize: normalizeDashboard })
  const evaluation = useVerifiedResource('/evaluation')
  const report = evaluation.data
  const selected = report?.models.find(row => row.name === report.selected_model)
  const apiState = loading ? 'loading' : error ? 'error' : 'connected'
  const [year, setYear] = useState('ALL')
  const [category, setCategory] = useState('ALL')

  const filteredCategoryStats = useMemo(() => {
    const rows = data?.categoryStats || []
    if (category === 'ALL') return rows
    return rows.filter((x) => x.category === category)
  }, [data, category])

  const selectedKpis = useMemo(() => {
    if (!data) return { rawSnapshots: 0, trendEvents: 0, medianDuration: 0, categories: 0 }
    const byYear = data.byYear || {}
    const y = byYear[year] || byYear.ALL || data.kpis
    const categoryFactor = category === 'ALL' ? 1 : Math.max((filteredCategoryStats[0]?.events || 0) / Math.max(data.kpis.trendEvents || 1, 1), 0)
    return {
      rawSnapshots: Math.round((Number(y.rawSnapshots || data.kpis.rawSnapshots) || 0) * categoryFactor),
      trendEvents: Math.round((Number(y.trendEvents || data.kpis.trendEvents) || 0) * categoryFactor),
      medianDuration: filteredCategoryStats[0]?.medianDuration || Number(y.medianDuration || data.kpis.medianDuration || 0),
      categories: category === 'ALL' ? data.kpis.categories : 1,
    }
  }, [data, year, category, filteredCategoryStats])

  const trendFlow = useMemo(() => {
    if (!data) return []
    if (year === 'ALL') return data.trendFlow
    const y = data.byYear?.[year]
    return y ? [{ label: year, value: Number(y.trendEvents || 0) }] : []
  }, [data, year])

  const visibleVideos = useMemo(() => (data?.topVideos || []).filter((v) => category === 'ALL' || v.category === category).slice(0, 5), [data, category])
  const conclusion = pickConclusion(category, Boolean(report))
  const sourceLabel = apiState === 'connected' ? 'Backend API 데이터' : apiState === 'loading' ? '데이터 준비 중' : 'API 연결 확인 필요'
  const alerts = useMemo(() => {
    const list = []
    if (apiState === 'error') list.push('⚠ Dashboard API 연결 실패')
    if (!report) list.push('검증 보고서 연결 확인 필요')
    if (category === 'Gaming') list.push('⚠ Gaming 카테고리 지속성이 낮아 테스트 예산 중심 집행 권장')
    if (selectedKpis.medianDuration && selectedKpis.medianDuration < 90) list.push('⚠ 선택 구간의 중앙 지속 시간이 낮아 장기 캠페인에는 주의 필요')
    return list
  }, [apiState, report, category, selectedKpis.medianDuration])

  const downloadCSV = () => {
    const rows = visibleVideos
    const header = ['title', 'category', 'duration_h']
    const body = rows.map((r) => [r.title, r.category, r.duration].map(csvCell).join(','))
    const csv = [["filter_year", year].map(csvCell).join(','), ["filter_category", category].map(csvCell).join(','), 'data_source,Backend API', '', header.join(','), ...body].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `dashboard_${year}_${category}.csv`; a.click(); window.URL.revokeObjectURL(url)
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero"><div><p className="eyebrow">DASHBOARD</p><h1>트렌딩 과거 분석 대시보드</h1><p>과거 관측 집계와 규칙 기반 참고 점수를 확인합니다. T0 v2 모델 성능은 별도의 검증 보고서에서 읽습니다.</p></div><span className={`api-pill ${apiState}`}>{sourceLabel}</span></section>
      <section className="data-source-box"><div><b>데이터 상태</b><p>{sourceLabel}</p></div><div><b>마지막 업데이트</b><p>{data?.meta?.updatedAt || '-'}</p></div><div><b>현재 필터</b><p>{year === 'ALL' ? '전체 기간' : year} · {category === 'ALL' ? '전체 카테고리' : category}</p></div><div className="export-actions"><button type="button" onClick={downloadCSV} disabled={!data}>CSV 다운로드</button><button type="button" onClick={() => window.print()}>PDF 요약</button></div></section>
      <section className="dashboard-filter"><div><label>기간</label><div className="filter-pills">{(data?.filters?.years || ['ALL']).map((y) => <button key={y} className={year === y ? 'active' : ''} onClick={() => setYear(y)}>{y === 'ALL' ? '전체' : y}</button>)}</div></div><div><label>카테고리</label><div className="filter-pills">{(data?.filters?.categories || ['ALL']).map((c) => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c === 'ALL' ? '전체' : c}</button>)}</div></div></section>
      <section className="dash-kpi-grid"><article><span>RAW 스냅샷</span><strong>{format(selectedKpis.rawSnapshots)}</strong></article><article><span>트렌딩 이벤트</span><strong>{format(selectedKpis.trendEvents)}</strong></article><article><span>중앙 지속 시간</span><strong>{selectedKpis.medianDuration}h</strong></article><article><span>카테고리 그룹</span><strong>{selectedKpis.categories}</strong></article></section>
      <section className="alert-card"><h3>운영 이상 신호</h3>{alerts.length === 0 ? <p className="safe">✔ 현재 이상 신호 없음</p> : alerts.map((a, i) => <p key={i}>{a}</p>)}</section>
      <section className="dash-grid two"><article className="dash-card"><div className="card-head"><h2>트렌딩 흐름</h2><span>{year === 'ALL' ? '연도별' : `${year} 선택`}</span></div>{apiState === 'loading' ? <SkeletonBlock rows={6} height={18} /> : <TrendLineChart data={trendFlow} title="연도별 트렌딩 흐름" />}</article><article className="dash-card"><div className="card-head"><h2>지속성 분포</h2><span>duration bucket</span></div>{apiState === 'loading' ? <SkeletonBlock rows={6} height={18} /> : <DurationBarChart data={data?.durationDistribution || []} title="지속성 분포" />}</article></section>
      <section className="dash-grid two"><article className="dash-card model-status" data-testid="dashboard-verified-metrics"><p className="eyebrow">T0 v2 · OFFLINE EVALUATION</p><h2>{report?.selected_model || '검증 보고서 확인 필요'}</h2>{selected ? <><div className="score-row"><div><span>Test AUC</span><strong>{selected.test.auc.toFixed(4)}</strong></div><div><span>Test F1</span><strong>{selected.test.f1.toFixed(4)}</strong></div><div><span>Test Accuracy</span><strong>{selected.test.accuracy.toFixed(4)}</strong></div></div><p className="muted" style={{ overflowWrap: 'anywhere' }}>실험 ID: {report.run_id}</p></> : <p role={evaluation.error ? 'alert' : 'status'}>{evaluation.error || '검증 보고서를 불러오는 중입니다.'}</p>}<p className="muted">현재 필터와 별개의 고정 Test 평가입니다. <a href="/analysis/model">평가 조건 보기 →</a></p></article><article className="dash-card decision-card"><p className="eyebrow">ANALYSIS NOTES</p><h2>분석 참고 사항</h2><div className="decision-list"><div><b>확인할 내용</b><p>{conclusion.strategy}</p></div><div><b>해석의 제한</b><p>{conclusion.risk}</p></div><div><b>다음 확인</b><p>{conclusion.action}</p></div></div></article></section>
      <section className="dash-grid two"><article className="dash-card"><div className="card-head"><h2>카테고리 전략 점수</h2><span>{category === 'ALL' ? '전체' : category}</span></div>{apiState === 'loading' ? <LoadingState title="전략 점수 계산 중" message="카테고리별 점수를 정리하고 있습니다." /> : filteredCategoryStats.length === 0 ? <EmptyState title="카테고리 데이터 없음" message="백엔드 응답에 카테고리 데이터가 없습니다." /> : <><StrategyScoreChart data={filteredCategoryStats} /><div className="strategy-list strategy-list--compact">{filteredCategoryStats.map((x) => <div className="strategy-item" key={x.category}><div><b>{x.category}</b><span>중앙 지속 {x.medianDuration}h · 위험도 {x.risk}</span></div><strong>{x.strategyScore}</strong></div>)}</div></>}</article><article className="dash-card"><h2>TOP 지속성 영상</h2><table className="dash-table"><thead><tr><th>영상</th><th>카테고리</th><th>지속시간</th></tr></thead><tbody>{visibleVideos.map((v, i) => <tr key={i}><td>{v.title}</td><td>{v.category}</td><td>{v.duration}h</td></tr>)}</tbody></table>{apiState !== 'loading' && visibleVideos.length === 0 && <EmptyState title="영상 데이터 없음" message="선택한 필터에 해당하는 영상이 없습니다." />}</article></section>
      {apiState === 'error' && <ErrorState title="API 연결 실패" message={`FastAPI 서버와 /dashboard/summary 주소를 확인하세요. ${error || ''}`} onRetry={() => { loadDashboard(); evaluation.retry() }} />}
    </main>
  )
}
