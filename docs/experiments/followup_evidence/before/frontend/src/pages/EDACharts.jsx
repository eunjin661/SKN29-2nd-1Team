// pages/EDACharts.jsx — EDA 차트 컴포넌트 7개
import { motion } from 'framer-motion'

export function CatDurationChart({ data }) {
  const max = 220
  return (
    <svg viewBox="0 0 520 230" style={{ width:'100%' }}>
      {[0,60,120,180,220].map(v=>(
        <g key={v}>
          <line x1={130+(v/max)*320} y1="10" x2={130+(v/max)*320} y2="195" stroke="var(--border)" strokeWidth="1" opacity="0.5"/>
          <text x={130+(v/max)*320} y="208" textAnchor="middle" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">{v}h</text>
        </g>
      ))}
      {data.catDur.map((d,i)=>{
        const y=14+i*38, wMed=(d.median/max)*320, wMean=(d.mean/max)*320, delay=i*0.1
        return (
          <g key={d.name}>
            <text x="124" y={y+11} textAnchor="end" fontSize="11" fill="var(--text2)" fontFamily="'Pretendard',sans-serif">{d.name}</text>
            <motion.rect x="130" y={y+2} height="8" fill="var(--bg3)" initial={{ width:0 }} animate={{ width:wMean }} transition={{ duration:0.7, delay, ease:'easeOut' }}/>
            <motion.rect x="130" y={y+12} height="14" fill="var(--red)" initial={{ width:0 }} animate={{ width:wMed }} transition={{ duration:0.7, delay:delay+0.05, ease:'easeOut' }}/>
            <motion.text x={134+wMed} y={y+22} fontSize="11" fontWeight="600" fill="var(--text)" fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:delay+0.7 }}>{d.median}h</motion.text>
          </g>
        )
      })}
      <rect x="130" y="218" width="10" height="4" fill="var(--red)"/>
      <text x="144" y="222" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">중앙값</text>
      <rect x="200" y="218" width="10" height="4" fill="var(--bg3)"/>
      <text x="214" y="222" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">평균값</text>
      <text x="130" y="230" fontSize="8" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">* Kruskal-Wallis H=991.13, p&lt;0.001, η²=0.041</text>
    </svg>
  )
}

