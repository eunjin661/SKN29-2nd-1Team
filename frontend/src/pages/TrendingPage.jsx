// pages/TrendingPage.jsx — 파트 목록 페이지
import { useNavigate, useParams, Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fadeUp, fadeUpStagger } from '../animations/variants'
import useVerifiedResource from '../hooks/useVerifiedResource'
import '../styles/TrendingPage.css'
import FeaturePage    from './FeaturePage'
import InsightPage    from './InsightPage'
import ProblemPage    from './ProblemPage'
import EDAPage        from './EDAPage'
import ModelPage      from './ModelPage'
import PredictionPage from './PredictionPage'
import StrategyPage   from './StrategyPage'
import ComparePage    from './ComparePage'
import ModelInterpretPage from './ModelInterpretPage'

import {
  EDAIcon, FeatureIcon, DataInterpretIcon, ProblemIcon,
  ModelResultIcon, CompareIcon, ExplainIcon, PredictionIcon, InsightIcon,
} from '../components/icons'

const PARTS = [
  {
    num: 1, slug: 'eda',
    title: 'EDA',
    desc: '실제 관측의 카테고리·기간·지속 시간·TDI v2 표본 확인',
    Icon: EDAIcon,
    Component: EDAPage,
    tags: ['OBSERVED', 'DURATION', 'POPULATION'],
  },
  {
    num: 2, slug: 'feature',
    title: 'Feature Engineering',
    desc: '현재 T0 v2의 수치 입력 9개와 카테고리, Train 전처리',
    Icon: FeatureIcon,
    Component: FeaturePage,
    tags: ['LOG1P', 'TRAIN', 'ENCODING', 'T0'],
  },
  {
    num: 3, slug: 'insight',
    title: '데이터 해석',
    desc: '실제 관측의 카테고리 분포·지속 시간 비교와 해석 범위',
    Icon: DataInterpretIcon,
    Component: InsightPage,
    tags: ['RELATION', 'CATEGORY', 'TIME', 'REACTION'],
  },
  {
    num: 4, slug: 'problem',
    title: '문제 정의',
    desc: 'TDI v2 정답·시점·영상 중복 통제와 실제 평가 표본',
    Icon: ProblemIcon,
    Component: ProblemPage,
    tags: ['CLASSIFY', 'SPLIT', 'TARGET', 'T0'],
  },
  {
    num: 5, slug: 'model',
    title: '모델 결과 시각화',
    desc: 'T0 v2 보고서 기반 8개 모델의 Validation·Test 성능 비교',
    Icon: ModelResultIcon,
    Component: ModelPage,
    tags: ['VALIDATION', 'TEST', 'T0', 'V2'],
  },
  {
    num: 6, slug: 'compare',
    title: '카테고리 비교',
    desc: '관측 이벤트 수와 유효 지속 시간의 중앙값·평균 비교',
    Icon: CompareIcon,
    Component: ComparePage,
    tags: ['CATEGORY', 'DURATION', 'OBSERVED'],
  },
  {
    num: 7, slug: 'explain',
    title: '모델 해석',
    desc: 'T0 입력의 의미, 혼동행렬과 현재 모델의 검증 한계',
    Icon: ExplainIcon,
    Component: ModelInterpretPage,
    tags: ['INPUT', 'LIMITS', 'CONFUSION MATRIX'],
  },
  {
    num: 8, slug: 'predict',
    title: '예측 시스템',
    desc: '실제 최초 관측값으로 검증된 T0 분류 모델 실행',
    Icon: PredictionIcon,
    Component: PredictionPage,
    tags: ['PREDICT', 'T0', 'VERIFIED'],
  },
  {
    num: 9, slug: 'strategy',
    title: '인사이트 & 전략',
    desc: '관측 비교의 적용 범위와 사용자 가정 기반 계산 안내',
    Icon: InsightIcon,
    Component: StrategyPage,
    tags: ['OBSERVED', 'SCOPE', 'ASSUMPTIONS'],
  },
]

/* Coming Soon 페이지 */
function ComingSoonPage({ part, onBack }) {
  return (
    <div className="yta-app-inner">
      <button className="back-btn" onClick={onBack}>← 목록으로</button>
      <div className="part-page-header" style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ marginBottom: 24, opacity: 0.3 }}>
          <part.Icon />
        </div>
        <span className="part-page-num">Part {part.num}</span>
        <h1 className="part-page-title">{part.title}</h1>
        <p className="part-page-subtitle">{part.desc}</p>
        <div style={{
          display: 'inline-block', marginTop: 24,
          padding: '8px 20px', borderRadius: 20,
          border: '1px solid var(--border)',
          fontSize: 13, color: 'var(--text3)',
        }}>
          🚧 준비 중입니다
        </div>
      </div>
    </div>
  )
}

