import { motion } from 'framer-motion'
import '../styles/stable-charts.css'

const fmt = (v, suffix = '') => {
  const n = Number(v)
  if (!Number.isFinite(n)) return `${v ?? '-'}${suffix}`
  return `${n.toLocaleString('ko-KR')}${suffix}`
}
const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d

const safeRows = (rows) => Array.isArray(rows) ? rows.filter(Boolean) : []
const axisTicks = (max, steps = 4) => Array.from({ length: steps + 1 }, (_, i) => Math.round((max / steps) * i))

function ChartFrame({ title, badge, children, legend }) {
  return (
    <div className="stable-chart-frame">
      {(title || badge || legend) && (
        <div className="stable-chart-head">
          <div>
            {badge && <span className="stable-chart-badge">{badge}</span>}
            {title && <h3>{title}</h3>}
          </div>
          {legend && <div className="stable-chart-legend">{legend}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function StableEmptyChart({ title = '차트 데이터 없음', message = '표시할 수 있는 데이터가 없습니다.' }) {
  return (
    <div className="stable-empty-chart">
      <span>{title}</span>
      <p>{message}</p>
    </div>
  )
}

export function StableVerticalBarChart({ data, xKey = 'label', yKey = 'value', title, badge, suffix = '', max: customMax }) {
  const rows = safeRows(data).map((d, i) => ({ ...d, _x: String(d[xKey] ?? d.name ?? d.category ?? d.label ?? `항목 ${i + 1}`), _y: num(d[yKey] ?? d.value ?? d.events ?? d.duration ?? d.ratio) }))
  if (!rows.length) return <StableEmptyChart />
  const W = 760, H = 340, L = 62, R = 26, T = 28, B = 62
  const max = Math.max(customMax || 0, ...rows.map(d => d._y), 1)
  const gap = (W - L - R) / rows.length
  const bw = Math.min(74, gap * 0.48)
  const y = (v) => H - B - (num(v) / max) * (H - T - B)
  return (
    <ChartFrame title={title} badge={badge} legend={<><span><i/>값</span><span><em/>기준선</span></>}>
      <svg className="stable-svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title || 'bar chart'}>
        {axisTicks(max).map(v => <g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} className="stable-grid"/><text x={L-12} y={y(v)+4} textAnchor="end" className="stable-tick">{fmt(v, suffix)}</text></g>)}
        {rows.map((d, i) => { const x = L + i*gap + (gap-bw)/2; const h = H-B-y(d._y); return (
          <g key={`${d._x}-${i}`}>
            <rect x={x} y={T} width={bw} height={H-T-B} rx="15" className="stable-bar-bg" />
            <motion.rect x={x} y={y(d._y)} width={bw} height={h} rx="15" className="stable-bar" initial={{ scaleY: 0, opacity: .4 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: .75, delay: i*.08, ease: [0.22,1,0.36,1] }} style={{ transformOrigin: `${x + bw/2}px ${H-B}px` }} />
            <text x={x+bw/2} y={H-28} textAnchor="middle" className="stable-label">{d._x}</text>
            <motion.text x={x+bw/2} y={Math.max(18, y(d._y)-10)} textAnchor="middle" className="stable-value" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*.08 + .45 }}>{fmt(d._y, suffix)}</motion.text>
          </g>
        )})}
      </svg>
    </ChartFrame>
  )
}

export function StableHorizontalBarChart({ data, labelKey = 'label', valueKey = 'value', title, badge, suffix = '', max: customMax, threshold }) {
  const rows = safeRows(data).map((d, i) => ({ ...d, _label: String(d[labelKey] ?? d.name ?? d.category ?? d.label ?? `항목 ${i + 1}`), _value: num(d[valueKey] ?? d.value ?? d.importance ?? d.score ?? d.risk) }))
  if (!rows.length) return <StableEmptyChart />
  const W = 760, H = Math.max(300, 72 + rows.length * 46), L = 152, R = 64, T = 38, rowH = 46
  const max = Math.max(customMax || 0, ...rows.map(d => d._value), 1)
  const barW = W - L - R
  const tx = threshold ? L + (threshold / max) * barW : null
  return (
    <ChartFrame title={title} badge={badge} legend={<><span><i/>기여도</span>{threshold && <span><em/>기준선 {threshold}{suffix}</span>}</>}>
      <svg className="stable-svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title || 'horizontal bar chart'}>
        {axisTicks(max).map(v => { const x = L + (v/max)*barW; return <g key={v}><line x1={x} x2={x} y1={T-16} y2={T+rows.length*rowH} className="stable-grid"/><text x={x} y={T+rows.length*rowH+24} textAnchor="middle" className="stable-tick">{fmt(v, suffix)}</text></g> })}
        {tx && <><line x1={tx} x2={tx} y1={T-22} y2={T+rows.length*rowH} className="stable-threshold"/><text x={tx+8} y={T-28} className="stable-threshold-label">기준 {threshold}{suffix}</text></>}
        {rows.map((d, i) => { const y = T + i*rowH; const w = (d._value/max)*barW; return (
          <g key={`${d._label}-${i}`}>
            <text x={L-16} y={y+23} textAnchor="end" className="stable-label stable-label-strong">{d._label}</text>
            <rect x={L} y={y+6} width={barW} height="24" rx="12" className="stable-track"/>
            <motion.rect x={L} y={y+6} width={w} height="24" rx="12" className="stable-hbar" initial={{ scaleX: 0, opacity: .35 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: .78, delay: i*.08, ease: [0.22,1,0.36,1] }} style={{ transformOrigin: `${L}px ${y+18}px` }} />
            <motion.circle cx={L+w} cy={y+18} r="7" className="stable-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i*.08 + .45 }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
            <text x={Math.min(L+w+14, W-30)} y={y+23} className="stable-value">{fmt(d._value, suffix)}</text>
          </g>
        )})}
      </svg>
    </ChartFrame>
  )
}

export function StableLineChart({ data, xKey = 'label', yKey = 'value', title, badge, suffix = '', max: customMax }) {
  const rows = safeRows(data).map((d, i) => ({ ...d, _x: String(d[xKey] ?? d.label ?? d.year ?? d.day ?? `P${i+1}`), _y: num(d[yKey] ?? d.value ?? d.duration ?? d.events) }))
  if (!rows.length) return <StableEmptyChart />
  const W = 760, H = 340, L = 62, R = 28, T = 32, B = 58
  const max = Math.max(customMax || 0, ...rows.map(d => d._y), 1)
  const x = i => L + (i / Math.max(rows.length - 1, 1)) * (W - L - R)
  const y = v => H - B - (num(v) / max) * (H - T - B)
  const pts = rows.map((d, i) => `${x(i)},${y(d._y)}`).join(' ')
  const area = `${L},${H-B} ${pts} ${W-R},${H-B}`
  return (
    <ChartFrame title={title} badge={badge} legend={<><span><i/>흐름</span><span><em/>보조선</span></>}>
      <svg className="stable-svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title || 'line chart'}>
        <defs><linearGradient id={`stableLineFill${title || ''}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--red)" stopOpacity=".22"/><stop offset="100%" stopColor="var(--red)" stopOpacity=".02"/></linearGradient></defs>
        {axisTicks(max).map(v => <g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} className="stable-grid"/><text x={L-12} y={y(v)+4} textAnchor="end" className="stable-tick">{fmt(v, suffix)}</text></g>)}
        {rows.map((d,i)=><text key={d._x} x={x(i)} y={H-24} textAnchor="middle" className="stable-label">{d._x}</text>)}
        <motion.polygon points={area} fill="var(--stable-line-fill, rgba(255,45,45,.08))" className="stable-area" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .25 }} />
        <motion.polyline points={pts} className="stable-line" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.05, ease: [0.22,1,0.36,1] }} />
        {rows.map((d, i) => <g key={`${d._x}-pt`}><motion.circle cx={x(i)} cy={y(d._y)} r="7" className="stable-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: .55 + i*.08 }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}/><text x={x(i)} y={Math.max(18, y(d._y)-14)} textAnchor="middle" className="stable-value">{fmt(d._y, suffix)}</text></g>)}
      </svg>
    </ChartFrame>
  )
}

export function StableWaveChart({ title = '요일 성과 Wave', badge = 'TIME PATTERN' }) {
  const rows = [
    { label: '월', value: 52 }, { label: '화', value: 68 }, { label: '수', value: 76 },
    { label: '목', value: 64 }, { label: '금', value: 84 }, { label: '토', value: 94 }, { label: '일', value: 88 },
  ]
  return <StableLineChart data={rows} title={title} badge={badge} suffix="" max={100} />
}

export function StableScatterChart({ data, title = '조회수 vs 지속시간 관계', badge = 'RELATION' }) {
  const rows = safeRows(data).length ? safeRows(data) : [
    { x: 12, y: 52, label: 'A' }, { x: 24, y: 76, label: 'B' }, { x: 36, y: 110, label: 'C' },
    { x: 48, y: 146, label: 'D' }, { x: 70, y: 160, label: 'E' }, { x: 84, y: 205, label: 'F' },
  ]
  const W = 760, H = 340, L = 66, R = 28, T = 34, B = 58
  const maxX = Math.max(...rows.map(d => num(d.x ?? d.view ?? d.views)), 1)
  const maxY = Math.max(...rows.map(d => num(d.y ?? d.duration ?? d.value)), 1)
  const x = v => L + (num(v)/maxX)*(W-L-R)
  const y = v => H-B-(num(v)/maxY)*(H-T-B)
  return (
    <ChartFrame title={title} badge={badge} legend={<><span><i/>영상 이벤트</span><span><em/>증가 방향</span></>}>
      <svg className="stable-svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {axisTicks(maxY).map(v => <g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} className="stable-grid"/><text x={L-12} y={y(v)+4} textAnchor="end" className="stable-tick">{fmt(v)}h</text></g>)}
        {axisTicks(maxX).map(v => <g key={v}><line x1={x(v)} x2={x(v)} y1={T} y2={H-B} className="stable-grid stable-grid-soft"/><text x={x(v)} y={H-25} textAnchor="middle" className="stable-tick">{fmt(v)}</text></g>)}
        <line x1={L} x2={W-R} y1={H-B} y2={H-B} className="stable-axis"/><line x1={L} x2={L} y1={T} y2={H-B} className="stable-axis"/>
        <motion.line x1={L+20} y1={H-B-20} x2={W-R-20} y2={T+35} className="stable-trend-line" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1 }} />
        {rows.map((d,i)=><motion.circle key={i} cx={x(d.x ?? d.view ?? d.views)} cy={y(d.y ?? d.duration ?? d.value)} r="8" className="stable-scatter" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: .72 }} transition={{ delay: i*.07 }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}/>) }
      </svg>
    </ChartFrame>
  )
}

export function StableMultiBarChart({ data, keys, xKey = 'category', title, badge, suffix = '%' }) {
  const rows = safeRows(data)
  const series = keys?.length ? keys : ['c0','c1','c2','c3']
  if (!rows.length) return <StableEmptyChart />
  const W = 760, H = 360, L = 76, R = 26, T = 40, B = 74
  const max = Math.max(...rows.flatMap(r => series.map(k => num(r[k]))), 100)
  const groupW = (W-L-R)/rows.length
  const bw = Math.min(18, groupW/(series.length+2))
  const y = v => H-B-(num(v)/max)*(H-T-B)
  return (
    <ChartFrame title={title} badge={badge} legend={series.map((k,i)=><span key={k}><i className={`series-${i}`}/>{String(k).toUpperCase()}</span>)}>
      <svg className="stable-svg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title || 'multi bar'}>
        {axisTicks(max).map(v => <g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} className="stable-grid"/><text x={L-12} y={y(v)+4} textAnchor="end" className="stable-tick">{fmt(v, suffix)}</text></g>)}
        {rows.map((r, i) => {
          const gx = L + i*groupW + groupW/2
          return <g key={r[xKey] || i}><text x={gx} y={H-32} textAnchor="middle" className="stable-label">{r[xKey]}</text>{series.map((k,j)=>{const v=num(r[k]); const x=gx-(series.length*bw)/2+j*bw+j*4; const h=H-B-y(v);return <motion.rect key={k} x={x} y={y(v)} width={bw} height={h} rx="7" className={`stable-series-bar series-${j}`} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: (i*series.length+j)*.04, duration: .7 }} style={{ transformOrigin: `${x+bw/2}px ${H-B}px` }} />})}</g>
        })}
      </svg>
    </ChartFrame>
  )
}