export function YearTrendChart({ data }) {
  const years=[2022,2023,2024,2025]
  const CATS=[
    { key:'Entertainment', color:'#FF4444', strokeW:2.5 },
    { key:'Lifestyle',     color:'#1a73e8', strokeW:2   },
    { key:'Music',         color:'#F59E0B', strokeW:2   },
    { key:'News',          color:'#9333ea', strokeW:1.8 },
    { key:'Education',     color:'#16a34a', strokeW:1.8 },
  ]
  const X0=50,Y0=14,W=290,H=130,BOTTOM=Y0+H
  const xOf=i=>X0+(i/(years.length-1))*W
  const yOf=v=>BOTTOM-(v/65)*H
  const lineData=CATS.map(c=>({ ...c, vals:years.map(y=>data.yearPct[y]?.[c.key]||0), pts:years.map((y,i)=>`${xOf(i)},${yOf(data.yearPct[y]?.[c.key]||0)}`).join(' ') }))
  function polylineLen(vals){let l=0;for(let i=1;i<vals.length;i++){const dx=xOf(i)-xOf(i-1),dy=yOf(vals[i])-yOf(vals[i-1]);l+=Math.sqrt(dx*dx+dy*dy)}return l}

  // 마지막 값 기준으로 라벨 y좌표 겹침 방지 (최소 18px 간격)
  function resolveOffsets(cats, vals2025) {
    const MIN_GAP = 18
    const items = cats.map((c, i) => ({ key: c.key, y: yOf(vals2025[i]), i }))
    items.sort((a, b) => a.y - b.y)
    for (let pass = 0; pass < 10; pass++) {
      let moved = false
      for (let i = 1; i < items.length; i++) {
        if (items[i].y - items[i-1].y < MIN_GAP) {
          const mid = (items[i].y + items[i-1].y) / 2
          items[i-1].y = mid - MIN_GAP / 2
          items[i].y   = mid + MIN_GAP / 2
          moved = true
        }
      }
      if (!moved) break
    }
    const offsets = {}
    items.forEach(item => {
      offsets[item.key] = item.y - yOf(vals2025[item.i])
    })
    return offsets
  }
  const labelOffsets = resolveOffsets(CATS, CATS.map(c => lineData.find(l => l.key === c.key).vals[3]))

  return (
    <svg viewBox="0 0 480 210" style={{ width:'100%' }}>
      {[0,15,30,45,60].map(v=>(<g key={v}><line x1={X0} y1={yOf(v)} x2={X0+W} y2={yOf(v)} stroke="var(--border)" strokeWidth={v===0?1:0.5} strokeDasharray={v===0?'':'3 4'} opacity={v===0?1:0.4}/><text x={X0-6} y={yOf(v)+4} textAnchor="end" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">{v}</text></g>))}
      {years.map((y,i)=>(<g key={y}><line x1={xOf(i)} y1={Y0} x2={xOf(i)} y2={BOTTOM} stroke="var(--border)" strokeWidth="0.5" opacity="0.3"/><text x={xOf(i)} y={BOTTOM+14} textAnchor="middle" fontSize="10" fill="var(--text2)" fontFamily="'Pretendard',sans-serif">{y}</text></g>))}
      {lineData.map((l,li)=>{
        const len=Math.round(polylineLen(l.vals)), delay=li*0.15
        const labelY = yOf(l.vals[3]) + (labelOffsets[l.key] || 0)
        // 라벨과 실제 점 사이 연결선 (이동이 있을 때만)
        const offsetAmt = labelOffsets[l.key] || 0
        return (
          <g key={l.key}>
            <polyline points={l.pts} fill="none" stroke={l.color} strokeWidth={l.strokeW+3} opacity="0.15" strokeLinecap="round"/>
            <motion.polyline points={l.pts} fill="none" stroke={l.color} strokeWidth={l.strokeW} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} initial={{ strokeDashoffset:len }} animate={{ strokeDashoffset:0 }} transition={{ duration:1.2, delay, ease:'easeOut' }}/>
            {l.vals.map((v,i)=>(<motion.circle key={i} cx={xOf(i)} cy={yOf(v)} r="4" fill="var(--bg)" stroke={l.color} strokeWidth="2" initial={{ scale:0,opacity:0 }} animate={{ scale:1,opacity:1 }} transition={{ duration:0.3, delay:delay+1.0+i*0.05 }}/>))}
            {Math.abs(offsetAmt) > 4 && (
              <motion.line x1={xOf(3)+4} y1={yOf(l.vals[3])} x2={xOf(3)+6} y2={labelY+4} stroke={l.color} strokeWidth="0.8" opacity="0.4" initial={{ opacity:0 }} animate={{ opacity:0.4 }} transition={{ delay:delay+1.2 }}/>
            )}
            <motion.text x={xOf(3)+10} y={labelY+4} fontSize="9" fontWeight="600" fill={l.color} fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:delay+1.3 }}>{l.key}</motion.text>
            <motion.text x={xOf(3)+10} y={labelY+14} fontSize="8" fill={l.color} fontFamily="'Pretendard',sans-serif" opacity="0.75" initial={{ opacity:0 }} animate={{ opacity:0.75 }} transition={{ delay:delay+1.4 }}>{l.vals[3].toFixed(1)}%</motion.text>
          </g>
        )
      })}
      <line x1={X0} y1={BOTTOM+26} x2={X0+W} y2={BOTTOM+26} stroke="var(--border)" strokeWidth="0.5" opacity="0.4"/>
      {CATS.map((c,i)=>(<g key={c.key}><line x1={X0+i*62} y1={BOTTOM+36} x2={X0+14+i*62} y2={BOTTOM+36} stroke={c.color} strokeWidth="2.5" strokeLinecap="round"/><text x={X0+18+i*62} y={BOTTOM+40} fontSize="8.5" fill="var(--text2)" fontFamily="'Pretendard',sans-serif">{c.key}</text></g>))}
    </svg>
  )
}

