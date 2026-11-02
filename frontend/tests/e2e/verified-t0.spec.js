import { test, expect } from '@playwright/test'

const API = 'http://127.0.0.1:18000/predict/t0-verified'
const PREDICT = /\/predict\/t0-verified$/
const sample = { T0: '2025-02-01T12:00:00+09:00', published_at: '2025-02-01T00:00:00+09:00', entry_rank: 30, T0_view: 100000, T0_comment: 250, category_group: 'Entertainment' }

async function ready(page) {
  await page.goto('/analysis/predict')
  await expect(page.getByRole('button', { name: '샘플 입력 채우기' })).toBeEnabled()
}
async function fillSample(page) { await page.getByRole('button', { name: '샘플 입력 채우기' }).click() }
async function submit(page) { await page.getByRole('button', { name: /^(예측 실행|다시 예측하기)$/ }).click() }
async function resultAbsent(page) { await expect(page.getByTestId('prediction-result')).toHaveCount(0) }
async function capturePage(page, path) {
  // The existing app scrolls inside a fixed-height body. Expand only the capture bounds.
  await page.addStyleTag({ content: 'html, body, #root { height: auto !important; scroll-behavior: auto !important; }' })
  await page.evaluate(() => { document.body.scrollTop = 0; window.scrollTo(0, 0) })
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
}

test('REAL API: starts empty, sample only fills, prediction exactly matches API and request snapshot', async ({ page }, testInfo) => {
  let posts = 0
  page.on('request', request => { if (PREDICT.test(request.url()) && request.method() === 'POST') posts++ })
  await ready(page)
  await resultAbsent(page)
  await fillSample(page)
  await resultAbsent(page)
  expect(posts).toBe(0)
  const responsePromise = page.waitForResponse(response => PREDICT.test(response.url()) && response.request().method() === 'POST')
  await submit(page)
  const response = await responsePromise
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual(sample)
  const body = await response.json()
  await expect(page.getByTestId('model-score')).toHaveText(body.predictions[0].probability.toFixed(4))
  await expect(page.getByTestId('model-threshold')).toHaveText(String(body.threshold))
  await expect(page.getByTestId('result-model')).toHaveText(body.model)
  await expect(page.getByTestId('result-run')).toHaveText(body.run_id)
  await expect(page.getByRole('heading', { name: body.predictions[0].label === 1 ? '고지속 후보' : '고지속 후보 아님', exact: true })).toBeVisible()
  await expect(page.getByTestId('prediction-result')).toContainText('2025-02-01 12:00')
  expect(posts).toBe(1)
  await testInfo.attach('real-api-response', { body: JSON.stringify({ input: sample, response: body }, null, 2), contentType: 'application/json' })
  await capturePage(page, testInfo.outputPath('prediction-desktop.png'))
  await page.reload()
  await resultAbsent(page)
  await expect(page.getByLabel('진입 당시 조회수', { exact: true })).toHaveValue('')
})

test('REAL API: validation rejects missing fields, reversed dates, invalid ranks, negative and fractional counts', async ({ page }) => {
  let posts = 0
  page.on('request', request => { if (PREDICT.test(request.url()) && request.method() === 'POST') posts++ })
  await ready(page)
  await submit(page)
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(6)
  await fillSample(page)
  await page.getByLabel('영상 발행 시각 (KST)', { exact: true }).fill('2025-02-02T12:00')
  await submit(page)
  await expect(page.getByText('발행 시각은 최초 진입 시각보다 늦을 수 없습니다.')).toBeVisible()
  for (const [label, value, message] of [['최초 진입 순위', '201', '1~200 사이의 정수를 입력하세요.'], ['진입 당시 조회수', '-1', '0 이상의 정수를 입력하세요.'], ['진입 당시 댓글 수', '2.5', '0 이상의 정수를 입력하세요.']]) {
    await fillSample(page)
    await page.getByLabel(label, { exact: true }).fill(value)
    await submit(page)
    await expect(page.getByText(message, { exact: true })).toBeVisible()
  }
  await fillSample(page)
  await page.getByLabel('최초 차트 진입 시각 (KST)', { exact: true }).fill('')
  await submit(page)
  await expect(page.getByText('유효한 날짜와 시각을 입력하세요.', { exact: true })).toBeVisible()
  expect(posts).toBe(0)
  await resultAbsent(page)
})

for (const failure of ['503', 'network']) {
  test(`INJECTED ${failure}: no result, explicit error, retry reaches real API`, async ({ page }) => {
    await ready(page)
    await fillSample(page)
    await page.route(PREDICT, route => failure === '503' ? route.fulfill({ status: 503, json: { detail: 'not ready' } }) : route.abort('failed'), { times: 1 })
    await submit(page)
    await expect(page.getByRole('alert')).toContainText(failure === '503' ? '검증된 모델을 사용할 수 없습니다' : '서버에 연결할 수 없습니다')
    await resultAbsent(page)
    await submit(page)
    await expect(page.getByTestId('prediction-result')).toBeVisible()
  })
}

