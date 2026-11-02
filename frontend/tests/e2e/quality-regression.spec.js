import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import process from 'node:process'

const BULK = '**/youtube/live/bulk?**'
const SINGLE = '**/youtube/trending?**'
const EDA = '**/eda/summary'
const DASHBOARD = '**/dashboard/summary?**'
const video = (id, title, views = 100000) => ({ video_id: id, title, views, likes: 2000, comments: 250, category_group: 'Music', channel: '회귀 테스트' })
const groups = (allTitle = '전체 관측 영상', musicTitle = '뮤직 관측 영상', views = 100000) => ({ groups: {
  all: [video('all-id', allTitle, views)], music: [video('music-id', musicTitle, views)], entertainment: [], lifestyle: [], education: [], news: [],
}, source_label: '테스트 관측', refreshed_at: '2026-10-22T21:00:00+09:00' })
const dashboard = {
  schema: 'observed-dashboard-v1', meta: { source: 'historical_observed_events' },
  filters: { years: ['ALL', '2025'], categories: ['ALL', 'Music', 'News'] },
  kpis: { eventSnapshots: 100, snapshotExcluded: 0, trendEvents: 10, durationN: 10, durationExcluded: 0, medianDuration: 120, categories: 1 },
  categoryStats: [{ category: 'Music', events: 10, medianDuration: 120, strategyScore: 50, risk: 'MID' }],
  trendFlow: [{ label: '2025', value: 10 }], durationDistribution: [{ label: '0~24h', value: 10 }],
  topVideos: [{ title: '=2+2', category: 'Music', duration: 120 }],
}

async function blockMedia(page) {
  await page.route('https://img.youtube.com/**', route => route.abort())
  await page.route('https://www.youtube.com/**', route => route.abort())
}
async function feedReady(page) {
  await page.goto('/video')
  await expect(page.locator('.selected-meta h2')).toHaveText('전체 관측 영상')
  await expect(page.getByRole('button', { name: '바로 갱신', exact: true })).toBeEnabled()
}
async function settlePage(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

test('CountUp: decimals, negatives, units and ranges keep their values after live prop changes', async ({ page }) => {
  await page.goto('/tests/fixtures/components.html')
  const output = page.getByTestId('count-value')
  await expect(output).toHaveText('0.8128')
  for (const [value, expected] of [['-12.50%', '-12.50%'], ['34,964건', '34,964건'], ['2022–2025', '2022–2025'], ['0', '0'], ['Music', 'Music']]) {
    await page.getByLabel('표시 값', { exact: true }).fill(value)
    await expect(output).toHaveText(expected)
  }
})

test('CountUp: duration updates, zero duration and reduced motion finish without stale animation', async ({ page }) => {
  await page.goto('/tests/fixtures/components.html')
  await page.getByLabel('애니메이션 시간', { exact: true }).fill('0')
  await page.getByLabel('표시 값', { exact: true }).fill('123.45%')
  await expect(page.getByTestId('count-value')).toHaveText('123.45%')
  await page.getByLabel('애니메이션 시간', { exact: true }).fill('100')
  await page.getByLabel('표시 값', { exact: true }).fill('-3.75')
  await expect(page.getByTestId('count-value')).toHaveText('-3.75')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.getByLabel('애니메이션 시간', { exact: true }).fill('60000')
  await page.getByLabel('표시 값', { exact: true }).fill('456.78')
  await expect(page.getByTestId('count-value')).toHaveText('456.78', { timeout: 1000 })
})

test('Mobile navigation: route changes, Back/Forward, Escape and resize close the menu; theme persists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/analysis')
  await page.locator('.part-card-new').filter({ hasText: '예측 시스템' }).click()
  await expect(page).toHaveURL(/\/analysis\/predict$/)
  await page.getByRole('button', { name: '모바일 메뉴 열기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '모바일 내비게이션' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/analysis$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goForward()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '다크 모드로 전환', exact: true }).click()
  await expect(page.locator('.yta-root')).toHaveClass(/dark/)
  await page.getByRole('button', { name: '모바일 메뉴 열기', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '모바일 메뉴 열기', exact: true }).click()
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.yta-root')).toHaveClass(/dark/)
})

test('Dashboard: timeout and retry load new data; late old data never replaces the retry', async ({ page }) => {
  await page.clock.install()
  const held = []
  await page.route(DASHBOARD, async route => { await new Promise(resolve => held.push(resolve)); await route.fulfill({ json: { ...dashboard, kpis: { ...dashboard.kpis, trendEvents: 999 } } }).catch(() => {}) })
  await page.goto('/dashboard')
  await expect.poll(() => held.length).toBeGreaterThan(0)
  await page.clock.fastForward(10500)
  await expect(page.getByRole('alert').filter({ hasText: 'API 연결 실패' })).toContainText('응답 시간이 초과되었습니다')
  await expect(page.getByRole('button', { name: 'CSV 다운로드' })).toBeDisabled()
  await page.unroute(DASHBOARD)
  await page.route(DASHBOARD, route => route.fulfill({ json: dashboard }))
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.locator('.dash-kpi-grid article').filter({ hasText: '트렌딩 이벤트' })).toContainText('10')
  held.forEach(resolve => resolve())
  await settlePage(page)
  await expect(page.locator('.dash-kpi-grid')).not.toContainText('999')
})

