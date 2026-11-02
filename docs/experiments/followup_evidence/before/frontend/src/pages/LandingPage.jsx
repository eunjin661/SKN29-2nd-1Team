import trenditMark from '../assets/trendit-mark.svg'
// pages/LandingPage.jsx — 메인 홈 페이지 (리디자인)
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { fadeUp, fadeUpStagger } from '../animations/variants'

import CountUp from '../components/CountUp'

import useVerifiedResource from '../hooks/useVerifiedResource'

// ── 실시간 멀티라인 차트 ─────────────────────────────────────────
const CHART_SERIES = [
  { label: '엔터', color: '#FF2D2D', vals: [42,48,51,46,62,68,65,78,74,84,80,92] },
  { label: '라이프', color: '#3B82F6', vals: [28,32,35,40,44,50,53,58,62,68,72,78] },
  { label: '음악', color: '#A855F7', vals: [20,24,22,28,30,26,32,34,36,38,35,40] },
]

function LiveLineChart() {
  const w = 320, h = 110
  const allVals = CHART_SERIES.flatMap(d => d.vals)
  const max = Math.max(...allVals), min = Math.min(...allVals)
  const len = CHART_SERIES[0].vals.length
  const toX = i => (i / (len - 1)) * w
  const toY = v => h - ((v - min) / (max - min || 1)) * (h - 12) - 6

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height:'100%' }}>
      <defs>
        {CHART_SERIES.map(d => (
          <linearGradient key={d.label} id={`hg-${d.label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={d.color} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={d.color} stopOpacity="0"/>
          </linearGradient>
        ))}
      </defs>
      {[0.25,0.5,0.75].map(r => (
        <line key={r} x1={0} y1={h*r} x2={w} y2={h*r}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4"/>
      ))}
      {CHART_SERIES.map(d => {
        const pts = d.vals.map((v,i) => `${toX(i)},${toY(v)}`).join(' ')
        const fill = `0,${h} ${pts} ${w},${h}`
        const lineLen = d.vals.reduce((acc,v,i) => {
          if (i === 0) return acc
          const dx = toX(i) - toX(i-1), dy = toY(v) - toY(d.vals[i-1])
          return acc + Math.sqrt(dx*dx + dy*dy)
        }, 0)
        return (
          <g key={d.label}>
            <motion.polygon points={fill} fill={`url(#hg-${d.label})`}
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.8, delay:0.8 }}/>
            <motion.polyline points={pts} fill="none" stroke={d.color} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={Math.ceil(lineLen)}
              initial={{ strokeDashoffset: Math.ceil(lineLen) }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration:1.4, ease:'easeOut', delay:0.3 }}/>
            <motion.circle cx={toX(len-1)} cy={toY(d.vals[len-1])} r="4" fill={d.color}
              animate={{ r:[3,5,3], opacity:[1,0.5,1] }}
              transition={{ duration:2, repeat:Infinity, ease:'easeInOut' }}/>
          </g>
        )
      })}
    </svg>
  )
}

// ── 플로팅 트렌딩 카드 ────────────────────────────────────────────
function FloatingCard({ title, category, pct, rank, delay=0, color='#FF2D2D' }) {
  return (
    <motion.div
      animate={{ y:[0,-10,0] }}
      transition={{ duration:3.5+delay, repeat:Infinity, ease:'easeInOut', delay }}
      style={{
        background:'rgba(12,12,12,0.88)',
        border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:14, padding:'12px 16px',
        backdropFilter:'blur(16px)',
        minWidth:200,
        boxShadow:'0 16px 40px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{
          width:28, height:28, borderRadius:8, background:color,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:12, color:'#fff', fontWeight:700,
        }}>▶</div>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{title}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>{category}</div>
        </div>
        <div style={{
          marginLeft:'auto', background:`${color}22`,
          border:`1px solid ${color}55`, borderRadius:6,
          padding:'2px 7px', fontSize:10, fontWeight:700, color,
        }}>#{rank}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ flex:1, height:3, background:'rgba(255,255,255,0.08)', borderRadius:2 }}>
          <motion.div style={{ height:'100%', background:color, borderRadius:2 }}
            initial={{ width:0 }} animate={{ width:`${pct}%` }}
            transition={{ duration:1.2, delay:delay+0.5, ease:'easeOut' }}/>
        </div>
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>{pct}%</span>
      </div>
    </motion.div>
  )
}

