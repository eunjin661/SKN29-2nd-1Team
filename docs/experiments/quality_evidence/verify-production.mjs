import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const [root, evidence] = process.argv.slice(2)
const { chromium, expect } = await import(pathToFileURL(`${root}/frontend/node_modules/@playwright/test/index.mjs`))
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:15174', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const page = await context.newPage()
const pageErrors = []
const failedResponses = []
page.on('pageerror', error => pageErrors.push(error.message))
page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }) })
const routes = []
const result = { mode: 'vite preview (production build)', injectedResponses: false, routes, pageErrors, failedResponses }
async function capture(path) {
  // The app scrolls inside a fixed-height body; expand only the screenshot bounds.
  await page.addStyleTag({ content: 'html, body, #root { height: auto !important; scroll-behavior: auto !important; }' })
  await page.evaluate(() => { document.body.scrollTop = 0; window.scrollTo(0, 0) })
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
}
try {
  for (const route of ['/', '/analysis/predict', '/analysis/model', '/sustain', '/video', '/dashboard', '/campaign']) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.locator('.ui-feedback-loading')).toHaveCount(0)
    routes.push({ route, heading: await page.getByRole('heading', { level: 1 }).first().innerText() })
  }
  await page.goto('/analysis/predict')
  await page.getByRole('button', { name: '샘플 입력 채우기' }).click()
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/predict/t0-verified') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '예측 실행', exact: true }).click()
  const response = await responsePromise
  assert.equal(response.status(), 200)
  result.prediction = await response.json()
  await expect(page.getByTestId('model-score')).toHaveText(result.prediction.predictions[0].probability.toFixed(4))
  await capture(`${evidence}/production-prediction.png`)
  await page.goto('/sustain')
  await expect(page.locator('.sustain-status')).toContainText('34,964건')
  await expect(page.locator('.sustain-video-table tbody tr')).toHaveCount(20)
  await capture(`${evidence}/production-sustain.png`)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(failedResponses, [])
  result.status = 'PASS'
  console.log(JSON.stringify({ status: result.status, routes: routes.length, score: result.prediction.predictions[0].probability, pageErrors, failedResponses }))
} catch (error) {
  result.status = 'FAIL'
  result.error = String(error.stack || error)
  throw error
} finally {
  await writeFile(`${evidence}/production-browser.json`, `${JSON.stringify(result, null, 2)}\n`)
  await browser.close()
}
