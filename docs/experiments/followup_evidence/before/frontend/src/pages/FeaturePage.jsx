import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { fadeUp, fadeUpStagger, slideTab } from "../animations/variants"
import "../styles/FeaturePage.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"







const FALLBACK_FEATURE_DATA = {
  summary: {
    totalRows: 34964,
    featureCount: 16,
    missingRate: 0.0,
    leakagePolicy: "T0 / 24h 분리"
  },
  labelDistribution: [
    { label: "단기 지속", ratio: 62 },
    { label: "장기 지속", ratio: 38 }
  ],
  logCompare: [
    { bucket: "Low", raw_view: 5000, log_view: 8.5 },
    { bucket: "Mid", raw_view: 500000, log_view: 13.1 },
    { bucket: "High", raw_view: 20000000, log_view: 16.8 }
  ],
  velocityCompare: [
    { stage: "느린 진입", velocity: 4200 },
    { stage: "보통 진입", velocity: 28500 },
    { stage: "빠른 진입", velocity: 132000 }
  ],
  collinearityCompare: [
    { option: "view + comment + ratio", risk: 92 },
    { option: "view + comment", risk: 48 },
    { option: "view + ratio", risk: 35 }
  ],
  featureCards: [
    {
      title: "로그 변환",
      tag: "LOG1P",
      desc: "조회수, 댓글 수, 순위, 24h 성장량처럼 편차가 큰 변수는 log1p로 변환합니다.",
      code: "np.log1p(value)"
    },
    {
      title: "파생 변수",
      tag: "DERIVED",
      desc: "engagement_ratio, latency, pretrend_velocity로 초기 반응성을 반영합니다.",
      code: "comment / (view + 1)"
    },
    {
      title: "시간 사이클 변환",
      tag: "CYCLE",
      desc: "hour뿐 아니라 weekday도 sin/cos로 변환해 순환 구조를 반영합니다.",
      code: "sin(2π * weekday / 7)"
    },
    {
      title: "Feature 선택 전략",
      tag: "COLLINEARITY",
      desc: "view, comment, ratio를 동시에 넣지 않고 조합을 선택해 다중공선성을 줄입니다.",
      code: "view_log + ratio_log"
    },
    {
      title: "T0 / 24h 분리",
      tag: "LEAKAGE",
      desc: "예측 시점별로 사용할 수 있는 Feature를 분리하여 데이터 누수를 방지합니다.",
      code: "T0 + view_growth_24h_log"
    }
  ],
  featureSets: {
    t0_regression: [
      "T0_view_log",
      "T0_engagement_ratio_log",
      "latency_to_trend_log",
      "pretrend_view_velocity_log",
      "hour_sin",
      "hour_cos",
      "weekday_sin",
      "weekday_cos",
      "category_group"
    ],
    h24_regression: [
      "T0_REGRESSION_FEATURES",
      "view_growth_24h_log"
    ],
    classification: [
      "tdi_label 기준",
      "tdi_label_04 해석",
      "장기 지속 여부 분류"
    ]
  }
}

const FEATURE_CODE = `import numpy as np

# 1. Label 기준 변경
# 기존: tdi_label_05
# 변경: tdi_label 기준 사용
events["tdi_label_04"] = events["tdi_label"]

# 2. 로그 변환
events["T0_view_log"] = np.log1p(events["T0_view"])
events["T0_comment_log"] = np.log1p(events["T0_comment"])
events["view_growth_24h_log"] = np.log1p(events["view_growth_24h"])

# 3. Engagement Ratio
events["T0_engagement_ratio"] = events["T0_comment"] / (events["T0_view"] + 1)
events["T0_engagement_ratio_log"] = np.log1p(events["T0_engagement_ratio"])

# 4. 시간 Cycle 변환
events["hour_sin"] = np.sin(2 * np.pi * events["published_hour"] / 24)
events["hour_cos"] = np.cos(2 * np.pi * events["published_hour"] / 24)

events["weekday_sin"] = np.sin(2 * np.pi * events["published_weekday"] / 7)
events["weekday_cos"] = np.cos(2 * np.pi * events["published_weekday"] / 7)

# 5. Feature 선택 전략
# view + comment + ratio 동시 사용은 다중공선성 위험이 있음
T0_FEATURES_A = [
    "T0_view_log",
    "T0_engagement_ratio_log",
    "hour_sin",
    "hour_cos",
    "weekday_sin",
    "weekday_cos",
    "category_group"
]

T0_FEATURES_B = [
    "T0_view_log",
    "T0_comment_log",
    "hour_sin",
    "hour_cos",
    "weekday_sin",
    "weekday_cos",
    "category_group"
]

# 6. 24h 모델은 T0 Feature + 24h 성장량
FEATURES_24H = T0_FEATURES_A + ["view_growth_24h_log"]`