// ── 히어로 대시보드 목업 ──────────────────────────────────────────
function HeroDashboard() {
  return (
    <div className="hero-dashboard-mock" style={{ position:'relative', width:460, minHeight:380 }}>
      {/* 메인 카드 */}
      <motion.div
        initial={{ opacity:0, y:30, scale:0.95 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ duration:0.8, delay:0.3, ease:[0.22,1,0.36,1] }}
        style={{
          background:'rgba(8,8,8,0.92)',
          border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:24, padding:24,
          backdropFilter:'blur(20px)',
          boxShadow:'0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* 헤더 */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <div style={{
            width:32, height:32, borderRadius:9, background:'#FF0000',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="13" height="11" viewBox="0 0 12 10" fill="white"><path d="M4 7.5V2.5L9 5L4 7.5Z"/></svg>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>YouTube KR Trending</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.38)' }}>실시간 트렌딩 분석 · 2022–2025</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
            <motion.div
              animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.5, repeat:Infinity }}
              style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E' }}/>
            <span style={{ fontSize:10, color:'#22C55E', fontWeight:600 }}>LIVE</span>
          </div>
        </div>

        {/* 차트 */}
        <div style={{ height:110, marginBottom:14 }}><LiveLineChart/></div>

        {/* 범례 */}
        <div style={{ display:'flex', gap:14, marginBottom:16 }}>
          {CHART_SERIES.map(d => (
            <div key={d.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:d.color }}/>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>{d.label}</span>
            </div>
          ))}
        </div>

        {/* 통계 그리드 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          {[
            { val:'34.9K', label:'트렌딩 이벤트', sub:'872K snapshots', c:'#22C55E' },
            { val:'108h',  label:'중간 지속',   sub:'median', c:'#3B82F6' },
            { val:'T0·24h', label:'모델 시점',  sub:'XGBoost · MLP', c:'#A855F7' },
          ].map(item => (
            <div key={item.label} style={{
              background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:12, padding:'12px 14px',
            }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:20, fontWeight:800, color:'#fff', letterSpacing:-0.5 }}>{item.val}</div>
              <div style={{ fontSize:10, color:item.c, fontWeight:600, marginTop:2 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 플로팅 카드 — 상단 우측 */}
      <motion.div
        initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }}
        transition={{ duration:0.7, delay:0.9 }}
        className="hero-floating-card hero-floating-card-top" style={{ position:'absolute', top:-32, right:-55 }}
      >
        <FloatingCard title="먹방 TOP 트렌딩" category="Lifestyle" pct={78} rank={1} delay={0} color="#FF6B35"/>
      </motion.div>

      {/* 플로팅 카드 — 하단 좌측 */}
      <motion.div
        initial={{ opacity:0, x:-40 }} animate={{ opacity:1, x:0 }}
        transition={{ duration:0.7, delay:1.2 }}
        className="hero-floating-card hero-floating-card-bottom" style={{ position:'absolute', bottom:-32, left:-55 }}
      >
        <FloatingCard title="신곡 발매 라이브" category="Music" pct={62} rank={3} delay={0.9} color="#A855F7"/>
      </motion.div>
    </div>
  )
}

// ── 배경 파티클 ───────────────────────────────────────────────────
function HeroParticles() {
  const dots = [
    { l:8,  t:20, s:3, c:'#FF2D2D', dur:3.2 },
    { l:25, t:65, s:2, c:'rgba(255,255,255,0.4)', dur:4.1 },
    { l:40, t:15, s:2, c:'#3B82F6', dur:3.8 },
    { l:55, t:75, s:3, c:'#A855F7', dur:4.5 },
    { l:70, t:30, s:2, c:'rgba(255,255,255,0.3)', dur:3.6 },
    { l:82, t:55, s:2, c:'#FF2D2D', dur:4.2 },
    { l:92, t:80, s:3, c:'#3B82F6', dur:3.4 },
    { l:15, t:85, s:2, c:'#A855F7', dur:4.8 },
    { l:60, t:50, s:2, c:'rgba(255,255,255,0.35)', dur:3.9 },
    { l:35, t:40, s:3, c:'#FF6B35', dur:4.3 },
  ]
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
      {dots.map((d, i) => (
        <motion.div key={i}
          style={{
            position:'absolute', width:d.s, height:d.s, borderRadius:'50%',
            background:d.c, left:`${d.l}%`, top:`${d.t}%`,
          }}
          animate={{ y:[0,-24,0], opacity:[0.3,0.9,0.3] }}
          transition={{ duration:d.dur, repeat:Infinity, ease:'easeInOut', delay:i*0.28 }}
        />
      ))}
      {/* 글로우 블롭 */}
      <div style={{
        position:'absolute', top:'5%', right:'15%',
        width:500, height:500, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(255,0,0,0.13) 0%, transparent 70%)',
        filter:'blur(50px)',
      }}/>
      <div style={{
        position:'absolute', bottom:'5%', left:'5%',
        width:360, height:360, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
        filter:'blur(40px)',
      }}/>
      <div style={{
        position:'absolute', top:'40%', left:'35%',
        width:280, height:280, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)',
        filter:'blur(35px)',
      }}/>
    </div>
  )
}

