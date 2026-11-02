// pages/ComparePage.jsx — Part 6 카테고리 비교
import { useState } from 'react'
import { motion } from 'framer-motion'
import CountUp from '../components/CountUp'
import TabSectionLayout from '../components/TabSectionLayout'
import { fadeUp, fadeUpStagger } from '../animations/variants'
import '../styles/MLDLPartPages.css'

const API = 'http://127.0.0.1:8000'

function CategoryPerformanceChart() {
  const rows = [
    { name:'Music', view:92, engage:88, model:'LSTM' },
    { name:'Entertainment', view:86, engage:83, model:'MLP' },
    { name:'Education', view:81, engage:78, model:'XGBoost' },
    { name:'Lifestyle', view:76, engage:74, model:'MLP' },
    { name:'News', view:63, engage:59, model:'XGBoost' },
  ]
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">CATEGORY SCORE</div><div className="ml-chart-main-title">카테고리별 조회수/반응 예측 성능</div></div><div className="ml-dot-legend"><span>조회수</span><span>좋아요·댓글</span></div></div>
    <div className="ml-compare-bars">
      {rows.map((r,i)=><div className="ml-dual-bar-row" key={r.name}><div className="ml-dual-name">{r.name}</div><div className="ml-dual-track-wrap">
        <div className="ml-dual-track"><span className="ml-dual-label">Views</span><div className="ml-bar-track"><div className="ml-bar-fill" style={{ '--value':`${r.view}%`, '--delay':`${i*.08}s` }}/></div><span className="ml-bar-value">{r.view}</span></div>
        <div className="ml-dual-track"><span className="ml-dual-label">Engage</span><div className="ml-bar-track"><div className="ml-bar-fill ghost" style={{ '--value':`${r.engage}%`, '--delay':`${i*.08+.04}s` }}/></div><span className="ml-bar-value">{r.engage}</span></div>
      </div></div>)}
    </div>
  </div>
}

function DifficultyChart() {
  const cards = [
    { name:'Music', level:'쉬움', cls:'ml-level-easy', model:'LSTM', text:'팬덤과 반복 소비 패턴이 강해 시간 흐름 예측이 안정적입니다.' },
    { name:'Entertainment', level:'보통', cls:'ml-level-mid', model:'MLP', text:'반응 변수가 다양하지만 비선형 패턴 학습으로 보완 가능합니다.' },
    { name:'Education', level:'보통', cls:'ml-level-mid', model:'XGBoost', text:'지속 시간은 길지만 주제별 편차가 있어 해석 모델이 유리합니다.' },
    { name:'News', level:'어려움', cls:'ml-level-hard', model:'XGBoost', text:'이슈 발생 시점에 따라 급등락이 커서 예측 난이도가 높습니다.' },
  ]
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">DIFFICULTY MAP</div><div className="ml-chart-main-title">카테고리별 난이도와 추천 모델</div></div><span className="ml-badge">Easy · Medium · Hard</span></div>
    <div className="ml-rank-card-grid">
      {cards.map((c,i)=><div key={c.name} className="ml-rank-card" style={{ animationDelay:`${i*.08}s` }}><div className="ml-rank-top"><span className="ml-rank-name">{c.name}</span><span className={`ml-badge ${c.cls}`}>{c.level}</span></div><div className="ml-rank-meta">추천 모델: <b>{c.model}</b><br/>{c.text}</div></div>)}
    </div>
  </div>
}

function TopLowChart() {
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">TOP / LOW</div><div className="ml-chart-main-title">성능 상위·하위 카테고리</div></div><span className="ml-badge">Ranking Card</span></div>
    <div className="ml-card-grid">
      <div className="ml-mini-card is-best"><div className="ml-mini-label"><span>TOP 1</span><span className="ml-badge ml-level-easy">Best</span></div><div className="ml-model-name">Music</div><p className="ml-model-desc">조회수 예측 92점. 팬덤 기반 반복 반응으로 패턴이 안정적입니다.</p></div>
      <div className="ml-mini-card"><div className="ml-mini-label"><span>TOP 2</span><span className="ml-badge ml-level-mid">Stable</span></div><div className="ml-model-name">Entertainment</div><p className="ml-model-desc">조회수 예측 86점. 업로드 시간과 초기 댓글 반응이 중요합니다.</p></div>
      <div className="ml-mini-card"><div className="ml-mini-label"><span>LOW</span><span className="ml-badge ml-level-hard">Hard</span></div><div className="ml-model-name">News</div><p className="ml-model-desc">조회수 예측 63점. 외부 이슈 의존도가 커서 변동성이 높습니다.</p></div>
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">WHY HARD</span><span className="ml-insight-text">News는 이벤트성 이슈가 많아 과거 패턴만으로 예측하기 어렵고, Music은 반복 소비가 많아 LSTM 예측이 안정적입니다.</span></div>
  </div>
}

function CategoryStrategyChart() {
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">OPERATION</div><div className="ml-chart-main-title">카테고리별 운영 전략</div></div><span className="ml-badge">Action Plan</span></div>
    <div className="ml-strategy-grid">
      <div className="ml-strategy-card"><div className="ml-strategy-title">Music · LSTM</div><p className="ml-strategy-text">초기 6~12시간 반응을 추적해 장기 지속 가능 영상을 빠르게 선별합니다.</p></div>
      <div className="ml-strategy-card"><div className="ml-strategy-title">Entertainment · MLP</div><p className="ml-strategy-text">좋아요·댓글·업로드 시간의 복합 패턴을 활용해 추천 타이밍을 조정합니다.</p></div>
      <div className="ml-strategy-card"><div className="ml-strategy-title">News · XGBoost</div><p className="ml-strategy-text">예측보다 변수 해석을 우선해 급상승 요인과 이슈 민감도를 파악합니다.</p></div>
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">INSIGHT</span><span className="ml-insight-text">카테고리별 성능 차이가 존재하므로 하나의 공통 모델보다 카테고리 특화 모델 전략이 더 설득력 있습니다.</span></div>
  </div>
}