async function fetchFeatureSummary() {
  const res = await fetch(`${API}/feature/summary`)
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







function LabelDistributionChart({ data }) {
  const rows = data?.length ? data : FALLBACK_FEATURE_DATA.labelDistribution
  const max = Math.max(...rows.map(d => Number(d.ratio) || 0), 1)
  const W = 720, H = 310, L = 64, R = 40, T = 36, B = 58
  const gap = (W - L - R) / rows.length
  const bw = gap * 0.42
  const y = (v) => H - B - ((Number(v) || 0) / max) * (H - T - B)
  return (
    <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Label 분포">
      {[0,25,50,75,100].map(v => <g key={v}><line x1={L} x2={W-R} y1={H-B-(v/100)*(H-T-B)} y2={H-B-(v/100)*(H-T-B)} className="svg-grid"/><text x={L-12} y={H-B-(v/100)*(H-T-B)+4} textAnchor="end" className="svg-tick">{v}</text></g>)}
      {rows.map((d,i)=>{const x=L+i*gap+(gap-bw)/2, h=H-B-y(d.ratio);return <g key={d.label}><rect x={x} y={T} width={bw} height={H-T-B} rx="14" className="svg-bar-bg"/><rect x={x} y={y(d.ratio)} width={bw} height={h} rx="14" className="svg-bar" style={{animationDelay:`${i*110}ms`}}/><text x={x+bw/2} y={H-24} textAnchor="middle" className="svg-label">{d.label}</text><text x={x+bw/2} y={y(d.ratio)-12} textAnchor="middle" className="svg-value">{d.ratio}%</text></g>})}
    </svg>
  )
}

function LogTransformChart({ data }) {
  const rows = data?.length ? data : FALLBACK_FEATURE_DATA.logCompare
  const W = 720, H = 310, L = 70, R = 34, T = 34, B = 62
  const maxRaw = Math.max(...rows.map(d => Math.log1p(Number(d.raw_view)||0)), 1)
  const maxLog = Math.max(...rows.map(d => Number(d.log_view)||0), 1)
  const gap = (W-L-R)/rows.length, bw=gap*0.24
  const yRaw = v => H-B-(Math.log1p(Number(v)||0)/maxRaw)*(H-T-B)
  const yLog = v => H-B-((Number(v)||0)/maxLog)*(H-T-B)
  return <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="로그 변환 비교">
    {[0,25,50,75,100].map(p=><g key={p}><line x1={L} x2={W-R} y1={H-B-(p/100)*(H-T-B)} y2={H-B-(p/100)*(H-T-B)} className="svg-grid"/><text x={L-12} y={H-B-(p/100)*(H-T-B)+4} textAnchor="end" className="svg-tick">{p}%</text></g>)}
    {rows.map((d,i)=>{
      const cx=L+i*gap+gap/2, hr=H-B-yRaw(d.raw_view), hl=H-B-yLog(d.log_view)
      return <g key={d.bucket}>
        {/* 원본 막대 — 회색 */}
        <rect x={cx-bw-4} y={yRaw(d.raw_view)} width={bw} height={hr} rx="10"
          fill="var(--text3)" opacity=".7"
          style={{animationDelay:`${i*90}ms`}}/>
        {/* log1p 막대 — 빨강 */}
        <rect x={cx+4} y={yLog(d.log_view)} width={bw} height={hl} rx="10"
          fill="var(--red)" opacity=".88"
          className="svg-bar" style={{animationDelay:`${i*90+80}ms`}}/>
        <text x={cx} y={H-28} textAnchor="middle" className="svg-label">{d.bucket}</text>
        {/* 원본 값 — 회색 */}
        <text x={cx-bw/2-4} y={yRaw(d.raw_view)-9} textAnchor="middle"
          fontSize="11" fill="var(--text3)" fontWeight="700">{formatNum(d.raw_view)}</text>
        {/* log1p 값 — 빨강 */}
        <text x={cx+bw/2+4} y={yLog(d.log_view)-9} textAnchor="middle"
          className="svg-value">{d.log_view}</text>
      </g>
    })}
    {/* 범례 */}
    <rect x={L} y={14} width={12} height={12} fill="var(--text3)" opacity=".7" rx="3"/>
    <text x={L+16} y={24} fontSize="11" fill="var(--text3)" fontWeight="700">원본 규모</text>
    <rect x={L+90} y={14} width={12} height={12} fill="var(--red)" opacity=".88" rx="3"/>
    <text x={L+106} y={24} fontSize="11" fill="var(--red)" fontWeight="700">log1p 변환</text>
  </svg>
}

function VelocityChart({ data }) {
  const rows = data?.length ? data : FALLBACK_FEATURE_DATA.velocityCompare
  const W=720,H=310,L=70,R=38,T=38,B=58
  const max=Math.max(...rows.map(d=>Number(d.velocity)||0),1)
  const x=i=>L+(i/Math.max(rows.length-1,1))*(W-L-R)
  const y=v=>H-B-((Number(v)||0)/max)*(H-T-B)
  const pts=rows.map((d,i)=>`${x(i)},${y(d.velocity)}`).join(' ')
  const area=`${L},${H-B} ${pts} ${W-R},${H-B}`
  return <svg className="svg-chart svg-chart--line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="초기 조회 속도">
    <defs><linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--red)" stopOpacity=".24"/><stop offset="100%" stopColor="var(--red)" stopOpacity=".02"/></linearGradient></defs>
    {[0,.25,.5,.75,1].map(p=><g key={p}><line x1={L} x2={W-R} y1={H-B-p*(H-T-B)} y2={H-B-p*(H-T-B)} className="svg-grid"/><text x={L-12} y={H-B-p*(H-T-B)+4} textAnchor="end" className="svg-tick">{formatNum(max*p)}</text></g>)}
    <polygon points={area} fill="url(#velocityFill)" className="svg-area"/><polyline points={pts} className="svg-line"/>
    {rows.map((d,i)=><g key={d.stage} className="svg-point-group"><circle cx={x(i)} cy={y(d.velocity)} r="6" className="svg-point"/><text x={x(i)} y={H-22} textAnchor="middle" className="svg-label">{d.stage}</text><text x={x(i)} y={y(d.velocity)-12} textAnchor="middle" className="svg-value">{formatNum(d.velocity)}</text></g>)}
  </svg>
}