// ── 스파크라인 ────────────────────────────────────────────────────


// ── 카테고리 데이터 ───────────────────────────────────────────────
const CAT_DATA = [
  { rank:'TOP 1', rankSub:'지속시간', name:'라이프스타일', eng:'Lifestyle',
    icon:'🌿', bg:'linear-gradient(155deg,#1a1a2e 0%,#16213e 50%,#c0392b 100%)',
    accentColor:'#e74c3c',
    duration:'192h', pct:92, tdi:8, count:'8,497 이벤트 · TDI 51.2%' },
  { rank:'TOP 2', rankSub:'지속시간', name:'교육', eng:'Education',
    icon:'🎓', bg:'linear-gradient(155deg,#1c1c2e 0%,#2d1b4e 50%,#c0392b 100%)',
    accentColor:'#e74c3c',
    duration:'192h', pct:89, tdi:9, count:'593 이벤트 · TDI 53.1%' },
  { rank:'TOP 3', rankSub:'이벤트수', name:'엔터테인먼트', eng:'Entertainment',
    icon:'🎬', bg:'linear-gradient(155deg,#2c1810 0%,#4a1c1c 50%,#c0392b 100%)',
    accentColor:'#ff4444',
    duration:'96h', pct:52, tdi:5, count:'19,646 이벤트 · TDI 28.3%' },
  { rank:'TOP 4', rankSub:'지속시간', name:'음악', eng:'Music',
    icon:'🎵', bg:'linear-gradient(155deg,#1a1a2e 0%,#2e1a3e 50%,#a93226 100%)',
    accentColor:'#e74c3c',
    duration:'78h', pct:40, tdi:4, count:'5,241 이벤트 · TDI 29.8%' },
  { rank:'TOP 5', rankSub:'지속시간', name:'뉴스', eng:'News',
    icon:'📰', bg:'linear-gradient(155deg,#141e30 0%,#243b55 50%,#c0392b 100%)',
    accentColor:'#e74c3c',
    duration:'66h', pct:34, tdi:2, count:'987 이벤트 · TDI 18.4%' },
]

