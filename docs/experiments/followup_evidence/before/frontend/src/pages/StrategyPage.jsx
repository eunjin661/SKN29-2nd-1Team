import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { fadeUp, fadeUpStagger, slideTab } from "../animations/variants"
import "../styles/StrategyPage.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"



const FALLBACK = {
  summary: {
    totalRows: 34964,
    topCategory: "Lifestyle",
    bestDay: "토",
    mainStrategy: "초기 반응 확보 + 24h 성장 모니터링",
  },
  topCategories: [
    { name: "Lifestyle", duration: 185.7 },
    { name: "Education", duration: 175.1 },
    { name: "Entertainment", duration: 134.5 },
    { name: "Music", duration: 117.5 },
    { name: "News", duration: 100.7 },
  ],
  weekdayStrategy: [
    { day: "월", duration: 120 },
    { day: "화", duration: 132 },
    { day: "수", duration: 138 },
    { day: "목", duration: 142 },
    { day: "금", duration: 155 },
    { day: "토", duration: 168 },
    { day: "일", duration: 160 },
  ],
  signalScores: [
    { name: "초기 조회수", value: 82 },
    { name: "댓글 반응", value: 67 },
    { name: "24h 성장량", value: 76 },
    { name: "업로드 타이밍", value: 58 },
  ],
  strategyCards: [
    { title: "초기 반응 집중", tag: "T0 SIGNAL", desc: "트렌딩 진입 직후 조회수와 댓글 반응이 지속성 판단의 핵심 신호입니다.", action: "업로드 직후 1~3시간 내 커뮤니티 유입과 댓글 유도를 강화합니다." },
    { title: "24h 성장 모니터링", tag: "24H UPDATE", desc: "24시간 동안의 조회수 성장량은 예측을 업데이트하는 중요한 정보입니다.", action: "24시간 후 예측을 다시 실행해 광고 집행 여부를 재결정합니다." },
    { title: "카테고리별 전략", tag: "CATEGORY", desc: "카테고리마다 빠르게 확산되는 콘텐츠와 오래 유지되는 콘텐츠가 다릅니다.", action: "장기 노출형 카테고리에는 지속 광고를, 단기 확산형에는 초기 집중 광고를 적용합니다." },
    { title: "업로드 타이밍", tag: "TIMING", desc: "요일과 시간은 반복되는 패턴이므로 cycle feature와 함께 해석해야 합니다.", action: "성과가 높은 요일/시간대에 업로드 또는 프로모션을 집중합니다." },
  ],
  roadmap: [
    { step: "01", title: "T0 예측", desc: "초기 신호로 빠른 판단" },
    { step: "02", title: "24h 재예측", desc: "성장 정보 반영" },
    { step: "03", title: "전략 선택", desc: "광고/업로드 액션 결정" },
    { step: "04", title: "성과 검증", desc: "예측과 실제 지속성 비교" },
  ],
}