function AppleWaveCycleChart() {
  const waveData = [
    { day: "월", value: 0.00 }, { day: "화", value: 0.78 }, { day: "수", value: 0.97 },
    { day: "목", value: 0.43 }, { day: "금", value: -0.43 }, { day: "토", value: -0.97 }, { day: "일", value: -0.78 },
  ]
  const W=720,H=260,L=46,R=34,T=26,B=42
  const x=i=>L+(i/(waveData.length-1))*(W-L-R)
  const y=v=>T+((1-Number(v))/2)*(H-T-B)
  const base=y(0)
  const pts=waveData.map((d,i)=>`${x(i)},${y(d.value)}`).join(' ')
  const area=`${L},${base} ${pts} ${W-R},${base}`
  return <div className="feature-wave-card"><div className="feature-wave-glow"/><div className="feature-wave-head"><span className="feature-wave-kicker">Cycle Encoding</span><strong>weekday_sin wave</strong><p>월요일과 일요일이 가까운 순환형 패턴을 파형으로 표현합니다.</p></div><svg className="svg-chart svg-chart--line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="weekday wave"><line x1={L} x2={W-R} y1={base} y2={base} className="svg-grid"/><polygon points={area} className="svg-soft-fill"/><polyline points={pts} className="svg-wave-line"/>{waveData.map((d,i)=><g key={d.day} className="svg-point-group"><circle cx={x(i)} cy={y(d.value)} r="6" className="svg-point"/><text x={x(i)} y={H-14} textAnchor="middle" className="svg-label">{d.day}</text></g>)}</svg><div className="feature-wave-metrics"><div><span>hour cycle</span><strong>24 기준</strong></div><div><span>weekday cycle</span><strong>7 기준</strong></div><div><span>range</span><strong>-1 ~ 1</strong></div></div></div>
}