function CategoryStoryChart() {
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">CATEGORY PLAYBOOK</div><div className="ml-chart-main-title">카테고리별 의사결정 흐름</div></div><span className="ml-badge">Operation Flow</span></div>
    <div className="ml-flow-line">
      {[['Music','LSTM · 초기 반응 추적'],['Entertainment','MLP · 반응 조합 최적화'],['Education','XGBoost · 주제별 해석'],['News','XGBoost · 이슈 민감도 모니터링']].map((x,i)=><div className="ml-flow-step" key={x[0]} style={{ animationDelay:`${i*.08}s` }}><div className="ml-flow-no">{x[0]}</div><div className="ml-flow-text">{x[1]}</div></div>)}
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">CONCLUSION</span><span className="ml-insight-text">Part 6의 결론은 “카테고리마다 예측 난이도와 추천 모델이 다르므로 특화 전략이 필요하다”입니다.</span></div>
  </div>
}

const SECTIONS = [
  { id:'perf', tag:'성능', shortTitle:'카테고리 성능', title:'카테고리별 조회수/좋아요/댓글 예측 성능', Chart:CategoryPerformanceChart, findings:['Music은 조회수와 반응 예측 모두 높은 성능을 보임.', 'Entertainment는 중간 이상 성능으로 비선형 패턴 학습이 유리.', 'News는 이슈 변동성이 커서 예측 안정성이 낮음.'], note:'카테고리별 성능 차이 → 특화 모델 가능성' },
  { id:'difficulty', tag:'난이도', shortTitle:'난이도 레벨', title:'카테고리별 예측 난이도와 추천 모델', Chart:DifficultyChart, findings:['Music은 쉬움, Entertainment/Education은 보통, News는 어려움으로 분류.', '시간 흐름이 강한 카테고리는 LSTM이 유리.', '변동성이 큰 카테고리는 XGBoost로 주요 변수를 해석하는 전략이 적합.'], note:'쉬움/보통/어려움 기준으로 발표용 메시지 명확화' },
  { id:'rank', tag:'순위', shortTitle:'Top/Low', title:'카테고리별 Top/Low 성능 표시', Chart:TopLowChart, findings:['Music은 반복 소비와 팬덤 반응으로 예측 성능이 가장 높음.', 'News는 외부 사건 의존도가 높아 예측 난이도가 큼.', '카테고리 특성을 고려하지 않으면 전체 모델 성능이 흔들릴 수 있음.'], note:'어떤 카테고리가 예측이 어려운가? → News' },
  { id:'strategy', tag:'전략', shortTitle:'운영 전략', title:'카테고리별 운영 전략', Chart:CategoryStrategyChart, findings:['Music은 초기 반응 흐름을 활용한 장기 지속 예측 전략.', 'Entertainment는 좋아요·댓글·업로드 시간 조합 최적화 전략.', 'News는 예측보다 빠른 모니터링과 이슈 변수 해석이 중요.'], note:'분석 결과를 실제 YouTube 운영 전략으로 연결' },
  { id:'playbook', tag:'연결', shortTitle:'플레이북', title:'카테고리별 의사결정 흐름', Chart:CategoryStoryChart, findings:['Music은 LSTM으로 시간 흐름을 추적하는 전략이 적합.', 'Entertainment는 MLP로 복합 반응 패턴을 반영.', 'News는 예측보다 실시간 이슈 감지와 변수 해석을 우선.'], note:'카테고리 비교 결과를 실제 운영 의사결정으로 연결' },
]

export default function ComparePage({ onBack }) {
  const [active, setActive] = useState(0)
  return <div className="yta-app-inner">
    <motion.button className="back-btn" onClick={onBack} whileHover={{ x:-3 }} transition={{ duration:.2 }}>← 목록으로</motion.button>
    <motion.div className="part-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
      <motion.span className="part-page-num" variants={fadeUp}>Part 6</motion.span>
      <motion.h1 className="part-page-title" variants={fadeUp}>카테고리 비교 — 트렌드/성능 분석</motion.h1>
      <motion.p className="part-page-subtitle" variants={fadeUp}>카테고리별 예측 성능, 난이도, 추천 모델을 비교해 카테고리 특화 전략을 도출합니다.</motion.p>
      <motion.div variants={fadeUp} style={{ display:'flex', alignItems:'center', gap:10 }}><div className="api-status api-status--ok"><span className="api-status-dot"/><span>API 연결 성공 · {API}</span></div></motion.div>
      <motion.div className="eda-summary-row" variants={fadeUpStagger}>
        {[['최고 성능','Music'],['추천 모델','LSTM'],['어려운 카테고리','News'],['분석 그룹','5개'],['전략 유형','3개']].map(([l,v])=><motion.div key={l} className="eda-summary-item" variants={fadeUp}><span className="eda-summary-label">{l}</span><span className="eda-summary-val"><CountUp value={v}/></span></motion.div>)}
      </motion.div>
    </motion.div>
    <TabSectionLayout sections={SECTIONS} active={active} setActive={setActive}/>
  </div>
}
