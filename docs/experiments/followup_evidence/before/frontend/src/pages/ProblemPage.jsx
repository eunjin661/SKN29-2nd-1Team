import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { fadeUp, fadeUpStagger, slideTab } from "../animations/variants"
import "../styles/ProblemPage.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"



const FALLBACK = {
  summary: {
    totalRows: 34964,
    categoryCount: 5,
    avgDuration: 144.1,
    obs24Rate: 68.2,
    mainQuestion: "어떤 영상이 오래 트렌딩에 남는가?",
  },
  regressionTarget: [
    { name: "Q1", value: 48 },
    { name: "Median", value: 108 },
    { name: "Q3", value: 216 },
    { name: "P90", value: 360 },
  ],
  classificationTarget: [
    { name: "단기 지속", value: 62 },
    { name: "장기 지속", value: 38 },
  ],
  whyCards: [
    { title: "장기 노출 가치", desc: "단기 조회수보다 오래 트렌딩에 남는 영상이 광고·콘텐츠 전략에서 더 큰 가치를 가질 수 있습니다." },
    { title: "초기 판단 필요", desc: "트렌딩 진입 직후의 초기 신호만으로 지속성을 예측하면 빠른 의사결정이 가능합니다." },
    { title: "전략 연결", desc: "예측 결과를 카테고리, 업로드 타이밍, 광고 집행 전략으로 연결할 수 있습니다." },
  ],
  taskCards: [
    { title: "회귀 문제", tag: "REGRESSION", question: "트렌딩 지속 시간을 어느 정도 예측할 수 있는가?", target: "trending_duration_h", output: "예상 지속 시간(h)", metric: "MAE / RMSE" },
    { title: "분류 문제", tag: "CLASSIFICATION", question: "장기 지속 여부를 분류할 수 있는가?", target: "tdi_label_04", output: "장기 지속 확률", metric: "F1-score / AUC" },
  ],
  strategyCards: [
    { title: "T0 Model", tag: "초기 예측", desc: "트렌딩 진입 시점에 이미 알 수 있는 조회수, 댓글 수, 카테고리, 시간 정보를 사용합니다.", use: "업로드 직후 빠른 판단" },
    { title: "24h Model", tag: "업데이트 예측", desc: "진입 후 24시간 동안의 성장 정보를 추가해 예측력이 개선되는지 확인합니다.", use: "24시간 후 전략 재조정" },
  ],
  usageFlow: [
    { step: "01", title: "업로드/진입", desc: "영상이 트렌딩에 진입" },
    { step: "02", title: "T0 예측", desc: "초기 신호로 지속성 예측" },
    { step: "03", title: "24h 업데이트", desc: "성장량 반영 후 재예측" },
    { step: "04", title: "전략 결정", desc: "광고·콘텐츠 전략 수립" },
  ],
  evaluationGoals: [
    { name: "회귀", goal: "예상 지속 시간 오차 최소화", metric: "MAE / RMSE" },
    { name: "분류", goal: "장기 지속 영상 탐지", metric: "F1-score / AUC" },
    { name: "비교", goal: "24h 정보 추가 효과 검증", metric: "T0 vs 24h 성능 차이" },
  ],
}