function CollinearityChart({ data }) {
  const rows = data?.length ? data : FALLBACK_FEATURE_DATA.collinearityCompare
  const W=720,H=310,L=190,R=56,T=40,rowH=56,barW=W-L-R
  return <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="공선성 위험도">
    {[0,25,50,75,100].map(v=><g key={v}><line x1={L+(v/100)*barW} x2={L+(v/100)*barW} y1={T-16} y2={T+rows.length*rowH} className="svg-grid"/><text x={L+(v/100)*barW} y={T+rows.length*rowH+22} textAnchor="middle" className="svg-tick">{v}%</text></g>)}
    {rows.map((d,i)=><g key={d.option}><text x={L-14} y={T+i*rowH+22} textAnchor="end" className="svg-label svg-label-strong">{d.option}</text><rect x={L} y={T+i*rowH+6} width={barW} height="24" rx="12" className="svg-track"/><rect x={L} y={T+i*rowH+6} width={(Number(d.risk)||0)/100*barW} height="24" rx="12" className="svg-bar-horizontal" style={{animationDelay:`${i*90}ms`}}/><text x={L+(Number(d.risk)||0)/100*barW+10} y={T+i*rowH+24} className="svg-value">{d.risk}%</text></g>)}
  </svg>
}

function FeatureSetBox({ title, items }) {
  return (
    <div className="feature-mini-set">
      <h4>{title}</h4>
      <div className="feature-chip-wrap">
        {items.map((item) => <span key={item} className="feature-chip">{item}</span>)}
      </div>
    </div>
  )
}

function FeatureSetVisual({ sets }) {
  return (
    <div className="feature-set-visual feature-set-visual-3">
      <FeatureSetBox title="T0 회귀 Feature" items={sets.t0_regression || FALLBACK_FEATURE_DATA.featureSets.t0_regression} />
      <FeatureSetBox title="24h 회귀 Feature" items={sets.h24_regression || FALLBACK_FEATURE_DATA.featureSets.h24_regression} />
      <FeatureSetBox title="분류 Target" items={sets.classification || FALLBACK_FEATURE_DATA.featureSets.classification} />
    </div>
  )
}