/* 목록 화면 */
function PartList() {
  const navigate = useNavigate()

  const evaluation = useVerifiedResource('/evaluation')
  const report = evaluation.data
  const selected = report?.models.find(row => row.name === report.selected_model)
  const HERO_STATS = [
    { val: report ? report.data.source_rows.toLocaleString('ko-KR') : '—', unit:'', label:'분석 이벤트', change:'검증 보고서 기준', red:false },
    { val: selected ? selected.test.auc.toFixed(4) : '—', unit:'', label:'Test AUC', change:report?.selected_model || '보고서 확인 필요', red:true },
    { val: selected ? (selected.test.recall * 100).toFixed(1) : '—', unit:'%', label:'Test Recall', change:'미등장 영상 평가', red:true },
    { val: report ? report.data.splits.test.rows.toLocaleString('ko-KR') : '—', unit:'', label:'Test 이벤트', change:'시간 분할 · 영상 중복 통제', red:false },
  ]

  return (
    <div className="yta-app-wrap">
      {/* ── 히어로 ── */}
      <div className="trending-hero">
        <div className="trending-hero-grid"/>
        <div className="trending-hero-glow"/>
        <div className="trending-hero-inner">
          <motion.div
            className="trending-hero-left"
            variants={fadeUpStagger} initial="hidden" animate="show"
          >
            <motion.div className="trending-hero-eyebrow" variants={fadeUp}>
              <div className="trending-hero-dot"/>
              YouTube KR Trending Analysis
            </motion.div>
            <motion.h1 className="trending-hero-title" variants={fadeUp}>
              유튜브 트렌딩<br/>
              <span>심층 분석</span>
            </motion.h1>
            <motion.p className="trending-hero-sub" variants={fadeUp}>
              34,964개 트렌딩 이벤트를 기반으로 EDA부터 예측 모델까지<br/>
              초기 분석 기록과 새롭게 검증한 T0 v2 결과를 확인할 수 있습니다.
            </motion.p>
            <motion.div className="trending-hero-btns" variants={fadeUp}>
              <button className="trending-hero-btn-primary" onClick={() => {
                document.getElementById('parts-contents')?.scrollIntoView({ behavior:'smooth' })
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                </svg>
                분석 시작하기
              </button>
              <button className="trending-hero-btn-secondary" onClick={() => navigate('/analysis/compare')}>
                카테고리 비교 →
              </button>
            </motion.div>
          </motion.div>

          {/* 우측 스탯 카드 */}
          <motion.div
            className="trending-hero-stats"
            initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:0.7, delay:0.2, ease:[0.22,1,0.36,1] }}
          >
            {HERO_STATS.map((s,i) => (
              <motion.div
                key={s.label} className="th-stat"
                initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:0.5, delay:0.3+i*0.08, ease:[0.22,1,0.36,1] }}
              >
                <div className="th-stat-val">
                  {s.val}<span>{s.unit}</span>
                </div>
                <div className="th-stat-label">{s.label}</div>
                <div className={`th-stat-change ${s.red ? 'red' : ''}`}>{s.change}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── 파트 그리드 ── */}
      <div className="yta-app-inner">
        <div className="parts-section-new" id="parts-contents">
          <div className="parts-section-head">
            <div>
              <div className="parts-section-title">분석 파트</div>
              <div className="parts-section-sub">현재 검증 결과: 모델 결과 · 모델 해석 · 예측 시스템. 나머지 파트는 초기 분석 기록입니다.</div>
            </div>
            <div className="parts-count-badge">T0 v2 연결 · 3개 파트</div>
          </div>

          <motion.div
            className="parts-grid-new"
            variants={fadeUpStagger} initial="hidden" animate="show"
          >
            {PARTS.map((part) => (
              <motion.div
                key={part.num}
                className={`part-card-new ${part.comingSoon ? 'coming' : ''}`}
                onClick={() => !part.comingSoon && navigate(`/analysis/${part.slug}`)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key==='Enter' && !part.comingSoon && navigate(`/analysis/${part.slug}`)}
                variants={fadeUp}
                whileHover={part.comingSoon ? {} : { y:-6 }}
                whileTap={part.comingSoon ? {} : { scale:0.98 }}
              >
                {/* 헤더 */}
                <div className="pcn-header">
                  <div className="pcn-icon">
                    <part.Icon/>
                  </div>
                  <div className="pcn-num">Part {part.num}</div>
                </div>

                {/* 본문 */}
                <div className="pcn-title">{part.title}</div>
                <div className="pcn-desc">{part.desc}</div>

                {/* 태그 */}
                <div className="pcn-tags">
                  {part.tags?.map(tag => (
                        <span key={tag} className="pcn-tag">{tag}</span>
                      ))}
                  {part.comingSoon && <span className="pcn-coming-tag">준비중</span>}
                </div>

                {/* 푸터 */}
                <div className="pcn-footer">
                  <div style={{ fontSize:11, color:'var(--text3)' }}>
                    {part.comingSoon ? '곧 공개됩니다' : '클릭해서 분석 보기'}
                  </div>
                  {!part.comingSoon && (
                    <div className="pcn-arrow">
                      열기
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
                      </svg>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* 개별 파트 래퍼 */
function PartView({ slug }) {
  const navigate = useNavigate()
  const part = PARTS.find(p => p.slug === slug)
  const onBack = () => navigate('/analysis')

  if (!part) return <div className="yta-app-wrap"><div className="yta-app-inner"><button className="back-btn" onClick={onBack}>← 목록으로</button><p>존재하지 않는 파트입니다.</p></div></div>
  if (part.comingSoon) return <div className="yta-app-wrap"><ComingSoonPage part={part} onBack={onBack}/></div>

  const Comp = part.Component
  if (!Comp) return <div className="yta-app-wrap"><ComingSoonPage part={{ ...part, comingSoon: true }} onBack={onBack}/></div>
  return <div className="yta-app-wrap">
    <Comp onBack={onBack}/>
  </div>
}

/* 메인 라우터 */
export default function TrendingPage() {
  return (
    <Routes>
      <Route index element={<PartList/>}/>
      <Route path=":slug" element={<SlugRouter/>}/>
    </Routes>
  )
}

function SlugRouter() {
  const { slug } = useParams()
  return <PartView slug={slug}/>
}