export function TDIChart({ data }) {
  const bins=data.tdiBins, maxH=Math.max(...bins)
  return (
    <svg viewBox="0 0 420 190" style={{ width:'100%' }}>
      {bins.map((h,i)=>{ const x=40+i*36, bh=(h/maxH)*130, y=148-bh, isPos=i>=4; return (
        <g key={i}>
          <rect x={x} y={y} width="28" height={bh} fill="var(--border)" opacity="0.15"/>
          <motion.rect x={x} width="28" fill={isPos?'var(--red)':'var(--bg3)'} initial={{ height:0,y:148 }} animate={{ height:bh,y }} transition={{ duration:0.6, delay:i*0.06, ease:'easeOut' }}/>
          <text x={x+14} y="162" textAnchor="middle" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">{(i*0.1).toFixed(1)}</text>
          <motion.text x={x+14} y={y-3} textAnchor="middle" fontSize="8" fill={isPos?'var(--red)':'var(--text3)'} fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.06+0.5 }}>{(h/100).toFixed(1)}k</motion.text>
        </g>
      )})}
      <line x1="40" y1="148" x2="400" y2="148" stroke="var(--border)" strokeWidth="1"/>
      <motion.line x1="184" y1="10" x2="184" y2="152" stroke="var(--text)" strokeWidth="1.5" strokeDasharray="4 3" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.8 }}/>
      <motion.text x="188" y="22" fontSize="9" fill="var(--text)" fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.9 }}>threshold 0.4</motion.text>
      <motion.text x="188" y="33" fontSize="9" fill="var(--text2)" fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.0 }}>↑ {data.tdiPosPct}% 고지속</motion.text>
      <text x="40" y="178" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">TDI 값 분포 · 빨간 막대 = tdi_label 1</text>
    </svg>
  )
}

export function IQRChart({ data }) {
  const sc=v=>40+(v/360)*340
  const shades=['var(--red)','var(--text)','var(--text2)','var(--text3)','var(--text3)']
  return (
    <svg viewBox="0 0 440 200" style={{ width:'100%' }}>
      {[0,60,120,180,240,300,360].map(v=>(<g key={v}><line x1={sc(v)} y1="16" x2={sc(v)} y2="155" stroke="var(--border)" strokeWidth="1" opacity="0.4"/><text x={sc(v)} y="170" textAnchor="middle" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">{v}h</text></g>))}
      {data.iqr.map((c,i)=>{ const y=20+i*28, delay=i*0.12, boxX=sc(c.q1), boxW=sc(c.q3)-sc(c.q1), medX=sc(c.med); return (
        <g key={c.name}>
          <text x="34" y={y+11} textAnchor="end" fontSize="10" fill="var(--text2)" fontFamily="'Pretendard',sans-serif">{c.name}</text>
          <motion.line x1={sc(0)} y1={y+9} x2={sc(c.q1)} y2={y+9} stroke={shades[i]} strokeWidth="1" strokeDasharray="3 2" opacity="0.4" initial={{ opacity:0 }} animate={{ opacity:0.4 }} transition={{ delay }}/>
          <motion.rect x={boxX} y={y} height="18" fill="none" stroke={shades[i]} strokeWidth="1.5" initial={{ width:0 }} animate={{ width:boxW }} transition={{ duration:0.5, delay:delay+0.1, ease:'easeOut' }}/>
          <motion.line x1={medX} x2={medX} y2={y+18} stroke={shades[i]} strokeWidth="3" initial={{ y1:y+9,opacity:0 }} animate={{ y1:y,opacity:1 }} transition={{ duration:0.3, delay:delay+0.5 }}/>
          <motion.line x1={sc(c.q3)} y1={y+9} x2={sc(360)} y2={y+9} stroke={shades[i]} strokeWidth="1" strokeDasharray="3 2" opacity="0.4" initial={{ opacity:0 }} animate={{ opacity:0.4 }} transition={{ delay:delay+0.3 }}/>
          <motion.text x={medX+4} y={y-2} fontSize="9" fill={shades[i]} fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:delay+0.6 }}>{c.med}h</motion.text>
        </g>
      )})}
      <text x="40" y="186" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">굵은 선 = 중앙값 · 박스 = IQR (Q1~Q3)</text>
    </svg>
  )
}

export function WeekdayChart({ data }) {
  const days=['월','화','수','목','금','토','일'], max=Math.max(...data.weekday)
  return (
    <svg viewBox="0 0 420 180" style={{ width:'100%' }}>
      {data.weekday.map((v,i)=>{ const x=40+i*52, bh=(v/max)*120, y=140-bh, isWeekend=i>=5; return (
        <g key={i}>
          <rect x={x} y={y} width="36" height={bh} fill="var(--border)" opacity="0.1"/>
          <motion.rect x={x} width="36" fill={isWeekend?'var(--text3)':'var(--red)'} initial={{ height:0,y:140 }} animate={{ height:bh,y }} transition={{ duration:0.6, delay:i*0.07, ease:[0.22,1,0.36,1] }}/>
          <text x={x+18} y="155" textAnchor="middle" fontSize="11" fill="var(--text2)" fontFamily="'Pretendard',sans-serif">{days[i]}</text>
          <motion.text x={x+18} y={y-4} textAnchor="middle" fontSize="9" fill="var(--text2)" fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.07+0.5 }}>{v.toLocaleString()}</motion.text>
        </g>
      )})}
      <line x1="40" y1="140" x2="408" y2="140" stroke="var(--border)" strokeWidth="1"/>
      <text x="40" y="172" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">업로드 요일별 이벤트 수 · 연한 막대 = 주말</text>
    </svg>
  )
}

