// pages/EDAPage.jsx — Part 1 EDA 탐색적 데이터 분석
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useEDA, API } from '../hooks/useEDA'
import { fadeUp, fadeUpStagger } from '../animations/variants'
import '../styles/EDAPage.css'
import CountUp  from '../components/CountUp'
import Skeleton from '../components/Skeleton'
import TabSectionLayout from '../components/TabSectionLayout'
import { makeEDASections } from './EDAsections'

export default function EDAPage({ onBack }) {
  const { data, loading, error, retry } = useEDA()
  const [active, setActive] = useState(0)
  const SECTIONS = makeEDASections(data)
  const sec = SECTIONS[active]

  // 모바일 탭 드롭다운
  const [dropOpen, setDropOpen] = useState(false)

  const handleTabSelect = useCallback((i) => {
    setActive(i)
    setDropOpen(false)
  }, [])

  return (
    <div className="yta-app-inner">
      {/* 뒤로가기 */}
      <motion.button className="back-btn" onClick={onBack} whileHover={{ x: -3 }} transition={{ duration: 0.2 }}>
        ← 목록으로
      </motion.button>

      {/* 헤더 */}
      <motion.div className="part-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
        <motion.span className="part-page-num" variants={fadeUp}>Part 1</motion.span>
        <motion.h1 className="part-page-title" variants={fadeUp}>EDA — 탐색적 데이터 분석</motion.h1>
        <motion.p className="part-page-subtitle" variants={fadeUp}>
          video_trending_events_analysis.parquet · 34,964 이벤트 · 2022.07–2025.06
        </motion.p>

        {/* API 상태 뱃지 */}
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading && (
            <div className="api-status api-status--loading">
              <span className="api-status-dot"/><span>API 연결 중…</span>
            </div>
          )}
          {!loading && !error && (
            <div className="api-status api-status--ok">
              <span className="api-status-dot"/><span>API 연결 성공 · {API}</span>
            </div>
          )}
          {!loading && error && (
            <>
              <div className="api-status api-status--fail">
                <span className="api-status-dot"/><span>API 연결 실패 · 로컬 데이터 사용 중</span>
              </div>
              <motion.button
                onClick={retry}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text2)', cursor: 'pointer',
                }}
                whileHover={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                whileTap={{ scale: 0.96 }}
              >
                재시도
              </motion.button>
            </>
          )}
        </motion.div>

        {/* 요약 수치 */}
        <motion.div className="eda-summary-row" variants={fadeUpStagger}>
          {[
            ['총 이벤트',  data.summary?.total?.toLocaleString() ?? '34,964'],
            ['카테고리',   `${data.summary?.categories ?? 5}그룹`],
            ['평균 지속',  `${data.summary?.avgDuration ?? 144}h`],
            ['TDI ≥ 0.4', `${data.summary?.tdiPos ?? 34.5}%`],
            ['24h 관측',   `${data.summary?.obs24h ?? 78.0}%`],
          ].map(([l, v]) => (
            <motion.div key={l} className="eda-summary-item" variants={fadeUp}>
              <span className="eda-summary-label">{l}</span>
              <span className="eda-summary-val">{loading ? '…' : <CountUp value={v}/>}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* 스켈레톤 */}
      {loading && (
        <motion.div className="eda-skeleton-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="eda-skeleton-tabs">
            {[...Array(7)].map((_, i) => <Skeleton key={i} w="90px" h="52px" r={8}/>)}
          </div>
          <div className="eda-skeleton-body">
            <div className="eda-skeleton-chart">
              <Skeleton w="60%" h={14} r={4}/>
              <div style={{ marginTop: 20 }}>
                {[80, 65, 50, 40, 30].map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Skeleton w="80px" h={10} r={4}/>
                    <Skeleton w={`${w}%`} h={18} r={4}/>
                    <Skeleton w="36px" h={10} r={4}/>
                  </div>
                ))}
              </div>
            </div>
            <div className="eda-skeleton-desc">
              <Skeleton w="60px" h={22} r={100}/>
              <Skeleton w="100%" h={20} r={4}/>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Skeleton w="20px" h={20} r={50}/>
                  <Skeleton w="100%" h={14} r={4}/>
                </div>
              ))}
              <Skeleton w="100%" h={48} r={6}/>
            </div>
          </div>
        </motion.div>
      )}

      {!loading && (
        <>
          {/* 모바일 드롭다운 탭 (md 미만에서만 표시) */}
          <div className="eda-tab-mobile" style={{ display: 'none' }}>
            <button
              className="eda-tab-mobile-trigger"
              onClick={() => setDropOpen(o => !o)}
              aria-expanded={dropOpen}
            >
              <span className="eda-tab-tag">{sec.tag}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{sec.shortTitle}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </button>
            {dropOpen && (
              <div className="eda-tab-mobile-menu">
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.id}
                    className={`eda-tab-mobile-item ${active === i ? 'on' : ''}`}
                    onClick={() => handleTabSelect(i)}
                  >
                    <span className="eda-tab-tag">{s.tag}</span>
                    <span>{s.shortTitle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 데스크톱 탭 + 공통 레이아웃 */}
          <TabSectionLayout
            sections={SECTIONS}
            active={active}
            setActive={setActive}
          />
        </>
      )}
    </div>
  )
}