test('INJECTED timeout: aborts after 12 seconds, no result, retry succeeds', async ({ page }) => {
  await page.clock.install()
  await ready(page)
  await fillSample(page)
  let release
  await page.route(PREDICT, async route => { await new Promise(resolve => { release = resolve }); await route.abort().catch(() => {}) }, { times: 1 })
  await submit(page)
  await expect(page.getByRole('button', { name: '예측 요청 중…' })).toBeDisabled()
  await page.clock.fastForward(12500)
  await expect(page.getByRole('alert')).toContainText('응답 시간이 초과되었습니다')
  await resultAbsent(page)
  release()
  await submit(page)
  await expect(page.getByTestId('prediction-result')).toBeVisible()
})

test('INJECTED delay: duplicate submit sends once; editing cancels; late response never replaces current input', async ({ page, request }) => {
  const actual = await (await request.post(API, { data: sample })).json()
  await ready(page)
  await fillSample(page)
  let posts = 0
  let release
  await page.route(PREDICT, async route => { posts++; await new Promise(resolve => { release = resolve }); await route.fulfill({ json: actual }).catch(() => {}) }, { times: 1 })
  await page.getByRole('form', { name: 'T0 예측 입력' }).evaluate(form => { form.requestSubmit(); form.requestSubmit() })
  await expect(page.getByRole('button', { name: '예측 요청 중…' })).toBeDisabled()
  await expect.poll(() => posts).toBe(1)
  await page.getByLabel('진입 당시 조회수', { exact: true }).fill('200000')
  await expect(page.getByRole('button', { name: '예측 실행', exact: true })).toBeEnabled()
  await resultAbsent(page)
  release()
  const next = page.waitForResponse(response => PREDICT.test(response.url()) && response.request().method() === 'POST' && response.request().postDataJSON().T0_view === 200000)
  await submit(page)
  const body = await (await next).json()
  await expect(page.getByTestId('model-score')).toHaveText(body.predictions[0].probability.toFixed(4))
  await expect(page.getByTestId('prediction-result')).toContainText('200000')
  await page.getByLabel('진입 당시 댓글 수', { exact: true }).fill('0')
  await resultAbsent(page)
})

