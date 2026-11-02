import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { fadeUp, fadeUpStagger, slideTab } from "../animations/variants"
import "../styles/InsightPage.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"



const FALLBACK_INSIGHT_DATA = {
  summary: {
    totalRows: 34964,
    categories: 5,
    avgDuration: 144.1,
    keySignal: "초기 조회 속도",
  },
  viewDuration: [
    { view: 5000, duration: 42 },
    { view: 25000, duration: 58 },
    { view: 120000, duration: 86 },
    { view: 450000, duration: 118 },
    { view: 980000, duration: 132 },
    { view: 2100000, duration: 145 },
  ],
  categoryPattern: [
    { name: "Lifestyle", duration: 185.7 },
    { name: "Education", duration: 175.1 },
    { name: "Entertainment", duration: 134.5 },
    { name: "Music", duration: 117.5 },
    { name: "News", duration: 100.7 },
  ],
  engagement: [
    { ratio: 0.001, duration: 50 },
    { ratio: 0.003, duration: 70 },
    { ratio: 0.006, duration: 110 },
    { ratio: 0.009, duration: 130 },
    { ratio: 0.014, duration: 160 },
  ],
  wave: [
    { day: "월", value: 0 },
    { day: "화", value: 0.78 },
    { day: "수", value: 0.97 },
    { day: "목", value: 0.43 },
    { day: "금", value: -0.43 },
    { day: "토", value: -0.97 },
    { day: "일", value: -0.78 },
  ],
}

