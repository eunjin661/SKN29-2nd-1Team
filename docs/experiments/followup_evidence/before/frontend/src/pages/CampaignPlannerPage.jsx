import { useEffect, useMemo, useState } from 'react'
import '../styles/CampaignPlannerPage.css'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const FALLBACK = {
  summary: {
    recommendedCategory: 'Lifestyle',
    objective: 'ROI 유지',
    budget: 3000000,
    expectedScore: 82,
    bestTiming: '토요일 18–22시',
    roiIndex: 128,
    riskLevel: 'LOW',
    cpm: 3500,
  },
  categories: [
    { category: 'Lifestyle', score: 82, duration: 132, risk: 'LOW', action: '장기 브랜딩형 광고 집행', budgetShare: 35, conversionFit: 72, brandFit: 92, viralFit: 78, reason: '지속시간과 브랜드 적합도가 높아 장기 노출 효율이 좋습니다.' },
    { category: 'Entertainment', score: 78, duration: 120, risk: 'MID', action: '바이럴 직후 단기 집중 집행', budgetShare: 30, conversionFit: 68, brandFit: 76, viralFit: 91, reason: '초기 반응 속도가 빨라 단기 확산 캠페인에 유리합니다.' },
    { category: 'Music', score: 74, duration: 118, risk: 'MID', action: '재진입 감지 후 리타겟팅', budgetShare: 20, conversionFit: 64, brandFit: 86, viralFit: 80, reason: '재진입 가능성과 잔존 효과가 높아 리타겟팅에 적합합니다.' },
    { category: 'Education', score: 66, duration: 96, risk: 'LOW', action: '검색형/정보형 광고 보조 집행', budgetShare: 10, conversionFit: 79, brandFit: 70, viralFit: 55, reason: '전환 적합도는 높지만 확산성은 낮아 보조 집행이 적합합니다.' },
    { category: 'News', score: 52, duration: 60, risk: 'HIGH', action: '단기 이슈성 집행만 제한적으로 운영', budgetShare: 5, conversionFit: 48, brandFit: 45, viralFit: 62, reason: '이슈 의존도가 높아 장기 ROI 변동성이 큽니다.' },
  ],
  roadmap: [
    { step: 'WEEK 1', title: '테스트 집행', desc: '총 예산의 25%로 상위 카테고리 반응을 검증합니다.' },
    { step: 'WEEK 2', title: '성과 확대', desc: '예측 점수 75점 이상 카테고리에 예산을 재배분합니다.' },
    { step: 'WEEK 3', title: '리타겟팅', desc: '재진입 가능성이 높은 영상/카테고리를 대상으로 반복 노출합니다.' },
    { step: 'WEEK 4', title: 'ROI 정리', desc: '성과 낮은 카테고리는 중단하고 장기 유지형 중심으로 전환합니다.' },
  ],
}

const objectives = [
  { id: 'awareness', label: '인지도', desc: '도달·노출 우선' },
  { id: 'conversion', label: '전환', desc: '성과·효율 우선' },
  { id: 'brand', label: '장기 브랜딩', desc: '지속성·잔존효과 우선' },
]

const scenarios = [
  { id: 'balanced', label: '균형형', desc: '위험을 낮추고 안정적으로 배분' },
  { id: 'aggressive', label: '공격형', desc: '상위 카테고리에 집중 투자' },
  { id: 'safe', label: '안정형', desc: '고위험 카테고리 최소화' },
]

const money = (v) => new Intl.NumberFormat('ko-KR').format(Math.round(Number(v) || 0))

function getObjectiveScore(category, objective) {
  if (objective === 'awareness') return category.viralFit ?? category.score
  if (objective === 'conversion') return category.conversionFit ?? category.score
  if (objective === 'brand') return category.brandFit ?? category.score
  return category.score
}

function getRiskLabel(risk) {
  if (risk === 'LOW') return '낮음'
  if (risk === 'MID') return '보통'
  return '높음'
}

function getGrade(score) {
  if (score >= 85) return 'A+'
  if (score >= 78) return 'A'
  if (score >= 68) return 'B'
  if (score >= 58) return 'C'
  return 'D'
}

function safeCsvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export default function CampaignPlannerPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [payload, setPayload] = useState(FALLBACK)
  const [objective, setObjective] = useState('awareness')
  const [budget, setBudget] = useState(3000000)
  const [cpm, setCpm] = useState(3500)
  const [selected, setSelected] = useState('ALL')
  const [scenario, setScenario] = useState('balanced')

  useEffect(() => {
    let cancelled = false
    fetch(`${API}/campaign/plan`)
      .then((res) => {
        if (!res.ok) throw new Error('api error')
        return res.json()
      })
      .then((res) => {
        if (!cancelled) {
          setPayload(res)
          if (res?.summary?.cpm) setCpm(Number(res.summary.cpm))
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPayload(FALLBACK)
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const categories = payload.categories?.length ? payload.categories : FALLBACK.categories
  const filtered = selected === 'ALL' ? categories : categories.filter((c) => c.category === selected)

  const planned = useMemo(() => {
    const scored = filtered.map((c) => {
      let objectiveScore = getObjectiveScore(c, objective)
      if (scenario === 'aggressive') objectiveScore = objectiveScore * (c.score >= 75 ? 1.18 : 0.9)
      if (scenario === 'safe') objectiveScore = objectiveScore * (c.risk === 'HIGH' ? 0.35 : c.risk === 'MID' ? 0.85 : 1.15)
      return { ...c, objectiveScore: Math.round(Math.max(1, Math.min(100, objectiveScore))) }
    })
    const total = Math.max(scored.reduce((acc, c) => acc + c.objectiveScore, 0), 1)
    return scored
      .map((c) => {
        const roiIndex = Math.round(c.objectiveScore * (c.risk === 'LOW' ? 1.45 : c.risk === 'MID' ? 1.18 : 0.82))
        return {
          ...c,
          budgetShare: Math.round((c.objectiveScore / total) * 100),
          adjustedBudget: budget * (c.objectiveScore / total),
          estimatedReach: Math.round(((budget * (c.objectiveScore / total)) / Math.max(cpm, 1)) * 1000),
          estimatedAction: Math.round(((budget * (c.objectiveScore / total)) / Math.max(cpm, 1)) * 1000 * (0.025 + c.objectiveScore / 2500)),
          costPerAction: Math.round((budget * (c.objectiveScore / total)) / Math.max(1, (((budget * (c.objectiveScore / total)) / Math.max(cpm, 1)) * 1000 * (0.025 + c.objectiveScore / 2500)))),
          roiIndex,
          grade: getGrade(c.objectiveScore),
          intensity: c.objectiveScore >= 82 ? '강하게 집행' : c.objectiveScore >= 65 ? '테스트 후 확대' : '제한 집행',
          warning: c.risk === 'HIGH'
            ? 'ROI 변동성이 커서 테스트 예산만 권장'
            : c.objectiveScore < 60
              ? '목표 적합도가 낮아 보조 집행 권장'
              : '집행 가능 구간',
        }
      })
      .sort((a, b) => b.objectiveScore - a.objectiveScore)
  }, [filtered, budget, cpm, objective, scenario])

  const top = planned[0] || categories[0]
  const avgRoi = Math.round(planned.reduce((acc, c) => acc + c.roiIndex, 0) / Math.max(planned.length, 1))
  const avgScore = Math.round(planned.reduce((acc, c) => acc + c.objectiveScore, 0) / Math.max(planned.length, 1))

  const finalGrade = getGrade(avgScore)
  const totalReach = planned.reduce((acc, c) => acc + (c.estimatedReach || 0), 0)
  const totalAction = planned.reduce((acc, c) => acc + (c.estimatedAction || 0), 0)
  const avgCpa = Math.round(budget / Math.max(totalAction, 1))

  const simulation = useMemo(() => {
    const base = Math.max(35, Math.min(95, avgScore))
    const amounts = [1000000, 3000000, 7000000, 12000000, 20000000]
    return amounts.map((amount) => {
      const ratio = Math.log10(amount / 1000000 + 1)
      const performance = Math.round(Math.min(98, base * (0.72 + ratio * 0.22)))
      return { amount, performance }
    })
  }, [avgScore])

  const scenarioSummary = useMemo(() => {
    if (scenario === 'aggressive') return '상위 카테고리에 예산을 집중해 빠른 확산을 노리는 전략입니다.'
    if (scenario === 'safe') return '고위험 카테고리를 낮추고 안정적인 ROI를 우선하는 전략입니다.'
    return '성과와 위험을 동시에 고려해 균형 있게 예산을 배분하는 전략입니다.'
  }, [scenario])

  const aiReason = useMemo(() => {
    const goal = objectives.find((o) => o.id === objective)?.label || '인지도'
    return `${top?.category || '상위 카테고리'}는 ${goal} 목표에서 ${top?.objectiveScore || 0}점으로 가장 높고, ${top?.risk === 'LOW' ? '위험도가 낮아 안정적인 집행이 가능합니다.' : top?.risk === 'MID' ? '초기 테스트 후 확장하면 효율 관리가 가능합니다.' : '위험도가 높아 제한 집행이 필요합니다.'}`
  }, [top, objective])

  const generatedPlan = useMemo(() => {
    const first = planned[0]?.category || '상위 카테고리'
    const second = planned[1]?.category || '보조 카테고리'
    const goalText = objectives.find((o) => o.id === objective)?.label || '인지도'
    return [
      { step: '1주차', title: '테스트 집행', desc: `${goalText} 목표 기준 ${first}에 테스트 예산을 먼저 투입합니다.` },
      { step: '2주차', title: '성과 확대', desc: `${first}의 초기 반응이 기준 이상이면 예산을 1.5배 확대합니다.` },
      { step: '3주차', title: '보조 카테고리 확장', desc: `${second}를 보조 집행군으로 운영해 성과 편중을 줄입니다.` },
      { step: '4주차', title: 'ROI 최적화', desc: '위험도 높은 카테고리는 중단하고 장기 유지형 카테고리에 집중합니다.' },
    ]
  }, [planned, objective])

  const downloadCSV = () => {
    const header = ['category', 'objectiveScore', 'grade', 'budgetShare', 'budget', 'cpm', 'estimatedReach', 'estimatedAction', 'costPerAction', 'roiIndex', 'risk', 'intensity', 'warning']
    const rows = planned.map((c) => [
      c.category,
      c.objectiveScore,
      c.grade,
      `${c.budgetShare}%`,
      Math.round(c.adjustedBudget),
      cpm,
      c.estimatedReach,
      c.estimatedAction,
      c.costPerAction,
      c.roiIndex,
      c.risk,
      c.intensity,
      c.warning,
    ].map(safeCsvValue).join(','))
    const csv = ['\ufeff' + header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'campaign_plan.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="campaign-page">
      <section className="campaign-hero">
        <div>
          <p className="campaign-eyebrow">CAMPAIGN PLANNER</p>
          <h1>광고 캠페인 플래너</h1>
          <p className="campaign-lead">
            트렌딩·지속성·예측 결과를 바탕으로 목표별 예산 배분, ROI 기대치, 위험도, 실행 로드맵을 자동 생성합니다.
          </p>
          <div className={`campaign-status ${error ? 'warn' : 'ok'}`}>
            {loading ? '데이터 준비 중...' : error ? 'API 연결 실패 · fallback 데이터 표시 중' : 'API 연결 성공'}
          </div>
        </div>
        <div className="campaign-hero-card">
          <span>최종 추천 등급</span>
          <strong>{finalGrade}</strong>
          <small>{top?.category || 'Lifestyle'} · {top?.intensity || top?.action}</small>
          <button className="hero-action" onClick={() => window.print()}>PDF 요약</button>
        </div>
      </section>

      <section className="campaign-controls">
        <div className="control-group goal-control">
          <label>광고 목표</label>
          <div className="segmented">
            {objectives.map((o) => (
              <button key={o.id} className={objective === o.id ? 'active' : ''} onClick={() => setObjective(o.id)}>
                <b>{o.label}</b>
                <small>{o.desc}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="control-group goal-control">
          <label>전략 시나리오</label>
          <div className="segmented scenario-segmented">
            {scenarios.map((s) => (
              <button key={s.id} className={scenario === s.id ? 'active' : ''} onClick={() => setScenario(s.id)}>
                <b>{s.label}</b>
                <small>{s.desc}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="control-group budget-control">
          <label>총 예산: {money(budget)}원</label>
          <input type="range" min="1000000" max="20000000" step="500000" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          <div className="budget-scale"><span>100만</span><span>2,000만</span></div>
        </div>
        <div className="control-group budget-control cpm-control">
          <label>가정 CPM: {money(cpm)}원 / 1,000회 노출</label>
          <input type="range" min="1000" max="10000" step="500" value={cpm} onChange={(e) => setCpm(Number(e.target.value))} />
          <div className="budget-scale"><span>1천</span><span>1만</span></div>
          <small className="formula-note">예상 노출 = 배정 예산 ÷ CPM × 1,000</small>
        </div>
        <div className="control-group">
          <label>카테고리</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="ALL">전체</option>
            {categories.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
          </select>
        </div>
      </section>

      <section className="campaign-kpis">
        <article><span>추천 카테고리</span><strong>{top?.category}</strong></article>
        <article><span>캠페인 점수</span><strong>{avgScore}/100</strong></article>
        <article><span>예상 ROI 지수</span><strong>{avgRoi}</strong></article>
        <article><span>예상 노출</span><strong>{money(totalReach)}회</strong></article>
        <article><span>예상 액션</span><strong>{money(totalAction)}건</strong></article>
        <article><span>예상 CPA</span><strong>{money(avgCpa)}원</strong></article>
      </section>

      <section className="campaign-grid">
        <div className="campaign-panel wide">
          <div className="panel-head">
            <div>
              <p>Budget Allocation</p>
              <h2>목표 기반 예산 배분</h2>
            </div>
            <button className="outline-btn" onClick={downloadCSV}>CSV 다운로드</button>
          </div>
          <div className="allocation-list">
            {planned.map((c) => (
              <div className="allocation-row" key={c.category}>
                <div className="alloc-meta">
                  <strong>{c.category}</strong>
                  <span>{c.action}</span>
                </div>
                <div className="alloc-bar"><i style={{ width: `${Math.max(c.budgetShare, 4)}%` }} /></div>
                <div className="alloc-num">
                  <b>{money(c.adjustedBudget)}원</b>
                  <small>{c.budgetShare}% · {c.grade}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="campaign-panel">
          <p>ROI Forecast</p>
          <h2>예상 효율 카드</h2>
          <div className="roi-card">
            <strong>{top?.roiIndex || 120}</strong>
            <span>ROI INDEX</span>
          </div>
          <ul className="signal-list">
            <li>추천 집행 강도: <b>{top?.intensity}</b></li>
            <li>위험도: <b>{getRiskLabel(top?.risk)}</b></li>
            <li>목표 적합도: <b>{top?.objectiveScore}점</b></li>
            <li>예상 노출: <b>{money(top?.estimatedReach)}회</b></li>
            <li>예상 CPA: <b>{money(top?.costPerAction)}원</b></li>
          </ul>
        </div>
      </section>

      <section className="campaign-grid second-grid">
        <div className="campaign-panel">
          <p>Performance Simulation</p>
          <h2>예산 대비 예상 성과</h2>
          <div className="simulation-chart">
            {simulation.map((point) => (
              <div className="sim-column" key={point.amount}>
                <b>{point.performance}</b>
                <i style={{ height: `${point.performance}%` }} />
                <span>{money(point.amount / 10000)}만</span>
              </div>
            ))}
          </div>
        </div>
        <div className="campaign-panel">
          <p>Scenario</p>
          <h2>선택 전략 해석</h2>
          <div className="explain-card">
            <strong>{scenarios.find((s) => s.id === scenario)?.label}</strong>
            <p>{scenarioSummary}</p>
          </div>
          <div className="explain-card muted-card">
            <strong>AI 추천 근거</strong>
            <p>{aiReason}</p>
          </div>
          <div className="explain-card formula-card">
            <strong>예산 산정 방식</strong>
            <p>카테고리 점수로 예산을 나누고, CPM {money(cpm)}원을 적용해 예상 노출·액션·CPA를 계산합니다.</p>
          </div>
        </div>
      </section>

      <section className="campaign-panel wide table-panel">
        <div className="panel-head">
          <div>
            <p>Risk System</p>
            <h2>카테고리별 집행 판단</h2>
          </div>
        </div>
        <div className="campaign-table-wrap">
          <table className="campaign-table">
            <thead>
              <tr>
                <th>카테고리</th>
                <th>점수</th>
                <th>등급</th>
                <th>위험도</th>
                <th>예상 노출</th>
                <th>예상 CPA</th>
                <th>집행 강도</th>
                <th>리스크 경고</th>
              </tr>
            </thead>
            <tbody>
              {planned.map((c) => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td>{c.objectiveScore}</td>
                  <td><b>{c.grade}</b></td>
                  <td><span className={`risk-badge ${String(c.risk).toLowerCase()}`}>{getRiskLabel(c.risk)}</span></td>
                  <td>{money(c.estimatedReach)}회</td>
                  <td>{money(c.costPerAction)}원</td>
                  <td>{c.intensity}</td>
                  <td>{c.warning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="campaign-panel wide roadmap-panel">
        <div className="panel-head">
          <div>
            <p>Auto Campaign Plan</p>
            <h2>4주 실행 로드맵</h2>
          </div>
        </div>
        <div className="roadmap-grid">
          {generatedPlan.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="campaign-final">
        <b>FINAL DECISION</b>
        <p>
          현재 조건에서는 <strong>{top?.category}</strong> 중심으로 {top?.intensity}하고,
          CPM {money(cpm)}원 기준 예상 노출 {money(totalReach)}회, 예상 CPA {money(avgCpa)}원 수준으로 운영하는 전략이 가장 안정적입니다.
        </p>
      </section>
    </main>
  )
}
