import useJsonResource from './useJsonResource'

export const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const count = value => Number.isSafeInteger(value) && value >= 0
const total = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0)

export function validateAnalysis(data) {
  const invalid = () => { throw new Error('관측 자료의 표본 수와 집계 응답을 확인할 수 없습니다.') }
  if (data?.schema !== 'observed-analysis-v1' || data.source !== 'historical_observed_events' || !count(data.population?.events) || !data.population.events || !count(data.population.unique_videos) || data.population.unique_videos > data.population.events) invalid()
  const n = data.population.events
  if (!Array.isArray(data.category_summary) || !data.category_summary.length || data.category_summary.some(row => typeof row.category !== 'string' || !count(row.events) || !count(row.duration_n) || !count(row.duration_excluded) || row.duration_n + row.duration_excluded !== row.events) || total(data.category_summary, 'events') !== n) invalid()
  if (data.population.categories !== data.category_summary.length) invalid()
  for (const group of [data.duration, data.annual, data.weekday, data.rank]) if (!count(group?.n) || !count(group.excluded) || group.n + group.excluded !== n) invalid()
  if (!Array.isArray(data.annual.rows) || data.annual.rows.some(row => !count(row.events) || !Array.isArray(row.categories) || row.categories.some(cat => !count(cat.events)) || total(row.categories, 'events') !== row.events) || total(data.annual.rows, 'events') !== data.annual.n) invalid()
  if (!Array.isArray(data.weekday.rows) || data.weekday.rows.length !== 7 || data.weekday.rows.some(row => !count(row.events)) || total(data.weekday.rows, 'events') !== data.weekday.n) invalid()
  if (!Array.isArray(data.rank.histogram) || data.rank.histogram.some(row => !count(row.count)) || total(data.rank.histogram, 'count') !== data.rank.n) invalid()
  const observed = data.observed_24h
  if (!observed || [observed.observed, observed.not_observed, observed.missing].some(value => !count(value)) || observed.observed + observed.not_observed + observed.missing !== n) invalid()
  if (!data.provenance || !Array.isArray(data.features?.numeric) || !Array.isArray(data.features?.categorical)) invalid()
  if (data.tdi?.status === 'ready') {
    const tdi = data.tdi
    if (!count(tdi.population) || !tdi.population || !count(tdi.excluded) || tdi.population + tdi.excluded !== n || !count(tdi.positive) || tdi.positive > tdi.population || !Array.isArray(tdi.histogram) || tdi.histogram.length !== 10 || tdi.histogram.some(row => !count(row.count) || !Number.isFinite(row.lower) || !Number.isFinite(row.upper)) || total(tdi.histogram, 'count') !== tdi.population || !Number.isFinite(tdi.positive_rate) || Math.abs(tdi.positive_rate - tdi.positive / tdi.population) > 1e-9) invalid()
  } else if (data.tdi?.status !== 'unavailable') invalid()
  return data
}

export function useEDA(endpoint = 'eda') {
  return useJsonResource(`${API}/${endpoint}/summary`, { timeoutMs: 12000, normalize: validateAnalysis })
}