async function fetchInsightSummary() {
  const res = await fetch(`${API}/insight/summary`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

function formatNum(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}





function ViewDurationChart({ data }) {
  const rows = data?.length ? data : FALLBACK_INSIGHT_DATA.viewDuration
  const W=720,H=310,L=76,R=36,T=34,B=54
  const maxX=Math.max(...rows.map(d=>Number(d.view)||0),1)
  const maxY=Math.max(...rows.map(d=>Number(d.duration)||0),1)
  const x=v=>L+(Number(v||0)/maxX)*(W-L-R)
  const y=v=>H-B-(Number(v||0)/maxY)*(H-T-B)
  return <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="조회수 vs 지속시간">
    {[0,.25,.5,.75,1].map(p=><g key={p}><line x1={L} x2={W-R} y1={H-B-p*(H-T-B)} y2={H-B-p*(H-T-B)} className="svg-grid"/><text x={L-12} y={H-B-p*(H-T-B)+4} textAnchor="end" className="svg-tick">{Math.round(maxY*p)}h</text></g>)}
    {[0,.25,.5,.75,1].map(p=><text key={p} x={L+p*(W-L-R)} y={H-20} textAnchor="middle" className="svg-tick">{formatNum(maxX*p)}</text>)}
    <line x1={L} x2={W-R} y1={H-B} y2={H-B} stroke="var(--border)"/><line x1={L} x2={L} y1={T} y2={H-B} stroke="var(--border)"/>
    <line x1={L} y1={H-B-18} x2={W-R} y2={T+38} stroke="var(--red)" strokeWidth="3" opacity=".16" strokeDasharray="8 8"/>
    {rows.map((d,i)=><circle key={i} cx={x(d.view)} cy={y(d.duration)} r="7" className="svg-scatter-dot" style={{animationDelay:`${i*70}ms`}}/>)}
  </svg>
}

function CategoryPatternChart({ data }) {
  const rows = data?.length ? data : FALLBACK_INSIGHT_DATA.categoryPattern
  const W=720,H=310,L=70,R=36,T=36,B=60
  const max=Math.max(...rows.map(d=>Number(d.duration)||0),1)
  const gap=(W-L-R)/rows.length,bw=gap*.5
  const y=v=>H-B-(Number(v||0)/max)*(H-T-B)
  return <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="카테고리별 트렌딩 패턴">
    {[0,.25,.5,.75,1].map(p=><g key={p}><line x1={L} x2={W-R} y1={H-B-p*(H-T-B)} y2={H-B-p*(H-T-B)} className="svg-grid"/><text x={L-12} y={H-B-p*(H-T-B)+4} textAnchor="end" className="svg-tick">{Math.round(max*p)}h</text></g>)}
    {rows.map((d,i)=>{const x=L+i*gap+(gap-bw)/2,h=H-B-y(d.duration);return <g key={d.name}><rect x={x} y={T} width={bw} height={H-T-B} rx="14" className="svg-bar-bg"/><rect x={x} y={y(d.duration)} width={bw} height={h} rx="14" className="svg-bar" style={{animationDelay:`${i*80}ms`}}/><text x={x+bw/2} y={H-24} textAnchor="middle" className="svg-label">{d.name}</text><text x={x+bw/2} y={y(d.duration)-10} textAnchor="middle" className="svg-value">{d.duration}h</text></g>})}
  </svg>
}

function EngagementChart({ data }) {
  const rows = data?.length ? data : FALLBACK_INSIGHT_DATA.engagement
  const W=720,H=310,L=76,R=36,T=34,B=54
  const maxX=Math.max(...rows.map(d=>Number(d.ratio)||0),.001)
  const maxY=Math.max(...rows.map(d=>Number(d.duration)||0),1)
  const x=v=>L+(Number(v||0)/maxX)*(W-L-R)
  const y=v=>H-B-(Number(v||0)/maxY)*(H-T-B)
  return <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Engagement 영향력">
    {[0,.25,.5,.75,1].map(p=><g key={p}><line x1={L} x2={W-R} y1={H-B-p*(H-T-B)} y2={H-B-p*(H-T-B)} className="svg-grid"/><text x={L-12} y={H-B-p*(H-T-B)+4} textAnchor="end" className="svg-tick">{Math.round(maxY*p)}h</text></g>)}
    <line x1={L} x2={W-R} y1={H-B} y2={H-B} stroke="var(--border)"/><line x1={L} x2={L} y1={T} y2={H-B} stroke="var(--border)"/>
    {rows.map((d,i)=><circle key={i} cx={x(d.ratio)} cy={y(d.duration)} r="8" className="svg-scatter-dot" style={{animationDelay:`${i*80}ms`}}/>)}
    <text x={W-R} y={H-20} textAnchor="end" className="svg-label">댓글 비율 →</text>
  </svg>
}

function AppleWaveChart({ data }) {
  const waveData = data?.length ? data : FALLBACK_INSIGHT_DATA.wave
  const W=720,H=260,L=46,R=34,T=26,B=42
  const x=i=>L+(i/(waveData.length-1))*(W-L-R)
  const y=v=>T+((1-Number(v))/2)*(H-T-B)
  const base=y(0)
  const pts=waveData.map((d,i)=>`${x(i)},${y(d.value)}`).join(' ')
  const area=`${L},${base} ${pts} ${W-R},${base}`
  return <div className="insight-wave-card"><div className="insight-wave-glow"/><div className="insight-wave-head"><span className="insight-wave-kicker">Time Pattern</span><strong>요일 성과 Wave</strong><p>요일을 선형 숫자가 아닌 반복되는 패턴으로 해석합니다.</p></div><svg className="svg-chart svg-chart--line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="요일 성과 Wave"><line x1={L} x2={W-R} y1={base} y2={base} className="svg-grid"/><polygon points={area} className="svg-soft-fill"/><polyline points={pts} className="svg-wave-line"/>{waveData.map((d,i)=><g key={d.day} className="svg-point-group"><circle cx={x(i)} cy={y(d.value)} r="6" className="svg-point"/><text x={x(i)} y={H-14} textAnchor="middle" className="svg-label">{d.day}</text></g>)}</svg><div className="insight-wave-metrics"><div><span>weekday</span><strong>7 cycle</strong></div><div><span>range</span><strong>-1 ~ 1</strong></div><div><span>use</span><strong>timing insight</strong></div></div></div>
}

function InsightSummaryCards() {
  const cards = [
    ["초기 조회 속도", "트렌딩 진입 직후의 반응 속도가 지속성 예측의 핵심 신호입니다."],
    ["Engagement", "댓글 비율처럼 사용자의 반응 강도는 단순 조회수보다 질적인 신호입니다."],
    ["카테고리 전략", "카테고리별로 빠르게 뜨는 유형과 오래 유지되는 유형이 다릅니다."],
    ["업로드 타이밍", "요일과 시간은 순환형 패턴으로 해석해야 안정적인 전략화가 가능합니다."],
  ]

  return (
    <div className="insight-summary-grid">
      {cards.map(([title, desc], i) => (
        <motion.div
          key={title}
          className="insight-summary-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          whileHover={{ y: -4 }}
        >
          <span>0{i + 1}</span>
          <strong>{title}</strong>
          <p>{desc}</p>
        </motion.div>
      ))}
    </div>
  )
}

export default function InsightPage({ onBack }) {
  const [active, setActive] = useState(0)
  const [data, setData] = useState(FALLBACK_INSIGHT_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetchInsightSummary()
      .then((json) => {
        if (!cancelled) {
          console.log("🔥 insight data:", json)
          setData({ ...FALLBACK_INSIGHT_DATA, ...json })
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Insight API error:", err)
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  const sections = useMemo(() => [
    {
      id: "view_duration",
      tag: "RELATION",
      title: "조회수 vs 지속시간 관계",
      shortTitle: "조회수 관계",
      Chart: () => <ViewDurationChart data={data.viewDuration} />,
      findings: [
        "초기 조회수가 높을수록 트렌딩 지속시간이 증가하는 경향이 있습니다.",
        "다만 일정 수준 이후에는 조회수만으로 지속성을 설명하기 어렵습니다.",
        "따라서 조회수와 함께 반응률, 카테고리, 시간 변수를 함께 해석해야 합니다.",
      ],
      note: "초기 조회수는 중요하지만 단독 변수로는 한계가 있음",
    },
    {
      id: "category",
      tag: "CATEGORY",
      title: "카테고리별 트렌딩 패턴",
      shortTitle: "카테고리",
      Chart: () => <CategoryPatternChart data={data.categoryPattern} />,
      findings: [
        "카테고리별로 트렌딩 지속 시간이 다르게 나타납니다.",
        "Lifestyle과 Education은 상대적으로 긴 지속시간을 보이는 경향이 있습니다.",
        "News와 Music은 빠르게 소비되는 트렌딩 패턴으로 해석할 수 있습니다.",
      ],
      note: "카테고리별 업로드 전략을 다르게 설계할 필요가 있음",
    },
    {
      id: "time",
      tag: "TIME",
      title: "시간대·요일 패턴 해석",
      shortTitle: "시간 패턴",
      Chart: () => <AppleWaveChart data={data.wave} />,
      findings: [
        "요일과 시간은 반복되는 순환형 패턴이므로 일반 숫자로만 해석하면 왜곡될 수 있습니다.",
        "요일별 신호를 wave 형태로 보면 주기성이 더 직관적으로 드러납니다.",
        "업로드 타이밍은 콘텐츠 성격과 함께 전략적으로 해석해야 합니다.",
      ],
      note: "요일/시간은 cycle feature와 전략 인사이트를 연결하는 변수",
    },
    {
      id: "engagement",
      tag: "REACTION",
      title: "Engagement 영향력",
      shortTitle: "반응률",
      Chart: () => <EngagementChart data={data.engagement} />,
      findings: [
        "댓글 비율은 단순 조회수보다 사용자의 적극적인 반응을 나타냅니다.",
        "Engagement가 높은 영상은 장기 지속 가능성이 높아질 수 있습니다.",
        "모델 해석에서는 조회수 규모와 반응률을 함께 비교해야 합니다.",
      ],
      note: "engagement_ratio는 지속성 해석의 질적 신호",
    },
    {
      id: "summary",
      tag: "INSIGHT",
      title: "핵심 인사이트 요약",
      shortTitle: "요약",
      Chart: () => <InsightSummaryCards />,
      findings: [
        "초기 조회 속도는 트렌딩 진입 이후 지속성 판단의 핵심입니다.",
        "카테고리별로 확산형 콘텐츠와 지속형 콘텐츠의 전략이 달라야 합니다.",
        "조회수, 반응률, 업로드 타이밍을 함께 해석해야 실무 전략으로 연결됩니다.",
      ],
      note: "그래프 → 해석 → 전략으로 연결하는 Part",
    },
  ], [data])

  const sec = sections[active]
  const total = sections.length

  return (
    <div className="yta-app-inner insight-page">
      <motion.button className="back-btn" onClick={onBack} whileHover={{ x: -3 }} transition={{ duration: 0.2 }}>
        ← 목록으로
      </motion.button>

      <motion.div className="part-page-header insight-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
        <motion.span className="part-page-num" variants={fadeUp}>Part 3</motion.span>
        <motion.h1 className="part-page-title" variants={fadeUp}>데이터 해석</motion.h1>
        <motion.p className="part-page-subtitle" variants={fadeUp}>
          EDA와 Feature Engineering 결과를 바탕으로 트렌딩 지속성에 영향을 주는 패턴을 해석합니다.
        </motion.p>

        <motion.div variants={fadeUp}>
          {loading && <div className="api-status api-status--loading"><span className="api-status-dot" /><span>API 연결 중…</span></div>}
          {!loading && !error && <div className="api-status api-status--ok"><span className="api-status-dot" /><span>API 연결 성공 · {API}</span></div>}
          {!loading && error && <div className="api-status api-status--fail"><span className="api-status-dot" /><span>API 연결 실패 · 로컬 데이터 사용 중</span></div>}
        </motion.div>

        <motion.div className="eda-summary-row" variants={fadeUpStagger}>
          {[
            ["총 데이터", data.summary?.totalRows?.toLocaleString() ?? "34,964"],
            ["카테고리", `${data.summary?.categories ?? 5}그룹`],
            ["평균 지속", `${data.summary?.avgDuration ?? 144.1}h`],
            ["핵심 신호", data.summary?.keySignal ?? "초기 조회 속도"],
          ].map(([label, value]) => (
            <motion.div key={label} className="eda-summary-item" variants={fadeUp}>
              <span className="eda-summary-label">{label}</span>
              <span className="eda-summary-val">{value}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="eda-tabs insight-tabs">
          {sections.map((s, i) => (
            <motion.button key={s.id} className={`eda-tab ${active === i ? "on" : ""}`} onClick={() => setActive(i)} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <span className="eda-tab-tag">{s.tag}</span>
              <span className="eda-tab-title">{s.shortTitle}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={sec.id} className="eda-body insight-body" variants={slideTab} initial="hidden" animate="show" exit="exit">
            <div className="eda-chart-panel">
              <p className="eda-chart-title">{sec.title}</p>
              <div className="eda-chart-wrap insight-chart-wrap">
                {loading ? <div className="insight-empty-chart">Loading...</div> : <sec.Chart />}
              </div>
            </div>

            <div className="eda-desc-panel">
              <div className="eda-tag-row">
                <span className="eda-big-tag">{sec.tag}</span>
                <span className="eda-progress">{active + 1} / {total}</span>
              </div>

              <h3 className="eda-desc-title">{sec.title}</h3>
              <p className="eda-findings-label">주요 해석</p>

              <ul className="eda-findings">
                {sec.findings.map((finding, i) => (
                  <motion.li key={finding} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.3 }}>
                    <span className="eda-finding-num">{i + 1}</span>{finding}
                  </motion.li>
                ))}
              </ul>

              <div className="eda-note-box">
                <span className="eda-note-label">INSIGHT</span>
                <span className="eda-note-text">{sec.note}</span>
              </div>

              <div className="eda-nav-btns">
                <motion.button className="eda-nav-btn" disabled={active === 0} onClick={() => setActive((a) => a - 1)} whileHover={active > 0 ? { x: -2 } : {}} whileTap={active > 0 ? { scale: 0.97 } : {}}>← 이전</motion.button>
                <motion.button className="eda-nav-btn" disabled={active === total - 1} onClick={() => setActive((a) => a + 1)} whileHover={active < total - 1 ? { x: 2 } : {}} whileTap={active < total - 1 ? { scale: 0.97 } : {}}>다음 →</motion.button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