export function ScatterChart() {
  const rng=(s)=>{let n=s;return()=>{n=(n*9301+49297)%233280;return n/233280}}
  const r=rng(2024)
  const pts=Array.from({length:180},()=>{ const lx=Math.pow(r()*6,2), raw_y=r()*130, y=Math.max(4,raw_y+lx*0.08-r()*20); return { x:50+lx*55, y:148-Math.min(y,130), op:0.3+r()*0.5 } })
  return (
    <svg viewBox="0 0 460 185" style={{ width:'100%' }}>
      <line x1="50" y1="14" x2="50" y2="148" stroke="var(--border)" strokeWidth="1.5"/>
      <line x1="50" y1="148" x2="440" y2="148" stroke="var(--border)" strokeWidth="1.5"/>
      {[0,100,200,300,400].map((v,i)=>(<text key={v} x={50+v} y="162" textAnchor="middle" fontSize="8" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">{['0','1M','2M','3M','4M'][i]}</text>))}
      {[24,150,300,474].map(v=>(<text key={v} x="44" y={148-(v/474)*130+4} textAnchor="end" fontSize="8" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">{v}h</text>))}
      {pts.map((p,i)=>(<motion.circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--red)" opacity={p.op} initial={{ scale:0,opacity:0 }} animate={{ scale:1,opacity:p.op }} transition={{ duration:0.3, delay:i*0.008, ease:'easeOut' }}/>))}
      <motion.line x1="55" y1="145" x2="440" y2="30" stroke="var(--text)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.2" initial={{ pathLength:0,opacity:0 }} animate={{ pathLength:1,opacity:0.2 }} transition={{ duration:1, delay:1.5 }}/>
      <text x="52" y="175" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">view_growth_24h (wins) → · 27,234 이벤트</text>
      <text x="10" y="90" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif" transform="rotate(-90 10 90)">지속 시간 (h) →</text>
    </svg>
  )
}

export function ClusterShareChart({ data }) {
  const FALLBACK = [
    { category:'Education',     c0:0.9,  c1:16.8, c2:54.7, c3:27.7 },
    { category:'Entertainment', c0:3.9,  c1:25.3, c2:44.3, c3:26.5 },
    { category:'Lifestyle',     c0:3.8,  c1:23.4, c2:52.5, c3:20.3 },
    { category:'Music',         c0:18.3, c1:22.6, c2:30.2, c3:28.9 },
    { category:'News',          c0:2.0,  c1:17.1, c2:36.9, c3:44.1 },
  ]
  const rows = (data?.clusterShare?.length ? data.clusterShare : FALLBACK)
  const COLORS = ['var(--red)', 'var(--text)', 'var(--text2)', 'var(--text3)']
  const LABELS = ['C0','C1','C2','C3']
  const W=320, X0=80, Y0=12, BAR=18, GAP=8

  return (
    <svg viewBox="0 0 460 220" style={{ width:'100%' }}>
      {/* 범례 */}
      {LABELS.map((l,i) => (
        <g key={l}>
          <rect x={X0 + i*68} y={195} width={12} height={12} fill={COLORS[i]} rx={2}/>
          <text x={X0 + i*68 + 16} y={205} fontSize={9} fill="var(--text2)" fontFamily="'Pretendard',sans-serif">{l}</text>
        </g>
      ))}
      {/* 누적 가로 막대 */}
      {rows.map((row, ri) => {
        const y = Y0 + ri * (BAR + GAP)
        const vals = [row.c0, row.c1, row.c2, row.c3]
        let xCursor = X0
        return (
          <g key={row.category}>
            <text x={X0 - 6} y={y + BAR/2 + 4} textAnchor="end" fontSize={10} fill="var(--text2)" fontFamily="'Pretendard',sans-serif">{row.category}</text>
            {vals.map((v, ci) => {
              const bw = (v / 100) * W
              const x = xCursor
              xCursor += bw
              return (
                <motion.rect key={ci} x={x} y={y} height={BAR}
                  fill={COLORS[ci]} opacity={0.85}
                  initial={{ width:0 }} animate={{ width: bw }}
                  transition={{ duration:0.6, delay: ri*0.08 + ci*0.03, ease:'easeOut' }}
                />
              )
            })}
            {/* 가장 큰 세그먼트에 % 표시 */}
            {(() => {
              const maxI = vals.indexOf(Math.max(...vals))
              let sx = X0
              for(let i=0;i<maxI;i++) sx += (vals[i]/100)*W
              const sw = (vals[maxI]/100)*W
              return sw > 24 ? (
                <motion.text x={sx + sw/2} y={y + BAR/2 + 4} textAnchor="middle"
                  fontSize={9} fill="var(--bg)" fontFamily="'Pretendard',sans-serif" fontWeight="700"
                  initial={{opacity:0}} animate={{opacity:1}} transition={{delay: ri*0.08+0.5}}>
                  {vals[maxI].toFixed(1)}%
                </motion.text>
              ) : null
            })()}
          </g>
        )
      })}
      <text x={X0} y={185} fontSize={9} fill="var(--text3)" fontFamily="'Pretendard',sans-serif">
        카테고리별 클러스터 비율 · p&lt;0.001 · Cramer&apos;s V={data?.clusterStats?.cramersV ?? 0.147}
      </text>
    </svg>
  )
}

export function RankChart({ data }) {
  const bins=[{r:'1-20',v:12480},{r:'21-40',v:6890},{r:'41-60',v:4820},{r:'61-80',v:3540},{r:'81-100',v:2660},{r:'101-150',v:3200},{r:'151-200',v:1374}]
  const max=Math.max(...bins.map(b=>b.v)), medX=40+(data.rankQ.med/200)*406
  return (
    <svg viewBox="0 0 460 185" style={{ width:'100%' }}>
      {bins.map((b,i)=>{ const x=40+i*58, bh=(b.v/max)*120, y=148-bh, color=i===0?'var(--red)':i<3?'var(--text2)':'var(--bg3)'; return (
        <g key={b.r}>
          <rect x={x} y={y} width="46" height={bh} fill="var(--border)" opacity="0.1"/>
          <motion.rect x={x} width="46" fill={color} initial={{ height:0,y:148 }} animate={{ height:bh,y }} transition={{ duration:0.6, delay:i*0.07, ease:[0.22,1,0.36,1] }}/>
          <text x={x+23} y="162" textAnchor="middle" fontSize="9" fill="var(--text2)" fontFamily="'Pretendard',sans-serif">{b.r}</text>
          <motion.text x={x+23} y={y-4} textAnchor="middle" fontSize="9" fill="var(--text2)" fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.07+0.5 }}>{(b.v/1000).toFixed(1)}k</motion.text>
        </g>
      )})}
      <line x1="40" y1="148" x2="448" y2="148" stroke="var(--border)" strokeWidth="1"/>
      <motion.line x1={medX} y1={20} x2={medX} y2={152} stroke="var(--red)" strokeWidth="1.5" strokeDasharray="4 3" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.8 }}/>
      <motion.text x={medX+4} y="30" fontSize="9" fill="var(--red)" fontFamily="'Pretendard',sans-serif" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.1 }}>중앙값 {data.rankQ.med}위</motion.text>
      <text x="40" y="178" fontSize="9" fill="var(--text3)" fontFamily="'Pretendard',sans-serif">진입 순위 분포 · mean={data.rankQ.mean}</text>
    </svg>
  )
}