async function fetchProblemSummary() {
  const res = await fetch(`${API}/problem/summary`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}



function WhyCards({ cards }) {
  return (
    <div className="problem-why-grid">
      {cards.map((card, idx) => (
        <motion.div
          key={card.title}
          className="problem-why-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.08, duration: 0.35 }}
          whileHover={{ y: -4 }}
        >
          <span>WHY 0{idx + 1}</span>
          <strong>{card.title}</strong>
          <p>{card.desc}</p>
        </motion.div>
      ))}
    </div>
  )
}

function TaskCards({ cards }) {
  return (
    <div className="problem-task-grid">
      {cards.map((card, idx) => (
        <motion.div
          key={card.title}
          className="problem-task-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.08, duration: 0.35 }}
          whileHover={{ y: -4 }}
        >
          <span className="problem-pill">{card.tag}</span>
          <h3>{card.title}</h3>
          <p>{card.question}</p>
          <div className="problem-task-meta">
            <div><span>Target</span><strong>{card.target}</strong></div>
            <div><span>Output</span><strong>{card.output}</strong></div>
            <div><span>Metric</span><strong>{card.metric}</strong></div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function StrategyCompare({ cards }) {
  return (
    <div className="problem-strategy-grid">
      {cards.map((card, idx) => (
        <motion.div
          key={card.title}
          className={`problem-strategy-card ${idx === 1 ? "is-24h" : ""}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.08, duration: 0.35 }}
          whileHover={{ y: -4 }}
        >
          <span className="problem-pill">{card.tag}</span>
          <h3>{card.title}</h3>
          <p>{card.desc}</p>
          <div className="problem-use-box">
            <span>Use Case</span>
            <strong>{card.use}</strong>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function TargetChart({ data, type }) {
  const rows = data?.length ? data : (type === "classification" ? FALLBACK.classificationTarget : FALLBACK.regressionTarget)
  const unit = type === "classification" ? "%" : "h"
  const W=720,H=310,L=70,R=34,T=34,B=62
  const max=Math.max(...rows.map(d=>Number(d.value)||0),1)
  const gap=(W-L-R)/rows.length,bw=Math.min(90,gap*.45)
  const y=v=>H-B-(Number(v||0)/max)*(H-T-B)
  return <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={type === "classification" ? "분류 Label 분포" : "회귀 Target 분포"}>
    {[0,.25,.5,.75,1].map(p=><g key={p}><line x1={L} x2={W-R} y1={H-B-p*(H-T-B)} y2={H-B-p*(H-T-B)} className="svg-grid"/><text x={L-12} y={H-B-p*(H-T-B)+4} textAnchor="end" className="svg-tick">{Math.round(max*p)}{unit}</text></g>)}
    {rows.map((d,i)=>{const x=L+i*gap+(gap-bw)/2,h=H-B-y(d.value);return <g key={d.name}><rect x={x} y={T} width={bw} height={H-T-B} rx="14" className="svg-bar-bg"/><rect x={x} y={y(d.value)} width={bw} height={h} rx="14" className="svg-bar" style={{animationDelay:`${i*90}ms`}}/><text x={x+bw/2} y={H-24} textAnchor="middle" className="svg-label">{d.name}</text><text x={x+bw/2} y={y(d.value)-12} textAnchor="middle" className="svg-value">{d.value}{unit}</text></g>})}
  </svg>
}

function EvaluationCards({ goals }) {
  return (
    <div className="problem-eval-grid">
      {goals.map((goal, idx) => (
        <motion.div
          key={goal.name}
          className="problem-eval-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.08, duration: 0.35 }}
        >
          <span>0{idx + 1}</span>
          <strong>{goal.name}</strong>
          <p>{goal.goal}</p>
          <em>{goal.metric}</em>
        </motion.div>
      ))}
    </div>
  )
}

function UsageFlow({ flow }) {
  return (
    <div className="problem-usage-flow">
      {flow.map((item, idx) => (
        <motion.div
          key={item.step}
          className="problem-usage-item"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.08, duration: 0.35 }}
        >
          <span>{item.step}</span>
          <strong>{item.title}</strong>
          <p>{item.desc}</p>
        </motion.div>
      ))}
    </div>
  )
}

export default function ProblemPage({ onBack }) {
  const [active, setActive] = useState(0)
  const [data, setData] = useState(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetchProblemSummary()
      .then((json) => {
        if (!cancelled) {
          setData({ ...FALLBACK, ...json })
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
      id: "why",
      tag: "WHY",
      title: "왜 이 문제를 해결하는가",
      shortTitle: "WHY",
      Chart: () => <WhyCards cards={data.whyCards || FALLBACK.whyCards} />,
      findings: [
        "이 프로젝트의 핵심은 단순 조회수 예측이 아니라, 트렌딩 지속성을 예측하는 것입니다.",
        "지속성이 높으면 콘텐츠 노출 시간이 늘어나 광고·마케팅 전략에 활용할 수 있습니다.",
        "따라서 문제 정의는 데이터 분석 결과를 실제 서비스 가치로 연결하는 단계입니다.",
      ],
      note: "비즈니스 질문: 어떤 영상이 오래 트렌딩에 남는가?",
    },
    {
      id: "what",
      tag: "WHAT",
      title: "무엇을 예측하는가",
      shortTitle: "WHAT",
      Chart: () => <TaskCards cards={data.taskCards || FALLBACK.taskCards} />,
      findings: [
        "회귀는 지속 시간 자체를 예측해 수치형 판단을 제공합니다.",
        "분류는 장기 지속 여부를 예측해 빠른 의사결정에 적합합니다.",
        "두 문제를 함께 정의하면 모델 결과를 다양한 사용자 목적에 맞게 활용할 수 있습니다.",
      ],
      note: "Regression + Classification 이중 문제 정의",
    },
    {
      id: "regression",
      tag: "TARGET",
      title: "회귀 Target 분포",
      shortTitle: "회귀 Target",
      Chart: () => <TargetChart data={data.regressionTarget || FALLBACK.regressionTarget} type="regression" />,
      findings: [
        "회귀 target은 trending_duration_h입니다.",
        "분위값을 통해 지속 시간이 얼마나 넓게 분포하는지 확인합니다.",
        "회귀 모델은 예상 지속 시간을 시간 단위로 출력합니다.",
      ],
      note: "Target: trending_duration_h",
    },
    {
      id: "classification",
      tag: "LABEL",
      title: "분류 Label 분포",
      shortTitle: "분류 Label",
      Chart: () => <TargetChart data={data.classificationTarget || FALLBACK.classificationTarget} type="classification" />,
      findings: [
        "분류 target은 장기 지속 여부입니다.",
        "tdi_label 또는 tdi_label_04 기준을 사용해 장기/단기 지속을 구분합니다.",
        "분류 결과는 예측 시스템에서 장기 지속 확률로 제공할 수 있습니다.",
      ],
      note: "Target: tdi_label_04",
    },
    {
      id: "how",
      tag: "HOW",
      title: "T0 vs 24h 전략",
      shortTitle: "HOW",
      Chart: () => <StrategyCompare cards={data.strategyCards || FALLBACK.strategyCards} />,
      findings: [
        "T0 모델은 트렌딩 진입 시점에서 즉시 사용할 수 있는 초기 신호만 사용합니다.",
        "24h 모델은 진입 후 성장 정보를 반영해 성능 개선 여부를 확인합니다.",
        "이 구조는 시간 흐름에 따른 예측 업데이트 전략을 가능하게 합니다.",
      ],
      note: "T0: 빠른 판단 / 24h: 개선된 판단",
    },
    {
      id: "evaluation",
      tag: "EVALUATION",
      title: "평가 목표",
      shortTitle: "평가",
      Chart: () => <EvaluationCards goals={data.evaluationGoals || FALLBACK.evaluationGoals} />,
      findings: [
        "회귀는 예측 시간과 실제 지속 시간의 오차를 줄이는 것이 목표입니다.",
        "분류는 장기 지속 영상을 잘 탐지하는 것이 중요하므로 F1-score와 AUC를 봅니다.",
        "T0와 24h의 성능 차이를 비교해 24시간 성장 정보의 가치를 판단합니다.",
      ],
      note: "모델 성능을 문제 목적에 맞게 평가",
    },
    {
      id: "usage",
      tag: "USAGE",
      title: "실제 활용 시나리오",
      shortTitle: "활용",
      Chart: () => <UsageFlow flow={data.usageFlow || FALLBACK.usageFlow} />,
      findings: [
        "트렌딩 진입 직후 T0 모델로 빠르게 장기 지속 가능성을 판단합니다.",
        "24시간 후 성장 정보를 반영해 예측을 업데이트합니다.",
        "최종 결과는 광고 집행, 업로드 전략, 콘텐츠 제작 방향에 활용할 수 있습니다.",
      ],
      note: "예측 결과를 전략 의사결정으로 연결",
    },
  ], [data])

  const sec = sections[active]
  const total = sections.length

  return (
    <div className="yta-app-inner problem-page">
      <motion.button className="back-btn" onClick={onBack} whileHover={{ x: -3 }} transition={{ duration: 0.2 }}>
        ← 목록으로
      </motion.button>

      <motion.div className="part-page-header problem-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
        <motion.div className="problem-hero-top" variants={fadeUp}>
          <span className="part-page-num">Part 4</span>
          <span className="problem-hero-badge">Problem Formulation</span>
        </motion.div>

        <motion.h1 className="part-page-title" variants={fadeUp}>문제 정의</motion.h1>
        <motion.p className="part-page-subtitle" variants={fadeUp}>
          “{data.summary?.mainQuestion || FALLBACK.summary.mainQuestion}”라는 질문을 회귀·분류·T0/24h 예측 전략으로 구조화합니다.
        </motion.p>

        <motion.div variants={fadeUp}>
          {loading && <div className="api-status api-status--loading"><span className="api-status-dot" /><span>API 연결 중…</span></div>}
          {!loading && !error && <div className="api-status api-status--ok"><span className="api-status-dot" /><span>API 연결 성공 · {API}</span></div>}
          {!loading && error && <div className="api-status api-status--fail"><span className="api-status-dot" /><span>API 연결 실패 · 로컬 데이터 사용 중</span></div>}
        </motion.div>

        <motion.div className="eda-summary-row" variants={fadeUpStagger}>
          {[
            ["총 데이터", data.summary?.totalRows?.toLocaleString() ?? "34,964"],
            ["카테고리", `${data.summary?.categoryCount ?? 5}그룹`],
            ["평균 지속", `${data.summary?.avgDuration ?? 144.1}h`],
            ["24h 관측률", `${data.summary?.obs24Rate ?? 68.2}%`],
          ].map(([label, value]) => (
            <motion.div key={label} className="eda-summary-item" variants={fadeUp}>
              <span className="eda-summary-label">{label}</span>
              <span className="eda-summary-val">{value}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="eda-tabs problem-tabs">
          {sections.map((s, i) => (
            <motion.button key={s.id} className={`eda-tab ${active === i ? "on" : ""}`} onClick={() => setActive(i)} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <span className="eda-tab-tag">{s.tag}</span>
              <span className="eda-tab-title">{s.shortTitle}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={sec.id} className="eda-body problem-body" variants={slideTab} initial="hidden" animate="show" exit="exit">
            <div className="eda-chart-panel">
              <p className="eda-chart-title">{sec.title}</p>
              <div className="eda-chart-wrap problem-chart-wrap">
                {loading ? <div className="problem-empty-chart">Loading...</div> : <sec.Chart />}
              </div>
            </div>

            <div className="eda-desc-panel">
              <div className="eda-tag-row">
                <span className="eda-big-tag">{sec.tag}</span>
                <span className="eda-progress">{active + 1} / {total}</span>
              </div>

              <h3 className="eda-desc-title">{sec.title}</h3>
              <p className="eda-findings-label">설계 이유</p>

              <ul className="eda-findings">
                {sec.findings.map((finding, i) => (
                  <motion.li key={finding} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.3 }}>
                    <span className="eda-finding-num">{i + 1}</span>{finding}
                  </motion.li>
                ))}
              </ul>

              <div className="eda-note-box">
                <span className="eda-note-label">PROBLEM</span>
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
