import { Link } from 'react-router-dom'
import useVerifiedResource from '../hooks/useVerifiedResource'
import { useEDA } from '../hooks/useEDA'
import '../styles/VerifiedHome.css'

const count = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
const sections = [
  ['/analysis/eda', '관측 데이터 탐색', '출처·기간·표본 수가 연결된 분포와 지속 시간'],
  ['/analysis/feature', '입력과 전처리', '최초 진입 시점의 수치 9개와 카테고리'],
  ['/analysis/model', '모델 검증과 추가 진단', '시간 분할 평가·학습 변동·오탐과 한계'],
  ['/sustain', '과거 지속성 분석', '실제 관측한 지속 시간과 카테고리 비교'],
  ['/video', '현재 영상 관측', '연결 가능한 공개 API의 현재 수치와 자료 출처'],
  ['/campaign', '캠페인 조건 계산기', '직접 입력한 예산·CPM·클릭률·전환율에 따른 계산'],
]

export default function LandingPage() {
  const observations = useEDA()
  const evaluation = useVerifiedResource('/evaluation')
  const data = observations.data
  const report = evaluation.data
  const selected = report?.models.find(row => row.name === report.selected_model)
  const max = Math.max(1, ...(data?.category_summary || []).map(row => row.events))
  return <div className="verified-home">
    <section className="home-hero"><div><span className="home-eyebrow">YOUTUBE KR · 과거 관측 · T0 v2</span><h1>첫 관측 정보로<br />분류하는<br /><em>트렌딩 지속성</em></h1><p>차트에 처음 진입했을 때의 순위·조회수·댓글·발행 시각으로 고지속 후보를 분류합니다. 관측 분석, 모델 검증, 입력 가정의 계산 범위를 확인할 수 있습니다.</p><div className="home-actions"><Link className="home-primary" to="/analysis/predict">최초 관측값으로 예측하기 →</Link><Link to="/analysis/model">성능과 한계 확인</Link></div><p className="home-caution">출력은 모델 점수입니다. 예상 지속 시간·교정된 성공 확률·실제 광고 효과를 제공하는 기능으로 해석할 수 없습니다.</p></div>
      <aside className="home-observations"><span className="home-eyebrow">저장된 실제 관측</span><h2>카테고리별 이벤트</h2>{observations.loading && <p role="status">관측 자료를 불러오는 중입니다.</p>}{observations.error && <div role="alert"><p>관측 자료를 불러오지 못했습니다.</p><button onClick={observations.retry}>관측 자료 다시 불러오기</button></div>}{data && <><p>{data.provenance.period_start?.slice(0, 10)} ~ {data.provenance.period_end?.slice(0, 10)} · KST</p><div className="home-bars">{data.category_summary.map(row => <div key={row.category}><span>{row.category}</span><i><b style={{ width: `${row.events / max * 100}%` }} /></i><strong>{count(row.events)}</strong></div>)}</div><p data-testid="home-observed-count">합계 {count(data.population.events)}건 · 고유 영상 {count(data.population.unique_videos)}개</p><Link to="/analysis/eda">출처와 계산 범위 보기 →</Link></>}</aside>
    </section>
    <section className="home-stats" aria-label="관측 자료 요약">{[['관측 이벤트', data?.population.events], ['고유 영상', data?.population.unique_videos], ['중앙 지속 시간 (h)', data?.duration.median], ['관측 카테고리', data?.population.categories]].map(([label, value]) => <article key={label}><strong>{typeof value === 'number' ? count(value) : '—'}</strong><span>{label}</span></article>)}</section>
    <section className="home-section" data-testid="home-verified-metrics"><span className="home-eyebrow">VALIDATION 선택 · 고정 TEST 평가</span><h2>T0 v2 모델의 검증 결과</h2>{evaluation.loading && <p role="status">검증 보고서를 불러오는 중입니다.</p>}{evaluation.error && <div role="alert"><p>검증 보고서를 불러오지 못했습니다.</p><button onClick={evaluation.retry}>검증 보고서 다시 불러오기</button></div>}{selected && <><p>{report.selected_model} · 실험 ID {report.run_id}</p><div className="home-results">{[['Test AUC', selected.test.auc], ['Test F1', selected.test.f1], ['Test Precision', selected.test.precision], ['Test Recall', selected.test.recall]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value.toFixed(4)}</strong></article>)}</div><p>Test {count(report.data.splits.test.rows)}개 이벤트 · {count(report.data.splits.test.unique_videos)}개 고유 영상. 모델과 판정 임계값은 Validation에서 선택했습니다.</p><Link to="/analysis/model">전체 모델 비교·표본·추가 진단 확인 →</Link></>}</section>
    <section className="home-section"><span className="home-eyebrow">자료부터 판단 범위까지</span><h2>근거를 확인하며 탐색하기</h2><div className="home-links">{sections.map(([path, title, description]) => <Link to={path} key={path}><h3>{title}</h3><p>{description}</p><span>열기 →</span></Link>)}</div></section>
    <footer className="home-footer"><strong>TrendIt</strong><p>과거 관측 기반 분류와 사용자 가정 계산을 제공하는 교육 프로젝트입니다. 수치의 출처와 적용 범위는 각 화면에서 확인하세요.</p><Link to="/analysis/problem">정답 정의와 평가 표본</Link></footer>
  </div>
}