test('Dashboard: unmount aborts the active request instead of updating the previous page', async ({ page }) => {
  let latest
  const held = []
  const failed = []
  page.on('requestfailed', request => failed.push(request))
  await page.route(DASHBOARD, async route => { latest = route.request(); await new Promise(resolve => held.push(resolve)); await route.abort().catch(() => {}) })
  await page.goto('/dashboard')
  await expect.poll(() => Boolean(latest)).toBeTruthy()
  const request = latest
  await page.getByRole('button', { name: '트렌딩 분석', exact: true }).click()
  await expect.poll(() => failed.includes(request)).toBeTruthy()
  held.forEach(resolve => resolve())
  await expect(page.getByRole('heading', { name: '유튜브 트렌딩 심층 분석' })).toBeVisible()
})

test('EDA: failed response and retry update summary; navigating away aborts a pending retry', async ({ page, request: apiRequest }) => {
  const observed = await (await apiRequest.get('http://127.0.0.1:18000/eda/summary')).json()
  await page.route(EDA, route => route.fulfill({ status: 503, json: { detail: 'offline' } }))
  await page.goto('/analysis/eda')
  await expect(page.getByRole('alert')).toContainText('관측 집계를 불러오지 못했습니다')
  await expect(page.getByTestId('observed-events')).toHaveCount(0)
  await page.unroute(EDA)
  await page.route(EDA, route => route.fulfill({ json: observed }))
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByTestId('observed-events')).toHaveText(observed.population.events.toLocaleString('ko-KR'))
  await page.unroute(EDA)
  let latest
  const held = []
  const failed = []
  page.on('requestfailed', request => failed.push(request))
  await page.route(EDA, async route => { latest = route.request(); await new Promise(resolve => held.push(resolve)); await route.abort().catch(() => {}) })
  await page.getByRole('button', { name: '트렌딩 분석', exact: true }).click()
  await page.locator('.part-card-new').filter({ hasText: 'EDA' }).first().click()
  await expect.poll(() => Boolean(latest)).toBeTruthy()
  const request = latest
  await page.getByRole('button', { name: '트렌딩 분석', exact: true }).click()
  await expect.poll(() => failed.includes(request)).toBeTruthy()
  held.forEach(resolve => resolve())
})

test('Dashboard CSV: filtered empty list stays empty; external formula-like titles are exported as text', async ({ page }) => {
  await page.route(DASHBOARD, route => {
    const empty = new URL(route.request().url()).searchParams.get('category') === 'News'
    return route.fulfill({ json: empty ? { ...dashboard, kpis: { ...dashboard.kpis, trendEvents: 0, durationN: 0, medianDuration: null }, categoryStats: [], topVideos: [], durationDistribution: [] } : dashboard })
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'CSV 다운로드' })).toBeEnabled()
  let downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV 다운로드' }).click()
  let download = await downloadPromise
  let content = await fs.readFile(await download.path(), 'utf8')
  expect(content).toContain('"\'=2+2","Music","120"')
  await page.locator('.dashboard-filter').getByRole('button', { name: 'News', exact: true }).click()
  await expect(page.locator('.dash-table tbody tr')).toHaveCount(0)
  downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV 다운로드' }).click()
  download = await downloadPromise
  content = await fs.readFile(await download.path(), 'utf8')
  expect(content).toContain('"filter_category","News"')
  expect(content).not.toContain('=2+2')
})