test('INJECTED invalid response and 422: no fabricated result and field error shown', async ({ page }) => {
  await ready(page)
  await fillSample(page)
  await page.route(PREDICT, route => route.fulfill({ json: { probability: .724 } }), { times: 1 })
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('예측 응답을 검증하지 못했습니다')
  await resultAbsent(page)
  await page.route(PREDICT, route => route.fulfill({ status: 422, json: { detail: [{ loc: ['body', 'entry_rank'], msg: 'invalid' }] } }), { times: 1 })
  await submit(page)
  await expect(page.getByLabel('최초 진입 순위', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await resultAbsent(page)
})

test('REAL API: evaluation and interpretation match the report, with no legacy score fallback', async ({ page, request }, testInfo) => {
  const response = await request.get(`${API}/evaluation`)
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  const selected = body.models.find(row => row.name === body.selected_model)
  for (const path of ['/analysis/model', '/analysis/explain']) {
    await page.goto(path)
    await expect(page.getByTestId('selected-model')).toHaveText(body.selected_model)
    await expect(page.getByTestId('test-auc')).toHaveText(selected.test.auc.toFixed(4))
    await expect(page.getByTestId('test-f1')).toHaveText(selected.test.f1.toFixed(4))
    await expect(page.getByTestId('evaluation-run')).toContainText(body.run_id)
    await expect(page.getByText('4,986', { exact: true })).toBeVisible()
  }
  await page.goto('/analysis/model')
  await expect(page.getByTestId('model-comparison').locator('tbody tr')).toHaveCount(body.models.length)
  await testInfo.attach('real-evaluation', { body: JSON.stringify(body, null, 2), contentType: 'application/json' })
  await capturePage(page, testInfo.outputPath('evaluation-desktop.png'))
})

test('INJECTED evaluation unavailable: no fallback numbers; retry recovers', async ({ page }) => {
  await page.route('**/predict/t0-verified/evaluation', route => route.fulfill({ status: 503, json: { detail: 'unavailable' } }))
  await page.goto('/analysis/model')
  await expect(page.getByRole('alert')).toContainText('평가 보고서를 불러오지 못했습니다')
  await expect(page.getByTestId('test-auc')).toHaveCount(0)
  await expect(page.getByTestId('model-comparison')).toHaveCount(0)
  await expect(page.getByText('0.895', { exact: false })).toHaveCount(0)
  await page.unroute('**/predict/t0-verified/evaluation')
  await page.getByRole('button', { name: '보고서 다시 불러오기' }).click()
  await expect(page.getByTestId('test-auc')).toBeVisible()
})

test('INJECTED status unavailable: categories never default; reload and retry recover', async ({ page }) => {
  await page.route('**/predict/t0-verified/status', route => route.fulfill({ status: 503, json: { detail: 'unavailable' } }))
  await page.goto('/analysis/predict')
  await expect(page.getByRole('alert')).toContainText('모델 준비 상태를 확인할 수 없습니다')
  await expect(page.getByRole('button', { name: '예측 실행' })).toBeDisabled()
  await expect(page.getByLabel('카테고리', { exact: true }).locator('option')).toHaveCount(1)
  await page.unroute('**/predict/t0-verified/status')
  await page.getByRole('button', { name: '모델 상태 다시 확인' }).click()
  await expect(page.getByRole('button', { name: '예측 실행' })).toBeEnabled()
})

test('REAL API mobile: submit, readable result, no page overflow, refresh starts empty', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page)
  await fillSample(page)
  await submit(page)
  await expect(page.getByTestId('prediction-result')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await capturePage(page, testInfo.outputPath('prediction-mobile.png'))
  await page.reload()
  await resultAbsent(page)
  await page.goto('/analysis/model')
  await expect(page.getByTestId('test-auc')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  const table = page.getByRole('region', { name: '모델 비교 표', exact: true })
  expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBeTruthy()
  await table.scrollIntoViewIfNeeded()
  await table.evaluate(element => { element.scrollLeft = element.scrollWidth })
  await expect(page.getByTestId('model-comparison').getByRole('columnheader', { name: '임계값', exact: true })).toBeInViewport()
  await table.evaluate(element => { element.scrollLeft = 0 })
  await capturePage(page, testInfo.outputPath('evaluation-mobile.png'))
})

test('INJECTED live feed: only observed stats, no bulk or verified inference from current counters', async ({ page }) => {
  const predictions = []
  page.on('request', request => { if (request.url().includes('/predict/') && request.method() === 'POST') predictions.push(request.url()) })
  const video = { video_id: 'test-video', title: '브라우저 검증용 관측 영상', views: 100000, likes: 2000, comments: 250, category_group: 'Music', channel: '테스트', prediction: { ai_score: 99, predicted_24h_views: 9999999 } }
  await page.route('**/youtube/**', route => route.fulfill({ json: { groups: { all: [video], music: [video] }, source_label: '테스트 관측 피드', refreshed_at: '2026-10-22T12:00:00+09:00' } }))
  await page.route('https://img.youtube.com/**', route => route.abort())
  await page.goto('/video')
  await expect(page.getByRole('heading', { name: '트렌딩 영상 관측' })).toBeVisible()
  await expect(page.getByText('선택 영상의 공개 수치')).toBeVisible()
  await expect(page.getByText('AI 예측 점수', { exact: true })).toHaveCount(0)
  await expect(page.getByText('AI 예측 24시간 조회수 선그래프', { exact: true })).toHaveCount(0)
  expect(predictions).toEqual([])
})

test('REAL API: home, analysis overview and dashboard use the same evaluated run', async ({ page, request }) => {
  const body = await (await request.get(`${API}/evaluation`)).json()
  const selected = body.models.find(row => row.name === body.selected_model)
  for (const [path, selector] of [['/', '[data-testid="home-verified-metrics"]'], ['/analysis', '.trending-hero-stats'], ['/dashboard', '[data-testid="dashboard-verified-metrics"]']]) {
    await page.goto(path)
    await expect(page.locator(selector)).toContainText(selected.test.auc.toFixed(4))
    await expect(page.locator(selector)).toContainText(body.selected_model)
  }
})

test('INJECTED report failure: home, overview and dashboard never display fallback scores', async ({ page }) => {
  await page.route('**/predict/t0-verified/evaluation', route => route.fulfill({ status: 503, json: { detail: 'unavailable' } }))
  for (const [path, selector] of [['/', '[data-testid="home-verified-metrics"]'], ['/analysis', '.trending-hero-stats'], ['/dashboard', '[data-testid="dashboard-verified-metrics"]']]) {
    await page.goto(path)
    await expect(page.locator(selector)).toBeAttached()
    await expect(page.locator(selector)).not.toContainText('0.827')
    await expect(page.locator(selector)).not.toContainText('0.895')
    await expect(page.locator(selector)).not.toContainText('0.8128')
  }
})
