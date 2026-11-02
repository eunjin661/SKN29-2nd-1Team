import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useVideoFeed from '../hooks/useVideoFeed'
import CountUp from '../components/CountUp'
import { VIDEO_CATEGORIES as CATEGORIES, readCategoryPrefs, bumpCategoryPref } from '../lib/videoFeed'
import '../styles/VideoPage.css'
import '../styles/PredictionPage.css'

const PAGE_SIZE = 24

const videoKey = (video) => String(video?.video_id || video?.id || video?.videoId || '')


const getBestThumbnail = (video) => {
  const id = videoKey(video)
  if (id) return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
  return video?.thumbnail || video?.thumbnail_fallback || ''
}

const handleThumbnailFallback = (event, video) => {
  const id = videoKey(video)
  const fallback = video?.thumbnail_fallback || (id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '')
  if (fallback && event.currentTarget.src !== fallback) {
    event.currentTarget.src = fallback
  }
}

const sortVideos = (videos = [], order = 'relevance') => {
  const unique = Array.from(new Map((videos || []).map(v => [videoKey(v), v]).filter(([id]) => id)).values())
  if (order === 'date') {
    return unique.sort((a, b) => String(b.publishedAt || b.published_at || '').localeCompare(String(a.publishedAt || a.published_at || '')))
  }
  if (order === 'viewCount') {
    return unique.sort((a, b) => Number(b.views || b.view_count || 0) - Number(a.views || a.view_count || 0))
  }
  return unique
}

const CATEGORY_FEED_TITLES = {
  entertainment: 'Entertainment 트렌딩',
  music: 'Music 트렌딩',
  lifestyle: 'Lifestyle 트렌딩',
  education: '교육·과학기술 트렌딩',
  news: 'News 트렌딩',
}

const CATEGORY_LABELS = CATEGORIES.reduce((acc, cur) => {
  cur.categoryIds.forEach(id => { acc[String(id)] = cur.label })
  return acc
}, {})

const formatNumber = (value) => {
  const n = Number(value || 0)
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  return n.toLocaleString()
}

const getCategoryLabel = (video) => {
  const id = String(video?.category_id ?? video?.categoryId ?? '0')
  return video?.category_group || video?.category || CATEGORY_LABELS[id] || '기타'
}

function AnimatedNumber({ value }) {
  return <CountUp value={Number(value || 0)} duration={500} />
}