test('Video feed: category change cancels old refresh and its late response cannot replace current selection', async ({ page }) => {
  await blockMedia(page)
  let mode = 'initial'
  const held = []
  const failed = []
  page.on('requestfailed', request => failed.push(request))
  let oldRequest
  await page.route(BULK, async route => {
    if (mode === 'hold') {
      oldRequest = route.request()
      await new Promise(resolve => held.push(resolve))
      await route.fulfill({ json: groups('이전 전체 응답', '이전 뮤직 응답') }).catch(() => {})
    } else await route.fulfill({ json: mode === 'new' ? groups('새 전체 관측', '새 뮤직 관측') : groups() })
  })
  await feedReady(page)
  mode = 'hold'
  await page.getByRole('button', { name: '바로 갱신', exact: true }).click()
  await expect.poll(() => Boolean(oldRequest)).toBeTruthy()
  mode = 'new'
  await page.locator('.category-tabs').getByRole('button', { name: /뮤직/ }).click()
  await expect(page.locator('.selected-meta h2')).toHaveText('새 뮤직 관측')
  await expect.poll(() => failed.includes(oldRequest)).toBeTruthy()
  held.forEach(resolve => resolve())
  await settlePage(page)
  await expect(page.locator('.selected-meta h2')).toHaveText('새 뮤직 관측')
  await expect(page.getByText('이전 뮤직 응답', { exact: true })).toHaveCount(0)
})

test('Video feed: one in-flight refresh, automatic refresh resumes afterwards, stable selection stays selected', async ({ page }) => {
  await page.clock.install()
  await blockMedia(page)
  let calls = 0
  let hold = false
  const held = []
  await page.route(BULK, async route => {
    calls++
    if (hold) await new Promise(resolve => held.push(resolve))
    await route.fulfill({ json: groups('전체 관측 영상', '뮤직 관측 영상', calls * 1000) }).catch(() => {})
  })
  await feedReady(page)
  const initial = calls
  hold = true
  await page.getByRole('button', { name: '바로 갱신', exact: true }).click()
  await expect.poll(() => held.length).toBe(1)
  await page.clock.fastForward(20000)
  expect(calls).toBe(initial + 1)
  hold = false
  held.forEach(resolve => resolve())
  await expect(page.getByRole('button', { name: '바로 갱신', exact: true })).toBeEnabled()
  await page.clock.fastForward(20000)
  await expect.poll(() => calls).toBe(initial + 2)
  await expect(page.locator('.selected-meta h2')).toHaveText('전체 관측 영상')
})

