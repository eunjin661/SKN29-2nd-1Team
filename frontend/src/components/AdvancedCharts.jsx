import EmptyState from './EmptyState'
import '../styles/advanced-charts.css'

const fmt = (v) => Number(v || 0).toLocaleString('ko-KR')
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0))

function Empty({ title, message }) {
  return <EmptyState title={title} message={message} />
}

function axisLabels(max, steps = 4) {
  return Array.from({ length: steps + 1 }, (_, i) => Math.round((max / steps) * i))
}

export function TrendLineChart({ data = [], title = '트렌드 흐름' }) {
  if (!data.length) return <Empty title="차트 데이터 없음" message="선택한 조건에 맞는 트렌드 흐름 데이터가 없습니다." />

  const W = 720, H = 300, L = 58, R = 28, T = 34, B = 48
  const max = Math.max(...data.map(d => Number(d.value) || 0), 1)
  const x = (i) => L + (i / Math.max(data.length - 1, 1)) * (W - L - R)
  const y = (v) => H - B - ((Number(v) || 0) / max) * (H - T - B)
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const area = `${L},${H-B} ${points} ${W-R},${H-B}`

  return (
    <div className="advanced-chart-card">
      <div className="advanced-chart-head"><h3>{title}</h3><span>Line Chart</span></div>
      <svg className="svg-chart svg-chart--line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <defs>
          <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {axisLabels(max).map(v => <g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} className="svg-grid"/><text x={L-12} y={y(v)+4} textAnchor="end" className="svg-tick">{fmt(v)}</text></g>)}
        <polygon points={area} fill="url(#trendAreaGradient)" className="svg-area" />
        <polyline points={points} className="svg-line" />
        {data.map((d, i) => <g key={d.label} className="svg-point-group"><circle cx={x(i)} cy={y(d.value)} r="6" className="svg-point"/><text x={x(i)} y={H-18} textAnchor="middle" className="svg-label">{d.label}</text><text x={x(i)} y={y(d.value)-12} textAnchor="middle" className="svg-value">{fmt(d.value)}</text></g>)}
      </svg>
    </div>
  )
}

export function DurationBarChart({ data = [], title = '지속성 분포' }) {
  if (!data.length) return <Empty title="차트 데이터 없음" message="지속성 구간 데이터가 없습니다." />

  const W = 720, H = 300, L = 54, R = 24, T = 30, B = 54
  const max = Math.max(...data.map(d => Number(d.value) || 0), 1)
  const bw = (W - L - R) / data.length * 0.58
  const gap = (W - L - R) / data.length
  const y = v => H - B - ((Number(v) || 0) / max) * (H - T - B)

  return (
    <div className="advanced-chart-card">
      <div className="advanced-chart-head"><h3>{title}</h3><span>Bar Chart</span></div>
      <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {axisLabels(max).map(v => <g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} className="svg-grid"/><text x={L-12} y={y(v)+4} textAnchor="end" className="svg-tick">{fmt(v)}</text></g>)}
        {data.map((d, i) => { const h = H-B-y(d.value); const x = L + i*gap + (gap-bw)/2; return <g key={d.label}><rect x={x} y={T} width={bw} height={H-T-B} rx="12" className="svg-bar-bg"/><rect x={x} y={y(d.value)} width={bw} height={h} rx="12" className="svg-bar" style={{ animationDelay: `${i*90}ms` }}/><text x={x+bw/2} y={H-20} textAnchor="middle" className="svg-label">{d.label}</text><text x={x+bw/2} y={y(d.value)-10} textAnchor="middle" className="svg-value">{fmt(d.value)}</text></g> })}
      </svg>
    </div>
  )
}

export function StrategyScoreChart({ data = [], title = '카테고리 전략 점수' }) {
  if (!data.length) return <Empty title="카테고리 데이터 없음" message="선택한 카테고리에 해당하는 전략 점수가 없습니다." />

  const rows = data.map(d => ({ ...d, strategyScore: clamp(d.strategyScore, 0, 100) }))
  const W = 720, H = 320, L = 144, R = 38, T = 34
  const rowH = 42
  const barW = W - L - R

  return (
    <div className="advanced-chart-card">
      <div className="advanced-chart-head"><h3>{title}</h3><span>Score</span></div>
      <svg className="svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {[0,25,50,75,100].map(v => <g key={v}><line x1={L+(v/100)*barW} x2={L+(v/100)*barW} y1={T-10} y2={T + rows.length*rowH} className="svg-grid"/><text x={L+(v/100)*barW} y={T + rows.length*rowH + 24} textAnchor="middle" className="svg-tick">{v}</text></g>)}
        {rows.map((d, i) => { const y = T+i*rowH; return <g key={d.category}><text x={L-14} y={y+22} textAnchor="end" className="svg-label svg-label-strong">{d.category}</text><rect x={L} y={y+5} width={barW} height="22" rx="11" className="svg-track"/><rect x={L} y={y+5} width={(d.strategyScore/100)*barW} height="22" rx="11" className="svg-bar-horizontal" style={{ animationDelay: `${i*80}ms` }}/><text x={L+(d.strategyScore/100)*barW+10} y={y+21} className="svg-value">{d.strategyScore}점</text></g> })}
      </svg>
    </div>
  )
}