function VideoCard({ video, active, onSelect }) {
  const [hover, setHover] = useState(false)
  const categoryLabel = getCategoryLabel(video)

  return (
    <button
      className={`nf-card ${active ? 'active' : ''}`}
      onClick={() => onSelect(video)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      type="button"
    >
      <div className="nf-thumb-wrap">
        {hover ? (
          <iframe
            className="nf-preview"
            src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${video.video_id}`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            loading="lazy"
          />
        ) : (
          <img className="nf-thumb" src={getBestThumbnail(video)} onError={(e) => handleThumbnailFallback(e, video)} alt={video.title} loading="lazy" />
        )}
        <span className="category-pill">{categoryLabel}</span>
      </div>
      <div className="nf-info">
        <strong>{video.title}</strong>
        <span>{video.channel || video.channel_title || 'YouTube'}</span>
        <p>조회수 <AnimatedNumber value={video.views} /></p>
      </div>
    </button>
  )
}


function VideoRow({ title, videos, selected, onSelect, loading }) {
  if (loading) {
    return (
      <section className="netflix-row-section">
        <div className="section-head"><div><p className="eyebrow">Category Feed</p><h2>{title}</h2></div></div>
        <div className="nf-row">{Array.from({ length: 8 }).map((_, idx) => <div className="nf-skeleton" key={idx} />)}</div>
      </section>
    )
  }

  if (!videos?.length) return null

  return (
    <section className="netflix-row-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Category Feed</p>
          <h2>{title}</h2>
        </div>
        <span>{videos.length} videos</span>
      </div>
      <div className="nf-row">
        {videos.map(video => (
          <VideoCard
            key={`${title}-${video.video_id}`}
            video={video}
            active={selected?.video_id === video.video_id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}

export default function VideoPage() {
  const [category, setCategory] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState(null)
  const [playingId, setPlayingId] = useState(null)
  const [categoryPrefs, setCategoryPrefs] = useState(readCategoryPrefs)
  const sortOrder = 'relevance'
  const { groups: categoryData, loading, refreshing, autoRefreshing, error,
    source: apiSource, updatedAt: lastUpdated, refresh } = useVideoFeed(category)

  const activeVideos = useMemo(() => sortVideos(categoryData[category] || [], sortOrder), [categoryData, category, sortOrder])
  const visibleActiveVideos = useMemo(() => activeVideos.slice(0, visibleCount), [activeVideos, visibleCount])
  const hasMoreActiveVideos = activeVideos.length > visibleCount
  const candidates = category === 'all' ? Object.values(categoryData).flat() : activeVideos
  const selected = candidates.find(video => videoKey(video) === selectedId) || activeVideos[0] || null
  const playing = Boolean(selected && playingId === videoKey(selected))
  const dataVersion = videoKey(selected)
  const setSelected = video => setSelectedId(videoKey(video))

  useEffect(() => {
    const handleScroll = () => {
      const top = Math.max(window.scrollY, document.body.scrollTop, document.documentElement.scrollTop)
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
      if (window.innerHeight + top >= height - 220) {
        setVisibleCount(previous => Math.min(previous + PAGE_SIZE, Math.max(activeVideos.length, PAGE_SIZE)))
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [activeVideos.length])


  const syncState = useMemo(() => {
    if (refreshing || autoRefreshing) {
      return { key: 'syncing', label: '최신화 중', icon: '🟡' }
    }
    const sourceText = String(apiSource || '')
    if (sourceText.includes('캐시') || sourceText.includes('fallback') || sourceText.includes('백업') || sourceText.includes('지연')) {
      return { key: 'cache', label: '캐시 표시', icon: '🔵' }
    }
    return { key: 'fresh', label: '최신 반영', icon: '🟢' }
  }, [refreshing, autoRefreshing, apiSource])

  const rows = useMemo(() => {
    // 전체 탭에서는 전체 인기 + 5개 카테고리 피드를 모두 보여줍니다.
    if (category === 'all') {
      return [
        { title: '전체 인기 트렌딩', videos: sortVideos(categoryData.all || [], sortOrder).slice(0, visibleCount) },
        ...CATEGORIES
          .filter(c => c.key !== 'all')
          .map(c => ({
            title: CATEGORY_FEED_TITLES[c.key] || `${c.label} 트렌딩`,
            videos: sortVideos(categoryData[c.key] || [], sortOrder).slice(0, visibleCount),
          })),
      ]
    }

    // 개별 카테고리 탭에서는 선택한 카테고리 피드만 보여줍니다.
    // 예: Entertainment 클릭 시 Entertainment 트렌딩만 표시.
    const current = CATEGORIES.find(c => c.key === category)
    return [{ title: CATEGORY_FEED_TITLES[category] || `${current?.label || '선택'} 트렌딩`, videos: visibleActiveVideos }]
  }, [category, visibleActiveVideos, categoryData, sortOrder, visibleCount])

  const topVideos = useMemo(() => {
    const source = category === 'all'
      ? Object.values(categoryData).flat()
      : activeVideos
    const unique = Array.from(new Map(source.map(v => [v.video_id, v])).values())
    return unique.sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, 8)
  }, [category, activeVideos, categoryData])

  const maxViews = Math.max(...topVideos.map(v => Number(v.views || 0)), 1)

  const orderedCategories = useMemo(() => {
    const prefs = categoryPrefs || {}
    const [all, ...rest] = CATEGORIES
    return [all, ...rest.sort((a, b) => Number(prefs[b.key] || 0) - Number(prefs[a.key] || 0))]
  }, [categoryPrefs])

  const handleCategoryChange = (key) => {
    setVisibleCount(PAGE_SIZE)
    setCategoryPrefs(bumpCategoryPref(key))
    setSelectedId(null)
    setPlayingId(null)
    setCategory(key)
  }

  if (loading && !selected) {
    return (
      <main className="video-page-redblue">
        <section className="video-hero-shell">
          <div className="hero-copy">
            <p className="eyebrow">Korea YouTube Trending</p>
            <h1>트렌딩 영상 관측</h1>
            <p>캐시와 YouTube Data API v3로 실시간 트렌딩 데이터를 빠르게 불러오는 중입니다.</p>
          </div>
          <div className="video-api-status">
            <span className="status-dot loading" />
            <strong>초기 데이터 로딩 중</strong>
            <small>YouTube 최신 동기화 준비</small>
          </div>
        </section>
        <section className="video-fast-skeleton">
          <div className="skeleton-player" />
          <div className="skeleton-side">
            <div />
            <div />
          </div>
        </section>
        <div className="nf-row skeleton-row">
          {Array.from({ length: 8 }).map((_, idx) => <div className="nf-skeleton" key={idx} />)}
        </div>
      </main>
    )
  }

  return (
    <motion.main className="video-page-redblue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <motion.section className="video-hero-shell" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
        <div className="hero-copy">
          <p className="eyebrow">Korea YouTube Trending</p>
          <h1>트렌딩 영상 관측</h1>
          <p>YouTube 영상의 조회수·좋아요·댓글 등 현재 관측 통계를 확인합니다. 최초 진입 기록이 없어 검증된 T0 예측은 적용하지 않습니다.</p>
        </div>
      </motion.section>


      <section className={`video-tiny-sync-toolbar ${syncState.key}`} aria-label="YouTube 데이터 동기화 상태">
        <span className={`tiny-sync-dot ${syncState.key}`} />
        <span className="tiny-sync-state">{syncState.icon} {syncState.label}</span>
        <span className="tiny-sync-text">
          {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '준비 중'}
        </span>
        <button type="button" onClick={() => refresh()} disabled={refreshing}>
          {refreshing ? '동기화 중' : '바로 갱신'}
        </button>
        <span className={`tiny-auto-pill ${autoRefreshing ? 'syncing' : ''}`}>{autoRefreshing ? '자동 동기화 중' : '20초 자동'}</span>
      </section>


      <AnimatePresence>
        {error && (
          <motion.div role="alert" className="video-notice" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>


      <motion.section key={`featured-${dataVersion}`} className="featured-layout" initial={{ opacity: 0.72, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
        <div className="main-player glass-panel">
          {selected ? (
            <>
              <div className="player-frame">
                {playing ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${selected.video_id}?autoplay=1&playsinline=1`}
                    title={selected.title}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <button className="poster-button" type="button" onClick={() => setPlayingId(videoKey(selected))}>
                    <img src={getBestThumbnail(selected)} onError={(e) => handleThumbnailFallback(e, selected)} alt={selected.title} loading="lazy" />
                    <span className="play-orb">▶</span>
                  </button>
                )}
              </div>
              <div className="selected-meta">
                <div className="selected-badges">
                  <span className="mini-badge">선택 영상</span>
                  <span className="mini-badge category-selected">{getCategoryLabel(selected)}</span>
                </div>
                <h2>{selected.title}</h2>
                <p>{selected.channel || selected.channel_title || 'YouTube'}</p>
                <div className="metric-row">
                  <div><span>조회수</span><strong><AnimatedNumber value={selected.views} /></strong></div>
                  <div><span>좋아요</span><strong><AnimatedNumber value={selected.likes} /></strong></div>
                  <div><span>댓글</span><strong><AnimatedNumber value={selected.comments} /></strong></div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">선택한 조건에 해당하는 영상이 없습니다.</div>
          )}
        </div>

        {selected && <div className="side-stack">
          <section className="ai-panel glass-panel">
            <div className="section-head compact"><div><p className="eyebrow">현재 관측 통계</p><h3>선택 영상의 공개 수치</h3></div></div>
            <p className="ai-copy">조회수 {formatNumber(selected?.views)} · 좋아요 {formatNumber(selected?.likes)} · 댓글 {formatNumber(selected?.comments)}</p>
            <p className="ai-auto-insight">집계 시점의 누적 수치입니다. 최초 차트 진입 당시 수치나 미래 증가량을 의미하지 않습니다.</p>
          </section>
          <section className="ai-panel glass-panel">
            <div className="section-head compact"><h3>T0 예측에 필요한 기록</h3></div>
            <p className="ai-auto-insight">최초 진입 시각·순위·조회수·댓글을 따로 관측하고 저장해야 합니다. 화면 순서를 최초 진입 순위로 대신하지 않습니다.</p>
            <a className="verified-link" href="/analysis/predict">최초 관측값을 직접 입력해 예측하기 →</a>
          </section>
        </div>}
      </motion.section>

      <motion.section
        className="category-panel category-panel-below category-panel-under-video"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="category-tabs clean-category-tabs">
          {orderedCategories.map(c => (
            <button
              type="button"
              key={c.key}
              className={category === c.key ? 'active' : ''}
              onClick={() => handleCategoryChange(c.key)}
            >
              <span className="category-icon">{c.icon}</span>
              <span className="category-text">
                <strong>{c.shortLabel || c.label}</strong>
              </span>
            </button>
          ))}
        </div>
      </motion.section>

      {rows.map(row => (
        <VideoRow
          key={row.title}
          title={row.title}
          videos={row.videos}
          selected={selected}
          loading={loading && row.title.includes('전체')}
          onSelect={(v) => { setSelected(v); setPlayingId(null) }}
        />
      ))}

      {hasMoreActiveVideos && (
        <section className="netflix-row-section">
          <button type="button" className="video-load-more" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
            더보기
          </button>
        </section>
      )}

      <section className="rank-chart glass-panel">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Trending Views Ranking</p>
            <h3>조회수 TOP 그래프</h3>
          </div>
        </div>
        <div className="bar-list">
          {topVideos.map((v, i) => (
            <button type="button" className="bar-item" key={v.video_id} onClick={() => { setSelected(v); setPlayingId(null) }}>
              <span>{i + 1}</span>
              <strong>{v.title}</strong>
              <small>{getCategoryLabel(v)}</small>
              <div className="bar-track"><em style={{ width: `${(Number(v.views || 0) / maxViews) * 100}%` }} /></div>
              <b>{formatNumber(v.views)}</b>
            </button>
          ))}
        </div>
      </section>
    </motion.main>
  )
}
