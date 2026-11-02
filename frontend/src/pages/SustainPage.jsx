import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import useJsonResource from '../hooks/useJsonResource'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import { csvCell } from '../lib/csv'
import '../styles/SustainPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const EMPTY = { videos: [], categoryDuration: [], clusters: [], dataScale: {} }

function normalizeData(json) {
  if (json?.analysis_scope !== 'historical_observations_only' || !Array.isArray(json.videos) || !Array.isArray(json.categoryDuration) || !Array.isArray(json.clusters) || !Number.isSafeInteger(json.dataScale?.events)) {
    throw new Error('관측 데이터 응답을 확인할 수 없습니다.')
  }
  if (json.videos.some(video => typeof video.title !== 'string' || typeof video.category !== 'string' || typeof video.duration !== 'number' || !Number.isFinite(video.duration) || video.duration < 0)) throw new Error('유효한 관측 지속 시간이 필요합니다.')
  return json
}

function BarList({ data, labelKey, valueKey, suffix = '' }) {
  const max = Math.max(...data.map(item => Number(item[valueKey]) || 0), 1)
  return <div className="sustain-bars">{data.map((item, index) => <div className="sustain-bar-row" key={`${item[labelKey]}-${index}`}>
    <span>{item[labelKey]}</span><div className="sustain-bar-track"><motion.i initial={{ width: 0 }} whileInView={{ width: `${(item[valueKey] / max) * 100}%` }} viewport={{ once: true }} /></div><b>{Number(item[valueKey]).toLocaleString('ko-KR')}{suffix}</b>
  </div>)}</div>
}

export default function SustainPage() {
  const resource = useJsonResource(`${API}/sustain/summary`, { normalize: normalizeData, timeoutMs: 12000 })
  const data = resource.data || EMPTY
  const [category, setCategory] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('duration')
  const categories = useMemo(() => ['ALL', ...new Set(data.videos.map(video => video.category))], [data.videos])
  const rows = useMemo(() => data.videos
    .filter(video => category === 'ALL' || video.category === category)
    .filter(video => `${video.title} ${video.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'ko') : b.duration - a.duration), [data.videos, category, search, sort])
  const downloadCSV = () => {
    const csv = [['title', 'category', 'observed_duration_h', 'video_id', 'event_id'].join(','),
      ...rows.map(video => [video.title, video.category, video.duration, video.video_id, video.event_id].map(csvCell).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'sustain_observed_events.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return <main className="sustain-page-reset">
    <section className="sustain-hero-reset"><div><span className="sustain-label">Historical Observations</span><h1>지속성 분석</h1><p>과거 트렌딩 이벤트에서 실제로 관측한 지속 시간과 분포입니다. 미래의 지속 시간이나 광고 효과를 예측하지 않습니다.</p>
      <div className={`sustain-status ${resource.error ? 'warn' : 'ok'}`} role="status">{resource.loading ? '관측 데이터 준비 중…' : resource.error ? '관측 데이터를 사용할 수 없습니다' : `관측 이벤트 ${data.dataScale.events.toLocaleString('ko-KR')}건 · 예측값 미표시`}</div></div>
      <button type="button" disabled={!resource.data} onClick={() => window.print()}>PDF 요약</button></section>
    {resource.loading && <LoadingState title="관측 데이터 로딩 중" message="저장된 분석 자료를 확인하고 있습니다." />}
    {resource.error && <ErrorState title="관측 데이터를 불러오지 못했습니다" message={resource.error} onRetry={resource.retry} />}
    {resource.data && <>
      <section className="sustain-grid-reset"><article className="sustain-card-reset"><div className="sustain-card-head"><span>Observed Duration</span><h2>카테고리별 중앙 지속 시간</h2></div><BarList data={data.categoryDuration} labelKey="category" valueKey="duration" suffix="h" /></article>
        <article className="sustain-card-reset"><div className="sustain-card-head"><span>Verified Model</span><h2>예측 결과의 적용 범위</h2></div><p className="sustain-insight">이 화면의 수치는 이미 관측된 결과입니다. 실제 최초 진입 기록으로 예측하려면 별도의 T0 v2 입력과 검증 기준을 사용해야 합니다.</p><Link to="/analysis/predict">최초 관측값으로 예측하기 →</Link><p><Link to="/analysis/model">현재 모델의 성능과 한계 보기 →</Link></p></article></section>
      <section className="sustain-grid-reset"><article className="sustain-card-reset"><div className="sustain-card-head"><span>Duration Quartiles</span><h2>지속 시간 구간별 분포</h2></div><BarList data={data.clusters} labelKey="name" valueKey="ratio" suffix="%" /><p className="sustain-insight">관측 자료의 25·50·75백분위수로 나눈 구간입니다. 동률 때문에 구간별 이벤트 수는 다를 수 있습니다.</p></article>
        <article className="sustain-card-reset"><div className="sustain-card-head"><span>Historical Comparison</span><h2>중앙 지속 시간이 긴 카테고리</h2></div><div className="sustain-final-card">{data.categoryDuration.slice(0, 3).map(row => row.category).join(' · ')}</div><p className="sustain-insight">과거 관측의 비교 순위이며 광고 집행 성과를 검증한 결과는 아닙니다.</p></article></section>
      <section className="sustain-card-reset sustain-table-card"><div className="sustain-card-head"><span>Observed Events</span><h2>상세 관측 이벤트</h2></div><p>지속 시간이 긴 상위 {data.videos.length}개 이벤트에서 검색·정렬합니다. 표에는 최대 20개를 표시하며 CSV에는 현재 조건에 맞는 이벤트를 내보냅니다.</p>
        <div className="sustain-toolbar"><input aria-label="관측 영상 검색" value={search} onChange={event => setSearch(event.target.value)} placeholder="영상 검색 (제목 / 카테고리)" /><select aria-label="관측 카테고리" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value} value={value}>{value === 'ALL' ? '전체 카테고리' : value}</option>)}</select><select aria-label="관측 정렬" value={sort} onChange={event => setSort(event.target.value)}><option value="duration">지속시간 순</option><option value="title">제목 순</option></select><button type="button" onClick={downloadCSV}>CSV 다운로드</button></div>
        <div className="sustain-table-wrap"><table className="sustain-video-table"><thead><tr><th scope="col">제목</th><th scope="col">카테고리</th><th scope="col">관측 지속시간</th></tr></thead><tbody>{rows.slice(0, 20).map(video => <tr key={`${video.video_id}-${video.event_id}`}><td>{video.title}</td><td>{video.category}</td><td>{video.duration.toLocaleString('ko-KR')}h</td></tr>)}</tbody></table></div>
        {!rows.length && <EmptyState title="조건에 맞는 관측 이벤트가 없습니다" message="검색어나 카테고리를 바꾸세요." />}
      </section>
    </>}
  </main>
}