function CodeModal({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="feature-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="feature-modal"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="feature-modal-head">
              <div>
                <span className="feature-section-tag">Python Logic</span>
                <h2>Feature Engineering 코드 예시</h2>
                <p>T0/24h 분리, weekday cycle 변환, 공선성 고려를 반영한 코드입니다.</p>
              </div>
              <motion.button className="feature-modal-close" onClick={onClose} whileHover={{ rotate: 90, scale: 1.05 }} whileTap={{ scale: 0.95 }}>×</motion.button>
            </div>
            <pre className="feature-modal-code">{FEATURE_CODE}</pre>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function FeaturePage({ onBack }) {
  const [data, setData] = useState(FALLBACK_FEATURE_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [active, setActive] = useState(0)
  const [codeOpen, setCodeOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchFeatureSummary()
      .then((json) => {
        if (!cancelled) {
          setData({ ...FALLBACK_FEATURE_DATA, ...json })
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
      id: "label",
      tag: "LABEL",
      title: "지속 시간 Label 기준 정리",
      shortTitle: "Label",
      Chart: () => <LabelDistributionChart data={data.labelDistribution || FALLBACK_FEATURE_DATA.labelDistribution} />,
      findings: [
        "지속 시간 label 분포 비교는 tdi_label_05가 아니라 tdi_label 기준으로 진행합니다.",
        "분류 문제에서는 장기 지속 여부를 tdi_label_04 기준으로 해석합니다.",
        "전처리와 모델링에서 target 기준을 통일하면 결과 해석이 흔들리지 않습니다."
      ],
      note: "Label 기준: tdi_label 사용 → tdi_label_04로 해석"
    },
    {
      id: "log",
      tag: "LOG1P",
      title: "로그 변환",
      shortTitle: "로그 변환",
      Chart: () => <LogTransformChart data={data.logCompare || FALLBACK_FEATURE_DATA.logCompare} />,
      findings: [
        "조회수, 댓글 수, 24h 성장량은 일부 영상에 값이 몰리는 long-tail 분포를 가집니다.",
        "log1p 변환을 적용하면 큰 값의 영향이 완화되어 모델 학습이 안정됩니다.",
        "T0_view_log, T0_comment_log, view_growth_24h_log를 생성합니다."
      ],
      note: "T0_view_log / T0_comment_log / view_growth_24h_log"
    },
    {
      id: "derived",
      tag: "DERIVED",
      title: "파생 변수 생성",
      shortTitle: "파생 변수",
      Chart: () => <VelocityChart data={data.velocityCompare || FALLBACK_FEATURE_DATA.velocityCompare} />,
      findings: [
        "단순 조회수보다 댓글 비율과 초기 조회 속도가 영상의 초기 반응성을 더 잘 설명합니다.",
        "engagement_ratio는 comment / view이므로 view, comment와 함께 사용할 때 공선성에 주의해야 합니다.",
        "pretrend_view_velocity는 트렌딩 진입 전 확산력을 나타내는 핵심 Feature입니다."
      ],
      note: "engagement_ratio_log / latency_to_trend_log / pretrend_view_velocity_log"
    },
    {
      id: "cycle",
      tag: "CYCLE",
      title: "시간 · 요일 Cycle 변환",
      shortTitle: "Cycle 변환",
      Chart: () => <AppleWaveCycleChart />,
      findings: [
        "시간뿐 아니라 요일도 월요일과 일요일이 가까운 순환형 변수입니다.",
        "published_hour는 24 기준 sin/cos, published_weekday는 7 기준 sin/cos로 변환합니다.",
        "파형 시각화는 요일이 선형 숫자가 아니라 반복되는 패턴임을 직관적으로 보여줍니다."
      ],
      note: "hour_sin, hour_cos, weekday_sin, weekday_cos"
    },
    {
      id: "collinearity",
      tag: "COLLINEARITY",
      title: "Feature 선택 전략",
      shortTitle: "공선성",
      Chart: () => <CollinearityChart data={data.collinearityCompare || FALLBACK_FEATURE_DATA.collinearityCompare} />,
      findings: [
        "engagement_ratio = comment / view 이므로 view, comment, ratio를 동시에 넣으면 다중공선성 위험이 커집니다.",
        "추천 조합 1: T0_view_log + T0_engagement_ratio_log",
        "추천 조합 2: T0_view_log + T0_comment_log"
      ],
      note: "view + comment + ratio 동시 사용 지양"
    },
    {
      id: "sets",
      tag: "T0 / 24H",
      title: "T0 / 24h Feature Set 분리",
      shortTitle: "Feature Set",
      Chart: () => <FeatureSetVisual sets={data.featureSets || FALLBACK_FEATURE_DATA.featureSets} />,
      findings: [
        "T0 모델은 트렌딩 진입 시점의 초기 신호만으로 지속 시간을 예측합니다.",
        "24h 모델은 T0 정보에 view_growth_24h_log를 추가해 예측력 개선 여부를 확인합니다.",
        "이 구조는 예측 시점 이후 정보를 학습에 사용하는 데이터 누수를 방지합니다."
      ],
      note: "T0: 초기 신호 / 24h: 초기 신호 + 24시간 성장 정보"
    }
  ], [data])

  const sec = sections[active]
  const total = sections.length

  return (
    <div className="yta-app-inner feature-page">
      <motion.button className="back-btn" onClick={onBack} whileHover={{ x: -3 }} transition={{ duration: 0.2 }}>
        ← 목록으로
      </motion.button>

      <motion.div className="part-page-header feature-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
        <motion.div className="feature-header-top" variants={fadeUp}>
          <span className="part-page-num">Part 2</span>
          <motion.button className="feature-code-btn" onClick={() => setCodeOpen(true)} whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            &lt;/&gt; Feature Engineering 코드
          </motion.button>
        </motion.div>

        <motion.h1 className="part-page-title" variants={fadeUp}>Feature Engineering</motion.h1>
        <motion.p className="part-page-subtitle" variants={fadeUp}>
          T0와 24h 예측 시점을 분리하고, 시간·요일 cycle 변환과 공선성 고려를 반영해 Feature를 설계합니다.
        </motion.p>

        <motion.div variants={fadeUp}>
          {loading && <div className="api-status api-status--loading"><span className="api-status-dot" /><span>API 연결 중…</span></div>}
          {!loading && !error && <div className="api-status api-status--ok"><span className="api-status-dot" /><span>API 연결 성공 · {API}</span></div>}
          {!loading && error && <div className="api-status api-status--fail"><span className="api-status-dot" /><span>API 연결 실패 · 로컬 데이터 사용 중</span></div>}
        </motion.div>

        <motion.div className="eda-summary-row" variants={fadeUpStagger}>
          {[
            ["총 데이터", data.summary?.totalRows?.toLocaleString() ?? "34,964"],
            ["생성 Feature", `${data.summary?.featureCount ?? 16}개`],
            ["Target 기준", "tdi_label_04"],
            ["누수 방지", data.summary?.leakagePolicy ?? "T0 / 24h 분리"]
          ].map(([label, value]) => (
            <motion.div key={label} className="eda-summary-item" variants={fadeUp}>
              <span className="eda-summary-label">{label}</span>
              <span className="eda-summary-val">{value}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div className="feature-flow feature-flow-five" variants={fadeUpStagger} initial="hidden" animate="show">
        {data.featureCards.map((card, idx) => (
          <motion.button key={card.title} className={`feature-flow-card ${active === idx + 1 ? "on" : ""}`} variants={fadeUp} onClick={() => setActive(idx + 1)} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <span className="feature-flow-step">0{idx + 1}</span>
            <span className="feature-flow-tag">{card.tag}</span>
            <strong>{card.title}</strong>
            <small>{card.code}</small>
          </motion.button>
        ))}
      </motion.div>

      <div className="eda-tabs feature-tabs">
        {sections.map((s, i) => (
          <motion.button key={s.id} className={`eda-tab ${active === i ? "on" : ""}`} onClick={() => setActive(i)} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
            <span className="eda-tab-tag">{s.tag}</span>
            <span className="eda-tab-title">{s.shortTitle}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={sec.id} className="eda-body feature-body" variants={slideTab} initial="hidden" animate="show" exit="exit">
          <div className="eda-chart-panel">
            <p className="eda-chart-title">{sec.title}</p>
            <div className="eda-chart-wrap feature-chart-wrap"><sec.Chart /></div>
          </div>

          <div className="eda-desc-panel">
            <div className="eda-tag-row">
              <span className="eda-big-tag">{sec.tag}</span>
              <span className="eda-progress">{active + 1} / {total}</span>
            </div>

            <h3 className="eda-desc-title">{sec.title}</h3>
            <p className="eda-findings-label">왜 필요한가?</p>

            <ul className="eda-findings">
              {sec.findings.map((finding, i) => (
                <motion.li key={finding} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.3 }}>
                  <span className="eda-finding-num">{i + 1}</span>{finding}
                </motion.li>
              ))}
            </ul>

            <div className="eda-note-box">
              <span className="eda-note-label">NOTE</span>
              <span className="eda-note-text">{sec.note}</span>
            </div>

            <div className="eda-nav-btns">
              <motion.button className="eda-nav-btn" disabled={active === 0} onClick={() => setActive((a) => a - 1)} whileHover={active > 0 ? { x: -2 } : {}} whileTap={active > 0 ? { scale: 0.97 } : {}}>← 이전</motion.button>
              <motion.button className="eda-nav-btn" disabled={active === total - 1} onClick={() => setActive((a) => a + 1)} whileHover={active < total - 1 ? { x: 2 } : {}} whileTap={active < total - 1 ? { scale: 0.97 } : {}}>다음 →</motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <CodeModal open={codeOpen} onClose={() => setCodeOpen(false)} />
    </div>
  )
}