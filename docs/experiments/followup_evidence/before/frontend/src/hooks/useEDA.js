import useJsonResource from './useJsonResource'

export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DEFAULT_API_EDA = {
  ok: true,
  raw_snapshots: 872191,
  trend_events: 34964,
  unique_videos: 17884,
  median_duration_h: 108,
  category_groups: 5,
  period: '2022-2025',
  category_summary: [
    { category: 'Education', events: 7200, median_duration_h: 192 },
    { category: 'Lifestyle', events: 6900, median_duration_h: 192 },
    { category: 'Entertainment', events: 9800, median_duration_h: 96 },
    { category: 'Music', events: 8200, median_duration_h: 78 },
    { category: 'News', events: 2864, median_duration_h: 66 },
  ],
  clusterShare: [
    { category: 'Education', c0: 0.9, c1: 16.8, c2: 54.7, c3: 27.7 },
    { category: 'Entertainment', c0: 3.9, c1: 25.3, c2: 44.3, c3: 26.5 },
    { category: 'Lifestyle', c0: 3.8, c1: 23.4, c2: 52.5, c3: 20.3 },
    { category: 'Music', c0: 18.3, c1: 22.6, c2: 30.2, c3: 28.9 },
    { category: 'News', c0: 2.0, c1: 17.1, c2: 36.9, c3: 44.1 },
  ],
  clusterLabels: {
    0: 'C0 Music / High engagement',
    1: 'C1 Fast response',
    2: 'C2 Delayed / Same-day exit',
    3: 'C3 Slow entry / Long duration',
  },
  clusterStats: { chi2: 1769.2, p: '<0.001', dof: 12, cramersV: 0.147 },
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mergeCategorySummary(apiRows = []) {
  const originalOrder = ['Education', 'Lifestyle', 'Entertainment', 'Music', 'News']
  const defaults = {
    Education: { events: 7200, median: 192, mean: 174 },
    Lifestyle: { events: 6900, median: 192, mean: 176 },
    Entertainment: { events: 9800, median: 96, mean: 123 },
    Music: { events: 8200, median: 78, mean: 97 },
    News: { events: 2864, median: 66, mean: 80 },
  }

  const fromApi = Object.fromEntries((apiRows || []).map((x) => {
    const name = x.category || x.name
    return [name, {
      events: toNumber(x.events, defaults[name]?.events || 0),
      median: toNumber(x.median_duration_h ?? x.medianDuration ?? x.median, defaults[name]?.median || 0),
      mean: toNumber(x.mean_duration_h ?? x.meanDuration ?? x.mean, NaN),
    }]
  }))

  return originalOrder.map((name) => {
    const row = { ...defaults[name], ...(fromApi[name] || {}) }
    const mean = Number.isFinite(row.mean) ? row.mean : Math.round(row.median * 1.18)
    return { name, events: row.events, median: row.median, mean }
  })
}

function normalizeBackendEDA(raw) {
  const apiData = { ...DEFAULT_API_EDA, ...(raw || {}) }
  const catDur = mergeCategorySummary(apiData.category_summary || [])
  const totalEvents = toNumber(apiData.trend_events ?? apiData.summary?.trendEvents, catDur.reduce((s, x) => s + x.events, 0))
  const categoryCount = toNumber(apiData.category_groups ?? apiData.summary?.categories, 5)
  const avgDuration = Math.round(catDur.reduce((s, x) => s + x.median, 0) / Math.max(catDur.length, 1))
  const tdiPos = 34.5

  // EDACharts.jsx가 기대하는 구조: yearPct[2022].Entertainment 형태.
  const yearPct = {
    2022: { Entertainment: 58.0, Lifestyle: 21.2, Music: 15.1, News: 3.0, Education: 2.7 },
    2023: { Entertainment: 55.0, Lifestyle: 22.5, Music: 16.0, News: 4.0, Education: 2.5 },
    2024: { Entertainment: 58.3, Lifestyle: 25.5, Music: 13.2, News: 1.8, Education: 1.2 },
    2025: { Entertainment: 52.6, Lifestyle: 30.6, Music: 14.8, News: 0.9, Education: 1.1 },
  }

  return {
    catDur,
    catCount: catDur.map((x) => ({ name: x.name, value: x.events })),
    yearPct,
    // EDACharts.jsx가 숫자 배열을 기대하므로 객체 배열이 아니라 숫자 배열로 제공.
    tdiBins: [10910, 7170, 4830, 6640, 5420, 3470, 2590, 1760, 1230, 944],
    tdiPosPct: tdiPos,
    iqr: [
      { name: 'Education', q1: 30, med: 192, q3: 300 },
      { name: 'Lifestyle', q1: 42, med: 192, q3: 300 },
      { name: 'Entertainment', q1: 24, med: 96, q3: 180 },
      { name: 'Music', q1: 18, med: 78, q3: 156 },
      { name: 'News', q1: 18, med: 66, q3: 180 },
    ],
    weekday: [5180, 5250, 5220, 5160, 5890, 4310, 3954],
    rankQ: { q1: 18, med: 43, q3: 91, mean: 63 },
    has24h: { obs: Math.round(totalEvents * 0.78), not_obs: Math.round(totalEvents * 0.22) },
    summary: {
      total: totalEvents,
      categories: categoryCount,
      avgDuration,
      tdiPos,
      obs24h: 78.0,
      period: apiData.period || apiData.summary?.period || '2022-2025',
    },
    clusterShare: apiData.clusterShare || DEFAULT_API_EDA.clusterShare,
    clusterLabels: apiData.clusterLabels || DEFAULT_API_EDA.clusterLabels,
    clusterStats: apiData.clusterStats || DEFAULT_API_EDA.clusterStats,
  }
}

export function useEDA() {
  const resource = useJsonResource(`${API}/eda/summary`, {
    timeoutMs: 2500,
    normalize: normalizeBackendEDA,
  })
  return { ...resource, data: resource.data || normalizeBackendEDA(DEFAULT_API_EDA) }
}