test('Video feed: cached observations stay labelled on network failure and refresh recovers', async ({ page }) => {
  await blockMedia(page)
  await page.route(BULK, route => route.fulfill({ json: groups() }))
  await feedReady(page)
  await page.unroute(BULK)
  await page.route(BULK, route => route.abort('failed'))
  await page.route(SINGLE, route => route.abort('failed'))
  await page.reload()
  await expect(page.locator('.selected-meta h2')).toHaveText('전체 관측 영상')
  await expect(page.getByRole('alert')).toContainText('이전 관측을 표시합니다')
  await page.getByRole('button', { name: '바로 갱신', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('이전 관측을 표시합니다')
  await page.reload()
  await expect(page.locator('.selected-meta h2')).toHaveText('전체 관측 영상')
  await expect(page.getByRole('alert')).toContainText('이전 관측을 표시합니다')
  await page.unroute(BULK)
  await page.route(BULK, route => route.fulfill({ json: groups('갱신된 관측 영상') }))
  await page.getByRole('button', { name: '바로 갱신', exact: true }).click()
  await expect(page.locator('.selected-meta h2')).toHaveText('갱신된 관측 영상')
  await expect(page.locator('.video-notice')).toHaveCount(0)
})

for (const corrupt of ['expired', 'malformed']) {
  test(`Video feed: ${corrupt} cache is ignored without a crash or fabricated videos`, async ({ page }) => {
    await blockMedia(page)
    await page.route(BULK, route => route.fulfill({ json: groups() }))
    await feedReady(page)
    await page.evaluate(kind => {
      const key = Object.keys(localStorage).find(value => value.startsWith('yta:live-observation-only-v6:'))
      const value = JSON.parse(localStorage.getItem(key))
      if (kind === 'expired') value.time = Date.now() - 3600000
      else value.data.groups = { all: 'invalid cache shape' }
      localStorage.setItem(key, JSON.stringify(value))
    }, corrupt)
    await page.unroute(BULK)
    await page.route(BULK, route => route.abort('failed'))
    await page.route(SINGLE, route => route.abort('failed'))
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('영상 데이터를 불러오지 못했습니다')
    await expect(page.locator('.selected-meta')).toHaveCount(0)
    await expect(page.getByText('선택한 조건에 해당하는 영상이 없습니다.')).toBeVisible()
  })
}

test('Video feed: legacy single-category endpoint works when bulk is unavailable; empty feed is not endless loading', async ({ page }) => {
  await blockMedia(page)
  await page.route(BULK, route => route.fulfill({ status: 404, json: {} }))
  await page.route(SINGLE, route => route.fulfill({ json: { items: [video('fallback', new URL(route.request().url()).searchParams.get('category_id') === '10' ? '뮤직 단일 관측' : '전체 관측 영상')] } }))
  await feedReady(page)
  await page.locator('.category-tabs').getByRole('button', { name: /뮤직/ }).click()
  await expect(page.locator('.selected-meta h2')).toHaveText('뮤직 단일 관측')
  await page.unroute(BULK)
  await page.route(BULK, route => route.fulfill({ json: { groups: { all: [], music: [] }, source_label: '빈 관측' } }))
  await page.getByRole('button', { name: '바로 갱신', exact: true }).click()
  await expect(page.getByText('선택한 조건에 해당하는 영상이 없습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '바로 갱신', exact: true })).toBeEnabled()
})

test('API health: offline banner makes no unsupported claim that every page has stored results', async ({ page }) => {
  await page.route('**/healthz', route => route.abort('failed'))
  await page.goto('/analysis/predict')
  const banner = page.getByRole('alert').filter({ hasText: 'API 연결 상태' })
  await expect(banner).toBeVisible()
  await expect(banner).not.toContainText('저장된 데이터로 표시 중')
})

test('Modified legacy screens: all public routes render without uncaught browser errors', async ({ page }) => {
  await blockMedia(page)
  const errors = []
  const serverErrors = []
  page.on('pageerror', error => errors.push(error.message))
  const optionalDiagnostics = []
  page.on('response', response => {
    if (response.url().endsWith('/predict/t0-verified/diagnostics') && !process.env.TRENDIT_TEST_DIAGNOSTICS_ID) optionalDiagnostics.push(response.status())
    else if (response.url().startsWith('http://127.0.0.1:18000/') && response.status() >= 500) serverErrors.push({ url: response.url(), status: response.status() })
  })
  await page.route(BULK, route => route.fulfill({ json: groups() }))
  await page.route(DASHBOARD, route => route.fulfill({ json: dashboard }))
  await page.route(EDA, route => route.fulfill({ json: { trend_events: 34964, category_groups: 5 } }))
  for (const path of ['/', '/analysis', '/analysis/eda', '/analysis/feature', '/analysis/insight', '/analysis/problem', '/analysis/model', '/analysis/compare', '/analysis/explain', '/analysis/predict', '/analysis/strategy', '/video', '/sustain', '/campaign', '/dashboard']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await settlePage(page)
    expect(errors, path).toEqual([])
  }
  expect(serverErrors).toEqual([])
  expect(optionalDiagnostics.every(status => status === 503)).toBeTruthy()
})

test('REAL observed API: sustain shows actual event durations and no legacy predictions or fabricated model metrics', async ({ page, request }) => {
  const response = await request.get('http://127.0.0.1:18000/sustain/summary')
  expect(response.status()).toBe(200)
  const data = await response.json()
  expect(data.analysis_scope).toBe('historical_observations_only')
  expect(data.dataScale.events).toBe(34964)
  expect(data.modelMetrics).toEqual({})
  expect(data.featureImportance).toEqual([])
  expect(data.videos.every(row => row.score === undefined && row.pred === undefined)).toBeTruthy()
  await page.goto('/sustain')
  await expect(page.locator('.sustain-status')).toContainText('34,964건')
  await expect(page.getByRole('columnheader', { name: '관측 지속시간', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '예측 확률', exact: true })).toHaveCount(0)
  await expect(page.locator('.sustain-video-table tbody tr')).toHaveCount(20)
})

test('Sustain unavailable: no example videos or fallback metrics, retry recovers with observations', async ({ page }) => {
  await page.route('**/sustain/summary', route => route.fulfill({ status: 503, json: { detail: 'missing observations' } }))
  await page.goto('/sustain')
  await expect(page.getByRole('alert')).toContainText('관측 데이터를 불러오지 못했습니다')
  await expect(page.locator('.sustain-video-table')).toHaveCount(0)
  await expect(page.getByText('Education trend explainer', { exact: true })).toHaveCount(0)
  await page.unroute('**/sustain/summary')
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.locator('.sustain-status')).toContainText('예측값 미표시')
  await expect(page.locator('.sustain-video-table tbody tr')).toHaveCount(20)
})

test('Sustain rejects a legacy fabricated response instead of filling missing observed fields', async ({ page }) => {
  await page.route('**/sustain/summary', route => route.fulfill({ json: { source: 'fallback', videos: [{ title: '가상 영상', duration: 240, score: .88 }] } }))
  await page.goto('/sustain')
  await expect(page.getByRole('alert')).toContainText('관측 데이터 응답을 확인할 수 없습니다')
  await expect(page.getByText('가상 영상', { exact: true })).toHaveCount(0)
})