async function fetchStrategySummary() {
  const res = await fetch(`${API}/strategy/summary`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}


function asNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeStrategyData(json = {}) {
  const summary = json.summary || {}
  const categoryRows = Array.isArray(json.topCategories)
    ? json.topCategories
    : Array.isArray(json.category_growth)
      ? json.category_growth.map((d) => ({
          name: d.category || d.name || "Unknown",
          duration: Math.max(1, Math.round(asNumber(d.strategy_score, 0))),
          score: Math.max(1, Math.round(asNumber(d.strategy_score, 0))),
          growth: asNumber(d.avg_growth, 0),
        }))
      : Array.isArray(json.categoryStats)
        ? json.categoryStats.map((d) => ({
            name: d.category || d.name || "Unknown",
            duration: asNumber(d.medianDuration || d.median_duration_h || d.duration, 0),
            score: asNumber(d.strategyScore || d.strategy_score, 0),
          }))
        : []

  const topCategory = categoryRows[0]?.name || summary.topCategory || FALLBACK.summary.topCategory
  const strategyCards = Array.isArray(json.strategyCards) ? json.strategyCards : FALLBACK.strategyCards
  const weekdayStrategy = Array.isArray(json.weekdayStrategy) ? json.weekdayStrategy : FALLBACK.weekdayStrategy
  const signalScores = Array.isArray(json.signalScores)
    ? json.signalScores
    : Array.isArray(json.category_growth)
      ? [
          { name: "전략 점수", value: Math.round(asNumber(json.category_growth[0]?.strategy_score, 72)) },
          { name: "AI 점수", value: Math.round(asNumber(json.category_growth[0]?.avg_ai_score, 68)) },
          { name: "성장 신호", value: Math.min(100, Math.round(asNumber(json.category_growth[0]?.growth_rate, 0.35) * 100)) },
          { name: "모델 신뢰", value: Math.round(asNumber(summary.weighted_soft_voting_count, 0) > 0 ? 82 : 58) },
        ]
      : FALLBACK.signalScores

  return {
    ...FALLBACK,
    ...json,
    summary: {
      ...FALLBACK.summary,
      ...summary,
      totalRows: summary.totalRows ?? summary.total ?? json.kpis?.trendEvents ?? FALLBACK.summary.totalRows,
      topCategory,
      bestDay: summary.bestDay ?? FALLBACK.summary.bestDay,
      mainStrategy: summary.mainStrategy ?? json.headline ?? FALLBACK.summary.mainStrategy,
    },
    topCategories: categoryRows.length ? categoryRows : FALLBACK.topCategories,
    weekdayStrategy,
    signalScores,
    strategyCards,
    roadmap: Array.isArray(json.roadmap) ? json.roadmap : Array.isArray(json.execution_plan)
      ? json.execution_plan.map((desc, idx) => ({ step: String(idx + 1).padStart(2, "0"), title: idx === 0 ? "우선순위" : idx === 1 ? "후보 점검" : idx === 2 ? "추적" : "검증", desc }))
      : FALLBACK.roadmap,
  }
}

function formatShort(value) {
  const n = asNumber(value, 0)
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`
  return `${Math.round(n)}`
}



function StrategyCards({ cards }) {
  return (
    <div className="strategy-card-grid">
      {cards.map((card, idx) => (
        <motion.div key={card.title} className="strategy-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08, duration: 0.3 }} whileHover={{ y: -4 }}>
          <span className="strategy-pill">{card.tag}</span>
          <h3>{card.title}</h3>
          <p>{card.desc}</p>
          <div className="strategy-action">
            <span>Action</span>
            <strong>{card.action}</strong>
          </div>
        </motion.div>
      ))}
    </div>
  )
}


function CategoryChart({ data }) {
  const rows = (Array.isArray(data) && data.length ? data : FALLBACK.topCategories).slice(0, 6)
  const max = Math.max(...rows.map((d) => asNumber(d.duration || d.score, 0)), 1)
  return (
    <div className="strategy-svg-chart strategy-svg-chart--bar" aria-label="카테고리 전략 차트">
      <div className="strategy-chart-grid-lines">
        {[0, 25, 50, 75, 100].map((v) => <span key={v} style={{ bottom: `${v}%` }} />)}
      </div>
      <div className="strategy-bar-stage">
        {rows.map((d, i) => {
          const value = asNumber(d.duration || d.score, 0)
          const h = Math.max(10, (value / max) * 100)
          return (
            <div className="strategy-bar-col" key={`${d.name}-${i}`}>
              <div className="strategy-bar-value">{formatShort(value)}{value <= 100 ? "" : "h"}</div>
              <div className="strategy-bar-track">
                <motion.div
                  className="strategy-bar-fill"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.7, delay: i * 0.07, ease: "easeOut" }}
                />
              </div>
              <div className="strategy-bar-label">{d.name}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekdayChart({ data }) {
  const rows = Array.isArray(data) && data.length ? data : FALLBACK.weekdayStrategy
  const values = rows.map((d) => asNumber(d.duration, 0))
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const width = 760
  const height = 260
  const points = rows.map((d, i) => {
    const x = 42 + (i * (width - 84)) / Math.max(rows.length - 1, 1)
    const y = 30 + (1 - (asNumber(d.duration, 0) - min) / range) * (height - 70)
    return { ...d, x, y, value: asNumber(d.duration, 0) }
  })
  const line = points.map((p) => `${p.x},${p.y}`).join(" ")
  return (
    <div className="strategy-svg-chart strategy-svg-chart--line" aria-label="업로드 타이밍 차트">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 1, 2, 3].map((n) => <line key={n} x1="38" x2={width - 20} y1={36 + n * 54} y2={36 + n * 54} className="strategy-svg-grid" />)}
        <motion.polyline
          points={line}
          fill="none"
          className="strategy-svg-line"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        {points.map((p, i) => (
          <motion.g key={p.day} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25 + i * 0.06 }}>
            <circle cx={p.x} cy={p.y} r="7" className="strategy-svg-dot" />
            <text x={p.x} y={p.y - 14} textAnchor="middle" className="strategy-svg-value">{Math.round(p.value)}h</text>
            <text x={p.x} y={height - 12} textAnchor="middle" className="strategy-svg-label">{p.day}</text>
          </motion.g>
        ))}
      </svg>
    </div>
  )
}

function SignalChart({ data }) {
  const rows = Array.isArray(data) && data.length ? data : FALLBACK.signalScores
  return (
    <div className="strategy-signal-list" aria-label="핵심 신호 우선순위 차트">
      {rows.map((d, i) => {
        const value = Math.max(0, Math.min(100, asNumber(d.value, 0)))
        return (
          <div className="strategy-signal-row" key={`${d.name}-${i}`}>
            <div className="strategy-signal-top"><span>{d.name}</span><strong>{Math.round(value)}%</strong></div>
            <div className="strategy-signal-track">
              <motion.div
                className="strategy-signal-fill"
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.72, delay: i * 0.08, ease: "easeOut" }}
              />
              <span className="strategy-signal-guide" style={{ left: "70%" }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Roadmap({ data }) {
  return (
    <div className="strategy-roadmap">
      {data.map((item) => (
        <motion.div key={item.step} className="strategy-roadmap-item" whileHover={{ y: -3 }}>
          <span>{item.step}</span>
          <strong>{item.title}</strong>
          <p>{item.desc}</p>
        </motion.div>
      ))}
    </div>
  )
}

function FinalSummary({ data }) {
  return (
    <div className="strategy-final">
      <span className="strategy-pill">FINAL</span>
      <h3>최종 전략 결론</h3>
      <p>
        이 프로젝트의 결론은 단순히 “조회수가 높은 영상이 좋다”가 아니라,
        <strong> 초기 반응, 24시간 성장, 카테고리 특성, 업로드 타이밍을 함께 고려해야 한다</strong>는 것입니다.
      </p>
      <div className="strategy-final-grid">
        <div><span>Top Category</span><strong>{data.summary?.topCategory}</strong></div>
        <div><span>Best Day</span><strong>{data.summary?.bestDay}</strong></div>
        <div><span>Main Strategy</span><strong>{data.summary?.mainStrategy}</strong></div>
      </div>
    </div>
  )
}

export default function StrategyPage({ onBack }) {
  const [active, setActive] = useState(0)
  const [data, setData] = useState(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchStrategySummary()
      .then((json) => {
        if (!cancelled) {
          setData(normalizeStrategyData(json))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  const sections = useMemo(() => [
    {
      id: "strategy",
      tag: "STRATEGY",
      title: "핵심 전략 카드",
      shortTitle: "전략",
      Chart: () => <StrategyCards cards={data.strategyCards || FALLBACK.strategyCards} />,
      findings: [
        "Part9는 분석 결과를 실제 행동 전략으로 연결하는 마무리 파트입니다.",
        "초기 반응, 24h 성장, 카테고리, 타이밍을 각각 전략 요소로 분리합니다.",
        "모델 결과가 단순 점수가 아니라 의사결정으로 이어지게 만듭니다.",
      ],
      note: "분석 결과 → 전략 액션",
    },
    {
      id: "category",
      tag: "CATEGORY",
      title: "카테고리 전략",
      shortTitle: "카테고리",
      Chart: () => <CategoryChart data={data.topCategories || FALLBACK.topCategories} />,
      findings: [
        "평균 지속시간이 높은 카테고리는 장기 노출 전략에 적합합니다.",
        "짧은 카테고리는 초반 확산형 캠페인에 더 적합할 수 있습니다.",
        "카테고리별 지속성 차이는 광고 집행 우선순위를 정하는 기준이 됩니다.",
      ],
      note: "장기형 vs 확산형 카테고리 구분",
    },
    {
      id: "weekday",
      tag: "TIMING",
      title: "업로드 타이밍 전략",
      shortTitle: "타이밍",
      Chart: () => <WeekdayChart data={data.weekdayStrategy || FALLBACK.weekdayStrategy} />,
      findings: [
        "요일별 평균 지속시간을 비교해 업로드 타이밍 전략을 세울 수 있습니다.",
        "요일은 순환형 변수이므로 Part2의 cycle feature와 연결됩니다.",
        "성과가 높은 요일에는 업로드 또는 프로모션을 집중할 수 있습니다.",
      ],
      note: "요일/시간 패턴 기반 업로드 전략",
    },
    {
      id: "signals",
      tag: "SIGNAL",
      title: "핵심 신호 우선순위",
      shortTitle: "신호",
      Chart: () => <SignalChart data={data.signalScores || FALLBACK.signalScores} />,
      findings: [
        "초기 조회수와 댓글 반응은 T0 예측에서 중요한 신호입니다.",
        "24시간 성장량은 예측 업데이트의 핵심 정보입니다.",
        "타이밍과 카테고리는 전략 보정 변수로 활용할 수 있습니다.",
      ],
      note: "T0 signal + 24h update",
    },
    {
      id: "roadmap",
      tag: "ROADMAP",
      title: "실행 로드맵",
      shortTitle: "로드맵",
      Chart: () => <Roadmap data={data.roadmap || FALLBACK.roadmap} />,
      findings: [
        "서비스 사용자는 T0 예측으로 빠르게 판단할 수 있습니다.",
        "24시간 후 성장 정보를 반영해 전략을 재조정합니다.",
        "예측과 실제 결과를 비교하면서 시스템을 개선할 수 있습니다.",
      ],
      note: "예측 시스템 운영 흐름",
    },
    {
      id: "final",
      tag: "FINAL",
      title: "최종 결론",
      shortTitle: "결론",
      Chart: () => <FinalSummary data={data} />,
      findings: [
        "이 프로젝트는 EDA에서 끝나는 것이 아니라 실제 예측 시스템과 전략으로 연결됩니다.",
        "모델 결과는 Part8에서 사용자 입력 기반 예측으로 활용됩니다.",
        "Part9는 팀 프로젝트 전체의 결론과 실무 활용성을 보여주는 파트입니다.",
      ],
      note: "EDA → Feature → Model → Predict → Strategy",
    },
  ], [data])

  const sec = sections[active]
  const total = sections.length

  return (
    <div className="yta-app-inner strategy-page">
      <motion.button className="back-btn" onClick={onBack} whileHover={{ x: -3 }} transition={{ duration: 0.2 }}>
        ← 목록으로
      </motion.button>

      <motion.div className="part-page-header strategy-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
        <motion.div className="strategy-hero-top" variants={fadeUp}>
          <span className="part-page-num">Part 9</span>
          <span className="strategy-hero-badge">Insight & Strategy</span>
        </motion.div>

        <motion.h1 className="part-page-title" variants={fadeUp}>인사이트 & 전략</motion.h1>
        <motion.p className="part-page-subtitle" variants={fadeUp}>
          분석과 예측 결과를 실제 업로드·광고·콘텐츠 전략으로 연결하는 최종 결론 파트입니다.
        </motion.p>

        <motion.div variants={fadeUp}>
          {loading && <div className="api-status api-status--loading"><span className="api-status-dot" /><span>API 연결 중…</span></div>}
          {!loading && !error && <div className="api-status api-status--ok"><span className="api-status-dot" /><span>API 연결 성공 · {API}</span></div>}
          {!loading && error && <div className="api-status api-status--fail"><span className="api-status-dot" /><span>API 연결 실패 · 로컬 데이터 사용 중</span></div>}
        </motion.div>

        <motion.div className="eda-summary-row" variants={fadeUpStagger}>
          {[
            ["총 데이터", data.summary?.totalRows?.toLocaleString() ?? "34,964"],
            ["상위 카테고리", data.summary?.topCategory ?? "Lifestyle"],
            ["추천 요일", data.summary?.bestDay ?? "토"],
            ["핵심 전략", data.summary?.mainStrategy ?? "초기 반응 확보"],
          ].map(([label, value]) => (
            <motion.div key={label} className="eda-summary-item" variants={fadeUp}>
              <span className="eda-summary-label">{label}</span>
              <span className="eda-summary-val">{value}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="eda-tabs strategy-tabs">
          {sections.map((s, i) => (
            <motion.button key={s.id} className={`eda-tab ${active === i ? "on" : ""}`} onClick={() => setActive(i)} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <span className="eda-tab-tag">{s.tag}</span>
              <span className="eda-tab-title">{s.shortTitle}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={sec.id} className="eda-body strategy-body" variants={slideTab} initial="hidden" animate="show" exit="exit">
            <div className="eda-chart-panel">
              <p className="eda-chart-title">{sec.title}</p>
              <div className="eda-chart-wrap strategy-chart-wrap">
                {loading ? <div className="strategy-empty-chart">Loading...</div> : <sec.Chart />}
              </div>
            </div>

            <div className="eda-desc-panel">
              <div className="eda-tag-row">
                <span className="eda-big-tag">{sec.tag}</span>
                <span className="eda-progress">{active + 1} / {total}</span>
              </div>

              <h3 className="eda-desc-title">{sec.title}</h3>
              <p className="eda-findings-label">전략 해석</p>

              <ul className="eda-findings">
                {sec.findings.map((finding, i) => (
                  <motion.li key={finding} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.22 }}>
                    <span className="eda-finding-num">{i + 1}</span>{finding}
                  </motion.li>
                ))}
              </ul>

              <div className="eda-note-box">
                <span className="eda-note-label">STRATEGY</span>
                <span className="eda-note-text">{sec.note}</span>
              </div>

              <div className="eda-nav-btns">
                <motion.button className="eda-nav-btn" disabled={active === 0} onClick={() => setActive((a) => a - 1)} whileHover={active > 0 ? { x: -2 } : {}}>← 이전</motion.button>
                <motion.button className="eda-nav-btn" disabled={active === total - 1} onClick={() => setActive((a) => a + 1)} whileHover={active < total - 1 ? { x: 2 } : {}}>다음 →</motion.button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