// ── 섹션 1: 카테고리 가로 스크롤 ─────────────────────────────────
function CategorySection({ navigate }) {
  const scrollRef = useRef(null)
  const [animated, setAnimated] = useState(false)
  const sectionRef = useRef(null)

  // IntersectionObserver로 화면 진입 시 바 애니메이션
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setAnimated(true); obs.disconnect() }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // 드래그 스크롤
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let isDown = false, startX, scrollLeft
    const down  = e => { isDown=true; el.style.cursor='grabbing'; startX=e.pageX-el.offsetLeft; scrollLeft=el.scrollLeft }
    const leave = () => { isDown=false; el.style.cursor='grab' }
    const up    = () => { isDown=false; el.style.cursor='grab' }
    const move  = e => { if(!isDown) return; e.preventDefault(); el.scrollLeft = scrollLeft-(e.pageX-el.offsetLeft-startX)*1.4 }
    el.addEventListener('mousedown', down)
    el.addEventListener('mouseleave', leave)
    el.addEventListener('mouseup', up)
    el.addEventListener('mousemove', move)
    return () => { el.removeEventListener('mousedown',down); el.removeEventListener('mouseleave',leave); el.removeEventListener('mouseup',up); el.removeEventListener('mousemove',move) }
  }, [])

  return (
    <section className="cat-section" ref={sectionRef}>
      <div className="cat-section-head">
        <div>
          <span className="eyebrow">Categories</span>
          <h2 className="cat-section-title">주요 카테고리<br/>트렌딩 분석</h2>
        </div>
        <button className="cat-section-more" onClick={() => navigate('/video')}>
          전체 비교하기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
          </svg>
        </button>
      </div>

      <div className="cat-scroll" ref={scrollRef}>
        {CAT_DATA.map((cat, idx) => (
          <motion.div
            key={cat.eng}
            className="cat-card-new"
            initial={{ opacity:0, y:40 }}
            whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true, amount:0.2 }}
            transition={{ duration:0.55, delay:idx*0.08, ease:[0.22,1,0.36,1] }}
            onClick={() => navigate('/video')}
          >
            <div className="cat-card-bg" style={{ background: cat.bg }}/>
            <div className="cat-card-shine"/>
            <div className="cat-card-inner">
              <div className="cat-rank-badge">
                <span className="cat-rank-text">{cat.rank}</span>
                <span className="cat-rank-sep"/>
                <span className="cat-rank-sub">{cat.rankSub}</span>
              </div>
              <div className="cat-card-icon-bg">{cat.icon}</div>
              <div className="cat-card-bottom">
                <div className="cat-card-name">{cat.name}</div>
                <div className="cat-card-eng">{cat.eng}</div>
                <div>
                  <div className="cat-bar-meta">
                    <span className="cat-bar-label">중위 지속시간</span>
                    <span className="cat-bar-value">{cat.duration}</span>
                  </div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: animated ? `${cat.pct}%` : '0%' }}/>
                  </div>
                  <div className="cat-tdi-dots">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`cat-tdi-dot ${animated && i < cat.tdi ? 'active' : ''}`}
                        style={{ transitionDelay: animated ? `${0.8 + i*0.06}s` : '0s' }}
                      />
                    ))}
                  </div>
                </div>
                <div className="cat-card-footer">
                  <span className="cat-card-count">{cat.count}</span>
                  <div className="cat-card-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <polyline points="9,6 15,12 9,18"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="cat-scroll-hint">
        <div className="cat-scroll-line"/>
        <span className="cat-scroll-text">← 드래그해서 더 보기</span>
        <div className="cat-scroll-line"/>
      </div>
    </section>
  )
}

