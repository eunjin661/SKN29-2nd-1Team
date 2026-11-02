import { fetchJson, RequestError } from './fetchJson'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_VERSION = 'live-observation-only-v6'
const CATEGORY_PREF_KEY = 'trendit:youtube-category-clicks'
const MAX_RESULTS = 50
const cacheKey = key => `yta:${CACHE_VERSION}:${API}:${key}`

export const VIDEO_CATEGORIES = [
  { key: 'all', label: '전체', shortLabel: '전체', icon: '✦', categoryIds: [0] },
  { key: 'entertainment', label: 'Entertainment', shortLabel: '엔터', icon: '🎬', categoryIds: [24, 17, 20, 1, 23] },
  { key: 'music', label: 'Music', shortLabel: '뮤직', icon: '🎧', categoryIds: [10] },
  { key: 'lifestyle', label: 'Lifestyle', shortLabel: '라이프', icon: '🌿', categoryIds: [19, 15, 2, 22, 26] },
  { key: 'education', label: '교육·과학기술', shortLabel: '교육', icon: '📚', categoryIds: [27, 28] },
  { key: 'news', label: 'News', shortLabel: '뉴스', icon: '📰', categoryIds: [25, 29] },
]

function readCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(key)) || 'null')
    if (!cached || typeof cached.time !== 'number' || cached.time > Date.now() || Date.now() - cached.time > CACHE_TTL_MS) return null
    return cached.data
  } catch { return null }
}

function writeCache(key, data) {
  try { localStorage.setItem(cacheKey(key), JSON.stringify({ time: Date.now(), data })) } catch { /* Storage is optional. */ }
}

export function readInitialVideoFeed() {
  const cached = readCache('feed')
  const valid = cached?.groups && typeof cached.groups === 'object' && !Array.isArray(cached.groups)
  const groups = valid ? Object.fromEntries(VIDEO_CATEGORIES.filter(category => Array.isArray(cached.groups[category.key])).map(category => [category.key, videoList(cached.groups[category.key])])) : {}
  return {
    key: null,
    groups,
    source: valid ? `${typeof cached.source === 'string' ? cached.source : '이전 관측'} · 브라우저 캐시` : '연결 확인 중',
    updatedAt: valid && typeof cached.updatedAt === 'string' ? cached.updatedAt : '',
    error: '',
  }
}

export function readCategoryPrefs() {
  try {
    const value = JSON.parse(localStorage.getItem(CATEGORY_PREF_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

export function bumpCategoryPref(key) {
  const prefs = readCategoryPrefs()
  prefs[key] = Number(prefs[key] || 0) + 1
  try { localStorage.setItem(CATEGORY_PREF_KEY, JSON.stringify(prefs)) } catch { /* Preferences are optional. */ }
  return prefs
}

function videoList(value) {
  if (!Array.isArray(value)) throw new RequestError('영상 피드 응답 형식을 확인할 수 없습니다.', 'response')
  return value.filter(video => video && (video.video_id || video.id || video.videoId)).map(video => ({ ...video, video_id: String(video.video_id || video.id || video.videoId) }))
}

export async function fetchVideoFeed(categoryKey, { signal, force = false } = {}) {
  const suffix = force ? `&refresh=true&_=${Date.now()}` : '&_=cache'
  let feed
  try {
    const payload = await fetchJson(`${API}/youtube/live/bulk?region_code=KR&max_results=${MAX_RESULTS}&order=relevance&include_predictions=false${suffix}`, { signal, timeoutMs: force ? 22000 : 9000 })
    if (!payload?.groups || !Array.isArray(payload.groups[categoryKey])) throw new RequestError('카테고리 피드가 없습니다.', 'response')
    const groups = Object.fromEntries(VIDEO_CATEGORIES.filter(category => Array.isArray(payload.groups[category.key])).map(category => [category.key, videoList(payload.groups[category.key])]))
    feed = { groups, source: payload.source_label || 'YouTube API 관측 데이터', updatedAt: payload.refreshed_at || new Date().toISOString(), error: payload.warning || '' }
  } catch (error) {
    if (signal?.aborted) throw error
    const category = VIDEO_CATEGORIES.find(value => value.key === categoryKey) || VIDEO_CATEGORIES[0]
    const limit = category.key === 'all' ? MAX_RESULTS : Math.max(6, Math.ceil(MAX_RESULTS / category.categoryIds.length))
    const payloads = await Promise.all(category.categoryIds.map(id => fetchJson(`${API}/youtube/trending?region_code=KR&max_results=${limit}&category_id=${id}&include_predictions=false${suffix}`, { signal, timeoutMs: force ? 18000 : 9000 })))
    const rows = payloads.flatMap(payload => videoList(Array.isArray(payload) ? payload : payload.items || payload.videos))
    const unique = [...new Map(rows.map(video => [String(video.video_id || video.id || video.videoId), { ...video, category_group: video.category_group || (category.key === 'all' ? undefined : category.label) }])).values()]
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, MAX_RESULTS)
    const source = unique[0]?.source
    feed = {
      groups: { [categoryKey]: unique },
      source: source === 'parquet_fallback' ? 'Parquet 백업 데이터' : source === 'static_fallback' ? '정적 백업 데이터' : 'YouTube API 관측 데이터',
      updatedAt: new Date().toISOString(),
      error: payloads.find(payload => payload.warning)?.warning || '',
    }
  }
  if (!signal?.aborted) writeCache('feed', feed)
  return feed
}
