import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'

const API = 'http://127.0.0.1:18000'

test('REAL observations: source, every population and TDI exclusions reconcile', async ({ page, request }) => {
  const response = await request.get(`${API}/eda/summary`)
  expect(response.status()).toBe(200)
  const data = await response.json()
  expect(data.population.events).toBe(34964)
  expect(data.category_summary.reduce((n, row) => n + row.events, 0)).toBe(data.population.events)
  expect(data.weekday.rows.reduce((n, row) => n + row.events, 0)).toBe(data.weekday.n)
  expect(data.rank.histogram.reduce((n, row) => n + row.count, 0)).toBe(data.rank.n)
  expect(data.tdi.status).toBe('ready')
  expect(data.tdi.population).toBe(34160)
  expect(data.tdi.excluded).toBe(804)
  expect(data.tdi.histogram.reduce((n, row) => n + row.count, 0)).toBe(data.tdi.population)
  await page.goto('/analysis/eda')
  await expect(page.getByTestId('observed-events')).toHaveText('34,964')
  await expect(page.getByTestId('tdi-total')).toContainText('34,160')
  await expect(page.getByText('로컬 데이터 사용 중')).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '집계 CSV 다운로드' }).click()
  const csv = await fs.readFile(await (await downloadPromise).path(), 'utf8')
  expect(csv).toContain(data.provenance.sha256)
  expect(csv).toContain('"tdi_population","34160"')
})

test('INJECTED population mismatch: a successful HTTP response cannot fabricate a graph', async ({ page, request }) => {
  const data = await (await request.get(`${API}/eda/summary`)).json()
  data.tdi.histogram[0].count += 10000
  await page.route('**/eda/summary', route => route.fulfill({ json: data }))
  await page.goto('/analysis/eda')
  await expect(page.getByRole('alert')).toContainText('표본 수')
  await expect(page.getByTestId('observed-events')).toHaveCount(0)
  await expect(page.getByTestId('tdi-total')).toHaveCount(0)
})

test('Unavailable TDI preserves observed aggregates and never inserts legacy distribution', async ({ page, request }) => {
  const data = await (await request.get(`${API}/eda/summary`)).json()
  data.tdi = { status: 'unavailable', population: null, histogram: [], reason: 'no experiment' }
  await page.route('**/eda/summary', route => route.fulfill({ json: data }))
  await page.goto('/analysis/eda')
  await expect(page.getByTestId('observed-events')).toHaveText('34,964')
  await expect(page.getByTestId('tdi-population')).toContainText('분포를 사용할 수 없습니다')
  await expect(page.getByTestId('tdi-total')).toHaveCount(0)
})

test('REAL dashboard filters both year and category without proportional estimates', async ({ page, request }) => {
  const data = await (await request.get(`${API}/dashboard/summary?year=2025&category=Music`)).json()
  await page.goto('/dashboard')
  await page.locator('.dashboard-filter').getByRole('button', { name: '2025', exact: true }).click()
  await expect(page.locator('.dash-kpi-grid')).toBeVisible()
  await page.locator('.dashboard-filter').getByRole('button', { name: 'Music', exact: true }).click()
  await expect(page.locator('.dash-kpi-grid article').filter({ hasText: '트렌딩 이벤트' })).toContainText(data.kpis.trendEvents.toLocaleString('ko-KR'))
  await expect(page.locator('.dash-kpi-grid article').filter({ hasText: '중앙 지속 시간' })).toContainText(data.kpis.medianDuration.toLocaleString('ko-KR'))
  expect(data.categoryStats.every(row => row.category === 'Music')).toBeTruthy()
})

test('Updated analysis routes show observations or input contracts without legacy model claims', async ({ page }) => {
  for (const path of ['feature', 'insight', 'problem', 'compare', 'strategy']) {
    await page.goto(`/analysis/${path}`)
    await expect(page.getByTestId('observed-events')).toHaveText('34,964')
    await expect(page.locator('.observed-page')).not.toContainText('fallback_safe')
    await expect(page.getByText('조회수 예측 92점')).toHaveCount(0)
    await expect(page.getByText('ROI INDEX')).toHaveCount(0)
  }
})