// ── 섹션 2: 핵심 수치 풀블리드 다크 ─────────────────────────────
function MetricsSection() {
  const [vis, setVis] = useState(false)
  const evaluation = useVerifiedResource('/evaluation')
  const report = evaluation.data
  const selected = report?.models.find(row => row.name === report.selected_model)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current; if(!el) return
    const obs = new IntersectionObserver(([e]) => { if(e.isIntersecting){setVis(true);obs.disconnect()} }, {threshold:0.25})
    obs.observe(el); return () => obs.disconnect()
  }, [])

  const metricData = [
    { label: 'Test ROC-AUC', value: selected ? selected.test.auc.toFixed(4) : '—', unit: '', sub: report?.selected_model || '평가 보고서 확인 필요', accent: 'linear-gradient(90deg,#ff2d2d,#ff7878)' },
    { label: 'Test F1', value: selected ? selected.test.f1.toFixed(4) : '—', unit: '', sub: 'Validation에서 선택한 임계값 기준', accent: 'linear-gradient(90deg,#ff6b6b,#ffaaaa)' },
    { label: 'Test 이벤트', value: report ? report.data.splits.test.rows.toLocaleString('ko-KR') : '—', unit: '', sub: '시간 분할 · 미등장 영상 평가', accent: 'linear-gradient(90deg,#c0392b,#e74c3c)' },
  ]

  return (
    <section className="metrics-section" ref={ref}>
      <div className="metrics-grid-overlay"/>
      <div className="metrics-red-glow"/>
      <div className="metrics-header">
        <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,ease:[0.22,1,0.36,1]}}>
          <span className="eyebrow" style={{color:'rgba(255,255,255,0.4)'}}>Model Performance</span>
          <h2 className="metrics-title">
            성능은 수치로 확인하고<br/>
            <span className="metrics-title-accent">결정은 전략으로 연결</span>
          </h2>
        </motion.div>
        <motion.p className="metrics-desc" initial={{opacity:0}} whileInView={{opacity:1}} viewport={{once:true}} transition={{duration:0.6,delay:0.2}}>
          검증된 T0 v2 보고서에서 읽은 오프라인 분류 결과입니다. 단일 분할·시드 결과이며 실제 운영 효과는 검증하지 않았습니다.
        </motion.p>
      </div>

      {evaluation.error && <p role="alert" style={{ color: 'white', textAlign: 'center' }}>평가 보고서를 불러오지 못했습니다. 임의 성능은 표시하지 않습니다.</p>}
      <p style={{ color: 'rgba(255,255,255,.65)', textAlign: 'center', padding: '0 20px', overflowWrap: 'anywhere', fontSize: 12 }}>{report ? `실험 ID: ${report.run_id}` : evaluation.loading ? '검증 보고서 확인 중' : '보고서 연결 확인 필요'}</p>
      <div className="metrics-cards" data-testid="home-verified-metrics">
        {metricData.map((m, i) => (
          <motion.div
            key={m.label}
            className="metric-card"
            initial={{opacity:0,y:32}}
            whileInView={{opacity:1,y:0}}
            viewport={{once:true,amount:0.3}}
            transition={{duration:0.55,delay:i*0.1,ease:[0.22,1,0.36,1]}}
          >
            <div className="metric-card-top-line" style={{background:m.accent}}/>
            <div className="metric-card-label">{m.label}</div>
            <div className="metric-card-value">
              <motion.span
                initial={{opacity:0,y:12}} animate={vis?{opacity:1,y:0}:{}}
                transition={{duration:0.6,delay:0.3+i*0.12}}
              >
                {m.value}
              </motion.span>
              <span className="metric-card-unit">{m.unit}</span>
            </div>
            <div className="metric-card-sub">{m.sub}</div>

          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ── 섹션 3: 인사이트 매거진 ──────────────────────────────────────
const INSIGHT_BIG = {
  icon:'🔥', tag:'Featured Insight',
  title:'트렌딩 반응 패턴 분석',
  desc:'좋아요·댓글·조회수 반응 데이터를 통해 영상별 확산 메커니즘과 카테고리별 조회수 증가 패턴을 심층 분석합니다.',
}
const INSIGHT_SMALL = [
  { icon:'⏱', bg:'rgba(255,0,0,0.08)', title:'트렌딩 지속성 예측', desc:'트렌드 수명주기를 예측하고 지속성을 TDI로 수치화합니다.' },
  { icon:'📊', bg:'rgba(255,0,0,0.06)', title:'영상 분석', desc:'카테고리별 대표 영상을 보고 조회수 증가와 반응 지표를 함께 확인합니다.' },
  { icon:'🎯', bg:'rgba(255,0,0,0.05)', title:'캠페인 플래너', desc:'예산·목표·CPM 기반으로 광고 집행 전략을 설계합니다.' },
]


function VideoTransitionModal({ open, onClose, onGoVideo }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="video-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="video-modal-card"
            initial={{ opacity: 0, scale: 0.88, y: 36 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="video-modal-close" type="button" onClick={onClose} aria-label="닫기">×</button>
            <motion.div
              className="video-modal-orb"
              animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >▶</motion.div>
            <p className="eyebrow">Video Analysis</p>
            <h3>실제 API 데이터로 영상 분석 페이지를 열까요?</h3>
            <p>
              YouTube KR 트렌딩 API에서 카테고리별 영상을 불러오고, 선택 영상의 24h 성장 그래프와 AI 예측 인사이트를 함께 보여줍니다.
            </p>
            <div className="video-modal-flow">
              <span>API 호출</span><b>→</b><span>카테고리 피드</span><b>→</b><span>예측 인사이트</span>
            </div>
            <div className="video-modal-actions">
              <motion.button type="button" className="modal-secondary" onClick={onClose} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                닫기
              </motion.button>
              <motion.button type="button" className="modal-primary" onClick={onGoVideo} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                영상분석으로 이동 →
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function InsightSection({ navigate }) {
  const [videoModalOpen, setVideoModalOpen] = useState(false)

  const handleInsightClick = (ins) => {
    if (ins.title === '영상 분석') {
      setVideoModalOpen(true)
      return
    }
    if (ins.title === '트렌딩 지속성 예측') {
      navigate('/sustain')
      return
    }
    if (ins.title === '캠페인 플래너') {
      navigate('/campaign')
      return
    }
    navigate('/analysis')
  }

  return (
    <section className="insight-section">
      <div className="insight-head">
        <div>
          <span className="eyebrow">Campaign Planner</span>
          <h2 className="insight-title">캠페인 의사결정</h2>
        </div>
        <button className="cat-section-more" onClick={() => navigate('/campaign')}>
          캠페인 플래너 보기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
          </svg>
        </button>
      </div>

      <motion.div
        className="insight-grid"
        initial={{opacity:0,y:32}} whileInView={{opacity:1,y:0}}
        viewport={{once:true,amount:0.2}}
        transition={{duration:0.6,ease:[0.22,1,0.36,1]}}
      >
        <div className="ins-card-big" onClick={() => navigate('/analysis')}>
          <div className="ins-big-deco">{INSIGHT_BIG.icon}</div>
          <div className="ins-big-tag">{INSIGHT_BIG.tag}</div>
          <div className="ins-big-title">{INSIGHT_BIG.title}</div>
          <div className="ins-big-desc">{INSIGHT_BIG.desc}</div>
          <div className="ins-big-cta">
            자세히 보기
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
            </svg>
          </div>
        </div>

        <div className="ins-small-col">
          {INSIGHT_SMALL.map((ins, i) => (
            <motion.div
              key={ins.title}
              className={`ins-card-sm ${ins.title === '영상 분석' ? 'video-insight-card' : ''}`}
              onClick={() => handleInsightClick(ins)}
              whileHover={{ y: -8, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              initial={{opacity:0,x:24}} whileInView={{opacity:1,x:0}}
              viewport={{once:true}}
              transition={{duration:0.5,delay:i*0.1,ease:[0.22,1,0.36,1]}}
            >
              <div className="ins-sm-icon" style={{background:ins.bg}}>{ins.icon}</div>
              <div>
                <div className="ins-sm-title">{ins.title}</div>
                <div className="ins-sm-desc">{ins.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
      <VideoTransitionModal
        open={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        onGoVideo={() => navigate('/video')}
      />
    </section>
  )
}

// ── 섹션 4: CTA ──────────────────────────────────────────────────
function CTASection({ navigate }) {
  return (
    <motion.div
      className="cta-section"
      initial={{opacity:0,y:40,scale:0.97}}
      whileInView={{opacity:1,y:0,scale:1}}
      viewport={{once:true,amount:0.4}}
      transition={{duration:0.65,ease:[0.22,1,0.36,1]}}
    >
      <div className="cta-blob1"/>
      <div className="cta-blob2"/>
      <div style={{position:'relative'}}>
        <div className="cta-label">지금 바로 시작하세요</div>
        <div className="cta-title">34,964개 이벤트로<br/>직접 분석해보세요</div>
      </div>
      <div className="cta-btns" style={{position:'relative'}}>
        <motion.button className="cta-btn-primary" onClick={() => navigate('/analysis')}
          whileHover={{scale:1.05}} whileTap={{scale:0.97}}>
          분석 시작하기
        </motion.button>
        <motion.button className="cta-btn-secondary" onClick={() => navigate('/video')}
          whileHover={{scale:1.03}} whileTap={{scale:0.97}}>
          영상 분석
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── Footer ────────────────────────────────────────────────────────
function Footer({ navigate }) {
  const links = [
    { label: '트렌딩 분석', path: '/analysis' },
    { label: 'EDA', path: '/analysis/eda' },
    { label: '영상 분석', path: '/video' },
    { label: '예측 시스템', path: '/analysis/predict' },
    { label: '캠페인 플래너', path: '/campaign' },
  ]
  return (
    <footer style={{
      background: '#111',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '56px 72px 40px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:48 }}>
        {/* 로고 */}
        <div>
          <button
            type="button"
            className="yta-footer-brand"
            onClick={() => navigate('/')}
            aria-label="TrendIt 홈으로 이동"
          >
            <img className="yta-footer-brand-mark" src={trenditMark} alt="" aria-hidden="true" />
            <span className="yta-footer-brand-word">
              Trend<span>It</span>
            </span>
          </button>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', lineHeight:1.7, maxWidth:260 }}>
            한국 유튜브 원본 스냅샷 872,191건을 기반으로<br/>
            34,964개 트렌딩 이벤트의 지속성을 분석합니다.
          </p>
        </div>
        {/* 링크 */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>분석 메뉴</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {links.map(l => (
              <button key={l.label} onClick={() => navigate(l.path)} style={{
                background:'none', border:'none', padding:0,
                fontSize:13, color:'rgba(255,255,255,0.55)', cursor:'pointer',
                fontFamily:'inherit', textAlign:'left',
                transition:'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color='#fff'}
              onMouseLeave={e => e.target.style.color='rgba(255,255,255,0.55)'}
              >{l.label}</button>
            ))}
          </div>
        </div>
        {/* 데이터 정보 */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>데이터 정보</div>
          {[
            ['수집 기간', '2022.07 – 2025.06'],
            ['데이터 소스', 'YouTube KR Top 200'],
            ['트렌딩 이벤트', '34,964건'],
            ['현재 평가', 'T0 v2 · 모델 결과에서 확인'],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', gap:16, marginBottom:8 }}>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)', width:80, flexShrink:0 }}>{k}</span>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {/* 하단 */}
      <div style={{
        borderTop:'1px solid rgba(255,255,255,0.06)',
        paddingTop:24,
        display:'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.22)' }}>
          © 2025 Trendit · SKN29 딥러닝 프로젝트
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E' }}/>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>실측 데이터 기반 분석</span>
        </div>
      </div>
    </footer>
  )
}


// ── MD 레퍼런스 기반 분석 흐름 섹션 ───────────────────────────────
function AnalysisFlowSection({ navigate }) {
  const flow = ['전처리', 'EDA', '클러스터링', 'ML·DL', '결론']
  const pages = [
    { title:'트렌딩 분석', desc:'데이터 구조, 전처리, EDA 흐름 확인', path:'/analysis', tag:'SECTION 01–04' },
    { title:'카테고리 비교', desc:'5개 그룹별 지속 시간과 TDI 비교', path:'/analysis/compare', tag:'CATEGORY' },
    { title:'지속성 분석', desc:'trending_duration_h와 TDI 기준 해석', path:'/sustain', tag:'TARGET' },
    { title:'예측 시스템', desc:'T0 / 24h 피처 기반 예측 구조', path:'/analysis/predict', tag:'MODEL' },
  ]

  return (
    <section className="analysis-flow-section">
      <div className="analysis-flow-head">
        <span className="eyebrow">PROJECT FLOW</span>
        <h2>분석 보고서 구조를 메인에서 바로 이해하도록 정리</h2>
        <p>전처리부터 모델링까지의 흐름을 한 줄로 보여주고, 주요 페이지로 바로 이동할 수 있게 구성했습니다.</p>
      </div>

      <div className="flow-line-card">
        {flow.map((step, i) => (
          <div className="flow-step" key={step}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <strong>{step}</strong>
            {i !== flow.length - 1 && <b>→</b>}
          </div>
        ))}
      </div>

      <div className="analysis-page-grid">
        {pages.map((page, i) => (
          <motion.button
            key={page.title}
            className="analysis-page-card"
            onClick={() => navigate(page.path)}
            whileHover={{ y:-8, scale:1.01 }}
            whileTap={{ scale:0.98 }}
            initial={{ opacity:0, y:24 }}
            whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true, amount:0.2 }}
            transition={{ duration:0.45, delay:i * 0.05 }}
          >
            <span>{page.tag}</span>
            <h3>{page.title}</h3>
            <p>{page.desc}</p>
            <em>바로 보기 →</em>
          </motion.button>
        ))}
      </div>
    </section>
  )
}

// ── 데이터 이벤트 정의 프리뷰 ────────────────────────────────────


// ── 메인 ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { scrollY } = useScroll()
  const heroY       = useTransform(scrollY, [0,400], [0,-50])
  const heroOpacity = useTransform(scrollY, [0,350], [1,0.25])

  const trustBadges = [
    '✦ 34,964 이벤트','✦ 2022–2025','✦ KR Top 200','✦ 5 카테고리',
    '✦ XGBoost · MLP','✦ 전처리→EDA→ML·DL','✦ 실측 parquet',
    '✦ 34,964 이벤트','✦ 2022–2025','✦ KR Top 200','✦ 5 카테고리',
  ]
  const stats = [
    { val:'872,191', label:'RAW 스냅샷',  sub:'원본 수집 데이터'     },
    { val:'34,964', label:'트렌딩 이벤트',   sub:'(video_id, event_id)' },
    { val:'108',    label:'중간 지속 시간', sub:'약 4.5일'            },
    { val:'5',      label:'카테고리 그룹', sub:'Entertainment · Music · Lifestyle · Education · News' },
  ]

  return (
    <div className="yta-page">

      {/* ── HERO (다크) ── */}
      <section className="yta-hero yta-hero-dark">
        <HeroParticles/>

        <motion.div className="yta-hero-left" style={{ y:heroY, opacity:heroOpacity }}
          variants={fadeUpStagger} initial="hidden" animate="show">

          {/* 라이브 뱃지 */}
          <motion.div variants={fadeUp} style={{
            display:'inline-flex', alignItems:'center', gap:8,
            background:'rgba(255,0,0,0.08)', border:'1px solid rgba(255,0,0,0.18)',
            borderRadius:100, padding:'6px 14px', marginBottom:22,
          }}>
            <motion.div
              animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.5, repeat:Infinity }}
              style={{ width:6, height:6, borderRadius:'50%', background:'#FF0000' }}/>
            <span style={{ fontSize:12, fontWeight:600, color:'#cc0000' }}>
              KR 유튜브 트렌딩 지속성 분석
            </span>
          </motion.div>

          <motion.div className="target-badge-row" variants={fadeUp}>
            <span className="target-badge">회귀 타겟 · trending_duration_h</span>
            <span className="target-badge target-badge-green">분류 타겟 · tdi_label</span>
          </motion.div>

          <motion.h1 className="yta-hero-title" variants={fadeUp}>
            <span className="gradient-text">데이터로 읽는</span><br/>
            콘텐츠 성과,<br/>
            <span className="gradient-text-sub">전략으로 연결하다</span>
          </motion.h1>

          <motion.p className="yta-hero-sub" variants={fadeUp}>
            조회수·좋아요·댓글 반응을 기반으로<br/>
            트렌딩 지속 가능성을 예측하고 실행 전략까지 제안합니다.
          </motion.p>

          <motion.p className="hero-trust-note" variants={fadeUp}>
            ※ 본 예측은 실측 데이터 기반 통계 모델로 가능성을 추정한 결과입니다.
          </motion.p>

          <motion.div className="hero-value-grid" variants={fadeUp}>
            <div><b>예측</b><span>성과 가능성 수치화</span></div>
            <div><b>해석</b><span>핵심 변수 확인</span></div>
            <div><b>전략</b><span>다음 액션 제안</span></div>
          </motion.div>

          <motion.div className="yta-hero-btns yta-hero-btns--single" variants={fadeUp}>
            <motion.button className="yta-btn-primary yta-btn-gradient"
              onClick={() => navigate('/analysis')}
              whileHover={{ scale:1.05, boxShadow:'0 8px 28px rgba(255,0,0,0.5)' }}
              whileTap={{ scale:0.96 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
              </svg>
              예측 시작하기
            </motion.button>
          </motion.div>

          {/* 신뢰도 슬라이더 */}
          <motion.div variants={fadeUp} className="trust-slider-wrap">
            <div className="trust-slider">
              <div className="trust-track">
                {trustBadges.map((b,i) => (
                  <span key={i} className="trust-badge">{b}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* 우측 대시보드 */}
        <motion.div className="yta-hero-right"
          initial={{ opacity:0, x:50, scale:0.95 }}
          animate={{ opacity:1, x:0, scale:1 }}
          transition={{ duration:0.8, delay:0.25, ease:[0.22,1,0.36,1] }}>
          <HeroDashboard/>
        </motion.div>
      </section>

      {/* ── 통계 Strip ── */}
      <motion.section className="stat-strip"
        variants={fadeUpStagger} initial="hidden" whileInView="show"
        viewport={{ once:true, amount:0.3 }}>
        {stats.map((s,i) => (
          <motion.div key={i} className="stat-strip-card" variants={fadeUp}
            whileHover={{ y:-6, boxShadow:'0 12px 32px rgba(255,0,0,0.12)', borderColor:'var(--red)' }}>
            <div className="stat-strip-val">
              <CountUp value={s.val}/>{i===2?'h':''}
            </div>
            <div className="stat-strip-label">{s.label}</div>
            <div className="stat-strip-sub">{s.sub}</div>
          </motion.div>
        ))}
      </motion.section>

      <AnalysisFlowSection navigate={navigate}/>

      {/* ── 새 섹션들 ── */}
      <CategorySection navigate={navigate}/>
      <MetricsSection/>
      <InsightSection navigate={navigate}/>
      <CTASection navigate={navigate}/>
      <Footer navigate={navigate}/>
    </div>
  )
}